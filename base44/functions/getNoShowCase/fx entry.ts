import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * No-Show Management — return a full no-show case (report, contact attempts,
 * booking, and the active policy) for review by the passenger, driver, or an
 * admin.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { no_show_report_id, trip_request_id } = body || {};
    if (!no_show_report_id && !trip_request_id) {
      return Response.json({ error: 'no_show_report_id or trip_request_id is required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    let report = null;
    if (no_show_report_id) {
      report = await admin.entities.NoShowReport.get(no_show_report_id);
    } else {
      const reports = await admin.entities.NoShowReport.filter({ trip_request_id }, '-reported_at', 10).catch(() => []);
      report = (reports || [])[0] || null;
    }
    if (!report) return Response.json({ error: 'No-show report not found' }, { status: 404 });

    const isPassenger = report.passenger_id === user.id;
    const isDriver = report.driver_user_id === user.id;
    if (!isPassenger && !isDriver && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let attempts = [];
    try { attempts = await admin.entities.ContactAttempt.filter({ no_show_report_id: report.id }, 'attempted_at', 100); } catch (e) {}
    let booking = null;
    if (report.booking_id) { try { booking = await admin.entities.Booking.get(report.booking_id); } catch (e) {} }

    let policy = null;
    try {
      const policies = await admin.entities.NoShowPolicy.list('-created_date', 50);
      policy = (policies || []).find((p) => p.is_active) || null;
    } catch (e) {}

    return Response.json({ report, attempts: attempts || [], booking, policy });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}