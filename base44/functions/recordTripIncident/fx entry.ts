import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findTripOperationByAllocation, logEvent } from '../../shared/tripOperations.ts';

/**
 * Trip Operations — record an incident during a trip (free-text note). The trip
 * status is not changed; the incident is logged to the operational event
 * timeline and the audit log for review.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { allocation_id, note } = body || {};
    if (!allocation_id) return Response.json({ error: 'allocation_id is required' }, { status: 400 });
    if (!note) return Response.json({ error: 'note is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const operation = await findTripOperationByAllocation(admin, allocation_id);
    if (!operation) return Response.json({ error: 'Trip operation not found' }, { status: 404 });
    if (operation.driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver or an admin can record an incident' }, { status: 403 });
    }

    await admin.entities.TripOperation.update(operation.id, { incident_notes: note });

    await logEvent(admin, { tripOperationId: operation.id, allocationId: allocation_id, driverUserId: operation.driver_user_id, eventType: 'incident', userId: user.id, note });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'trip_incident_recorded',
        entity_type: 'TripOperation', record_id: operation.id, metadata: { allocation_id },
      });
    } catch (e) {}

    return Response.json({ status: 'incident_recorded' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}