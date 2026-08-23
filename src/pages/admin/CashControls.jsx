import React, { useEffect, useState } from "react";
import { Loader2, Banknote, Save, Clock, AlertTriangle, ShieldAlert, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function AdminCashControls() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState(null);
  const [form, setForm] = useState({ name: "Default", check_in_minutes_before: 15, release_seat_after_deadline: false, no_show_threshold: 3, is_active: true, description: "" });
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [restricted, setRestricted] = useState([]);

  const load = async () => {
    try {
      const list = await base44.entities.CashPaymentConfig.list("-created_date", 50);
      const active = (list || []).find((c) => c.is_active) || (list || [])[0] || null;
      if (active) {
        setConfigId(active.id);
        setForm({
          name: active.name || "Default",
          check_in_minutes_before: active.check_in_minutes_before ?? 15,
          release_seat_after_deadline: !!active.release_seat_after_deadline,
          no_show_threshold: active.no_show_threshold ?? 3,
          is_active: !!active.is_active,
          description: active.description || "",
        });
      }
      const profiles = await base44.entities.PassengerProfile.list("-created_date", 500);
      setRestricted((profiles || []).filter((p) => p.cash_restricted || p.requires_digital_payment || p.account_review));
    } catch (err) {
      toast({ title: "Could not load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim() || "Default",
        check_in_minutes_before: Number(form.check_in_minutes_before) || 0,
        release_seat_after_deadline: !!form.release_seat_after_deadline,
        no_show_threshold: Number(form.no_show_threshold) || 3,
        is_active: !!form.is_active,
        description: form.description,
      };
      if (configId) await base44.entities.CashPaymentConfig.update(configId, payload);
      else {
        const created = await base44.entities.CashPaymentConfig.create(payload);
        setConfigId(created.id);
      }
      toast({ title: "Cash controls saved" });
      load();
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const process = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke("processCashDeadlines", {});
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      setResult(res.data);
      toast({ title: "Cash deadlines processed" });
      load();
    } catch (err) {
      toast({ title: "Could not process", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Banknote className="h-6 w-6 text-primary" /> Cash Controls</h1>
        <p className="mt-1 text-muted-foreground">Cash is a controlled payment option — not equivalent to a completed digital payment. Configure the check-in deadline, seat release and no-show rules.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Cash passengers may only use standard pickup and drop-off points. A digital paid booking always ranks higher than a cash-pending booking. Paid bookings are never automatically refunded or cancelled.</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-primary" /> Check-in deadline</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Minutes before departure</Label><Input type="number" min="0" value={form.check_in_minutes_before} onChange={(e) => setForm({ ...form, check_in_minutes_before: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5"><Label>No-show threshold (cash restrictions)</Label><Input type="number" min="1" value={form.no_show_threshold} onChange={(e) => setForm({ ...form, no_show_threshold: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-10" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.release_seat_after_deadline} onChange={(e) => setForm({ ...form, release_seat_after_deadline: e.target.checked })} /> Release seat after deadline (auto no-show)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button className="h-10" disabled={saving} onClick={save}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save controls</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Process overdue cash bookings</div>
          <Button variant="outline" className="h-9" disabled={processing} onClick={process}>{processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Process now</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Marks cash bookings past their deadline as overdue (lower priority), and releases seats / applies no-show restrictions if enabled. In production this runs on a schedule.</p>
        {result && (
          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-xl bg-muted/40 p-3"><div className="font-bold">{result.processed ?? 0}</div><div className="text-xs text-muted-foreground">Processed</div></div>
            <div className="rounded-xl bg-muted/40 p-3"><div className="font-bold">{result.marked_overdue ?? 0}</div><div className="text-xs text-muted-foreground">Marked overdue</div></div>
            <div className="rounded-xl bg-muted/40 p-3"><div className="font-bold">{result.seats_released ?? 0}</div><div className="text-xs text-muted-foreground">Seats released</div></div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-primary" /> Passengers with cash restrictions</div>
        {restricted.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No passengers are currently restricted from cash.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {restricted.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                <span className="font-medium">{p.full_name || p.id}</span>
                <span className="flex flex-wrap gap-1">
                  {p.cash_restricted && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Cash restricted</span>}
                  {p.requires_digital_payment && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Digital required</span>}
                  {p.account_review && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">Review</span>}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">No-shows: {p.cash_no_show_count || 0}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}