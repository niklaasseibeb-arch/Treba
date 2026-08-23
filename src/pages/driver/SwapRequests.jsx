import React, { useEffect, useState } from "react";
import { Loader2, Shuffle, CheckCircle2, XCircle, Clock, ArrowRightLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";

const SWAP_STATUS_LABEL = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};
const TRANSFER_STATUS_LABEL = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export default function DriverSwapRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [swapList, transferList] = await Promise.all([
        base44.entities.DriverSwapRequest.list("-requested_at", 200).catch(() => []),
        base44.entities.BookingTransferRequest.list("-requested_at", 200).catch(() => []),
      ]);
      setSwaps(swapList || []);
      setTransfers(transferList || []);
    } catch (e) {
      toast({ title: "Could not load requests", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user.id]);

  const respondSwap = async (swap, action) => {
    setBusyId(`swap:${swap.id}`);
    try {
      const res = await base44.functions.invoke("respondToDriverSwap", { swap_id: swap.id, action });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: action === "accept" ? "Swap accepted — allocation transferred" : action === "decline" ? "Swap declined" : "Swap cancelled" });
      load();
    } catch (err) {
      toast({ title: "Could not respond", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const respondTransfer = async (transfer, action) => {
    setBusyId(`transfer:${transfer.id}`);
    try {
      const res = await base44.functions.invoke("respondToBookingTransfer", { transfer_id: transfer.id, action });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: action === "accept" ? "Transfer accepted — passenger added" : "Transfer declined" });
      load();
    } catch (err) {
      toast({ title: "Could not respond", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const incomingSwaps = swaps.filter((s) => s.target_driver_user_id === user.id && s.swap_status === "pending");
  const outgoingSwaps = swaps.filter((s) => s.requesting_driver_user_id === user.id);
  const incomingTransfers = transfers.filter((t) => t.target_driver_user_id === user.id && t.transfer_status === "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Swap & Transfer Requests</h1>
        <p className="mt-1 text-muted-foreground">
          Driver-to-driver allocation swaps and passenger booking transfers. Normal requests complete without admin intervention.
        </p>
      </div>

      {incomingTransfers.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Booking transfer requests</h2>
          <ul className="space-y-3">
            {incomingTransfers.map((t) => (
              <li key={t.id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{t.origin} → {t.destination}</div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.date} · {t.target_departure_time}</span>
                      <span>From passenger: {t.passenger_name || "—"}</span>
                      <span>{t.number_of_seats} seat(s)</span>
                      <span>Fare: N${Number(t.fare_amount || 0).toFixed(0)} (preserved)</span>
                    </div>
                  </div>
                  <StatusBadge status={t.transfer_status} label={TRANSFER_STATUS_LABEL[t.transfer_status]} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="h-10" disabled={busyId === `transfer:${t.id}`} onClick={() => respondTransfer(t, "accept")}>
                    {busyId === `transfer:${t.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Accept transfer
                  </Button>
                  <Button variant="outline" className="h-10 text-destructive hover:bg-destructive/5" disabled={busyId === `transfer:${t.id}`} onClick={() => respondTransfer(t, "decline")}>
                    <XCircle className="mr-2 h-4 w-4" /> Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Incoming swap requests</h2>
        {incomingSwaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending swap requests for you.</p>
        ) : (
          <ul className="space-y-3">
            {incomingSwaps.map((s) => (
              <li key={s.id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{s.origin} → {s.destination}</div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.date} · {s.departure_time}</span>
                      <span>From: {s.requesting_driver_name}</span>
                      <span>{s.confirmed_bookings_count} confirmed booking(s) inherited</span>
                    </div>
                  </div>
                  <StatusBadge status={s.swap_status} label={SWAP_STATUS_LABEL[s.swap_status]} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="h-10" disabled={busyId === `swap:${s.id}`} onClick={() => respondSwap(s, "accept")}>
                    {busyId === `swap:${s.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Accept swap
                  </Button>
                  <Button variant="outline" className="h-10 text-destructive hover:bg-destructive/5" disabled={busyId === `swap:${s.id}`} onClick={() => respondSwap(s, "decline")}>
                    <XCircle className="mr-2 h-4 w-4" /> Decline swap
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your swap requests</h2>
        {outgoingSwaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't requested any swaps. Open an allocation and tap "Request swap".</p>
        ) : (
          <ul className="space-y-3">
            {outgoingSwaps.map((s) => (
              <li key={s.id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{s.origin} → {s.destination}</div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.date} · {s.departure_time}</span>
                      <span>To: {s.target_driver_name}</span>
                    </div>
                  </div>
                  <StatusBadge status={s.swap_status} label={SWAP_STATUS_LABEL[s.swap_status]} />
                </div>
                {s.swap_status === "pending" && (
                  <div className="mt-4">
                    <Button variant="outline" className="h-9" disabled={busyId === `swap:${s.id}`} onClick={() => respondSwap(s, "cancel")}>
                      <XCircle className="mr-2 h-4 w-4" /> Cancel request
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}