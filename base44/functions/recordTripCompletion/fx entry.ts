import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { releaseEarningForBooking } from '../../shared/payoutEngine.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Driver Wallet & Payout Engine — mark a paid booking's trip as completed and
 * release the driver's pending earning to available for payout. Every
 * completed paid trip produces a released driver earning record.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { booking_id } = body || {};
    if (!booking_id) return Response.json({ error: 'booking_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const booking = await admin.entities.Booking.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.payment_status !== 'paid') return Response.json({ error: 'Booking is not paid' }, { status: 400 });
    if (booking.booking_status === 'completed') return Response.json({ error: 'Trip already completed' }, { status: 400 });

    // Authorise: the allocated driver or an admin.
    let trip = null;
    if (booking.trip_request_id) { try { trip = await admin.entities.TripRequest.get(booking.trip_request_id); } catch (e) {} }
    if (trip && trip.matched_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver or an admin can complete this trip' }, { status: 403 });
    }

    await admin.entities.Booking.update(booking_id, { booking_status: 'completed' });
    await releaseEarningForBooking(admin, booking_id);

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'trip_completed_earning_released',
        entity_type: 'Booking',
        record_id: booking_id,
        metadata: { booking_id },
      });
    } catch (e) {}

    try {
      await sendNotification(admin, { user_id: booking.passenger_id, event_type: NOTIFICATION_EVENTS.TRIP_COMPLETED, title: 'Trip completed', message: 'Your trip has been marked complete. Rate your driver to help keep Treba reliable.', related_id: booking_id });
      if (trip && trip.matched_driver_user_id) {
        await sendNotification(admin, { user_id: trip.matched_driver_user_id, event_type: NOTIFICATION_EVENTS.EARNINGS_AVAILABLE, title: 'Earnings available', message: 'A completed trip earning has been released and is now available for payout.', related_id: booking_id });
      }
    } catch (e) {}

    return Response.json({ status: 'completed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}