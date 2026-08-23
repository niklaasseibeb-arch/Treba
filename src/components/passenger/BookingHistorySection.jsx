import React, { useEffect, useState } from "react";
import { Loader2, Inbox, CalendarClock, CheckCircle2, XCircle, UserX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import StatusBadge from "@/components/StatusBadge";

const GROUPS = [
  { key: "active", label: "Active requests", filter: (b) => b.booking_status === "pending", icon: Inbox },
  { key: "upcoming", label: "Upcoming bookings", filter: (b) => b.booking_status === "confirmed", icon: CalendarClock },
  { key: "completed", label: "Completed trips", filter: (b) => b.booking_status === "completed", icon: CheckCircle2 },
  { key: "cancelled", label: "Cancellations", filter: (b) => b.booking_status === "cancelled" && !b.was_no_show, icon: XCircle },
  { key: "noshow", label: "No-show history", filter: (b) => b.was_no_show === true, icon: UserX },
];

export default function BookingHistorySection() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await base44.entities.Booking.filter({ created_by_id: user.id }, "-created_date", 50);
        if (active) setBookings(list || []);
      } catch (e) {
        if (active) setBookings([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const items = bookings.filter(g.filter);
        const Icon = g.icon;
        return (
          <div key={g.key} className="rounded-2xl border border-border bg-card p-5 treba-shadow">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{g.label}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No records yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {items.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                    <span className="font-medium">{b.passenger_name || "My booking"}</span>
                    <span className="text-muted-foreground">· {b.number_of_seats} seat(s)</span>
                    {b.fare_amount != null && (
                      <span className="text-muted-foreground">· N${b.fare_amount}</span>
                    )}
                    <span className="ml-auto"><StatusBadge status={b.booking_status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}