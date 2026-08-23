import React, { useEffect, useState } from "react";
import { Loader2, Banknote, Percent, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

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
  available_for_payout: "Available",
  payout_processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  reversed: "Reversed",
};

export default function AdminDriverPayouts() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fee, setFee] = useState({ name: "Default", commission_percentage: 10, cash_booking_fee_percentage: 5, fixed_fee_per_trip: 0, min_fee: 0, is_active: true, description: "" });
  const [feeId, setFeeId] = useState(null);
  const [savingFee, setSavingFee] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [txns, setTxns] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const configs = await base44.entities.PayoutFeeConfig.list("-created_date", 50);
      const active = (configs || []).find((c) => c.is_active) || (configs || [])[0] || null;
      if (active) {
        setFeeId(active.id);
        setFee({
          name: active.name || "Default",
          commission_percentage: active.commission_percentage ?? 10,
          cash_booking_fee_percentage: active.cash_booking_fee_percentage ?? 5,
          fixed_fee_per_trip: active.fixed_fee_per_trip ?? 0,
          min_fee: active.min_fee ?? 0,
          is_active: !!active.is_active,
          description: active.description || "",
        });
      }
      const allBookings = await base44.entities.Booking.list("-created_date", 200);
      setBookings((allBookings || []).filter((b) => b.payment_status === "paid" && b.booking_status !== "completed"));
      const allTxns = await base44.entities.PayoutTransaction.list("-created_date", 200);
      setTxns(allTxns || []);
    } catch (err) {
      toast({ title: "Could not load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveFee = async () => {
    setSavingFee(true);
    try {
      const payload = {
        name: fee.name.trim() || "Default",
        commission_percentage: Number(fee.commission_percentage) || 0,
        cash_booking_fee_percentage: Number(fee.cash_booking_fee_percentage) || 0,
        fixed_fee_per_trip: Number(fee.fixed_fee_per_trip) || 0,
        min_fee: Number(fee.min_fee) || 0,
        is_active: !!fee.is_active,
        description: fee.description,
      };
      if (feeId) await base44.entities.PayoutFeeConfig.update(feeId, payload);
      else { const c = await base44.entities.PayoutFeeConfig.create(payload); setFeeId(c.id); }
      toast({ title: "Fee model saved" });
      load();
    } catch (err) { toast({ title: "Could not save", description: err.message, variant: "destructive" }); }
    finally { setSavingFee(false); }
  };

  const completeTrip = async (b) => {
    setBusyId(b.id);
    try {
      const res = await base44.functions.invoke("recordTripCompletion", { booking_id: b.id });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: "Trip completed — earning released" });
      load();
    } catch (err) { toast({ title: "Could not complete", description: err.message, variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  const settle = async (txn, status) => {
    setBusyId(txn.id);
    try {
      const res = await base44.functions.invoke("updatePayoutStatus", { payout_id: txn.id, status });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: `Payout marked ${status}` });
      load();
    } catch (err) { toast({ title: "Could not update", description: err.message, variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Banknote className="h-6 w-6 text-primary" /> Driver Earnings & Payouts</h1>
        <p className="mt-1 text-muted-foreground">Review driver earnings and payouts. The fee model is configurable — Treba never hard-codes commission.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center gap-2 text-sm font-semibold"><Percent className="h-4 w-4 text-primary" /> Treba fee model</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5"><Label>Digital commission %</Label><Input type="number" value={fee.commission_percentage} onChange={(e) => setFee({ ...fee, commission_percentage: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5"><Label>Cash booking fee %</Label><Input type="number" value={fee.cash_booking_fee_percentage} onChange={(e) => setFee({ ...fee, cash_booking_fee_percentage: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5"><Label>Fixed fee per trip (N$)</Label><Input type="number" value={fee.fixed_fee_per_trip} onChange={(e) => setFee({ ...fee, fixed_fee_per_trip: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5"><Label>Minimum fee (N$)</Label><Input type="number" value={fee.min_fee} onChange={(e) => setFee({ ...fee, min_fee: e.target.value })} className="h-10" /></div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fee.is_active} onChange={(e) => setFee({ ...fee, is_active: e.target.checked })} /> Active</label>
          <Button disabled={savingFee} onClick={saveFee} className="ml-auto">{savingFee && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save fee model</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="text-sm font-semibold">Paid trips awaiting completion</div>
        <p className="mt-1 text-xs text-muted-foreground">Completing a trip releases the driver's pending earning to available for payout.</p>
        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No paid trips awaiting completion.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium">{b.origin} → {b.destination}</div>
                  <div className="text-xs text-muted-foreground">Fare N${b.fare_amount || 0} · {b.passenger_name || "Passenger"} · {b.payment_method === "cash_to_driver" ? "Cash" : "Digital"}</div>
                </div>
                <Button size="sm" disabled={busyId === b.id} onClick={() => completeTrip(b)}>{busyId === b.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete trip</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="text-sm font-semibold">Payout transactions</div>
        {txns.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payout transactions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {txns.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium">{t.description || "Transaction"}</div>
                  <div className="text-xs text-muted-foreground">N${t.amount} {t.fee_amount ? `· fee N${t.fee_amount}` : ""} · net N${t.net_amount ?? t.amount}</div>
                  {t.transaction_reference && <div className="text-xs font-mono text-muted-foreground">ref: {t.transaction_reference}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONES[t.status] || "bg-slate-100 text-slate-700"}`}>{STATUS_LABELS[t.status] || t.status}</span>
                  {t.status === "payout_processing" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={busyId === t.id} onClick={() => settle(t, "paid")}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Paid</Button>
                      <Button size="sm" variant="outline" disabled={busyId === t.id} onClick={() => settle(t, "failed")}><AlertTriangle className="mr-1 h-3.5 w-3.5" />Failed</Button>
                      <Button size="sm" variant="outline" disabled={busyId === t.id} onClick={() => settle(t, "reversed")}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reversed</Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}