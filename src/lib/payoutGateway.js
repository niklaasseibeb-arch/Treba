/**
 * Treba payout gateway abstraction layer.
 *
 * This module exposes a STABLE interface for payout operations so that real
 * payment-provider integrations can be connected later WITHOUT changing the
 * calling code (registration, wallet UI, admin tools).
 *
 * Today every method is SIMULATED — it never touches a real provider and never
 * stores sensitive credentials. Per Treba policy we NEVER store: wallet PIN,
 * banking password, OTP, or payment-provider passwords. We only ever persist
 * a non-sensitive provider reference/token returned by the gateway.
 *
 * When a real provider is connected, replace the SIMULATED adapters below with
 * adapter functions that call the provider's API through a Base44 backend
 * function (using a stored secret API key on the server, never user secrets).
 * The function signatures here are the contract the rest of the app relies on.
 */

export const PAYOUT_METHOD_TYPES = ["bank_account", "mobile_wallet", "ewallet", "other"];

export const PAYOUT_TRANSACTION_STATUSES = [
  "earnings_pending",
  "available_for_payout",
  "payout_processing",
  "paid",
  "failed",
  "reversed",
];

/**
 * SIMULATED adapter registry. Key by provider name (lowercased) to override the
 * default adapter for a specific provider once a real integration is added.
 */
const PROVIDER_ADAPTERS = {
  default: {
    // Returns a non-sensitive provider reference. Never receives or stores PIN/password/OTP.
    async createPayoutMethodReference({ provider, account_number, account_holder_name }) {
      const ref = `ref_${(provider || "provider").toLowerCase()}_${Date.now()}`;
      return { provider_reference: ref, verification_status: "pending" };
    },
    async verifyPayoutMethod(/* providerReference */) {
      return { verification_status: "verified" };
    },
    async requestPayout({ amount, net_amount }) {
      return {
        status: "payout_processing",
        transaction_reference: `tx_${Date.now()}`,
      };
    },
  },
};

function adapterFor(/* provider */) {
  return PROVIDER_ADAPTERS.default;
}

/**
 * Register a new payout method with the gateway. Returns a non-sensitive
 * provider reference to store on the DriverWallet.
 */
export async function registerPayoutMethod(details) {
  const adapter = adapterFor(details.provider);
  return adapter.createPayoutMethodReference(details);
}

/**
 * Verify a previously registered payout method (e.g. via provider callback or
 * admin review). Returns the new verification status.
 */
export async function verifyPayoutMethod(providerReference, provider) {
  const adapter = adapterFor(provider);
  return adapter.verifyPayoutMethod(providerReference);
}

/**
 * Request a payout from the driver's available earnings. Returns the gateway
 * transaction reference and the initial processing status.
 */
export async function requestPayout({ provider, provider_reference, amount, net_amount }) {
  const adapter = adapterFor(provider);
  return adapter.requestPayout({ provider_reference, amount, net_amount });
}

/**
 * Compute the Treba fee and net amount for a payout. Centralised here so fee
 * rules can change in one place.
 */
export function computePayoutFee(amount, feeRatePercent = 0) {
  const fee = Math.round((amount * (feeRatePercent / 100)) * 100) / 100;
  return { fee_amount: fee, net_amount: Math.max(0, amount - fee) };
}