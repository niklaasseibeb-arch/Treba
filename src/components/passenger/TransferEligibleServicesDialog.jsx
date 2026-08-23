import React, { useEffect, useState } from "react";
import { Loader2, ArrowRightLeft, CheckCircle2, Star, Car, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function TransferEligibleServicesDialog({ bookingId, onClose, onRequested }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState([]);
  const [current, setCurrent] = useState(null);
  const [selectedAlloc, setSelectedAlloc] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getTransferEligibleServices", { booking_id: bookingId });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        onClose();
        return;
      }
      setEligible(res.data?.eligible_services || []);
      setCurrent(res.data?.booking || null);
    } catch (err) {
      toast({ title: "Could not load alternatives", description: err.message, variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bookingId]);

  const request = async () => {
    if (!selectedAlloc) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("requestBookingTransfer", {
        booking_id: bookingId,
        target_allocation_id: selectedAlloc,
      });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Transfer request sent", description: "The receiving driver must accept before your booking moves." });
      onRequested();
    } catch (err) {
      toast({ title: "Could not send transfer request", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!bookingId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> Request a transfer
          </DialogTitle>
          <DialogDescription>
            {current
              ? `${current.origin} → ${current.destination} · ${current.date} · ${current.departure_time} · ${current.number_of_seats} seat(s) · current driver: ${current.current_driver_name || "—"}`
              : "Transfer your confirmed booking to another eligible driver on the same route and date."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : eligible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No eligible alternative services are available on the same route and date right now.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {eligible.map((s) => (
              <li key={s.allocation_id}>
                <button
                  type="button"
                  onClick={() => setSelectedAlloc(s.allocation_id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selectedAlloc === s.allocation_id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Car className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{s.driver_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {s.departure_time}</span>
                      {" · "}
                      {s.available_seats} seats available
                      {s.vehicle_label ? ` · ${s.vehicle_label}` : ""}
                    </span>
                  </span>
                  {s.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" /> {s.rating}
                    </span>
                  )}
                  {selectedAlloc === s.allocation_id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Your agreed fare stays the same. Treba does not process your payment — you continue to pay the driver directly.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={request} disabled={busy || !selectedAlloc || eligible.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
            Request transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}