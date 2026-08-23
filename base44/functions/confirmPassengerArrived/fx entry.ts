import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logEvent } from '../../shared/tripOperations.ts';

/**
 * No-Show Management — the driver confirms the passenger arrived. This clears
 * any pending no-show concern for a confirmed booking; the booking stays
 * confirmed and the passenger is not penalised.
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
      return Response.json({ error: 'Only the allocated driver can confirm arrival' }, { status: 403 });
    }
    if (!trip.booking_id) return Response.json({ error: 'No booking on this request' }, { status: 400 });

    await admin.entities.Booking.update(trip.booking_id, {
      passenger_arrived: true,
      no_show_status: 'arrived',
    });

    // Trip Operations — log the passenger check-in event.
    try {
      const booking = await admin.entities.Booking.get(trip.booking_id);
      await logEvent(admin, { allocationId: booking && booking.trip_id, driverUserId: user.id, eventType: 'passenger_check_in', bookingId: trip.booking_id, passengerId: trip.passenger_id, userId: user.id, note: 'Passenger arrived' });
    } catch (e) {}

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'passenger_arrived_confirmed',
        entity_type: 'Booking',
        record_id: trip.booking_id,
        metadata: { trip_request_id },
      });
    } catch (e) {}

    try {
      await admin.entities.Notification.create({
        user_id: trip.passenger_id,
        notification_type: 'passenger_arrived',
        title: 'Arrival confirmed',
        message: 'Your driver confirmed you arrived. Have a safe trip.',
        related_id: trip_request_id,
        is_read: false,
      });
    } catch (e) {}

    return Response.json({ status: 'arrived' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}