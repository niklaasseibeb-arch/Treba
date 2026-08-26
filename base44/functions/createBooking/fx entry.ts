import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const {
      allocation_id,
      number_of_seats,
      passenger_name,
      passenger_phone,
    } = await req.json();

    const seats =
      Number(number_of_seats || 1);

    if (!allocation_id) {
      return Response.json(
        { error: "allocation_id is required" },
        { status: 400 }
      );
    }

    if (seats < 1) {
      return Response.json(
        { error: "At least one seat is required" },
        { status: 400 }
      );
    }

    /*
     * Get allocation.
     */
    const allocations =
      await base44.entities.Allocation.filter({
        id: allocation_id,
      });

    const allocation = allocations?.[0];

    if (!allocation) {
      return Response.json(
        { error: "Trip not found" },
        { status: 404 }
      );
    }

    if (allocation.status !== "confirmed") {
      return Response.json(
        {
          error:
            "This trip is not currently available for booking.",
        },
        { status: 400 }
      );
    }

    const availableSeats =
      Number(
        allocation.available_seats || 0
      );

    if (availableSeats < seats) {
      return Response.json(
        {
          error:
            `Only ${availableSeats} seat(s) are available.`,
        },
        { status: 400 }
      );
    }

    /*
     * Create booking.
     */
    const booking =
      await base44.entities.Booking.create({
        allocation_id,

        trip_request_id:
          allocation.trip_request_id || "",

        passenger_id: user.id,

        passenger_name:
          passenger_name ||
          user.full_name ||
          "",

        passenger_phone:
          passenger_phone ||
          user.phone_number ||
          "",

        number_of_seats: seats,

        /*
         * No fare collected by Treba.
         */
        agreed_fare: null,

        payment_method:
          "direct_to_driver",

        payment_status:
          "pending",

        booking_status:
          "confirmed",

        booked_at:
          new Date().toISOString(),
      });

    /*
     * Update seats.
     */
    const newBookedSeats =
      Number(
        allocation.booked_seats || 0
      ) + seats;

    const newAvailableSeats =
      Number(
        allocation.total_seats || 0
      ) - newBookedSeats;

    await base44.entities.Allocation.update(
      allocation.id,
      {
        booked_seats: newBookedSeats,

        available_seats:
          Math.max(
            0,
            newAvailableSeats
          ),
      }
    );

    return Response.json({
      success: true,

      booking,

      seats_remaining:
        Math.max(
          0,
          newAvailableSeats
        ),

      payment: {
        method:
          "direct_to_driver",

        status:
          "pending",

        message:
          "Fare is agreed directly between passenger and driver. Treba does not process the fare payment.",
      },
    });
  } catch (error) {
    console.error(
      "createBooking error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create booking",
      },
      { status: 500 }
    );
  }
});