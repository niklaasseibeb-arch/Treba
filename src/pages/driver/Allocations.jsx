import React, { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, XCircle, CalendarClock, Car, Armchair, Route as RouteIcon, Shuffle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import SwapEligibleDriversDialog from "@/components/driver/SwapEligibleDriversDialog";

const STATUS_TONES = {
  awaiting_confirmation: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  reassigned: "bg-blue-100 text-blue-700",
  completed: "bg-slate-200 text-slate-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const STATUS_LABELS = {
  awaiting_confirmation: "Awaiting your confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
  reassigned: "Reassigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "confirmed", label: "Confirmed" },
  { key: "declined", label: "Declined" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DriverAllocations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today");
  const [busyId, setBusyId] = useState(null);
  const [swapAllocation, setSwapAllocation] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Allocation.list("-date", 200);
      setAllocations(list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user.id]);

  const today = todayStr();
  const visible = useMemo(() => {
    return allocations.filter((a) => {
      if (tab === "today") return a.date === today;
      if (tab === "upcoming") return a.date >= today && (a.status === "awaiting_confirmation" || a.status === "confirmed");
      if (tab === "confirmed") return a.status === "confirmed";
      if (tab === "declined") return a.status === "declined";
      return true;
    });
  }, [allocations, tab, today]);

  const respond = async (a, action) => {
    setBusyId(a.id);
    try {
      const res = await base44.functions.invoke("respondToAllocation", { allocation_id: a.id, action });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
      } else {
        toast({ title: action === "confirm" ? "Availability confirmed" : "Marked not available" });
        load();
      }
    } catch (err) {
      toast({ title: "Could not respond", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Allocations</h1>
        <p className="mt-1 text-muted-foreground">Scheduled route allocations assigned to you. Confirm availability so Treba can cover the route.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No allocations in this view.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><RouteIcon className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold">{a.origin} → {a.destination}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {a.date} · {a.departure_time}</span>
                    <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {a.vehicle_label || "—"}</span>
                    <span className="inline-flex items-center gap-1"><Armchair className="h-3.5 w-3.5" /> {a.available_seats}/{a.total_seats} seats</span>
                  </div>
                </div>
                <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[a.status] || "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABELS[a.status] || a.status}
                </span>
              </div>

              {a.status === "awaiting_confirmation" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button className="h-10" disabled={busyId === a.id} onClick={() => respond(a, "confirm")}>
                    {busyId === a.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Confirm availability
                  </Button>
                  <Button variant="outline" className="h-10" disabled={busyId === a.id} onClick={() => respond(a, "decline")}>
                    <XCircle className="mr-2 h-4 w-4" /> Not available
                  </Button>
                </div>
              )}

              {a.status === "confirmed" && (
                <div className="mt-4">
                  <Button variant="outline" className="h-10" disabled={busyId === a.id} onClick={() => setSwapAllocation(a)}>
                    <Shuffle className="mr-2 h-4 w-4" /> Request swap
                  </Button>
                </div>
              )}

              {a.replacement_driver_name && a.status === "awaiting_confirmation" && (
                <p className="mt-3 text-xs text-muted-foreground">Reallocated to you after a previous driver declined.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {swapAllocation && (
        <SwapEligibleDriversDialog
          allocation={swapAllocation}
          onClose={() => setSwapAllocation(null)}
          onRequested={() => { setSwapAllocation(null); load(); }}
        />
      )}
    </div>
  );
}