import React, { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, CalendarClock, Car, User, Armchair, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const STATUS_TONES = {
  awaiting_confirmation: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  reassigned: "bg-blue-100 text-blue-700",
  completed: "bg-slate-200 text-slate-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const STATUS_LABELS = {
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
  reassigned: "Reassigned",
  completed: "Completed",
  cancelled: "Cancelled",
};
const FILTER_OPTIONS = ["all", "awaiting_confirmation", "confirmed", "declined", "needs_replacement"];

function StatusPill({ status, needsReplacement }) {
  if (needsReplacement && status === "declined") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700"><AlertTriangle className="h-3 w-3" /> Needs replacement</span>;
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONES[status] || "bg-slate-100 text-slate-600"}`}>{STATUS_LABELS[status] || status}</span>;
}

export default function AllocationsDashboard() {
  const { toast } = useToast();
  const [allocations, setAllocations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ route_id: "", date: "", departure_time: "" });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, rList] = await Promise.all([
        base44.entities.Allocation.list("-date", 200),
        base44.entities.Route.filter({ is_active: true }),
      ]);
      setAllocations(list || []);
      setRoutes(rList || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = allocations.filter((a) => {
    if (dateFilter && a.date !== dateFilter) return false;
    if (filter === "all") return true;
    if (filter === "needs_replacement") return a.needs_replacement;
    return a.status === filter;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.route_id || !form.date || !form.departure_time) {
      toast({ title: "Route, date and departure are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("createAllocation", form);
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Allocation created", description: `Allocated to ${res.data.allocation.allocated_driver_name}` });
        setForm({ route_id: "", date: "", departure_time: "" });
        setShowForm(false);
        load();
      }
    } catch (err) {
      toast({ title: "Could not create allocation", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassign = async (a) => {
    setBusyId(a.id);
    try {
      const res = await base44.functions.invoke("respondToAllocation", { allocation_id: a.id, action: "reassign" });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Reassigned", description: `New driver: ${res.data.allocation.allocated_driver_name}` });
        load();
      }
    } catch (err) {
      toast({ title: "Reassign failed", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocations</h1>
          <p className="mt-1 text-muted-foreground">Daily scheduled route allocations. The engine picks an eligible driver for each slot.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10" onClick={load}><RefreshCw className="mr-1 h-4 w-4" /> Refresh</Button>
          <Button onClick={() => setShowForm((v) => !v)} className="h-10"><Plus className="mr-1 h-4 w-4" /> New allocation</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 treba-shadow sm:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Route</Label>
            <Select value={form.route_id} onValueChange={(v) => setForm({ ...form, route_id: v })}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>
                {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.origin_town} → {r.destination_town}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11" /></div>
          <div className="space-y-2"><Label>Departure</Label><Input type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} className="h-11" /></div>
          <div className="flex justify-end sm:col-span-4">
            <Button type="submit" disabled={submitting} className="h-11 px-6">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Allocate driver
            </Button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-9 w-44" />
        {dateFilter && <Button variant="ghost" className="h-9" onClick={() => setDateFilter("")}>Clear date</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No allocations match the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Departure</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Confirmation</th>
                <th className="px-4 py-3 text-left">Seats</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Replacement</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3 font-medium">{a.origin} → {a.destination}</td>
                  <td className="px-4 py-3">{a.date}</td>
                  <td className="px-4 py-3">{a.departure_time}</td>
                  <td className="px-4 py-3">{a.allocated_driver_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.vehicle_label || "—"}</td>
                  <td className="px-4 py-3">{a.driver_response_at ? new Date(a.driver_response_at).toLocaleDateString() : "Pending"}</td>
                  <td className="px-4 py-3">{a.available_seats}/{a.total_seats}</td>
                  <td className="px-4 py-3"><StatusPill status={a.status} needsReplacement={a.needs_replacement} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{a.replacement_driver_name || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {(a.status === "declined" || a.needs_replacement) && (
                      <Button variant="outline" className="h-8" disabled={busyId === a.id} onClick={() => handleReassign(a)}>
                        {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reassign"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}