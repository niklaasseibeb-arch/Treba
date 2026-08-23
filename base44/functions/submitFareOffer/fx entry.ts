import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkFareSafeguards } from '../../shared/fareSafeguards.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Fare Negotiation Engine — make an opening fare offer.
 *
 * Either the passenger or the matched driver may make the first offer once the
 * negotiation is open (after the driver accepts the request). Treba does NOT
 * estimate, suggest or range the fare — the amount is entirely the user's.
 *
 * Records: amount, currency, user, timestamp, offer status, previous offer.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trip_request_id, amount, currency, note } = body || {};
    if (!trip_request_id || amount == null) {
      return Response.json({ error: 'trip_request_id and amount are required' }, { status: 400 });
    }
    const fare = Number(amount);
    if (!isFinite(fare) || fare <= 0) {
      return Response.json({ error: 'Enter a valid fare amount' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(trip_request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });

    let offeredBy = null;
    if (trip.passenger_id === user.id) offeredBy = 'passenger';
    else if (trip.matched_driver_user_id === user.id) offeredBy = 'driver';
    if (!offeredBy) {
      return Response.json({ error: 'You are not part of this negotiation' }, { status: 403 });
    }

    const allowedStates = ['negotiation_open', 'offer_made', 'counter_offer'];
    if (!allowedStates.includes(trip.negotiation_state)) {
      return Response.json({ error: 'Fare negotiation is not open for a new offer' }, { status: 400 });
    }

    const existing = await admin.entities.FareOffer.filter({ trip_request_id }, '-created_date', 100);
    const openOffer = (existing || []).find((o) => o.offer_status === 'open');
    if (openOffer) {
      return Response.json({ error: 'There is already an open offer awaiting a response' }, { status: 400 });
    }

    const safeguardError = await checkFareSafeguards(admin, fare);
    if (safeguardError) return Response.json({ error: safeguardError }, { status: 400 });

    const previous = (existing || [])[0] || null;
    const newState = trip.negotiation_state === 'negotiation_open' ? 'offer_made' : 'counter_offer';

    const offer = await admin.entities.FareOffer.create({
      trip_request_id,
      passenger_id: trip.passenger_id,
      driver_id: trip.matched_driver_id || null,
      driver_user_id: trip.matched_driver_user_id || null,
      amount: fare,
      currency: currency || 'NAD',
      offered_by: offeredBy,
      offered_by_user_id: user.id,
      offer_status: 'open',
      previous_offer_id: previous ? previous.id : null,
      note: note || null,
    });

    await admin.entities.TripRequest.update(trip_request_id, {
      negotiation_state: newState,
      negotiated_fare: null,
    });

    const otherUserId = offeredBy === 'passenger' ? trip.matched_driver_user_id : trip.passenger_id;
    try {
      const event_type = newState === 'counter_offer' && offeredBy === 'passenger'
        ? NOTIFICATION_EVENTS.PASSENGER_COUNTER_OFFER
        : (newState === 'counter_offer' ? NOTIFICATION_EVENTS.COUNTER_OFFER_RECEIVED : NOTIFICATION_EVENTS.FARE_OFFER_RECEIVED);
      await sendNotification(admin, {
        user_id: otherUserId,
        event_type,
        title: 'New fare offer',
        message: `${offeredBy === 'passenger' ? 'The passenger' : 'The driver'} made a fare offer of N$${fare.toFixed(0)}. Accept, counter, or decline.`,
        related_id: trip_request_id,
      });
    } catch (e) {}

    return Response.json({ offer, negotiation_state: newState });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}