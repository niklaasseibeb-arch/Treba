import React, { useEffect, useState } from "react";
import {
  Loader2, Send, CheckCircle2, XCircle, ArrowRight, BadgeDollarSign,
  History, Lock, AlertTriangle, Info, Clock,
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
    return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch (e) {
    return String(d);
  }
}

export default function FareNegotiationPanel({ tripRequest, role, onUpdated }) {
  const { toast } = useToast();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [counterAmount, setCounterAmount] = useState("");
  const [counterFor, setCounterFor] = useState(null);

  const load = async () => {
    try {
      const list = await base44.entities.FareOffer.filter(
        { trip_request_id: tripRequest.id },
        "created_date",
        100
      );
      setOffers((list || []).slice().sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || ""))));
    } catch (e) {
      // ignore read errors
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
  const openOffer = offers.find((o) => o.offer_status === "open") || null;
  const myTurn = !!openOffer && openOffer.offered_by !== role;
  const waiting = !!openOffer && openOffer.offered_by === role;
  const canOpenOffer = state === "negotiation_open" && !openOffer;
  const fareAgreed = state === "fare_agreed";
  const terminal = ["declined", "cancelled", "expired"].includes(state);

  const refresh = async () => {
    await load();
    if (onUpdated) onUpdated();
  };

  const submitOffer = async () => {
    const amt = Number(offerAmount);
    if (!isFinite(amt) || amt <= 0) {
      toast({ title: "Enter a valid fare amount", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke("submitFareOffer", {
        trip_request_id: tripRequest.id,
        amount: amt,
        currency: "NAD",
      });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Fare offer sent" });
      setOfferAmount("");
      await refresh();
    } catch (err) {
      toast({ title: "Could not submit offer", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const respond = async (offerId, response, counterAmt) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("respondToFareOffer", {
        trip_request_id: tripRequest.id,
        offer_id: offerId,
        response,
        counter_amount: response === "counter" ? Number(counterAmt) : undefined,
      });
      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        return;
      }
      toast({ title: response === "accept" ? "Fare accepted" : response === "counter" ? "Counter offer sent" : "Offer declined" });
      setCounterFor(null);
      setCounterAmount("");
      await refresh();
    } catch (err) {
      toast({ title: "Could not respond", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 treba-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wide">Fare negotiation</h3>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE_TONES[state] || "bg-slate-100 text-slate-600"}`}>
          {STATE_LABELS[state] || state}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Treba never estimates, suggests or ranges a fare. The fare is decided only by you and the other party — make an offer, accept, counter, or decline, until you both accept the same amount.</span>
      </div>

      {fareAgreed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-xs uppercase tracking-wide text-emerald-700">Agreed fare (locked)</div>
              <div className="text-2xl font-bold text-emerald-900">{nad(tripRequest.agreed_fare)}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> Payment pending
          </span>
        </div>
      )}

      {terminal && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>The fare negotiation ended without an agreed fare. No booking or payment was created.</span>
        </div>
      )}

      {/* Offer history */}
      {offers.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Negotiation history
          </div>
          <ol className="mt-2 space-y-2">
            {offers.map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold">{o.offered_by === role ? "You" : o.offered_by === "passenger" ? "Passenger" : "Driver"}</span>
                    <span className="text-muted-foreground"> offered </span>
                    <span className="font-bold">{nad(o.amount)}</span>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${OFFER_STATUS_TONES[o.offer_status] || "bg-slate-100 text-slate-600"}`}>
                    {o.offer_status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{fmtDate(o.created_date)}</div>
                {o.response && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight className="h-3 w-3" />
                    <span>
                      {o.response === "accept" ? "Accepted" : o.response === "counter" ? "Countered" : "Declined"} by{" "}
                      {o.response_by === role ? "you" : o.response_by === "passenger" ? "passenger" : "driver"}
                      {o.response_at ? ` · ${fmtDate(o.response_at)}` : ""}
                    </span>
                  </div>
                )}
                {o.note && <div className="mt-1 text-xs text-muted-foreground">“{o.note}”</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Action area */}
      {!fareAgreed && !terminal && (
        <div className="mt-5">
          {loading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : canOpenOffer ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <Label htmlFor="first-offer" className="text-xs text-muted-foreground">Make the first offer (NAD)</Label>
              <div className="flex gap-2">
                <Input id="first-offer" type="number" min="0" inputMode="decimal" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} placeholder="e.g. 250" className="h-10" />
                <Button className="h-10" disabled={busy} onClick={submitOffer}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send offer
                </Button>
              </div>
            </div>
          ) : myTurn && openOffer ? (
            counterFor === openOffer.id ? (
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                <Label htmlFor="counter-amt" className="text-xs text-muted-foreground">Your counter offer (NAD)</Label>
                <div className="flex gap-2">
                  <Input id="counter-amt" type="number" min="0" inputMode="decimal" value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)} placeholder="e.g. 200" className="h-10" />
                  <Button className="h-10" disabled={busy} onClick={() => respond(openOffer.id, "counter", counterAmount)}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send counter
                  </Button>
                </div>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setCounterFor(null); setCounterAmount(""); }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto text-sm">
                  <span className="text-muted-foreground">Offer on the table: </span>
                  <span className="font-bold">{nad(openOffer.amount)}</span>
                </div>
                <Button className="h-9" disabled={busy} onClick={() => respond(openOffer.id, "accept")}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Accept
                </Button>
                <Button variant="outline" className="h-9" disabled={busy} onClick={() => { setCounterFor(openOffer.id); setCounterAmount(""); }}>
                  <BadgeDollarSign className="mr-2 h-4 w-4" /> Counter
                </Button>
                <Button variant="outline" className="h-9 text-destructive hover:bg-destructive/5" disabled={busy} onClick={() => respond(openOffer.id, "decline")}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  Decline
                </Button>
              </div>
            )
          ) : waiting ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Waiting for the {role === "passenger" ? "driver" : "passenger"} to respond to your offer…
            </div>
          ) : state === "not_started" ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              Fare negotiation hasn't started yet.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}