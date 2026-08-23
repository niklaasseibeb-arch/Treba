import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Send, MapPin, Flag, Info, AlertTriangle, CheckCircle2, BadgeDollarSign, Route as RouteIcon, Luggage } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  classifyPickup, classifyDropoff, CASH_NONSTANDARD_MESSAGE,
} from "@/lib/routeLocations";
import { NAMIBIAN_TOWNS } from "@/lib/treba-places";
import { LUGGAGE_WEIGHT_CATEGORIES, luggageItemCount } from "@/lib/luggage";
import TripRequestReceipt from "@/components/passenger/TripRequestReceipt";

function StandardBadge({ isStandard }) {
  return isStandard ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Standard</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" /> Non-standard</span>
  );
}

export default function RequestTrip() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pickup, setPickup] = useState("");
  const [pickupCustom, setPickupCustom] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [dropoffCustom, setDropoffCustom] = useState("");
  const [seats, setSeats] = useState(1);
  const [smallBags, setSmallBags] = useState(0);
  const [standardBags, setStandardBags] = useState(0);
  const [largeSuitcases, setLargeSuitcases] = useState(0);
  const [oversizedItems, setOversizedItems] = useState(0);
  const [weightCategory, setWeightCategory] = useState("");
  const [luggageDescription, setLuggageDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("digital");

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Route.filter({ is_active: true, route_status: "active" });
        setRoutes(list || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const matchedRoute = useMemo(
    () => routes.find((r) => r.origin_town === origin && r.destination_town === destination),
    [routes, origin, destination]
  );

  const pickupPoint = pickup === "__custom" ? pickupCustom.trim() : pickup;
  const dropoffPoint = dropoff === "__custom" ? dropoffCustom.trim() : dropoff;

  const pickupClass = matchedRoute ? classifyPickup(matchedRoute, pickupPoint) : { isStandard: false };
  const dropoffClass = matchedRoute ? classifyDropoff(matchedRoute, dropoffPoint) : { isStandard: false };

  const cashBlocked = paymentMethod === "cash" && (!pickupClass.isStandard || !dropoffClass.isStandard);

  const luggage = {
    luggage_small_bags: Number(smallBags) || 0,
    luggage_standard_bags: Number(standardBags) || 0,
    luggage_large_suitcases: Number(largeSuitcases) || 0,
    luggage_oversized_items: Number(oversizedItems) || 0,
    luggage_weight_category: weightCategory,
  };
  const luggageTotal = luggageItemCount(luggage);

  const canSubmit = origin && destination && origin !== destination && date && time &&
    pickupPoint && dropoffPoint && !cashBlocked && luggageTotal >= 1 && !!weightCategory;

  const reset = () => {
    setOrigin(""); setDestination(""); setDate(""); setTime("");
    setPickup(""); setPickupCustom(""); setDropoff(""); setDropoffCustom("");
    setSeats(1); setSmallBags(0); setStandardBags(0); setLargeSuitcases(0); setOversizedItems(0);
    setWeightCategory(""); setLuggageDescription(""); setNotes(""); setPaymentMethod("digital");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const me = await base44.auth.me();
      let passengerName = user?.full_name || me?.full_name || "";
      try {
        const pp = await base44.entities.PassengerProfile.filter({ user_id: me.id });
        if (pp && pp.length) passengerName = pp[0].full_name || passengerName;
      } catch (err) {}

      const created = await base44.entities.TripRequest.create({
        passenger_id: me.id,
        passenger_name: passengerName,
        route_id: matchedRoute ? matchedRoute.id : "",
        origin,
        destination,
        pickup_location: pickupPoint,
        dropoff_location: dropoffPoint,
        pickup_is_standard: pickupClass.isStandard,
        dropoff_is_standard: dropoffClass.isStandard,
        number_of_seats: Number(seats) || 1,
        luggage_small_bags: luggage.luggage_small_bags,
        luggage_standard_bags: luggage.luggage_standard_bags,
        luggage_large_suitcases: luggage.luggage_large_suitcases,
        luggage_oversized_items: luggage.luggage_oversized_items,
        luggage_weight_category: weightCategory,
        luggage_details: luggageDescription.trim(),
        payment_method: paymentMethod,
        requested_date: date,
        requested_time: time,
        request_status: "requested",
        notes: notes.trim(),
      });
      let finalRequest = created;
      try {
        const res = await base44.functions.invoke("matchTripRequest", { request_id: created.id });
        if (res.data?.request) finalRequest = res.data.request;
      } catch (err) {}
      setReceipt(finalRequest);
      reset();
    } catch (err) {
      toast({ title: "Could not submit request", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (receipt) {
    return <TripRequestReceipt request={receipt} onAnother={() => setReceipt(null)} />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Request a Trip</h1>
        <p className="mt-1 text-muted-foreground">Tell Treba where you're going. Your fare is negotiated with your driver — Treba does not set, estimate or suggest any fare.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 treba-shadow">
        {/* Origin & destination */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Origin town</Label>
            <Select value={origin} onValueChange={(v) => { setOrigin(v); setPickup(""); setPickupCustom(""); }}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select origin town" /></SelectTrigger>
              <SelectContent>
                {NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Destination town</Label>
            <Select value={destination} onValueChange={(v) => { setDestination(v); setDropoff(""); setDropoffCustom(""); }}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select destination town" /></SelectTrigger>
              <SelectContent>
                {NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {origin && destination && origin !== destination && (
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <RouteIcon className="h-4 w-4 shrink-0" />
            {matchedRoute ? (
              <span>Scheduled route matched: <span className="font-medium text-foreground">{matchedRoute.route_code || `${origin} → ${destination}`}</span>{matchedRoute.distance_km ? ` · ${matchedRoute.distance_km} km` : ""}{matchedRoute.approximate_duration_minutes ? ` · ~${matchedRoute.approximate_duration_minutes} min` : ""}</span>
            ) : (
              <span>No scheduled route currently matches this town pair. Treba will still attempt to find a driver for you.</span>
            )}
          </div>
        )}

        {/* Date & time */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Travel date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" required /></div>
          <div className="space-y-2"><Label>Preferred departure time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11" required /></div>
        </div>

        {/* Pickup */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Pickup location</Label>
            {pickupPoint && <StandardBadge isStandard={pickupClass.isStandard} />}
          </div>
          <Select value={pickup} onValueChange={(v) => { setPickup(v); if (v !== "__custom") setPickupCustom(""); }}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select a standard pickup point" /></SelectTrigger>
            <SelectContent>
              {(matchedRoute?.standard_pickup_points || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              <SelectItem value="__custom">Request another location…</SelectItem>
            </SelectContent>
          </Select>
          {pickup === "__custom" && (
            <Input value={pickupCustom} onChange={(e) => setPickupCustom(e.target.value)} placeholder="Enter your pickup location" className="h-11" />
          )}
        </div>

        {/* Drop-off */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Drop-off location</Label>
            {dropoffPoint && <StandardBadge isStandard={dropoffClass.isStandard} />}
          </div>
          <Select value={dropoff} onValueChange={(v) => { setDropoff(v); if (v !== "__custom") setDropoffCustom(""); }}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select a standard drop-off point" /></SelectTrigger>
            <SelectContent>
              {(matchedRoute?.standard_drop_off_points || []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              <SelectItem value="__custom">Request another location…</SelectItem>
            </SelectContent>
          </Select>
          {dropoff === "__custom" && (
            <Input value={dropoffCustom} onChange={(e) => setDropoffCustom(e.target.value)} placeholder="Enter your drop-off location" className="h-11" />
          )}
        </div>

        {/* Passengers */}
        <div className="space-y-2">
          <Label>Number of passengers</Label>
          <Input type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)} className="h-11" />
        </div>

        {/* Luggage */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Luggage className="h-4 w-4 text-primary" />
              <Label className="mb-0">Luggage</Label>
            </div>
            <span className="text-xs font-medium text-muted-foreground">Required</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Small bags</Label><Input type="number" min="0" value={smallBags} onChange={(e) => setSmallBags(e.target.value)} className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Standard bags</Label><Input type="number" min="0" value={standardBags} onChange={(e) => setStandardBags(e.target.value)} className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Large suitcases</Label><Input type="number" min="0" value={largeSuitcases} onChange={(e) => setLargeSuitcases(e.target.value)} className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Oversized items</Label><Input type="number" min="0" value={oversizedItems} onChange={(e) => setOversizedItems(e.target.value)} className="h-10" /></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Approximate weight category</Label>
            <Select value={weightCategory} onValueChange={setWeightCategory}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select weight category" /></SelectTrigger>
              <SelectContent>
                {LUGGAGE_WEIGHT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Additional description (optional)</Label>
            <Textarea value={luggageDescription} onChange={(e) => setLuggageDescription(e.target.value)} placeholder="e.g. pram, cooler box, fragile items" rows={2} />
          </div>
          {luggageTotal < 1 && (
            <p className="text-xs text-amber-700">Add at least one luggage item to continue.</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra information for the driver" rows={2} />
        </div>

        {/* Payment method */}
        <div className="space-y-2">
          <Label>Payment method</Label>
          <div className="flex gap-2">
            {["digital", "cash"].map((opt) => (
              <button key={opt} type="button" onClick={() => setPaymentMethod(opt)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${paymentMethod === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {cashBlocked && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{CASH_NONSTANDARD_MESSAGE}</span>
          </div>
        )}

        {/* Fare: to be negotiated */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Fare</div>
            <div className="mt-0.5 text-sm text-muted-foreground">Your fare will be negotiated with the driver.</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-sm font-semibold border border-border">
            <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
            To be negotiated
          </span>
        </div>

        {/* Negotiation note */}
        <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Pickup and drop-off are marked standard or non-standard to inform fare negotiation. Luggage may be part of fare negotiation. Treba does not calculate or suggest a fare — the final fare is always agreed between you and your driver.</span>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit || submitting} className="h-11 px-6">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Request trip
          </Button>
        </div>
      </form>
    </div>
  );
}