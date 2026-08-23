import React, { useState } from "react";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, Car, Wallet, BadgeCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";

function ActionRow({ label, status, onApprove, onReject, approveLabel = "Approve", rejectLabel = "Reject" }) {
  const [busy, setBusy] = useState(null);
  const run = async (fn, tag) => {
    setBusy(tag);
    try { await fn(); } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <span className="text-sm font-medium">{label}</span>
      <StatusBadge status={status} className="ml-1" />
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(onReject, "reject")}
          className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
          {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {approveLabel}
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => run(onReject, "reject")}
          className="h-8 border-red-200 text-red-700 hover:bg-red-50">
          {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          {rejectLabel}
        </Button>
      </div>
    </div>
  );
}

export default function DriverVerificationCard({ driver, vehicle, wallet, onAction }) {
  const [activating, setActivating] = useState(false);

  const driverApproved = driver.verification_status === "approved";
  const vehicleApproved = vehicle?.verification_status === "approved";
  const walletVerified = wallet?.verification_status === "verified";
  const canActivate = driverApproved && vehicleApproved && walletVerified && !driver.is_activated_for_paid_bookings;

  const handleActivate = async () => {
    setActivating(true);
    try { await onAction("activate", driver.id); } finally { setActivating(false); }
  };

  const handleDeactivate = async () => {
    setActivating(true);
    try { await onAction("deactivate", driver.id); } finally { setActivating(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 treba-shadow space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">{driver.full_name}</div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{driver.phone || "—"}</span>
            <span>Licence: {driver.license_number || "—"}</span>
            <span>Exp: {driver.license_expiry || "—"}</span>
          </div>
        </div>
        {driver.is_activated_for_paid_bookings ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" /> Activated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Not activated
          </span>
        )}
      </div>

      {/* Verification actions */}
      <div className="space-y-2">
        <ActionRow label="Driver verification" status={driver.verification_status}
          onApprove={() => onAction("driver_approve", driver.id)}
          onReject={() => onAction("driver_reject", driver.id)} />

        {vehicle && (
          <ActionRow label="Vehicle verification" status={vehicle.verification_status}
            onApprove={() => onAction("vehicle_approve", vehicle.id)}
            onReject={() => onAction("vehicle_reject", vehicle.id)} />
        )}

        {wallet && (
          <ActionRow label="Payout method" status={wallet.verification_status}
            approveLabel="Verify" rejectLabel="Reject"
            onApprove={() => onAction("wallet_verify", wallet.id)}
            onReject={() => onAction("wallet_reject", wallet.id)} />
        )}
      </div>

      {/* Vehicle summary */}
      {vehicle && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
          <Car className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <span className="font-medium">{vehicle.make} {vehicle.model}</span>
            <span className="text-muted-foreground"> · {vehicle.registration_number} · {vehicle.seating_capacity} seats</span>
          </div>
        </div>
      )}

      {/* Wallet summary */}
      {wallet && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
          <Wallet className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <span className="font-medium capitalize">{wallet.payout_method_type?.replace("_", " ")}</span>
            <span className="text-muted-foreground"> · {wallet.provider} · {wallet.account_number}</span>
          </div>
        </div>
      )}

      {/* Activation */}
      {canActivate && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <BadgeCheck className="h-4 w-4 text-emerald-700" />
          <span className="text-sm text-emerald-800">All checks passed — ready to activate.</span>
          <Button size="sm" className="ml-auto h-8" disabled={activating} onClick={handleActivate}>
            {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
            Activate driver
          </Button>
        </div>
      )}

      {driver.is_activated_for_paid_bookings && (
        <Button size="sm" variant="outline" disabled={activating} onClick={handleDeactivate}
          className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50">
          {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          Deactivate
        </Button>
      )}
    </div>
  );
}