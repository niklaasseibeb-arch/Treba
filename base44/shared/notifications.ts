/**
 * Treba Notification System — central event-driven dispatcher.
 *
 * All marketplace events route through `sendNotification`. In-app delivery is
 * always on; SMS, WhatsApp and email channels are prepared as gated extension
 * points (CHANNELS) for later provider integration. Duplicate notifications
 * are suppressed per (user_id, event_type, related_id).
 *
 * Fare is never created or estimated here — this system only observes events
 * produced by the demand-driven workflow.
 */

export const NOTIFICATION_EVENTS = {
  // --- Passenger events ---
  TRIP_REQUEST_RECEIVED: 'trip_request_received',
  DRIVER_MATCHED: 'driver_matched',
  DRIVER_RESPONDED: 'driver_responded',
  FARE_OFFER_RECEIVED: 'fare_offer_received',
  COUNTER_OFFER_RECEIVED: 'counter_offer_received',
  FARE_AGREED: 'fare_agreed',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_SUCCESSFUL: 'payment_successful',
  BOOKING_CONFIRMED: 'booking_confirmed',
  CASH_PAYMENT_REMINDER: 'cash_payment_reminder',
  CASH_BOOKING_OVERDUE: 'cash_booking_overdue',
  BOOKING_CANCELLED: 'booking_cancelled',
  DRIVER_APPROACHING: 'driver_approaching',
  TRIP_COMPLETED: 'trip_completed',
  NO_SHOW_RECORDED: 'no_show_recorded',
  DISPUTE_UPDATE: 'dispute_update',

  // --- Driver events ---
  DAILY_ALLOCATION: 'daily_allocation',
  ALLOCATION_CONFIRMATION_REQUIRED: 'allocation_confirmation_required',
  ALLOCATION_CONFIRMED: 'allocation_confirmed',
  PASSENGER_REQUEST: 'passenger_request',
  PASSENGER_COUNTER_OFFER: 'passenger_counter_offer',
  DRIVER_FARE_AGREED: 'driver_fare_agreed',
  DRIVER_PAYMENT_SUCCESSFUL: 'driver_payment_successful',
  CASH_PASSENGER_PENDING: 'cash_passenger_pending',
  DRIVER_CASH_REMINDER: 'driver_cash_reminder',
  PASSENGER_NO_SHOW: 'passenger_no_show',
  TRIP_REMINDER: 'trip_reminder',
  EARNINGS_AVAILABLE: 'earnings_available',
  PAYOUT_COMPLETED: 'payout_completed',
  PAYOUT_FAILED: 'payout_failed',
  RATING_RECEIVED: 'rating_received',

  // --- Driver allocation swap events ---
  DRIVER_SWAP_REQUESTED: 'driver_swap_requested',
  DRIVER_SWAP_ACCEPTED: 'driver_swap_accepted',
  DRIVER_SWAP_DECLINED: 'driver_swap_declined',
  DRIVER_CHANGED: 'driver_changed',

  // --- Passenger booking transfer events ---
  BOOKING_TRANSFER_REQUESTED: 'booking_transfer_requested',
  BOOKING_TRANSFER_ACCEPTED: 'booking_transfer_accepted',
  BOOKING_TRANSFER_DECLINED: 'booking_transfer_declined',
  BOOKING_TRANSFERRED: 'booking_transferred',

  // --- Trial & subscription events ---
  TRIAL_STARTED: 'trial_started',
  TRIAL_REMINDER: 'trial_reminder',
  TRIAL_EXPIRED: 'trial_expired',
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  SUBSCRIPTION_PAYMENT_FAILED: 'subscription_payment_failed',
};

// Channel enablement. In-app is live; SMS / WhatsApp / email are stubbed and
// gated off until their provider adapters are configured.
const CHANNELS = {
  in_app: { enabled: true },
  sms: { enabled: false },
  whatsapp: { enabled: false },
  email: { enabled: false },
};

/**
 * Send an event-driven notification.
 *
 * Dedupe: if an UNREAD notification for the same (user_id, event_type,
 * related_id) already exists, no duplicate is created. Pass `dedupe_key` to
 * override the dedupe identity (defaults to related_id).
 *
 * @param {object} admin - base44.asServiceRole client
 * @param {object} opts
 * @param {string} opts.user_id   - recipient user id (required)
 * @param {string} opts.event_type - canonical event from NOTIFICATION_EVENTS
 * @param {string} opts.title      - in-app title
 * @param {string} opts.message    - in-app body
 * @param {string} [opts.related_id] - entity id (dedupe + deep link)
 * @param {string} [opts.dedupe_key] - override dedupe key
 * @param {object} [opts.context]   - reserved channel context (phone, email)
 * @returns {Promise<object|null>} the created notification, or null if suppressed/failed
 */
export async function sendNotification(admin, opts) {
  const { user_id, event_type, title, message, related_id, dedupe_key, context } = opts || {};
  if (!user_id || !event_type || !title || !message) return null;

  const key = dedupe_key || related_id || '';

  // Dedupe against unread notifications for the same user + event + entity.
  try {
    const recent = await admin.entities.Notification.filter(
      { user_id, notification_type: event_type, is_read: false },
      '-created_date',
      50
    );
    const dup = (recent || []).some((n) => (n.related_id || '') === key);
    if (dup) return null;
  } catch (e) {}

  let notification = null;
  try {
    notification = await admin.entities.Notification.create({
      user_id,
      notification_type: event_type,
      title,
      message,
      related_id: related_id || null,
      is_read: false,
    });
  } catch (e) {}

  // Multi-channel dispatch (in-app delivered above; others gated for later).
  await dispatchChannels(admin, { event_type, user_id, title, message, related_id, context, notification });

  return notification;
}

/**
 * Fan out to enabled channels. In-app is already delivered inline; SMS,
 * WhatsApp and email only run when their adapter is enabled in CHANNELS.
 */
async function dispatchChannels(admin, payload) {
  const tasks = [];
  if (CHANNELS.sms.enabled) tasks.push(sendSMS(admin, payload));
  if (CHANNELS.whatsapp.enabled) tasks.push(sendWhatsApp(admin, payload));
  if (CHANNELS.email.enabled) tasks.push(sendEmail(admin, payload));
  await Promise.allSettled(tasks);
  return null;
}

// --- Channel adapters (stubs for future provider integration) ---

/** SMS gateway adapter. Plug in Africa's Talking / Twilio when enabled. */
async function sendSMS(admin, p) {
  // Requires: p.context.phone + provider credentials (set via app secrets).
  return null;
}

/** WhatsApp Business API adapter. */
async function sendWhatsApp(admin, p) {
  // Requires: p.context.phone + WhatsApp Business credentials.
  return null;
}

/** Email adapter. Use base44 Core.SendEmail for registered users when enabled. */
async function sendEmail(admin, p) {
  // Requires: p.context.email (registered user). Use base44.integrations.Core.SendEmail.
  return null;
}