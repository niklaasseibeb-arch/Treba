import React, { useState } from "react";
import { Loader2, Phone, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function LogContactDialog({ open, onOpenChange, entry, onLogged }) {
  const { toast } = useToast();
  const [attemptType, setAttemptType] = useState("call");
  const [outcome, setOutcome] = useState("no_answer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("recordContactAttempt", {
        trip_request_id: entry.trip_request_id,
        booking_id: entry.booking_id,
        attempt_type: attemptType,
        outcome,
        note,
      });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: "Contact attempt logged" });
      setNote("");
      onOpenChange(false);
      onLogged && onLogged();
    } catch (err) {
      toast({ title: "Could not log", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log contact attempt</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Attempt type</Label>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setAttemptType("call")} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${attemptType === "call" ? "border-primary bg-primary/10" : "border-border"}`}><Phone className="h-4 w-4" /> Call</button>
              <button type="button" onClick={() => setAttemptType("message")} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${attemptType === "message" ? "border-primary bg-primary/10" : "border-border"}`}><MessageSquare className="h-4 w-4" /> Message</button>
            </div>
          </div>
          <div>
            <Label>Outcome</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["no_answer", "reached", "failed"].map((o) => (
                <button key={o} type="button" onClick={() => setOutcome(o)} className={`rounded-lg border px-3 py-2 text-sm capitalize ${outcome === o ? "border-primary bg-primary/10" : "border-border"}`}>{o.replace("_", " ")}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <textarea className="mt-1 w-full rounded-md border border-input p-2 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Log attempt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}