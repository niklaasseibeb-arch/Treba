import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Play, CheckCircle2, Ban } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const STATUS_TONE = {
  scheduled: "bg-slate-100 text-slate-700",
  departed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function AdminTripOperations() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ops, setOps] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const list = await base44.entities.TripOperation.list("-created_date", 200);
      setOps(list || []);
    } catch (err) { toast({ title: "Could not load", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, payload, label) => {
    setBusy(label + payload.allocation_id);
    try {
      const res = await base44.functions.invoke(fn, payload);
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: label });
      load();
    } catch (err) { toast({ title: "Action failed", description: err.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const override = async (op) => {
    const reason = prompt("Override reason (admin):");
    if (reason === null) return;
    await run("overrideTripStart", { allocation_id: op.allocation_id, reason }, "Trip started (admin override)");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="h-6 w-6 text-primary" /> Trip Operations</h1>
        <p className="mt-1 text-muted-foreground">Monitor live trip operations and apply administrator overrides when mandatory conditions cannot be met.</p>
      </div>

      {ops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">No trip operations yet.</div>
      ) : (
        <ul className="space-y-3">
          {ops.map((op) => (
            <li key={op.id} className="rounded-2xl border border-border bg-card p-4 treba-shadow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{op.route}</div>
                  <div className="text-xs text-muted-foreground">{op.departure_date} · {op.departure_time} · {op.vehicle_label || "No vehicle"} · {op.manifest_count} passenger(s)</div>
                  {op.admin_override && <div className="mt-1 text-xs font-medium text-amber-700">Admin override active: {op.override_reason || "—"}</div>}
                  {op.incident_notes && <div className="mt-1 text-xs text-rose-700">Incident: {op.incident_notes}</div>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[op.trip_status] || "bg-slate-100 text-slate-700"}`}>{op.trip_status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {op.trip_status === "scheduled" && (
                  <>
                    <Button size="sm" variant="outline" disabled={busy === "override" + op.allocation_id} onClick={() => override(op)}>
                      {busy === "override" + op.allocation_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Override & start
                    </Button>
                    <Button size="sm" disabled={busy === "start" + op.allocation_id} onClick={() => run("startTrip", { allocation_id: op.allocation_id }, "Trip started")}>
                      {busy === "start" + op.allocation_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Start
                    </Button>
                  </>
                )}
                {op.trip_status === "departed" && (
                  <Button size="sm" disabled={busy === "complete" + op.allocation_id} onClick={() => run("completeTrip", { allocation_id: op.allocation_id }, "Trip completed")}>
                    {busy === "complete" + op.allocation_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Complete
                  </Button>
                )}
                {op.trip_status !== "completed" && op.trip_status !== "cancelled" && (
                  <Button size="sm" variant="destructive" disabled={busy === "cancel" + op.allocation_id} onClick={() => run("cancelTrip", { allocation_id: op.allocation_id }, "Trip cancelled")}>
                    {busy === "cancel" + op.allocation_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />} Cancel
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}