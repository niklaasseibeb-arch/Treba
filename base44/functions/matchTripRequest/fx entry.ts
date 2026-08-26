import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

import {
  rankMatchingAllocations
} from "../../shared/demandMatchingEngine.ts";

import {
  getActiveMarketplaceDriverUserIds
} from "../../shared/driverSubscription.ts";

import {
  sendNotification,
  NOTIFICATION_EVENTS
} from "../../shared/notifications.ts";

/**
 * Treba passenger demand matching.
 *
 * Passenger submits TripRequest.
 *
 * Treba finds an existing CONFIRMED
 * Allocation that fits the request.
 *
 * Treba does NOT calculate or suggest fare.
 *
 * Fare negotiation happens separately
 * through FareOffer.
 */

export default async function (
  req
) {
  try {
    const base44 =
      createClientFromRequest(req);

    const user =
      await base44.auth.me();

    if (!user) {
      return Response.json(
        {
          error:
            "Unauthorized"
        },
        { status: 401 }
      );
    }

    const body =
      await req.json().catch(
        () => ({})
      );

    const {
      request_id
    } = body || {};

    if (!request_id) {
      return Response.json(
        {
          error:
            "request_id is required"
        },
        { status: 400 }
      );
    }

    const admin =
      base44.asServiceRole;

    /*
     * Load request.
     */
    const request =
      await admin.entities.TripRequest.get(
        request_id
      );

    if (!request) {
      return Response.json(
        {
          error:
            "Trip request not found"
        },
        { status: 404 }
      );
    }

    /*
     * Only owner or admin may trigger matching.
     */
    if (
      request.passenger_id !==
        user.id &&
      user.role !== "admin"
    ) {
      return Response.json(
        {
          error:
            "Forbidden"
        },
        { status: 403 }
      );
    }

    /*
     * If already matched and still open,
     * don't replace the match unnecessarily.
     */
    if (
      request.matched_allocation_id &&
      [
        "matched",
        "offers_sent",
        "driver_selected"
      ].includes(
        request.request_status
      )
    ) {
      return Response.json(
        {
          request,
          matched: true,
          reassigned: false,
          candidates: 1
        }
      );
    }

    /*
     * Mark matching started.
     */
    await admin.entities.TripRequest.update(
      request_id,
      {
        request_status:
          "matching",

        matching_started_at:
          new Date().toISOString()
      }
    );

    /*
     * Load allocations, drivers and vehicles.
     */
    const [
      allocations,
      drivers,
      vehicles
    ] = await Promise.all([
      admin.entities.Allocation.list(
        "-date",
        1000
      ),

      admin.entities.DriverProfile.list(
        "-created_date",
        500
      ),

      admin.entities.Vehicle.list(
        "-created_date",
        500
      )
    ]);

    const driversById =
      new Map(
        drivers.map(
          (driver) => [
            driver.id,
            driver
          ]
        )
      );

    const vehiclesById =
      new Map(
        vehicles.map(
          (vehicle) => [
            vehicle.id,
            vehicle
          ]
        )
      );

    const excludeDriverIds =
      Array.isArray(
        request.declined_driver_ids
      )
        ? request.declined_driver_ids
        : [];

    /*
     * Rank matching confirmed allocations.
     */
    const ranked =
      rankMatchingAllocations({
        request,
        allocations,
        driversById,
        vehiclesById,
        excludeDriverIds
      });

    if (!ranked.length) {
      const updated =
        await admin.entities.TripRequest.update(
          request_id,
          {
            request_status:
              "no_driver",

            matched_allocation_id:
              null,

            matched_driver_id:
              null,

            matched_driver_name:
              null,

            matched_driver_user_id:
              null,

            matched_vehicle_id:
              null,

            matching_completed_at:
              new Date().toISOString()
          }
        );

      return Response.json(
        {
          request: updated,
          matched: false,
          candidates: 0,
          message:
            "No suitable confirmed driver is currently available."
        }
      );
    }

    /*
     * Marketplace subscription check.
     */
    const accessUserIds =
      await getActiveMarketplaceDriverUserIds(
        admin
      );

    const accessibleRanked =
      ranked.filter(
        (candidate) =>
          candidate.driver?.user_id &&
          accessUserIds.has(
            candidate.driver.user_id
          )
      );

    if (
      !accessibleRanked.length
    ) {
      const updated =
        await admin.entities.TripRequest.update(
          request_id,
          {
            request_status:
              "no_driver",

            matched_allocation_id:
              null,

            matched_driver_id:
              null,

            matched_driver_name:
              null,

            matched_driver_user_id:
              null,

            matched_vehicle_id:
              null,

            matching_completed_at:
              new Date().toISOString()
          }
        );

      return Response.json(
        {
          request: updated,
          matched: false,
          candidates: 0,
          message:
            "No suitable driver with active marketplace access is available."
        }
      );
    }

    /*
     * Best allocation.
     */
    const best =
      accessibleRanked[0];

    /*
     * Update TripRequest.
     */
    const updated =
      await admin.entities.TripRequest.update(
        request_id,
        {
          request_status:
            "matched",

          matched_allocation_id:
            best.allocation.id,

          matched_driver_id:
            best.driver.id,

          matched_driver_name:
            best.driver.full_name ||
            "",

          matched_driver_user_id:
            best.driver.user_id ||
            "",

          matched_vehicle_id:
            best.vehicle.id ||
            "",

          matching_completed_at:
            new Date().toISOString()
        }
      );

    /*
     * Notify passenger.
     */
    try {
      await sendNotification(
        admin,
        {
          user_id:
            request.passenger_id,

          event_type:
            NOTIFICATION_EVENTS
              .TRIP_REQUEST_RECEIVED,

          title:
            "Trip request received",

          message:
            `Your request for ${request.origin} → ${request.destination} on ${request.requested_date} at ${request.requested_time} has been received.`,

          related_id:
            request_id
        }
      );

      await sendNotification(
        admin,
        {
          user_id:
            request.passenger_id,

          event_type:
            NOTIFICATION_EVENTS
              .DRIVER_MATCHED,

          title:
            "Driver matched",

          message:
            `Your trip has been matched to ${best.driver.full_name || "a scheduled driver"}. Fare negotiation can now take place.`,

          related_id:
            request_id
        }
      );
    } catch (notificationError) {
      console.error(
        "Passenger notification failed:",
        notificationError
      );
    }

    /*
     * Notify driver.
     */
    try {
      await sendNotification(
        admin,
        {
          user_id:
            best.driver.user_id,

          event_type:
            NOTIFICATION_EVENTS
              .PASSENGER_REQUEST,

          title:
            "New passenger request",

          message:
            `New passenger request: ${request.origin} → ${request.destination} on ${request.requested_date} at ${request.requested_time}. Review the request and negotiate the fare.`,

          related_id:
            request_id
        }
      );
    } catch (notificationError) {
      console.error(
        "Driver notification failed:",
        notificationError
      );
    }

    return Response.json(
      {
        success: true,
        request: updated,
        matched: true,
        candidates:
          accessibleRanked.length,

        driver_name:
          best.driver.full_name ||
          "",

        vehicle_id:
          best.vehicle.id,

        allocation_id:
          best.allocation.id
      }
    );
  } catch (error) {
    console.error(
      "matchTripRequest error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to match trip request"
      },
      { status: 500 }
    );
  }
}