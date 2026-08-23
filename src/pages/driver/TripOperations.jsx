import React, { useEffect, useState } from "react";
import { Loader2, Play, CheckCircle2, Ban, FileWarning, CalendarClock, CarFront, Users, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TripOpsChecks from "@/components/driver/TripOpsChecks";
import TripOpsManifest from "@/components/driver/TripOpsManifest";
import TripOpsEvents from "@/components/driver/TripOpsEvents";
import IncidentDialog from "@/components/driver/IncidentDialog";
import ReportNoShowDialog from "@/components/driver/ReportNoShowDialog";

const STATUS_TONE = {
  scheduled: "bg-slate-100 text-slate-700",
  departed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function DriverTripOperations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [manifest, setManifest] = useState([]);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [noShowFor, setNoShowFor] = useState(null);
  const [grace, setGrace] = useState(10);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("getTodaysTrip", {});
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      setTrip(res.data?.trip || null);
      setManifest(res.data?.manifest || []);
      setEvents(res.data?.events || []);
      try {
        const policies = await base44.entities.NoShowPolicy.list("-created_date", 50);
        const active = (policies || []).find((p) => p.is_active);
        if (active) setGrace(Number(active.grace_minutes) || 10);
      } catch (e) {}
    } catch (err) {
      toast({ title: "Could not load today's trip", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, payload, label) => {
    setBusy(label);
    try {
      const res = await base44.functions.invoke(fn, payload);
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: label });
      load();
    } catch (err) { toast({ title: "Action failed", description: err.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const confirmArrived = async (p) => {
    setBusy(`arrived-${p.booking_id}`);
    try {
      const res = await base44.functions.invoke("confirmPassengerArrived", { trip_request_id: p.trip_request_id });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: "Passenger arrival confirmed" });
      load();
    } catch (err) { toast({ title: "Could not confirm", description: err.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const recordIncident = async (note) => {
    await run("recordTripIncident", { allocation_id: trip.allocation_id, note }, "Incident recorded");
    setIncidentOpen(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!trip) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Today's Trip</h1>
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">You have no confirmed scheduled trip for today.</p>
        </div>
      </div>
    );
  }

  const canStart = trip.can_start && trip.trip_status === "scheduled";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today's Trip</h1>
        <p className="mt-1 text-muted-foreground">Your scheduled passenger manifest and operational controls.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-primary" /> {trip.route}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {trip.departure_date} · {trip.departure_time}</span>
              <span className="inline-flex items-center gap-1"><CarFront className="h-3.5 w-3.5" /> {trip.vehicle_label || "Vehicle not assigned"}</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {trip.manifest_count} passenger(s) · {trip.total_seats} seats</span>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[trip.trip_status] || "bg-slate-100 text-slate-700"}`}>{trip.trip_status}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {trip.trip_status === "scheduled" && (
            <Button disabled={!canStart || busy === "start"} onClick={() => run("startTrip", { allocation_id: trip.allocation_id }, "Trip started")}>
              {busy === "start" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Start trip
            </Button>
          )}
          {trip.trip_status === "departed" && (
            <Button disabled={busy === "complete"} onClick={() => run("completeTrip", { allocation_id: trip.allocation_id }, "Trip completed")}>
              {busy === "complete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Complete trip
            </Button>
          )}
          <Button variant="outline" onClick={() => setIncidentOpen(true)}><FileWarning className="mr-2 h-4 w-4" /> Record incident</Button>
          {trip.trip_status !== "completed" && trip.trip_status !== "cancelled" && (
            <Button variant="destructive" disabled={busy === "cancel"} onClick={() => { if (confirm("Cancel today's trip?")) run("cancelTrip", { allocation_id: trip.allocation_id }, "Trip cancelled"); }}>
              {busy === "cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />} Cancel trip
            </Button>
          )}
        </div>
      </div>

      <TripOpsChecks checks={trip.checks} blockingReasons={trip.blocking_reasons} adminOverride={trip.admin_override} />

      <div>
        <div className="mb-2 text-sm font-semibold">Passenger manifest</div>
        <TripOpsManifest manifest={manifest} busyId={busy} onArrived={confirmArrived} onReportNoShow={setNoShowFor} />
      </div>

      <TripOpsEvents events={events} />

      {incidentOpen && <IncidentDialog open={true} onOpenChange={setIncidentOpen} onSubmit={recordIncident} />}
      {noShowFor && <ReportNoShowDialog open={true} onOpenChange={(o) => !o && setNoShowFor(null)} entry={noShowFor} graceMinutes={grace} onReported={load} />}
    </div>
  );
}