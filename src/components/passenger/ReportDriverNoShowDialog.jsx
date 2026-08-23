import React, { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function ReportDriverNoShowDialog({ open, onOpenChange, tripRequestId, graceMinutes, contactAttemptsCount, onReported }) {
  const { toast } = useToast();
  const [checks, setChecks] = useState({ pickup: false, grace: false, contact: false });
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const hasAttempts = contactAttemptsCount > 0;
  const canSubmit = checks.pickup && checks.grace && checks.contact && hasAttempts;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("reportDriverNoShow", {
        trip_request_id: tripRequestId,
        passenger_at_pickup: checks.pickup,
        grace_elapsed: checks.grace,
        contact_attempted: checks.contact,
        evidence_notes: evidence,
      });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: "Driver no-show reported" });
      setEvidence("");
      onOpenChange(false);
      onReported && onReported();
    } catch (err) {
      toast({ title: "Could not report", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Report driver no-show</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>Report this only if your driver did not provide the scheduled trip. The case is sent to Treba administration for review. Any refund is applied per the passenger protection policy — it is not automatic.</span>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks.pickup} onChange={(e) => setChecks({ ...checks, pickup: e.target.checked })} /> I am at the designated pickup point</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks.grace} onChange={(e) => setChecks({ ...checks, grace: e.target.checked })} /> The {graceMinutes}-minute waiting period has elapsed</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks.contact} onChange={(e) => setChecks({ ...checks, contact: e.target.checked })} /> I attempted to contact the driver ({contactAttemptsCount} logged)</label>
          {!hasAttempts && <p className="text-xs text-rose-600">Log at least one contact attempt first.</p>}
          <div>
            <Label>Evidence (optional)</Label>
            <textarea className="mt-1 w-full rounded-md border border-input p-2 text-sm" rows={3} placeholder="e.g. waited at the rank from 09:00, driver did not arrive or answer" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!canSubmit || busy} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Report driver no-show</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}