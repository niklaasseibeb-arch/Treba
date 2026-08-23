import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getActiveSubscription,
  computeDisplayStatus,
  tripUsage,
  daysRemaining,
  trialDay,
  maybeSendTrialReminder,
  getTrialPolicy,
} from '../../shared/driverSubscription.ts';

/**
 * Returns the driver's subscription context: the active trial policy, the
 * selectable paid plans, and the driver's current subscription (trial or
 * paid) with a derived display status, trip usage and trial counter. Also
 * fires any due trial reminders when the driver views their subscription.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = base44.asServiceRole;
    const policy = await getTrialPolicy(admin);

    const plans = await admin.entities.DriverSubscriptionPlan.filter({ is_active: true }, 'sort_order', 50).catch(() => []);

    const allSubs = await admin.entities.DriverSubscription.filter({ driver_user_id: user.id }, '-created_date', 20).catch(() => []);
    const current = (allSubs && allSubs[0]) || null;
    const active = await getActiveSubscription(admin, user.id);

    // Fire any due trial reminders when the driver views their subscription.
    if (current && current.is_trial) {
      try {
        await maybeSendTrialReminder(admin, current, policy);
      } catch (e) {}
    }

    const displayStatus = current ? computeDisplayStatus(current) : null;
    const usage = current ? tripUsage(current) : null;

    return Response.json({
      trial_duration_days: policy.trial_duration_days,
      plans: (plans || [])
        .filter((p) => p.plan_code !== 'trial')
        .map((p) => ({
          id: p.id,
          plan_code: p.plan_code,
          name: p.name,
          price: p.price,
          currency: p.currency,
          trip_allowance: p.trip_allowance,
          is_unlimited: !!p.is_unlimited,
          billing_cycle: p.billing_cycle,
          description: p.description,
          sort_order: p.sort_order,
        })),
      current_subscription: current ? {
        id: current.id,
        plan_id: current.plan_id,
        plan_code: current.plan_code,
        plan_name: current.plan_name,
        price: current.price,
        currency: current.currency,
        status: current.status,
        display_status: displayStatus,
        is_trial: !!current.is_trial,
        start_date: current.start_date,
        renewal_date: current.renewal_date,
        end_date: current.end_date,
        trips_used: current.trips_used || 0,
        trip_allowance: current.trip_allowance,
        is_unlimited: !!current.is_unlimited,
        auto_renew: !!current.auto_renew,
        days_remaining: daysRemaining(current),
        trial_day: trialDay(current),
        usage,
      } : null,
      has_active: !!active,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}