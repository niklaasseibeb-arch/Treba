import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkFareSafeguards } from '../../shared/fareSafeguards.ts';
import { computeCashDeadline } from '../../shared/cashRules.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Fare Negotiation Engine — respond to an open fare offer.
 *
 * The receiving party (the party that did NOT make the offer) may:
 *   - accept   : both parties accept the same amount -> FARE AGREED, fare locked,
 *                and a PAYMENT_PENDING record is created. Payment is not allowed
 *                before the fare is mutually agreed.
 *   - counter  : decline the current offer and make a counter offer
 *   - decline  : end the negotiation (no fare agreed)
 *
 * Treba does NOT estimate, suggest or range the fare.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id, offer_id, response, counter_amount, note } = body || {};
    if (!trip_request_id || !offer_id || !response) {
      return Response.json({ error: 'trip_request_id, offer_id and response are required' }, { status: 400 });
    }
    if (!['accept', 'counter', 'decline'].includes(response)) {
      return Response.json({ error: 'Invalid response' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });

    const offer = await admin.entities.FareOffer.get(offer_id);
    if (!offer || offer.trip_request_id !== trip_request_id) {
      return Response.json({ error: 'Offer not found' }, { status: 404 });
    }
    if (offer.offer_status !== 'open') {
      return Response.json({ error: 'This offer is no longer open' }, { status: 400 });
    }

    let responder = null;
    if (trip.passenger_id === user.id) responder = 'passenger';
    else if (trip.matched_driver_user_id === user.id) responder = 'driver';
    else if (user.role === 'admin') responder = 'passenger';
    if (!responder) {
      return Response.json({ error: 'You are not part of this negotiation' }, { status: 403 });
    }
    if (offer.offered_by === responder) {
      return Response.json({ error: 'You cannot respond to your own offer' }, { status: 400 });
    }

    const now = new Date().toISOString();
    let tripUpdate = {};
    let notifyTitle = '';
    let notifyMessage = '';
    const otherUserId = responder === 'passenger' ? trip.matched_driver_user_id : trip.passenger_id;

    if (response === 'accept') {
      await admin.entities.FareOffer.update(offer_id, {
        offer_status: 'accepted',
        response: 'accept',
        response_by: responder,
        response_by_user_id: user.id,
        response_at: now,
      });

      // Direct passenger-to-driver payment model: the fare is agreed between
      // passenger and driver, and the passenger pays the driver DIRECTLY. Treba
      // does NOT collect, process, hold, transfer or refund the fare, and does
      // NOT charge commission. Treba only records the agreed fare, the payment
      // arrangement, the booking, the trip, the driver and the passenger. The
      // driver may optionally confirm "fare received" (operational record only).
      const isCash = trip.payment_method === 'cash';
      const paymentArrangement = isCash
        ? 'Cash to driver'
        : 'Direct to driver (arranged between passenger and driver)';

      let cashDeadline = null;
      if (isCash) {
        let minutesBefore = 15;
        try {
          const configs = await admin.entities.CashPaymentConfig.list('-created_date', 50);
          const active = (configs || []).find((c) => c.is_active);
          if (active && Number(active.check_in_minutes_before) >= 0) minutesBefore = Number(active.check_in_minutes_before);
        } catch (e) {}
        cashDeadline = computeCashDeadline(trip.requested_date, trip.requested_time, minutesBefore);
      }

      notifyTitle = 'Fare agreed — booking confirmed';
      notifyMessage = isCash
        ? `Fare agreed at N$${Number(offer.amount).toFixed(0)}. Your booking is confirmed — pay your driver in cash directly. Your driver will confirm receipt. Treba does not process payments.`
        : `Fare agreed at N$${Number(offer.amount).toFixed(0)}. Your booking is confirmed — pay your driver directly using the arrangement you agreed. Treba does not process payments.`;

      let bookingId = null;
      try {
        const luggageSummary = [
          trip.luggage_small_bags ? `${trip.luggage_small_bags} small` : null,
          trip.luggage_standard_bags ? `${trip.luggage_standard_bags} standard` : null,
          trip.luggage_large_suitcases ? `${trip.luggage_large_suitcases} large` : null,
          trip.luggage_oversized_items ? `${trip.luggage_oversized_items} oversized` : null,
        ].filter(Boolean).join(', ') || (trip.luggage_details || 'No luggage');

        const bookingFields = {
          passenger_id: trip.passenger_id,
          passenger_name: trip.passenger_name || null,
          trip_id: trip.matched_allocation_id || trip_request_id,
          trip_request_id,
          driver_id: trip.matched_driver_id || null,
          route_id: trip.route_id || null,
          origin: trip.origin || null,
          destination: trip.destination || null,
          pickup_location: trip.pickup_location || null,
          dropoff_location: trip.dropoff_location || null,
          luggage_summary: luggageSummary,
          number_of_seats: trip.number_of_seats || 1,
          fare_amount: offer.amount,
          booking_status: 'confirmed',
          confirmed_at: now,
          payment_arrangement: paymentArrangement,
        };
        if (isCash) {
          bookingFields.payment_method = 'cash_to_driver';
          bookingFields.payment_status = 'pending';
          bookingFields.payment_state = 'cash_pending';
          bookingFields.cash_status = 'cash_pending';
          bookingFields.priority = 'medium';
          bookingFields.cash_check_in_deadline = cashDeadline;
        } else {
          bookingFields.payment_method = null;
          bookingFields.payment_status = 'paid';
          bookingFields.payment_state = 'paid';
          bookingFields.priority = 'high';
        }
        const booking = await admin.entities.Booking.create(bookingFields);
        bookingId = booking.id;
      } catch (e) {}

      // Cash arrangement: record an operational cash-pending log so the driver
      // can confirm receipt. This is an operational record only — Treba does not
      // process, hold or transfer the cash.
      if (isCash && bookingId) {
        try {
          await admin.entities.Payment.create({
            booking_id: bookingId,
            passenger_id: trip.passenger_id,
            driver_id: trip.matched_driver_id || null,
            trip_request_id,
            agreed_fare: offer.amount,
            agreed_fare_currency: offer.currency || 'NAD',
            amount: offer.amount,
            payment_method: 'cash_to_driver',
            payment_category: 'cash',
            payment_reference: `TRB-CASH-${Date.now().toString(36)}`,
            payment_status: 'pending',
            transaction_date: now,
            cash_status: 'cash_pending',
            cash_check_in_deadline: cashDeadline,
          });
        } catch (e) {}
      }

      tripUpdate = {
        negotiation_state: 'fare_agreed',
        agreed_fare: offer.amount,
        agreed_fare_currency: offer.currency || 'NAD',
        agreed_at: now,
        negotiated_fare: offer.amount,
        request_status: 'booked',
        payment_status: isCash ? 'pending' : 'paid',
        booking_id: bookingId,
      };
    } else if (response === 'counter') {
      const counter = Number(counter_amount);
      if (!isFinite(counter) || counter <= 0) {
        return Response.json({ error: 'Enter a valid counter amount' }, { status: 400 });
      }
      const safeguardError = await checkFareSafeguards(admin, counter);
      if (safeguardError) return Response.json({ error: safeguardError }, { status: 400 });

      await admin.entities.FareOffer.update(offer_id, {
        offer_status: 'countered',
        response: 'counter',
        response_by: responder,
        response_by_user_id: user.id,
        response_at: now,
      });

      await admin.entities.FareOffer.create({
        trip_request_id,
        passenger_id: trip.passenger_id,
        driver_id: trip.matched_driver_id || null,
        driver_user_id: trip.matched_driver_user_id || null,
        amount: counter,
        currency: offer.currency || 'NAD',
        offered_by: responder,
        offered_by_user_id: user.id,
        offer_status: 'open',
        previous_offer_id: offer_id,
        note: note || null,
      });

      tripUpdate = { negotiation_state: 'counter_offer', negotiated_fare: null };
      notifyTitle = 'Counter offer made';
      notifyMessage = `${responder === 'passenger' ? 'The passenger' : 'The driver'} countered with N$${counter.toFixed(0)}. Accept, counter, or decline.`;
    } else {
      await admin.entities.FareOffer.update(offer_id, {
        offer_status: 'declined',
        response: 'decline',
        response_by: responder,
        response_by_user_id: user.id,
        response_at: now,
      });
      tripUpdate = { negotiation_state: 'declined', request_status: 'cancelled' };
      notifyTitle = 'Fare negotiation declined';
      notifyMessage = `${responder === 'passenger' ? 'The passenger' : 'The driver'} declined the fare negotiation. No fare was agreed.`;
    }

    await admin.entities.TripRequest.update(trip_request_id, tripUpdate);

    try {
      if (response === 'accept') {
        const isCashAccept = trip.payment_method === 'cash';
        const fareEvent = responder === 'passenger' ? NOTIFICATION_EVENTS.DRIVER_FARE_AGREED : NOTIFICATION_EVENTS.FARE_AGREED;
        await sendNotification(admin, { user_id: otherUserId, event_type: fareEvent, title: notifyTitle, message: notifyMessage, related_id: trip_request_id });
        await sendNotification(admin, { user_id: trip.passenger_id, event_type: NOTIFICATION_EVENTS.BOOKING_CONFIRMED, title: 'Booking confirmed', message: notifyMessage, related_id: trip_request_id });
        if (isCashAccept && trip.matched_driver_user_id) {
          await sendNotification(admin, { user_id: trip.matched_driver_user_id, event_type: NOTIFICATION_EVENTS.CASH_PASSENGER_PENDING, title: 'Cash passenger pending', message: `A cash booking (N$${Number(offer.amount).toFixed(0)}) is awaiting your confirmation of cash collection. The passenger pays you directly.`, related_id: trip_request_id });
        } else if (trip.matched_driver_user_id) {
          await sendNotification(admin, { user_id: trip.matched_driver_user_id, event_type: NOTIFICATION_EVENTS.DRIVER_FARE_AGREED, title: 'Fare agreed — collect directly', message: `Fare agreed at N$${Number(offer.amount).toFixed(0)}. Collect payment directly from the passenger. Mark "fare received" once paid. Treba does not process payments.`, related_id: trip_request_id });
        }
      } else if (response === 'counter') {
        const ev = responder === 'passenger' ? NOTIFICATION_EVENTS.PASSENGER_COUNTER_OFFER : NOTIFICATION_EVENTS.COUNTER_OFFER_RECEIVED;
        await sendNotification(admin, { user_id: otherUserId, event_type: ev, title: notifyTitle, message: notifyMessage, related_id: trip_request_id });
      } else {
        await sendNotification(admin, { user_id: otherUserId, event_type: 'fare_negotiation_declined', title: notifyTitle, message: notifyMessage, related_id: trip_request_id });
      }
    } catch (e) {}

    return Response.json({ ok: true, negotiation_state: tripUpdate.negotiation_state });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}