import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

const DEPARTURE_WINDOW_MIN = 120;
function toMinutes(t) {
  if (!t) return null;
  const parts = String(t).split(':').map(Number);
  if (parts.some(isNaN)) return null;
  return parts[0] * 60 + (parts[1] || 0);
}

/**
 * Passenger Booking Transfer — a passenger selects an eligible alternative
 * service and requests a transfer. Treba validates the target is eligible and
 * notifies the receiving driver, whose acceptance is required before the
 * booking is moved. No transfer fee is applied unless one is explicitly
 * configured later.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { booking_id, target_allocation_id, notes } = body || {};
    if (!booking_id || !target_allocation_id) {
      return Response.json({ error: 'booking_id and target_allocation_id are required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const booking = await admin.entities.Booking.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the booking owner can request a transfer' }, { status: 403 });
    }
    if (booking.booking_status !== 'confirmed') {
      return Response.json({ error: 'Only confirmed bookings can be transferred' }, { status: 400 });
    }

    const currentAlloc = await admin.entities.Allocation.get(booking.trip_id).catch(() => null);
    if (!currentAlloc) return Response.json({ error: 'Current service not found' }, { status: 404 });
    if (target_allocation_id === currentAlloc.id) {
      return Response.json({ error: 'Cannot transfer to the same service' }, { status: 400 });
    }

    const targetAlloc = await admin.entities.Allocation.get(target_allocation_id);
    if (!targetAlloc) return Response.json({ error: 'Target service not found' }, { status: 404 });
    if (targetAlloc.status !== 'confirmed') {
      return Response.json({ error: 'Target service is not confirmed' }, { status: 400 });
    }
    const seats = booking.number_of_seats || 1;
    if ((targetAlloc.available_seats || 0) < seats) {
      return Response.json({ error: 'Target service does not have enough available capacity' }, { status: 400 });
    }
    if (targetAlloc.origin !== currentAlloc.origin || targetAlloc.destination !== currentAlloc.destination) {
      return Response.json({ error: 'Target service is not on the same route' }, { status: 400 });
    }
    if (targetAlloc.date !== currentAlloc.date) {
      return Response.json({ error: 'Target service is not on the same date' }, { status: 400 });
    }
    const origDep = toMinutes(currentAlloc.departure_time);
    const tgtDep = toMinutes(targetAlloc.departure_time);
    if (origDep != null && tgtDep != null && Math.abs(tgtDep - origDep) > DEPARTURE_WINDOW_MIN) {
      return Response.json({ error: 'Target service departs outside the compatible time window' }, { status: 400 });
    }

    // Re-validate the receiving driver's eligibility + access.
    const drivers = await admin.entities.DriverProfile.list('-created_date', 500);
    const targetProfile = drivers.find((d) => d.id === targetAlloc.allocated_driver_id);
    if (!targetProfile) return Response.json({ error: 'Receiving driver not found' }, { status: 404 });
    if (targetProfile.account_status && targetProfile.account_status !== 'active') {
      return Response.json({ error: 'Receiving driver is not active' }, { status: 400 });
    }
    if (targetProfile.verification_status && targetProfile.verification_status !== 'approved') {
      return Response.json({ error: 'Receiving driver is not approved' }, { status: 400 });
    }
    if (targetProfile.availability_status && targetProfile.availability_status !== 'available') {
      return Response.json({ error: 'Receiving driver is not available' }, { status: 400 });
    }
    const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
    if (!targetProfile.user_id || !accessUserIds.has(targetProfile.user_id)) {
      return Response.json({ error: 'Receiving driver does not have active marketplace access' }, { status: 400 });
    }

    // One pending transfer per booking.
    const existing = await admin.entities.BookingTransferRequest.filter(
      { booking_id, transfer_status: 'pending' }, '-created_date', 20
    ).catch(() => []);
    if (existing && existing.length) {
      return Response.json({ error: 'A pending transfer request already exists for this booking' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const transfer = await admin.entities.BookingTransferRequest.create({
      booking_id,
      trip_request_id: booking.trip_request_id || null,
      passenger_id: booking.passenger_id,
      passenger_name: booking.passenger_name || null,
      origin: booking.origin || currentAlloc.origin,
      destination: booking.destination || currentAlloc.destination,
      date: currentAlloc.date,
      departure_time: currentAlloc.departure_time,
      current_allocation_id: currentAlloc.id,
      current_driver_id: currentAlloc.allocated_driver_id,
      current_driver_name: currentAlloc.allocated_driver_name,
      target_allocation_id: targetAlloc.id,
      target_driver_id: targetProfile.id,
      target_driver_user_id: targetProfile.user_id,
      target_driver_name: targetProfile.full_name,
      target_departure_time: targetAlloc.departure_time,
      target_vehicle_label: targetAlloc.vehicle_label || null,
      number_of_seats: seats,
      fare_amount: booking.fare_amount || null,
      transfer_status: 'pending',
      requested_at: now,
      notes: notes || null,
    });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'booking_transfer_requested',
        entity_type: 'BookingTransferRequest', record_id: transfer.id,
        metadata: { booking_id, target_allocation_id, target_driver_id: targetProfile.id },
      });
    } catch (e) {}

    try {
      await sendNotification(admin, {
        user_id: targetProfile.user_id,
        event_type: NOTIFICATION_EVENTS.BOOKING_TRANSFER_REQUESTED,
        title: 'Booking transfer request',
        message: `${booking.passenger_name || 'A passenger'} requested to transfer to your ${targetAlloc.origin} → ${targetAlloc.destination} service on ${targetAlloc.date} at ${targetAlloc.departure_time} (${seats} seat(s)). The agreed fare is preserved. Accept or decline.`,
        related_id: transfer.id,
      });
    } catch (e) {}

    return Response.json({ transfer });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}