import {
  LayoutDashboard,
  Send,
  Inbox,
  CalendarClock,
  History,
  Bell,
  User,
  Route,
  Clock,
  CarFront,
  Users,
  Car,
  BadgeCheck,
  Ticket,
  Star,
  MessageSquareWarning,
  BarChart3,
  Settings,
  Shuffle,
  CreditCard,
  Scale,
  ShieldAlert,
  ShieldCheck,
  ClipboardList,
  Receipt,
} from "lucide-react";

export const TREBA_ROLES = {
  PASSENGER: "passenger",
  DRIVER: "driver",
  ADMIN: "admin",
};

export const ROLE_LABELS = {
  passenger: "Passenger",
  driver: "Driver",
  admin: "Administrator",
};

/**
 * Determine the Treba application role
 * for the authenticated user.
 */
export function getTrebaRole(user) {
  if (!user) return null;

  if (user.role === "admin") {
    return TREBA_ROLES.ADMIN;
  }

  const appRole =
    user.app_role ||
    user.data?.app_role;

  if (appRole === TREBA_ROLES.DRIVER) {
    return TREBA_ROLES.DRIVER;
  }

  return TREBA_ROLES.PASSENGER;
}

/**
 * Return the correct dashboard path
 * for a Treba role.
 */
export function getRoleHomePath(role) {
  switch (role) {
    case TREBA_ROLES.ADMIN:
      return "/app/admin";

    case TREBA_ROLES.DRIVER:
      return "/app/driver";

    case TREBA_ROLES.PASSENGER:
    default:
      return "/app/passenger";
  }
}

/* =========================================================
   PASSENGER NAVIGATION
========================================================= */

export const PASSENGER_NAV = [
  {
    label: "Dashboard",
    path: "/app/passenger",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Book a Trip",
    path: "/app/passenger/request-trip",
    icon: Send,
  },
  {
    label: "My Requests",
    path: "/app/passenger/requests",
    icon: Inbox,
  },
  {
    label: "Upcoming Trips",
    path: "/app/passenger/upcoming",
    icon: CalendarClock,
  },
  {
    label: "Trip History",
    path: "/app/passenger/history",
    icon: History,
  },
  {
    label: "Notifications",
    path: "/app/passenger/notifications",
    icon: Bell,
  },
  {
    label: "Profile",
    path: "/app/passenger/profile",
    icon: User,
  },
];

/* =========================================================
   DRIVER NAVIGATION
========================================================= */

export const DRIVER_NAV = [
  {
    label: "Dashboard",
    path: "/app/driver",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Today's Trip",
    path: "/app/driver/today",
    icon: CalendarClock,
  },
  {
    label: "Trip Requests",
    path: "/app/driver/requests",
    icon: Inbox,
  },
  {
    label: "My Allocations",
    path: "/app/driver/routes",
    icon: Route,
  },
  {
    label: "Swap & Transfer Requests",
    path: "/app/driver/swaps",
    icon: Shuffle,
  },
  {
    label: "Availability",
    path: "/app/driver/availability",
    icon: Clock,
  },
  {
    label: "Vehicle",
    path: "/app/driver/vehicle",
    icon: CarFront,
  },
  {
    label: "Passengers",
    path: "/app/driver/passengers",
    icon: Users,
  },
  {
    label: "Subscription",
    path: "/app/driver/subscription",
    icon: CreditCard,
  },
  {
    label: "Trip History",
    path: "/app/driver/history",
    icon: History,
  },
  {
    label: "Notifications",
    path: "/app/driver/notifications",
    icon: Bell,
  },
  {
    label: "Profile",
    path: "/app/driver/profile",
    icon: User,
  },
];

/* =========================================================
   ADMIN NAVIGATION
========================================================= */

export const ADMIN_NAV = [
  {
    label: "Dashboard",
    path: "/app/admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Users",
    path: "/app/admin/users",
    icon: Users,
  },
  {
    label: "Drivers",
    path: "/app/admin/drivers",
    icon: Car,
  },
  {
    label: "Driver Verification",
    path: "/app/admin/verifications",
    icon: BadgeCheck,
  },
  {
    label: "Vehicles",
    path: "/app/admin/vehicles",
    icon: CarFront,
  },
  {
    label: "Routes",
    path: "/app/admin/routes",
    icon: Route,
  },
  {
    label: "Trip Requests",
    path: "/app/admin/requests",
    icon: Inbox,
  },
  {
    label: "Allocations",
    path: "/app/admin/allocations",
    icon: Shuffle,
  },
  {
    label: "Swap Requests",
    path: "/app/admin/swap-requests",
    icon: Shuffle,
  },
  {
    label: "Trip Operations",
    path: "/app/admin/trip-operations",
    icon: ClipboardList,
  },
  {
    label: "Bookings",
    path: "/app/admin/bookings",
    icon: Ticket,
  },
  {
    label: "Driver Subscriptions",
    path: "/app/admin/driver-subscriptions",
    icon: Receipt,
  },
  {
    label: "Subscription Plans",
    path: "/app/admin/subscription-plans",
    icon: CreditCard,
  },
  {
    label: "Trial Policy",
    path: "/app/admin/trial-policy",
    icon: Clock,
  },
  {
    label: "Subscription Payments",
    path: "/app/admin/subscription-payments",
    icon: CreditCard,
  },
  {
    label: "No-Show Cases",
    path: "/app/admin/no-show-cases",
    icon: ShieldAlert,
  },
  {
    label: "Driver No-Show Cases",
    path: "/app/admin/driver-no-show-cases",
    icon: ShieldCheck,
  },
  {
    label: "Ratings",
    path: "/app/admin/ratings",
    icon: Star,
  },
  {
    label: "Complaints",
    path: "/app/admin/complaints",
    icon: MessageSquareWarning,
  },
  {
    label: "Fare Safeguards",
    path: "/app/admin/fare-safeguards",
    icon: Scale,
  },
  {
    label: "KPIs",
    path: "/app/admin/kpis",
    icon: BarChart3,
  },
  {
    label: "System Settings",
    path: "/app/admin/settings",
    icon: Settings,
  },
];

/**
 * Return navigation for a Treba role.
 */
export function getNavForRole(role) {
  switch (role) {
    case TREBA_ROLES.DRIVER:
      return DRIVER_NAV;

    case TREBA_ROLES.ADMIN:
      return ADMIN_NAV;

    case TREBA_ROLES.PASSENGER:
    default:
      return PASSENGER_NAV;
  }
}