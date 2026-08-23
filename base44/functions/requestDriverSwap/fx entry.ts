import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rankEligibleDrivers } from '../../shared/allocationEngine.ts';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Driver Allocation Swap — a driver selects an eligible replacement driver and
 * sends a swap request. Treba validates the target is eligible (active access,
 * route-qualified, suitable vehicle, no conflict, sufficient capacity) and
 * notifies the target driver to accept or decline. No admin intervention.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { allocation_id, target_driver_id, notes } = body || {};
    if (!allocation_id || !target_driver_id) {
      return Response.json({ error: 'allocation_id and target_driver_id are required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const allocation = await admin.entities.Allocation.get(allocation_id);
    if (!allocation) return Response.json({ error: 'Allocation not found' }, { status: 404 });
    if (allocation.allocated_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver can request a swap' }, { status: 403 });
    }
    if (allocation.status !== 'confirmed') {
      return Response.json({ error: 'Only confirmed allocations can be swapped' }, { status: 400 });
    }

    // One pending outgoing swap per allocation.
    const existingSwaps = await admin.entities.DriverSwapRequest.filter(
      { allocation_id, swap_status: 'pending' }, '-created_date', 20
    ).catch(() => []);
    if (existingSwaps && existingSwaps.length) {
      return Response.json({ error: 'A pending swap request already exists for this allocation' }, { status: 400 });
    }

    const route = await admin.entities.Route.get(allocation.route_id).catch(() => null);
    if (!route) return Response.json({ error: 'Route not found' }, { status: 404 });

    const bookings = await admin.entities.Booking.filter({ trip_id: allocation_id }, '-created_date', 200).catch(() => []);
    const confirmedBookings = (bookings || []).filter((b) => b.booking_status === 'confirmed' || b.booking_status === 'pending');
    const confirmedSeats = confirmedBookings.reduce((s, b) => s + (b.number_of_seats || 1), 0);

    const drivers = await admin.entities.DriverProfile.list('-created_date', 500);
    const targetProfile = drivers.find((d) => d.id === target_driver_id);
    if (!targetProfile) return Response.json({ error: 'Target driver not found' }, { status: 404 });
    if (targetProfile.id === allocation.allocated_driver_id) {
      return Response.json({ error: 'Cannot swap with yourself' }, { status: 400 });
    }

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
    const targetRanked = ranked.find((r) => r.driver.id === target_driver_id);
    if (!targetRanked) {
      return Response.json({ error: 'Selected driver is not eligible for this swap' }, { status: 400 });
    }
    const targetVehicle = targetRanked.vehicle;

    const now = new Date().toISOString();
    const swap = await admin.entities.DriverSwapRequest.create({
      allocation_id,
      requesting_driver_id: allocation.allocated_driver_id,
      requesting_driver_user_id: allocation.allocated_driver_user_id,
      requesting_driver_name: allocation.allocated_driver_name,
      route_id: allocation.route_id,
      origin: allocation.origin,
      destination: allocation.destination,
      date: allocation.date,
      departure_time: allocation.departure_time,
      target_driver_id: targetProfile.id,
      target_driver_user_id: targetProfile.user_id,
      target_driver_name: targetProfile.full_name,
      target_vehicle_id: targetVehicle.id,
      target_vehicle_label: `${targetVehicle.make} ${targetVehicle.model} (${targetVehicle.registration_number})`,
      swap_status: 'pending',
      requested_at: now,
      confirmed_bookings_count: confirmedBookings.length,
      notes: notes || null,
    });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'driver_swap_requested',
        entity_type: 'DriverSwapRequest', record_id: swap.id,
        metadata: { allocation_id, target_driver_id },
      });
    } catch (e) {}

    try {
      await sendNotification(admin, {
        user_id: targetProfile.user_id,
        event_type: NOTIFICATION_EVENTS.DRIVER_SWAP_REQUESTED,
        title: 'Driver swap request',
        message: `${allocation.allocated_driver_name} requested a swap for ${allocation.origin} → ${allocation.destination} on ${allocation.date} at ${allocation.departure_time}. You will inherit ${confirmedBookings.length} confirmed booking(s) and their agreed fares. Accept or decline.`,
        related_id: swap.id,
      });
    } catch (e) {}

    return Response.json({ swap });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}