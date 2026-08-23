import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Booking cancellation.
 *
 * Paid, confirmed bookings (payment_status === 'paid') are PROTECTED from
 * casual cancellation. A paid booking represents a committed seat and a
 * completed (digital) or driver-confirmed (cash) payment — it cannot be
 * cancelled with a single click. Disputes and refunds for paid bookings are
 * handled through the formal no-show / admin review process, not here.
 *
 * Only pending bookings (not yet paid) may be cancelled by the passenger.
 * Cancelling a pending booking releases the held seat back to the allocation.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const bookingId = body.booking_id;
    if (!bookingId) return Response.json({ error: 'Invalid request' }, { status: 400 });

    const admin = base44.asServiceRole;
    const booking = await admin.entities.Booking.get(bookingId);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'You can only cancel your own bookings' }, { status: 403 });
    }
    if (booking.booking_status === 'cancelled') {
      return Response.json({ booking });
    }

    // Protect paid/confirmed bookings from casual cancellation.
    if (booking.payment_status === 'paid' && booking.booking_status === 'confirmed') {
      return Response.json({
        error: 'This booking is paid and confirmed. Paid bookings cannot be casually cancelled. If you have an issue, please contact Treba support or report a no-show.',
      }, { status: 400 });
    }

    await admin.entities.Booking.update(bookingId, {
      booking_status: 'cancelled',
    });

    // Release the seat back to the allocation (booking.trip_id is the
    // matched allocation id in the demand-driven flow).
    if (booking.trip_id) {
      try {
        const alloc = await admin.entities.Allocation.get(booking.trip_id);
        if (alloc && (alloc.status === 'confirmed' || alloc.status === 'awaiting_confirmation')) {
          await admin.entities.Allocation.update(booking.trip_id, {
            available_seats: (alloc.available_seats ?? 0) + (booking.number_of_seats || 0),
          });
        }
      } catch (e) {}
    }

    try {
      await admin.entities.AuditLog.create({
        user_id: user.id,
        user_role: user.role,
        action: 'booking_cancelled',
        entity_type: 'Booking',
        record_id: bookingId,
        metadata: { trip_request_id: booking.trip_request_id || null, seats: booking.number_of_seats || 0 },
      });
    } catch (e) {}

    try {
      await sendNotification(admin, {
        user_id: booking.passenger_id,
        event_type: NOTIFICATION_EVENTS.BOOKING_CANCELLED,
        title: 'Booking cancelled',
        message: 'Your pending booking was cancelled and your seat released.',
        related_id: bookingId,
      });
    } catch (e) {}

    return Response.json({ booking: { ...booking, booking_status: 'cancelled' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}