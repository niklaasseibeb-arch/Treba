import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Check, Inbox, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const EVENT_LABELS = {
  trip_request_received: "Request received",
  driver_matched: "Driver matched",
  driver_responded: "Driver responded",
  fare_offer_received: "Fare offer",
  counter_offer_received: "Counter-offer",
  fare_agreed: "Fare agreed",
  payment_pending: "Payment pending",
  payment_successful: "Payment successful",
  booking_confirmed: "Booking confirmed",
  cash_payment_reminder: "Cash reminder",
  cash_booking_overdue: "Cash overdue",
  booking_cancelled: "Booking cancelled",
  driver_approaching: "Driver approaching",
  trip_completed: "Trip completed",
  no_show_recorded: "No-show recorded",
  dispute_update: "Dispute update",
  daily_allocation: "Daily allocation",
  allocation_confirmation_required: "Allocation required",
  allocation_confirmed: "Allocation confirmed",
  passenger_request: "Passenger request",
  passenger_counter_offer: "Passenger counter-offer",
  driver_fare_agreed: "Fare agreed",
  driver_payment_successful: "Payment received",
  cash_passenger_pending: "Cash passenger pending",
  driver_cash_reminder: "Cash reminder",
  passenger_no_show: "Passenger no-show",
  trip_reminder: "Trip reminder",
  earnings_available: "Earnings available",
  payout_completed: "Payout completed",
  payout_failed: "Payout failed",
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | unread

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const list = await base44.entities.Notification.filter(
        { user_id: user.id },
        "-created_date",
        100
      );
      setItems(list || []);
    } catch (e) {
      toast({ title: "Could not load notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await base44.entities.Notification.update(id, { is_read: true });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (e) {}
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.is_read);
    if (!unread.length) return;
    try {
      await Promise.all(unread.map((n) => base44.entities.Notification.update(n.id, { is_read: true })));
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast({ title: "All notifications marked as read" });
    } catch (e) {
      toast({ title: "Could not update notifications", variant: "destructive" });
    }
  };

  const open = (n) => {
    if (!n.is_read) markRead(n.id);
    if (n.related_id) {
      // Best-effort deep link into the relevant workflow list.
      const base = window.location.pathname.split("/").slice(0, 3).join("/");
      if (base.includes("passenger")) navigate(`${base}/requests`);
      else if (base.includes("driver")) navigate(`${base}/requests`);
    }
  };

  const visible = filter === "unread" ? items.filter((n) => !n.is_read) : items;
  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.` : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-card p-0.5 text-sm">
            <button
              onClick={() => setFilter("all")}
              className={`rounded px-3 py-1 font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`rounded px-3 py-1 font-medium transition-colors ${filter === "unread" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Unread
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={!unreadCount}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
          <Button variant="outline" size="icon" onClick={load} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Trip updates, fare offers and booking confirmations will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => (
            <li
              key={n.id}
              className={`flex gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40 ${n.is_read ? "border-border" : "border-primary/40 bg-primary/5"}`}
            >
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.is_read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  {EVENT_LABELS[n.notification_type] && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {EVENT_LABELS[n.notification_type]}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{timeAgo(n.created_date)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-center justify-center gap-2">
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
                    title="Mark as read"
                  >
                    <Check className="h-3.5 w-3.5" /> Read
                  </button>
                )}
                {n.related_id && (
                  <button
                    onClick={() => open(n)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}