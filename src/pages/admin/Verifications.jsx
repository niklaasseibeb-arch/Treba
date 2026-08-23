import React, { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, BadgeCheck, Car, Wallet, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import DriverVerificationCard from "@/components/admin/DriverVerificationCard";
import StatusBadge from "@/components/StatusBadge";

const TABS = [
  { key: "drivers", label: "Drivers", icon: ShieldCheck },
  { key: "vehicles", label: "Vehicles", icon: Car },
  { key: "wallets", label: "Wallets", icon: Wallet },
];

export default function AdminVerifications() {
  const { toast } = useToast();
  const [tab, setTab] = useState("drivers");
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [vehicleMap, setVehicleMap] = useState({});
  const [walletMap, setWalletMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allDrivers, allVehicles, allWallets] = await Promise.all([
        base44.entities.DriverProfile.list("-created_date", 200),
        base44.entities.Vehicle.list("-created_date", 200),
        base44.entities.DriverWallet.list("-created_date", 200),
      ]);
      setDrivers(allDrivers || []);
      setVehicles((allVehicles || []).filter((v) => v.verification_status !== "approved"));
      setWallets((allWallets || []).filter((w) => w.verification_status !== "verified"));

      const vMap = {};
      (allVehicles || []).forEach((v) => { vMap[v.id] = v; });
      setVehicleMap(vMap);

      const wMap = {};
      (allWallets || []).forEach((w) => { wMap[w.id] = w; });
      setWalletMap(wMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action, id) => {
    try {
      if (action === "driver_approve") {
        await base44.entities.DriverProfile.update(id, { verification_status: "approved" });
      } else if (action === "driver_reject") {
        await base44.entities.DriverProfile.update(id, { verification_status: "rejected" });
      } else if (action === "vehicle_approve") {
        await base44.entities.Vehicle.update(id, { verification_status: "approved" });
      } else if (action === "vehicle_reject") {
        await base44.entities.Vehicle.update(id, { verification_status: "rejected" });
      } else if (action === "wallet_verify") {
        await base44.entities.DriverWallet.update(id, { verification_status: "verified" });
      } else if (action === "wallet_reject") {
        await base44.entities.DriverWallet.update(id, { verification_status: "rejected" });
      } else if (action === "activate") {
        const res = await base44.functions.invoke("activateDriverTrial", { driver_profile_id: id });
        toast({
          title: "Driver activated",
          description: res.data?.trial_created ? "60-day free trial started." : "Driver activated (trial already used).",
        });
      } else if (action === "deactivate") {
        await base44.entities.DriverProfile.update(id, { is_activated_for_paid_bookings: false });
        toast({ title: "Driver deactivated" });
      }
      toast({ title: "Updated" });
      load();
    } catch (err) {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    }
  };

  const pendingDrivers = drivers.filter(
    (d) => d.verification_status !== "approved" || !d.is_activated_for_paid_bookings
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Driver Verification</h1>
          <p className="mt-1 text-muted-foreground">Review and approve drivers, vehicles and payout methods. Activate drivers once all checks pass.</p>
        </div>
        <Button variant="outline" className="h-9" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === "drivers" ? (
        pendingDrivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">All drivers verified and activated.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingDrivers.map((d) => (
              <DriverVerificationCard
                key={d.id}
                driver={d}
                vehicle={d.vehicle_id ? vehicleMap[d.vehicle_id] : null}
                wallet={d.wallet_id ? walletMap[d.wallet_id] : null}
                onAction={handleAction}
              />
            ))}
          </div>
        )
      ) : tab === "vehicles" ? (
        vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vehicles pending verification.</p>
        ) : (
          <ul className="space-y-3">
            {vehicles.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 treba-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Car className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold">{v.make} {v.model}</div>
                  <div className="text-xs text-muted-foreground">{v.registration_number} · {v.seating_capacity} seats · {v.luggage_capacity} bags</div>
                </div>
                <StatusBadge status={v.verification_status} className="ml-auto" />
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button size="sm" variant="outline" className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleAction("vehicle_approve", v.id)}>Approve</Button>
                  <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleAction("vehicle_reject", v.id)}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : tab === "wallets" ? (
        wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payout methods pending verification.</p>
        ) : (
          <ul className="space-y-3">
            {wallets.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 treba-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Wallet className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold capitalize">{w.payout_method_type?.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{w.provider} · {w.account_number} · {w.account_holder_name}</div>
                </div>
                <StatusBadge status={w.verification_status} className="ml-auto" />
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button size="sm" variant="outline" className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleAction("wallet_verify", w.id)}>Verify</Button>
                  <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleAction("wallet_reject", w.id)}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}