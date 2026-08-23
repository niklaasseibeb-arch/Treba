import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';

const DEPARTURE_WINDOW_MIN = 120;

function toMinutes(t) {
  if (!t) return null;
  const parts = String(t).split(':').map(Number);
  if (parts.some(isNaN)) return null;
  return parts[0] * 60 + (parts[1] || 0);
}

/**
 * Passenger Booking Transfer — returns the eligible alternative services a
 * passenger may transfer a confirmed booking to.
 *
 * An alternative is eligible when it:
 *   - operates the same route (same origin + destination)
 *   - operates on the same travel date
 *   - departs at a compatible time (within DEPARTURE_WINDOW_MIN of the current
 *     service)
 *   - is a confirmed, properly allocated service
 *   - has an active, approved, available driver with an approved vehicle
 *   - has enough available capacity for the passenger's seats
 *   - has active marketplace access (active trial / active paid / cancelled
 *     within its paid period)
 *   - is not the passenger's current service
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
    if (booking.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the booking owner can request a transfer' }, { status: 403 });
    }
    if (booking.booking_status !== 'confirmed') {
      return Response.json({ error: 'Only confirmed bookings can be transferred' }, { status: 400 });
    }

    const currentAllocId = booking.trip_id;
    const currentAlloc = await admin.entities.Allocation.get(currentAllocId).catch(() => null);
    if (!currentAlloc) return Response.json({ error: 'Current service not found' }, { status: 404 });

    const seats = booking.number_of_seats || 1;
    const origDepMin = toMinutes(currentAlloc.departure_time);

    const allocations = await admin.entities.Allocation.list('-date', 500);
    const candidates = (allocations || []).filter((a) =>
      a.id !== currentAllocId &&
      a.status === 'confirmed' &&
      a.allocated_driver_id &&
      a.vehicle_id &&
      a.origin === currentAlloc.origin &&
      a.destination === currentAlloc.destination &&
      a.date === currentAlloc.date &&
      (a.available_seats || 0) >= seats &&
      origDepMin != null &&
      toMinutes(a.departure_time) != null &&
      Math.abs(toMinutes(a.departure_time) - origDepMin) <= DEPARTURE_WINDOW_MIN
    );

    const drivers = await admin.entities.DriverProfile.list('-created_date', 500);
    const vehicles = await admin.entities.Vehicle.list('-created_date', 500);
    const vehicleById = {};
    for (const v of vehicles) { vehicleById[v.id] = v; }
    const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);

    const eligible = [];
    for (const a of candidates) {
      const profile = drivers.find((d) => d.id === a.allocated_driver_id);
      if (!profile) continue;
      if (profile.account_status && profile.account_status !== 'active') continue;
      if (profile.verification_status && profile.verification_status !== 'approved') continue;
      if (profile.availability_status && profile.availability_status !== 'available') continue;
      if (!profile.user_id || !accessUserIds.has(profile.user_id)) continue;
      const vehicle = vehicleById[a.vehicle_id];
      if (vehicle && vehicle.verification_status && vehicle.verification_status !== 'approved') continue;
      eligible.push({
        allocation_id: a.id,
        driver_id: profile.id,
        driver_name: profile.full_name,
        rating: profile.rating || 0,
        departure_time: a.departure_time,
        available_seats: a.available_seats || 0,
        vehicle_label: a.vehicle_label || (vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registration_number})` : null),
      });
    }

    return Response.json({
      booking: {
        id: booking.id,
        origin: booking.origin || currentAlloc.origin,
        destination: booking.destination || currentAlloc.destination,
        date: currentAlloc.date,
        departure_time: currentAlloc.departure_time,
        number_of_seats: seats,
        fare_amount: booking.fare_amount,
        current_driver_name: currentAlloc.allocated_driver_name,
      },
      eligible_services: eligible,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}