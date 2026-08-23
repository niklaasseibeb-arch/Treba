import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, CreditCard, RefreshCw, Repeat } from "lucide-react";
import SubscriptionCheckoutDialog from "@/components/driver/SubscriptionCheckoutDialog";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-NA", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS_LABEL = {
  trial_active: "Trial active",
  trial_expiring: "Trial ending soon",
  trial_expired: "Trial ended",
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  suspended: "Suspended",
  cancelled: "Cancelled",
  none: "No subscription",
};

const WARNING_MESSAGE = {
  trial_expiring:
    "Your free trial ends soon — choose a plan to keep receiving new passenger requests and route allocations after your trial.",
  trial_expired:
    "Your free trial has ended. Choose a subscription plan to continue receiving new passenger requests and route allocations. Your profile, history and existing bookings are unaffected.",
  expiring:
    "Your subscription expires soon. Renew to keep receiving new passenger requests and route allocations.",
  expired:
    "Your subscription has expired. Renew or choose a new plan to receive new passenger requests and route allocations. Your profile, history and existing bookings are unaffected.",
  suspended:
    "Your subscription is suspended. Contact Treba to restore marketplace access. Your profile, history and existing bookings are unaffected.",
  cancelled:
    "Your subscription was cancelled. Renew or choose a new plan to receive new passenger requests and route allocations.",
  none: "You don't have an active subscription yet. Choose a plan to start receiving passenger allocations.",
};

function toneFor(status) {
  if (["trial_expired", "expired", "suspended", "cancelled", "none"].includes(status))
    return { card: "border-red-300 bg-red-50", badge: "bg-red-100 text-red-700", iconWrap: "bg-red-100 text-red-600" };
  if (["trial_expiring", "expiring"].includes(status))
    return { card: "border-amber-300 bg-amber-50", badge: "bg-amber-100 text-amber-700", iconWrap: "bg-amber-100 text-amber-600" };
  return { card: "border-emerald-200 bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-700", iconWrap: "bg-emerald-100 text-emerald-600" };
}

export default function DriverSubscriptionWarning() {
  const navigate = useNavigate();
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
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = data?.current_subscription;
  const plans = data?.plans || [];
  const status = current?.display_status || current?.status || "none";
  const isTrial = !!current?.is_trial;
  const used = current?.trips_used || 0;
  const allowance = current?.trip_allowance || 0;
  const remaining = current?.is_unlimited ? null : Math.max(0, allowance - used);
  const expiry = current?.end_date || current?.renewal_date;
  const tone = toneFor(status);
  const isWarning = Object.prototype.hasOwnProperty.call(WARNING_MESSAGE, status);

  const renewPlan = plans.find((p) => p.plan_code === current?.plan_code) || plans[0] || null;

  const renew = () => {
    if (isTrial || !current || !renewPlan) {
      navigate("/app/driver/subscription");
      return;
    }
    setCheckoutPlan(renewPlan);
  };
  const changePlan = () => navigate("/app/driver/subscription");

  const planLabel = current ? (isTrial ? "Free Trial" : current.plan_name) : "—";
  const tripsUsedLabel = current?.is_unlimited ? `${used}` : current ? `${used} / ${allowance}` : "—";
  const tripsRemainingLabel = current?.is_unlimited ? "Unlimited" : current ? `${remaining}` : "—";

  return (
    <>
      <Card className={`border ${tone.card} treba-shadow`}>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.iconWrap}`}>
                {isWarning ? <AlertTriangle className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Driver subscription
                </div>
                <div className="text-base font-bold">
                  {current ? (isTrial ? `${data?.trial_duration_days || 60}-day free trial` : current.plan_name) : "No active subscription"}
                </div>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${tone.badge}`}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>

          {isWarning && (
            <p className="mt-3 text-sm font-medium text-foreground/80">{WARNING_MESSAGE[status]}</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Current Plan" value={planLabel} />
            <Field label="Expiry Date" value={formatDate(expiry)} />
            <Field label="Trips Used" value={tripsUsedLabel} />
            <Field label="Trips Remaining" value={tripsRemainingLabel} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={renew}>
              <RefreshCw className="h-4 w-4" />
              {isTrial || !current ? "Choose a plan" : "Renew Subscription"}
            </Button>
            <Button variant="outline" onClick={changePlan}>
              <Repeat className="h-4 w-4" />
              Change Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {checkoutPlan && (
        <SubscriptionCheckoutDialog
          plan={checkoutPlan}
          trialActive={isTrial && status !== "trial_expired"}
          onClose={() => setCheckoutPlan(null)}
          onPaid={() => {
            setCheckoutPlan(null);
            load();
          }}
        />
      )}
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}