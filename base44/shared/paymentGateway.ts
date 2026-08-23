/**
 * Treba Payment Gateway Layer
 *
 * Provider-agnostic abstraction over the configured PaymentProviders. Treba is
 * NOT hard-coded to one payment provider: the gateway dispatches by provider
 * category and optional configuration. New providers can be added by an admin
 * (PaymentProvider entity) without changing this layer.
 *
 * Security: this layer NEVER stores, logs or transmits card PINs, wallet PINs,
 * passwords or OTPs. For card payments it uses a provider-hosted PaymentIntent
 * (Stripe) when a secret key is configured; otherwise it falls back to a
 * reference-based confirmation flow that represents the provider's webhook.
 */

const DIGITAL_CATEGORIES = ['bank_card', 'mobile_wallet', 'pay2cell', 'other_digital'];

export function isDigitalCategory(category) {
  return DIGITAL_CATEGORIES.includes(category);
}

export function generateReference(prefix = 'TRB') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function stripeSecret() {
  try {
    return process.env.STRIPE_SECRET_KEY || null;
  } catch (e) {
    return null;
  }
}

async function stripeCreateIntent(amountMinor, currency, reference, description) {
  const key = stripeSecret();
  if (!key) return null;
  const body = new URLSearchParams();
  body.set('amount', String(amountMinor));
  body.set('currency', (currency || 'nad').toLowerCase());
  body.set('description', description || 'Treba trip fare');
  body.set('metadata[reference]', reference);
  body.set('automatic_payment_methods[enabled]', 'true');
  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await res.json();
  if (!data || !data.id) {
    throw new Error((data && data.error && data.error.message) || 'Stripe PaymentIntent creation failed');
  }
  return { id: data.id, client_secret: data.client_secret, status: data.status };
}

async function stripeRetrieveIntent(intentId) {
  const key = stripeSecret();
  if (!key) return null;
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intentId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  if (!data || !data.id) return null;
  return { id: data.id, status: data.status };
}

/**
 * Initiate a payment with the given provider.
 * Returns a Treba reference plus a provider-specific next action. Never returns
 * or stores sensitive credentials.
 */
export async function initiatePayment(admin, provider, ctx) {
  const category = provider.category;
  const reference = generateReference('TRB');

  if (category === 'cash_to_driver') {
    return { reference, next_action: 'cash_pending', category: 'cash', provider_intent_id: null, client_secret: null };
  }

  const cfg = provider.configuration || {};
  if (category === 'bank_card' && cfg.uses_stripe) {
    try {
      const intent = await stripeCreateIntent(
        Math.round(Number(ctx.amount) * 100),
        ctx.currency,
        reference,
        ctx.description
      );
      if (intent) {
        return {
          reference,
          next_action: 'stripe_payment_intent',
          category: 'digital',
          provider_intent_id: intent.id,
          client_secret: intent.client_secret,
        };
      }
    } catch (e) {
      throw new Error('Card payment initiation failed: ' + (e.message || 'provider error'));
    }
  }

  // Generic digital provider (mobile wallet, Pay2Cell, other, or bank card
  // without Stripe configured): a reference is generated and the provider is
  // expected to confirm via its callback (represented by confirmPayment).
  return {
    reference,
    next_action: 'provider_confirm',
    category: 'digital',
    provider_intent_id: null,
    client_secret: null,
  };
}

/**
 * Confirm a payment with the provider. Returns { status } where status is one
 * of 'successful' | 'failed' | 'pending'. For real providers this is driven by
 * the provider's webhook; the outcome argument represents that callback.
 */
export async function confirmPayment(admin, provider, payment, outcome, payload) {
  const category = provider && provider.category;
  if (category === 'cash_to_driver') {
    return { status: 'pending' };
  }
  const cfg = (provider && provider.configuration) || {};
  if (category === 'bank_card' && cfg.uses_stripe && payment.provider_intent_id) {
    const intent = await stripeRetrieveIntent(payment.provider_intent_id).catch(() => null);
    if (intent) {
      if (intent.status === 'succeeded') return { status: 'successful' };
      if (['requires_payment_method', 'canceled', 'failed'].includes(intent.status)) {
        return { status: 'failed', reason: (payload && payload.reason) || 'Card payment was not completed' };
      }
      return { status: 'pending' };
    }
  }
  if (outcome === 'success') return { status: 'successful' };
  if (outcome === 'failed') return { status: 'failed', reason: (payload && payload.reason) || 'Payment failed' };
  return { status: 'pending' };
}