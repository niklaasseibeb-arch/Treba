/**
 * Treba Booking Confirmation & Seat Priority.
 *
 * A booking is created only after: passenger request -> driver response ->
 * fare negotiation -> fare agreement -> payment condition satisfied.
 *
 * Payment states: PAID, CASH_PENDING, CASH_OVERDUE, FAILED, REFUNDED
 * (plus "pending" for a digital booking awaiting payment).
 *
 * Seat priority:
 *   HIGH    - paid digital booking, or cash booking with cash confirmed
 *   MEDIUM  - cash-pending booking within its payment deadline
 *   LOW     - cash-overdue booking
 *   RELEASED - payment deadline expired / seat released
 *
 * Paid and confirmed bookings always retain their seat. Cash-pending bookings
 * are temporary holds. If a higher-priority paid booking needs the same
 * capacity and a cash-pending hold has exceeded its deadline, Treba may
 * release the cash-pending seat. A valid paid booking is never silently
 * removed.
 */
import { isCashOverdue } from './cashRules.ts';

export const PRIORITY_HIGH = 'high';
export const PRIORITY_MEDIUM = 'medium';
export const PRIORITY_LOW = 'low';
export const PRIORITY_RELEASED = 'released';

export function computePaymentState(b) {
  if (!b) return 'pending';
  if (b.payment_status === 'refunded') return 'refunded';
  if (b.cash_status === 'cash_no_show') return 'failed';
  if (b.payment_status === 'failed') return 'failed';
  if (b.cash_status === 'cash_overdue') return 'cash_overdue';
  if (b.payment_status === 'paid' || b.cash_status === 'cash_paid') return 'paid';
  if (b.cash_status === 'cash_pending') return 'cash_pending';
  return 'pending';
}

export function computePriority(b) {
  if (!b) return PRIORITY_LOW;
  const state = computePaymentState(b);
  if (b.booking_status === 'cancelled' && (b.cash_status === 'cash_no_show' || b.was_no_show)) return PRIORITY_RELEASED;
  if (state === 'paid') return PRIORITY_HIGH;
  if (state === 'cash_pending') return isCashOverdue(b) ? PRIORITY_LOW : PRIORITY_MEDIUM;
  if (state === 'cash_overdue') return PRIORITY_LOW;
  if (state === 'failed' || state === 'refunded') return PRIORITY_RELEASED;
  if (state === 'pending') return PRIORITY_MEDIUM;
  return PRIORITY_LOW;
}

export function priorityLabel(p) {
  return ({ high: 'High', medium: 'Medium', low: 'Low', released: 'Released' }[p]) || p;
}

export function paymentStateLabel(s) {
  return ({
    paid: 'Paid',
    cash_pending: 'Cash pending',
    cash_overdue: 'Cash overdue',
    failed: 'Failed',
    refunded: 'Refunded',
    pending: 'Awaiting payment',
  }[s]) || s;
}

/**
 * Ensure a paid (HIGH priority) booking retains its seat. If the scheduled
 * service is over capacity because of lower-priority cash-pending holds,
 * release the lowest-priority overdue cash-pending bookings — never paid
 * bookings — until the paid booking fits. Returns the released booking ids.
 */
export async function releaseOverdueCashHoldsForPaidBooking(admin, paidBooking, auditUserId) {
  if (!paidBooking || !paidBooking.trip_id) return { released: [] };
  let total = 0;
  try {
    const alloc = await admin.entities.Allocation.get(paidBooking.trip_id);
    total = (alloc && Number(alloc.total_seats)) || 0;
  } catch (e) {}
  if (!total) return { released: [] };

  const all = await admin.entities.Booking.filter({ trip_id: paidBooking.trip_id }, '-created_date', 200).catch(() => []);
  const active = (all || []).filter((b) => b.booking_status !== 'cancelled' && b.booking_status !== 'completed');
  let occupied = active.reduce((s, b) => s + (Number(b.number_of_seats) || 0), 0);

  const released = [];
  if (occupied <= total) return { released };

  const candidates = active
    .filter((b) => {
      const pr = computePriority(b);
      return (pr === PRIORITY_LOW || pr === PRIORITY_MEDIUM) && b.id !== paidBooking.id;
    })
    .sort((a, b) => {
      const order = { [PRIORITY_LOW]: 0, [PRIORITY_MEDIUM]: 1 };
      return (order[computePriority(a)] ?? 9) - (order[computePriority(b)] ?? 9);
    });

  for (const c of candidates) {
    if (occupied <= total) break;
    const seats = Number(c.number_of_seats) || 0;
    try {
      await admin.entities.Booking.update(c.id, {
        booking_status: 'cancelled',
        cash_status: 'cash_no_show',
        was_no_show: true,
        payment_state: 'failed',
        priority: PRIORITY_RELEASED,
      });
    } catch (e) {}
    occupied -= seats;
    released.push(c.id);
    try {
      await admin.entities.AuditLog.create({
        user_id: auditUserId || null,
        user_role: 'system',
        action: 'seat_released_for_paid_booking',
        entity_type: 'Booking',
        record_id: c.id,
        metadata: { paid_booking_id: paidBooking.id, trip_id: paidBooking.trip_id, seats_released: seats },
      });
    } catch (e) {}
    try {
      await admin.entities.Notification.create({
        user_id: c.passenger_id,
        notification_type: 'seat_released',
        title: 'Seat released',
        message: 'Your cash-pending seat was released for a higher-priority paid booking.',
        related_id: c.trip_request_id || null,
        is_read: false,
      });
    } catch (e) {}
  }
  return { released };
}