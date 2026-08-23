import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getDriverProfileByUser, getVehicle, computeChecks, findTripOperationByAllocation, logEvent } from '../../shared/tripOperations.ts';

/**
 * Trip Operations — the driver starts today's trip. The trip cannot start
 * unless the mandatory operational conditions are satisfied (driver approved,
 * vehicle verified, at least one confirmed passenger, all confirmed passengers
 * paid) UNLESS an administrator override exists on the trip operation.
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
    const operation = await findTripOperationByAllocation(admin, allocation_id);
    if (!operation) return Response.json({ error: 'Trip operation not found' }, { status: 404 });
    if (operation.trip_status !== 'scheduled') return Response.json({ error: `Trip is already ${operation.trip_status}` }, { status: 400 });
    if (operation.allocated_driver_user_id && operation.driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver can start this trip' }, { status: 403 });
    }

    const allocation = await admin.entities.Allocation.get(allocation_id).catch(() => null);
    const driverProfile = await getDriverProfileByUser(admin, operation.driver_user_id || user.id);
    const vehicle = await getVehicle(admin, operation.vehicle_id || (driverProfile && driverProfile.vehicle_id));
    const bookings = await admin.entities.Booking.filter({ trip_id: allocation_id }, '-created_date', 100).catch(() => []);
    const confirmed = (bookings || []).filter((b) => b.booking_status === 'confirmed');

    const checks = computeChecks(driverProfile, vehicle, confirmed);
    const passed = checks.driver_approved && checks.vehicle_approved && checks.has_confirmed_passengers && checks.all_paid;
    if (!passed && !operation.admin_override) {
      return Response.json({ error: 'Mandatory operational conditions not satisfied', blocking_reasons: checks.blocking_reasons }, { status: 400 });
    }

    const now = new Date().toISOString();
    await admin.entities.TripOperation.update(operation.id, {
      trip_status: 'departed',
      started_at: now,
      operational_checks: checks,
    });

    await logEvent(admin, { tripOperationId: operation.id, allocationId: allocation_id, driverUserId: operation.driver_user_id, eventType: 'trip_start', userId: user.id, note: 'Trip started' });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'trip_started',
        entity_type: 'TripOperation', record_id: operation.id, metadata: { allocation_id },
      });
    } catch (e) {}

    return Response.json({ status: 'departed', started_at: now });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}