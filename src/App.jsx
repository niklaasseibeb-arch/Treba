import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

// Public pages
import Landing from '@/pages/Landing';
import HowItWorks from '@/pages/HowItWorks';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App shell
import AppLayout from '@/components/app/AppLayout';
import RoleGuard from '@/components/app/RoleGuard';
import ModulePlaceholder from '@/components/ModulePlaceholder';
import Notifications from '@/pages/app/Notifications';

// Passenger pages
import PassengerDashboard from '@/pages/passenger/Dashboard';
import PassengerProfile from '@/pages/passenger/Profile';
import PassengerRequestTrip from '@/pages/passenger/RequestTrip';
import PassengerMyRequests from '@/pages/passenger/MyRequests';
import DirectPayment from '@/pages/passenger/DirectPayment';
import PassengerRateTrip from '@/pages/passenger/RateTrip';

// Driver pages
import DriverDashboard from '@/pages/driver/Dashboard';
import DriverProfile from '@/pages/driver/Profile';
import DriverEarnings from '@/pages/driver/Earnings';
import DriverAllocations from '@/pages/driver/Allocations';
import DriverTripRequests from '@/pages/driver/TripRequests';
import DriverRoster from '@/pages/driver/Roster';
import DriverTripOperations from '@/pages/driver/TripOperations';
import DriverVehicle from '@/pages/driver/Vehicle';
import DriverAvailability from '@/pages/driver/Availability';
import DriverSubscription from '@/pages/driver/Subscription';
import DriverSwapRequests from '@/pages/driver/SwapRequests';

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminVerifications from '@/pages/admin/Verifications';
import AdminPayoutProviders from '@/pages/admin/PayoutProviders';
import AdminRoutes from '@/pages/admin/Routes';
import AdminAllocations from '@/pages/admin/Allocations';
import AdminFareSafeguards from '@/pages/admin/FareSafeguards';
import AdminPaymentProviders from '@/pages/admin/PaymentProviders';
import AdminCashControls from '@/pages/admin/CashControls';
import AdminNoShowCases from '@/pages/admin/NoShowCases';
import AdminDriverNoShowCases from '@/pages/admin/DriverNoShowCases';
import AdminDriverPayouts from '@/pages/admin/DriverPayouts';
import AdminTripOperations from '@/pages/admin/TripOperations';
import AdminSubscriptionPlans from '@/pages/admin/SubscriptionPlans';
import AdminDriverSubscriptions from '@/pages/admin/DriverSubscriptions';
import AdminTrialPolicy from '@/pages/admin/TrialPolicy';
import AdminSubscriptionPayments from '@/pages/admin/SubscriptionPayments';
import AdminSwapRequests from '@/pages/admin/SwapRequests';

import {
  Send, Ticket, CalendarClock, History, Bell,
  Car, Inbox, Users, Clock, CarFront, Wallet, Route as RouteIcon,
  BadgeCheck, Star, MessageSquareWarning, BarChart3, Settings,
  Shuffle, Banknote,
} from 'lucide-react';

