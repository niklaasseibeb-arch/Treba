/**
 * Treba Driver Subscription & 60-Day Free Trial engine.
 *
 * Treba is a passenger-demand-driven town-to-town travel marketplace. Drivers
 * do NOT pay commission per trip. Drivers pay a monthly subscription to access
 * the platform, and every newly approved driver receives a 60-day free trial
 * before choosing a paid plan. Treba never collects, estimates or deducts
 * from passenger fares.
 *
 * Trial rules:
 *   - One trial per driver, ever. It cannot be restarted by changing plans or
 *     by creating another account.
 *   - The trial grants full marketplace access for `trial_duration_days`.
 *   - The trial requires no payment and does not count against a paid plan.
 *   - When the trial expires the driver must actively select a paid plan to
 *     continue receiving new requests/allocations. Treba never auto-charges.
 *
 * Trip accounting:
 *   - One completed TripOperation counts as one completed trip against the
 *     driver's active subscription/trial. Cancelled bookings, passenger
 *     no-shows and driver no-shows never reach the completion path.
 */
import { sendNotification, NOTIFICATION_EVENTS } from './notifications.ts';

export const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
};

export const TRIAL_DISPLAY_STATUSES = {
  TRIAL_ACTIVE: 'trial_active',
  TRIAL_EXPIRING: 'trial_expiring',
  TRIAL_EXPIRED: 'trial_expired',
};

