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

    const url = new URL(req.url);

    const origin =
      url.searchParams.get("origin");

    const destination =
      url.searchParams.get("destination");

    const date =
      url.searchParams.get("date");

    if (!origin || !destination || !date) {
      return Response.json(
        {
          error:
            "origin, destination and date are required",
        },
        { status: 400 }
      );
    }

    const allocations =
      await base44.entities.Allocation.filter({
        origin,
        destination,
        date,
        status: "confirmed",
      });

    const availableTrips =
      (allocations || [])
        .filter(
          (a: any) =>
            Number(a.available_seats || 0) > 0
        )
        .sort(
          (a: any, b: any) =>
            String(
              a.departure_time
            ).localeCompare(
              String(b.departure_time)
            )
        )
        .map((a: any) => ({
          id: a.id,

          origin: a.origin,
          destination: a.destination,

          date: a.date,
          departure_time:
            a.departure_time,

          vehicle_label:
            a.vehicle_label || "",

          total_seats:
            Number(a.total_seats || 0),

          booked_seats:
            Number(a.booked_seats || 0),

          available_seats:
            Number(a.available_seats || 0),

          /*
           * Fare is deliberately NOT supplied.
           */
          fare:
            null,

          fare_status:
            "negotiated_directly_with_driver",

          payment_method:
            "direct_to_driver",
        }));

    return Response.json({
      success: true,
      trips: availableTrips,
    });
  } catch (error) {
    console.error(
      "getAvailableTrips error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load available trips",
      },
      { status: 500 }
    );
  }
});