import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Clock, Scale, MapPin, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const STATUS_TONE = {
  reported: "bg-rose-100 text-rose-700",
  under_review: "bg-amber-100 text-amber-700",
  upheld: "bg-emerald-100 text-emerald-700",
  overturned: "bg-slate-100 text-slate-600",
  resolved: "bg-slate-100 text-slate-600",
};

export default function AdminDriverNoShowCases() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [review, setReview] = useState({ decision: "", notes: "", refund_amount: 0 });
  const [busy, setBusy] = useState(false);
  const [policyForm, setPolicyForm] = useState({ name: "Passenger Protection", grace_minutes: 15, dispute_window_hours: 48, refund_enabled: true, refund_percentage: 100, charge_driver: true, is_active: true, description: "" });
  const [policyId, setPolicyId] = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.DriverNoShowReport.list("-reported_at", 200);
      setReports(list || []);
      const policies = await base44.entities.DriverNoShowPolicy.list("-created_date", 50);
      const active = (policies || []).find((p) => p.is_active) || (policies || [])[0] || null;
      if (active) {
        setPolicyId(active.id);
        setPolicyForm({
          name: active.name || "Passenger Protection",
          grace_minutes: active.grace_minutes ?? 15,
          dispute_window_hours: active.dispute_window_hours ?? 48,
          refund_enabled: !!active.refund_enabled,
          refund_percentage: active.refund_percentage ?? 100,
          charge_driver: !!active.charge_driver,
          is_active: !!active.is_active,
          description: active.description || "",
        });
      }
    } catch (err) { toast({ title: "Could not load", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCase = async (r) => {
    setSelected(r.id);
    setCaseData(null);
    try {
      const res = await base44.functions.invoke("getDriverNoShowCase", { no_show_report_id: r.id });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      setCaseData(res.data);
    } catch (err) { toast({ title: "Could not load case", description: err.message, variant: "destructive" }); }
  };

  const submitReview = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("reviewDriverNoShow", { no_show_report_id: selected, decision: review.decision, review_notes: review.notes, refund_amount: review.refund_amount });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: `Driver no-show ${res.data.status}` });
      setReview({ decision: "", notes: "", refund_amount: 0 });
      load();
      openCase({ id: selected });
    } catch (err) { toast({ title: "Could not review", description: err.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const savePolicy = async () => {
    setSavingPolicy(true);
    try {
      const payload = {
        name: policyForm.name.trim() || "Passenger Protection",
        grace_minutes: Number(policyForm.grace_minutes) || 0,
        dispute_window_hours: Number(policyForm.dispute_window_hours) || 0,
        refund_enabled: !!policyForm.refund_enabled,
        refund_percentage: Number(policyForm.refund_percentage) || 0,
        charge_driver: !!policyForm.charge_driver,
        is_active: !!policyForm.is_active,
        description: policyForm.description,
      };
      if (policyId) await base44.entities.DriverNoShowPolicy.update(policyId, payload);
      else { const c = await base44.entities.DriverNoShowPolicy.create(payload); setPolicyId(c.id); }
      toast({ title: "Passenger protection policy saved" });
      load();
    } catch (err) { toast({ title: "Could not save", description: err.message, variant: "destructive" }); }
    finally { setSavingPolicy(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="h-6 w-6 text-primary" /> Driver No-Show Cases</h1>
        <p className="mt-1 text-muted-foreground">Review passenger reports of driver no-shows and apply the passenger protection policy. Treba never auto-refunds — financial outcomes are applied per policy.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center gap-2 text-sm font-semibold"><Scale className="h-4 w-4 text-primary" /> Passenger protection policy</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Waiting period (minutes)</Label><Input type="number" value={policyForm.grace_minutes} onChange={(e) => setPolicyForm({ ...policyForm, grace_minutes: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5"><Label>Driver response window (hours)</Label><Input type="number" value={policyForm.dispute_window_hours} onChange={(e) => setPolicyForm({ ...policyForm, dispute_window_hours: e.target.value })} className="h-10" /></div>
          <div className="space-y-1.5"><Label>Refund %</Label><Input type="number" value={policyForm.refund_percentage} onChange={(e) => setPolicyForm({ ...policyForm, refund_percentage: e.target.value })} className="h-10" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policyForm.refund_enabled} onChange={(e) => setPolicyForm({ ...policyForm, refund_enabled: e.target.checked })} /> Refund enabled</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policyForm.charge_driver} onChange={(e) => setPolicyForm({ ...policyForm, charge_driver: e.target.checked })} /> Charge driver</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policyForm.is_active} onChange={(e) => setPolicyForm({ ...policyForm, is_active: e.target.checked })} /> Active</label>
        </div>
        <div className="mt-4 flex justify-end"><Button disabled={savingPolicy} onClick={savePolicy}>{savingPolicy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save policy</Button></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {reports.length === 0 ? <p className="text-sm text-muted-foreground">No driver no-show reports yet.</p> : reports.map((r) => (
            <button key={r.id} onClick={() => openCase(r)} className={`w-full rounded-xl border p-4 text-left ${selected === r.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.passenger_name || "Passenger"} → {r.driver_name || "Driver"}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[r.no_show_status] || STATUS_TONE.reported}`}>{r.no_show_status.replace(/_/g, " ")}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{r.route} · reported {new Date(r.reported_at).toLocaleString()}</div>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
          {!caseData ? <p className="text-sm text-muted-foreground">Select a case to review.</p> : (
            <div className="space-y-4">
              <div className="text-sm font-semibold">Case detail</div>
              <div className="text-xs text-muted-foreground">Passenger: {caseData.report.passenger_name}</div>
              <div className="text-xs text-muted-foreground">Driver: {caseData.report.driver_name}</div>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Pickup: {caseData.report.pickup_location || "—"}</div>
              <div className="text-xs text-muted-foreground">Route: {caseData.report.route}</div>
              <div className="text-xs text-muted-foreground">Scheduled: {caseData.report.scheduled_departure ? new Date(caseData.report.scheduled_departure).toLocaleString() : "—"}</div>
              <div className="text-xs text-muted-foreground">Reported: {new Date(caseData.report.reported_at).toLocaleString()}</div>
              {caseData.report.evidence_notes && <div className="rounded-lg bg-muted/40 p-2 text-xs"><strong>Evidence:</strong> {caseData.report.evidence_notes}</div>}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact attempts</div>
                <ul className="mt-2 space-y-1 text-xs">
                  {(caseData.attempts || []).map((at) => (
                    <li key={at.id} className="flex items-center gap-2"><Clock className="h-3 w-3" /> {new Date(at.attempted_at).toLocaleString()} · {at.attempt_type} · {at.outcome.replace("_", " ")}</li>
                  ))}
                  {caseData.attempts?.length === 0 && <li className="text-muted-foreground">No attempts logged.</li>}
                </ul>
              </div>
              {caseData.report.review_decision && caseData.report.review_decision !== "pending" && (
                <div className="rounded-xl bg-muted/40 p-3 text-xs"><strong>Review:</strong> {caseData.report.review_decision}<br />{caseData.report.financial_outcome}</div>
              )}
              {["reported", "under_review"].includes(caseData.report.no_show_status) && (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div className="text-sm font-semibold">Review decision</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => setReview({ ...review, decision: "upheld" })} className={review.decision === "upheld" ? "ring-2 ring-offset-1" : ""}>Uphold (driver no-show)</Button>
                    <Button size="sm" onClick={() => setReview({ ...review, decision: "overturned" })} className={review.decision === "overturned" ? "ring-2 ring-offset-1" : ""}>Overturn</Button>
                  </div>
                  <div><Label>Notes</Label><textarea className="mt-1 w-full rounded-md border border-input p-2 text-sm" rows={2} value={review.notes} onChange={(e) => setReview({ ...review, notes: e.target.value })} /></div>
                  <div><Label>Refund amount (N$) — not auto-processed</Label><Input type="number" value={review.refund_amount} onChange={(e) => setReview({ ...review, refund_amount: e.target.value })} className="h-10" /></div>
                  <Button disabled={!review.decision || busy} onClick={submitReview}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit review</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}