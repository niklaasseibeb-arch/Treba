import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Rating workflow — a passenger submits a rating for a completed trip.
 *
 * Validates:
 *   - the booking exists and belongs to the calling passenger,
 *   - the trip is completed (booking_status === 'completed'),
 *   - no duplicate rating exists for this booking by this passenger.
 *
 * Creates the Rating record and notifies the driver. Treba never auto-generates
 * or suggests ratings — the score and comment come solely from the passenger.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { booking_id, rating_score, comment } = body || {};
    if (!booking_id) return Response.json({ error: 'booking_id is required' }, { status: 400 });
    const score = Number(rating_score);
    if (!isFinite(score) || score < 1 || score > 5) {
      return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const booking = await admin.entities.Booking.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'You can only rate your own trips' }, { status: 403 });
    }
    if (booking.booking_status !== 'completed') {
      return Response.json({ error: 'You can rate this trip only after it is completed' }, { status: 400 });
    }

    // Prevent duplicate ratings by the same passenger for the same booking.
    const existing = await admin.entities.Rating.filter(
      { booking_id, reviewer_id: user.id },
      '-created_date',
      5
    ).catch(() => []);
    if (existing && existing.length) {
      return Response.json({ error: 'You have already rated this trip' }, { status: 400 });
    }

    const revieweeId = booking.driver_id || '';
    const rating = await admin.entities.Rating.create({
      booking_id,
      trip_id: booking.trip_id || null,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      reviewer_role: 'passenger',
      rating_score: score,
      comment: (comment || '').trim() || null,
    });

    // Notify the driver that they received a rating.
    let trip = null;
    if (booking.trip_request_id) {
      try { trip = await admin.entities.TripRequest.get(booking.trip_request_id); } catch (e) {}
    }
    const driverUserId = trip ? trip.matched_driver_user_id : null;
    if (driverUserId) {
      try {
        await sendNotification(admin, {
          user_id: driverUserId,
          event_type: NOTIFICATION_EVENTS.RATING_RECEIVED,
          title: 'New rating received',
          message: `A passenger rated your trip ${booking.origin || ''} → ${booking.destination || ''} with ${score} star${score === 1 ? '' : 's'}.`,
          related_id: booking_id,
        });
      } catch (e) {}
    }

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'rating_submitted',
        entity_type: 'Rating',
        record_id: rating.id,
        metadata: { booking_id, score, reviewee_id: revieweeId },
      });
    } catch (e) {}

    return Response.json({ status: 'submitted', rating });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}