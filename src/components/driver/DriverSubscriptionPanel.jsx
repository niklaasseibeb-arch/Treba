import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sparkles, Crown, Rocket, Loader2, Gift, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SubscriptionCheckoutDialog from "@/components/driver/SubscriptionCheckoutDialog";

const PLAN_ICON = { starter: Rocket, standard: Sparkles, premium: Crown };

const STATUS_TONE = {
  trial_active: "bg-emerald-100 text-emerald-700",
  trial_expiring: "bg-amber-100 text-amber-700",
  trial_expired: "bg-red-100 text-red-700",
  active: "bg-emerald-100 text-emerald-700",
  expiring: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  suspended: "bg-slate-200 text-slate-700",
  cancelled: "bg-slate-200 text-slate-500",
};

const formatPrice = (price) => `N$${Number(price || 0).toLocaleString()}`;
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function DriverSubscriptionPanel() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getDriverSubscription", {});
      setData(res.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plans = data?.plans || [];
  const current = data?.current_subscription;
  const isTrial = !!current?.is_trial;
  const displayStatus = current?.display_status;
  const trialDuration = data?.trial_duration_days || 60;
  const trialDay = current?.trial_day;
  const daysLeft = current?.days_remaining;
  const used = current?.trips_used || 0;
  const allowance = current?.trip_allowance || 0;
  const remaining = current?.is_unlimited ? null : Math.max(0, allowance - used);
  const progressPct = current?.is_unlimited ? 0 : Math.min(100, allowance ? (used / allowance) * 100 : 0);
  const trialProgress = trialDay ? Math.min(100, (trialDay / trialDuration) * 100) : 0;

  const trialActive = isTrial && (displayStatus === "trial_active" || displayStatus === "trial_expiring");
  const trialExpired = isTrial && displayStatus === "trial_expired";

  return (
    <div className="space-y-6">
      {trialActive && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 treba-shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Gift className="h-6 w-6" />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-primary">
                  {trialDuration} days free trial
                </div>
                <div className="text-lg font-extrabold">
                  {trialDay ? `Day ${trialDay} of ${trialDuration}` : "Trial active"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-primary">{daysLeft ?? trialDuration}</div>
              <div className="text-xs font-medium text-muted-foreground">days remaining</div>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div className="h-full rounded-full bg-primary" style={{ width: `${trialProgress}%` }} />
          </div>
          {displayStatus === "trial_expiring" && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Your trial ends soon — choose a plan below to keep receiving passenger requests after your trial.
            </p>
          )}
        </div>
      )}

      {trialExpired && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-bold text-amber-800">Your free trial has ended</div>
            <p className="mt-0.5 text-sm text-amber-700">
              Select and activate a paid subscription plan below to continue receiving new passenger requests and route
              allocations. Existing confirmed bookings are unaffected.
            </p>
          </div>
        </div>
      )}

      {current && !isTrial && (
        <Card className="border-border treba-shadow">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your subscription</p>
              <CardTitle className="mt-1 text-lg">{current.plan_name}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Renews {formatDate(current.renewal_date)}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                STATUS_TONE[displayStatus] || STATUS_TONE[current.status] || ""
              }`}
            >
              {displayStatus || current.status}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Monthly price" value={formatPrice(current.price)} />
              <Metric label="Trip allowance" value={current.is_unlimited ? "Unlimited" : `${allowance} trips`} />
              <Metric label="Trips used" value={current.is_unlimited ? `${used}` : `${used} / ${allowance}`} />
              <Metric label="Remaining trips" value={current.is_unlimited ? "Unlimited" : `${remaining}`} />
            </div>
            {!current.is_unlimited && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {remaining > 0
                    ? `${remaining} completed trip${remaining === 1 ? "" : "s"} left this subscription month.`
                    : "Trip allowance reached — upgrade or renew to continue."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!current && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            You don't have an active subscription yet. Choose a plan below to start receiving passenger allocations.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subscription plans</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Drivers pay a simple monthly subscription. Treba never charges commission on passenger fares.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const Icon = PLAN_ICON[p.plan_code] || Sparkles;
            const isCurrent = p.plan_code === current?.plan_code && current && !isTrial;
            const unlimited = !!p.is_unlimited;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-5 treba-shadow ${
                  isCurrent ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                {p.plan_code === "premium" && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase text-primary-foreground">
                    Best value
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-base font-bold">{p.name}</span>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold">{formatPrice(p.price)}</span>
                  <span className="text-sm text-muted-foreground"> / month</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {unlimited ? "Unlimited completed trips" : `Up to ${p.trip_allowance} completed trips / month`}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> No commission on fares
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Passenger allocations to your routes
                  </li>
                </ul>
                <div className="mt-5 flex-1" />
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => setCheckoutPlan(p)}>
                    {trialActive ? "Choose for after trial" : "Choose plan"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {checkoutPlan && (
        <SubscriptionCheckoutDialog
          plan={checkoutPlan}
          trialActive={trialActive}
          onClose={() => setCheckoutPlan(null)}
          onPaid={() => {
            setCheckoutPlan(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}