const placeholder = (title, description, icon) => (
  <ModulePlaceholder title={title} description={description} icon={icon} />
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated app */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          {/* Passenger */}
          <Route element={<RoleGuard allow="passenger" />}>
            <Route path="/app/passenger" element={<PassengerDashboard />} />
            <Route path="/app/passenger/request-trip" element={<PassengerRequestTrip />} />
            <Route path="/app/passenger/requests" element={<PassengerMyRequests />} />
            <Route path="/app/passenger/booking/:requestId" element={<DirectPayment />} />
            <Route path="/app/passenger/rate/:bookingId" element={<PassengerRateTrip />} />
            <Route path="/app/passenger/upcoming" element={placeholder("Upcoming Trips", "Your confirmed upcoming journeys will appear here.", CalendarClock)} />
            <Route path="/app/passenger/history" element={placeholder("Trip History", "Review completed journeys and rate your drivers.", History)} />
            <Route path="/app/passenger/notifications" element={<Notifications />} />
            <Route path="/app/passenger/profile" element={<PassengerProfile />} />
          </Route>

          {/* Driver */}
          <Route element={<RoleGuard allow="driver" />}>
            <Route path="/app/driver" element={<DriverDashboard />} />
            <Route path="/app/driver/requests" element={<DriverTripRequests />} />
            <Route path="/app/driver/routes" element={<DriverAllocations />} />
            <Route path="/app/driver/availability" element={<DriverAvailability />} />
            <Route path="/app/driver/vehicle" element={<DriverVehicle />} />
            <Route path="/app/driver/passengers" element={<DriverRoster />} />
            <Route path="/app/driver/today" element={<DriverTripOperations />} />
            <Route path="/app/driver/earnings" element={<DriverEarnings />} />
            <Route path="/app/driver/subscription" element={<DriverSubscription />} />
            <Route path="/app/driver/swaps" element={<DriverSwapRequests />} />
            <Route path="/app/driver/history" element={placeholder("Trip History", "Review your completed trips as a driver.", History)} />
            <Route path="/app/driver/notifications" element={<Notifications />} />
            <Route path="/app/driver/profile" element={<DriverProfile />} />
          </Route>

          {/* Administrator */}
          <Route element={<RoleGuard allow="admin" />}>
            <Route path="/app/admin" element={<AdminDashboard />} />
            <Route path="/app/admin/users" element={placeholder("Users", "Manage platform users and account status.", Users)} />
            <Route path="/app/admin/drivers" element={placeholder("Drivers", "Manage driver accounts and profiles.", Car)} />
            <Route path="/app/admin/verifications" element={<AdminVerifications />} />
            <Route path="/app/admin/vehicles" element={placeholder("Vehicles", "Review registered vehicles across the platform.", CarFront)} />
            <Route path="/app/admin/routes" element={<AdminRoutes />} />
            <Route path="/app/admin/requests" element={placeholder("Trip Requests", "Monitor passenger trip requests across the platform.", Inbox)} />
            <Route path="/app/admin/allocations" element={<AdminAllocations />} />
            <Route path="/app/admin/swap-requests" element={<AdminSwapRequests />} />
            <Route path="/app/admin/trip-operations" element={<AdminTripOperations />} />
            <Route path="/app/admin/subscription-plans" element={<AdminSubscriptionPlans />} />
            <Route path="/app/admin/driver-subscriptions" element={<AdminDriverSubscriptions />} />
            <Route path="/app/admin/trial-policy" element={<AdminTrialPolicy />} />
            <Route path="/app/admin/subscription-payments" element={<AdminSubscriptionPayments />} />
            <Route path="/app/admin/fare-safeguards" element={<AdminFareSafeguards />} />
            <Route path="/app/admin/payment-providers" element={<AdminPaymentProviders />} />
            <Route path="/app/admin/cash-controls" element={<AdminCashControls />} />
            <Route path="/app/admin/no-show-cases" element={<AdminNoShowCases />} />
            <Route path="/app/admin/driver-no-show-cases" element={<AdminDriverNoShowCases />} />
            <Route path="/app/admin/bookings" element={placeholder("Bookings", "Monitor and manage bookings platform-wide.", Ticket)} />
            <Route path="/app/admin/payments" element={placeholder("Payments", "Monitor passenger payment activity and statuses.", Wallet)} />
            <Route path="/app/admin/payouts" element={<AdminDriverPayouts />} />
            <Route path="/app/admin/payout-providers" element={<AdminPayoutProviders />} />
            <Route path="/app/admin/ratings" element={placeholder("Ratings", "Review passenger and driver ratings.", Star)} />
            <Route path="/app/admin/complaints" element={placeholder("Complaints & Feedback", "Review user complaints and feedback submissions.", MessageSquareWarning)} />
            <Route path="/app/admin/kpis" element={placeholder("KPIs", "Operational key performance indicators will be built out in the next phase.", BarChart3)} />
            <Route path="/app/admin/settings" element={placeholder("System Settings", "Configure platform operational rules and settings.", Settings)} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App