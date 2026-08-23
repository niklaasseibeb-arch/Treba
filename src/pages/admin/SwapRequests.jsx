import React, { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";

const STATUS_LABEL = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export default function AdminSwapRequests() {
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.DriverSwapRequest.list("-requested_at", 200);
        setSwaps(list || []);
      } catch (e) {}
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Driver Swap Requests</h1>
        <p className="mt-1 text-muted-foreground">
          Driver-to-driver allocation swaps complete without admin intervention. This view is for visibility, exceptions and disputes.
        </p>
      </div>

      {swaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No swap requests recorded.</p>
      ) : (
        <ul className="space-y-3">
          {swaps.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{s.origin} → {s.destination}</div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.date} · {s.departure_time}</span>
                    <span>From: {s.requesting_driver_name}</span>
                    <span>To: {s.target_driver_name}</span>
                    <span>{s.confirmed_bookings_count} booking(s)</span>
                  </div>
                </div>
                <StatusBadge status={s.swap_status} label={STATUS_LABEL[s.swap_status]} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}