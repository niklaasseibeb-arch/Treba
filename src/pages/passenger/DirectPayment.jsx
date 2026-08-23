import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2, ArrowLeft, Banknote, ShieldCheck, CheckCircle2,
  Car, Users, CalendarClock, MapPin, Flag,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Direct Passenger-to-Driver Payment view.
 *
 * Treba does NOT collect, process, hold, transfer or refund the passenger fare,
 * and does NOT charge commission. The passenger pays the driver DIRECTLY using
 * the arrangement they agreed. Treba only records the agreed fare, the payment
 * arrangement, the booking, the trip, the driver and the passenger. The driver
 * may optionally confirm "fare received" (operational record only).
 */
export default function DirectPayment() {
  const { requestId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const trip = await base44.entities.TripRequest.get(requestId);
        let booking = null;
        if (trip?.booking_id) {
          try { booking = await base44.entities.Booking.get(trip.booking_id); } catch (e) {}
        }
        setData({ trip, booking });
      } catch (e) {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const trip = data?.trip;
  const booking = data?.booking;
  if (!trip) {
    return <div className="py-20 text-center text-muted-foreground">Trip request not found.</div>;
  }

  const fare = Number(trip.agreed_fare || booking?.fare_amount || 0);
  const isCash = trip.payment_method === "cash" || booking?.payment_method === "cash_to_driver";
  const arrangement = booking?.payment_arrangement || (isCash ? "Cash to driver" : "Direct to driver (arranged between passenger and driver)");
  const fareReceived = !!booking?.fare_received;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/app/passenger/requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to my requests
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Pay your driver directly</h1>
        <p className="mt-1 text-muted-foreground">{trip.origin} → {trip.destination} · {trip.requested_date} · {trip.requested_time}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Agreed fare</div>
        <div className="text-3xl font-bold">N${fare.toFixed(0)}</div>
        <div className="mt-1 text-xs text-muted-foreground">Negotiated and agreed with your driver. Treba never sets the fare.</div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm">
          <div className="font-semibold">Pay your driver directly — Treba does not process payments</div>
          <p className="mt-1 text-muted-foreground">
            Treba does not collect, hold, transfer or refund your fare, and charges no commission. Arrange payment with your
            driver and pay them directly.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="h-4 w-4 text-primary" /> Payment arrangement
        </div>
        <div className="text-sm">{arrangement}</div>
        {isCash ? (
          <div className="text-sm text-muted-foreground">
            Pay <strong>N${fare.toFixed(0)}</strong> cash to your driver. Your driver will confirm receipt in the app.
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Pay <strong>N${fare.toFixed(0)}</strong> directly to your driver using the arrangement you agreed (e.g. EFT, mobile
            wallet). Treba does not process this payment.
          </div>
        )}
        {fareReceived && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Your driver confirmed they received your fare.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="text-sm font-semibold">Booking details</div>
        <div className="mt-3 grid grid-cols-1 gap-y-3 sm:grid-cols-2">
          <Detail icon={Users} label="Passenger" value={trip.passenger_name || "—"} />
          <Detail icon={Car} label="Driver" value={trip.matched_driver_name || "—"} />
          <Detail icon={CalendarClock} label="Departure" value={`${trip.requested_date || ""} · ${trip.requested_time || ""}`} />
          <Detail icon={MapPin} label="Pickup" value={trip.pickup_location || "—"} />
          <Detail icon={Flag} label="Drop-off" value={trip.dropoff_location || "—"} />
          <Detail icon={CheckCircle2} label="Booking status" value={booking?.booking_status || "—"} />
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{value}</span>
      </div>
    </div>
  );
}