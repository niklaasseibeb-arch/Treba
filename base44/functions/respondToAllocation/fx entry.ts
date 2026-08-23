import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rankEligibleDrivers } from '../../shared/allocationEngine.ts';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

async function findReplacement(admin, allocation, declinedIds) {
  const route = await admin.entities.Route.get(allocation.route_id);
  const drivers = await admin.entities.DriverProfile.list('-created_date', 500);
  const vehicles = await admin.entities.Vehicle.list('-created_date', 500);
  const vehiclesByDriver = {};
  for (const v of vehicles) {
    if (v.driver_id) vehiclesByDriver[v.driver_id] = v;
  }
  const existing = await admin.entities.Allocation.list('-created_date', 500);
  return rankEligibleDrivers({
    route,
    date: allocation.date,
    departureTime: allocation.departure_time,
    drivers,
    vehiclesByDriver,
    existingAllocations: existing,
    excludeDriverIds: declinedIds,
  });
}

function vehicleLabel(v) {
  return `${v.make} ${v.model} (${v.registration_number})`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { allocation_id, action, decline_reason } = body || {};
    if (!allocation_id || !action) {
      return Response.json({ error: 'allocation_id and action are required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const allocation = await admin.entities.Allocation.get(allocation_id);
    if (!allocation) return Response.json({ error: 'Allocation not found' }, { status: 404 });

    const now = new Date().toISOString();
    const isAllocatedDriver = allocation.allocated_driver_user_id === user.id;
    const isAdmin = user.role === 'admin';

    if (action === 'confirm') {
      if (!isAllocatedDriver && !isAdmin) {
        return Response.json({ error: 'Only the allocated driver can confirm' }, { status: 403 });
      }
      const updated = await admin.entities.Allocation.update(allocation_id, {
        status: 'confirmed',
        driver_response_at: now,
      });
      try {
        await sendNotification(admin, { user_id: allocation.allocated_driver_user_id, event_type: NOTIFICATION_EVENTS.ALLOCATION_CONFIRMED, title: 'Allocation confirmed', message: `Your allocation for ${allocation.origin} → ${allocation.destination} on ${allocation.date} at ${allocation.departure_time} is confirmed.`, related_id: allocation_id });
      } catch (e) {}
      return Response.json({ allocation: updated });
    }

    if (action === 'decline') {
      if (!isAllocatedDriver && !isAdmin) {
        return Response.json({ error: 'Only the allocated driver can decline' }, { status: 403 });
      }
      const declinedIds = Array.isArray(allocation.declined_driver_ids)
        ? [...allocation.declined_driver_ids]
        : [];
      if (allocation.allocated_driver_id && !declinedIds.includes(allocation.allocated_driver_id)) {
        declinedIds.push(allocation.allocated_driver_id);
      }

      // A replacement allocation is a NEW allocation for the next driver — only
      // drivers with active marketplace access may receive it.
      let ranked = await findReplacement(admin, allocation, declinedIds);
      const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
      ranked = ranked.filter((r) => r.driver?.user_id && accessUserIds.has(r.driver.user_id));
      if (ranked.length) {
        const next = ranked[0];
        const updated = await admin.entities.Allocation.update(allocation_id, {
          allocated_driver_id: next.driver.id,
          allocated_driver_name: next.driver.full_name,
          allocated_driver_user_id: next.driver.user_id,
          vehicle_id: next.vehicle.id,
          vehicle_label: vehicleLabel(next.vehicle),
          total_seats: next.vehicle.seating_capacity || 0,
          available_seats: next.vehicle.seating_capacity || 0,
          status: 'awaiting_confirmation',
          replacement_driver_id: next.driver.id,
          replacement_driver_name: next.driver.full_name,
          declined_driver_ids: declinedIds,
          needs_replacement: false,
          driver_response_at: now,
          decline_reason: decline_reason || allocation.decline_reason,
        });
        try {
          await sendNotification(admin, { user_id: next.driver.user_id, event_type: NOTIFICATION_EVENTS.ALLOCATION_CONFIRMATION_REQUIRED, title: 'Allocation needs confirmation', message: `You have been allocated ${allocation.origin} → ${allocation.destination} on ${allocation.date} at ${allocation.departure_time}. Confirm or decline your availability.`, related_id: allocation_id });
        } catch (e) {}
        return Response.json({ allocation: updated, reassigned: true });
      }
      const updated = await admin.entities.Allocation.update(allocation_id, {
        status: 'declined',
        driver_response_at: now,
        decline_reason: decline_reason || allocation.decline_reason,
        declined_driver_ids: declinedIds,
        needs_replacement: true,
      });
      return Response.json({
        allocation: updated,
        reassigned: false,
        message: 'No eligible replacement driver found',
      });
    }

    if (action === 'reassign') {
      if (!isAdmin) return Response.json({ error: 'Admin only' }, { status: 403 });
      const declinedIds = Array.isArray(allocation.declined_driver_ids)
        ? [...allocation.declined_driver_ids]
        : [];
      if (allocation.allocated_driver_id && !declinedIds.includes(allocation.allocated_driver_id)) {
        declinedIds.push(allocation.allocated_driver_id);
      }
      // Reassignment is a NEW allocation — only drivers with active marketplace
      // access may receive it.
      let ranked = await findReplacement(admin, allocation, declinedIds);
      const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
      ranked = ranked.filter((r) => r.driver?.user_id && accessUserIds.has(r.driver.user_id));
      if (!ranked.length) {
        return Response.json({ error: 'No eligible replacement driver with active marketplace access' }, { status: 409 });
      }
      const next = ranked[0];
      const updated = await admin.entities.Allocation.update(allocation_id, {
        allocated_driver_id: next.driver.id,
        allocated_driver_name: next.driver.full_name,
        allocated_driver_user_id: next.driver.user_id,
        vehicle_id: next.vehicle.id,
        vehicle_label: vehicleLabel(next.vehicle),
        total_seats: next.vehicle.seating_capacity || 0,
        available_seats: next.vehicle.seating_capacity || 0,
        status: 'awaiting_confirmation',
        replacement_driver_id: next.driver.id,
        replacement_driver_name: next.driver.full_name,
        declined_driver_ids: declinedIds,
        needs_replacement: false,
      });
      try {
        await sendNotification(admin, { user_id: next.driver.user_id, event_type: NOTIFICATION_EVENTS.ALLOCATION_CONFIRMATION_REQUIRED, title: 'Allocation needs confirmation', message: `You have been allocated ${allocation.origin} → ${allocation.destination} on ${allocation.date} at ${allocation.departure_time}. Confirm or decline your availability.`, related_id: allocation_id });
      } catch (e) {}
      return Response.json({ allocation: updated, reassigned: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}