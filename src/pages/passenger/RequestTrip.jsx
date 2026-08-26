import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Send,
  MapPin,
  Flag,
  Info,
  AlertTriangle,
  CheckCircle2,
  BadgeDollarSign,
  Route as RouteIcon,
  Luggage,
  Users,
  CalendarClock,
  Repeat,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

import { useToast } from "@/components/ui/use-toast";

import {
  classifyPickup,
  classifyDropoff,
} from "@/lib/routeLocations";

import { NAMIBIAN_TOWNS } from "@/lib/treba-places";

import {
  LUGGAGE_WEIGHT_CATEGORIES,
  luggageItemCount,
} from "@/lib/luggage";

import TripRequestReceipt from "@/components/passenger/TripRequestReceipt";


function StandardBadge({ isStandard }) {
  if (isStandard) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Standard
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      Non-standard
    </span>
  );
}


function formatDate(date) {
  if (!date) return "";

  const d = new Date(`${date}T00:00:00`);

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


export default function RequestTrip() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // ============================================================
  // TOWN-TO-TOWN ROUTE
  // ============================================================

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  // ============================================================
  // PHYSICAL PICKUP / DROP-OFF LOCATIONS
  // ============================================================

  const [pickup, setPickup] = useState("");
  const [pickupCustom, setPickupCustom] = useState("");

  const [dropoff, setDropoff] = useState("");
  const [dropoffCustom, setDropoffCustom] = useState("");

  // ============================================================
  // TRAVEL DATE / TIME
  // ============================================================

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // ============================================================
  // PASSENGER
  // ============================================================

  const [bookingFor, setBookingFor] = useState("self");
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  const [seats, setSeats] = useState(1);

  // ============================================================
  // GROUP / RECURRING
  // ============================================================

  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState("weekly");

  // ============================================================
  // LUGGAGE
  // ============================================================

  const [smallBags, setSmallBags] = useState(0);
  const [standardBags, setStandardBags] = useState(0);
  const [largeSuitcases, setLargeSuitcases] = useState(0);
  const [oversizedItems, setOversizedItems] = useState(0);

  const [weightCategory, setWeightCategory] = useState("");
  const [luggageDescription, setLuggageDescription] = useState("");

  // ============================================================
  // NOTES
  // ============================================================

  const [notes, setNotes] = useState("");


  // ============================================================
  // LOAD ACTIVE ROUTES
  // ============================================================

  useEffect(() => {
    let active = true;

    async function loadRoutes() {
      try {
        const list = await base44.entities.Route.filter({
          is_active: true,
          route_status: "active",
        });

        if (active) {
          setRoutes(list || []);
        }
      } catch (error) {
        toast({
          title: "Could not load routes",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRoutes();

    return () => {
      active = false;
    };
  }, []);


  // ============================================================
  // FIND MATCHING TOWN-TO-TOWN ROUTE
  // ============================================================

  const matchedRoute = useMemo(() => {
    if (!origin || !destination) {
      return null;
    }

    return routes.find(
      (route) =>
        route.origin_town === origin &&
        route.destination_town === destination
    );
  }, [routes, origin, destination]);


  // ============================================================
  // PHYSICAL PICKUP LOCATION
  // ============================================================

  const pickupPoint =
    pickup === "__custom"
      ? pickupCustom.trim()
      : pickup;


  // ============================================================
  // PHYSICAL DROP-OFF LOCATION
  // ============================================================

  const dropoffPoint =
    dropoff === "__custom"
      ? dropoffCustom.trim()
      : dropoff;


  // ============================================================
  // CLASSIFY LOCATIONS
  // ============================================================

  const pickupClass = matchedRoute
    ? classifyPickup(matchedRoute, pickupPoint)
    : { isStandard: false };

  const dropoffClass = matchedRoute
    ? classifyDropoff(matchedRoute, dropoffPoint)
    : { isStandard: false };


  // ============================================================
  // LUGGAGE
  // ============================================================

  const luggage = {
    luggage_small_bags: Number(smallBags) || 0,
    luggage_standard_bags: Number(standardBags) || 0,
    luggage_large_suitcases: Number(largeSuitcases) || 0,
    luggage_oversized_items: Number(oversizedItems) || 0,
    luggage_weight_category: weightCategory,
  };

  const luggageTotal = luggageItemCount(luggage);


  // ============================================================
  // DATE VALIDATION
  // 1–7 DAYS IN ADVANCE
  // ============================================================

  const dateValid = useMemo(() => {
    if (!date) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selected = new Date(`${date}T00:00:00`);

    const minimum = new Date(today);
    minimum.setDate(minimum.getDate() + 1);

    const maximum = new Date(today);
    maximum.setDate(maximum.getDate() + 7);

    return selected >= minimum && selected <= maximum;
  }, [date]);


  // ============================================================
  // FORM VALIDATION
  // ============================================================

  const canSubmit =
    !!origin &&
    !!destination &&
    origin !== destination &&
    !!date &&
    dateValid &&
    !!time &&
    !!pickupPoint &&
    !!dropoffPoint &&
    Number(seats) >= 1 &&
    luggageTotal >= 1 &&
    !!weightCategory &&
    (bookingFor === "self" || !!passengerName.trim());


  // ============================================================
  // RESET FORM
  // ============================================================

  const reset = () => {
    setOrigin("");
    setDestination("");

    setPickup("");
    setPickupCustom("");

    setDropoff("");
    setDropoffCustom("");

    setDate("");
    setTime("");

    setBookingFor("self");
    setPassengerName("");
    setPassengerPhone("");

    setSeats(1);

    setIsGroupBooking(false);
    setIsRecurring(false);
    setRecurrence("weekly");

    setSmallBags(0);
    setStandardBags(0);
    setLargeSuitcases(0);
    setOversizedItems(0);

    setWeightCategory("");
    setLuggageDescription("");

    setNotes("");
  };


  // ============================================================
  // SUBMIT REQUEST
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      toast({
        title: "Please complete the required fields",
        variant: "destructive",
      });

      return;
    }

    setSubmitting(true);

    try {
      const me = await base44.auth.me();

      const requestPassengerName =
        bookingFor === "self"
          ? user?.full_name || me?.full_name || ""
          : passengerName.trim();


      // ========================================================
      // CREATE TRIP REQUEST
      // ========================================================

      const created =
        await base44.entities.TripRequest.create({

          passenger_id: me.id,

          passenger_name: requestPassengerName,

          passenger_phone:
            bookingFor === "self"
              ? user?.phone_number || ""
              : passengerPhone.trim(),

          booking_for: bookingFor,

          // Town-to-town journey
          origin,
          destination,

          route_id: matchedRoute?.id || "",

          // Physical locations
          pickup_location: pickupPoint,
          dropoff_location: dropoffPoint,

          pickup_is_standard:
            pickupClass.isStandard,

          dropoff_is_standard:
            dropoffClass.isStandard,

          requested_date: date,
          requested_time: time,

          number_of_seats:
            Number(seats) || 1,

          is_group_booking:
            isGroupBooking,

          is_recurring:
            isRecurring,

          recurrence_pattern:
            isRecurring ? recurrence : "",

          luggage_small_bags:
            luggage.luggage_small_bags,

          luggage_standard_bags:
            luggage.luggage_standard_bags,

          luggage_large_suitcases:
            luggage.luggage_large_suitcases,

          luggage_oversized_items:
            luggage.luggage_oversized_items,

          luggage_weight_category:
            weightCategory,

          luggage_details:
            luggageDescription.trim(),

          // Payment remains directly between passenger and driver
          payment_method:
            "direct_to_driver",

          request_status:
            "requested",

          notes:
            notes.trim(),
        });


      // ========================================================
      // TRIGGER TREBA SCHEDULING
      // ========================================================

      let finalRequest = created;

      try {
        const response =
          await base44.functions.invoke(
            "scheduleTrip",
            {
              request_id: created.id,
            }
          );

        if (response.data?.request) {
          finalRequest =
            response.data.request;
        }

      } catch (error) {
        console.error(
          "scheduleTrip error:",
          error
        );
      }


      // ========================================================
      // SHOW RECEIPT
      // ========================================================

      setReceipt(finalRequest);

      reset();

    } catch (error) {

      toast({
        title: "Could not submit request",
        description: error.message,
        variant: "destructive",
      });

    } finally {
      setSubmitting(false);
    }
  };


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  // ============================================================
  // RECEIPT
  // ============================================================

  if (receipt) {
    return (
      <TripRequestReceipt
        request={receipt}
        onAnother={() => setReceipt(null)}
      />
    );
  }


  // ============================================================
  // FORM
  // ============================================================

  return (
    <div className="max-w-2xl space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Request a Trip
        </h1>

        <p className="mt-1 text-muted-foreground">
          Request your town-to-town trip in advance.
          Eligible drivers will receive an opportunity
          to operate the trip.
        </p>
      </div>


      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-card p-6 treba-shadow"
      >


        {/* ====================================================
            FROM / TO
        ==================================================== */}

        <div className="space-y-3">

          <div>
            <h2 className="text-sm font-semibold">
              Journey
            </h2>

            <p className="text-xs text-muted-foreground">
              Select the towns you are travelling between.
            </p>
          </div>


          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* FROM */}

            <div className="space-y-2">

              <Label>
                From
              </Label>

              <Select
                value={origin}
                onValueChange={(value) => {
                  setOrigin(value);

                  // Reset physical pickup
                  // when town changes
                  setPickup("");
                  setPickupCustom("");
                }}
              >

                <SelectTrigger className="h-11">

                  <SelectValue
                    placeholder="Select town"
                  />

                </SelectTrigger>

                <SelectContent>

                  {NAMIBIAN_TOWNS.map(
                    (town) => (
                      <SelectItem
                        key={town}
                        value={town}
                      >
                        {town}
                      </SelectItem>
                    )
                  )}

                </SelectContent>

              </Select>

            </div>


            {/* TO */}

            <div className="space-y-2">

              <Label>
                To
              </Label>

              <Select
                value={destination}
                onValueChange={(value) => {
                  setDestination(value);

                  // Reset physical drop-off
                  // when town changes
                  setDropoff("");
                  setDropoffCustom("");
                }}
              >

                <SelectTrigger className="h-11">

                  <SelectValue
                    placeholder="Select town"
                  />

                </SelectTrigger>

                <SelectContent>

                  {NAMIBIAN_TOWNS.map(
                    (town) => (
                      <SelectItem
                        key={town}
                        value={town}
                      >
                        {town}
                      </SelectItem>
                    )
                  )}

                </SelectContent>

              </Select>

            </div>

          </div>


          {/* ROUTE STATUS */}

          {origin &&
            destination &&
            origin !== destination && (

              <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">

                <RouteIcon className="mt-0.5 h-4 w-4 shrink-0" />

                {matchedRoute ? (
                  <span>

                    Scheduled route matched:

                    {" "}

                    <span className="font-medium text-foreground">
                      {matchedRoute.route_code ||
                        `${origin} → ${destination}`}
                    </span>

                    {matchedRoute.distance_km
                      ? ` · ${matchedRoute.distance_km} km`
                      : ""}

                    {matchedRoute.approximate_duration_minutes
                      ? ` · ~${matchedRoute.approximate_duration_minutes} min`
                      : ""}

                  </span>
                ) : (

                  <span>
                    No scheduled route currently
                    matches this town pair.
                    Treba will attempt to find
                    eligible drivers.
                  </span>

                )}

              </div>

            )}

        </div>


        {/* ====================================================
            PICKUP / DROP-OFF
        ==================================================== */}

        <div className="space-y-3">

          <div>
            <h2 className="text-sm font-semibold">
              Pickup & Drop-off
            </h2>

            <p className="text-xs text-muted-foreground">
              Select the physical locations within
              the towns you selected above.
            </p>
          </div>


          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">


            {/* =================================================
                PICKUP
            ================================================= */}

            <div className="space-y-2">

              <div className="flex items-center justify-between">

                <Label>
                  Pickup location
                </Label>

                {pickupPoint && (
                  <StandardBadge
                    isStandard={
                      pickupClass.isStandard
                    }
                  />
                )}

              </div>


              <div className="relative">

                <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Select
                  value={pickup}
                  onValueChange={(value) => {

                    setPickup(value);

                    if (value !== "__custom") {
                      setPickupCustom("");
                    }

                  }}
                >

                  <SelectTrigger className="h-11 pl-9">

                    <SelectValue
                      placeholder="Select pickup point"
                    />

                  </SelectTrigger>

                  <SelectContent>

                    {(
                      matchedRoute?.standard_pickup_points ||
                      []
                    ).map((point) => (

                      <SelectItem
                        key={point}
                        value={point}
                      >
                        {point}
                      </SelectItem>

                    ))}

                    <SelectItem value="__custom">
                      Enter another location…
                    </SelectItem>

                  </SelectContent>

                </Select>

              </div>


              {pickup === "__custom" && (

                <Input
                  value={pickupCustom}
                  onChange={(event) =>
                    setPickupCustom(
                      event.target.value
                    )
                  }
                  placeholder="Enter pickup location"
                  className="h-11"
                />

              )}

            </div>


            {/* =================================================
                DROP-OFF
            ================================================= */}

            <div className="space-y-2">

              <div className="flex items-center justify-between">

                <Label>
                  Drop-off location
                </Label>

                {dropoffPoint && (
                  <StandardBadge
                    isStandard={
                      dropoffClass.isStandard
                    }
                  />
                )}

              </div>


              <div className="relative">

                <Flag className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Select
                  value={dropoff}
                  onValueChange={(value) => {

                    setDropoff(value);

                    if (value !== "__custom") {
                      setDropoffCustom("");
                    }

                  }}
                >

                  <SelectTrigger className="h-11 pl-9">

                    <SelectValue
                      placeholder="Select drop-off point"
                    />

                  </SelectTrigger>

                  <SelectContent>

                    {(
                      matchedRoute?.standard_drop_off_points ||
                      []
                    ).map((point) => (

                      <SelectItem
                        key={point}
                        value={point}
                      >
                        {point}
                      </SelectItem>

                    ))}

                    <SelectItem value="__custom">
                      Enter another location…
                    </SelectItem>

                  </SelectContent>

                </Select>

              </div>


              {dropoff === "__custom" && (

                <Input
                  value={dropoffCustom}
                  onChange={(event) =>
                    setDropoffCustom(
                      event.target.value
                    )
                  }
                  placeholder="Enter drop-off location"
                  className="h-11"
                />

              )}

            </div>

          </div>

        </div>


        {/* ====================================================
            DATE / TIME
        ==================================================== */}

        <div className="rounded-xl border border-border p-4">

          <div className="mb-3 flex items-center gap-2">

            <CalendarClock className="h-4 w-4 text-primary" />

            <div>

              <div className="text-sm font-semibold">
                Travel date and time
              </div>

              <div className="text-xs text-muted-foreground">
                Advance booking is available
                1–7 days before travel.
              </div>

            </div>

          </div>


          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <div className="space-y-2">

              <Label>
                Travel date
              </Label>

              <Input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(event.target.value)
                }
                className="h-11"
                required
              />

              {date && !dateValid && (

                <p className="text-xs text-destructive">
                  Select a date between tomorrow
                  and 7 days from today.
                </p>

              )}

              {dateValid && (

                <p className="text-xs text-muted-foreground">
                  {formatDate(date)}
                </p>

              )}

            </div>


            <div className="space-y-2">

              <Label>
                Preferred departure time
              </Label>

              <Input
                type="time"
                value={time}
                onChange={(event) =>
                  setTime(event.target.value)
                }
                className="h-11"
                required
              />

            </div>

          </div>

        </div>


        {/* ====================================================
            PASSENGER
        ==================================================== */}

        <div className="rounded-xl border border-border p-4">

          <div className="flex items-center gap-2">

            <Users className="h-4 w-4 text-primary" />

            <div>

              <div className="text-sm font-semibold">
                Passenger
              </div>

              <div className="text-xs text-muted-foreground">
                You may book for yourself or
                another person.
              </div>

            </div>

          </div>


          <div className="mt-4 flex gap-2">

            <button
              type="button"
              onClick={() =>
                setBookingFor("self")
              }
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                bookingFor === "self"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              Myself
            </button>


            <button
              type="button"
              onClick={() =>
                setBookingFor("someone_else")
              }
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                bookingFor === "someone_else"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              Someone else
            </button>

          </div>


          {bookingFor === "someone_else" && (

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">

              <div className="space-y-2">

                <Label>
                  Passenger name
                </Label>

                <Input
                  value={passengerName}
                  onChange={(event) =>
                    setPassengerName(
                      event.target.value
                    )
                  }
                  placeholder="Full name"
                  className="h-11"
                  required
                />

              </div>


              <div className="space-y-2">

                <Label>
                  Passenger phone
                </Label>

                <Input
                  value={passengerPhone}
                  onChange={(event) =>
                    setPassengerPhone(
                      event.target.value
                    )
                  }
                  placeholder="Phone number"
                  className="h-11"
                />

              </div>

            </div>

          )}

        </div>


        {/* ====================================================
            NUMBER OF PASSENGERS
        ==================================================== */}

        <div className="space-y-2">

          <Label>
            Number of passengers
          </Label>

          <Input
            type="number"
            min="1"
            max="20"
            value={seats}
            onChange={(event) => {

              const value = Math.max(
                1,
                Number(event.target.value) || 1
              );

              setSeats(value);
              setIsGroupBooking(value > 1);

            }}
            className="h-11"
          />

          {seats > 1 && (

            <p className="text-xs text-muted-foreground">
              This will be treated as a group booking.
            </p>

          )}

        </div>


        {/* ====================================================
            RECURRING
        ==================================================== */}

        <div className="rounded-xl border border-border p-4">

          <label className="flex items-center gap-3">

            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) =>
                setIsRecurring(
                  event.target.checked
                )
              }
              className="h-4 w-4 rounded border-border"
            />

            <span className="flex items-center gap-2 text-sm font-medium">

              <Repeat className="h-4 w-4 text-primary" />

              Make this a recurring booking

            </span>

          </label>


          {isRecurring && (

            <div className="mt-4">

              <Label>
                Repeat
              </Label>

              <Select
                value={recurrence}
                onValueChange={setRecurrence}
              >

                <SelectTrigger className="mt-2 h-11">

                  <SelectValue />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="weekly">
                    Every week
                  </SelectItem>

                  <SelectItem value="biweekly">
                    Every two weeks
                  </SelectItem>

                </SelectContent>

              </Select>

              <p className="mt-2 text-xs text-muted-foreground">
                Recurring trips will create future
                trip requests according to the
                selected pattern.
              </p>

            </div>

          )}

        </div>


        {/* ====================================================
            LUGGAGE
        ==================================================== */}

        <div className="space-y-3 rounded-xl border border-border p-4">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <Luggage className="h-4 w-4 text-primary" />

              <Label className="mb-0">
                Luggage
              </Label>

            </div>

            <span className="text-xs font-medium text-muted-foreground">
              Required
            </span>

          </div>


          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

            <div className="space-y-1.5">

              <Label className="text-xs text-muted-foreground">
                Small bags
              </Label>

              <Input
                type="number"
                min="0"
                value={smallBags}
                onChange={(event) =>
                  setSmallBags(
                    event.target.value
                  )
                }
                className="h-10"
              />

            </div>


            <div className="space-y-1.5">

              <Label className="text-xs text-muted-foreground">
                Standard bags
              </Label>

              <Input
                type="number"
                min="0"
                value={standardBags}
                onChange={(event) =>
                  setStandardBags(
                    event.target.value
                  )
                }
                className="h-10"
              />

            </div>


            <div className="space-y-1.5">

              <Label className="text-xs text-muted-foreground">
                Large suitcases
              </Label>

              <Input
                type="number"
                min="0"
                value={largeSuitcases}
                onChange={(event) =>
                  setLargeSuitcases(
                    event.target.value
                  )
                }
                className="h-10"
              />

            </div>


            <div className="space-y-1.5">

              <Label className="text-xs text-muted-foreground">
                Oversized items
              </Label>

              <Input
                type="number"
                min="0"
                value={oversizedItems}
                onChange={(event) =>
                  setOversizedItems(
                    event.target.value
                  )
                }
                className="h-10"
              />

            </div>

          </div>


          <div className="space-y-1.5">

            <Label className="text-xs text-muted-foreground">
              Approximate weight category
            </Label>

            <Select
              value={weightCategory}
              onValueChange={setWeightCategory}
            >

              <SelectTrigger className="h-10">

                <SelectValue
                  placeholder="Select weight category"
                />

              </SelectTrigger>

              <SelectContent>

                {LUGGAGE_WEIGHT_CATEGORIES.map(
                  (category) => (

                    <SelectItem
                      key={category.value}
                      value={category.value}
                    >
                      {category.label}
                    </SelectItem>

                  )
                )}

              </SelectContent>

            </Select>

          </div>


          <div className="space-y-1.5">

            <Label className="text-xs text-muted-foreground">
              Additional description
            </Label>

            <Textarea
              value={luggageDescription}
              onChange={(event) =>
                setLuggageDescription(
                  event.target.value
                )
              }
              placeholder="e.g. pram, cooler box, fragile items"
              rows={2}
            />

          </div>


          {luggageTotal < 1 && (

            <p className="text-xs text-amber-700">
              Add at least one luggage item to continue.
            </p>

          )}

        </div>


        {/* ====================================================
            NOTES
        ==================================================== */}

        <div className="space-y-2">

          <Label>
            Notes (optional)
          </Label>

          <Textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="Any extra information for the driver"
            rows={2}
          />

        </div>


        {/* ====================================================
            PAYMENT
        ==================================================== */}

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">

          <div className="flex items-start gap-3">

            <BadgeDollarSign className="mt-0.5 h-5 w-5 text-emerald-700" />

            <div>

              <div className="text-sm font-semibold text-emerald-900">
                Payment directly to driver
              </div>

              <p className="mt-1 text-xs text-emerald-800">
                Treba does not collect or process
                the passenger fare. The final fare
                is agreed directly between the
                passenger and driver.
              </p>

            </div>

          </div>

        </div>


        {/* ====================================================
            DRIVER OFFER
        ==================================================== */}

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">

          <div>

            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Fare
            </div>

            <div className="mt-0.5 text-sm text-muted-foreground">
              Drivers will make an offer for the trip.
            </div>

          </div>


          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold">

            <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />

            Driver offer

          </span>

        </div>


        {/* ====================================================
            INFORMATION
        ==================================================== */}

        <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">

          <Info className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            Treba will offer this trip to eligible
            drivers, up to a maximum of five drivers
            for the selected route, date and time.
            Drivers indicate whether they are
            available. Treba then schedules the
            available driver and makes the resulting
            trip visible to passengers.
          </span>

        </div>


        {/* ====================================================
            SUBMIT
        ==================================================== */}

        <div className="flex justify-end">

          <Button
            type="submit"
            disabled={submitting}
            className="h-11 px-6"
          >

            {submitting ? (

              <Loader2 className="mr-2 h-4 w-4 animate-spin" />

            ) : (

              <Send className="mr-2 h-4 w-4" />

            )}

            Request trip

          </Button>

        </div>

      </form>

    </div>
  );
}