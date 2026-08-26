import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Users,
  UserCheck,
  UserX,
  Clock3,
  RefreshCw,
  Search,
} from "lucide-react";

const STATUS_LABELS = {
  active: "Active",
  pending: "Pending",
  suspended: "Suspended",
};

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPassengers() {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPassengers = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await base44.entities.User.list();

      const passengerUsers = Array.isArray(result)
        ? result.filter((user) => user.app_role === "passenger")
        : [];

      setPassengers(passengerUsers);
    } catch (err) {
      console.error("Failed to load passengers:", err);

      setError(
        err?.message || "Unable to load passengers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPassengers();
  }, []);

  const stats = useMemo(() => {
    return {
      total: passengers.length,

      active: passengers.filter(
        (passenger) =>
          passenger.account_status === "active"
      ).length,

      pending: passengers.filter(
        (passenger) =>
          passenger.account_status === "pending"
      ).length,

      suspended: passengers.filter(
        (passenger) =>
          passenger.account_status === "suspended"
      ).length,
    };
  }, [passengers]);

  const filteredPassengers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return passengers.filter((passenger) => {
      const matchesSearch =
        !query ||
        passenger.full_name
          ?.toLowerCase()
          .includes(query) ||
        passenger.phone
          ?.toLowerCase()
          .includes(query) ||
        passenger.email
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        passenger.account_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [passengers, search, statusFilter]);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Passengers
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage registered Treba passengers and their
            account status.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPassengers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
         <RefreshCw
            className="h-4 w-4"
            aria-hidden="true"
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

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

        <StatCard
          icon={Users}
          label="Total Passengers"
          value={stats.total}
        />

        <StatCard
          icon={UserCheck}
          label="Active"
          value={stats.active}
        />

        <StatCard
          icon={Clock3}
          label="Pending"
          value={stats.pending}
        />

        <StatCard
          icon={UserX}
          label="Suspended"
          value={stats.suspended}
        />

      </div>

      {/* FILTERS */}
      <div className="rounded-xl border border-border bg-card p-4">

        <div className="grid gap-3 md:grid-cols-2">

          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, phone or email..."
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* STATUS */}
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>

        </div>

      </div>

      {/* PASSENGER TABLE */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">

        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">
            Passenger Accounts
          </h2>

          <p className="text-xs text-muted-foreground">
            {filteredPassengers.length} passenger
            {filteredPassengers.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading passengers...
          </div>
        ) : filteredPassengers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No passengers found.
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Name
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Phone
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Email
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Status
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Profile
                  </th>
                </tr>
              </thead>

              <tbody>

                {filteredPassengers.map((passenger) => (
                  <tr
                    key={passenger.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >

                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {passenger.full_name ||
                          "Unnamed passenger"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {passenger.phone || "—"}
                    </td>

                    <td className="px-4 py-3">
                      {passenger.email || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-border px-2 py-1 text-xs font-medium">
                        {STATUS_LABELS[
                          passenger.account_status
                        ] ||
                          passenger.account_status ||
                          "Unknown"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {passenger.profile_completion ? (
                        <span className="text-xs font-medium">
                          Complete
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Incomplete
                        </span>
                      )}
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}