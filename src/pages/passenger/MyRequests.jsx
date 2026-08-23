import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Inbox, MapPin, Flag, CalendarClock, Clock, Users, Car } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import FareNegotiationPanel from "@/components/fare/FareNegotiationPanel";
import LuggageSummary from "@/components/LuggageSummary";
import NoShowDisputeBanner from "@/components/passenger/NoShowDisputeBanner";
import DriverNoShowPanel from "@/components/passenger/DriverNoShowPanel";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, AlertTriangle, Star, Banknote, ArrowRightLeft } from "lucide-react";
import TransferEligibleServicesDialog from "@/components/passenger/TransferEligibleServicesDialog";

function PaymentAction({ tripRequest }) {
  const paid = tripRequest.payment_status === "paid";
  const isCash = tripRequest.payment_method === "cash";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
      <div className="text-sm">
        {paid ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Booking confirmed — pay your driver directly</span>
        ) : isCash ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700"><Banknote className="h-4 w-4" /> Cash to driver — pay your driver directly</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-700"><CreditCard className="h-4 w-4" /> Pay your driver directly</span>
        )}
      </div>
      <Button asChild>
        <Link to={`/app/passenger/booking/${tripRequest.id}`}>View details</Link>
      </Button>
    </div>
  );
}

const STATUS_LABELS = {
  requested: "Looking for a driver",
  pending: "Looking for a driver",
  matched: "Sent to a driver",
  driver_accepted: "Driver accepted",
  driver_responded: "Driver responded",
  booked: "Fare agreed",
  cancelled: "Cancelled",
};

const STATUS_TONES = {
  requested: "bg-slate-100 text-slate-600",
  pending: "bg-slate-100 text-slate-600",
  matched: "bg-amber-100 text-amber-700",
  driver_accepted: "bg-blue-100 text-blue-700",
  driver_responded: "bg-violet-100 text-violet-700",
  booked: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function MyRequests() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [bookingStatuses, setBookingStatuses] = useState({});
  const [ratedBookings, setRatedBookings] = useState({});
  const [transferBookingId, setTransferBookingId] = useState(null);

  const load = async () => {
    try {
      const list = await base44.entities.TripRequest.list("-created_date", 100);
      setRequests(list || []);
      // Fetch booking statuses + rating state for paid requests that have a booking.
      const paidWithBooking = (list || []).filter((r) => r.payment_status === "paid" && r.booking_id);
      if (paidWithBooking.length) {
        const ids = [...new Set(paidWithBooking.map((r) => r.booking_id))];
        const bookings = await Promise.all(ids.map((id) => base44.entities.Booking.get(id).catch(() => null)));
        const statusMap = {};
        bookings.forEach((b) => { if (b) statusMap[b.id] = b.booking_status; });
        setBookingStatuses(statusMap);
        // Check which bookings already have a rating by this user.
        try {
          const me = await base44.auth.me();
          const ratings = await Promise.all(ids.map((id) => base44.entities.Rating.filter({ booking_id: id, reviewer_id: me.id }, "-created_date", 1).catch(() => [])));
          const ratedMap = {};
          ids.forEach((id, i) => { if (ratings[i] && ratings[i].length) ratedMap[id] = true; });
          setRatedBookings(ratedMap);
        } catch (e) {}
      }
    } catch (err) {
      toast({ title: "Could not load your requests", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpdated = useCallback(() => { load(); }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Requests</h1>
        <p className="mt-1 text-muted-foreground">Track your trip requests and negotiate your fare with the matched driver.</p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">You haven't requested any trips yet.</p>
        </div>
      ) : (
        <ul className="space-y-5">
          {requests.map((r) => {
            const negotiationActive = r.negotiation_state && r.negotiation_state !== "not_started";
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-lg">{r.origin} → {r.destination}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {r.requested_date} · {r.requested_time}</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {r.number_of_seats} passenger(s)</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {r.pickup_location}</span>
                      <span className="inline-flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> {r.dropoff_location}</span>
                    </div>
                    {r.matched_driver_name && (
                      <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Car className="h-3.5 w-3.5" /> Driver: {r.matched_driver_name}</div>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[r.request_status] || "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABELS[r.request_status] || r.request_status}
                  </span>
                </div>

                <div className="mt-3"><LuggageSummary luggage={r} /></div>

                {negotiationActive || r.request_status === "driver_accepted" || r.request_status === "booked" ? (
                  <div className="mt-4 space-y-3">
                    <FareNegotiationPanel tripRequest={r} role="passenger" onUpdated={handleUpdated} />
                    {r.negotiation_state === "fare_agreed" && <PaymentAction tripRequest={r} />}
                    {r.negotiation_state === "fare_agreed" && r.booking_id && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
                        <div className="text-sm text-muted-foreground">Want a different driver on the same route and date? Request a transfer to another eligible service.</div>
                        <Button variant="outline" size="sm" onClick={() => setTransferBookingId(r.booking_id)}>
                          <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" /> Request transfer
                        </Button>
                      </div>
                    )}
                    {r.negotiation_state === "fare_agreed" && <NoShowDisputeBanner tripRequestId={r.id} />}
                    {r.negotiation_state === "fare_agreed" && r.payment_status === "paid" && <DriverNoShowPanel tripRequest={r} />}
                    {r.negotiation_state === "fare_agreed" && r.payment_status === "paid" && r.booking_id && bookingStatuses[r.booking_id] === "completed" && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-center gap-2 text-sm text-amber-800">
                          <Star className="h-4 w-4" />
                          {ratedBookings[r.booking_id]
                            ? <span>You've rated this trip. Thank you!</span>
                            : <span>Your trip is complete — rate your driver to help keep Treba reliable.</span>}
                        </div>
                        {!ratedBookings[r.booking_id] && (
                          <Button asChild size="sm">
                            <Link to={`/app/passenger/rate/${r.booking_id}`}><Star className="mr-1.5 h-3.5 w-3.5" /> Rate trip</Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : r.request_status === "matched" ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                    <Clock className="h-4 w-4" /> Waiting for the driver to accept your request and open fare negotiation.
                  </div>
                ) : r.request_status === "cancelled" ? (
                  <div className="mt-4 text-sm text-rose-600">This request was cancelled.</div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> Treba is looking for a scheduled driver for your trip.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {transferBookingId && (
        <TransferEligibleServicesDialog
          bookingId={transferBookingId}
          onClose={() => setTransferBookingId(null)}
          onRequested={() => setTransferBookingId(null)}
        />
      )}
    </div>
  );
}