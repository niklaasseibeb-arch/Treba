import React from "react";
import { Wallet, Clock, TrendingUp, BadgeCheck, Banknote, AlertTriangle, RotateCcw, Percent } from "lucide-react";

const CARDS = [
  { key: "current_balance", label: "Current balance", icon: Wallet, tone: "primary" },
  { key: "pending_earnings", label: "Pending earnings", icon: Clock, tone: "amber" },
  { key: "available_earnings", label: "Available for payout", icon: TrendingUp, tone: "emerald" },
  { key: "paid_earnings_total", label: "Paid earnings", icon: BadgeCheck, tone: "emerald" },
  { key: "pending_payout_total", label: "Pending payout", icon: Banknote, tone: "blue" },
  { key: "completed_payouts_total", label: "Completed payouts", icon: BadgeCheck, tone: "slate" },
  { key: "failed_payout_total", label: "Failed payouts", icon: AlertTriangle, tone: "rose" },
  { key: "reversed_payout_total", label: "Reversed payouts", icon: RotateCcw, tone: "slate" },
  { key: "treba_fees_total", label: "Treba fees", icon: Percent, tone: "primary" },
];

const toneClasses = {
  primary: "bg-primary/15 text-primary",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  slate: "bg-slate-100 text-slate-700",
  rose: "bg-rose-100 text-rose-700",
};

export default function WalletOverview({ wallet }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.key} className="rounded-2xl border border-border bg-card p-4 treba-shadow">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses[c.tone]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
            <div className="mt-2 text-xl font-bold">N${(wallet?.[c.key] ?? 0).toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}