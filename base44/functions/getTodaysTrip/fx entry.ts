import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  getDriverProfileByUser, getVehicle, computeChecks, ensureTripOperation, logEvent, luggageSummary,
} from '../../shared/tripOperations.ts';

/**
 * Trip Operations — returns the driver's TODAY'S TRIP: the scheduled passenger
 * manifest for today's confirmed allocation, with route, departure, vehicle,
 * per-passenger details, mandatory operational checks, trip status and the
 * operational event timeline.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = base44.asServiceRole;
    const driverProfile = await getDriverProfileByUser(admin, user.id);
    if (!driverProfile) return Response.json({ trip: null, manifest: [], events: [] });

    const today = new Date().toISOString().slice(0, 10);
    const allocations = await admin.entities.Allocation.filter({ allocated_driver_user_id: user.id }, '-date', 200).catch(() => []);
    const todays = (allocations || []).filter((a) => a.status === 'confirmed' && String(a.date || '') === today);
    if (todays.length === 0) return Response.json({ trip: null, manifest: [], events: [] });

    todays.sort((a, b) => String(a.departure_time || '').localeCompare(String(b.departure_time || '')));
    const allocation = todays[0];

    const vehicle = await getVehicle(admin, allocation.vehicle_id || driverProfile.vehicle_id);

    const bookings = await admin.entities.Booking.filter({ trip_id: allocation.id }, '-created_date', 100).catch(() => []);
    const confirmed = (bookings || []).filter((b) => b.booking_status === 'confirmed');

    const operation = await ensureTripOperation(admin, allocation, driverProfile, vehicle, confirmed.length);

    const checks = computeChecks(driverProfile, vehicle, confirmed);
    const can_start = (checks.driver_approved && checks.vehicle_approved && checks.has_confirmed_passengers && checks.all_paid) || !!operation.admin_override;

    // Passenger profiles for contact details.
    const allProfiles = await admin.entities.PassengerProfile.list('-created_date', 1000).catch(() => []);
    const profileByUserId = {};
    (allProfiles || []).forEach((p) => { if (p.user_id) profileByUserId[p.user_id] = p; });

    // Trip requests for luggage, notes, pickup/drop-off.
    const tripRequestIds = confirmed.map((b) => b.trip_request_id).filter(Boolean);
    const tripRequests = {};
    if (tripRequestIds.length) {
      const all = await admin.entities.TripRequest.list('-created_date', 500).catch(() => []);
      (all || []).forEach((t) => { tripRequests[t.id] = t; });
    }

    const manifest = confirmed.map((b) => {
      const p = profileByUserId[b.passenger_id] || null;
      const tr = b.trip_request_id ? tripRequests[b.trip_request_id] : null;
      return {
        booking_id: b.id,
        trip_request_id: b.trip_request_id || null,
        passenger_name: b.passenger_name || (p && p.full_name) || 'Passenger',
        passenger_phone: (p && p.phone) || null,
        number_of_seats: b.number_of_seats || 1,
        pickup: (tr && tr.pickup_location) || b.pickup_location || null,
        dropoff: (tr && tr.dropoff_location) || b.dropoff_location || null,
        payment_status: b.payment_status || null,
        booking_status: b.booking_status || null,
        luggage: b.luggage_summary || luggageSummary(tr),
        special_notes: (tr && (tr.notes || tr.luggage_details)) || null,
        passenger_arrived: !!b.passenger_arrived,
        no_show_status: b.no_show_status || 'none',
        driver_no_show_status: b.driver_no_show_status || 'none',
      };
    });

    const events = await admin.entities.TripOperationEvent.filter({ trip_operation_id: operation.id }, '-recorded_at', 100).catch(() => []);

    return Response.json({
      trip: {
        ...operation,
        checks,
        can_start,
        blocking_reasons: checks.blocking_reasons,
      },
      manifest,
      events: events || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}