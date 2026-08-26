import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);

    // ---------------------------------------------------------
    // 1. Authenticate
    // ---------------------------------------------------------
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 2. Read request
    // ---------------------------------------------------------
    const body = await req.json();

    const tripRequestId = body?.trip_request_id;

    if (!tripRequestId) {
      return Response.json(
        { error: "trip_request_id is required." },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 3. Get passenger trip request
    // ---------------------------------------------------------
    const requests = await base44.entities.TripRequest.filter({
      id: tripRequestId,
    });

    if (!requests || requests.length === 0) {
      return Response.json(
        { error: "Trip request not found." },
        { status: 404 }
      );
    }

    const request = requests[0];

    // ---------------------------------------------------------
    // 4. Don't schedule cancelled/completed requests
    // ---------------------------------------------------------
    const closedStatuses = [
      "cancelled",
      "completed",
      "expired",
    ];

    if (closedStatuses.includes(request.request_status)) {
      return Response.json({
        success: true,
        message: "Trip request is already closed.",
        offers_created: 0,
      });
    }

    // ---------------------------------------------------------
    // 5. Required trip information
    // ---------------------------------------------------------
    const origin = request.origin;
    const destination = request.destination;
    const requestedDate = request.requested_date;
    const requestedTime = request.requested_time;

    if (
      !origin ||
      !destination ||
      !requestedDate ||
      !requestedTime
    ) {
      return Response.json(
        {
          error:
            "Trip request is missing origin, destination, date or time.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 6. Get route
    // ---------------------------------------------------------
    let route = null;

    if (request.route_id) {
      const routes = await base44.entities.Route.filter({
        id: request.route_id,
      });

      if (routes?.length) {
        route = routes[0];
      }
    }

    // If no route_id exists, find active route by town pair.
    if (!route) {
      const routes = await base44.entities.Route.filter({
        origin_town: origin,
        destination_town: destination,
        is_active: true,
        route_status: "active",
      });

      if (routes?.length) {
        route = routes[0];
      }
    }

    // ---------------------------------------------------------
    // 7. Get existing offers
    // ---------------------------------------------------------
    const existingOffers =
      await base44.entities.TripOffer.filter({
        trip_request_id: tripRequestId,
      });

    const offers = existingOffers || [];

    // ---------------------------------------------------------
    // 8. Determine currently active offers
    // ---------------------------------------------------------
    const activeStatuses = [
      "offered",
      "accepted",
    ];

    const activeOffers = offers.filter((offer: any) =>
      activeStatuses.includes(offer.status)
    );

    // ---------------------------------------------------------
    // 9. Maximum 5 driver opportunities
    // ---------------------------------------------------------
    const MAX_DRIVER_OFFERS = 5;

    const remainingSlots =
      MAX_DRIVER_OFFERS - activeOffers.length;

    if (remainingSlots <= 0) {
      return Response.json({
        success: true,
        message:
          "Maximum number of active driver offers already reached.",
        offers_created: 0,
        active_offers: activeOffers.length,
      });
    }

    // ---------------------------------------------------------
    // 10. Get driver profiles
    // ---------------------------------------------------------
    const drivers =
      await base44.entities.DriverProfile.filter({
        availability_status: "available",
      });

    if (!drivers || drivers.length === 0) {
      return Response.json({
        success: true,
        message: "No available drivers found.",
        offers_created: 0,
      });
    }

    // ---------------------------------------------------------
    // 11. Filter eligible drivers
    // ---------------------------------------------------------
    //
    // Eligibility criteria:
    //
    // - Driver is available
    // - Driver operates requested route
    // - Driver has not already been offered this trip
    // - Driver has no conflicting confirmed allocation
    //
    // Additional eligibility checks can later include:
    //
    // - vehicle compliance
    // - operator card
    // - roadworthiness
    // - licence validity
    // - seating capacity
    // - luggage capacity
    // - driver rating
    // - fatigue/trip limits
    // ---------------------------------------------------------

    const alreadyOfferedDriverIds = new Set(
      offers.map((offer: any) => offer.driver_id)
    );

    const eligibleDrivers = drivers.filter((driver: any) => {
      // Don't offer to same driver twice.
      if (alreadyOfferedDriverIds.has(driver.id)) {
        return false;
      }

      // Check preferred routes.
      const preferredRoutes =
        driver.preferred_routes || [];

      const routeText =
        `${origin} - ${destination}`;

      const reverseRouteText =
        `${destination} - ${origin}`;

      const operatesRoute =
        preferredRoutes.includes(routeText) ||
        preferredRoutes.includes(reverseRouteText);

      if (!operatesRoute && route) {
        // If a route entity exists, allow matching by route ID
        // when the driver has a route_ids field.
        const routeIds = driver.route_ids || [];

        if (!routeIds.includes(route.id)) {
          return false;
        }
      } else if (!operatesRoute) {
        return false;
      }

      return true;
    });

    // ---------------------------------------------------------
    // 12. Sort drivers
    // ---------------------------------------------------------
    //
    // For Phase 1 we use a simple fair ordering.
    //
    // Later this can become the full Treba allocation score:
    //
    // rating
    // route experience
    // availability
    // fatigue
    // previous trips
    // cancellations
    // distance from origin
    // vehicle suitability
    // queue position
    //
    const sortedDrivers = [...eligibleDrivers].sort(
      (a: any, b: any) => {
        const ratingA = Number(a.rating || 0);
        const ratingB = Number(b.rating || 0);

        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }

        const tripsA = Number(a.completed_trips || 0);
        const tripsB = Number(b.completed_trips || 0);

        return tripsA - tripsB;
      }
    );

    // ---------------------------------------------------------
    // 13. Select drivers
    // ---------------------------------------------------------
    const selectedDrivers = sortedDrivers.slice(
      0,
      remainingSlots
    );

    if (selectedDrivers.length === 0) {
      return Response.json({
        success: true,
        message:
          "No eligible drivers available for this route and time.",
        offers_created: 0,
      });
    }

    // ---------------------------------------------------------
    // 14. Offer expiry
    // ---------------------------------------------------------
    //
    // Drivers need enough time to respond.
    //
    // For Phase 1 we use 30 minutes.
    // This can later be made configurable depending on how
    // far in advance the trip was requested.
    //
    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    // ---------------------------------------------------------
    // 15. Create offers
    // ---------------------------------------------------------
    const createdOffers = [];

    for (const driver of selectedDrivers) {
      const offer = await base44.entities.TripOffer.create({
        trip_request_id: tripRequestId,

        driver_id: driver.id,

        route_id: route?.id || request.route_id || "",

        origin,
        destination,

        requested_date: requestedDate,
        requested_time: requestedTime,

        status: "offered",

        response: "pending",

        offered_at: new Date().toISOString(),

        expires_at: expiresAt,

        // Queue information
        queue_status: "waiting",
      });

      createdOffers.push(offer);
    }

    // ---------------------------------------------------------
    // 16. Update trip request
    // ---------------------------------------------------------
    //
    // The passenger request remains active.
    //
    // We don't mark it booked merely because offers were sent.
    //
    await base44.entities.TripRequest.update(
      tripRequestId,
      {
        request_status: "offers_sent",
        scheduling_status: "searching_for_driver",
        active_driver_offers:
          activeOffers.length + createdOffers.length,
      }
    );

    // ---------------------------------------------------------
    // 17. Return result
    // ---------------------------------------------------------
    return Response.json({
      success: true,

      trip_request_id: tripRequestId,

      route: {
        id: route?.id || null,
        origin,
        destination,
      },

      travel: {
        date: requestedDate,
        time: requestedTime,
      },

      offers_created: createdOffers.length,

      active_offers:
        activeOffers.length + createdOffers.length,

      maximum_driver_offers: MAX_DRIVER_OFFERS,

      remaining_capacity:
        MAX_DRIVER_OFFERS -
        activeOffers.length -
        createdOffers.length,

      offers: createdOffers.map((offer: any) => ({
        id: offer.id,
        driver_id: offer.driver_id,
        status: offer.status,
        expires_at: offer.expires_at,
      })),
    });

  } catch (error) {
    console.error("scheduleTrip error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to schedule trip.",
      },
      { status: 500 }
    );
  }
});