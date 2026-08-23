import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const formatPrice = (price) => `N$${Number(price || 0).toLocaleString()}`;

export default function SubscriptionCheckoutDialog({ plan, trialActive, onClose, onPaid }) {
  const { toast } = useToast();
  const [methods, setMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [selected, setSelected] = useState(null);
  const [initiating, setInitiating] = useState(false);
  const [payment, setPayment] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoadingMethods(true);
      try {
        const res = await base44.functions.invoke("getAvailablePaymentMethods", {});
        const digital = (res.data?.methods || []).filter((m) => m.category !== "cash_to_driver");
        setMethods(digital);
        if (digital[0]) setSelected(digital[0].provider_code);
      } catch (e) {
        setError("Could not load payment methods.");
      } finally {
        setLoadingMethods(false);
      }
    })();
  }, []);

  const pay = async () => {
    if (!selected) return;
    setInitiating(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("initiateSubscriptionPayment", {
        plan_id: plan.id,
        provider_code: selected,
      });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      setPayment(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setInitiating(false);
    }
  };

  const confirm = async () => {
    if (!payment?.payment?.id) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("confirmSubscriptionPayment", {
        payment_id: payment.payment.id,
        outcome: "success",
      });
      if (res.data?.status === "successful") {
        toast({ title: "Subscription activated", description: `Your ${plan.name} plan is now active.` });
        onPaid();
      } else if (res.data?.status === "failed") {
        setError(res.data?.reason || "Payment failed.");
      } else {
        toast({ title: "Payment still pending", description: "Your payment is being processed." });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to {plan.name}</DialogTitle>
          <DialogDescription>
            {trialActive
              ? "Your free trial will end and the paid plan starts now."
              : "Pay your monthly subscription to activate platform access."}{" "}
            Treba never charges commission on passenger fares.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
            <span className="text-sm text-muted-foreground">Amount due</span>
            <span className="text-xl font-extrabold">{formatPrice(plan.price)}</span>
          </div>

          {!payment && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">Select a payment method</p>
                {loadingMethods ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : methods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No digital payment methods are configured yet. Please contact Treba.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {methods.map((m) => (
                      <button
                        key={m.provider_code}
                        onClick={() => setSelected(m.provider_code)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                          selected === m.provider_code
                            ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <CreditCard className="h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{m.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {m.category.replace(/_/g, " ")}
                          </div>
                        </div>
                        {selected === m.provider_code && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {error && (
                <p className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </p>
              )}
            </>
          )}

          {payment && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Payment reference</p>
                <p className="mt-1 break-all font-mono text-sm">{payment.reference}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Complete the payment with your provider, then confirm below. In production the provider's webhook
                  confirms automatically.
                </p>
              </div>
              {error && (
                <p className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!payment ? (
            <Button onClick={pay} disabled={initiating || !selected} className="w-full gap-1.5">
              {initiating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pay {formatPrice(plan.price)}
            </Button>
          ) : (
            <div className="flex w-full gap-2">
              <Button variant="outline" onClick={() => setPayment(null)} className="flex-1">
                Back
              </Button>
              <Button onClick={confirm} disabled={confirming} className="flex-1 gap-1.5">
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm payment
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}