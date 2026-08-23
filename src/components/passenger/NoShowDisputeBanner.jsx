import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import DisputeNoShowDialog from "./DisputeNoShowDialog";

export default function NoShowDisputeBanner({ tripRequestId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("getNoShowCase", { trip_request_id: tripRequestId });
      if (!res.data?.error && res.data?.report) setReport(res.data.report);
    } catch (e) {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tripRequestId]);

  if (loading || !report) return null;

  if (["upheld", "overturned", "resolved"].includes(report.no_show_status)) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4" />
        <span>No-show report <strong>{report.no_show_status}</strong>. {report.financial_outcome}</span>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Your driver reported you as a no-show{report.no_show_status === "disputed" ? " (dispute submitted)" : ""}.</span>
        {report.no_show_status === "reported" && <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>Dispute no-show</Button>}
      </div>
      {open && <DisputeNoShowDialog open={open} onOpenChange={setOpen} tripRequestId={tripRequestId} onDisputed={load} />}
    </>
  );
}