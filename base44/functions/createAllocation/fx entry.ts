import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rankEligibleDrivers } from '../../shared/allocationEngine.ts';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { route_id, date, departure_time } = body || {};
    if (!route_id || !date || !departure_time) {
      return Response.json({ error: 'route_id, date and departure_time are required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const route = await admin.entities.Route.get(route_id);
    if (!route) return Response.json({ error: 'Route not found' }, { status: 404 });

    const drivers = await admin.entities.DriverProfile.list('-created_date', 500);
    const vehicles = await admin.entities.Vehicle.list('-created_date', 500);
    const vehiclesByDriver = {};
    for (const v of vehicles) {
      if (v.driver_id) vehiclesByDriver[v.driver_id] = v;
    }
    const existing = await admin.entities.Allocation.list('-created_date', 500);

    const ranked = rankEligibleDrivers({
      route,
      date,
      departureTime: departure_time,
      drivers,
      vehiclesByDriver,
      existingAllocations: existing,
      excludeDriverIds: [],
    });

    if (!ranked.length) {
      return Response.json({
        error: 'No eligible driver available for this route and slot',
        status: 'no_eligible_driver',
      }, { status: 409 });
    }

    // Only drivers with active marketplace access (active trial or paid
    // subscription) may receive new route allocations. An expired-trial driver
    // must select a paid plan before being allocated again.
    const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
    const accessibleRanked = ranked.filter((r) => r.driver?.user_id && accessUserIds.has(r.driver.user_id));
    if (!accessibleRanked.length) {
      return Response.json({
        error: 'No eligible driver with active marketplace access',
        status: 'no_eligible_driver',
      }, { status: 409 });
    }

    const best = accessibleRanked[0];
    const allocation = await admin.entities.Allocation.create({
      route_id: route.id,
      origin: route.origin_town,
      destination: route.destination_town,
      date,
      departure_time,
      route_distance_km: route.distance_km || 0,
      allocated_driver_id: best.driver.id,
      allocated_driver_name: best.driver.full_name,
      allocated_driver_user_id: best.driver.user_id,
      vehicle_id: best.vehicle.id,
      vehicle_label: `${best.vehicle.make} ${best.vehicle.model} (${best.vehicle.registration_number})`,
      total_seats: best.vehicle.seating_capacity || 0,
      available_seats: best.vehicle.seating_capacity || 0,
      status: 'awaiting_confirmation',
      declined_driver_ids: [],
      needs_replacement: false,
    });

    try {
      await sendNotification(admin, {
        user_id: best.driver.user_id,
        event_type: NOTIFICATION_EVENTS.ALLOCATION_CONFIRMATION_REQUIRED,
        title: 'Allocation needs confirmation',
        message: `You have been allocated ${route.origin_town} → ${route.destination_town} on ${date} at ${departure_time}. Confirm or decline your availability.`,
        related_id: allocation.id,
      });
    } catch (e) {}

    return Response.json({ allocation, candidates: ranked.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}