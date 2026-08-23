import React from "react";
import { LogIn, LogOut, CheckCircle2, AlertTriangle, UserX, CarFront, Ban, FileWarning } from "lucide-react";

const EVENT_META = {
  passenger_check_in: { icon: LogIn, tone: "bg-emerald-100 text-emerald-700", label: "Passenger check-in" },
  trip_start: { icon: CarFront, tone: "bg-blue-100 text-blue-700", label: "Trip start" },
  trip_completion: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700", label: "Trip completion" },
  passenger_no_show: { icon: UserX, tone: "bg-rose-100 text-rose-700", label: "Passenger no-show" },
  driver_no_show: { icon: CarFront, tone: "bg-rose-100 text-rose-700", label: "Driver no-show" },
  cancellation: { icon: Ban, tone: "bg-slate-200 text-slate-700", label: "Cancellation" },
  incident: { icon: FileWarning, tone: "bg-amber-100 text-amber-700", label: "Incident" },
};

export default function TripOpsEvents({ events }) {
  if (!events || events.length === 0) {
    return <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground treba-shadow">No operational events recorded yet.</div>;
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
      <div className="text-sm font-semibold">Operational event timeline</div>
      <ol className="mt-3 space-y-2">
        {events.map((e) => {
          const meta = EVENT_META[e.event_type] || { icon: LogOut, tone: "bg-slate-100 text-slate-700", label: e.event_type };
          const Icon = meta.icon;
          return (
            <li key={e.id} className="flex items-start gap-3 text-sm">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.tone}`}><Icon className="h-4 w-4" /></span>
              <div className="flex-1">
                <div className="font-medium">{meta.label}</div>
                {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                <div className="text-xs text-muted-foreground">{new Date(e.recorded_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}