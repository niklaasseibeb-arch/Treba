import React, { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

const STATUS_TONES = {
  earnings_pending: "bg-amber-100 text-amber-700",
  available_for_payout: "bg-emerald-100 text-emerald-700",
  payout_processing: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  reversed: "bg-slate-200 text-slate-700",
};

const STATUS_LABELS = {
  earnings_pending: "Earnings pending",
  available_for_payout: "Available for payout",
  payout_processing: "Payout processing",
  paid: "Paid",
  failed: "Failed",
  reversed: "Reversed",
};

export default function PayoutHistorySection() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await base44.entities.PayoutTransaction.filter({ driver_user_id: user.id }, "-created_date", 50);
        if (active) setRows(list || []);
      } catch (e) {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Payout history</h2>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No payout transactions yet. Your earnings will appear here once you complete paid trips.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <div>
                <div className="font-medium">{r.description || "Payout"}</div>
                <div className="text-xs text-muted-foreground">
                  N${r.amount} {r.fee_amount ? `· fee N${r.fee_amount}` : ""} · net N${r.net_amount ?? r.amount}
                </div>
                {r.transaction_reference && (
                  <div className="text-xs font-mono text-muted-foreground">ref: {r.transaction_reference}</div>
                )}
              </div>
              <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONES[r.status] || "bg-slate-100 text-slate-700"}`}>
                {STATUS_LABELS[r.status] || r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}