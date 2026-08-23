import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { confirmPayment as gatewayConfirm } from '../../shared/paymentGateway.ts';
import { getActiveSubscription } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Driver Subscription Payment — confirm the outcome of a subscription payment.
 *
 * In production this is driven by the payment provider's webhook. The outcome
 * argument ('success' | 'failed') represents that callback; when a real Stripe
 * PaymentIntent is present the gateway verifies its status with Stripe.
 *
 * On SUCCESS: the payment becomes SUCCESSFUL, the invoice becomes PAID, and the
 * selected DriverSubscription is ACTIVATED (start = period start, renewal =
 * period end). A successful subscription payment is what grants the driver
 * marketplace access. Treba never auto-charges — the driver actively pays.
 *
 * On FAILURE: the payment becomes FAILED and the invoice becomes FAILED. No
 * subscription is activated.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { payment_id, outcome, reason } = body || {};
    if (!payment_id || !outcome) {
      return Response.json({ error: 'payment_id and outcome are required' }, { status: 400 });
    }
    if (!['success', 'failed'].includes(outcome)) {
      return Response.json({ error: 'Invalid outcome' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const payment = await admin.entities.SubscriptionPayment.get(payment_id).catch(() => null);
    if (!payment) return Response.json({ error: 'Subscription payment not found' }, { status: 404 });
    if (payment.driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (payment.payment_status !== 'pending') {
      return Response.json({ error: 'This payment is no longer pending' }, { status: 400 });
    }

    const invoice = await admin.entities.SubscriptionInvoice.get(payment.invoice_id).catch(() => null);
    if (!invoice) return Response.json({ error: 'Linked invoice not found' }, { status: 404 });

    const providers = await admin.entities.PaymentProvider.list('display_order', 200);
    const provider = (providers || []).find((p) => p.provider_code === payment.provider_code) || null;

    const result = await gatewayConfirm(admin, provider, payment, outcome, { reason });
    const now = new Date().toISOString();

    if (result.status === 'successful') {
      await admin.entities.SubscriptionPayment.update(payment.id, {
        payment_status: 'successful',
        confirmed_at: now,
        failure_reason: null,
      });

      // Snapshot the plan allowance onto the activated subscription.
      const plan = await admin.entities.DriverSubscriptionPlan.get(payment.plan_id).catch(() => null);

      // Supersede any existing active subscription for this driver.
      const existing = await getActiveSubscription(admin, payment.driver_user_id);
      if (existing) {
        try {
          await admin.entities.DriverSubscription.update(existing.id, {
            status: 'cancelled',
            cancelled_at: now,
          });
        } catch (e) {}
      }

      const start = new Date(invoice.period_start);
      const renewal = new Date(invoice.period_end);
      const subscription = await admin.entities.DriverSubscription.create({
        driver_id: payment.driver_id,
        driver_user_id: payment.driver_user_id,
        driver_name: payment.driver_name || '',
        plan_id: payment.plan_id,
        plan_code: payment.plan_code,
        plan_name: payment.plan_name,
        price: payment.amount,
        currency: payment.currency,
        trip_allowance: plan ? (plan.trip_allowance || 0) : 0,
        is_unlimited: plan ? !!plan.is_unlimited : false,
        status: 'active',
        start_date: start.toISOString(),
        renewal_date: renewal.toISOString(),
        trips_used: 0,
        auto_renew: false,
        payment_reference: payment.payment_reference,
      });

      await admin.entities.SubscriptionInvoice.update(invoice.id, {
        invoice_status: 'paid',
        payment_id: payment.id,
        subscription_id: subscription.id,
      });
      await admin.entities.SubscriptionPayment.update(payment.id, { subscription_id: subscription.id });

      try {
        await sendNotification(admin, {
          user_id: payment.driver_user_id,
          event_type: NOTIFICATION_EVENTS.SUBSCRIPTION_ACTIVATED,
          title: 'Subscription activated',
          message: `Your ${payment.plan_name} subscription is active. Your subscription renews on ${renewal.toLocaleDateString()}.`,
          related_id: subscription.id,
        });
      } catch (e) {}

      try {
        await admin.entities.AuditLog.create({
          user_id: user.id,
          user_role: user.role,
          action: 'subscription_activated',
          entity_type: 'DriverSubscription',
          record_id: subscription.id,
          metadata: {
            payment_id: payment.id,
            invoice_id: invoice.id,
            plan_code: payment.plan_code,
            amount: payment.amount,
          },
        });
      } catch (e) {}

      return Response.json({ status: 'successful', subscription });
    }

    if (result.status === 'failed') {
      await admin.entities.SubscriptionPayment.update(payment.id, {
        payment_status: 'failed',
        failure_reason: result.reason || reason || 'Payment failed',
      });
      try {
        await admin.entities.SubscriptionInvoice.update(invoice.id, { invoice_status: 'failed' });
      } catch (e) {}
      try {
        await sendNotification(admin, {
          user_id: payment.driver_user_id,
          event_type: NOTIFICATION_EVENTS.SUBSCRIPTION_PAYMENT_FAILED,
          title: 'Subscription payment failed',
          message: `Your subscription payment of N$${Number(payment.amount).toFixed(0)} failed. Please try again.`,
          related_id: payment.id,
        });
      } catch (e) {}
      return Response.json({ status: 'failed', reason: result.reason || reason });
    }

    return Response.json({ status: 'pending' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}