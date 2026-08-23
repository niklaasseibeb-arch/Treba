import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findTripOperationByAllocation, logEvent } from '../../shared/tripOperations.ts';

/**
 * Trip Operations — an administrator overrides the mandatory operational
 * conditions and starts the trip on the driver's behalf. Records the override
 * author and reason, sets the admin_override flag, and departs the trip.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { allocation_id, reason } = body || {};
    if (!allocation_id) return Response.json({ error: 'allocation_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const operation = await findTripOperationByAllocation(admin, allocation_id);
    if (!operation) return Response.json({ error: 'Trip operation not found' }, { status: 404 });
    if (operation.trip_status !== 'scheduled') return Response.json({ error: `Trip is already ${operation.trip_status}` }, { status: 400 });

    const now = new Date().toISOString();
    await admin.entities.TripOperation.update(operation.id, {
      admin_override: true,
      override_by: user.id,
      override_reason: reason || 'Admin override',
      trip_status: 'departed',
      started_at: now,
    });

    await logEvent(admin, { tripOperationId: operation.id, allocationId: allocation_id, driverUserId: operation.driver_user_id, eventType: 'trip_start', userId: user.id, note: `Admin override start: ${reason || 'no reason given'}` });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'trip_start_admin_override',
        entity_type: 'TripOperation', record_id: operation.id, metadata: { allocation_id, reason: reason || null },
      });
    } catch (e) {}

    return Response.json({ status: 'departed', started_at: now });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}