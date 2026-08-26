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

    const { booking_id } = await req.json();

    if (!booking_id) {
      return Response.json(
        { error: "booking_id is required" },
        { status: 400 }
      );
    }

    const bookings =
      await base44.entities.Booking.filter({
        id: booking_id,
      });

    const booking = bookings?.[0];

    if (!booking) {
      return Response.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.passenger_id !== user.id) {
      return Response.json(
        { error: "Not authorised" },
        { status: 403 }
      );
    }

    if (
      booking.booking_status ===
      "cancelled"
    ) {
      return Response.json({
        success: true,
        message: "Booking already cancelled",
      });
    }

    const allocations =
      await base44.entities.Allocation.filter({
        id: booking.allocation_id,
      });

    const allocation = allocations?.[0];

    if (!allocation) {
      return Response.json(
        { error: "Allocation not found" },
        { status: 404 }
      );
    }

    const seats =
      Number(
        booking.number_of_seats || 1
      );

    const newBookedSeats =
      Math.max(
        0,
        Number(
          allocation.booked_seats || 0
        ) - seats
      );

    const newAvailableSeats =
      Number(
        allocation.total_seats || 0
      ) - newBookedSeats;

    await base44.entities.Booking.update(
      booking.id,
      {
        booking_status: "cancelled",
        payment_status: "cancelled",
      }
    );

    await base44.entities.Allocation.update(
      allocation.id,
      {
        booked_seats:
          newBookedSeats,

        available_seats:
          newAvailableSeats,
      }
    );

    return Response.json({
      success: true,
      seats_released: seats,
      seats_available:
        newAvailableSeats,
    });
  } catch (error) {
    console.error(
      "cancelBooking error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel booking",
      },
      { status: 500 }
    );
  }
});