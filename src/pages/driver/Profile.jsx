import React, { useEffect, useState } from "react";
import { Loader2, Save, Car, ShieldCheck, BadgeCheck, AlertTriangle, Route as RouteIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";

export default function DriverProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [form, setForm] = useState({
    full_name: "", phone: "", id_number: "", address: "",
    license_number: "", license_expiry: "", driving_experience_years: 0,
    availability_status: "available",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const existing = await base44.entities.DriverProfile.filter({ user_id: user.id });
        if (!active) return;
        if (existing && existing.length) {
          const p = existing[0];
          setProfile(p);
          setProfileId(p.id);
          setForm({
            full_name: p.full_name || "",
            phone: p.phone || "",
            id_number: p.id_number || "",
            address: p.address || "",
            license_number: p.license_number || "",
            license_expiry: (p.license_expiry || "").slice(0, 10),
            driving_experience_years: p.driving_experience_years || 0,
            availability_status: p.availability_status || "available",
          });
          if (p.vehicle_id) {
            try {
              const v = await base44.entities.Vehicle.get(p.vehicle_id);
              if (active) setVehicle(v);
            } catch (e) {}
          }
          if (p.wallet_id) {
            try {
              const w = await base44.entities.DriverWallet.get(p.wallet_id);
              if (active) setWallet(w);
            } catch (e) {}
          }
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
      const payload = { ...form, driving_experience_years: Number(form.driving_experience_years) || 0 };
      const saved = await base44.entities.DriverProfile.update(profileId, payload);
      setProfile(saved);
      toast({ title: "Driver profile saved" });
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

  const activated = profile?.is_activated_for_paid_bookings;
  const payoutVerified = wallet?.verification_status === "verified";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Driver Profile</h1>
        <p className="mt-1 text-muted-foreground">Your details are reviewed by Treba before you can receive passenger requests.</p>
      </div>

      {/* Status banners */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Car className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Verification status</div>
          <StatusBadge status={profile?.verification_status || "pending"} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {activated ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" /> Activated for paid bookings
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Not activated
            </span>
          )}
        </div>
      </div>

      {!payoutVerified && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Verify your payout method in the Earnings & Wallet page to be activated for paid Treba bookings.
        </div>
      )}

      {/* Personal & driver info */}
      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-border bg-card p-6 treba-shadow">
        <h2 className="text-base font-semibold">Personal information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={set("full_name")} required className="h-11" /></div>
          <div className="space-y-2"><Label>Mobile number</Label><Input type="tel" value={form.phone} onChange={set("phone")} className="h-11" /></div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>ID / verification number</Label><Input value={form.id_number} onChange={set("id_number")} className="h-11" /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={set("address")} className="h-11" /></div>
        </div>

        <h2 className="mt-2 text-base font-semibold">Driver information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label>Licence number</Label><Input value={form.license_number} onChange={set("license_number")} className="h-11" /></div>
          <div className="space-y-2"><Label>Licence expiry</Label><Input type="date" value={form.license_expiry} onChange={set("license_expiry")} className="h-11" /></div>
          <div className="space-y-2"><Label>Experience (years)</Label><Input type="number" min="0" value={form.driving_experience_years} onChange={set("driving_experience_years")} className="h-11" /></div>
        </div>

        <div className="space-y-2">
          <Label>Availability</Label>
          <div className="flex gap-2">
            {["available", "unavailable"].map((opt) => (
              <button key={opt} type="button" onClick={() => setForm((f) => ({ ...f, availability_status: opt }))}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${form.availability_status === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-11 px-6">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save profile
          </Button>
        </div>
      </form>

      {/* Vehicle */}
      {vehicle && (
        <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
          <h2 className="text-base font-semibold">Vehicle</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><div className="text-xs text-muted-foreground">Make / model</div><div className="font-medium">{vehicle.make} {vehicle.model}</div></div>
            <div><div className="text-xs text-muted-foreground">Registration</div><div className="font-medium">{vehicle.registration_number}</div></div>
            <div><div className="text-xs text-muted-foreground">Type</div><div className="font-medium capitalize">{vehicle.vehicle_type}</div></div>
            <div><div className="text-xs text-muted-foreground">Passenger capacity</div><div className="font-medium">{vehicle.seating_capacity}</div></div>
            <div><div className="text-xs text-muted-foreground">Luggage capacity</div><div className="font-medium">{vehicle.luggage_capacity} bags</div></div>
            <div><div className="text-xs text-muted-foreground">Vehicle verification</div><StatusBadge status={vehicle.verification_status} /></div>
          </div>
          {vehicle.insurance_info && <p className="mt-3 text-xs text-muted-foreground">Insurance: {vehicle.insurance_info}</p>}
          {vehicle.permit_info && <p className="text-xs text-muted-foreground">Permit: {vehicle.permit_info}</p>}
        </div>
      )}

      {/* Routes */}
      {profile?.preferred_routes?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
          <h2 className="text-base font-semibold">Preferred town-to-town routes</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.preferred_routes.map((r) => (
              <li key={r} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <RouteIcon className="h-3.5 w-3.5" /> {r}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Treba allocates passenger requests to these routes. You cannot create individual passenger trips.</p>
        </div>
      )}
    </div>
  );
}