import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, MapPin, Flag, X, Pencil } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";
import { NAMIBIAN_TOWNS } from "@/lib/treba-places";

const STATUS_OPTIONS = ["active", "inactive", "suspended"];

const emptyForm = {
  route_code: "", origin_town: "", destination_town: "",
  is_active: true, distance_km: "", approximate_duration_minutes: "",
  standard_pickup_points: [], standard_drop_off_points: [],
  route_status: "active",
};

export default function RoutesManager() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // route id or "new" or null
  const [form, setForm] = useState(emptyForm);
  const [pickupInput, setPickupInput] = useState("");
  const [dropoffInput, setDropoffInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Route.list("-created_date", 100);
      setRoutes(list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startNew = () => { setForm(emptyForm); setEditing("new"); };
  const startEdit = (r) => {
    setForm({
      route_code: r.route_code || "",
      origin_town: r.origin_town || "",
      destination_town: r.destination_town || "",
      is_active: r.is_active ?? true,
      distance_km: r.distance_km ?? "",
      approximate_duration_minutes: r.approximate_duration_minutes ?? "",
      standard_pickup_points: r.standard_pickup_points || [],
      standard_drop_off_points: r.standard_drop_off_points || [],
      route_status: r.route_status || "active",
    });
    setEditing(r.id);
  };
  const cancel = () => { setEditing(null); setForm(emptyForm); };

  const addPickup = () => {
    const v = pickupInput.trim();
    if (!v) return;
    if (form.standard_pickup_points.includes(v)) { toast({ title: "Already added", variant: "destructive" }); return; }
    setForm({ ...form, standard_pickup_points: [...form.standard_pickup_points, v] });
    setPickupInput("");
  };
  const addDropoff = () => {
    const v = dropoffInput.trim();
    if (!v) return;
    if (form.standard_drop_off_points.includes(v)) { toast({ title: "Already added", variant: "destructive" }); return; }
    setForm({ ...form, standard_drop_off_points: [...form.standard_drop_off_points, v] });
    setDropoffInput("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.origin_town || !form.destination_town) {
      toast({ title: "Origin and destination are required", variant: "destructive" });
      return;
    }
    if (form.origin_town === form.destination_town) {
      toast({ title: "Origin and destination must differ", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      route_code: form.route_code.trim() || undefined,
      distance_km: form.distance_km === "" ? undefined : Number(form.distance_km),
      approximate_duration_minutes: form.approximate_duration_minutes === "" ? undefined : Number(form.approximate_duration_minutes),
      is_active: form.route_status === "active" ? form.is_active : false,
    };
    try {
      if (editing === "new") {
        await base44.entities.Route.create(payload);
      } else {
        await base44.entities.Route.update(editing, payload);
      }
      toast({ title: "Route saved" });
      cancel();
      load();
    } catch (err) {
      toast({ title: "Could not save route", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    try {
      await base44.entities.Route.delete(r.id);
      load();
    } catch (err) {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routes</h1>
          <p className="mt-1 text-muted-foreground">Manage town-to-town routes and their standard pickup / drop-off points.</p>
        </div>
        {!editing && (
          <Button onClick={startNew} className="h-10"><Plus className="mr-1 h-4 w-4" /> New route</Button>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-border bg-card p-6 treba-shadow">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Route code</Label><Input value={form.route_code} onChange={(e) => setForm({ ...form, route_code: e.target.value })} placeholder="WDH-SWK" className="h-11" /></div>
            <div className="space-y-2"><Label>Origin town</Label>
              <Select value={form.origin_town} onValueChange={(v) => setForm({ ...form, origin_town: v })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select town" /></SelectTrigger>
                <SelectContent>{NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Destination town</Label>
              <Select value={form.destination_town} onValueChange={(v) => setForm({ ...form, destination_town: v })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select town" /></SelectTrigger>
                <SelectContent>{NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Distance (km)</Label><Input type="number" min="0" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} className="h-11" /></div>
            <div className="space-y-2"><Label>Approx. duration (min)</Label><Input type="number" min="0" value={form.approximate_duration_minutes} onChange={(e) => setForm({ ...form, approximate_duration_minutes: e.target.value })} className="h-11" /></div>
            <div className="space-y-2"><Label>Route status</Label>
              <Select value={form.route_status} onValueChange={(v) => setForm({ ...form, route_status: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Standard pickup points */}
          <div className="space-y-2">
            <Label>Standard pickup points</Label>
            <div className="flex gap-2">
              <Input value={pickupInput} onChange={(e) => setPickupInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPickup(); } }} placeholder="e.g. Wernhill Park, Grove Mall" className="h-11" />
              <Button type="button" variant="outline" className="h-11 px-3" onClick={addPickup}><Plus className="h-4 w-4" /></Button>
            </div>
            {form.standard_pickup_points.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {form.standard_pickup_points.map((p) => (
                  <li key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                    <MapPin className="h-3.5 w-3.5" /> {p}
                    <button type="button" onClick={() => setForm({ ...form, standard_pickup_points: form.standard_pickup_points.filter((x) => x !== p) })}><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Standard drop-off points */}
          <div className="space-y-2">
            <Label>Standard drop-off points</Label>
            <div className="flex gap-2">
              <Input value={dropoffInput} onChange={(e) => setDropoffInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDropoff(); } }} placeholder="e.g. Swakopmund Mole, Mile 4" className="h-11" />
              <Button type="button" variant="outline" className="h-11 px-3" onClick={addDropoff}><Plus className="h-4 w-4" /></Button>
            </div>
            {form.standard_drop_off_points.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {form.standard_drop_off_points.map((p) => (
                  <li key={p} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700">
                    <Flag className="h-3.5 w-3.5" /> {p}
                    <button type="button" onClick={() => setForm({ ...form, standard_drop_off_points: form.standard_drop_off_points.filter((x) => x !== p) })}><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
            <Button type="submit" disabled={saving} className="h-11 px-6">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save route</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : routes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No routes configured yet. Add your first town-to-town route.</p>
      ) : (
        <ul className="space-y-3">
          {routes.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><MapPin className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold">{r.origin_town} → {r.destination_town}{r.route_code ? ` (${r.route_code})` : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.distance_km ? `${r.distance_km} km · ` : ""}{r.approximate_duration_minutes ? `${r.approximate_duration_minutes} min` : ""}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <StatusBadge status={r.route_status} />
                  <Button variant="ghost" className="h-8 px-2" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" className="h-8 px-2 text-destructive" onClick={() => handleDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Standard pickup points</div>
                  {r.standard_pickup_points?.length ? (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {r.standard_pickup_points.map((p) => <li key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"><MapPin className="h-3 w-3" />{p}</li>)}
                    </ul>
                  ) : <span className="text-xs text-muted-foreground">None</span>}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Standard drop-off points</div>
                  {r.standard_drop_off_points?.length ? (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {r.standard_drop_off_points.map((p) => <li key={p} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700"><Flag className="h-3 w-3" />{p}</li>)}
                    </ul>
                  ) : <span className="text-xs text-muted-foreground">None</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}