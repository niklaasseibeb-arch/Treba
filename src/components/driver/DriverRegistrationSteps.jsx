import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Plus, X, Car, Wallet, Route as RouteIcon, User as UserIcon, ShieldCheck, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { NAMIBIAN_TOWNS } from "@/lib/treba-places";
import { registerPayoutMethod } from "@/lib/payoutGateway";

const VEHICLE_TYPES = [
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "minibus", label: "Minibus" },
  { value: "van", label: "Van" },
  { value: "bus", label: "Bus" },
];

const METHOD_TYPES = [
  { value: "bank_account", label: "Bank account" },
  { value: "mobile_wallet", label: "Mobile wallet" },
  { value: "ewallet", label: "E-wallet" },
  { value: "other", label: "Other" },
];

const STEPS = [
  { key: "personal", label: "Personal", icon: UserIcon },
  { key: "driver", label: "Driver", icon: ShieldCheck },
  { key: "vehicle", label: "Vehicle", icon: Car },
  { key: "routes", label: "Routes", icon: RouteIcon },
  { key: "payout", label: "Payout", icon: Wallet },
];

export default function DriverRegistrationSteps({ email }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [providers, setProviders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [personal, setPersonal] = useState({ full_name: "", phone: "", id_number: "", address: "" });
  const [driver, setDriver] = useState({ license_number: "", license_expiry: "", driving_experience_years: 0 });
  const [vehicle, setVehicle] = useState({
    make: "", model: "", registration_number: "", vehicle_type: "minibus",
    seating_capacity: 14, luggage_capacity: 6, year: "", insurance_info: "", permit_info: "",
  });
  const [routes, setRoutes] = useState([]);
  const [routeOrigin, setRouteOrigin] = useState("");
  const [routeDest, setRouteDest] = useState("");
  const [payout, setPayout] = useState({
    payout_method_type: "bank_account", provider: "", account_number: "", account_holder_name: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.PayoutProvider.filter({ is_active: true });
        setProviders(list || []);
      } catch (e) {
        setProviders([]);
      }
    })();
  }, []);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

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

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  const validateStep = () => {
    setError("");
    if (stepIdx === 0) {
      if (!personal.full_name.trim() || !personal.phone.trim()) return setError("Full name and mobile number are required."), false;
    }
    if (stepIdx === 1) {
      if (!driver.license_number.trim() || !driver.license_expiry) return setError("Licence number and expiry are required."), false;
    }
    if (stepIdx === 2) {
      if (!vehicle.make.trim() || !vehicle.model.trim() || !vehicle.registration_number.trim())
        return setError("Make, model and registration number are required."), false;
    }
    if (stepIdx === 3) {
      if (routes.length === 0) return setError("Add at least one town-to-town route."), false;
    }
    if (stepIdx === 4) {
      if (!payout.provider.trim() || !payout.account_number.trim() || !payout.account_holder_name.trim())
        return setError("Payout provider, account number and holder name are required."), false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (stepIdx === STEPS.length - 1) return finish();
    next();
  };

  const finish = async () => {
    setSubmitting(true);
    setError("");
    try {
      const me = await base44.auth.me();
      // 1. Vehicle
      const veh = await base44.entities.Vehicle.create({
        ...vehicle,
        seating_capacity: Number(vehicle.seating_capacity) || 0,
        luggage_capacity: Number(vehicle.luggage_capacity) || 0,
        year: vehicle.year ? Number(vehicle.year) : undefined,
        verification_status: "pending",
      });
      // 2. Payout method via gateway (never stores PIN/password/OTP)
      const { provider_reference, verification_status } = await registerPayoutMethod(payout);
      const wallet = await base44.entities.DriverWallet.create({
        ...payout,
        provider_reference,
        verification_status,
        current_balance: 0,
        pending_earnings: 0,
        available_earnings: 0,
        completed_payouts_total: 0,
        treba_fee_rate: 0,
      });
      // 3. Driver profile
      await base44.entities.DriverProfile.create({
        user_id: me.id,
        ...personal,
        ...driver,
        driving_experience_years: Number(driver.driving_experience_years) || 0,
        profile_photo_url: photoUrl,
        preferred_routes: routes,
        vehicle_id: veh.id,
        wallet_id: wallet.id,
        verification_status: "pending",
        account_status: "pending",
        availability_status: "available",
        is_activated_for_paid_bookings: false,
      });
      try {
        await base44.auth.updateMe({ app_role: "driver", full_name: personal.full_name, phone: personal.phone });
      } catch (e) {}
      toast({ title: "Registration submitted", description: "Your driver account is pending verification." });
      const dest = safeReturnTo() === "/" ? "/app/driver" : safeReturnTo();
      window.location.href = dest;
    } catch (err) {
      setError(err.message || "Could not complete registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const StepIcon = STEPS[stepIdx].icon;

  return (
    <AuthLayout icon={Car} title="Complete your driver registration" subtitle={email}>
      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === stepIdx;
          const done = i < stepIdx;
          return (
            <li key={s.key} className="flex items-center">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {done ? "✓" : <Icon className="h-4 w-4" />}
              </span>
              <span className={`ml-1.5 text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="mx-2 h-px w-4 bg-border" />}
            </li>
          );
        })}
      </ol>

      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Step 1: Personal */}
      {stepIdx === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">
              {photoUrl ? <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" /> : <UserIcon className="h-7 w-7" />}
            </div>
            <div>
              <input id="dPhoto" type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              <Label htmlFor="dPhoto" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {photoUrl ? "Change photo" : "Add photo"}
              </Label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Full name</Label><Input value={personal.full_name} onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })} className="h-11" required /></div>
            <div className="space-y-2"><Label>Mobile number</Label><Input type="tel" value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} placeholder="081 123 4567" className="h-11" required /></div>
          </div>
          <div className="space-y-2"><Label>ID / verification number</Label><Input value={personal.id_number} onChange={(e) => setPersonal({ ...personal, id_number: e.target.value })} className="h-11" /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} placeholder="Street, town" className="h-11" /></div>
        </div>
      )}

      {/* Step 2: Driver */}
      {stepIdx === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Driver licence number</Label><Input value={driver.license_number} onChange={(e) => setDriver({ ...driver, license_number: e.target.value })} className="h-11" required /></div>
            <div className="space-y-2"><Label>Licence expiry</Label><Input type="date" value={driver.license_expiry} onChange={(e) => setDriver({ ...driver, license_expiry: e.target.value })} className="h-11" required /></div>
          </div>
          <div className="space-y-2"><Label>Driving experience (years)</Label><Input type="number" min="0" value={driver.driving_experience_years} onChange={(e) => setDriver({ ...driver, driving_experience_years: e.target.value })} className="h-11" /></div>
          <p className="text-xs text-muted-foreground">Your verification status will be set to <strong>Pending</strong> until Treba reviews your documents.</p>
        </div>
      )}

      {/* Step 3: Vehicle */}
      {stepIdx === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Make</Label><Input value={vehicle.make} onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })} className="h-11" required /></div>
            <div className="space-y-2"><Label>Model</Label><Input value={vehicle.model} onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })} className="h-11" required /></div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Registration number</Label><Input value={vehicle.registration_number} onChange={(e) => setVehicle({ ...vehicle, registration_number: e.target.value })} className="h-11" required /></div>
            <div className="space-y-2"><Label>Vehicle type</Label>
              <Select value={vehicle.vehicle_type} onValueChange={(v) => setVehicle({ ...vehicle, vehicle_type: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Year</Label><Input type="number" value={vehicle.year} onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })} className="h-11" /></div>
            <div className="space-y-2"><Label>Passenger capacity</Label><Input type="number" min="1" value={vehicle.seating_capacity} onChange={(e) => setVehicle({ ...vehicle, seating_capacity: e.target.value })} className="h-11" /></div>
            <div className="space-y-2"><Label>Luggage capacity (bags)</Label><Input type="number" min="0" value={vehicle.luggage_capacity} onChange={(e) => setVehicle({ ...vehicle, luggage_capacity: e.target.value })} className="h-11" /></div>
          </div>
          <div className="space-y-2"><Label>Insurance information</Label><Input value={vehicle.insurance_info} onChange={(e) => setVehicle({ ...vehicle, insurance_info: e.target.value })} placeholder="Provider & policy reference" className="h-11" /></div>
          <div className="space-y-2"><Label>Permit information</Label><Input value={vehicle.permit_info} onChange={(e) => setVehicle({ ...vehicle, permit_info: e.target.value })} placeholder="Operating permit reference" className="h-11" /></div>
        </div>
      )}

      {/* Step 4: Routes */}
      {stepIdx === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Indicate the town-to-town routes you are willing and qualified to operate. You cannot create individual passenger trips — Treba allocates passenger requests to your routes.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Select value={routeOrigin} onValueChange={setRouteOrigin}>
              <SelectTrigger className="h-11"><span className="text-muted-foreground">From town</span>{routeOrigin && <span className="ml-1">{routeOrigin}</span>}</SelectTrigger>
              <SelectContent>{NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={routeDest} onValueChange={setRouteDest}>
              <SelectTrigger className="h-11"><span className="text-muted-foreground">To town</span>{routeDest && <span className="ml-1">{routeDest}</span>}</SelectTrigger>
              <SelectContent>{NAMIBIAN_TOWNS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="outline" className="h-11 px-3" onClick={addRoute}><Plus className="mr-1 h-4 w-4" /> Add</Button>
          </div>
          {routes.length > 0 && (
            <ul className="space-y-2">
              {routes.map((r) => (
                <li key={r} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <RouteIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{r}</span>
                  <button type="button" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => setRoutes(routes.filter((x) => x !== r))}><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Step 5: Payout */}
      {stepIdx === 4 && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-xs text-foreground">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>A verified payout method is required before you can be activated for paid Treba bookings. Never share your PIN, banking password or OTP — Treba only stores a secure provider reference.</span>
          </div>
          <div className="space-y-2">
            <Label>Payout method</Label>
            <Select value={payout.payout_method_type} onValueChange={(v) => setPayout({ ...payout, payout_method_type: v, provider: "" })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{METHOD_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Provider</Label>
            {providers.length > 0 ? (
              <Select value={payout.provider} onValueChange={(v) => setPayout({ ...payout, provider: v })}>
                <SelectTrigger className="h-11"><span className="text-muted-foreground">Select provider</span>{payout.provider && <span className="ml-1">{payout.provider}</span>}</SelectTrigger>
                <SelectContent>{providers.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input value={payout.provider} onChange={(e) => setPayout({ ...payout, provider: e.target.value })} placeholder="e.g. FNB, MTC Mobile Money" className="h-11" required />
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Account / mobile number</Label><Input value={payout.account_number} onChange={(e) => setPayout({ ...payout, account_number: e.target.value })} className="h-11" required /></div>
            <div className="space-y-2"><Label>Account holder name</Label><Input value={payout.account_holder_name} onChange={(e) => setPayout({ ...payout, account_holder_name: e.target.value })} className="h-11" required /></div>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={back} disabled={stepIdx === 0}>Back</Button>
        <Button type="button" onClick={handleNext} disabled={submitting} className="h-11 px-6">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {stepIdx === STEPS.length - 1 ? "Submit registration" : "Continue"}
          {stepIdx !== STEPS.length - 1 && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </AuthLayout>
  );
}