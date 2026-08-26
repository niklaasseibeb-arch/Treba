import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Car,
  BadgeCheck,
  Route as RouteIcon,
  Inbox,
  Ticket,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { base44 } from "@/api/base44Client";

function StatCard({
  icon: Icon,
  title,
  value,
  description,
  to,
}) {
  const content = (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight">
            {value}
          </p>

          {description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (!to) {
    return content;
  }

  return (
    <Link to={to} className="block">
      {content}
    </Link>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    drivers: 0,
    pendingDrivers: 0,
    approvedDrivers: 0,
    vehicles: 0,
    pendingVehicles: 0,
    routes: 0,
    tripRequests: 0,
    bookings: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      /*
       * -------------------------------------------------------
       * DRIVER PROFILES
       * -------------------------------------------------------
       */

      let drivers = [];

      try {
        drivers =
          (await base44.entities.DriverProfile.list(
            "-created_date",
            500
          )) || [];
      } catch (err) {
        console.error(
          "Could not load DriverProfile:",
          err
        );
      }

      /*
       * -------------------------------------------------------
       * VEHICLES
       * -------------------------------------------------------
       */

      let vehicles = [];

      try {
        vehicles =
          (await base44.entities.Vehicle.list(
            "-created_date",
            500
          )) || [];
      } catch (err) {
        console.error(
          "Could not load Vehicle:",
          err
        );
      }

      /*
       * -------------------------------------------------------
       * ROUTES
       * -------------------------------------------------------
       */

      let routes = [];

      try {
        routes =
          (await base44.entities.Route.list(
            "-created_date",
            500
          )) || [];
      } catch (err) {
        console.error(
          "Could not load Route:",
          err
        );
      }

      /*
       * -------------------------------------------------------
       * TRIP REQUESTS
       * -------------------------------------------------------
       */

      let tripRequests = [];

      try {
        tripRequests =
          (await base44.entities.TripRequest.list(
            "-created_date",
            500
          )) || [];
      } catch (err) {
        console.error(
          "Could not load TripRequest:",
          err
        );
      }

      /*
       * -------------------------------------------------------
       * BOOKINGS
       * -------------------------------------------------------
       */

      let bookings = [];

      try {
        bookings =
          (await base44.entities.Booking.list(
            "-created_date",
            500
          )) || [];
      } catch (err) {
        console.error(
          "Could not load Booking:",
          err
        );
      }

      /*
       * -------------------------------------------------------
       * DRIVER COUNTS
       * -------------------------------------------------------
       */

      const pendingDrivers =
        drivers.filter(
          (driver) =>
            driver.verification_status !==
            "approved"
        ).length;

      const approvedDrivers =
        drivers.filter(
          (driver) =>
            driver.verification_status ===
            "approved"
        ).length;

      /*
       * -------------------------------------------------------
       * VEHICLE COUNTS
       * -------------------------------------------------------
       */

      const pendingVehicles =
        vehicles.filter(
          (vehicle) =>
            vehicle.verification_status !==
            "approved"
        ).length;

      /*
       * -------------------------------------------------------
       * UPDATE DASHBOARD
       * -------------------------------------------------------
       *
       * Base44 does not expose a normal browser-side
       * users.list() method in SDK 0.8.43.
       *
       * Therefore users is currently represented by
       * known Treba profile records rather than attempting
       * to access the internal Base44 User table.
       */

      setStats({
        users: drivers.length,
        drivers: drivers.length,
        pendingDrivers,
        approvedDrivers,
        vehicles: vehicles.length,
        pendingVehicles,
        routes: routes.length,
        tripRequests: tripRequests.length,
        bookings: bookings.length,
      });
    } catch (err) {
      console.error(
        "TREBA ADMIN DASHBOARD FAILED:",
        err
      );

      setError(
        err?.message ||
          "Unable to load Admin dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------- */}
      {/* HEADER */}
      {/* --------------------------------------------------- */}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Admin Dashboard
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage Treba users, drivers, vehicles,
            routes and marketplace operations.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* --------------------------------------------------- */}
      {/* ERROR */}
      {/* --------------------------------------------------- */}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* --------------------------------------------------- */}
      {/* CORE ADMIN STATS */}
      {/* --------------------------------------------------- */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          title="Users"
          value={
            loading
              ? "..."
              : stats.users
          }
          description="Registered Treba profiles"
          to="/app/admin/users"
        />

        <StatCard
          icon={Car}
          title="Drivers"
          value={
            loading
              ? "..."
              : stats.drivers
          }
          description={`${stats.approvedDrivers} approved`}
          to="/app/admin/drivers"
        />

        <StatCard
          icon={BadgeCheck}
          title="Pending Driver Approval"
          value={
            loading
              ? "..."
              : stats.pendingDrivers
          }
          description="Drivers requiring review"
          to="/app/admin/verifications"
        />

        <StatCard
          icon={UserCheck}
          title="Approved Drivers"
          value={
            loading
              ? "..."
              : stats.approvedDrivers
          }
          description="Verified driver profiles"
          to="/app/admin/verifications"
        />
      </div>

      {/* --------------------------------------------------- */}
      {/* OPERATIONS */}
      {/* --------------------------------------------------- */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Car}
          title="Vehicles"
          value={
            loading
              ? "..."
              : stats.vehicles
          }
          description={`${stats.pendingVehicles} pending verification`}
          to="/app/admin/vehicles"
        />

        <StatCard
          icon={RouteIcon}
          title="Routes"
          value={
            loading
              ? "..."
              : stats.routes
          }
          description="Configured routes"
          to="/app/admin/routes"
        />

        <StatCard
          icon={Inbox}
          title="Trip Requests"
          value={
            loading
              ? "..."
              : stats.tripRequests
          }
          description="Passenger demand"
          to="/app/admin/requests"
        />

        <StatCard
          icon={Ticket}
          title="Bookings"
          value={
            loading
              ? "..."
              : stats.bookings
          }
          description="Passenger bookings"
          to="/app/admin/bookings"
        />
      </div>

      {/* --------------------------------------------------- */}
      {/* ADMIN ACTIONS */}
      {/* --------------------------------------------------- */}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />

          <div>
            <h2 className="text-base font-semibold">
              Administration
            </h2>

            <p className="text-sm text-muted-foreground">
              Access the main administration functions.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/app/admin/users"
            className="group rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-primary" />

              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>

            <div className="mt-3 font-semibold">
              Users
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              View registered passenger and driver profiles.
            </div>
          </Link>

          <Link
            to="/app/admin/drivers"
            className="group rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-center justify-between">
              <Car className="h-5 w-5 text-primary" />

              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>

            <div className="mt-3 font-semibold">
              Drivers
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              View and manage driver profiles.
            </div>
          </Link>

          <Link
            to="/app/admin/verifications"
            className="group rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-center justify-between">
              <BadgeCheck className="h-5 w-5 text-primary" />

              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>

            <div className="mt-3 font-semibold">
              Driver Verification
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Approve or reject driver registrations.
            </div>
          </Link>

          <Link
            to="/app/admin/routes"
            className="group rounded-xl border border-border p-4 hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-center justify-between">
              <RouteIcon className="h-5 w-5 text-primary" />

              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>

            <div className="mt-3 font-semibold">
              Routes
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Manage Treba travel corridors and routes.
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}