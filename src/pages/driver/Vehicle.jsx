import React, { useEffect, useState } from "react";
import { Loader2, Save, Plus, Car } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";

const VEHICLE_TYPES = [
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "minibus", label: "Minibus" },
  { value: "van", label: "Van" },
  { value: "bus", label: "Bus" },
];

export default function DriverVehicle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState({
    make: "", model: "", registration_number: "", vehicle_type: "minibus",
    seating_capacity: 14, luggage_capacity: 6, year: "", insurance_info: "", permit_info: "",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const profiles = await base44.entities.DriverProfile.filter({ user_id: user.id });
        if (!active || !profiles.length) return;
        const p = profiles[0];
        setProfile(p);
        if (p.vehicle_id) {
          const v = await base44.entities.Vehicle.get(p.vehicle_id);
          if (!active) return;
          setVehicle(v);
          setForm({
            make: v.make || "", model: v.model || "", registration_number: v.registration_number || "",
            vehicle_type: v.vehicle_type || "minibus",
            seating_capacity: v.seating_capacity || 14, luggage_capacity: v.luggage_capacity || 6,
            year: v.year ? String(v.year) : "", insurance_info: v.insurance_info || "", permit_info: v.permit_info || "",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user.id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        seating_capacity: Number(form.seating_capacity) || 0,
        luggage_capacity: Number(form.luggage_capacity) || 0,
        year: form.year ? Number(form.year) : undefined,
      };
      let saved;
      if (vehicle) {
        saved = await base44.entities.Vehicle.update(vehicle.id, payload);
      } else {
        saved = await base44.entities.Vehicle.create({ ...payload, verification_status: "pending" });
        if (profile) {
          await base44.entities.DriverProfile.update(profile.id, { vehicle_id: saved.id });
        }
      }
      setVehicle(saved);
      toast({ title: "Vehicle saved" });
    } catch (err) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vehicle</h1>
        <p className="mt-1 text-muted-foreground">Your vehicle details are reviewed by Treba before you can receive allocations.</p>
      </div>

      {vehicle && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Vehicle verification</div>
            <StatusBadge status={vehicle.verification_status} />
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-border bg-card p-6 treba-shadow">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Make</Label><Input value={form.make} onChange={set("make")} required className="h-11" /></div>
          <div className="space-y-2"><Label>Model</Label><Input value={form.model} onChange={set("model")} required className="h-11" /></div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Registration number</Label><Input value={form.registration_number} onChange={set("registration_number")} required className="h-11" /></div>
          <div className="space-y-2"><Label>Vehicle type</Label>
            <Select value={form.vehicle_type} onValueChange={(v) => setForm((f) => ({ ...f, vehicle_type: v }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label>Year</Label><Input type="number" value={form.year} onChange={set("year")} className="h-11" /></div>
          <div className="space-y-2"><Label>Passenger capacity</Label><Input type="number" min="1" value={form.seating_capacity} onChange={set("seating_capacity")} className="h-11" /></div>
          <div className="space-y-2"><Label>Luggage capacity (bags)</Label><Input type="number" min="0" value={form.luggage_capacity} onChange={set("luggage_capacity")} className="h-11" /></div>
        </div>
        <div className="space-y-2"><Label>Insurance information</Label><Input value={form.insurance_info} onChange={set("insurance_info")} placeholder="Provider & policy reference" className="h-11" /></div>
        <div className="space-y-2"><Label>Permit information</Label><Input value={form.permit_info} onChange={set("permit_info")} placeholder="Operating permit reference" className="h-11" /></div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-11 px-6">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : vehicle ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {vehicle ? "Save vehicle" : "Add vehicle"}
          </Button>
        </div>
      </form>
    </div>
  );
}