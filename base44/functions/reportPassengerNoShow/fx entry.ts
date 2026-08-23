import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { combineDeparture } from '../../shared/cashRules.ts';
import { logEvent } from '../../shared/tripOperations.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * No-Show Management — a paid/confirmed passenger who does not arrive is NOT
 * the same as a cash-pending passenger.
 *
 * The driver may report a no-show only after:
 *   - waiting the configured grace period after scheduled departure,
 *   - attempting to contact the passenger (at least one logged attempt),
 *   - confirming they are at the designated pickup point.
 *
 * This creates a NoShowReport and sets the booking to PASSENGER_NO_SHOW. The
 * booking remains financially subject to the configured no-show policy. Treba
 * does NOT automatically refund the passenger.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id, driver_at_pickup, grace_elapsed, contact_attempted, driver_location } = body || {};
    if (!trip_request_id) return Response.json({ error: 'trip_request_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });
    if (trip.matched_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver can report a no-show' }, { status: 403 });
    }
    if (!trip.booking_id) return Response.json({ error: 'No booking on this request' }, { status: 400 });

    const booking = await admin.entities.Booking.get(trip.booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.booking_status !== 'confirmed' || booking.payment_status !== 'paid') {
      return Response.json({ error: 'No-show can only be reported for a paid, confirmed booking' }, { status: 400 });
    }
    if (booking.passenger_arrived) {
      return Response.json({ error: 'Passenger was already marked as arrived' }, { status: 400 });
    }
    if (booking.no_show_status === 'passenger_no_show' || booking.no_show_status === 'disputed') {
      return Response.json({ error: 'A no-show has already been reported for this booking' }, { status: 400 });
    }

    // Confirmation checklist
    if (!driver_at_pickup) return Response.json({ error: 'Confirm you are at the designated pickup point' }, { status: 400 });
    if (!grace_elapsed) return Response.json({ error: 'Confirm the grace period has elapsed' }, { status: 400 });
    if (!contact_attempted) return Response.json({ error: 'Confirm you attempted to contact the passenger' }, { status: 400 });

    // Active policy -> grace minutes
    let graceMinutes = 10;
    let policy = null;
    try {
      const policies = await admin.entities.NoShowPolicy.list('-created_date', 50);
      policy = (policies || []).find((p) => p.is_active) || null;
      if (policy && Number(policy.grace_minutes) >= 0) graceMinutes = Number(policy.grace_minutes);
    } catch (e) {}

    // Compute scheduled departure from the allocation (scheduled service).
    let departure = null;
    try {
      const alloc = await admin.entities.Allocation.get(booking.trip_id);
      departure = combineDeparture(alloc && alloc.date, alloc && alloc.departure_time);
    } catch (e) {}
    if (!departure) departure = combineDeparture(trip.requested_date, trip.requested_time);

    const now = new Date();
    if (departure && now.getTime() < departure.getTime() + graceMinutes * 60000) {
      return Response.json({ error: `Grace period of ${graceMinutes} minutes has not elapsed yet` }, { status: 400 });
    }

    // Require at least one logged contact attempt.
    const attempts = await admin.entities.ContactAttempt.filter({ booking_id: booking.id }, '-attempted_at', 50).catch(() => []);
    if (!attempts || attempts.length === 0) {
      return Response.json({ error: 'Record at least one contact attempt before reporting a no-show' }, { status: 400 });
    }

    const report = await admin.entities.NoShowReport.create({
      booking_id: booking.id,
      trip_request_id,
      passenger_id: trip.passenger_id,
      passenger_name: trip.passenger_name || booking.passenger_name || null,
      driver_id: trip.matched_driver_id || null,
      driver_user_id: user.id,
      allocation_id: booking.trip_id || null,
      route: `${trip.origin || booking.origin || ''} → ${trip.destination || booking.destination || ''}`,
      scheduled_departure: departure ? departure.toISOString() : null,
      grace_minutes: graceMinutes,
      reported_at: now.toISOString(),
      driver_location: driver_location || null,
      driver_at_pickup: true,
      grace_elapsed: true,
      contact_attempted: true,
      contact_attempts_count: attempts.length,
      no_show_status: 'reported',
      review_decision: 'pending',
    });

    await admin.entities.Booking.update(booking.id, {
      no_show_status: 'passenger_no_show',
      was_no_show: true,
      no_show_report_id: report.id,
    });

    // Link attempts to the report.
    try {
      for (const a of attempts) {
        await admin.entities.ContactAttempt.update(a.id, { no_show_report_id: report.id });
      }
    } catch (e) {}

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'passenger_no_show_reported',
        entity_type: 'NoShowReport',
        record_id: report.id,
        metadata: { booking_id: booking.id, trip_request_id, grace_minutes: graceMinutes, contact_attempts: attempts.length },
      });
    } catch (e) {}

    // Trip Operations — log the passenger no-show event.
    try {
      await logEvent(admin, { allocationId: booking.trip_id, driverUserId: user.id, eventType: 'passenger_no_show', bookingId: booking.id, passengerId: trip.passenger_id, userId: user.id, note: 'Passenger no-show reported' });
    } catch (e) {}

    try {
      await sendNotification(admin, { user_id: trip.passenger_id, event_type: NOTIFICATION_EVENTS.NO_SHOW_RECORDED, title: 'No-show recorded', message: 'Your driver reported you as a no-show. If this is incorrect, you can dispute it from your requests.', related_id: trip_request_id });
      if (trip.matched_driver_user_id) {
        await sendNotification(admin, { user_id: trip.matched_driver_user_id, event_type: NOTIFICATION_EVENTS.PASSENGER_NO_SHOW, title: 'Passenger no-show', message: 'Your no-show report was recorded. The case is pending review if disputed.', related_id: trip_request_id });
      }
    } catch (e) {}

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}