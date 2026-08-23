import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Direct Passenger-to-Driver Payment — the driver optionally confirms that the
 * passenger paid the agreed fare directly to them.
 *
 * This is an OPERATIONAL RECORD ONLY. Treba does NOT collect, process, hold,
 * transfer or refund the fare, and does NOT charge commission. This function
 * only marks `fare_received` on the booking so Treba has a record that the
 * direct payment took place between passenger and driver.
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

    // Authorise: the allocated driver for this booking, or an admin.
    let trip = null;
    if (booking.trip_request_id) {
      try { trip = await admin.entities.TripRequest.get(booking.trip_request_id); } catch (e) {}
    }
    if (trip && trip.matched_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver can confirm fare received' }, { status: 403 });
    }
    if (booking.fare_received) {
      return Response.json({ error: 'Fare already marked as received' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await admin.entities.Booking.update(booking_id, {
      fare_received: true,
      fare_received_at: now,
    });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'fare_received_confirmed',
        entity_type: 'Booking',
        record_id: booking_id,
        metadata: { booking_id, fare_amount: booking.fare_amount || null },
      });
    } catch (e) {}

    try {
      if (booking.passenger_id) {
        await sendNotification(admin, {
          user_id: booking.passenger_id,
          event_type: NOTIFICATION_EVENTS.BOOKING_CONFIRMED,
          title: 'Fare received',
          message: 'Your driver confirmed they received your fare. Thank you for travelling with Treba.',
          related_id: booking_id,
        });
      }
    } catch (e) {}

    return Response.json({ status: 'received', fare_received: true, fare_received_at: now });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}