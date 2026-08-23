import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, LogOut, ChevronDown, Home } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/app/NotificationBell";
import Sidebar from "@/components/app/Sidebar";
import { getTrebaRole, ROLE_LABELS, getRoleHomePath } from "@/lib/treba-roles";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = getTrebaRole(user);
  const location = useLocation();
  const homePath = getRoleHomePath(role);
  const isHome = location.pathname === homePath;

  const handleLogout = () => {
    logout(false);
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar role={role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button onClick={() => navigate(homePath)} aria-label="Home" className="rounded-lg">
              <Logo size="sm" showTagline={false} />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(homePath)} className="gap-1.5">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <NotificationBell />
            <div className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <div className="max-w-[140px] truncate text-sm font-semibold leading-tight">
                  {user?.full_name || user?.email}
                </div>
                <div className="text-[11px] font-medium text-muted-foreground">
                  {ROLE_LABELS[role]}
                </div>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {!isHome && (
              <div className="mb-5">
                <Button variant="outline" size="sm" onClick={() => navigate(homePath)} className="gap-1.5">
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}