import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatPrice = (n) => `N$${Number(n || 0).toLocaleString()}`;

export default function SubscriptionPaymentHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        const list = await base44.entities.SubscriptionPayment.filter(
          { driver_user_id: me.id },
          "-created_date",
          25
        );
        setRows(list || []);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payment history</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subscription payments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card treba-shadow">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Renewal</th>
                <th className="px-4 py-3 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.plan_name}</td>
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}