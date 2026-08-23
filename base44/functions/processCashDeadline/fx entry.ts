import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isCashOverdue, writeAudit } from '../../shared/cashRules.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Cash Payment control — process cash bookings that have passed their check-in
 * deadline.
 *
 * For each cash-pending booking past its deadline:
 *   - mark it CASH_OVERDUE (lower priority); AND
 *   - if the active config allows seat release, release the seat (cancel the
 *     booking), count a cash no-show for the passenger, and — once the no-show
 *     threshold is reached — apply cash restriction / digital-payment
 *     requirement / account review.
 *
 * Paid bookings are never refunded or cancelled by this workflow.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const admin = base44.asServiceRole;
    const now = new Date();

    let config = { check_in_minutes_before: 15, release_seat_after_deadline: false, no_show_threshold: 3 };
    try {
      const configs = await admin.entities.CashPaymentConfig.list('-created_date', 50);
      const active = (configs || []).find((c) => c.is_active);
      if (active) config = { ...config, ...active };
    } catch (e) {}

    const allBookings = await admin.entities.Booking.list('-created_date', 1000).catch(() => []);
    const overdueCash = (allBookings || []).filter(
      (b) => b.cash_status === 'cash_pending' && isCashOverdue(b, now)
    );

    let markedOverdue = 0;
    let released = 0;
    let restrictionsApplied = 0;

    for (const b of overdueCash) {
      if (config.release_seat_after_deadline) {
        // Release the seat: cancel the booking (it is unpaid, so no refund).
        try {
          await admin.entities.Booking.update(b.id, {
            cash_status: 'cash_no_show',
            booking_status: 'cancelled',
            was_no_show: true,
            payment_state: 'failed',
            priority: 'released',
          });
        } catch (e) {}
        released++;

        // Find the linked trip request and mark it.
        let trip = null;
        try {
          const trips = await admin.entities.TripRequest.filter({ booking_id: b.id }, '-created_date', 5);
          trip = (trips || [])[0] || null;
        } catch (e) {}
        if (trip) {
          try {
            await admin.entities.TripRequest.update(trip.id, { request_status: 'cancelled', payment_status: 'failed' });
          } catch (e) {}
        }

        // Count the cash no-show and apply restrictions if needed.
        let profile = null;
        try {
          const profiles = await admin.entities.PassengerProfile.list('-created_date', 1000);
          profile = (profiles || []).find((p) => p.user_id === b.passenger_id) || null;
        } catch (e) {}
        if (profile) {
          const newCount = (Number(profile.cash_no_show_count) || 0) + 1;
          const update = { cash_no_show_count: newCount };
          const threshold = Number(config.no_show_threshold) || 3;
          if (newCount >= threshold && !(profile.cash_restricted && profile.requires_digital_payment && profile.account_review)) {
            update.cash_restricted = true;
            update.requires_digital_payment = true;
            update.account_review = true;
            restrictionsApplied++;
            try {
              await sendNotification(admin, {
                user_id: b.passenger_id,
                event_type: 'cash_restricted',
                title: 'Cash payment restricted',
                message: 'Due to repeated cash no-shows, your account is restricted from cash payment and flagged for review. Please use a digital payment method.',
                related_id: trip ? trip.id : null,
              });
            } catch (e) {}
          }
          try { await admin.entities.PassengerProfile.update(profile.id, update); } catch (e) {}
        }

        await writeAudit(admin, {
          user_id: user.id,
          user_role: user.role,
          action: 'cash_seat_released',
          entity_type: 'Booking',
          record_id: b.id,
          metadata: {
            booking_id: b.id,
            trip_request_id: trip ? trip.id : null,
            passenger_id: b.passenger_id,
            deadline: b.cash_check_in_deadline,
          },
        });
        await writeAudit(admin, {
          user_id: user.id,
          user_role: user.role,
          action: 'cash_no_show',
          entity_type: 'PassengerProfile',
          record_id: b.passenger_id,
          metadata: { booking_id: b.id, cash_no_show_count: profile ? (Number(profile.cash_no_show_count) || 0) + 1 : null },
        });
      } else {
        try {
          await admin.entities.Booking.update(b.id, { cash_status: 'cash_overdue', payment_state: 'cash_overdue', priority: 'low' });
        } catch (e) {}
        markedOverdue++;

        // Reflect overdue on the payment record too.
        try {
          const payments = await admin.entities.Payment.filter({ booking_id: b.id }, '-created_date', 5);
          const p = (payments || [])[0];
          if (p) await admin.entities.Payment.update(p.id, { cash_status: 'cash_overdue' });
        } catch (e) {}

        await writeAudit(admin, {
          user_id: user.id,
          user_role: user.role,
          action: 'cash_overdue',
          entity_type: 'Booking',
          record_id: b.id,
          metadata: { booking_id: b.id, deadline: b.cash_check_in_deadline },
        });

        try {
          await sendNotification(admin, {
            user_id: b.passenger_id,
            event_type: NOTIFICATION_EVENTS.CASH_BOOKING_OVERDUE,
            title: 'Cash payment overdue',
            message: 'Your cash payment/check-in deadline has passed. Your booking is now lower priority and your seat may be released.',
            related_id: b.id,
          });
        } catch (e) {}
      }
    }

    return Response.json({
      processed: overdueCash.length,
      marked_overdue: markedOverdue,
      seats_released: released,
      restrictions_applied: restrictionsApplied,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}