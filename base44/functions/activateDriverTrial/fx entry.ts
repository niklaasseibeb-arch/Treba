import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getTrialPolicy, hasExistingTrial, findTrialPlan } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Approve-and-activate a driver and start their 60-day free trial. The trial
 * begins the moment the driver is activated by Treba, requires no payment, and
 * can never be restarted (one trial per driver, ever). Treba never auto-charges
 * — when the trial expires the driver must actively select a paid plan.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { driver_profile_id } = body || {};
    if (!driver_profile_id) return Response.json({ error: 'driver_profile_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const profile = await admin.entities.DriverProfile.get(driver_profile_id).catch(() => null);
    if (!profile) return Response.json({ error: 'Driver profile not found' }, { status: 404 });
    if (!profile.user_id) return Response.json({ error: 'Driver profile has no linked user' }, { status: 400 });

    // Activate the driver.
    await admin.entities.DriverProfile.update(profile.id, {
      is_activated_for_paid_bookings: true,
      account_status: 'active',
    });

    // Grant the 60-day free trial — one per driver, never restartable.
    const policy = await getTrialPolicy(admin);
    const alreadyHadTrial = await hasExistingTrial(admin, profile.user_id);
    let trial = null;
    if (!alreadyHadTrial) {
      const trialPlan = await findTrialPlan(admin);
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + (policy.trial_duration_days || 60));
      trial = await admin.entities.DriverSubscription.create({
        driver_id: profile.id,
        driver_user_id: profile.user_id,
        driver_name: profile.full_name || '',
        plan_id: trialPlan ? trialPlan.id : null,
        plan_code: 'trial',
        plan_name: trialPlan ? trialPlan.name : '60-Day Free Trial',
        price: 0,
        currency: 'NAD',
        trip_allowance: 0,
        is_unlimited: true,
        is_trial: true,
        status: 'trial',
        start_date: now.toISOString(),
        end_date: end.toISOString(),
        renewal_date: null,
        trips_used: 0,
        auto_renew: false,
        reminders_sent: [],
      });
      try {
        await sendNotification(admin, {
          user_id: profile.user_id,
          event_type: NOTIFICATION_EVENTS.TRIAL_STARTED,
          title: 'Your 60-day free trial has started',
          message: `Welcome to Treba! You have ${policy.trial_duration_days || 60} days of free access — receive passenger requests, negotiate fares and complete trips with no payment required. Choose a subscription plan before your trial ends to keep going.`,
          related_id: trial.id,
        });
      } catch (e) {}
    }

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'driver_activated_trial',
        entity_type: 'DriverProfile',
        record_id: profile.id,
        metadata: { trial_created: !!trial, trial_id: trial ? trial.id : null },
      });
    } catch (e) {}

    return Response.json({ activated: true, trial_created: !!trial, trial });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}