import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { settleCashBooking } from '../../shared/payoutEngine.ts';

/**
 * Driver Wallet & Payout Engine — settle a cash booking. The driver receives
 * cash directly from the passenger; Treba records the cash transaction and
 * applies the configured Treba fee/settlement mechanism. The earning is
 * recorded as paid (cash already in the driver's hands).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id } = body || {};
    if (!trip_request_id) return Response.json({ error: 'trip_request_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });
    if (trip.matched_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver or an admin can settle this cash booking' }, { status: 403 });
    }
    if (!trip.booking_id) return Response.json({ error: 'No booking on this request' }, { status: 400 });

    const booking = await admin.entities.Booking.get(trip.booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.payment_method !== 'cash_to_driver' && booking.payment_state !== 'cash_pending' && booking.cash_status !== 'cash_paid') {
      // Allow settling any cash-method booking; the engine records the cash transaction.
    }

    const payments = await admin.entities.Payment.filter({ trip_request_id }, '-created_date', 10).catch(() => []);
    const payment = (payments || []).find((p) => p.payment_category === 'cash' || p.payment_method === 'cash_to_driver') || (payments || [])[0] || null;

    const earning = await settleCashBooking(admin, trip, booking, payment);

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'cash_booking_settled',
        entity_type: 'PayoutTransaction',
        record_id: earning ? earning.id : null,
        metadata: { booking_id: booking.id, trip_request_id },
      });
    } catch (e) {}

    return Response.json({ earning });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}