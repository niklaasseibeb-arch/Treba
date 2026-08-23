import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rankMatchingAllocations } from '../../shared/demandMatchingEngine.ts';
import { getActiveMarketplaceDriverUserIds } from '../../shared/driverSubscription.ts';
import { sendNotification, NOTIFICATION_EVENTS } from '../../shared/notifications.ts';

/**
 * Passenger Demand Matching Engine entrypoint.
 *
 * Runs the matching engine for a TripRequest, assigns the request to the
 * best-fit SCHEDULED, CONFIRMED driver allocation, and sends the request to
 * that driver (status -> "matched" + driver notification). If no suitable
 * scheduled driver is found the request stays open ("requested") for retry.
 *
 * Does NOT determine, estimate or suggest any fare.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { request_id } = body || {};
    if (!request_id) {
      return Response.json({ error: 'request_id is required' }, { status: 400 });
    }

    const admin = base44.asServiceRole;
    const request = await admin.entities.TripRequest.get(request_id);
    if (!request) return Response.json({ error: 'Trip request not found' }, { status: 404 });

    // Only the passenger who owns the request (or an admin) may trigger matching.
    if (request.passenger_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If already routed to a driver and still open, keep the current match.
    const openStates = ['requested', 'matched'];
    if (request.matched_driver_id && openStates.includes(request.request_status)) {
      return Response.json({
        request,
        matched: true,
        reassigned: false,
        candidates: 1,
      });
    }

    const [allocations, drivers, vehicles] = await Promise.all([
      admin.entities.Allocation.list('-date', 500),
      admin.entities.DriverProfile.list('-created_date', 500),
      admin.entities.Vehicle.list('-created_date', 500),
    ]);
    const driversById = new Map(drivers.map((d) => [d.id, d]));
    const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
    const excludeDriverIds = Array.isArray(request.declined_driver_ids)
      ? request.declined_driver_ids
      : [];

    const ranked = rankMatchingAllocations({
      request,
      allocations,
      driversById,
      vehiclesById,
      excludeDriverIds,
    });

    if (!ranked.length) {
      const updated = await admin.entities.TripRequest.update(request_id, {
        request_status: 'requested',
        matched_allocation_id: null,
        matched_driver_id: null,
        matched_driver_name: null,
        matched_driver_user_id: null,
        matched_vehicle_id: null,
      });
      return Response.json({ request: updated, matched: false, candidates: 0 });
    }

    // Only drivers with active marketplace access may receive new passenger
    // requests. An expired-trial driver must select a paid plan first.
    const accessUserIds = await getActiveMarketplaceDriverUserIds(admin);
    const accessibleRanked = ranked.filter((r) => r.driver?.user_id && accessUserIds.has(r.driver.user_id));
    if (!accessibleRanked.length) {
      const updated = await admin.entities.TripRequest.update(request_id, {
        request_status: 'requested',
        matched_allocation_id: null,
        matched_driver_id: null,
        matched_driver_name: null,
        matched_driver_user_id: null,
        matched_vehicle_id: null,
      });
      return Response.json({ request: updated, matched: false, candidates: 0 });
    }

    const best = accessibleRanked[0];
    const updated = await admin.entities.TripRequest.update(request_id, {
      request_status: 'matched',
      matched_allocation_id: best.allocation.id,
      matched_driver_id: best.driver.id,
      matched_driver_name: best.driver.full_name || '',
      matched_driver_user_id: best.driver.user_id || '',
      matched_vehicle_id: best.vehicle.id || '',
      matched_at: new Date().toISOString(),
    });

    // Notify the passenger: request received + driver matched.
    try {
      await sendNotification(admin, {
        user_id: request.passenger_id,
        event_type: NOTIFICATION_EVENTS.TRIP_REQUEST_RECEIVED,
        title: 'Trip request received',
        message: `We received your request for ${request.origin} → ${request.destination} on ${request.requested_date} at ${request.requested_time}. We're finding a scheduled driver.`,
        related_id: request_id,
      });
      await sendNotification(admin, {
        user_id: request.passenger_id,
        event_type: NOTIFICATION_EVENTS.DRIVER_MATCHED,
        title: 'Driver matched',
        message: `Your request was matched to ${best.driver.full_name || 'a scheduled driver'}. Waiting for the driver to respond.`,
        related_id: request_id,
      });
    } catch (e) {}

    // Send the request to the driver.
    try {
      await sendNotification(admin, {
        user_id: best.driver.user_id,
        event_type: NOTIFICATION_EVENTS.PASSENGER_REQUEST,
        title: 'New passenger request',
        message: `New request: ${request.origin} → ${request.destination} on ${request.requested_date} at ${request.requested_time}. Review and accept, decline, or negotiate the fare.`,
        related_id: request_id,
      });
    } catch (e) {}

    return Response.json({
      request: updated,
      matched: true,
      candidates: ranked.length,
      driver_name: best.driver.full_name || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}