export const PLAN_CODES = {
  STARTER: 'starter',
  STANDARD: 'standard',
  PREMIUM: 'premium',
  TRIAL: 'trial',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_WINDOW_MS = 3 * DAY_MS;
const DEFAULT_TRIAL_DAYS = 60;
const DEFAULT_REMINDER_DAYS = [30, 14, 7, 3, 1];

/**
 * Read the active TrialPolicy (admin-configurable), falling back to defaults.
 */
export async function getTrialPolicy(admin) {
  try {
    const policies = await admin.entities.TrialPolicy.filter({ is_active: true }, '-created_date', 5);
    const p = (policies && policies[0]) || null;
    return {
      trial_duration_days: p?.trial_duration_days || DEFAULT_TRIAL_DAYS,
      reminder_days: Array.isArray(p?.reminder_days) && p.reminder_days.length ? p.reminder_days : DEFAULT_REMINDER_DAYS,
      transition_policy: p?.transition_policy || 'honor_existing_bookings',
    };
  } catch (e) {
    return {
      trial_duration_days: DEFAULT_TRIAL_DAYS,
      reminder_days: DEFAULT_REMINDER_DAYS,
      transition_policy: 'honor_existing_bookings',
    };
  }
}

export async function findTrialPlan(admin) {
  try {
    const plans = await admin.entities.DriverSubscriptionPlan.filter({ plan_code: 'trial' }, '-created_date', 5);
    return (plans && plans[0]) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Has this driver ever had a free trial? Used to prevent restarting a trial.
 */
export async function hasExistingTrial(admin, driverUserId) {
  if (!driverUserId) return false;
  try {
    const subs = await admin.entities.DriverSubscription.filter({ driver_user_id: driverUserId, is_trial: true }, '-created_date', 20);
    return (subs || []).length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Does a single subscription record currently grant marketplace access?
 *
 * Access rules (Driver Subscription Access Control):
 *   - trial (end_date in the future)            -> access (TRIAL_ACTIVE)
 *   - active / expiring (renewal_date in future) -> access (ACTIVE)
 *   - cancelled (renewal_date in the future)     -> access until the paid period ends
 *   - suspended                                 -> no access
 *   - expired / trial_expired / cancelled-past   -> no access
 *
 * A cancelled subscription keeps access until its paid period ends; after that
 * the driver must renew or choose another plan. This never deletes profile,
 * history or previous trips — it only gates NEW requests and allocations.
 */
export function subscriptionGrantsAccess(sub, now = Date.now()) {
  if (!sub) return false;
  const base = sub.status;
  if (base === 'suspended' || base === 'expired') return false;
  if (base === 'trial') {
    if (!sub.end_date) return true;
    return new Date(sub.end_date).getTime() > now;
  }
  if (base === 'active' || base === 'expiring') {
    if (!sub.renewal_date) return true;
    return new Date(sub.renewal_date).getTime() > now;
  }
  if (base === 'cancelled') {
    if (!sub.renewal_date) return false;
    return new Date(sub.renewal_date).getTime() > now;
  }
  return false;
}

/**
 * Find a driver's currently active subscription (trial, active, or cancelled
 * within its paid period). Expired trials, expired and suspended subscriptions
 * do not count as active.
 */
export async function getActiveSubscription(admin, driverUserId) {
  if (!driverUserId) return null;
  const subs = await admin.entities.DriverSubscription.filter({ driver_user_id: driverUserId }, '-created_date', 20).catch(() => []);
  const now = Date.now();
  return (subs || []).find((s) => subscriptionGrantsAccess(s, now)) || null;
}

/**
 * Derive the display status. Trials surface TRIAL_ACTIVE / TRIAL_EXPIRING /
 * TRIAL_EXPIRED; paid plans surface ACTIVE / EXPIRING / EXPIRED.
 */
export function computeDisplayStatus(subscription) {
  if (!subscription) return null;
  const base = subscription.status;
  if (base === 'cancelled' || base === 'suspended') return base;
  const end = subscription.is_trial ? subscription.end_date : subscription.renewal_date;
  const endMs = end ? new Date(end).getTime() : null;
  if (endMs && endMs <= Date.now()) return subscription.is_trial ? 'trial_expired' : 'expired';
  if (endMs && endMs - Date.now() <= EXPIRING_WINDOW_MS) return subscription.is_trial ? 'trial_expiring' : 'expiring';
  return subscription.is_trial ? 'trial_active' : base;
}

export function tripUsage(subscription) {
  if (!subscription) return null;
  const used = subscription.trips_used || 0;
  if (subscription.is_unlimited) {
    return { used, allowance: null, is_unlimited: true, remaining: null, exhausted: false };
  }
  const allowance = subscription.trip_allowance || 0;
  return { used, allowance, is_unlimited: false, remaining: Math.max(0, allowance - used), exhausted: used >= allowance };
}

export function daysRemaining(subscription) {
  if (!subscription) return null;
  const end = subscription.is_trial ? subscription.end_date : subscription.renewal_date;
  if (!end) return null;
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / DAY_MS));
}

export function trialDay(subscription) {
  if (!subscription || !subscription.is_trial || !subscription.start_date) return null;
  const day = Math.floor((Date.now() - new Date(subscription.start_date).getTime()) / DAY_MS) + 1;
  return Math.max(1, day);
}

/**
 * Send any due trial reminder notifications for a subscription, tracking
 * which thresholds have already been notified so each is sent at most once.
 */
export async function maybeSendTrialReminder(admin, subscription, policy) {
  if (!subscription || !subscription.is_trial) return false;
  const p = policy || { reminder_days: DEFAULT_REMINDER_DAYS };
  const remaining = daysRemaining(subscription);
  if (remaining == null) return false;
  const sent = Array.isArray(subscription.reminders_sent) ? subscription.reminders_sent : [];
  const thresholds = p.reminder_days || DEFAULT_REMINDER_DAYS;
  const due = thresholds.filter((t) => remaining <= t && !sent.includes(t));
  if (!due.length) return false;
  for (const t of due) {
    try {
      await sendNotification(admin, {
        user_id: subscription.driver_user_id,
        event_type: NOTIFICATION_EVENTS.TRIAL_REMINDER,
        title: `${remaining} day${remaining === 1 ? '' : 's'} left in your free trial`,
        message: `Your Treba free trial ends in ${remaining} day${remaining === 1 ? '' : 's'}. Choose a subscription plan to keep receiving passenger requests after your trial ends.`,
        related_id: subscription.id,
        dedupe_key: `trial_reminder_${subscription.id}_${t}`,
      });
    } catch (e) {}
  }
  const newSent = Array.from(new Set([...sent, ...due]));
  try {
    await admin.entities.DriverSubscription.update(subscription.id, { reminders_sent: newSent });
  } catch (e) {}
  return true;
}

/**
 * Does the driver currently have active marketplace access (active trial,
 * active paid subscription, or cancelled subscription within its paid
 * period)? Expired, suspended and ended subscriptions do not.
 */
export async function driverHasMarketplaceAccess(admin, driverUserId) {
  const access = await getDriverAccessStatus(admin, driverUserId);
  return access.has_access;
}

/**
 * Set of driver user ids with active marketplace access. Used to gate new
 * allocations, passenger-request matching, re-matching and replacement
 * selection — the "receive new" access points.
 */
export async function getActiveMarketplaceDriverUserIds(admin) {
  const subs = await admin.entities.DriverSubscription.list('-created_date', 500).catch(() => []);
  const now = Date.now();
  const set = new Set();
  for (const s of (subs || [])) {
    if (!s.driver_user_id) continue;
    if (subscriptionGrantsAccess(s, now)) set.add(s.driver_user_id);
  }
  return set;
}

const ACCESS_BLOCKED_MESSAGES = {
  no_subscription: 'No active subscription. Choose a subscription plan to access the Treba marketplace.',
  suspended: 'Your subscription is suspended. Contact Treba to restore marketplace access.',
  cancelled_expired: 'Your subscription period has ended. Renew or choose a new plan to receive new requests and allocations.',
  trial_expired: 'Your free trial has ended. Choose a subscription plan to continue receiving new passenger requests and allocations.',
  expired: 'Your subscription has expired. Renew or choose a new plan to receive new passenger requests and allocations.',
};

function noAccessResult(reason) {
  return {
    has_access: false,
    display_status: 'none',
    subscription: null,
    reason,
    expiry_date: null,
    days_remaining: null,
    is_trial: false,
  };
}

/**
 * Authoritative driver access decision, used by the dashboard warning and by
 * driver-side action gating. Returns:
 *   - has_access      : boolean
 *   - display_status  : 'active' | 'trial_active' | 'expiring' | 'trial_expiring'
 *                       | 'expired' | 'trial_expired' | 'suspended' | 'cancelled'
 *                       | 'none'
 *   - subscription    : the driver's most recent subscription record (or null)
 *   - reason          : why access is blocked (null when has_access is true)
 *   - expiry_date     : trial end_date or paid renewal_date
 *   - days_remaining  : whole days until expiry (null when unknown)
 *   - is_trial        : boolean
 */
export async function getDriverAccessStatus(admin, driverUserId) {
  if (!driverUserId) return noAccessResult('no_subscription');
  const subs = await admin.entities.DriverSubscription.filter({ driver_user_id: driverUserId }, '-created_date', 20).catch(() => []);
  const current = (subs && subs[0]) || null;
  if (!current) return noAccessResult('no_subscription');

  const now = Date.now();
  const has_access = subscriptionGrantsAccess(current, now);
  const is_trial = !!current.is_trial;
  const expiry_date = is_trial ? current.end_date : current.renewal_date;
  const days_remaining = daysRemaining(current);
  const display_status = computeDisplayStatus(current) || current.status;

  let reason = null;
  if (!has_access) {
    if (current.status === 'suspended') reason = 'suspended';
    else if (current.status === 'cancelled') reason = 'cancelled_expired';
    else if (is_trial) reason = 'trial_expired';
    else reason = 'expired';
  }

  return { has_access, display_status, subscription: current, reason, expiry_date, days_remaining, is_trial };
}

/**
 * Assert a driver has marketplace access. Returns { ok: true, access } when the
 * driver may participate, or { ok: false, access, error } with a user-facing
 * message explaining why new requests/allocations are blocked.
 */
export async function assertDriverMarketplaceAccess(admin, driverUserId) {
  const access = await getDriverAccessStatus(admin, driverUserId);
  if (access.has_access) return { ok: true, access };
  return { ok: false, access, error: ACCESS_BLOCKED_MESSAGES[access.reason] || 'Subscription not active.' };
}

/**
 * Increment the completed-trip counter on the driver's active subscription or
 * trial. Called when a TripOperation is marked completed.
 */
export async function incrementSubscriptionTripCount(admin, driverUserId) {
  const sub = await getActiveSubscription(admin, driverUserId);
  if (!sub) return null;
  const used = (sub.trips_used || 0) + 1;
  await admin.entities.DriverSubscription.update(sub.id, { trips_used: used }).catch(() => {});
  return { subscription_id: sub.id, trips_used: used };
}