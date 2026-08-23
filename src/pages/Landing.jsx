import React from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Car,
  MapPin,
  Route,
  ShieldCheck,
  Lock,
  Clock,
  Luggage,
  Smartphone,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Shuffle,
  Handshake,
} from "lucide-react";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";
import { Button } from "@/components/ui/button";

const HERO_IMAGE =
  "https://media.base44.com/images/public/6a8855e636650436a256043e/d6210c9b7_generated_image.png";

const FLOW_STEPS = [
  { icon: Send, title: "Request a Trip", text: "Tell Treba where you're going, when and how many seats you need." },
  { icon: Shuffle, title: "Route Matching", text: "Treba identifies your route and allocates a scheduled driver." },
  { icon: Handshake, title: "Driver Responds", text: "Your driver confirms availability and proposes a fare." },
  { icon: Wallet, title: "Pay & Book", text: "Confirm the fare, pay securely and your seat is booked." },
  { icon: Car, title: "Travel", text: "Meet your driver and travel comfortably to your destination." },
];

const VALUE_ITEMS = [
  { icon: Route, title: "Demand-driven travel", text: "You request the journey — Treba matches you to a scheduled driver, not the other way around." },
  { icon: ShieldCheck, title: "Verified drivers", text: "Every driver is checked before they can be allocated to passenger requests." },
  { icon: Handshake, title: "Agreed fares", text: "Review your driver's fare before you pay — no surprises, no hidden costs." },
  { icon: Lock, title: "Secure payments", text: "Pay through Treba and your booking is confirmed safely." },
];

const HERO_ELEMENTS = [
  { icon: Route, label: "Town-to-town routes" },
  { icon: Car, label: "Treba vehicles" },
  { icon: Luggage, label: "Luggage friendly" },
  { icon: Smartphone, label: "Request from your phone" },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Passenger requesting a town-to-town trip on the Treba app while a Treba vehicle arrives"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-foreground/20" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Town-to-town travel in Namibia
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Travel Between Towns, Made Simple.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/90">
              Request your journey, connect with a scheduled driver, agree your fare and travel with Treba.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-8 text-sm font-bold uppercase tracking-wide">
                <Link to="/register">
                  <Send className="mr-2 h-4 w-4" />
                  Request a Trip
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/60 bg-white/10 px-8 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/20 hover:text-white">
                <Link to="/register">
                  <Car className="mr-2 h-4 w-4" />
                  Become a Driver
                </Link>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_ELEMENTS.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.label} className="flex items-center gap-1.5 text-sm font-medium text-white/90">
                    <Icon className="h-4 w-4 text-primary" />
                    {f.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* How Treba works — demand-driven flow */}
      <section className="bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              How Treba Works
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">You request. Treba connects you.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Treba is demand-driven. Passengers request a journey and Treba matches them with a scheduled driver — no browsing published trips.
            </p>
          </div>

          <ol className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {FLOW_STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="relative rounded-2xl border border-border bg-card p-6 treba-shadow">
                  <span className="absolute right-4 top-4 text-sm font-bold text-primary">0{i + 1}</span>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Role entry points */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-8 treba-shadow">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Luggage className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-2xl font-bold tracking-tight">For Passengers</h3>
            <p className="mt-2 text-muted-foreground">
              Request a journey between towns and get matched with a scheduled driver. Agree your fare, pay and travel.
            </p>
            <Button asChild className="mt-6 h-11 px-6 font-semibold uppercase tracking-wide">
              <Link to="/register">
                Request a Trip
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 treba-shadow">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Car className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-2xl font-bold tracking-tight">For Drivers</h3>
            <p className="mt-2 text-muted-foreground">
              Set your availability and let Treba allocate passenger requests to your scheduled routes. Confirm, drive and earn.
            </p>
            <Button asChild className="mt-6 h-11 px-6 font-semibold uppercase tracking-wide">
              <Link to="/register">
                Become a Driver
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Value / trust */}
      <section className="bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Why travel with Treba</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              A simpler, safer way to move between Namibian towns.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_ITEMS.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{v.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{v.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature banner */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { icon: Route, label: "Comfortable Journeys" },
              { icon: ShieldCheck, label: "Safe & Reliable" },
              { icon: Wallet, label: "Agreed Fares" },
              { icon: Clock, label: "Book in Minutes" },
              { icon: MapPin, label: "Travel Across Namibia" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="mt-3 text-sm font-semibold">{f.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}