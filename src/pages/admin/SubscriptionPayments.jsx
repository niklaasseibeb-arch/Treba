import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const STATUS_OPTIONS = ["all", "pending", "successful", "failed", "cancelled", "refunded"];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatPrice = (n) => `N$${Number(n || 0).toLocaleString()}`;

export default function AdminSubscriptionPayments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.SubscriptionPayment.list("-created_date", 200);
        setRows(list || []);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = status === "all" ? rows : rows.filter((r) => r.payment_status === status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Driver subscription payments collected by Treba. Treba accepts payments only for driver subscriptions — never
          passenger fares.
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
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Payment date</th>
                <th className="px-4 py-3 font-semibold">Renewal date</th>
                <th className="px-4 py-3 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.driver_name || r.driver_user_id}</td>
                  <td className="px-4 py-3">{r.plan_name}</td>
                  <td className="px-4 py-3">{formatPrice(r.amount)}</td>
                  <td className="px-4 py-3 capitalize">{(r.payment_method || "").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.payment_status} />
                  </td>
                  <td className="px-4 py-3">{fmtDate(r.payment_date)}</td>
                  <td className="px-4 py-3">{fmtDate(r.renewal_date)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.payment_reference || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No subscription payments.
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