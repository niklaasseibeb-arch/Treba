import React, { useState } from "react";
import { Wallet, ShieldCheck, Loader2, BadgeCheck, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { verifyPayoutMethod } from "@/lib/payoutGateway";

const METHOD_LABELS = {
  bank_account: "Bank account",
  mobile_wallet: "Mobile wallet",
  ewallet: "E-wallet",
  other: "Other",
};

export default function PayoutMethodCard({ wallet, onUpdated }) {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  const verified = wallet?.verification_status === "verified";

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { verification_status } = await verifyPayoutMethod(wallet.provider_reference, wallet.provider);
      const updated = await base44.entities.DriverWallet.update(wallet.id, { verification_status });
      // Activate driver for paid bookings once payout is verified
      if (verification_status === "verified" && wallet.driver_id) {
        try {
          const dp = await base44.entities.DriverProfile.filter({ wallet_id: wallet.id });
          if (dp && dp.length) {
            await base44.entities.DriverProfile.update(dp[0].id, { is_activated_for_paid_bookings: true });
          }
        } catch (e) {}
      }
      onUpdated?.(updated);
      toast({ title: "Payout method verified", description: "You can now be activated for paid bookings." });
    } catch (err) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Payout method</h2>
        {verified ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {wallet?.verification_status || "Pending"}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">Method</div>
          <div className="text-sm font-medium">{METHOD_LABELS[wallet?.payout_method_type] || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Provider</div>
          <div className="text-sm font-medium">{wallet?.provider || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Account / mobile number</div>
          <div className="text-sm font-medium">{wallet?.account_number || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Account holder</div>
          <div className="text-sm font-medium">{wallet?.account_holder_name || "—"}</div>
        </div>
      </div>

      {wallet?.provider_reference && (
        <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Provider reference: <span className="font-mono">{wallet.provider_reference}</span>
        </div>
      )}

      {!verified && (
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={handleVerify} disabled={verifying} className="h-10">
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Verify payout method
          </Button>
          <p className="text-xs text-muted-foreground">Required before activation for paid bookings.</p>
        </div>
      )}
    </div>
  );
}