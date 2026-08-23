import React, { useEffect, useState } from "react";
import { Loader2, Users, Phone, MessageSquare, CheckCircle2, AlertTriangle, Clock, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import LogContactDialog from "@/components/driver/LogContactDialog";
import ReportNoShowDialog from "@/components/driver/ReportNoShowDialog";

const NO_SHOW_TONE = {
  none: "bg-slate-100 text-slate-600",
  passenger_no_show: "bg-rose-100 text-rose-700",
  disputed: "bg-amber-100 text-amber-700",
  upheld: "bg-rose-100 text-rose-700",
  overturned: "bg-emerald-100 text-emerald-700",
  arrived: "bg-emerald-100 text-emerald-700",
};

export default function DriverRoster() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [grace, setGrace] = useState(10);
  const [logFor, setLogFor] = useState(null);
  const [reportFor, setReportFor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("getDriverRoster", {});
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      setEntries(res.data?.entries || []);
      setGrace(res.data?.grace_minutes ?? 10);
    } catch (err) {
      toast({ title: "Could not load roster", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const confirmArrived = async (entry) => {
    setBusyId(entry.booking_id);
    try {
      const res = await base44.functions.invoke("confirmPassengerArrived", { trip_request_id: entry.trip_request_id });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      toast({ title: "Passenger arrival confirmed" });
      load();
    } catch (err) { toast({ title: "Could not confirm", description: err.message, variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trip Roster</h1>
        <p className="mt-1 text-muted-foreground">Confirmed passengers on your upcoming scheduled services. Wait {grace} minutes after departure before reporting a no-show.</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No confirmed passengers on your upcoming allocations yet.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {entries.map((e) => (
            <li key={e.booking_id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">{e.passenger_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.route}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {e.departure_date} · {e.departure_time}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {e.number_of_seats} seat(s)</span>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${NO_SHOW_TONE[e.no_show_status] || NO_SHOW_TONE.none}`}>
                  {e.no_show_status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {e.passenger_phone && <Button asChild variant="outline" size="sm"><a href={`tel:${e.passenger_phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a></Button>}
                {e.passenger_phone && <Button asChild variant="outline" size="sm"><a href={`sms:${e.passenger_phone}`}><MessageSquare className="mr-2 h-4 w-4" /> Message</a></Button>}
                <Button variant="outline" size="sm" onClick={() => setLogFor(e)}><MessageSquare className="mr-2 h-4 w-4" /> Log contact</Button>
                {!e.passenger_arrived && e.no_show_status === "none" && (
                  <Button size="sm" disabled={busyId === e.booking_id} onClick={() => confirmArrived(e)}>
                    {busyId === e.booking_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm arrived
                  </Button>
                )}
                {e.no_show_status === "none" && (
                  <Button variant="destructive" size="sm" onClick={() => setReportFor(e)}><AlertTriangle className="mr-2 h-4 w-4" /> Report no-show</Button>
                )}
              </div>

              {e.contact_attempts.length > 0 && (
                <div className="mt-3 rounded-xl bg-muted/30 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact attempts</div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {e.contact_attempts.map((at) => (
                      <li key={at.id} className="flex flex-wrap items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{new Date(at.attempted_at).toLocaleString(undefined, { timeStyle: "short", dateStyle: "short" })}</span>
                        <span className="capitalize">{at.attempt_type}</span>
                        <span className="capitalize text-muted-foreground">{at.outcome.replace("_", " ")}</span>
                        {at.note && <span className="text-muted-foreground">— {at.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {e.passenger_arrived && <div className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Passenger arrived</div>}
            </li>
          ))}
        </ul>
      )}

      {logFor && <LogContactDialog open={true} onOpenChange={(o) => !o && setLogFor(null)} entry={logFor} onLogged={load} />}
      {reportFor && <ReportNoShowDialog open={true} onOpenChange={(o) => !o && setReportFor(null)} entry={reportFor} graceMinutes={grace} onReported={load} />}
    </div>
  );
}