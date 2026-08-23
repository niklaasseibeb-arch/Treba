import React from "react";
import { Link } from "react-router-dom";
import {
  Send, Inbox, CalendarClock, History, Bell, ArrowRight,
  Shuffle, Handshake, Wallet, Car,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

const FLOW = [
  { icon: Send, label: "Request" },
  { icon: Shuffle, label: "Match" },
  { icon: Handshake, label: "Agree" },
  { icon: Wallet, label: "Pay" },
  { icon: Car, label: "Travel" },
];

const ENTRY_CARDS = [
  { to: "/app/passenger/requests", icon: Inbox, title: "My Requests", text: "Track your trip requests, driver responses and agreed fares." },
  { to: "/app/passenger/upcoming", icon: CalendarClock, title: "Upcoming Trips", text: "Your confirmed journeys and departure details." },
  { to: "/app/passenger/history", icon: History, title: "Trip History", text: "Review completed journeys and rate your drivers." },
];

export default function PassengerDashboard() {
  const { user } = useAuth();
  const firstName = (user?.full_name || user?.email || "there").split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">
          Request a journey between towns and Treba will match you with a scheduled driver.
        </p>
      </div>

      {/* Primary action — Request a Trip */}
      <div className="overflow-hidden rounded-2xl border border-primary bg-primary/10 p-6 sm:p-8 treba-shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Send className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold tracking-tight">Ready to travel? Request a trip.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell Treba where you're going, when and how many seats you need — we'll match you with a scheduled driver.
            </p>
          </div>
          <Button asChild size="lg" className="h-12 px-8 text-sm font-bold uppercase tracking-wide">
            <Link to="/app/passenger/request-trip">
              <Send className="mr-2 h-4 w-4" /> Request a Trip
            </Link>
          </Button>
        </div>
      </div>

      {/* Demand-driven flow strip */}
      <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">How your journey flows</h2>
        <ol className="mt-4 flex flex-wrap items-center gap-y-3">
          {FLOW.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.label} className="flex items-center">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                {i < FLOW.length - 1 && <ArrowRight className="mx-3 h-4 w-4 text-muted-foreground" />}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Entry points */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ENTRY_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-border bg-card p-6 treba-shadow transition-shadow hover:treba-shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Trip requests, driver responses and booking confirmations will appear in your notifications as the marketplace comes online.
        </p>
      </div>
    </div>
  );
}