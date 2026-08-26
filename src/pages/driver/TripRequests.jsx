import React, { useEffect, useState } from "react";
import {
  Loader2, Inbox, Car, Users, MapPin, Flag, CalendarClock, Clock,
  CheckCircle2, XCircle, AlertTriangle, Sparkles,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import LuggageSummary from "@/components/LuggageSummary";
import FareNegotiationPanel from "@/components/fare/FareNegotiationPanel";

const PRIORITY_STYLE = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700",
  released: "bg-slate-200 text-slate-600",
};

function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[priority] || PRIORITY_STYLE.medium}`}>
      {priority} priority
    </span>
  );
}

function StandardBadge({ isStandard }) {
  return isStandard ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Standard
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3 w-3" /> Non-standard
    </span>
  );
}

export default function DriverTripRequests() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState(null);
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getDriverTripRequests", {});
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      setVehicle(res.data?.vehicle || null);
      setRequests(res.data?.requests || []);
    } catch (err) {
      toast({ title: "Could not load trip requests", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const respondToRequest = async (offer, action) => {
    setBusyId(offer.id);
    try {
      const res = await base44.functions.invoke("respondToTripOffers", { offer_id: offer.id, action: "available" });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      toast({ title: action === "available" ? "Trip confirmed — scheduled" : "Unavailable" });
      load();
    } catch (err) {
      toast({ title: "Could not respond", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

    const confirmFareReceived = async (bookingId) => {
    setBusyId(bookingId);
    try {
      const res = await base44.functions.invoke("confirmFareReceived", { booking_id: bookingId });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Fare received recorded" });
      load();
    } catch (err) {
      toast({ title: "Could not confirm", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trip Offer</h1>
        <p className="mt-1 text-muted-foreground">Passenger requests Treba has matched to your scheduled routes. Accept the trip to open fare negotiation — you are not accepting a fixed fare.</p>
      </div>

      {vehicle && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 treba-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Car className="h-5 w-5" /></div>
          <div>
            <div className="text-sm font-semibold">{vehicle.label}</div>
            <div className="text-xs text-muted-foreground">Luggage capacity: {vehicle.luggage_capacity ?? 0} large-bag units · Seats: {vehicle.seating_capacity ?? 0}</div>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No new passenger requests matched to you right now.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const isNew = r.request_status === "matched";
            const negotiationActive = r.negotiation_state && r.negotiation_state !== "not_started";
            return (
              <li key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card treba-shadow">
                <div className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${isNew ? "bg-primary/10" : "bg-muted/40"}`}>
                  <div className="flex items-center gap-2">
                    {isNew ? <Sparkles className="h-4 w-4 text-primary" /> : <Inbox className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-bold uppercase tracking-wide">{isNew ? "New passenger request" : "Passenger request"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {r.request_status.replace("_", " ")}
                    </span>
                    {r.booking?.priority && <PriorityBadge priority={r.booking.priority} />}
                  </div>
                </div>

                <div className="p-5">
                  <div className="font-semibold text-lg">{r.origin} → {r.destination}</div>

                  <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Detail icon={Users} label="Passenger" value={r.passenger_name || "—"} />
                    <Detail icon={CalendarClock} label="Date" value={r.requested_date} />
                    <Detail icon={Clock} label="Preferred departure" value={r.requested_time} />
                    <Detail icon={Users} label="Number of passengers" value={String(r.number_of_seats || 1)} />
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Pickup</div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.pickup_location}</span>
                        <StandardBadge isStandard={r.pickup_is_standard} />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Drop-off</div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                        <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{r.dropoff_location}</span>
                        <StandardBadge isStandard={r.dropoff_is_standard} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4"><LuggageSummary luggage={r} vehicle={vehicle} /></div>
                  {r.notes && <p className="mt-3 text-xs text-muted-foreground">Notes: {r.notes}</p>}

                  {isNew ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button className="h-10" disabled={busyId === r.id} onClick={() => respondToRequest(r, "accept")}>
                        {busyId === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Accept request
                      </Button>
                      <Button variant="outline" className="h-10 text-destructive hover:bg-destructive/5" disabled={busyId === r.id} onClick={() => respondToRequest(r, "decline")}>
                        {busyId === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                        Decline request
                      </Button>
                    </div>
                  ) : negotiationActive || r.request_status === "driver_accepted" || r.request_status === "booked" ? (
                    <div className="mt-5">
                      <FareNegotiationPanel tripRequest={r} role="driver" onUpdated={load} />
                      {r.negotiation_state === "fare_agreed" && r.payment?.payment_category === "cash" && r.payment?.payment_status === "pending" && (
                        <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-amber-900">Payment method: Cash to driver</div>
                              <div className="text-xs text-amber-800">Collect N${Number(r.payment.amount || 0).toFixed(0)} from the passenger.</div>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                              {(r.payment.cash_status || "cash_pending").replace("_", " ")}
                            </span>
                          </div>
                          {r.payment.cash_check_in_deadline && (
                            <div className="text-xs text-amber-800">Cash check-in deadline: {new Date(r.payment.cash_check_in_deadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                          )}
                          <Button size="sm" disabled={busyId === r.id} onClick={() => confirmCash(r.id)}>
                            {busyId === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirm cash received
                          </Button>
                        </div>
                      )}
                      {r.negotiation_state === "fare_agreed" && r.booking && r.booking.payment_method !== "cash_to_driver" && (
                        <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-emerald-900">Payment: direct to you</div>
                              <div className="text-xs text-emerald-800">
                                Collect N${Number(r.agreed_fare || 0).toFixed(0)} directly from the passenger
                                {r.booking.payment_arrangement ? ` (${r.booking.payment_arrangement})` : ""}. Treba does not process payments.
                              </div>
                            </div>
                            {r.booking.fare_received && (
                              <span className="inline-flex items-center rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Fare received</span>
                            )}
                          </div>
                          {!r.booking.fare_received && (
                            <Button size="sm" disabled={busyId === r.booking.id} onClick={() => confirmFareReceived(r.booking.id)}>
                              {busyId === r.booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              Confirm fare received
                            </Button>
                          )}
                        </div>
                      )}
                      {!["booked", "cancelled"].includes(r.request_status) && (
                        <div className="mt-3">
                          <Button variant="ghost" className="h-8 text-xs text-destructive hover:bg-destructive/5" disabled={busyId === r.id} onClick={() => respondToRequest(r, "decline")}>
                            <XCircle className="mr-2 h-3.5 w-3.5" /> Decline this trip
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{value || "—"}</span>
      </div>
    </div>
  );
}