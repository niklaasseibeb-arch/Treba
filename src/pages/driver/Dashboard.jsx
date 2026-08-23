import React from "react";
import { Link } from "react-router-dom";
import {
  Inbox,
  Route,
  Clock,
  CarFront,
  Users,
  Wallet,
  History,
  Bell,
  ArrowRight,
  Shuffle,
  Handshake,
  Car,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import DriverSubscriptionWarning from "@/components/driver/DriverSubscriptionWarning";

const FLOW = [
  { icon: Clock, label: "Available" },
  { icon: Shuffle, label: "Allocated" },
  { icon: Handshake, label: "Respond" },
  { icon: Car, label: "Drive" },
  { icon: Wallet, label: "Payout" },
];

const ENTRY_CARDS = [
  { to: "/app/driver/requests", icon: Inbox, title: "Trip Requests", text: "Review passenger requests Treba has allocated to your routes.", accent: true },
  { to: "/app/driver/routes", icon: Route, title: "Allocated Routes", text: "See the scheduled routes matched to you and their status." },
  { to: "/app/driver/availability", icon: Clock, title: "Availability", text: "Set when and where you're available to drive." },
  { to: "/app/driver/vehicle", icon: CarFront, title: "Vehicle", text: "Manage your vehicle details and verification." },
  { to: "/app/driver/passengers", icon: Users, title: "Passengers", text: "View confirmed passengers across your allocated routes." },
  { to: "/app/driver/earnings", icon: Wallet, title: "Earnings", text: "Track your trip earnings and payouts." },
  { to: "/app/driver/history", icon: History, title: "Trip History", text: "Review your completed trips as a driver." },
];

export default function DriverDashboard() {
  const { user } = useAuth();
  const firstName = (user?.full_name || user?.email || "there").split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">
          Set your availability and let Treba allocate passenger requests to your scheduled routes.
        </p>
      </div>

      {/* Verification shell banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Driver verification</div>
          <div className="text-sm text-muted-foreground">
            Complete your profile and vehicle details. Verification is reviewed by Treba before you can receive allocations.
          </div>
        </div>
        <StatusBadge status="pending" />
      </div>

      {/* Driver subscription access status + expiry warning */}
      <DriverSubscriptionWarning />

      {/* Demand-driven flow strip */}
      <div className="rounded-2xl border border-border bg-card p-6 treba-shadow">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">How your allocations flow</h2>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ENTRY_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-border bg-card p-6 treba-shadow transition-shadow hover:treba-shadow-lg"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.accent ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}>
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
          Allocated requests, fare negotiations and payout updates will appear in your notifications as the marketplace comes online.
        </p>
      </div>
    </div>
  );
}