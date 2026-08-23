import React from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const ITEMS = [
  { key: "driver_approved", label: "Driver profile approved" },
  { key: "vehicle_approved", label: "Vehicle verified" },
  { key: "has_confirmed_passengers", label: "Confirmed passengers on manifest" },
  { key: "all_paid", label: "All confirmed passengers paid" },
];

export default function TripOpsChecks({ checks, blockingReasons, adminOverride }) {
  if (!checks) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
      <div className="text-sm font-semibold">Mandatory operational checks</div>
      <p className="mt-1 text-xs text-muted-foreground">The trip cannot start until all conditions are satisfied, unless an administrator override exists.</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ITEMS.map((it) => {
          const ok = !!checks[it.key];
          const Icon = ok ? CheckCircle2 : XCircle;
          return (
            <li key={it.key} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{it.label}</span>
            </li>
          );
        })}
      </ul>
      {adminOverride && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> Administrator override is active — the driver may start despite failed checks.
        </div>
      )}
      {blockingReasons && blockingReasons.length > 0 && !adminOverride && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Cannot start: {blockingReasons.join("; ")}.
        </div>
      )}
    </div>
  );
}