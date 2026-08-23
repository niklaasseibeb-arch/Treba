import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Driver No-Show — a passenger records a contact attempt (call or message) to
 * the driver of a confirmed paid booking while waiting at the pickup point.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id, attempt_type, outcome, note } = body || {};
    if (!trip_request_id || !attempt_type) {
      return Response.json({ error: 'trip_request_id and attempt_type are required' }, { status: 400 });
    }
    if (!['call', 'message'].includes(attempt_type)) {
      return Response.json({ error: 'Invalid attempt type' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });
    if (trip.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the passenger can log contact attempts to the driver' }, { status: 403 });
    }

    const attempt = await admin.entities.PassengerContactAttempt.create({
      driver_no_show_report_id: null,
      booking_id: trip.booking_id || null,
      trip_request_id,
      passenger_id: user.id,
      driver_user_id: trip.matched_driver_user_id || null,
      attempt_type,
      attempted_at: new Date().toISOString(),
      outcome: ['no_answer', 'reached', 'failed'].includes(outcome) ? outcome : 'no_answer',
      note: note || null,
    });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'passenger_contact_attempt_logged',
        entity_type: 'PassengerContactAttempt',
        record_id: attempt.id,
        metadata: { trip_request_id, attempt_type, outcome: attempt.outcome },
      });
    } catch (e) {}

    return Response.json({ attempt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}