import React from "react";
import { Luggage, AlertTriangle, CheckCircle2 } from "lucide-react";
import { summarizeLuggage, compareLuggageToVehicle, luggageEquivalent } from "@/lib/luggage";

/**
 * Displays structured luggage information for a trip request.
 * When a `vehicle` is provided, shows the capacity comparison.
 */
export default function LuggageSummary({ luggage = {}, vehicle = null, compact = false }) {
  const comparison = compareLuggageToVehicle(luggage, vehicle);
  const summary = summarizeLuggage(luggage);
  const description = luggage.luggage_details;

  if (compact) {
    return <span className="text-sm">{summary}</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Luggage className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Luggage</div>
          <div className="text-sm font-medium">{summary}</div>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
      </div>

      {comparison.hasCapacity && (
        <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
          comparison.exceeds
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}>
          {comparison.exceeds
            ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {comparison.exceeds
              ? `Luggage exceeds this vehicle's configured capacity (${luggageEquivalent(luggage)} of ${comparison.capacity} large-bag units). You may decline, request an adjustment, or ask the passenger to modify their luggage.`
              : `Fits within vehicle capacity (${luggageEquivalent(luggage)} of ${comparison.capacity} large-bag units).`}
          </span>
        </div>
      )}
    </div>
  );
}