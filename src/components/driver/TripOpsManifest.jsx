import React from "react";
import { Phone, MessageSquare, CheckCircle2, AlertTriangle, MapPin, Flag, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAY_TONE = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  refunded: "bg-slate-200 text-slate-700",
};
const NS_TONE = {
  none: "bg-slate-100 text-slate-600",
  arrived: "bg-emerald-100 text-emerald-700",
  passenger_no_show: "bg-rose-100 text-rose-700",
  disputed: "bg-amber-100 text-amber-700",
  upheld: "bg-rose-100 text-rose-700",
  overturned: "bg-emerald-100 text-emerald-700",
};

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <div>
        <div className="text-muted-foreground">{label}</div>
        <div className="font-medium text-foreground">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function TripOpsManifest({ manifest, busyId, onArrived, onReportNoShow }) {
  if (manifest.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">No confirmed passengers on today's manifest.</div>;
  }
  return (
    <ul className="space-y-3">
      {manifest.map((p) => (
        <li key={p.booking_id} className="rounded-2xl border border-border bg-card p-4 treba-shadow">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{p.passenger_name}</div>
              <div className="text-xs text-muted-foreground">{p.number_of_seats} seat(s)</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAY_TONE[p.payment_status] || "bg-slate-100 text-slate-700"}`}>Payment: {p.payment_status || "—"}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${NS_TONE[p.no_show_status] || NS_TONE.none}`}>{p.no_show_status.replace(/_/g, " ")}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field icon={MapPin} label="Pickup" value={p.pickup} />
            <Field icon={Flag} label="Drop-off" value={p.dropoff} />
            <Field icon={Luggage} label="Luggage" value={p.luggage} />
            <Field icon={MessageSquare} label="Special notes" value={p.special_notes} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {p.passenger_phone && <Button asChild variant="outline" size="sm"><a href={`tel:${p.passenger_phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a></Button>}
            {p.passenger_phone && <Button asChild variant="outline" size="sm"><a href={`sms:${p.passenger_phone}`}><MessageSquare className="mr-2 h-4 w-4" /> Message</a></Button>}
            {!p.passenger_arrived && p.no_show_status === "none" && (
              <Button size="sm" disabled={busyId === p.booking_id} onClick={() => onArrived(p)}>
                {busyId === p.booking_id ? "…" : <CheckCircle2 className="mr-2 h-4 w-4" />} Passenger arrived
              </Button>
            )}
            {p.no_show_status === "none" && (
              <Button variant="destructive" size="sm" onClick={() => onReportNoShow(p)}>
                <AlertTriangle className="mr-2 h-4 w-4" /> Passenger no-show
              </Button>
            )}
            {p.passenger_arrived && <span className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Arrived</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}