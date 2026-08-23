/**
 * Treba Driver Wallet & Payout Engine.
 *
 * The driver wallet is SEPARATE from passenger payment:
 *   - Passenger payment records: Passenger → Treba / payment provider
 *   - Driver payout records:    Treba / payout provider → Driver registered payout method
 *
 * The fee model is configurable via the PayoutFeeConfig entity (admin-managed).
 * It is never hard-coded. This module is the single source of truth for earning
 * computation, earning creation, payout processing and cash settlement.
 *
 * Payout provider integrations are abstracted — no specific wallet provider
 * API is assumed. Secure, non-sensitive payout references are generated here
 * and stored on PayoutTransaction. We NEVER store wallet PINs, passwords or OTPs.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export async function getActiveFeeConfig(admin) {
  try {
    const configs = await admin.entities.PayoutFeeConfig.list('-created_date', 50);
    return (configs || []).find((c) => c.is_active) || (configs || [])[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Compute the Treba fee and driver net earnings for a fare. The fee model comes
 * from the active PayoutFeeConfig: a percentage (digital vs cash may differ) +
 * an optional fixed per-trip fee, floored by a minimum fee, capped at the fare.
 */
export function computeEarning(fare, paymentCategory, config) {
  const f = Math.max(0, Number(fare) || 0);
  const cfg = config || {};
  const isCash = paymentCategory === 'cash' || paymentCategory === 'cash_to_driver';
  const pct = Number(isCash ? (cfg.cash_booking_fee_percentage ?? cfg.commission_percentage) : cfg.commission_percentage) || 0;
  const fixed = Number(cfg.fixed_fee_per_trip) || 0;
  const minFee = Number(cfg.min_fee) || 0;
  let fee = (f * pct) / 100 + fixed;
  if (fee < minFee) fee = minFee;
  if (fee > f) fee = f;
  fee = round2(fee);
  const net = round2(f - fee);
  return { amount: round2(f), fee_amount: fee, net_amount: net };
}

export async function getDriverWalletByUser(admin, driverUserId) {
  const wallets = await admin.entities.DriverWallet.filter({ created_by_id: driverUserId }, '-created_date', 10).catch(() => []);
  return (wallets || [])[0] || null;
}

