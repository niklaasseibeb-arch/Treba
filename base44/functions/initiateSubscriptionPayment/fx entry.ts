import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { initiatePayment as gatewayInitiate } from '../../shared/paymentGateway.ts';

/**
 * Driver Subscription Payment — initiate a payment for a monthly subscription
 * plan. Treba accepts payments ONLY for driver subscriptions; it never collects
 * passenger fares. Cash is not accepted for subscriptions.
 *
 * Creates a pending SubscriptionInvoice (the subscription period) and a pending
 * SubscriptionPayment linked to the driver, plan, amount, period and provider.
 * The subscription is NOT activated yet — activation happens on successful
 * payment (confirmSubscriptionPayment).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { plan_id, provider_code, auto_renew } = body || {};
    if (!plan_id || !provider_code) {
      return Response.json({ error: 'plan_id and provider_code are required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const plan = await admin.entities.DriverSubscriptionPlan.get(plan_id).catch(() => null);
    if (!plan) return Response.json({ error: 'Subscription plan not found' }, { status: 404 });
    if (plan.is_active === false) return Response.json({ error: 'This plan is not available' }, { status: 400 });
    if (plan.plan_code === 'trial') return Response.json({ error: 'The free trial cannot be purchased' }, { status: 400 });

    const profiles = await admin.entities.DriverProfile.filter({ user_id: user.id }, '-created_date', 5).catch(() => []);
    const profile = (profiles && profiles[0]) || null;
    if (!profile) {
      return Response.json({ error: 'Only drivers can subscribe. Complete your driver profile first.' }, { status: 403 });
    }

    const providers = await admin.entities.PaymentProvider.list('display_order', 200);
    const provider = (providers || []).find((p) => p.provider_code === provider_code && p.is_active);
    if (!provider) return Response.json({ error: 'Selected payment method is not available' }, { status: 400 });
    if (provider.category === 'cash_to_driver') {
      return Response.json({ error: 'Cash is not accepted for subscription payments. Please choose a digital method.' }, { status: 400 });
    }

    const amount = Number(plan.price);
    if (!isFinite(amount) || amount <= 0) {
      return Response.json({ error: 'Invalid plan price' }, { status: 400 });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Reuse a pending invoice for this plan if one already exists.
    const existingInvoices = await admin.entities.SubscriptionInvoice.filter(
      { driver_user_id: user.id, plan_id: plan.id, invoice_status: 'pending' },
      '-created_date',
      5
    ).catch(() => []);
    let invoice = (existingInvoices && existingInvoices[0]) || null;
    if (!invoice) {
      invoice = await admin.entities.SubscriptionInvoice.create({
        driver_id: profile.id,
        driver_user_id: user.id,
        driver_name: profile.full_name || user.full_name || '',
        plan_id: plan.id,
        plan_code: plan.plan_code,
        plan_name: plan.name,
        amount,
        currency: plan.currency || 'NAD',
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        invoice_status: 'pending',
      });
    }

    // Cancel any previous pending payment for this invoice.
    const existingPayments = await admin.entities.SubscriptionPayment.filter(
      { invoice_id: invoice.id, payment_status: 'pending' },
      '-created_date',
      5
    ).catch(() => []);
    for (const p of (existingPayments || [])) {
      try {
        await admin.entities.SubscriptionPayment.update(p.id, {
          payment_status: 'cancelled',
          failure_reason: 'Superseded by a new payment attempt',
        });
      } catch (e) {}
    }

    const gctx = {
      amount,
      currency: plan.currency || 'NAD',
      description: `Treba driver subscription — ${plan.name} (1 month)`,
    };
    const initiated = await gatewayInitiate(admin, provider, gctx);

    const payment = await admin.entities.SubscriptionPayment.create({
      driver_id: profile.id,
      driver_user_id: user.id,
      driver_name: profile.full_name || user.full_name || '',
      invoice_id: invoice.id,
      subscription_id: null,
      plan_id: plan.id,
      plan_code: plan.plan_code,
      plan_name: plan.name,
      amount,
      currency: plan.currency || 'NAD',
      payment_method: provider.category,
      provider_code: provider.provider_code,
      provider_name: provider.name,
      provider_intent_id: initiated.provider_intent_id || null,
      payment_reference: initiated.reference,
      payment_status: 'pending',
      payment_date: now.toISOString(),
      renewal_date: periodEnd.toISOString(),
    });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'subscription_payment_initiated',
        entity_type: 'SubscriptionPayment',
        record_id: payment.id,
        metadata: {
          invoice_id: invoice.id,
          plan_id: plan.id,
          provider_code: provider.provider_code,
          amount,
          auto_renew: !!auto_renew,
        },
      });
    } catch (e) {}

    return Response.json({
      invoice,
      payment,
      reference: initiated.reference,
      next_action: initiated.next_action,
      client_secret: initiated.client_secret,
      auto_renew: !!auto_renew,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}