import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { compareLuggageToVehicle } from '../../shared/luggageServer.ts';
import { bookingPriorityScore } from '../../shared/cashRules.ts';

/**
 * Returns the passenger trip requests routed to THIS driver, including agreed
 * fare / cash-pending bookings (so the driver can confirm cash). Each request
 * is enriched with luggage comparison and a payment summary (including cash
 * status + deadline). Requests are ordered so digital paid bookings rank
 * higher (higher priority) than cash-pending bookings.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = base44.asServiceRole;

    const profiles = await admin.entities.DriverProfile.list('-created_date', 500);
    const profile = profiles.find((p) => p.user_id === user.id);
    if (!profile) return Response.json({ vehicle: null, requests: [] });

    let vehicle = null;
    if (profile.vehicle_id) {
      try { vehicle = await admin.entities.Vehicle.get(profile.vehicle_id); } catch (e) {}
    }

    const trips = await admin.entities.TripRequest.list('-created_date', 500);
    const open = trips.filter(
      (t) =>
        t.matched_driver_user_id === user.id &&
        ['matched', 'driver_accepted', 'driver_responded', 'booked'].includes(t.request_status)
    );

    const requests = [];
    for (const t of open) {
      let payment = null;
      let booking = null;
      try {
        const payments = await admin.entities.Payment.filter({ trip_request_id: t.id }, '-created_date', 5);
        payment = (payments && payments[0]) || null;
      } catch (e) {}
      if (t.booking_id) {
        try { booking = await admin.entities.Booking.get(t.booking_id); } catch (e) {}
      }
      requests.push({
        ...t,
        luggage_comparison: compareLuggageToVehicle(t, vehicle),
        payment: payment
          ? {
              id: payment.id,
              payment_category: payment.payment_category,
              payment_method: payment.payment_method,
              payment_status: payment.payment_status,
              cash_status: payment.cash_status,
              cash_check_in_deadline: payment.cash_check_in_deadline,
              amount: payment.amount,
              provider_name: payment.provider_name,
              payment_reference: payment.payment_reference,
            }
          : null,
        booking: booking
          ? {
              booking_status: booking.booking_status,
              payment_status: booking.payment_status,
              payment_method: booking.payment_method,
              payment_arrangement: booking.payment_arrangement || null,
              cash_status: booking.cash_status,
              cash_check_in_deadline: booking.cash_check_in_deadline,
              payment_state: booking.payment_state,
              priority: booking.priority,
              confirmed_at: booking.confirmed_at,
              fare_received: !!booking.fare_received,
              fare_received_at: booking.fare_received_at || null,
            }
          : null,
      });
    }

    // Priority: digital paid > cash paid > digital pending > cash pending > overdue.
    requests.sort((a, b) => {
      const pa = bookingPriorityScore({ ...(a.booking || {}), ...(a.payment || {}) });
      const pb = bookingPriorityScore({ ...(b.booking || {}), ...(b.payment || {}) });
      if (pa !== pb) return pa - pb;
      return String(b.created_date || '').localeCompare(String(a.created_date || ''));
    });

    return Response.json({
      vehicle: vehicle
        ? {
            id: vehicle.id,
            label: `${vehicle.make} ${vehicle.model} (${vehicle.registration_number})`,
            luggage_capacity: vehicle.luggage_capacity,
            seating_capacity: vehicle.seating_capacity,
          }
        : null,
      requests,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}