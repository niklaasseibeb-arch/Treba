import React from "react";
import { CheckCircle2, MapPin, Flag, Users, Car, Route as RouteIcon, CalendarClock, Banknote, CreditCard, Smartphone, Radio, Wallet, Luggage, Clock, Hash, ShieldCheck } from "lucide-react";

const METHOD_ICON = {
  bank_card: CreditCard,
  mobile_wallet: Smartphone,
  pay2cell: Radio,
  other_digital: Wallet,
  cash_to_driver: Banknote,
};

const STATE_LABEL = {
  paid: "Paid",
  cash_pending: "Cash pending",
  cash_overdue: "Cash overdue",
  failed: "Failed",
  refunded: "Refunded",
  pending: "Awaiting payment",
};

const PRIORITY_STYLE = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700",
  released: "bg-slate-200 text-slate-600",
};

function nad(n) { return `N$${Number(n || 0).toFixed(0)}`; }
function fmt(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return String(d); }
}

function Field({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span>{value || "—"}</span>
      </div>
    </div>
  );
}

export default function BookingConfirmationCard({ trip, booking, payment }) {
  if (!booking && !trip) return null;
  const b = booking || {};
  const t = trip || {};
  const method = b.payment_method || (payment && payment.payment_method);
  const MethodIcon = METHOD_ICON[method] || CreditCard;
  const priority = b.priority || "medium";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Booking confirmation
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[priority] || PRIORITY_STYLE.medium}`}>
          {priority} priority
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field icon={Hash} label="Booking ID" value={b.id} />
        <Field icon={Hash} label="Trip request ID" value={t.id} />
        <Field icon={Users} label="Passenger" value={b.passenger_name || t.passenger_name} />
        <Field icon={Car} label="Driver" value={t.matched_driver_name} />
        <Field icon={RouteIcon} label="Route" value={`${t.origin || b.origin || ""} → ${t.destination || b.destination || ""}`} />
        <Field icon={CalendarClock} label="Scheduled service" value={`${t.requested_date || ""} · ${t.requested_time || ""}`} />
        <Field icon={MapPin} label="Pickup" value={b.pickup_location || t.pickup_location} />
        <Field icon={Flag} label="Drop-off" value={b.dropoff_location || t.dropoff_location} />
        <Field icon={Luggage} label="Luggage" value={b.luggage_summary || "—"} />
        <Field icon={MethodIcon} label="Payment method" value={method ? method.replace(/_/g, " ") : "—"} />
        <Field icon={Clock} label="Payment status" value={STATE_LABEL[b.payment_state] || (payment && payment.payment_status) || "—"} />
        <Field icon={CheckCircle2} label="Booking status" value={b.booking_status || "—"} />
        <Field icon={CheckCircle2} label="Fare agreed" value={nad(t.agreed_fare || b.fare_amount)} />
        <Field icon={Clock} label="Confirmation timestamp" value={fmt(b.confirmed_at)} />
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4" />
        <span>Your seat is retained. Paid and confirmed bookings are never silently removed. Cash-pending holds are temporary and may be released only if overdue when a higher-priority paid booking needs the capacity.</span>
      </div>
    </div>
  );
}