import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findTripOperationByAllocation, logEvent } from '../../shared/tripOperations.ts';
import { releaseEarningForBooking } from '../../shared/payoutEngine.ts';
import { incrementSubscriptionTripCount } from '../../shared/driverSubscription.ts';

/**
 * Trip Operations — the driver completes today's trip. Sets the trip status to
 * COMPLETED, marks every confirmed booking completed, and triggers the
 * downstream workflows:
 *   - Rating workflow: passengers are notified to rate their trip.
 *   - Driver earnings workflow: each booking's pending earning is released.
 *   - Payout workflow: released earnings become available for payout.
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
    if (operation.trip_status === 'completed') return Response.json({ error: 'Trip already completed' }, { status: 400 });
    if (operation.trip_status !== 'departed' && user.role !== 'admin') {
      return Response.json({ error: 'Start the trip before completing it' }, { status: 400 });
    }
    if (operation.driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver can complete this trip' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await admin.entities.TripOperation.update(operation.id, {
      trip_status: 'completed',
      completed_at: now,
    });

    const bookings = await admin.entities.Booking.filter({ trip_id: allocation_id }, '-created_date', 100).catch(() => []);
    const confirmed = (bookings || []).filter((b) => b.booking_status === 'confirmed');

    for (const b of confirmed) {
      try {
        await admin.entities.Booking.update(b.id, { booking_status: 'completed' });
        // Driver earnings workflow — release the pending earning for this booking.
        await releaseEarningForBooking(admin, b.id);
      } catch (e) {}

      // Rating workflow — invite the passenger to rate the trip.
      try {
        await admin.entities.Notification.create({
          user_id: b.passenger_id,
          notification_type: 'rate_trip',
          title: 'Rate your trip',
          message: `Your trip ${operation.route || ''} is complete. Rate your driver to help Treba.`,
          related_id: b.id,
          is_read: false,
        });
      } catch (e) {}
    }

    // Payout workflow — notify the driver that earnings are available for payout.
    try {
      await admin.entities.Notification.create({
        user_id: operation.driver_user_id,
        notification_type: 'earnings_released',
        title: 'Trip completed — earnings released',
        message: `Your earnings for ${operation.route || ''} are now available for payout.`,
        related_id: operation.id,
        is_read: false,
      });
    } catch (e) {}

    await logEvent(admin, { tripOperationId: operation.id, allocationId: allocation_id, driverUserId: operation.driver_user_id, eventType: 'trip_completion', userId: user.id, note: `Trip completed (${confirmed.length} passenger(s))` });

    // Subscription trip counter — one completed TripOperation counts as one
    // completed trip against the driver's allowance. Cancelled bookings and
    // no-shows never reach this path, so they never count. No commission is
    // applied — Treba only collects the driver subscription.
    try {
      await incrementSubscriptionTripCount(admin, operation.driver_user_id);
    } catch (e) {}

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id, user_role: user.role, action: 'trip_completed',
        entity_type: 'TripOperation', record_id: operation.id, metadata: { allocation_id, passengers: confirmed.length },
      });
    } catch (e) {}

    return Response.json({ status: 'completed', completed_at: now, passengers: confirmed.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}