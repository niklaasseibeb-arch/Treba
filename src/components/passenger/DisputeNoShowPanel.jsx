import React, { useEffect, useState } from "react";
import { Loader2, Phone, MessageSquare, AlertTriangle, Car, Clock, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import LogDriverContactDialog from "./LogDriverContactDialog";
import ReportDriverNoShowDialog from "./ReportDriverNoShowDialog";

const STATUS_TONE = {
  reported: "bg-rose-100 text-rose-700",
  under_review: "bg-amber-100 text-amber-700",
  upheld: "bg-emerald-100 text-emerald-700",
  overturned: "bg-slate-100 text-slate-600",
  resolved: "bg-slate-100 text-slate-600",
};

export default function DriverNoShowPanel({ tripRequest }) {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("getDriverNoShowCase", { trip_request_id: tripRequest.id });
      if (res.data?.error) return;
      setCtx(res.data);
    } catch (e) {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tripRequest.id]);

  if (loading) return <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading driver info…</div>;

  const report = ctx?.report || null;
  const status = report?.no_show_status || null;
  const grace = ctx?.grace_minutes ?? 15;
  const driverName = ctx?.driver_name || tripRequest.matched_driver_name || "your driver";
  const driverPhone = ctx?.driver_phone || null;
  const attempts = ctx?.attempts || [];

  // If a report exists and is reviewed, show the outcome.
  if (report && ["upheld", "overturned", "resolved"].includes(status)) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4" />
        <span>Driver no-show <strong>{status}</strong>. {report.financial_outcome}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-sm"><Car className="h-4 w-4 text-muted-foreground" /> {driverName}</div>
        {status && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[status] || STATUS_TONE.reported}`}>Driver no-show: {status.replace(/_/g, " ")}</span>}
      </div>

      {driverPhone && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href={`tel:${driverPhone}`}><Phone className="mr-2 h-4 w-4" /> Call driver</a></Button>
          <Button asChild variant="outline" size="sm"><a href={`sms:${driverPhone}`}><MessageSquare className="mr-2 h-4 w-4" /> Message driver</a></Button>
        </div>
      )}

      {attempts.length > 0 && (
        <div className="mt-2 rounded-lg bg-background/60 p-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact attempts</div>
          <ul className="mt-1 space-y-0.5 text-xs">
            {attempts.map((at) => (
              <li key={at.id} className="flex flex-wrap items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>{new Date(at.attempted_at).toLocaleString(undefined, { timeStyle: "short", dateStyle: "short" })}</span>
                <span className="capitalize">{at.attempt_type}</span>
                <span className="capitalize text-muted-foreground">{at.outcome.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}><MessageSquare className="mr-2 h-4 w-4" /> Log contact</Button>
        {!status && (
          <Button variant="destructive" size="sm" onClick={() => setReportOpen(true)}><AlertTriangle className="mr-2 h-4 w-4" /> Report driver no-show</Button>
        )}
      </div>

      {status === "reported" && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700"><Clock className="h-3.5 w-3.5" /> Reported — awaiting Treba admin review.</p>
      )}

      {logOpen && <LogDriverContactDialog open={logOpen} onOpenChange={setLogOpen} tripRequestId={tripRequest.id} onLogged={load} />}
      {reportOpen && <ReportDriverNoShowDialog open={reportOpen} onOpenChange={setReportOpen} tripRequestId={tripRequest.id} graceMinutes={grace} contactAttemptsCount={attempts.length} onReported={load} />}
    </div>
  );
}