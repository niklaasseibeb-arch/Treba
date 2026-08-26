import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

import {
  rankEligibleDrivers
} from "../../shared/allocationEngine.ts";

import {
  getActiveMarketplaceDriverUserIds
} from "../../shared/driverSubscription.ts";

import {
  sendNotification,
  NOTIFICATION_EVENTS
} from "../../shared/notifications.ts";

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
            "Authentication required"
        },
        { status: 401 }
      );
    }

    const body =
      await req.json().catch(
        () => ({})
      );

    const {
      allocation_id,
      action
    } = body || {};

    if (
      !allocation_id ||
      !action
    ) {
      return Response.json(
        {
          error:
            "allocation_id and action are required"
        },
        { status: 400 }
      );
    }

    if (
      ![
        "confirm",
        "decline"
      ].includes(action)
    ) {
      return Response.json(
        {
          error:
            "Action must be confirm or decline"
        },
        { status: 400 }
      );
    }

    const admin =
      base44.asServiceRole;

    /*
     * Load allocation.
     */
    const allocation =
      await admin.entities.Allocation.get(
        allocation_id
      );

    if (!allocation) {
      return Response.json(
        {
          error:
            "Allocation not found"
        },
        { status: 404 }
      );
    }

    /*
     * Driver can only respond
     * to their own allocation.
     *
     * Admin may also perform the action.
     */
    if (
      allocation.driver_user_id !==
        user.id &&
      allocation.driver_id !==
        user.id &&
      user.role !== "admin"
    ) {
      return Response.json(
        {
          error:
            "Not authorised"
        },
        { status: 403 }
      );
    }

    /*
     * Only awaiting confirmation
     * allocations may be responded to.
     */
    if (
      allocation.status !==
      "awaiting_confirmation"
    ) {
      return Response.json(
        {
          error:
            `Allocation cannot be ${action}ed because its current status is ${allocation.status}.`
        },
        { status: 400 }
      );
    }

    /*
     * =========================
     * CONFIRM
     * =========================
     */
    if (
      action === "confirm"
    ) {
      const updated =
        await admin.entities.Allocation.update(
          allocation.id,
          {
            status:
              "confirmed",

            is_visible_to_passengers:
              true,

            passenger_booking_open:
              true,

            updated_at:
              new Date().toISOString()
          }
        );

      /*
       * Notify driver.
       */
      try {
        await sendNotification(
          admin,
          {
            user_id:
              allocation.driver_user_id,

            event_type:
              NOTIFICATION_EVENTS
                .ALLOCATION_CONFIRMED,

            title:
              "Allocation confirmed",

            message:
              `Your ${allocation.origin} → ${allocation.destination} trip on ${allocation.date} at ${allocation.departure_time} is confirmed.`,

            related_id:
              allocation.id
          }
        );
      } catch (notificationError) {
        console.error(
          "Confirmation notification failed:",
          notificationError
        );
      }

      return Response.json(
        {
          success: true,
          action: "confirm",
          allocation: updated
        }
      );
    }

    /*
     * =========================
     * DECLINE
     * =========================
     */

    const declinedDriverId =
      allocation.driver_id;

    /*
     * Mark original allocation declined.
     */
    const declinedDriverIds =
      Array.isArray(
        allocation.declined_driver_ids
      )
        ? [
            ...allocation.declined_driver_ids,
            declinedDriverId
          ]
        : [
            declinedDriverId
          ];

    const declinedAllocation =
      await admin.entities.Allocation.update(
        allocation.id,
        {
          status:
            "declined",

          is_visible_to_passengers:
            false,

          passenger_booking_open:
            false,

          declined_driver_ids:
            declinedDriverIds,

          updated_at:
            new Date().toISOString()
        }
      );

    /*
     * Load drivers, vehicles and
     * existing allocations.
     */
    const [
      drivers,
      vehicles,
      existingAllocations
    ] = await Promise.all([
      admin.entities.DriverProfile.list(
        "-created_date",
        500
      ),

      admin.entities.Vehicle.list(
        "-created_date",
        500
      ),

      admin.entities.Allocation.list(
        "-date",
        1000
      )
    ]);

    /*
     * Index vehicles by driver.
     */
    const vehiclesByDriver: Record<
      string,
      any
    > = {};

    for (const vehicle of vehicles) {
      if (
        vehicle.driver_id &&
        vehicle.active !== false
      ) {
        if (
          !vehiclesByDriver[
            vehicle.driver_id
          ]
        ) {
          vehiclesByDriver[
            vehicle.driver_id
          ] = vehicle;
        }
      }
    }

    /*
     * Find replacement candidates.
     */
    const ranked =
      rankEligibleDrivers({
        route: {
          id:
            allocation.route_id,

          route_code:
            allocation.route_code,

          origin_town:
            allocation.origin,

          destination_town:
            allocation.destination
        },

        date:
          allocation.date,

        departureTime:
          allocation.departure_time,

        drivers,

        vehiclesByDriver,

        existingAllocations,

        excludeDriverIds:
          declinedDriverIds
      });

    /*
     * Only active marketplace drivers.
     */
    const accessUserIds =
      await getActiveMarketplaceDriverUserIds(
        admin
      );

    const candidates =
      ranked.filter(
        (candidate) =>
          candidate.driver?.user_id &&
          accessUserIds.has(
            candidate.driver.user_id
          )
      );

    /*
     * No replacement currently available.
     */
    if (!candidates.length) {
      return Response.json(
        {
          success: true,

          allocation:
            declinedAllocation,

          replacement:
            null,

          message:
            "Allocation declined. No replacement driver is currently available."
        }
      );
    }

    /*
     * Select next driver.
     */
    const best =
      candidates[0];

    const driver =
      best.driver;

    const vehicle =
      best.vehicle;

    const totalSeats =
      Number(
        vehicle.seating_capacity || 0
      );

    /*
     * Create replacement allocation.
     */
    const replacement =
      await admin.entities.Allocation.create(
        {
          route_id:
            allocation.route_id,

          route_code:
            allocation.route_code ||
            "",

          origin:
            allocation.origin,

          destination:
            allocation.destination,

          date:
            allocation.date,

          departure_time:
            allocation.departure_time,

          timeslot:
            allocation.timeslot ||
            "",

          driver_id:
            driver.id,

          driver_name:
            driver.full_name ||
            "",

          driver_user_id:
            driver.user_id ||
            "",

          vehicle_id:
            vehicle.id,

          vehicle_label:
            `${vehicle.make || ""} ${vehicle.model || ""} (${vehicle.registration_number || ""})`.trim(),

          total_seats:
            totalSeats,

          booked_seats: 0,

          available_seats:
            totalSeats,

          status:
            "awaiting_confirmation",

          queue_position:
            Number(
              allocation.queue_position ||
              1
            ) + 1,

          is_visible_to_passengers:
            false,

          passenger_booking_open:
            false,

          pickup_location:
            "",

          dropoff_location:
            "",

          driver_fare:
            0,

          pickup_charge:
            0,

          dropoff_charge:
            0,

          luggage_charge:
            0,

          total_fare:
            0,

          fare_status:
            "pending",

          payment_method:
            "direct_to_driver",

          payment_status:
            "not_due",

          declined_driver_ids:
            declinedDriverIds,

          replacement_for_allocation_id:
            allocation.id,

          created_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString()
        }
      );

    /*
     * Notify replacement driver.
     */
    try {
      await sendNotification(
        admin,
        {
          user_id:
            driver.user_id,

          event_type:
            NOTIFICATION_EVENTS
              .ALLOCATION_CONFIRMATION_REQUIRED,

          title:
            "Trip allocation available",

          message:
            `You have been selected for ${allocation.origin} → ${allocation.destination} on ${allocation.date} at ${allocation.departure_time}. Please confirm or decline.`,

          related_id:
            replacement.id
        }
      );
    } catch (notificationError) {
      console.error(
        "Replacement notification failed:",
        notificationError
      );
    }

    return Response.json(
      {
        success: true,

        action: "decline",

        allocation:
          declinedAllocation,

        replacement,

        replacement_driver:
          driver.full_name ||
          "",

        candidates:
          candidates.length
      }
    );
  } catch (error) {
    console.error(
      "respondToAllocation error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process allocation response"
      },
      { status: 500 }
    );
  }
}