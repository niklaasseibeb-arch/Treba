import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { combineDeparture } from '../../shared/cashRules.ts';
import { logEvent } from '../../shared/tripOperations.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Driver No-Show — a passenger reports that the driver did not provide the
 * scheduled trip. The passenger must:
 *   - have a confirmed, PAID booking,
 *   - confirm they are at the designated pickup point,
 *   - wait the configured grace period after scheduled departure,
 *   - attempt to contact the driver (at least one logged attempt).
 *
 * Creates a DriverNoShowReport recording passenger, driver, booking, route,
 * pickup, date/time, contact attempts and evidence. Notifies Treba
 * administration (audit + driver notification). The financial outcome is NOT
 * applied automatically — it is determined later by an admin under the
 * configured passenger protection policy.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id, passenger_at_pickup, grace_elapsed, contact_attempted, evidence_notes, evidence_file_url } = body || {};
    if (!trip_request_id) return Response.json({ error: 'trip_request_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });
    if (trip.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the passenger can report a driver no-show' }, { status: 403 });
    }
    if (!trip.booking_id) return Response.json({ error: 'No booking on this request' }, { status: 400 });

    const booking = await admin.entities.Booking.get(trip.booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.booking_status !== 'confirmed' || booking.payment_status !== 'paid') {
      return Response.json({ error: 'A driver no-show can only be reported for a paid, confirmed booking' }, { status: 400 });
    }
    if (['driver_no_show', 'under_review', 'upheld', 'overturned'].includes(booking.driver_no_show_status)) {
      return Response.json({ error: 'A driver no-show has already been reported for this booking' }, { status: 400 });
    }

    if (!passenger_at_pickup) return Response.json({ error: 'Confirm you are at the designated pickup point' }, { status: 400 });
    if (!grace_elapsed) return Response.json({ error: 'Confirm the waiting period has elapsed' }, { status: 400 });
    if (!contact_attempted) return Response.json({ error: 'Confirm you attempted to contact the driver' }, { status: 400 });

    // Active policy -> grace minutes
    let graceMinutes = 15;
    let policy = null;
    try {
      const policies = await admin.entities.DriverNoShowPolicy.list('-created_date', 50);
      policy = (policies || []).find((p) => p.is_active) || null;
      if (policy && Number(policy.grace_minutes) >= 0) graceMinutes = Number(policy.grace_minutes);
    } catch (e) {}

    // Scheduled departure from the allocation (booking.trip_id is the allocation id).
    let departure = null;
    let allocation = null;
    try {
      allocation = await admin.entities.Allocation.get(booking.trip_id);
      departure = combineDeparture(allocation && allocation.date, allocation && allocation.departure_time);
    } catch (e) {}
    if (!departure) departure = combineDeparture(trip.requested_date, trip.requested_time);

    const now = new Date();
    if (departure && now.getTime() < departure.getTime() + graceMinutes * 60000) {
      return Response.json({ error: `The ${graceMinutes}-minute waiting period has not elapsed yet` }, { status: 400 });
    }

    // Require at least one logged contact attempt.
    const attempts = await admin.entities.PassengerContactAttempt.filter({ booking_id: booking.id }, '-attempted_at', 50).catch(() => []);
    if (!attempts || attempts.length === 0) {
      return Response.json({ error: 'Record at least one contact attempt before reporting a driver no-show' }, { status: 400 });
    }

    // Driver name for the record.
    let driverName = trip.matched_driver_name || null;
    try {
      const profiles = await admin.entities.DriverProfile.list('-created_date', 500);
      const dp = profiles.find((p) => p.user_id === trip.matched_driver_user_id);
      if (dp) driverName = driverName || dp.full_name;
    } catch (e) {}

    const report = await admin.entities.DriverNoShowReport.create({
      booking_id: booking.id,
      trip_request_id,
      passenger_id: user.id,
      passenger_name: trip.passenger_name || booking.passenger_name || null,
      driver_id: trip.matched_driver_id || null,
      driver_user_id: trip.matched_driver_user_id || null,
      driver_name: driverName,
      allocation_id: booking.trip_id || null,
      route: `${trip.origin || booking.origin || ''} → ${trip.destination || booking.destination || ''}`,
      pickup_location: trip.pickup_location || booking.pickup_location || null,
      scheduled_departure: departure ? departure.toISOString() : null,
      grace_minutes: graceMinutes,
      reported_at: now.toISOString(),
      passenger_at_pickup: true,
      grace_elapsed: true,
      contact_attempted: true,
      contact_attempts_count: attempts.length,
      evidence_notes: evidence_notes || null,
      evidence_file_url: evidence_file_url || null,
      no_show_status: 'reported',
      review_decision: 'pending',
    });

    await admin.entities.Booking.update(booking.id, {
      driver_no_show_status: 'driver_no_show',
      driver_no_show_report_id: report.id,
    });

    // Link attempts to the report.
    try {
      for (const a of attempts) {
        await admin.entities.PassengerContactAttempt.update(a.id, { driver_no_show_report_id: report.id });
      }
    } catch (e) {}

    // Notify Treba administration (audit) + the driver.
    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'driver_no_show_reported',
        entity_type: 'DriverNoShowReport',
        record_id: report.id,
        metadata: { booking_id: booking.id, trip_request_id, grace_minutes: graceMinutes, contact_attempts: attempts.length },
      });
    } catch (e) {}

    // Trip Operations — log the driver no-show event.
    try {
      await logEvent(admin, { allocationId: booking.trip_id, driverUserId: trip.matched_driver_user_id, eventType: 'driver_no_show', bookingId: booking.id, passengerId: user.id, userId: user.id, note: 'Driver no-show reported' });
    } catch (e) {}

    try {
      await sendNotification(admin, { user_id: user.id, event_type: NOTIFICATION_EVENTS.NO_SHOW_RECORDED, title: 'Driver no-show recorded', message: 'Your driver no-show report was recorded and is under admin review.', related_id: trip_request_id });
      if (trip.matched_driver_user_id) {
        await sendNotification(admin, { user_id: trip.matched_driver_user_id, event_type: NOTIFICATION_EVENTS.DISPUTE_UPDATE, title: 'No-show reported against you', message: 'A passenger reported that you did not provide the scheduled trip. This is under admin review.', related_id: trip_request_id });
      }
    } catch (e) {}

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}