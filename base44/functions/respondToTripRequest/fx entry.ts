import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rankMatchingAllocations } from '../../shared/demandMatchingEngine.ts';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Driver response to a matched passenger trip request.
 *
 *   - accept  : driver accepts the TRIP and opens FARE NEGOTIATION
 *               (negotiation_state -> negotiation_open). The driver is NOT
 *               accepting a fixed fare; the fare is negotiated separately.
 *   - decline : driver declines the trip -> re-match to the next best scheduled
 *               driver, or return the request to the open pool.
 *
 * Fare offers and responses are handled by the Fare Negotiation Engine
 * (submitFareOffer / respondToFareOffer), not here.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { request_id, action } = body || {};
    if (!request_id || !action) {
      return Response.json({ error: 'request_id and action are required' }, { status: 400 });
    }
    if (!['accept', 'decline'].includes(action)) {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const trip = await admin.entities.TripRequest.get(request_id);
    if (!trip) return Response.json({ error: 'Trip request not found' }, { status: 404 });

    if (trip.matched_driver_user_id && trip.matched_driver_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'This request is not assigned to you' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const updateFields = {};
    let notifyTitle = '';
    let notifyMessage = '';
    let rematch = false;

    if (action === 'accept') {
      updateFields.request_status = 'driver_accepted';
      updateFields.driver_action = 'accepted';
      updateFields.negotiation_state = 'negotiation_open';
      notifyTitle = 'Driver accepted your request';
      notifyMessage = `${trip.matched_driver_name || 'Your allocated driver'} accepted your trip request. Negotiate and agree your fare — Treba does not set the fare.`;
    } else {
      const declined = Array.from(
        new Set(
          [
            ...(Array.isArray(trip.declined_driver_ids) ? trip.declined_driver_ids : []),
            trip.matched_driver_id,
          ].filter(Boolean)
        )
      );
      updateFields.declined_driver_ids = declined;

      const [allocations, drivers, vehicles] = await Promise.all([
        admin.entities.Allocation.list('-date', 500),
        admin.entities.DriverProfile.list('-created_date', 500),
        admin.entities.Vehicle.list('-created_date', 500),
      ]);
      const driversById = new Map(drivers.map((d) => [d.id, d]));
      const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
      // A re-match is a NEW passenger request for the next driver — only
      // drivers with active marketplace access may receive it.
      const rankedRaw = rankMatchingAllocations({
        request: trip,
        allocations,
        driversById,
        vehiclesById,
        excludeDriverIds: declined,
      });
      const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
      const ranked = rankedRaw.filter((r) => r.driver?.user_id && accessUserIds.has(r.driver.user_id));

      if (ranked.length) {
        const best = ranked[0];
        rematch = true;
        updateFields.request_status = 'matched';
        updateFields.driver_action = '';
        updateFields.negotiation_state = 'not_started';
        updateFields.matched_allocation_id = best.allocation.id;
        updateFields.matched_driver_id = best.driver.id;
        updateFields.matched_driver_name = best.driver.full_name || '';
        updateFields.matched_driver_user_id = best.driver.user_id || '';
        updateFields.matched_vehicle_id = best.vehicle.id || '';
        updateFields.matched_at = now;
        notifyTitle = 'Your driver changed — request sent to another driver';
        notifyMessage = 'Your previous driver was unavailable. Treba has sent your request to another scheduled driver.';
        try {
          await sendNotification(admin, {
            user_id: best.driver.user_id,
            event_type: NOTIFICATION_EVENTS.PASSENGER_REQUEST,
            title: 'New passenger request',
            message: `New request: ${trip.origin} → ${trip.destination} on ${trip.requested_date} at ${trip.requested_time}. Review and accept, decline, or negotiate the fare.`,
            related_id: request_id,
          });
        } catch (e) {}
      } else {
        updateFields.request_status = 'requested';
        updateFields.driver_action = '';
        updateFields.negotiation_state = 'not_started';
        updateFields.matched_allocation_id = null;
        updateFields.matched_driver_id = null;
        updateFields.matched_driver_name = null;
        updateFields.matched_driver_user_id = null;
        updateFields.matched_vehicle_id = null;
        notifyTitle = 'Driver declined your trip request';
        notifyMessage = 'The driver was unable to accept your request. Treba is still looking for a scheduled driver for your trip.';
      }
    }

    const updated = await admin.entities.TripRequest.update(request_id, updateFields);

    if (trip.passenger_id) {
      try {
        await sendNotification(admin, {
          user_id: trip.passenger_id,
          event_type: NOTIFICATION_EVENTS.DRIVER_RESPONDED,
          title: notifyTitle,
          message: notifyMessage,
          related_id: request_id,
        });
      } catch (e) {}
    }

    return Response.json({ request: updated, rematch });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}