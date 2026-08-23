/**
 * Treba Passenger Demand Matching Engine — pure matching & ranking logic.
 *
 * Matches a passenger TripRequest to SCHEDULED, CONFIRMED daily allocations
 * (drivers who have confirmed availability for a route on a date) and ranks
 * the suitable scheduled drivers best-first according to Treba's priority:
 *
 *   1. Confirmed daily allocation      (hard filter — only confirmed allocations)
 *   2. Driver availability              (hard filter — active, approved, available)
 *   3. Appropriate route                (hard filter — origin/destination/route/date)
 *   4. Appropriate departure time       (rank by closeness to preferred time)
 *   5. Available passenger capacity     (hard filter + rank by headroom)
 *   6. Luggage capacity                 (hard filter + rank by headroom)
 *   7. Fair allocation                  (rank by fewer total allocations)
 *   8. Driver workload / fatigue        (rank by fewer same-day allocations)
 *
 * It does NOT determine, estimate or rank by fare. Fare is always negotiated
 * between the passenger and the matched driver.
 */

import { luggageEquivalent } from './luggageServer.ts';

// Maximum acceptable difference between the passenger's preferred departure
// time and the scheduled allocation's departure time, in minutes.
export const TIME_WINDOW_MINUTES = 180;

function toMinutes(t) {
  if (!t) return null;
  const parts = String(t).split(':').map(Number);
  if (parts.some(isNaN)) return null;
  return parts[0] * 60 + (parts[1] || 0);
}

/**
 * Rank suitable scheduled allocations for a passenger trip request, best-first.
 *
 * @returns Array<{ allocation, driver, vehicle, score, minutesDiff, seatHeadroom, luggageHeadroom, dayAllocations, totalAllocations }>
 */
export function rankMatchingAllocations({
  request,
  allocations,
  driversById,
  vehiclesById,
  excludeDriverIds = [],
}) {
  const seats = Number(request.number_of_seats) || 1;
  const luggageEq = luggageEquivalent(request);
  const reqMin = toMinutes(request.requested_time);
  const excluded = new Set(excludeDriverIds);
  const candidates = [];

  for (const a of allocations) {
    // 3. Appropriate route: origin / destination / date / route match
    if (!a.origin || !a.destination) continue;
    if (a.origin !== request.origin || a.destination !== request.destination) continue;
    if (request.requested_date && a.date && a.date !== request.requested_date) continue;
    if (request.route_id && a.route_id && request.route_id !== a.route_id) continue;

    // 1. Confirmed daily allocation (driver availability confirmation)
    if (a.status !== 'confirmed') continue;

    // 2. Driver availability & operational status
    const driver = a.allocated_driver_id ? driversById.get(a.allocated_driver_id) : null;
    if (!driver) continue;
    if (excluded.has(driver.id)) continue;
    if (driver.account_status && driver.account_status !== 'active') continue;
    if (driver.verification_status && driver.verification_status !== 'approved') continue;
    if (driver.availability_status && driver.availability_status !== 'available') continue;

    // Vehicle
    const vehicle = a.vehicle_id ? vehiclesById.get(a.vehicle_id) : null;
    if (!vehicle) continue;
    if (vehicle.verification_status && vehicle.verification_status !== 'approved') continue;

    // 5. Available passenger capacity
    const allocSeats = Number(a.available_seats ?? a.total_seats ?? vehicle.seating_capacity ?? 0);
    if (allocSeats < seats) continue;
    if (vehicle.seating_capacity && Number(vehicle.seating_capacity) < seats) continue;

    // 6. Luggage capacity (enforced only when the vehicle has a configured capacity)
    if (typeof vehicle.luggage_capacity === 'number' && luggageEq > vehicle.luggage_capacity) continue;

    // 4. Appropriate departure time (closeness, within window)
    const aMin = toMinutes(a.departure_time);
    let minutesDiff = 0;
    if (reqMin != null && aMin != null) {
      minutesDiff = Math.abs(aMin - reqMin);
      if (minutesDiff > TIME_WINDOW_MINUTES) continue;
    }

    // 7. Fair allocation & 8. workload / fatigue stats
    const dayAllocations = allocations.filter(
      (x) =>
        x.allocated_driver_id === driver.id &&
        x.date === a.date &&
        (x.status === 'confirmed' || x.status === 'awaiting_confirmation')
    ).length;
    const totalAllocations = allocations.filter(
      (x) => x.allocated_driver_id === driver.id
    ).length;

    const seatHeadroom = allocSeats - seats;
    const luggageHeadroom =
      typeof vehicle.luggage_capacity === 'number'
        ? vehicle.luggage_capacity - luggageEq
        : 0;

    // Weighted score (lower = better), following the priority order.
    const score =
      minutesDiff * 1 +        // 4. departure time closeness
      dayAllocations * 60 +    // 8. workload / fatigue
      totalAllocations * 30 +  // 7. fair allocation
      -seatHeadroom * 2 +      // 5. passenger capacity headroom
      -luggageHeadroom * 3;    // 6. luggage capacity headroom

    candidates.push({
      allocation: a,
      driver,
      vehicle,
      score,
      minutesDiff,
      seatHeadroom,
      luggageHeadroom,
      dayAllocations,
      totalAllocations,
    });
  }

  candidates.sort(
    (a, b) =>
      a.score - b.score ||
      String(a.driver.created_date || '').localeCompare(String(b.driver.created_date || '')) ||
      (a.driver.id || '').localeCompare(b.driver.id || '')
  );
  return candidates;
}

export function pickBestMatch(params) {
  const ranked = rankMatchingAllocations(params);
  return ranked[0] || null;
}