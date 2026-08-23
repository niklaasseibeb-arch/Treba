import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getActiveSubscription } from '../../shared/driverSubscription.ts';

/**
 * Driver Subscription — activate a monthly subscription plan for the current
 * driver. Treba collects only the driver subscription payment; no commission
 * is ever charged on passenger fares. The `payment_reference` field is the
 * hook for a future subscription payment gateway; for now activating a plan
 * records an active subscription directly.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { plan_id, auto_renew, payment_reference } = body || {};
    if (!plan_id) return Response.json({ error: 'plan_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const plan = await admin.entities.DriverSubscriptionPlan.get(plan_id).catch(() => null);
    if (!plan) return Response.json({ error: 'Subscription plan not found' }, { status: 404 });
    if (plan.is_active === false) return Response.json({ error: 'This plan is not available' }, { status: 400 });
    if (plan.plan_code === 'trial') return Response.json({ error: 'The free trial cannot be selected directly' }, { status: 400 });

    const profiles = await admin.entities.DriverProfile.filter({ user_id: user.id }, '-created_date', 5).catch(() => []);
    const profile = (profiles && profiles[0]) || null;
    if (!profile) {
      return Response.json({ error: 'Only drivers can subscribe. Complete your driver profile first.' }, { status: 403 });
    }

    // Supersede any existing active subscription for this driver.
    const existing = await getActiveSubscription(admin, user.id);
    if (existing) {
      await admin.entities.DriverSubscription.update(existing.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }).catch(() => {});
    }

    const now = new Date();
    const renewal = new Date(now);
    renewal.setMonth(renewal.getMonth() + 1);

    const subscription = await admin.entities.DriverSubscription.create({
      driver_id: profile.id,
      driver_user_id: user.id,
      driver_name: profile.full_name || user.full_name || '',
      plan_id: plan.id,
      plan_code: plan.plan_code,
      plan_name: plan.name,
      price: plan.price,
      currency: plan.currency || 'NAD',
      trip_allowance: plan.trip_allowance || 0,
      is_unlimited: !!plan.is_unlimited,
      status: 'active',
      start_date: now.toISOString(),
      renewal_date: renewal.toISOString(),
      trips_used: 0,
      auto_renew: !!auto_renew,
      payment_reference: payment_reference || null,
    });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'driver_subscribed',
        entity_type: 'DriverSubscription',
        record_id: subscription.id,
        metadata: { plan_id: plan.id, plan_code: plan.plan_code, price: plan.price },
      });
    } catch (e) {}

    return Response.json({ subscription });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}