import React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground border-border",
  yellow: "bg-primary/15 text-foreground border-primary/30",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
};

/**
 * Map a raw status string to a consistent tone for display.
 */
export function statusTone(status) {
  if (!status) return "neutral";
  const s = String(status).toLowerCase();
  if (["approved", "confirmed", "completed", "successful", "paid", "available", "active"].includes(s)) return "green";
  if (["pending", "scheduled", "expiring"].includes(s)) return "amber";
  if (["rejected", "cancelled", "failed", "suspended", "expired"].includes(s)) return "red";
  if (["departed", "refunded", "trial"].includes(s)) return "blue";
  return "neutral";
}

export default function StatusBadge({ status, label, className }) {
  const tone = TONES[statusTone(status)] || TONES.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        tone,
        className
      )}
    >
      {label || status || "—"}
    </span>
  );
}