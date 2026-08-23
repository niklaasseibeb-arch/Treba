import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { writeAudit } from '../../shared/cashRules.ts';
import { releaseOverdueCashHoldsForPaidBooking } from '../../shared/seatPriority.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Passenger Payment Module — driver confirms cash was received.
 *
 * Cash is NOT equivalent to a completed digital payment. The booking only
 * becomes CONFIRMED / PAID once the driver confirms receipt of cash through
 * the app. Until then the booking stays cash_pending (or cash_overdue).
 *
 * Paid bookings are never automatically refunded or cancelled by this workflow.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id } = body || {};
    if (!trip_request_id) return Response.json({ error: 'trip_request_id is required' }, { status: 400 });

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });
    if (trip.matched_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the allocated driver can confirm cash collection' }, { status: 403 });
    }

    const payments = await admin.entities.Payment.filter({ trip_request_id }, '-created_date', 10).catch(() => []);
    const payment = (payments || []).find((p) => p.payment_status === 'pending' && p.payment_category === 'cash');
    if (!payment) return Response.json({ error: 'No pending cash payment to confirm' }, { status: 400 });

    const now = new Date().toISOString();
    await admin.entities.Payment.update(payment.id, {
      payment_status: 'successful',
      cash_status: 'cash_paid',
      confirmed_at: now,
    });
    if (trip.booking_id) {
      try {
        await admin.entities.Booking.update(trip.booking_id, {
          payment_status: 'paid',
          booking_status: 'confirmed',
          cash_status: 'cash_paid',
          payment_state: 'paid',
          priority: 'high',
          confirmed_at: now,
          fare_received: true,
          fare_received_at: now,
        });
        const paidBooking = await admin.entities.Booking.get(trip.booking_id);
        await releaseOverdueCashHoldsForPaidBooking(admin, paidBooking, user.id);
      } catch (e) {}
    }
    await admin.entities.TripRequest.update(trip_request_id, { payment_status: 'paid' });

    await writeAudit(admin, {
      user_id: user.id,
      user_role: user.role,
      action: 'cash_received_confirmed',
      entity_type: 'Payment',
      record_id: payment.id,
      metadata: {
        trip_request_id,
        booking_id: trip.booking_id || null,
        amount: payment.amount,
        passenger_id: trip.passenger_id,
      },
    });

    try {
      await sendNotification(admin, { user_id: trip.passenger_id, event_type: NOTIFICATION_EVENTS.PAYMENT_SUCCESSFUL, title: 'Cash payment confirmed', message: `Your driver confirmed cash payment of N$${Number(payment.amount).toFixed(0)}. Your booking is confirmed.`, related_id: trip_request_id });
      await sendNotification(admin, { user_id: trip.passenger_id, event_type: NOTIFICATION_EVENTS.BOOKING_CONFIRMED, title: 'Booking confirmed', message: 'Your booking is confirmed. Your driver will see you on the scheduled trip.', related_id: trip_request_id });
      if (trip.matched_driver_user_id) {
        await sendNotification(admin, { user_id: trip.matched_driver_user_id, event_type: NOTIFICATION_EVENTS.DRIVER_PAYMENT_SUCCESSFUL, title: 'Cash collected', message: `Cash payment of N$${Number(payment.amount).toFixed(0)} was confirmed. The booking is confirmed.`, related_id: trip_request_id });
      }
    } catch (e) {}

    return Response.json({ status: 'successful' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}