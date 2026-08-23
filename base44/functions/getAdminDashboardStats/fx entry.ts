import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Administrator Dashboard — aggregates live marketplace counts across the
 * demand-driven workflow: passenger demand, driver allocation, bookings,
 * fare negotiation, payments, driver wallets, and routes.
 *
 * Admin-only. Fare is never created or estimated here — this is read-only
 * visibility over the passenger/driver negotiation marketplace.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const admin = base44.asServiceRole;
    const today = new Date().toISOString().slice(0, 10);

    // --- Fetch all relevant records (best-effort, bounded) ---
    const [requests, allocations, bookings, payments, wallets, routes, noShows, driverNoShows] = await Promise.all([
      admin.entities.TripRequest.list('-created_date', 1000).catch(() => []),
      admin.entities.Allocation.list('-created_date', 1000).catch(() => []),
      admin.entities.Booking.list('-created_date', 1000).catch(() => []),
      admin.entities.Payment.list('-created_date', 1000).catch(() => []),
      admin.entities.DriverWallet.list('-created_date', 500).catch(() => []),
      admin.entities.Route.list('-created_date', 500).catch(() => []),
      admin.entities.NoShowReport.list('-reported_at', 500).catch(() => []),
      admin.entities.DriverNoShowReport.list('-reported_at', 500).catch(() => []),
    ]);

    // --- PASSENGER DEMAND ---
    const demand = {
      new_requests: 0,
      active_requests: 0,
      matched_requests: 0,
      unmatched_requests: 0,
      completed_requests: 0,
      cancelled_requests: 0,
      no_shows: (noShows || []).length + (driverNoShows || []).length,
    };
    (requests || []).forEach((r) => {
      const s = r.request_status;
      if (s === 'requested' || s === 'pending') demand.new_requests += 1;
      if (s === 'matched' || s === 'driver_accepted' || s === 'driver_responded') demand.active_requests += 1;
      if (r.matched_allocation_id || r.matched_driver_id) demand.matched_requests += 1;
      if (!r.matched_driver_id && s !== 'cancelled' && s !== 'booked') demand.unmatched_requests += 1;
      if (s === 'booked') demand.completed_requests += 1;
      if (s === 'cancelled') demand.cancelled_requests += 1;
    });

    // --- DRIVER ALLOCATION ---
    const allocation = {
      daily_allocations: 0,
      confirmed_availability: 0,
      declined_allocations: 0,
      unallocated_routes: 0,
      replacement_drivers: 0,
    };
    const todaysAllocations = (allocations || []).filter((a) => String(a.date || '') === today);
    allocation.daily_allocations = todaysAllocations.length;
    (allocations || []).forEach((a) => {
      if (a.status === 'confirmed') allocation.confirmed_availability += 1;
      if (a.status === 'declined') allocation.declined_allocations += 1;
      if (a.needs_replacement || a.replacement_driver_id) allocation.replacement_drivers += 1;
    });
    const activeRouteIds = new Set((routes || []).filter((r) => r.is_active && r.route_status !== 'suspended').map((r) => r.id));
    const allocatedRouteIdsToday = new Set(todaysAllocations.map((a) => a.route_id).filter(Boolean));
    allocation.unallocated_routes = [...activeRouteIds].filter((id) => !allocatedRouteIdsToday.has(id)).length;

    // --- BOOKINGS ---
    const booking = {
      pending: 0,
      confirmed: 0,
      paid: 0,
      cash_pending: 0,
      cash_overdue: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    (bookings || []).forEach((b) => {
      const bs = b.booking_status;
      const ps = b.payment_state;
      if (bs === 'pending') booking.pending += 1;
      if (bs === 'confirmed') booking.confirmed += 1;
      if (ps === 'paid') booking.paid += 1;
      if (ps === 'cash_pending') booking.cash_pending += 1;
      if (ps === 'cash_overdue') booking.cash_overdue += 1;
      if (bs === 'completed') booking.completed += 1;
      if (bs === 'cancelled') booking.cancelled += 1;
      if (b.was_no_show || b.no_show_status === 'passenger_no_show' || b.no_show_status === 'upheld') booking.no_show += 1;
    });

    // --- FARE NEGOTIATION ---
    const fare = {
      open_negotiations: 0,
      agreed_fares: 0,
      declined_negotiations: 0,
      expired_negotiations: 0,
    };
    (requests || []).forEach((r) => {
      const ns = r.negotiation_state;
      if (ns === 'negotiation_open' || ns === 'offer_made' || ns === 'counter_offer') fare.open_negotiations += 1;
      if (ns === 'fare_agreed' || ns === 'accepted') fare.agreed_fares += 1;
      if (ns === 'declined') fare.declined_negotiations += 1;
      if (ns === 'expired') fare.expired_negotiations += 1;
    });

    // --- PAYMENTS ---
    const payment = {
      bank_card: 0,
      mobile_wallet: 0,
      pay2cell: 0,
      other_digital: 0,
      cash_to_driver: 0,
    };
    (payments || []).forEach((p) => {
      const m = p.payment_method;
      if (m === 'bank_card') payment.bank_card += 1;
      else if (m === 'mobile_wallet') payment.mobile_wallet += 1;
      else if (m === 'pay2cell') payment.pay2cell += 1;
      else if (m === 'other_digital') payment.other_digital += 1;
      else if (m === 'cash_to_driver') payment.cash_to_driver += 1;
    });

    // --- DRIVER WALLET ---
    const wallet = {
      earnings: 0,
      pending_payouts: 0,
      completed_payouts: 0,
      failed_payouts: 0,
    };
    (wallets || []).forEach((w) => {
      wallet.earnings += Number(w.available_earnings || 0) + Number(w.pending_earnings || 0);
      wallet.pending_payouts += Number(w.pending_payout_total || 0);
      wallet.completed_payouts += Number(w.completed_payouts_total || 0);
      wallet.failed_payouts += Number(w.failed_payout_total || 0);
    });

    // --- ROUTES ---
    const route = {
      active_routes: (routes || []).filter((r) => r.is_active && r.route_status !== 'suspended').length,
      standard_pickup_points: (routes || []).reduce((sum, r) => sum + ((r.standard_pickup_points || []).length), 0),
      standard_drop_off_points: (routes || []).reduce((sum, r) => sum + ((r.standard_drop_off_points || []).length), 0),
      scheduled_services: (allocations || []).length,
    };

    return Response.json({
      generated_at: new Date().toISOString(),
      demand,
      allocation,
      booking,
      fare,
      payment,
      wallet,
      route,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}