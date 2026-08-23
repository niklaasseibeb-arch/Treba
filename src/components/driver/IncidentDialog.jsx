import React, { useState } from "react";
import { Loader2, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function IncidentDialog({ open, onOpenChange, onSubmit }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try { await onSubmit(note.trim()); setNote(""); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-amber-600" /> Record incident</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Describe the incident</Label>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Road closure, vehicle issue, passenger dispute…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !note.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record incident</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}