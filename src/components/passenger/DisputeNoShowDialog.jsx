import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function DisputeNoShowDialog({ open, onOpenChange, tripRequestId, onDisputed }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("disputeNoShow", { trip_request_id: tripRequestId, dispute_reason: reason });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: "No-show disputed — case sent for review" });
      setReason("");
      onOpenChange(false);
      onDisputed && onDisputed();
    } catch (err) { toast({ title: "Could not dispute", description: err.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dispute no-show</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Explain why the no-show report is incorrect. Your case will be reviewed by an administrator.</p>
          <div><Label>Reason</Label><textarea className="mt-1 w-full rounded-md border border-input p-2 text-sm" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit dispute</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}