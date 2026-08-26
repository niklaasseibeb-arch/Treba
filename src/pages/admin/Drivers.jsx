import React, { useEffect, useState } from "react";
import { Car, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDrivers = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await base44.entities.DriverProfile.list("-created_date", 200);
      setDrivers(data || []);
    } catch (err) {
      setError(err.message || "Unable to load drivers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage registered Treba drivers.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadDrivers}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card treba-shadow">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading drivers...
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-8 text-center">
            <Car className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No drivers found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Driver</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Verification</th>
                  <th className="px-4 py-3 text-left font-medium">Rating</th>
                  <th className="px-4 py-3 text-left font-medium">Trips</th>
                </tr>
              </thead>

              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {driver.full_name || "—"}
                    </td>

                    <td className="px-4 py-3">
                      {driver.phone || "—"}
                    </td>

                    <td className="px-4 py-3 capitalize">
                      {driver.driver_status || "pending"}
                    </td>

                    <td className="px-4 py-3 capitalize">
                      {driver.verification_status || "pending"}
                    </td>

                    <td className="px-4 py-3">
                      {driver.rating ?? 0}
                    </td>

                    <td className="px-4 py-3">
                      {driver.trips_completed ?? 0}
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
