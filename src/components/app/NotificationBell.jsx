import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const load = async () => {
    if (!user?.id) return;
    try {
      const list = await base44.entities.Notification.filter(
        { user_id: user.id, is_read: false },
        "-created_date",
        100
      );
      setUnread((list || []).length);
    } catch (e) {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const go = () => {
    const base = window.location.pathname.split("/").slice(0, 3).join("/");
    navigate(`${base}/notifications`);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="Notifications"
      onClick={go}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Button>
  );
}