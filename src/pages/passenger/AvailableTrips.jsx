import React, { useEffect, useState } from "react";
import {
  Loader2,
  Route as RouteIcon,
  CalendarClock,
  Clock,
  Car,
  Armchair,
  Luggage,
  MapPin,
  Flag,
  Banknote,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

export default function AvailableTrips() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [bookingId, setBookingId] = useState(null);

  const loadTrips = async () => {
    setLoading(true);

    try {
      const res = await base44.functions.invoke("getAvailableTrips", {});

      if (res.data?.error) {
        toast({
          title: res.data.error,
          variant: "destructive",
        });
        return;
      }

      setTrips(res.data?.trips || []);
    } catch (err) {
      toast({
        title: "Could not load available trips",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const bookTrip = async (trip) => {
    setBookingId(trip.id);

    try {
      const res = await base44.functions.invoke("bookTrip", {
        trip_id: trip.id,
      });

      if (res.data?.error) {
        toast({
          title: res.data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Trip booked successfully",
        description:
          "Please pay the agreed fare directly to your driver.",
      });

      await loadTrips();
    } catch (err) {
      toast({
        title: "Could not book trip",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBookingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Available Trips
        </h1>

        <p className="mt-1 text-muted-foreground">
          Choose an available scheduled trip. Fares are agreed directly
          between you and the driver.
        </p>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <RouteIcon className="mx-auto h-10 w-10 text-muted-foreground" />

          <p className="mt-3 text-sm text-muted-foreground">
            No trips with available seats are currently scheduled.
          </p>
        </div>
      ) : (
        <div className="space-y-4">

          {trips.map((trip) => {

            const availableSeats =
              Number(trip.available_seats ?? trip.seats_available ?? 0);

            const totalSeats =
              Number(trip.total_seats ?? trip.seating_capacity ?? 0);

            const fare =
              Number(
                trip.agreed_fare ??
                trip.fare ??
                trip.driver_fare ??
                0
              );

            const pickupCharge =
              Number(trip.pickup_charge ?? 0);

            const dropoffCharge =
              Number(trip.dropoff_charge ?? 0);

            const luggageCharge =
              Number(trip.luggage_charge ?? 0);

            const totalFare =
              fare +
              pickupCharge +
              dropoffCharge +
              luggageCharge;

            const paymentMethod =
              trip.payment_method ||
              trip.payment_arrangement ||
              "direct_to_driver";

            const paymentLabel =
              paymentMethod === "cash_to_driver"
                ? "Cash directly to driver"
                : "Direct payment to driver";

            return (
              <div
                key={trip.id}
                className="overflow-hidden rounded-2xl border border-border bg-card treba-shadow"
              >

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <RouteIcon className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="text-lg font-bold">
                        {trip.origin} → {trip.destination}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {trip.route_code || "Scheduled Treba trip"}
                      </div>
                    </div>

                  </div>

                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Available
                  </span>

                </div>


                {/* Trip information */}
                <div className="p-5">

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    <TripDetail
                      icon={CalendarClock}
                      label="Travel date"
                      value={trip.date || trip.travel_date}
                    />

                    <TripDetail
                      icon={Clock}
                      label="Departure"
                      value={trip.departure_time}
                    />

                    <TripDetail
                      icon={Car}
                      label="Vehicle"
                      value={
                        trip.vehicle_label ||
                        trip.vehicle_type ||
                        "Driver vehicle"
                      }
                    />

                    <TripDetail
                      icon={Armchair}
                      label="Seats available"
                      value={`${availableSeats} / ${totalSeats}`}
                      highlight={availableSeats > 0}
                    />

                  </div>


                  {/* Pickup / Drop-off */}
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <LocationCard
                      icon={MapPin}
                      label="Pickup"
                      value={
                        trip.pickup_location ||
                        "Standard pickup point"
                      }
                      charge={pickupCharge}
                    />

                    <LocationCard
                      icon={Flag}
                      label="Drop-off"
                      value={
                        trip.dropoff_location ||
                        "Standard drop-off point"
                      }
                      charge={dropoffCharge}
                    />

                  </div>


                  {/* Luggage */}
                  <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">

                    <div className="flex items-center gap-2">

                      <Luggage className="h-4 w-4 text-primary" />

                      <span className="text-sm font-semibold">
                        Luggage
                      </span>

                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">

                      {trip.luggage_small_bags != null && (
                        <span>
                          Small: {trip.luggage_small_bags}
                        </span>
                      )}

                      {trip.luggage_standard_bags != null && (
                        <span>
                          Standard: {trip.luggage_standard_bags}
                        </span>
                      )}

                      {trip.luggage_large_suitcases != null && (
                        <span>
                          Large: {trip.luggage_large_suitcases}
                        </span>
                      )}

                      {trip.luggage_oversized_items != null && (
                        <span>
                          Oversized: {trip.luggage_oversized_items}
                        </span>
                      )}

                      {trip.luggage_weight_category && (
                        <span>
                          Weight: {trip.luggage_weight_category}
                        </span>
                      )}

                    </div>

                    {luggageCharge > 0 && (
                      <div className="mt-2 text-xs font-medium text-muted-foreground">
                        Luggage charge: N$
                        {luggageCharge.toFixed(0)}
                      </div>
                    )}

                  </div>


                  {/* Fare */}
                  <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">

                    <div className="flex flex-wrap items-start justify-between gap-4">

                      <div>

                        <div className="flex items-center gap-2">

                          <Banknote className="h-5 w-5 text-primary" />

                          <span className="text-sm font-semibold">
                            Driver's fare offer
                          </span>

                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          This is the fare agreed/offered by the driver.
                          Treba does not collect the payment.
                        </p>

                      </div>

                      <div className="text-right">

                        <div className="text-2xl font-bold">
                          N${totalFare.toFixed(0)}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Total for this booking
                        </div>

                      </div>

                    </div>


                    {/* Fare breakdown */}
                    <div className="mt-4 space-y-2 border-t border-border/60 pt-3">

                      <FareLine
                        label="Driver fare"
                        amount={fare}
                      />

                      <FareLine
                        label="Pickup charge"
                        amount={pickupCharge}
                      />

                      <FareLine
                        label="Drop-off charge"
                        amount={dropoffCharge}
                      />

                      <FareLine
                        label="Luggage charge"
                        amount={luggageCharge}
                      />

                      <div className="flex items-center justify-between border-t border-border/60 pt-2 font-semibold">
                        <span>Total</span>
                        <span>
                          N${totalFare.toFixed(0)}
                        </span>
                      </div>

                    </div>

                  </div>


                  {/* Payment */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">

                        {paymentMethod === "cash_to_driver" ? (
                          <Banknote className="h-5 w-5 text-emerald-700" />
                        ) : (
                          <CreditCard className="h-5 w-5 text-emerald-700" />
                        )}

                      </div>

                      <div>

                        <div className="text-sm font-semibold text-emerald-900">
                          Payment
                        </div>

                        <div className="text-xs text-emerald-800">
                          {paymentLabel}
                        </div>

                      </div>

                    </div>

                    <div className="text-xs font-medium text-emerald-800">
                      Treba does not process fare payments
                    </div>

                  </div>


                  {/* Book */}
                  <div className="mt-5 flex items-center justify-between gap-3">

                    <div className="text-xs text-muted-foreground">
                      {availableSeats === 1
                        ? "1 seat remaining"
                        : `${availableSeats} seats remaining`}
                    </div>

                    <Button
                      className="h-11 px-6"
                      disabled={
                        availableSeats <= 0 ||
                        bookingId === trip.id
                      }
                      onClick={() => bookTrip(trip)}
                    >

                      {bookingId === trip.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Booking...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Book this trip
                        </>
                      )}

                    </Button>

                  </div>

                </div>

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}


function TripDetail({
  icon: Icon,
  label,
  value,
  highlight = false,
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div
        className={`mt-1 flex items-center gap-2 text-sm font-semibold ${
          highlight ? "text-emerald-700" : ""
        }`}
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{value || "—"}</span>
      </div>
    </div>
  );
}


function LocationCard({
  icon: Icon,
  label,
  value,
  charge = 0,
}) {
  return (
    <div className="rounded-xl border border-border p-4">

      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{value}</span>
      </div>

      {charge > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          Charge: N${charge.toFixed(0)}
        </div>
      )}

    </div>
  );
}


function FareLine({ label, amount }) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span>N${Number(amount || 0).toFixed(0)}</span>
    </div>
  );
}