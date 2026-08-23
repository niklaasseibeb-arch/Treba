import React, { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function ReportNoShowDialog({ open, onOpenChange, entry, graceMinutes, onReported }) {
  const { toast } = useToast();
  const [checks, setChecks] = useState({ pickup: false, grace: false, contact: false });
  const [busy, setBusy] = useState(false);
  const hasAttempts = (entry?.contact_attempts?.length || 0) > 0;
  const canSubmit = checks.pickup && checks.grace && checks.contact && hasAttempts;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("reportPassengerNoShow", {
        trip_request_id: entry.trip_request_id,
        driver_at_pickup: checks.pickup,
        grace_elapsed: checks.grace,
        contact_attempted: checks.contact,
      });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: "No-show reported" });
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
        <DialogHeader><DialogTitle>Report passenger no-show</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>A paid, confirmed passenger is not the same as a cash-pending hold. The booking stays financially subject to the no-show policy — the passenger is not automatically refunded.</span>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks.pickup} onChange={(e) => setChecks({ ...checks, pickup: e.target.checked })} /> I am at the designated pickup point</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks.grace} onChange={(e) => setChecks({ ...checks, grace: e.target.checked })} /> The {graceMinutes}-minute grace period has elapsed</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checks.contact} onChange={(e) => setChecks({ ...checks, contact: e.target.checked })} /> I attempted to contact the passenger ({entry?.contact_attempts?.length || 0} logged)</label>
          {!hasAttempts && <p className="text-xs text-rose-600">Log at least one contact attempt first.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!canSubmit || busy} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Report passenger no-show</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}