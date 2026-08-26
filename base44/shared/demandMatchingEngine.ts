import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { rankEligibleDrivers } from "../../shared/allocationEngine.ts";
import { getActiveMarketplaceDriverUserIds } from "../../shared/driverSubscription.ts";
import {
  sendNotification,
  NOTIFICATION_EVENTS
} from "../../shared/notifications.ts";

export default async function (req) {
  try {
    const base44 =
      createClientFromRequest(req);

    const user =
      await base44.auth.me();

    if (!user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (user.role !== "admin") {
      return Response.json(
        { error: "Admin only" },
        { status: 403 }
      );
    }

    const body =
      await req.json().catch(
        () => ({})
      );

    const {
      route_id,
      date,
      departure_time,
      timeslot
    } = body || {};

    if (
      !route_id ||
      !date ||
      !departure_time
    ) {
      return Response.json(
        {
          error:
            "route_id, date and departure_time are required"
        },
        { status: 400 }
      );
    }

    const admin =
      base44.asServiceRole;

    /*
     * Load route.
     */
    const route =
      await admin.entities.Route.get(
        route_id
      );

    if (!route) {
      return Response.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    if (
      route.is_active === false ||
      route.route_status !== "active"
    ) {
      return Response.json(
        { error: "Route is not active" },
        { status: 400 }
      );
    }

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
        /*
         * Keep the first active vehicle.
         */
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
     * Find eligible drivers.
     */
    const ranked =
      rankEligibleDrivers({
        route,
        date,
        departureTime:
          departure_time,
        drivers,
        vehiclesByDriver,
        existingAllocations,
        excludeDriverIds: []
      });

    if (!ranked.length) {
      return Response.json(
        {
          error:
            "No eligible driver available for this route and time",
          status:
            "no_eligible_driver"
        },
        { status: 409 }
      );
    }

    /*
     * Only drivers with active marketplace
     * access may receive allocations.
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

    if (!accessibleRanked.length) {
      return Response.json(
        {
          error:
            "No eligible driver with active marketplace access",
          status:
            "no_eligible_driver"
        },
        { status: 409 }
      );
    }

    const best =
      accessibleRanked[0];

    const driver =
      best.driver;

    const vehicle =
      best.vehicle;

    const totalSeats =
      Number(
        vehicle.seating_capacity || 0
      );

    /*
     * Create the scheduled allocation.
     */
    const allocation =
      await admin.entities.Allocation.create(
        {
          route_id:
            route.id,

          route_code:
            route.route_code || "",

          origin:
            route.origin_town,

          destination:
            route.destination_town,

          date,

          departure_time,

          timeslot:
            timeslot || "",

          driver_id:
            driver.id,

          driver_name:
            driver.full_name || "",

          driver_user_id:
            driver.user_id || "",

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

          queue_position: 1,

          is_visible_to_passengers:
            false,

          passenger_booking_open:
            false,

          pickup_location: "",

          dropoff_location: "",

          driver_fare: 0,

          pickup_charge: 0,

          dropoff_charge: 0,

          luggage_charge: 0,

          total_fare: 0,

          fare_status:
            "pending",

          payment_method:
            "direct_to_driver",

          payment_status:
            "not_due",

          declined_driver_ids: [],

          created_at:
            new Date().toISOString(),

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
            driver.user_id,

          event_type:
            NOTIFICATION_EVENTS
              .ALLOCATION_CONFIRMATION_REQUIRED,

          title:
            "New trip allocation",

          message:
            `You have been allocated ${route.origin_town} → ${route.destination_town} on ${date} at ${departure_time}. Please confirm or decline your availability.`,

          related_id:
            allocation.id
        }
      );
    } catch (notificationError) {
      console.error(
        "Allocation notification failed:",
        notificationError
      );
    }

    return Response.json(
      {
        success: true,
        allocation,
        candidates:
          accessibleRanked
            .slice(0, 5)
            .map(
              (candidate) => ({
                driver_id:
                  candidate.driver.id,

                driver_name:
                  candidate.driver.full_name,

                vehicle_id:
                  candidate.vehicle.id,

                vehicle_label:
                  `${candidate.vehicle.make || ""} ${candidate.vehicle.model || ""}`.trim(),

                score:
                  candidate.score,

                day_allocations:
                  candidate.dayAllocations,

                total_allocations:
                  candidate.totalAllocations
              })
            )
      }
    );
  } catch (error) {
    console.error(
      "createAllocation error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create allocation"
      },
      { status: 500 }
    );
  }
}