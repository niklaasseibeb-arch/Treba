import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * No-Show Management — returns the driver's trip roster: confirmed bookings on
 * the driver's confirmed upcoming allocations, with passenger contact details,
 * no-show status, and contact-attempt history so the driver can manage arrivals
 * and no-shows.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = base44.asServiceRole;
    const profiles = await admin.entities.DriverProfile.list('-created_date', 500);
    const profile = profiles.find((p) => p.user_id === user.id);
    if (!profile) return Response.json({ entries: [], grace_minutes: 10 });

    const today = new Date().toISOString().slice(0, 10);
    const allocations = await admin.entities.Allocation.filter({ allocated_driver_user_id: user.id }, '-date', 200).catch(() => []);
    const upcoming = (allocations || []).filter((a) => a.status === 'confirmed' && String(a.date || '') >= today);

    const allProfiles = await admin.entities.PassengerProfile.list('-created_date', 1000).catch(() => []);
    const profileByUserId = {};
    (allProfiles || []).forEach((p) => { if (p.user_id) profileByUserId[p.user_id] = p; });

    const allAttempts = await admin.entities.ContactAttempt.list('-attempted_at', 1000).catch(() => []);
    const allReports = await admin.entities.NoShowReport.list('-reported_at', 500).catch(() => []);

    let graceMinutes = 10;
    try {
      const policies = await admin.entities.NoShowPolicy.list('-created_date', 50);
      const active = (policies || []).find((p) => p.is_active);
      if (active && Number(active.grace_minutes) >= 0) graceMinutes = Number(active.grace_minutes);
    } catch (e) {}

    const entries = [];
    for (const a of upcoming) {
      const bookings = await admin.entities.Booking.filter({ trip_id: a.id }, '-created_date', 100).catch(() => []);
      const confirmed = (bookings || []).filter((b) => b.booking_status === 'confirmed');
      for (const b of confirmed) {
        const p = profileByUserId[b.passenger_id] || null;
        const attempts = (allAttempts || []).filter((at) => at.booking_id === b.id).sort((x, y) => String(y.attempted_at || '').localeCompare(String(x.attempted_at || '')));
        const report = (allReports || []).find((r) => r.booking_id === b.id) || null;
        entries.push({
          allocation_id: a.id,
          route: `${a.origin || ''} → ${a.destination || ''}`,
          departure_date: a.date,
          departure_time: a.departure_time,
          booking_id: b.id,
          trip_request_id: b.trip_request_id || null,
          passenger_name: b.passenger_name || (p && p.full_name) || 'Passenger',
          passenger_phone: (p && p.phone) || null,
          number_of_seats: b.number_of_seats || 1,
          payment_state: b.payment_state || null,
          priority: b.priority || null,
          no_show_status: b.no_show_status || 'none',
          passenger_arrived: !!b.passenger_arrived,
          contact_attempts: attempts.map((at) => ({
            id: at.id,
            attempt_type: at.attempt_type,
            outcome: at.outcome,
            attempted_at: at.attempted_at,
            note: at.note,
          })),
          no_show_report_id: b.no_show_report_id || (report && report.id) || null,
          no_show_status_report: report ? report.no_show_status : null,
        });
      }
    }

    return Response.json({ entries, grace_minutes: graceMinutes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}