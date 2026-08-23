import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import DashboardSection from "@/components/admin/DashboardSection";
import {
  Inbox, Shuffle, Ticket, MessagesSquare, Wallet, Banknote, Route as RouteIcon,
  RefreshCw, ArrowRight, ShieldCheck,
} from "lucide-react";

const QUICK_LINKS = [
  { to: "/app/admin/allocations", label: "Allocations" },
  { to: "/app/admin/trip-operations", label: "Trip Operations" },
  { to: "/app/admin/no-show-cases", label: "No-Show Cases" },
  { to: "/app/admin/driver-no-show-cases", label: "Driver No-Show Cases" },
  { to: "/app/admin/payment-providers", label: "Payment Providers" },
  { to: "/app/admin/cash-controls", label: "Cash Controls" },
  { to: "/app/admin/payouts", label: "Driver Payouts" },
  { to: "/app/admin/routes", label: "Routes" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getAdminDashboardStats", {});
      if (res && res.error) throw new Error(res.error);
      setStats(res);
    } catch (e) {
      setError(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const s = stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live visibility over the demand-driven marketplace. Fares remain a passenger–driver negotiation — Treba never creates or estimates them.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DashboardSection
          icon={Inbox}
          title="Passenger Demand"
          subtitle="Trip requests across the matching lifecycle"
          accent="primary"
          loading={loading}
          stats={[
            { key: "new", label: "New requests", value: s.demand?.new_requests ?? 0 },
            { key: "active", label: "Active requests", value: s.demand?.active_requests ?? 0 },
            { key: "matched", label: "Matched", value: s.demand?.matched_requests ?? 0 },
            { key: "unmatched", label: "Unmatched", value: s.demand?.unmatched_requests ?? 0 },
            { key: "completed", label: "Completed", value: s.demand?.completed_requests ?? 0 },
            { key: "cancelled", label: "Cancelled", value: s.demand?.cancelled_requests ?? 0 },
            { key: "no_shows", label: "No-shows", value: s.demand?.no_shows ?? 0 },
          ]}
        />

        <DashboardSection
          icon={Shuffle}
          title="Driver Allocation"
          subtitle="Scheduled driver availability and route coverage"
          accent="blue"
          loading={loading}
          stats={[
            { key: "daily", label: "Daily allocations", value: s.allocation?.daily_allocations ?? 0 },
            { key: "confirmed", label: "Confirmed availability", value: s.allocation?.confirmed_availability ?? 0 },
            { key: "declined", label: "Declined allocations", value: s.allocation?.declined_allocations ?? 0 },
            { key: "unallocated", label: "Unallocated routes", value: s.allocation?.unallocated_routes ?? 0 },
            { key: "replacement", label: "Replacement drivers", value: s.allocation?.replacement_drivers ?? 0 },
          ]}
        />

        <DashboardSection
          icon={Ticket}
          title="Bookings"
          subtitle="Booking and payment states across the platform"
          accent="green"
          loading={loading}
          stats={[
            { key: "pending", label: "Pending", value: s.booking?.pending ?? 0 },
            { key: "confirmed", label: "Confirmed", value: s.booking?.confirmed ?? 0 },
            { key: "paid", label: "Paid", value: s.booking?.paid ?? 0 },
            { key: "cash_pending", label: "Cash pending", value: s.booking?.cash_pending ?? 0 },
            { key: "cash_overdue", label: "Cash overdue", value: s.booking?.cash_overdue ?? 0 },
            { key: "completed", label: "Completed", value: s.booking?.completed ?? 0 },
            { key: "cancelled", label: "Cancelled", value: s.booking?.cancelled ?? 0 },
            { key: "no_show", label: "No-show", value: s.booking?.no_show ?? 0 },
          ]}
        />

        <DashboardSection
          icon={MessagesSquare}
          title="Fare Negotiation"
          subtitle="Passenger–driver fare negotiation outcomes"
          accent="violet"
          loading={loading}
          stats={[
            { key: "open", label: "Open negotiations", value: s.fare?.open_negotiations ?? 0 },
            { key: "agreed", label: "Agreed fares", value: s.fare?.agreed_fares ?? 0 },
            { key: "declined", label: "Declined", value: s.fare?.declined_negotiations ?? 0 },
            { key: "expired", label: "Expired", value: s.fare?.expired_negotiations ?? 0 },
          ]}
        />

        <DashboardSection
          icon={Wallet}
          title="Payments"
          subtitle="Passenger payments by method"
          accent="amber"
          loading={loading}
          stats={[
            { key: "card", label: "Card", value: s.payment?.bank_card ?? 0 },
            { key: "wallet", label: "Mobile wallet", value: s.payment?.mobile_wallet ?? 0 },
            { key: "pay2cell", label: "Pay2Cell", value: s.payment?.pay2cell ?? 0 },
            { key: "other", label: "Other digital", value: s.payment?.other_digital ?? 0 },
            { key: "cash", label: "Cash", value: s.payment?.cash_to_driver ?? 0 },
          ]}
        />

        <DashboardSection
          icon={Banknote}
          title="Driver Wallet"
          subtitle="Aggregate driver earnings and payouts (NAD)"
          accent="slate"
          loading={loading}
          stats={[
            { key: "earnings", label: "Earnings", value: (s.wallet?.earnings ?? 0).toLocaleString() },
            { key: "pending_payouts", label: "Pending payouts", value: (s.wallet?.pending_payouts ?? 0).toLocaleString() },
            { key: "completed_payouts", label: "Completed payouts", value: (s.wallet?.completed_payouts ?? 0).toLocaleString() },
            { key: "failed_payouts", label: "Failed payouts", value: (s.wallet?.failed_payouts ?? 0).toLocaleString() },
          ]}
        />

        <DashboardSection
          icon={RouteIcon}
          title="Routes"
          subtitle="Network coverage and scheduled services"
          accent="green"
          loading={loading}
          stats={[
            { key: "active", label: "Active routes", value: s.route?.active_routes ?? 0 },
            { key: "pickups", label: "Standard pickup points", value: s.route?.standard_pickup_points ?? 0 },
            { key: "dropoffs", label: "Standard drop-off points", value: s.route?.standard_drop_off_points ?? 0 },
            { key: "services", label: "Scheduled services", value: s.route?.scheduled_services ?? 0 },
          ]}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card treba-shadow p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Operational Modules</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
            >
              {l.label}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}