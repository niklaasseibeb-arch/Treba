import React from "react";
import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              accent ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}