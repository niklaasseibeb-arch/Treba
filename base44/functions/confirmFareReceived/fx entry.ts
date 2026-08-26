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

    if (allocation.driver_id !== user.id) {
      return Response.json(
        { error: "Not authorised" },
        { status: 403 }
      );
    }

    /*
     * Treba does not collect or transfer the fare.
     *
     * This is simply a driver confirmation.
     */
    const updated =
      await base44.entities.Booking.update(
        booking.id,
        {
          payment_status:
            "fare_received",

          fare_received: true,

          fare_received_at:
            new Date().toISOString(),
        }
      );

    return Response.json({
      success: true,
      booking: updated,
      message:
        "Driver recorded that the agreed fare was received directly from the passenger.",
    });
  } catch (error) {
    console.error(
      "confirmFareReceived error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm fare",
      },
      { status: 500 }
    );
  }
});