import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * No-Show Management — a passenger disputes a no-show report. Opens a dispute
 * case for admin review. Must be within the configured dispute window.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id, dispute_reason } = body || {};
    if (!trip_request_id) return Response.json({ error: 'trip_request_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });
    if (trip.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the passenger can dispute a no-show' }, { status: 403 });
    }

    const reports = await admin.entities.NoShowReport.filter({ trip_request_id }, '-reported_at', 10).catch(() => []);
    const report = (reports || [])[0];
    if (!report) return Response.json({ error: 'No no-show report found for this trip' }, { status: 404 });
    if (report.no_show_status !== 'reported') {
      return Response.json({ error: `This no-show is already ${report.no_show_status}` }, { status: 400 });
    }

    // Dispute window
    let windowHours = 48;
    try {
      const policies = await admin.entities.NoShowPolicy.list('-created_date', 50);
      const active = (policies || []).find((p) => p.is_active);
      if (active && Number(active.dispute_window_hours) > 0) windowHours = Number(active.dispute_window_hours);
    } catch (e) {}
    const reportedAt = new Date(report.reported_at);
    if (new Date().getTime() > reportedAt.getTime() + windowHours * 3600000) {
      return Response.json({ error: `The ${windowHours}-hour dispute window has closed` }, { status: 400 });
    }

    const now = new Date().toISOString();
    await admin.entities.NoShowReport.update(report.id, {
      no_show_status: 'disputed',
      dispute_reason: dispute_reason || null,
      disputed_at: now,
    });
    if (trip.booking_id) {
      try { await admin.entities.Booking.update(trip.booking_id, { no_show_status: 'disputed' }); } catch (e) {}
    }

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'no_show_disputed',
        entity_type: 'NoShowReport',
        record_id: report.id,
        metadata: { trip_request_id },
      });
    } catch (e) {}

    try {
      await sendNotification(admin, { user_id: trip.matched_driver_user_id, event_type: NOTIFICATION_EVENTS.DISPUTE_UPDATE, title: 'No-show disputed', message: 'The passenger disputed the no-show report. The case is now pending admin review.', related_id: trip_request_id });
    } catch (e) {}

    return Response.json({ status: 'disputed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}