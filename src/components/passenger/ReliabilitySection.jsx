import React from "react";
import { CheckCircle2, XCircle, UserX, Star } from "lucide-react";

const STATS = [
  { key: "completed_trips_count", label: "Completed trips", icon: CheckCircle2, tone: "emerald" },
  { key: "cancellation_count", label: "Cancellations", icon: XCircle, tone: "amber" },
  { key: "no_show_count", label: "No-shows", icon: UserX, tone: "rose" },
];

const toneClasses = {
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
};

export default function ReliabilitySection({ profile }) {
  const score = profile?.reliability_score ?? 100;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 treba-shadow">
      <div>
        <h2 className="text-lg font-semibold">Reliability</h2>
        <p className="text-sm text-muted-foreground">
          Treba tracks your trip history to keep the marketplace trustworthy for drivers and passengers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="rounded-xl border border-border bg-muted/30 p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses[s.tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-2xl font-bold">{profile?.[s.key] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Star className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">Reliability score: {score}%</div>
          <div className="text-xs text-muted-foreground">
            Based on completed trips, cancellations and no-shows. Keep it high to stay in good standing.
          </div>
        </div>
      </div>
    </div>
  );
}