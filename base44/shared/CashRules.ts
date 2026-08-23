/**
 * Treba Cash Payment rules.
 *
 * Cash is a CONTROLLED payment option — it is not equivalent to a completed
 * digital payment. Cash is only allowed for standard pickup and drop-off
 * points, must be confirmed by the driver, and is subject to a configurable
 * check-in deadline before departure.
 */

export function isCashAllowedForTrip(trip) {
  return !!(trip && trip.pickup_is_standard && trip.dropoff_is_standard);
}

export function cashUnavailableMessage() {
  return 'Cash payment is only available when using Treba standard pickup and drop-off points.';
}

export function combineDeparture(date, time) {
  if (!date || !time) return null;
  try {
    const dt = new Date(`${date}T${String(time).padStart(5, '0')}:00`);
    return isNaN(dt.getTime()) ? null : dt;
  } catch (e) {
    return null;
  }
}

export function computeCashDeadline(departureDate, departureTime, minutesBefore) {
  const dep = combineDeparture(departureDate, departureTime);
  if (!dep) return null;
  const mins = Number(minutesBefore) || 0;
  return new Date(dep.getTime() - mins * 60000).toISOString();
}

export function isCashOverdue(bookingOrPayment, now = new Date()) {
  const deadline = bookingOrPayment && bookingOrPayment.cash_check_in_deadline;
  if (!deadline) return false;
  try {
    return new Date(deadline).getTime() < now.getTime();
  } catch (e) {
    return false;
  }
}

/**
 * Booking priority for seat allocation. A digital paid booking has higher
 * priority than a cash-pending booking. Lower score = higher priority.
 */
export function bookingPriorityScore(booking) {
  if (!booking) return 99;
  const cash =
    booking.payment_method === 'cash_to_driver' || booking.payment_category === 'cash';
  const paid =
    booking.payment_status === 'paid' ||
    booking.cash_status === 'cash_paid' ||
    booking.payment_status === 'successful';
  const overdue =
    booking.cash_status === 'cash_overdue' || booking.cash_status === 'cash_no_show';
  if (overdue) return 4;
  if (paid && !cash) return 0;
  if (paid && cash) return 1;
  if (!cash) return 2;
  return 3;
}

export async function writeAudit(admin, entry) {
  try {
    await admin.entities.AuditLog.create({
      user_id: entry.user_id || null,
      user_role: entry.user_role || null,
      action: entry.action,
      entity_type: entry.entity_type,
      record_id: entry.record_id || null,
      metadata: entry.metadata || {},
    });
  } catch (e) {
    // audit is best-effort
  }
}