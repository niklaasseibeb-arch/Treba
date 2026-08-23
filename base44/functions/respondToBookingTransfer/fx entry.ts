import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Passenger Booking Transfer — the receiving driver accepts or declines a
 * transfer request (the passenger may cancel a pending request).
 *
 * On ACCEPT the booking is moved to the receiving driver's service:
 *   - the original service's available capacity increases
 *   - the new service's available capacity decreases
 *   - the booking is reassigned (trip_id + driver_id); the agreed fare is
 *     preserved (Treba never recalculates it)
 *   - the linked trip request's matched driver/vehicle/allocation is updated
 *   - the passenger is confirmed and both drivers are notified
 *
 * Treba does not process the passenger payment — the passenger continues to
 * pay the driver directly. If a new fare is required, the passenger and the
 * receiving driver start a separate fare negotiation; Treba never suggests one.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { transfer_id, action, decline_reason } = body || {};
    if (!transfer_id || !action) return Response.json({ error: 'transfer_id and action are required' }, { status: 400 });
    if (!['accept', 'decline', 'cancel'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const transfer = await admin.entities.BookingTransferRequest.get(transfer_id);
    if (!transfer) return Response.json({ error: 'Transfer request not found' }, { status: 404 });
    if (transfer.transfer_status !== 'pending') {
      return Response.json({ error: 'Transfer request is no longer pending' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const isAdmin = user.role === 'admin';

    if (action === 'cancel') {
      if (transfer.passenger_id !== user.id && !isAdmin) {
        return Response.json({ error: 'Only the passenger can cancel' }, { status: 403 });
      }
      await admin.entities.BookingTransferRequest.update(transfer_id, { transfer_status: 'cancelled', responded_at: now });
      return Response.json({ status: 'cancelled' });
    }

    // accept / decline — receiving driver or admin
    if (transfer.target_driver_user_id !== user.id && !isAdmin) {
      return Response.json({ error: 'Only the receiving driver can respond' }, { status: 403 });
    }

    if (action === 'decline') {
      await admin.entities.BookingTransferRequest.update(transfer_id, {
        transfer_status: 'declined',
        responded_at: now,
        decline_reason: decline_reason || null,
      });
      try {
        await admin.entities.AuditLog.create({
          user_id: user.id, user_role: user.role, action: 'booking_transfer_declined',
          entity_type: 'BookingTransferRequest', record_id: transfer_id,
          metadata: { booking_id: transfer.booking_id },
        });
      } catch (e) {}
      try {
        await sendNotification(admin, {
          user_id: transfer.passenger_id,
          event_type: NOTIFICATION_EVENTS.BOOKING_TRANSFER_DECLINED,
          title: 'Transfer declined',
          message: `${transfer.target_driver_name} declined your transfer request to the ${transfer.origin} → ${transfer.destination} service at ${transfer.target_departure_time}. Your booking with ${transfer.current_driver_name} is unchanged.`,
          related_id: transfer_id,
        });
      } catch (e) {}
      return Response.json({ status: 'declined' });
    }

    // ---- accept ----
    const booking = await admin.entities.Booking.get(transfer.booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.booking_status !== 'confirmed') {
      await admin.entities.BookingTransferRequest.update(transfer_id, { transfer_status: 'declined', responded_at: now, decline_reason: 'Booking no longer confirmed' });
      return Response.json({ error: 'Booking is no longer confirmed' }, { status: 400 });
    }

    const currentAlloc = await admin.entities.Allocation.get(transfer.current_allocation_id).catch(() => null);
    const targetAlloc = await admin.entities.Allocation.get(transfer.target_allocation_id).catch(() => null);
    if (!currentAlloc || !targetAlloc) {
      return Response.json({ error: 'Service not found' }, { status: 404 });
    }
    if (targetAlloc.status !== 'confirmed') {
      return Response.json({ error: 'Target service is no longer confirmed' }, { status: 400 });
    }
    const seats = transfer.number_of_seats || booking.number_of_seats || 1;
    if ((targetAlloc.available_seats || 0) < seats) {
      return Response.json({ error: 'Target service no longer has enough capacity' }, { status: 400 });
    }

    // Re-validate receiving driver access.
    const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
    if (!transfer.target_driver_user_id || !accessUserIds.has(transfer.target_driver_user_id)) {
      return Response.json({ error: 'Receiving driver no longer has marketplace access' }, { status: 400 });
    }

    // 1) Move the booking to the new service. Fare is preserved.
    await admin.entities.Booking.update(booking.id, {
      trip_id: targetAlloc.id,
      driver_id: transfer.target_driver_id,
    });

    // 2) Adjust capacity: original service increases, new service decreases.
    const currentTotal = currentAlloc.total_seats || 0;
    const newCurrentAvailable = Math.min(currentTotal || 9999, (currentAlloc.available_seats || 0) + seats);
    await admin.entities.Allocation.update(currentAlloc.id, {
      available_seats: currentTotal ? Math.min(currentTotal, newCurrentAvailable) : newCurrentAvailable,
    });
    const targetTotal = targetAlloc.total_seats || 0;
    const newTargetAvailable = Math.max(0, (targetAlloc.available_seats || 0) - seats);
    await admin.entities.Allocation.update(targetAlloc.id, {
      available_seats: newTargetAvailable,
    });

    // 3) Update the linked trip request's matched driver/vehicle/allocation.
    if (booking.trip_request_id) {
      try {
        await admin.entities.TripRequest.update(booking.trip_request_id, {
          matched_allocation_id: targetAlloc.id,
          matched_driver_id: transfer.target_driver_id,
          matched_driver_user_id: transfer.target_driver_user_id,
          matched_driver_name: transfer.target_driver_name,
          matched_vehicle_id: targetAlloc.vehicle_id || null,
        });
      } catch (e) {}
    }

    // 4) Mark the transfer accepted.
    await admin.entities.BookingTransferRequest.update(transfer_id, { transfer_status: 'accepted', responded_at: now });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'booking_transfer_accepted',
        entity_type: 'BookingTransferRequest', record_id: transfer_id,
        metadata: { booking_id: booking.id, target_allocation_id: targetAlloc.id },
      });
    } catch (e) {}

    // 5) Notifications: passenger confirmed, both drivers informed.
    try {
      await sendNotification(admin, {
        user_id: transfer.passenger_id,
        event_type: NOTIFICATION_EVENTS.BOOKING_TRANSFERRED,
        title: 'Transfer confirmed',
        message: `Your booking was transferred to ${transfer.target_driver_name} on the ${transfer.origin} → ${transfer.destination} service on ${transfer.date} at ${transfer.target_departure_time}${transfer.target_vehicle_label ? ` in a ${transfer.target_vehicle_label}` : ''}. Your agreed fare is unchanged. Pay your driver directly.`,
        related_id: transfer_id,
      });
      if (currentAlloc.allocated_driver_user_id) {
        await sendNotification(admin, {
          user_id: currentAlloc.allocated_driver_user_id,
          event_type: NOTIFICATION_EVENTS.BOOKING_TRANSFERRED,
          title: 'Passenger transferred off your trip',
          message: `${transfer.passenger_name || 'A passenger'} transferred off your ${transfer.origin} → ${transfer.destination} service on ${transfer.date} at ${transfer.departure_time}. ${seats} seat(s) restored to your available capacity.`,
          related_id: transfer_id,
        });
      }
      await sendNotification(admin, {
        user_id: transfer.target_driver_user_id,
        event_type: NOTIFICATION_EVENTS.BOOKING_TRANSFER_ACCEPTED,
        title: 'Transfer accepted — passenger added',
        message: `You accepted ${transfer.passenger_name || 'a passenger'} (${seats} seat(s)) onto your ${transfer.origin} → ${transfer.destination} service on ${targetAlloc.date} at ${targetAlloc.departure_time}. The agreed fare is preserved; collect it directly from the passenger.`,
        related_id: transfer_id,
      });
    } catch (e) {}

    return Response.json({
      status: 'accepted',
      booking_id: booking.id,
      new_allocation_id: targetAlloc.id,
      new_driver: transfer.target_driver_name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}