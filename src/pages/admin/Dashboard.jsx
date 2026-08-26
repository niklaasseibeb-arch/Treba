import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import DashboardSection from "@/components/admin/DashboardSection";

import {
  Inbox,
  Shuffle,
  Ticket,
  MessagesSquare,
  Route as RouteIcon,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Car,
  ClipboardList,
  CreditCard,
} from "lucide-react";

const QUICK_LINKS = [
  {
    to: "/app/admin/passengers",
    label: "Passengers",
    icon: UserRound,
  },
  {
    to: "/app/admin/drivers",
    label: "Drivers",
    icon: Car,
  },
  {
    to: "/app/admin/verifications",
    label: "Driver Verification",
    icon: ShieldCheck,
  },
  {
    to: "/app/admin/routes",
    label: "Routes",
    icon: RouteIcon,
  },
  {
    to: "/app/admin/requests",
    label: "Trip Requests",
    icon: Inbox,
  },
  {
    to: "/app/admin/allocations",
    label: "Allocations",
    icon: Shuffle,
  },
  {
    to: "/app/admin/swap-requests",
    label: "Swap Requests",
    icon: Shuffle,
  },
  {
    to: "/app/admin/trip-operations",
    label: "Trip Operations",
    icon: ClipboardList,
  },
  {
    to: "/app/admin/driver-subscriptions",
    label: "Driver Subscriptions",
    icon: CreditCard,
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await base44.functions.invoke(
        "getAdminDashboardStats",
        {}
      );

      if (response?.error) {
        throw new Error(response.error);
      }

      setStats(response?.data ?? response ?? {});
    } catch (err) {
      setError(
        err?.message || "Failed to load administrator dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const s = stats || {};

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Operations Dashboard
          </h1>

          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            Live operational view of Treba's demand-driven town-to-town
            marketplace. Passengers request trips, drivers respond,
            fares are negotiated directly between passengers and drivers,
            and Treba manages matching, allocation and trip operations.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* OPERATIONS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* PASSENGER DEMAND */}
        <DashboardSection
          icon={Inbox}
          title="Passenger Demand"
          subtitle="Trip requests across the matching lifecycle"
          accent="primary"
          loading={loading}
          stats={[
            {
              key: "new",
              label: "New requests",
              value: s.demand?.new_requests ?? 0,
            },
            {
              key: "active",
              label: "Active requests",
              value: s.demand?.active_requests ?? 0,
            },
            {
              key: "matched",
              label: "Matched",
              value: s.demand?.matched_requests ?? 0,
            },
            {
              key: "unmatched",
              label: "Unmatched",
              value: s.demand?.unmatched_requests ?? 0,
            },
            {
              key: "completed",
              label: "Completed",
              value: s.demand?.completed_requests ?? 0,
            },
            {
              key: "cancelled",
              label: "Cancelled",
              value: s.demand?.cancelled_requests ?? 0,
            },
            {
              key: "no_shows",
              label: "No-shows",
              value: s.demand?.no_shows ?? 0,
            },
          ]}
        />

        {/* DRIVER ALLOCATION */}
        <DashboardSection
          icon={Shuffle}
          title="Driver Allocation"
          subtitle="Driver availability, scheduling and route coverage"
          accent="blue"
          loading={loading}
          stats={[
            {
              key: "daily",
              label: "Daily allocations",
              value: s.allocation?.daily_allocations ?? 0,
            },
            {
              key: "confirmed",
              label: "Confirmed availability",
              value: s.allocation?.confirmed_availability ?? 0,
            },
            {
              key: "declined",
              label: "Declined",
              value: s.allocation?.declined_allocations ?? 0,
            },
            {
              key: "unallocated",
              label: "Unallocated routes",
              value: s.allocation?.unallocated_routes ?? 0,
            },
            {
              key: "replacement",
              label: "Replacement drivers",
              value: s.allocation?.replacement_drivers ?? 0,
            },
          ]}
        />

        {/* BOOKINGS */}
        <DashboardSection
          icon={Ticket}
          title="Bookings"
          subtitle="Booking lifecycle and passenger confirmations"
          accent="green"
          loading={loading}
          stats={[
            {
              key: "pending",
              label: "Pending",
              value: s.booking?.pending ?? 0,
            },
            {
              key: "confirmed",
              label: "Confirmed",
              value: s.booking?.confirmed ?? 0,
            },
            {
              key: "completed",
              label: "Completed",
              value: s.booking?.completed ?? 0,
            },
            {
              key: "cancelled",
              label: "Cancelled",
              value: s.booking?.cancelled ?? 0,
            },
            {
              key: "no_show",
              label: "No-show",
              value: s.booking?.no_show ?? 0,
            },
          ]}
        />

        {/* FARE NEGOTIATION */}
        <DashboardSection
          icon={MessagesSquare}
          title="Fare Negotiation"
          subtitle="Passenger-driver fare negotiation"
          accent="violet"
          loading={loading}
          stats={[
            {
              key: "open",
              label: "Open negotiations",
              value: s.fare?.open_negotiations ?? 0,
            },
            {
              key: "agreed",
              label: "Agreed fares",
              value: s.fare?.agreed_fares ?? 0,
            },
            {
              key: "declined",
              label: "Declined",
              value: s.fare?.declined_negotiations ?? 0,
            },
            {
              key: "expired",
              label: "Expired",
              value: s.fare?.expired_negotiations ?? 0,
            },
          ]}
        />

        {/* ROUTES */}
        <DashboardSection
          icon={RouteIcon}
          title="Routes"
          subtitle="Town-to-town corridor coverage"
          accent="green"
          loading={loading}
          stats={[
            {
              key: "active",
              label: "Active routes",
              value: s.route?.active_routes ?? 0,
            },
            {
              key: "pickups",
              label: "Pickup points",
              value: s.route?.standard_pickup_points ?? 0,
            },
            {
              key: "dropoffs",
              label: "Drop-off points",
              value: s.route?.standard_drop_off_points ?? 0,
            },
            {
              key: "services",
              label: "Scheduled services",
              value: s.route?.scheduled_services ?? 0,
            },
          ]}
        />

        {/* DRIVER SUBSCRIPTIONS */}
        <DashboardSection
          icon={CreditCard}
          title="Driver Subscriptions"
          subtitle="Treba subscription revenue and driver subscription status"
          accent="amber"
          loading={loading}
          stats={[
            {
              key: "active",
              label: "Active subscriptions",
              value: s.subscription?.active ?? 0,
            },
            {
              key: "trial",
              label: "Free trials",
              value: s.subscription?.trial ?? 0,
            },
            {
              key: "expired",
              label: "Expired",
              value: s.subscription?.expired ?? 0,
            },
            {
              key: "pending",
              label: "Pending payments",
              value: s.subscription?.pending_payments ?? 0,
            },
            {
              key: "paid",
              label: "Paid",
              value: s.subscription?.paid ?? 0,
            },
            {
              key: "revenue",
              label: "Revenue",
              value: Number(
                s.subscription?.revenue ?? 0
              ).toLocaleString(),
            },
          ]}
        />

      </div>

      {/* QUICK ACCESS */}
      <section className="rounded-2xl border border-border bg-card p-5 treba-shadow">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />

          <div>
            <h2 className="text-base font-semibold">
              Operational Modules
            </h2>

            <p className="text-xs text-muted-foreground">
              Quick access to core Treba administration functions.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>

    </div>
  );
}