import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Driver No-Show — returns the full context for a driver no-show case:
 * the report (if any), passenger contact attempts, booking, the active
 * passenger protection policy, driver contact details, and the configured
 * grace minutes. Used by the passenger panel and the admin review page.
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
      report = await admin.entities.DriverNoShowReport.get(no_show_report_id);
    } else {
      const reports = await admin.entities.DriverNoShowReport.filter({ trip_request_id }, '-reported_at', 10).catch(() => []);
      report = (reports || [])[0] || null;
    }

    // Resolve the trip request to enrich context (driver phone, booking, etc.).
    const tripRequestId = report ? report.trip_request_id : trip_request_id;
    let trip = null;
    if (tripRequestId) { try { trip = await admin.entities.TripRequest.get(tripRequestId); } catch (e) {} }

    if (report) {
      const isPassenger = report.passenger_id === user.id;
      const isDriver = report.driver_user_id === user.id;
      if (!isPassenger && !isDriver && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (trip) {
      if (trip.passenger_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Driver contact details (service role — passengers cannot read DriverProfile directly).
    let driverName = (report && report.driver_name) || (trip && trip.matched_driver_name) || null;
    let driverPhone = null;
    if (trip && trip.matched_driver_user_id) {
      try {
        const profiles = await admin.entities.DriverProfile.list('-created_date', 500);
        const dp = profiles.find((p) => p.user_id === trip.matched_driver_user_id);
        if (dp) { driverName = driverName || dp.full_name; driverPhone = dp.phone || null; }
      } catch (e) {}
    }

    let attempts = [];
    const bookingId = (report && report.booking_id) || (trip && trip.booking_id) || null;
    if (bookingId) {
      try { attempts = await admin.entities.PassengerContactAttempt.filter({ booking_id }, 'attempted_at', 100); } catch (e) {}
    }

    let booking = null;
    if (bookingId) { try { booking = await admin.entities.Booking.get(bookingId); } catch (e) {} }

    let policy = null;
    let graceMinutes = 15;
    try {
      const policies = await admin.entities.DriverNoShowPolicy.list('-created_date', 50);
      policy = (policies || []).find((p) => p.is_active) || null;
      if (policy && Number(policy.grace_minutes) >= 0) graceMinutes = Number(policy.grace_minutes);
    } catch (e) {}

    return Response.json({
      report,
      attempts: attempts || [],
      booking,
      policy,
      grace_minutes: graceMinutes,
      driver_name: driverName,
      driver_phone: driverPhone,
      trip,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}