import React from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Shuffle,
  Handshake,
  Wallet,
  Car,
  CheckCircle2,
  Clock,
  Route,
  ArrowRight,
} from "lucide-react";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import { Button } from "@/components/ui/button";

const PASSENGER_STEPS = [
  { icon: Send, title: "Request a Trip", text: "Tell Treba your origin, destination, travel date and number of seats." },
  { icon: Shuffle, title: "Get Matched", text: "Treba identifies your route and allocates a scheduled driver to your request." },
  { icon: Handshake, title: "Agree Your Fare", text: "Your driver confirms availability and proposes a fare. Review it before you commit." },
  { icon: Wallet, title: "Pay & Book", text: "Confirm the fare and pay securely through Treba. Your seat is booked." },
  { icon: Car, title: "Travel", text: "Meet your driver at the departure point and travel to your destination." },
];

const DRIVER_STEPS = [
  { icon: Clock, title: "Set Your Availability", text: "Tell Treba when and where you're available to drive scheduled routes." },
  { icon: Shuffle, title: "Receive Allocations", text: "Treba matches passenger requests to your scheduled routes and allocates them to you." },
  { icon: Handshake, title: "Confirm & Respond", text: "Review the request, confirm availability and propose your fare to the passenger." },
  { icon: Car, title: "Drive", text: "Pick up your passenger, complete the journey and mark the trip as done." },
  { icon: Wallet, title: "Get Paid", text: "Treba pays out your earnings for completed trips." },
];

export default function HowItWorks() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            How Treba Works
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            You request. Treba connects you.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Treba is demand-driven. Passengers request a journey and Treba matches them with a
            scheduled driver — passengers don't browse published trips.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-8 treba-shadow">
            <h2 className="text-2xl font-bold">For Passengers</h2>
            <ol className="mt-6 space-y-6">
              {PASSENGER_STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">STEP {i + 1}</span>
                        <h3 className="text-lg font-semibold">{s.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button asChild className="mt-8 h-11 px-6 font-semibold uppercase tracking-wide">
              <Link to="/register">
                Request a Trip
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 treba-shadow">
            <h2 className="text-2xl font-bold">For Drivers</h2>
            <ol className="mt-6 space-y-6">
              {DRIVER_STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">STEP {i + 1}</span>
                        <h3 className="text-lg font-semibold">{s.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button asChild className="mt-8 h-11 px-6 font-semibold uppercase tracking-wide">
              <Link to="/register">
                Become a Driver
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Demand-driven principle banner */}
        <div className="mt-12 rounded-2xl border border-primary/30 bg-primary/5 p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Route className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Demand-driven, not driver-published</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                On Treba, passengers initiate travel requests. Treba matches the route, allocates a
                scheduled driver, and the driver confirms availability and responds with a fare.
                Drivers don't publish individual trips for passengers to browse.
              </p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}