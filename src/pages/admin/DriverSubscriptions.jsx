import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const STATUS_OPTIONS = ["all", "trial", "active", "expiring", "expired", "suspended", "cancelled"];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" }) : "—";

const daysLeft = (s) => {
  if (!s) return "—";
  const end = s.is_trial ? s.end_date : s.renewal_date;
  if (!end) return "—";
  const v = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  return v < 0 ? "0" : String(v);
};

export default function AdminDriverSubscriptions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.DriverSubscription.list("-created_date", 100);
      setRows(list || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = status === "all" ? rows : rows.filter((r) => (r.status || "") === status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Driver Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor driver subscriptions and 60-day free trials — trial start, trial end, days remaining and trips
          completed during the trial. Treba collects only the monthly subscription — no commission on passenger fares.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
              status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card treba-shadow">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Trips completed</th>
                <th className="px-4 py-3 font-semibold">Start</th>
                <th className="px-4 py-3 font-semibold">End / Renewal</th>
                <th className="px-4 py-3 font-semibold">Days left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.driver_name || r.driver_user_id}</td>
                  <td className="px-4 py-3">
                    {r.is_trial ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        Free trial
                      </span>
                    ) : (
                      r.plan_name || "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.is_unlimited ? `${r.trips_used || 0} (unlimited)` : `${r.trips_used || 0} / ${r.trip_allowance}`}
                  </td>
                  <td className="px-4 py-3">{fmtDate(r.start_date)}</td>
                  <td className="px-4 py-3">{fmtDate(r.is_trial ? r.end_date : r.renewal_date)}</td>
                  <td className="px-4 py-3 font-semibold">{daysLeft(r)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No subscriptions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}