import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, Star, CheckCircle2, ArrowLeft, Car, Route as RouteIcon, CalendarClock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function RateTrip() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [booking, setBooking] = useState(null);
  const [trip, setTrip] = useState(null);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const b = await base44.entities.Booking.get(bookingId);
        setBooking(b);
        if (b && b.trip_request_id) {
          try { const t = await base44.entities.TripRequest.get(b.trip_request_id); setTrip(t); } catch (e) {}
        }
        // Check for existing rating by this user.
        try {
          const me = await base44.auth.me();
          const ratings = await base44.entities.Rating.filter({ booking_id: bookingId, reviewer_id: me.id }, "-created_date", 5);
          if (ratings && ratings.length) setExisting(ratings[0]);
        } catch (e) {}
      } catch (err) {
        toast({ title: "Could not load booking", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  const submit = async () => {
    if (score < 1 || score > 5) {
      toast({ title: "Select a star rating", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke("submitRating", { booking_id: bookingId, rating_score: score, comment });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Rating submitted — thank you!" });
      navigate("/app/passenger/requests");
    } catch (err) {
      toast({ title: "Could not submit rating", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!booking) {
    return <div className="py-20 text-center text-muted-foreground">Booking not found.</div>;
  }

  const completed = booking.booking_status === "completed";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link to="/app/passenger/requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to my requests
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Rate your trip</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <RouteIcon className="h-4 w-4 text-primary" /> {booking.origin} → {booking.destination}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {trip?.requested_date || "—"} · {trip?.requested_time || ""}</span>
          {trip?.matched_driver_name && <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {trip.matched_driver_name}</span>}
        </div>
      </div>

      {existing ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-2 text-lg font-bold text-emerald-900">Already rated</h2>
          <p className="mt-1 text-sm text-emerald-700">You rated this trip {existing.rating_score} star{existing.rating_score === 1 ? "" : "s"}.{existing.comment ? ` "${existing.comment}"` : ""}</p>
          <div className="mt-4"><Button onClick={() => navigate("/app/passenger/requests")}>Back to my requests</Button></div>
        </div>
      ) : !completed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm text-amber-800">This trip hasn't been completed yet. You'll be able to rate it once your driver marks the trip as complete.</p>
          <div className="mt-4"><Button variant="outline" onClick={() => navigate("/app/passenger/requests")}>Back to my requests</Button></div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 treba-shadow space-y-5">
          <div>
            <Label>How was your trip?</Label>
            <div className="mt-2 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" disabled={busy} onClick={() => setScore(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} className="rounded-lg p-1 transition-transform hover:scale-110 disabled:opacity-50">
                  <Star className={`h-8 w-8 ${(hover || score) >= n ? "fill-primary text-primary" : "fill-transparent text-muted-foreground/40"}`} />
                </button>
              ))}
              {score > 0 && <span className="ml-2 text-sm font-semibold text-muted-foreground">{score}/5</span>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share details about your experience" rows={3} />
          </div>
          <Button className="w-full h-11" disabled={busy || score < 1} onClick={submit}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
            Submit rating
          </Button>
        </div>
      )}
    </div>
  );
}