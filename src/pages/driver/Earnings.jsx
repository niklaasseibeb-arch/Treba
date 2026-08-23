import React, { useEffect, useState } from "react";
import { Loader2, Banknote } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import WalletOverview from "@/components/driver/WalletOverview";
import PayoutMethodCard from "@/components/driver/PayoutMethodCard";
import PayoutHistorySection from "@/components/driver/PayoutHistorySection";

export default function DriverEarnings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.DriverWallet.filter({ created_by_id: user.id });
      setWallet(list && list.length ? list[0] : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user.id]);

  const handlePayout = async () => {
    if (!wallet) return;
    const amount = wallet.available_earnings || 0;
    if (amount <= 0) {
      toast({ title: "No available earnings to pay out", variant: "destructive" });
      return;
    }
    if (wallet.verification_status !== "verified") {
      toast({ title: "Verify your payout method first", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const res = await base44.functions.invoke("processDriverPayout", { amount });
      if (res.data?.error) { toast({ title: res.data.error, variant: "destructive" }); return; }
      const ref = res.data?.payout?.transaction_reference;
      toast({ title: "Payout requested", description: ref ? `Reference ${ref}` : undefined });
      load();
    } catch (err) {
      toast({ title: "Payout failed", description: err.message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Earnings & Wallet</h1>
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <Banknote className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No wallet found. Your wallet is created during registration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Earnings & Wallet</h1>
          <p className="mt-1 text-muted-foreground">Track your balance, payout method and payout history.</p>
        </div>
        <Button onClick={handlePayout} disabled={paying || !wallet.available_earnings} className="h-10">
          {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
          Request payout
        </Button>
      </div>

      <WalletOverview wallet={wallet} />
      <PayoutMethodCard wallet={wallet} onUpdated={(w) => setWallet(w)} />
      <PayoutHistorySection />
    </div>
  );
}