import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findTripOperationByAllocation, logEvent } from '../../shared/tripOperations.ts';

/**
 * Trip Operations — cancel a trip. Sets the trip status to cancelled, records
 * the cancellation reason, and logs a cancellation event. Bookings are not
 * automatically refunded; their financial outcome is determined by the
 * configured policies.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { allocation_id, reason } = body || {};
    if (!allocation_id) return Response.json({ error: 'allocation_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const operation = await findTripOperationByAllocation(admin, allocation_id);
    if (!operation) return Response.json({ error: 'Trip operation not found' }, { status: 404 });
    if (operation.trip_status === 'completed') return Response.json({ error: 'Cannot cancel a completed trip' }, { status: 400 });
    if (operation.driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver or an admin can cancel this trip' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await admin.entities.TripOperation.update(operation.id, {
      trip_status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: reason || null,
    });

    await logEvent(admin, { tripOperationId: operation.id, allocationId: allocation_id, driverUserId: operation.driver_user_id, eventType: 'cancellation', userId: user.id, note: reason || 'Trip cancelled' });

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'trip_cancelled',
        entity_type: 'TripOperation', record_id: operation.id, metadata: { allocation_id, reason: reason || null },
      });
    } catch (e) {}

    return Response.json({ status: 'cancelled', cancelled_at: now });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}