function secureRef(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a pending driver earning record for a paid digital booking. Called
 * when a digital payment is confirmed. The earning is released to available
 * when the trip is completed (releaseEarningForBooking).
 */
export async function createPendingEarning(admin, trip, booking, payment) {
  const fare = Number(booking?.fare_amount ?? payment?.agreed_fare ?? payment?.amount ?? 0);
  if (!fare || fare <= 0) return null;
  if (!trip?.matched_driver_user_id) return null;
  const category = payment?.payment_category || (payment?.payment_method === 'cash_to_driver' ? 'cash' : 'digital');
  const config = await getActiveFeeConfig(admin);
  const { amount, fee_amount, net_amount } = computeEarning(fare, category, config);
  const wallet = await getDriverWalletByUser(admin, trip.matched_driver_user_id);
  if (!wallet) return null;

  const earning = await admin.entities.PayoutTransaction.create({
    driver_id: wallet.driver_id || null,
    driver_user_id: trip.matched_driver_user_id,
    wallet_id: wallet.id,
    amount,
    fee_amount,
    net_amount,
    status: 'earnings_pending',
    related_booking_id: booking?.id || null,
    description: 'Trip earning (pending trip completion)',
    transaction_reference: secureRef('ern'),
  });

  await admin.entities.DriverWallet.update(wallet.id, {
    pending_earnings: round2((wallet.pending_earnings || 0) + net_amount),
    treba_fees_total: round2((wallet.treba_fees_total || 0) + fee_amount),
    current_balance: round2((wallet.current_balance || 0) + net_amount),
  });
  return earning;
}

/**
 * Release a pending earning to available for payout when the trip completes.
 */
export async function releaseEarningForBooking(admin, bookingId) {
  const earnings = await admin.entities.PayoutTransaction.filter({ related_booking_id: bookingId, status: 'earnings_pending' }, '-created_date', 10).catch(() => []);
  for (const e of (earnings || [])) {
    await admin.entities.PayoutTransaction.update(e.id, {
      status: 'available_for_payout',
      description: 'Trip earning (available for payout)',
    });
    const wallet = await admin.entities.DriverWallet.get(e.wallet_id).catch(() => null);
    if (wallet) {
      await admin.entities.DriverWallet.update(wallet.id, {
        pending_earnings: round2((wallet.pending_earnings || 0) - e.net_amount),
        available_earnings: round2((wallet.available_earnings || 0) + e.net_amount),
      });
    }
  }
}

/**
 * Process a driver payout request from available earnings. Creates a payout
 * record in payout_processing with a secure reference. The provider adapter is
 * abstracted (see payoutGateway); no specific provider API is assumed.
 */
export async function processPayout(admin, driverUserId, amount) {
  const amt = round2(amount);
  const wallet = await getDriverWalletByUser(admin, driverUserId);
  if (!wallet) throw new Error('No wallet found');
  if (wallet.verification_status !== 'verified') throw new Error('Payout method not verified');
  if (amt <= 0) throw new Error('Invalid payout amount');
  if (amt > (wallet.available_earnings || 0)) throw new Error('Amount exceeds available earnings');

  const payout = await admin.entities.PayoutTransaction.create({
    driver_id: wallet.driver_id || null,
    driver_user_id: driverUserId,
    wallet_id: wallet.id,
    amount: amt,
    fee_amount: 0,
    net_amount: amt,
    status: 'payout_processing',
    provider_reference: wallet.provider_reference || null,
    transaction_reference: secureRef('po'),
    description: 'Payout request',
  });

  await admin.entities.DriverWallet.update(wallet.id, {
    available_earnings: round2((wallet.available_earnings || 0) - amt),
    pending_payout_total: round2((wallet.pending_payout_total || 0) + amt),
    current_balance: round2((wallet.current_balance || 0) - amt),
  });
  return payout;
}

/**
 * Settle a processing payout as paid, failed, or reversed. Failed/reversed
 * payouts return the funds to available earnings.
 */
export async function settlePayoutStatus(admin, payoutId, status) {
  if (!['paid', 'failed', 'reversed'].includes(status)) throw new Error('Invalid status');
  const payout = await admin.entities.PayoutTransaction.get(payoutId);
  if (!payout) throw new Error('Payout not found');
  if (payout.status !== 'payout_processing') throw new Error('Only processing payouts can be settled');
  const wallet = await admin.entities.DriverWallet.get(payout.wallet_id).catch(() => null);
  const amt = round2(payout.amount);
  await admin.entities.PayoutTransaction.update(payoutId, { status });
  if (!wallet) return { status };

  if (status === 'paid') {
    await admin.entities.DriverWallet.update(wallet.id, {
      pending_payout_total: round2((wallet.pending_payout_total || 0) - amt),
      completed_payouts_total: round2((wallet.completed_payouts_total || 0) + amt),
      paid_earnings_total: round2((wallet.paid_earnings_total || 0) + payout.net_amount),
    });
  } else {
    const patch = {
      pending_payout_total: round2((wallet.pending_payout_total || 0) - amt),
      available_earnings: round2((wallet.available_earnings || 0) + amt),
      current_balance: round2((wallet.current_balance || 0) + amt),
    };
    if (status === 'failed') patch.failed_payout_total = round2((wallet.failed_payout_total || 0) + amt);
    if (status === 'reversed') patch.reversed_payout_total = round2((wallet.reversed_payout_total || 0) + amt);
    await admin.entities.DriverWallet.update(wallet.id, patch);
  }
  return { status };
}

/**
 * Settle a cash booking. The driver receives cash directly from the passenger;
 * Treba records the cash transaction and applies the configured Treba fee. The
 * earning is recorded as paid (cash already in the driver's hands). The Treba
 * fee is recorded as the settlement amount the driver owes Treba.
 */
export async function settleCashBooking(admin, trip, booking, payment) {
  const fare = Number(booking?.fare_amount ?? payment?.agreed_fare ?? payment?.amount ?? 0);
  if (!fare || fare <= 0) return null;
  if (!trip?.matched_driver_user_id) return null;
  const config = await getActiveFeeConfig(admin);
  const { amount, fee_amount, net_amount } = computeEarning(fare, 'cash', config);
  const wallet = await getDriverWalletByUser(admin, trip.matched_driver_user_id);
  if (!wallet) return null;

  const earning = await admin.entities.PayoutTransaction.create({
    driver_id: wallet.driver_id || null,
    driver_user_id: trip.matched_driver_user_id,
    wallet_id: wallet.id,
    amount,
    fee_amount,
    net_amount,
    status: 'paid',
    related_booking_id: booking?.id || null,
    description: 'Cash booking — driver received cash directly; Treba fee applied',
    transaction_reference: secureRef('cash'),
  });

  await admin.entities.DriverWallet.update(wallet.id, {
    paid_earnings_total: round2((wallet.paid_earnings_total || 0) + net_amount),
    completed_payouts_total: round2((wallet.completed_payouts_total || 0) + net_amount),
    treba_fees_total: round2((wallet.treba_fees_total || 0) + fee_amount),
  });
  return earning;
}