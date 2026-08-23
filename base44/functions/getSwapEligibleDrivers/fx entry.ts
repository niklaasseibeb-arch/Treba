import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rankEligibleDrivers } from '../../shared/allocationEngine.ts';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';

/**
 * Driver Allocation Swap — returns the eligible replacement drivers a driver
 * may select to take over one of their confirmed allocations.
 *
 * Eligibility mirrors the allocation engine plus swap-specific rules:
 *   - active marketplace access (active trial, active paid, or cancelled
 *     within its paid period)
 *   - route-qualified (preferred routes)
 *   - approved, available driver with an approved, suitable vehicle
 *   - no conflicting allocation (rest / fatigue / daily-cap rules)
 *   - sufficient seating capacity for the existing confirmed bookings
 *   - not the currently allocated driver
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { allocation_id } = body || {};
    if (!allocation_id) return Response.json({ error: 'allocation_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const allocation = await admin.entities.Allocation.get(allocation_id);
    if (!allocation) return Response.json({ error: 'Allocation not found' }, { status: 404 });
    if (allocation.allocated_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver can request a swap' }, { status: 403 });
    }
    if (allocation.status !== 'confirmed') {
      return Response.json({ error: 'Only confirmed allocations can be swapped' }, { status: 400 });
    }

    const route = await admin.entities.Route.get(allocation.route_id).catch(() => null);
    if (!route) return Response.json({ error: 'Route not found' }, { status: 404 });

    const bookings = await admin.entities.Booking.filter({ trip_id: allocation_id }, '-created_date', 200).catch(() => []);
    const confirmedBookings = (bookings || []).filter((b) => b.booking_status === 'confirmed' || b.booking_status === 'pending');
    const confirmedSeats = confirmedBookings.reduce((s, b) => s + (b.number_of_seats || 1), 0);

    const drivers = await admin.entities.DriverProfile.list('-created_date', 500);
    const vehicles = await admin.entities.Vehicle.list('-created_date', 500);
    const vehiclesByDriver = {};
    for (const v of vehicles) { if (v.driver_id) vehiclesByDriver[v.driver_id] = v; }
    const existing = await admin.entities.Allocation.list('-created_date', 500);

    let ranked = rankEligibleDrivers({
      route,
      date: allocation.date,
      departureTime: allocation.departure_time,
      drivers,
      vehiclesByDriver,
      existingAllocations: existing,
      excludeDriverIds: allocation.allocated_driver_id ? [allocation.allocated_driver_id] : [],
    });

    const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
    ranked = ranked.filter((r) => r.driver?.user_id && accessUserIds.has(r.driver.user_id));
    ranked = ranked.filter((r) => (r.vehicle.seating_capacity || 0) >= confirmedSeats);

    const eligible = ranked.map((r) => ({
      driver_id: r.driver.id,
      driver_user_id: r.driver.user_id,
      driver_name: r.driver.full_name,
      rating: r.driver.rating || 0,
      vehicle_id: r.vehicle.id,
      vehicle_label: `${r.vehicle.make} ${r.vehicle.model} (${r.vehicle.registration_number})`,
      seating_capacity: r.vehicle.seating_capacity || 0,
      prior_on_route: r.priorOnRoute,
    }));

    return Response.json({
      allocation: {
        id: allocation.id,
        origin: allocation.origin,
        destination: allocation.destination,
        date: allocation.date,
        departure_time: allocation.departure_time,
      },
      confirmed_bookings_count: confirmedBookings.length,
      confirmed_seats: confirmedSeats,
      eligible_drivers: eligible,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}