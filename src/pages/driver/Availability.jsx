import React, { useEffect, useState } from "react";
import { Loader2, Save, Plus, X, Route as RouteIcon, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { NAMIBIAN_TOWNS } from "@/lib/treba-places";

export default function DriverAvailability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [availability, setAvailability] = useState("available");
  const [routes, setRoutes] = useState([]);
  const [routeOrigin, setRouteOrigin] = useState("");
  const [routeDest, setRouteDest] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const profiles = await base44.entities.DriverProfile.filter({ user_id: user.id });
        if (!active || !profiles.length) return;
        const p = profiles[0];
        setProfile(p);
        setAvailability(p.availability_status || "available");
        setRoutes(p.preferred_routes || []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user.id]);

  const addRoute = () => {
    if (!routeOrigin || !routeDest || routeOrigin === routeDest) {
      toast({ title: "Pick two different towns", variant: "destructive" });
      return;
    }
    const route = `${routeOrigin} - ${routeDest}`;
    if (routes.includes(route)) {
      toast({ title: "Route already added", variant: "destructive" });
      return;
    }
    setRoutes((r) => [...r, route]);
    setRouteOrigin(""); setRouteDest("");
  };

  const removeRoute = (r) => setRoutes((rs) => rs.filter((x) => x !== r));

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const saved = await base44.entities.DriverProfile.update(profile.id, {
        availability_status: availability,
        preferred_routes: routes,
      });
      setProfile(saved);
      toast({ title: "Availability saved" });
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
        <h1 className="text-2xl font-bold tracking-tight">Availability & Routes</h1>
        <p className="mt-1 text-muted-foreground">Set when you're available and the town-to-town routes you operate. Treba allocates passenger requests to these routes.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Availability status</h2>
            <p className="text-xs text-muted-foreground">When unavailable, Treba will not allocate new passenger requests to you.</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {["available", "unavailable"].map((opt) => (
            <button key={opt} type="button" onClick={() => setAvailability(opt)}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${availability === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
        <h2 className="text-base font-semibold">Preferred town-to-town routes</h2>
        <p className="mt-1 text-xs text-muted-foreground">Add the routes you're willing and qualified to operate.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Select value={routeOrigin} onValueChange={setRouteOrigin}>
            <SelectTrigger className="h-11"><span className="text-muted-foreground">{routeOrigin || "From town"}</span></SelectTrigger>
            <SelectContent>{NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={routeDest} onValueChange={setRouteDest}>
            <SelectTrigger className="h-11"><span className="text-muted-foreground">{routeDest || "To town"}</span></SelectTrigger>
            <SelectContent>{NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" className="h-11 px-3" onClick={addRoute}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
        {routes.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {routes.map((r) => (
              <li key={r} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <RouteIcon className="h-4 w-4 text-primary" />
                <span className="font-medium">{r}</span>
                <button type="button" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => removeRoute(r)}><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No routes added yet.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="h-11 px-6">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}