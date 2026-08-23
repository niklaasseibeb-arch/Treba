import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rankEligibleDrivers } from '../../shared/allocationEngine.ts';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { findTripOperationByAllocation, logEvent } from '../../shared/tripOperations.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

function vehicleLabel(v) { return `${v.make} ${v.model} (${v.registration_number})`; }

/**
 * Driver Allocation Swap — the target driver accepts or declines a swap request
 * (the requesting driver may also cancel a pending request).
 *
 * On ACCEPT the allocation is transferred to the replacement driver and:
 *   - the allocation is updated (driver, vehicle, capacity)
 *   - confirmed bookings are transferred to the new driver (fares preserved,
 *     never renegotiated)
 *   - linked trip requests' matched-driver info is updated (passenger-facing)
 *   - the trip manifest (TripOperation) is updated
 *   - the requesting driver is released, the replacement confirmed
 *   - affected passengers are notified their driver changed (name, vehicle,
 *     route, departure time)
 *
 * No admin intervention is required for a normal approved swap.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { swap_id, action, decline_reason } = body || {};
    if (!swap_id || !action) return Response.json({ error: 'swap_id and action are required' }, { status: 400 });
    if (!['accept', 'decline', 'cancel'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const swap = await admin.entities.DriverSwapRequest.get(swap_id);
    if (!swap) return Response.json({ error: 'Swap request not found' }, { status: 404 });
    if (swap.swap_status !== 'pending') {
      return Response.json({ error: 'Swap request is no longer pending' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const isAdmin = user.role === 'admin';

    if (action === 'cancel') {
      if (swap.requesting_driver_user_id !== user.id && !isAdmin) {
        return Response.json({ error: 'Only the requesting driver can cancel' }, { status: 403 });
      }
      await admin.entities.DriverSwapRequest.update(swap_id, { swap_status: 'cancelled', responded_at: now });
      return Response.json({ status: 'cancelled' });
    }

    // accept / decline — target driver or admin
    if (swap.target_driver_user_id !== user.id && !isAdmin) {
      return Response.json({ error: 'Only the target driver can respond' }, { status: 403 });
    }

    if (action === 'decline') {
      await admin.entities.DriverSwapRequest.update(swap_id, {
        swap_status: 'declined',
        responded_at: now,
        decline_reason: decline_reason || null,
      });
      try {
        await admin.entities.AuditLog.create({
          user_id: user.id, user_role: user.role, action: 'driver_swap_declined',
          entity_type: 'DriverSwapRequest', record_id: swap_id,
          metadata: { allocation_id: swap.allocation_id },
        });
      } catch (e) {}
      try {
        await sendNotification(admin, {
          user_id: swap.requesting_driver_user_id,
          event_type: NOTIFICATION_EVENTS.DRIVER_SWAP_DECLINED,
          title: 'Swap declined',
          message: `${swap.target_driver_name} declined your swap request for ${swap.origin} → ${swap.destination} on ${swap.date}.`,
          related_id: swap_id,
        });
      } catch (e) {}
      return Response.json({ status: 'declined' });
    }

    // ---- accept ----
    const allocation = await admin.entities.Allocation.get(swap.allocation_id);
    if (!allocation) return Response.json({ error: 'Allocation not found' }, { status: 404 });
    if (allocation.status !== 'confirmed') {
      await admin.entities.DriverSwapRequest.update(swap_id, { swap_status: 'declined', responded_at: now, decline_reason: 'Allocation no longer confirmed' });
      return Response.json({ error: 'Allocation is no longer confirmed' }, { status: 400 });
    }

    // Re-validate target eligibility at acceptance time.
    const route = await admin.entities.Route.get(allocation.route_id).catch(() => null);
    const bookings = await admin.entities.Booking.filter({ trip_id: allocation.id }, '-created_date', 200).catch(() => []);
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
    const targetRanked = ranked.find((r) => r.driver.id === swap.target_driver_id);
    if (!targetRanked) {
      await admin.entities.DriverSwapRequest.update(swap_id, { swap_status: 'declined', responded_at: now, decline_reason: 'Target no longer eligible' });
      try {
        await sendNotification(admin, {
          user_id: swap.requesting_driver_user_id,
          event_type: NOTIFICATION_EVENTS.DRIVER_SWAP_DECLINED,
          title: 'Swap could not complete',
          message: `The swap with ${swap.target_driver_name} could not be completed because the driver is no longer eligible. Try another driver.`,
          related_id: swap_id,
        });
      } catch (e) {}
      return Response.json({ error: 'Target driver is no longer eligible for this swap' }, { status: 400 });
    }
    const targetVehicle = targetRanked.vehicle;
    const targetProfile = targetRanked.driver;

    // 1) Transfer the allocation to the replacement driver.
    const totalSeats = targetVehicle.seating_capacity || 0;
    const availableSeats = Math.max(0, totalSeats - confirmedSeats);
    await admin.entities.Allocation.update(allocation.id, {
      allocated_driver_id: targetProfile.id,
      allocated_driver_name: targetProfile.full_name,
      allocated_driver_user_id: targetProfile.user_id,
      vehicle_id: targetVehicle.id,
      vehicle_label: vehicleLabel(targetVehicle),
      total_seats: totalSeats,
      available_seats: availableSeats,
      status: 'confirmed',
      replacement_driver_id: targetProfile.id,
      replacement_driver_name: targetProfile.full_name,
    });

    // 2) Transfer confirmed bookings to the new driver. Fares are preserved —
    //    a driver swap never renegotiates existing passenger fares.
    const tripRequestIds = new Set();
    for (const b of confirmedBookings) {
      try {
        await admin.entities.Booking.update(b.id, { driver_id: targetProfile.id });
        if (b.trip_request_id) tripRequestIds.add(b.trip_request_id);
      } catch (e) {}
    }

    // 3) Update linked trip requests' matched-driver info (passenger-facing).
    for (const trId of tripRequestIds) {
      try {
        await admin.entities.TripRequest.update(trId, {
          matched_driver_id: targetProfile.id,
          matched_driver_user_id: targetProfile.user_id,
          matched_driver_name: targetProfile.full_name,
        });
      } catch (e) {}
    }

    // 4) Update the trip manifest (TripOperation) if it exists.
    try {
      const op = await findTripOperationByAllocation(admin, allocation.id);
      if (op) {
        await admin.entities.TripOperation.update(op.id, {
          driver_id: targetProfile.id,
          driver_user_id: targetProfile.user_id,
          vehicle_id: targetVehicle.id,
          vehicle_label: vehicleLabel(targetVehicle),
          total_seats: totalSeats,
        });
        await logEvent(admin, {
          tripOperationId: op.id, allocationId: allocation.id,
          driverUserId: targetProfile.user_id, eventType: 'driver_swap',
          userId: user.id,
          note: `Allocation swapped from ${swap.requesting_driver_name} to ${targetProfile.full_name}`,
        });
      }
    } catch (e) {}

    // 5) Mark the swap accepted.
    await admin.entities.DriverSwapRequest.update(swap_id, { swap_status: 'accepted', responded_at: now });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'driver_swap_accepted',
        entity_type: 'DriverSwapRequest', record_id: swap_id,
        metadata: { allocation_id: allocation.id, new_driver_id: targetProfile.id },
      });
    } catch (e) {}

    // 6) Notify both drivers.
    try {
      await sendNotification(admin, {
        user_id: swap.requesting_driver_user_id,
        event_type: NOTIFICATION_EVENTS.DRIVER_SWAP_ACCEPTED,
        title: 'Swap accepted — allocation released',
        message: `${targetProfile.full_name} accepted your swap. You are released from ${swap.origin} → ${swap.destination} on ${swap.date} at ${swap.departure_time}.`,
        related_id: swap_id,
      });
      await sendNotification(admin, {
        user_id: targetProfile.user_id,
        event_type: NOTIFICATION_EVENTS.DRIVER_SWAP_ACCEPTED,
        title: 'Swap accepted — allocation confirmed',
        message: `You now hold ${swap.origin} → ${swap.destination} on ${swap.date} at ${swap.departure_time}. ${confirmedBookings.length} confirmed booking(s) were transferred to you with their agreed fares.`,
        related_id: swap_id,
      });
    } catch (e) {}

    // 7) Notify affected passengers: "Your driver has changed."
    const vehicleLbl = vehicleLabel(targetVehicle);
    for (const b of confirmedBookings) {
      try {
        await sendNotification(admin, {
          user_id: b.passenger_id,
          event_type: NOTIFICATION_EVENTS.DRIVER_CHANGED,
          title: 'Your driver has changed',
          message: `Your trip ${swap.origin} → ${swap.destination} on ${swap.date} at ${swap.departure_time} will now be operated by ${targetProfile.full_name} in a ${vehicleLbl}. Your booking and agreed fare are unchanged.`,
          related_id: b.trip_request_id || b.id,
          dedupe_key: `driver_changed_${b.id}_${swap.id}`,
        });
      } catch (e) {}
    }

    return Response.json({
      status: 'accepted',
      allocation_id: allocation.id,
      new_driver: targetProfile.full_name,
      transferred_bookings: confirmedBookings.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}