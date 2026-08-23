import React, { useEffect, useState } from "react";
import { Loader2, Shuffle, CheckCircle2, Star, Car } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function SwapEligibleDriversDialog({ allocation, onClose, onRequested }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getSwapEligibleDrivers", { allocation_id: allocation.id });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        onClose();
        return;
      }
      setEligible(res.data?.eligible_drivers || []);
      setMeta({
        confirmed_bookings_count: res.data?.confirmed_bookings_count,
        confirmed_seats: res.data?.confirmed_seats,
      });
    } catch (err) {
      toast({ title: "Could not load eligible drivers", description: err.message, variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [allocation.id]);

  const request = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("requestDriverSwap", {
        allocation_id: allocation.id,
        target_driver_id: selectedId,
      });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Swap request sent" });
      onRequested();
    } catch (err) {
      toast({ title: "Could not send swap request", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!allocation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-primary" /> Request a driver swap
          </DialogTitle>
          <DialogDescription>
            {allocation.origin} → {allocation.destination} · {allocation.date} · {allocation.departure_time}
            {meta ? ` · ${meta.confirmed_bookings_count} confirmed booking(s), ${meta.confirmed_seats} seat(s) to preserve` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : eligible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No eligible drivers are available to take over this allocation right now.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {eligible.map((d) => (
              <li key={d.driver_id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.driver_id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selectedId === d.driver_id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Car className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{d.driver_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {d.vehicle_label} · {d.seating_capacity} seats
                      {d.prior_on_route ? " · experienced on route" : ""}
                    </span>
                  </span>
                  {d.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" /> {d.rating}
                    </span>
                  )}
                  {selectedId === d.driver_id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={request} disabled={busy || !selectedId || eligible.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
            Send swap request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}