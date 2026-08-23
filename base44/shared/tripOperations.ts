/**
 * Treba Trip Operations engine.
 *
 * A TripOperation is the live operational wrapper around a driver's scheduled
 * Allocation: it holds the passenger manifest snapshot, trip status
 * (scheduled → departed → completed/cancelled), the mandatory operational
 * checks required before departure, and the admin-override flag.
 *
 * Operational events (passenger check-in, trip start, trip completion,
 * passenger/driver no-show, cancellation, incident) are recorded as
 * TripOperationEvent records for audit and review.
 */

export async function getDriverProfileByUser(admin, userId) {
  const profiles = await admin.entities.DriverProfile.list('-created_date', 500).catch(() => []);
  return (profiles || []).find((p) => p.user_id === userId) || null;
}

export async function getVehicle(admin, vehicleId) {
  if (!vehicleId) return null;
  return await admin.entities.Vehicle.get(vehicleId).catch(() => null);
}

/**
 * Mandatory operational conditions a driver must satisfy before starting a
 * trip: driver profile approved, vehicle verified, at least one confirmed
 * passenger, and every confirmed passenger has paid.
 */
export function computeChecks(driverProfile, vehicle, confirmedBookings) {
  const driver_approved = !!(driverProfile && driverProfile.verification_status === 'approved');
  const vehicle_approved = !!(vehicle && vehicle.verification_status === 'approved');
  const has_confirmed_passengers = confirmedBookings.length > 0;
  const all_paid = confirmedBookings.length > 0 && confirmedBookings.every((b) => b.payment_status === 'paid');
  const blocking_reasons = [];
  if (!driver_approved) blocking_reasons.push('Driver profile is not approved');
  if (!vehicle_approved) blocking_reasons.push('Vehicle is not verified');
  if (!has_confirmed_passengers) blocking_reasons.push('No confirmed passengers on the manifest');
  if (!all_paid) blocking_reasons.push('Not all confirmed passengers have paid');
  return { driver_approved, vehicle_approved, has_confirmed_passengers, all_paid, blocking_reasons };
}

export async function ensureTripOperation(admin, allocation, driverProfile, vehicle, confirmedCount) {
  const existing = await admin.entities.TripOperation.filter({ allocation_id: allocation.id }, '-created_date', 5).catch(() => []);
  if (existing && existing.length) {
    const op = existing[0];
    if (op.manifest_count !== confirmedCount || op.trip_status === 'scheduled') {
      try { await admin.entities.TripOperation.update(op.id, { manifest_count: confirmedCount }); } catch (e) {}
    }
    return op;
  }
  return await admin.entities.TripOperation.create({
    allocation_id: allocation.id,
    driver_id: allocation.allocated_driver_id || (driverProfile && driverProfile.id) || null,
    driver_user_id: allocation.allocated_driver_user_id || (driverProfile && driverProfile.user_id) || null,
    vehicle_id: allocation.vehicle_id || (vehicle && vehicle.id) || null,
    vehicle_label: allocation.vehicle_label || (vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registration_number})` : null),
    route: `${allocation.origin || ''} → ${allocation.destination || ''}`,
    origin: allocation.origin || null,
    destination: allocation.destination || null,
    departure_date: allocation.date || null,
    departure_time: allocation.departure_time || null,
    total_seats: allocation.total_seats || (vehicle && vehicle.seating_capacity) || 0,
    manifest_count: confirmedCount,
    trip_status: 'scheduled',
  });
}

export async function findTripOperationByAllocation(admin, allocationId) {
  const ops = await admin.entities.TripOperation.filter({ allocation_id: allocationId }, '-created_date', 5).catch(() => []);
  return (ops && ops[0]) || null;
}

export async function logEvent(admin, params) {
  try {
    const { allocationId, driverUserId, eventType, bookingId, passengerId, note, userId } = params;
    let opId = params.tripOperationId;
    if (!opId && allocationId) {
      const op = await findTripOperationByAllocation(admin, allocationId);
      opId = op && op.id;
    }
    if (!opId) return null;
    return await admin.entities.TripOperationEvent.create({
      trip_operation_id: opId,
      allocation_id: allocationId || null,
      driver_user_id: driverUserId || null,
      event_type: eventType,
      booking_id: bookingId || null,
      passenger_id: passengerId || null,
      note: note || null,
      recorded_at: new Date().toISOString(),
      recorded_by: userId || null,
    });
  } catch (e) {
    return null;
  }
}

export function luggageSummary(tr) {
  if (!tr) return null;
  const parts = [];
  if (tr.luggage_small_bags) parts.push(`${tr.luggage_small_bags} small`);
  if (tr.luggage_standard_bags) parts.push(`${tr.luggage_standard_bags} standard`);
  if (tr.luggage_large_suitcases) parts.push(`${tr.luggage_large_suitcases} large`);
  if (tr.luggage_oversized_items) parts.push(`${tr.luggage_oversized_items} oversized`);
  return parts.length ? parts.join(', ') : null;
}