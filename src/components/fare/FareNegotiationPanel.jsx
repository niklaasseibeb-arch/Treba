import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  ArrowRight,
  History,
  AlertTriangle,
  BadgeDollarSign,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const STATE_LABELS = {
  not_started: "Not started",
  negotiation_open: "Open for negotiation",
  offer_made: "Offer made",
  counter_offer: "Counter offer",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
  fare_agreed: "Fare agreed",
};

const STATE_TONES = {
  not_started: "bg-slate-100 text-slate-600",
  negotiation_open: "bg-amber-100 text-amber-700",
  offer_made: "bg-blue-100 text-blue-700",
  counter_offer: "bg-violet-100 text-violet-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  expired: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-600",
  fare_agreed: "bg-emerald-100 text-emerald-700",
};

const OFFER_STATUS_TONES = {
  open: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  countered: "bg-violet-100 text-violet-700",
  declined: "bg-rose-100 text-rose-700",
  superseded: "bg-slate-100 text-slate-500",
};

function nad(amount) {
  return `N$${Number(amount || 0).toFixed(0)}`;
}

function fmtDate(d) {
  if (!d) return "";

  try {
    const dt = new Date(d);

    return dt.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(d);
  }
}

export default function FareNegotiationPanel({
  tripRequest,
  role,
  onUpdated,
}) {
  const { toast } = useToast();

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [offerAmount, setOfferAmount] = useState({
    trip_fare: "",
    pickup_charge: "",
    dropoff_charge: "",
    luggage_charge: "",
  });

  const [counterAmount, setCounterAmount] = useState("");
  const [counterFor, setCounterFor] = useState(null);

  const load = async () => {
    try {
      const list = await base44.entities.FareOffer.filter(
        { trip_request_id: tripRequest.id },
        "created_date",
        100
      );

      setOffers(
        (list || [])
          .slice()
          .sort((a, b) =>
            String(a.created_date || "").localeCompare(
              String(b.created_date || "")
            )
          )
      );
    } catch (e) {
      console.error("Could not load fare offers:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripRequest.id]);

  const state = tripRequest.negotiation_state || "not_started";

  const openOffer =
    offers.find((o) => o.offer_status === "open") || null;

  const myTurn =
    !!openOffer && openOffer.offered_by !== role;

  const waiting =
    !!openOffer && openOffer.offered_by === role;

  const canOpenOffer =
    state === "negotiation_open" && !openOffer;

  const terminal = [
    "declined",
    "cancelled",
    "expired",
  ].includes(state);

  const offerTotal = useMemo(() => {
    return (
      Number(offerAmount.trip_fare || 0) +
      Number(offerAmount.pickup_charge || 0) +
      Number(offerAmount.dropoff_charge || 0) +
      Number(offerAmount.luggage_charge || 0)
    );
  }, [offerAmount]);

  const refresh = async () => {
    await load();

    if (onUpdated) {
      onUpdated();
    }
  };

  const submitOffer = async () => {
    const tripFare = Number(offerAmount.trip_fare || 0);
    const pickupCharge = Number(
      offerAmount.pickup_charge || 0
    );
    const dropoffCharge = Number(
      offerAmount.dropoff_charge || 0
    );
    const luggageCharge = Number(
      offerAmount.luggage_charge || 0
    );

    const total =
      tripFare +
      pickupCharge +
      dropoffCharge +
      luggageCharge;

    if (!Number.isFinite(total) || total <= 0) {
      toast({
        title: "Enter a valid fare",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);

    try {
      const res = await base44.functions.invoke(
        "submitFareOffer",
        {
          trip_request_id: tripRequest.id,

          trip_fare: tripFare,
          pickup_charge: pickupCharge,
          dropoff_charge: dropoffCharge,
          luggage_charge: luggageCharge,

          amount: total,
          currency: "NAD",
        }
      );

      if (res.data?.error) {
        toast({
          title: res.data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Fare offer sent",
      });

      setOfferAmount({
        trip_fare: "",
        pickup_charge: "",
        dropoff_charge: "",
        luggage_charge: "",
      });

      await refresh();
    } catch (err) {
      toast({
        title: "Could not submit offer",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const respond = async (
    offerId,
    response,
    counterAmt
  ) => {
    setBusy(true);

    try {
      const res = await base44.functions.invoke(
        "respondToFareOffer",
        {
          trip_request_id: tripRequest.id,
          offer_id: offerId,
          response,

          counter_amount:
            response === "counter"
              ? Number(counterAmt)
              : undefined,
        }
      );

      if (res.data?.error) {
        toast({
          title: res.data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title:
          response === "accept"
            ? "Fare accepted"
            : response === "counter"
              ? "Counter offer sent"
              : "Offer declined",
      });

      setCounterFor(null);
      setCounterAmount("");

      await refresh();
    } catch (err) {
      toast({
        title: "Could not respond",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Negotiation status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-5 w-5 text-primary" />

          <div>
            <div className="text-sm font-semibold">
              Fare negotiation
            </div>

            <div className="text-xs text-muted-foreground">
              Passenger and driver agree on the fare directly.
            </div>
          </div>
        </div>

        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            STATE_TONES[state] ||
            "bg-slate-100 text-slate-600"
          }`}
        >
          {STATE_LABELS[state] || state}
        </span>
      </div>

      {/* Terminal state */}
      {terminal && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            The fare negotiation ended without an agreed
            fare. No booking was created.
          </span>
        </div>
      )}

      {/* Make a new offer */}
      {canOpenOffer && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-4">
            <div className="font-semibold">
              Make fare offer
            </div>

            <div className="text-xs text-muted-foreground">
              Enter each charge separately. The passenger
              will see the complete fare before accepting.
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FareInput
              label="Trip fare"
              value={offerAmount.trip_fare}
              onChange={(value) =>
                setOfferAmount((current) => ({
                  ...current,
                  trip_fare: value,
                }))
              }
            />

            <FareInput
              label="Pickup charge"
              value={offerAmount.pickup_charge}
              onChange={(value) =>
                setOfferAmount((current) => ({
                  ...current,
                  pickup_charge: value,
                }))
              }
            />

            <FareInput
              label="Drop-off charge"
              value={offerAmount.dropoff_charge}
              onChange={(value) =>
                setOfferAmount((current) => ({
                  ...current,
                  dropoff_charge: value,
                }))
              }
            />

            <FareInput
              label="Luggage charge"
              value={offerAmount.luggage_charge}
              onChange={(value) =>
                setOfferAmount((current) => ({
                  ...current,
                  luggage_charge: value,
                }))
              }
            />
          </div>

          <div className="mt-4 rounded-lg border bg-background p-3">
            <div className="flex justify-between text-sm">
              <span>Trip fare</span>
              <span>{nad(offerAmount.trip_fare)}</span>
            </div>

            <div className="mt-1 flex justify-between text-sm">
              <span>Pickup</span>
              <span>{nad(offerAmount.pickup_charge)}</span>
            </div>

            <div className="mt-1 flex justify-between text-sm">
              <span>Drop-off</span>
              <span>{nad(offerAmount.dropoff_charge)}</span>
            </div>

            <div className="mt-1 flex justify-between text-sm">
              <span>Luggage</span>
              <span>{nad(offerAmount.luggage_charge)}</span>
            </div>

            <div className="mt-3 border-t pt-3">
              <div className="flex justify-between font-bold">
                <span>Total fare</span>
                <span>{nad(offerTotal)}</span>
              </div>
            </div>
          </div>

          <Button
            className="mt-4"
            disabled={busy || offerTotal <= 0}
            onClick={submitOffer}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}

            Send fare offer
          </Button>
        </div>
      )}

      {/* Waiting */}
      {waiting && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Your fare offer has been sent. Waiting for the
          {role === "driver"
            ? " passenger"
            : " driver"}{" "}
          to respond.
        </div>
      )}

      {/* Respond to offer */}
      {myTurn && openOffer && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-semibold text-amber-900">
            {openOffer.offered_by === "driver"
              ? "Driver's fare offer"
              : "Passenger's fare offer"}
          </div>

          <div className="mt-2 text-2xl font-bold text-amber-900">
            {nad(openOffer.amount)}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                respond(openOffer.id, "accept")
              }
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}

              Accept fare
            </Button>

            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                setCounterFor(openOffer.id)
              }
            >
              Counter offer
            </Button>

            <Button
              variant="outline"
              className="text-destructive"
              disabled={busy}
              onClick={() =>
                respond(openOffer.id, "decline")
              }
            >
              <XCircle className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </div>

          {counterFor === openOffer.id && (
            <div className="mt-4 rounded-lg border bg-background p-3">
              <Label>Counter offer</Label>

              <div className="mt-2 flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={counterAmount}
                  onChange={(e) =>
                    setCounterAmount(e.target.value)
                  }
                  placeholder="Enter total fare"
                />

                <Button
                  disabled={
                    busy ||
                    !counterAmount ||
                    Number(counterAmount) <= 0
                  }
                  onClick={() =>
                    respond(
                      openOffer.id,
                      "counter",
                      counterAmount
                    )
                  }
                >
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offer history */}
      {offers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            Negotiation history
          </div>

          <ol className="mt-2 space-y-2">
            {offers.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold">
                      {o.offered_by === role
                        ? "You"
                        : o.offered_by === "passenger"
                          ? "Passenger"
                          : "Driver"}
                    </span>

                    <span className="text-muted-foreground">
                      {" "}
                      offered{" "}
                    </span>

                    <span className="font-bold">
                      {nad(o.amount)}
                    </span>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      OFFER_STATUS_TONES[
                        o.offer_status
                      ] ||
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {o.offer_status}
                  </span>
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  {fmtDate(o.created_date)}
                </div>

                {o.response && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />

                    <span>
                      {o.response === "accept"
                        ? "Accepted"
                        : o.response === "counter"
                          ? "Countered"
                          : "Declined"}{" "}
                      by{" "}
                      {o.response_by === role
                        ? "you"
                        : o.response_by === "passenger"
                          ? "passenger"
                          : "driver"}

                      {o.response_at
                        ? ` · ${fmtDate(
                            o.response_at
                          )}`
                        : ""}
                    </span>
                  </div>
                )}

                {o.note && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    "{o.note}"
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function FareInput({
  label,
  value,
  onChange,
}) {
  return (
    <div>
      <Label>{label}</Label>

      <div className="mt-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          N$
        </span>

        <Input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          placeholder="0"
        />
      </div>
    </div>
  );
}