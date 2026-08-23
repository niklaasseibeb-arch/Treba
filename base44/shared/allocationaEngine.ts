/**
 * Treba Daily Driver Allocation Engine — pure eligibility & scoring logic.
 *
 * Treba is demand-driven, but drivers are SCHEDULED and allocated to existing
 * routes. Drivers never create passenger trips. This engine ranks eligible
 * drivers for a route+date+departure slot considering:
 *   - driver route qualification / selected routes
 *   - vehicle capacity & luggage capacity
 *   - driver availability & status (account/verification)
 *   - vehicle status (verification)
 *   - existing allocations that day (no double-booking)
 *   - daily schedule & rest/fatigue rules (max daily trips, min gap)
 *   - previous route assignments (experience)
 *   - distance travelled (fatigue)
 *   - fairness of allocation (round-robin via allocation counts)
 *
 * It does NOT assign passengers and does NOT estimate fares.
 */

export const ALLOCATION_STATUSES = [
  "awaiting_confirmation",
  "confirmed",
  "declined",
  "reassigned",
  "completed",
  "cancelled",
];

export const MAX_DAILY_ALLOCATIONS = 4;
export const MIN_REST_MINUTES = 180; // minimum gap between departures for the same driver on a day

export function routeKey(origin, destination) {
  return `${origin} - ${destination}`;
}

function toMinutes(t) {
  if (!t) return null;
  const parts = String(t).split(":").map(Number);
  if (parts.some(isNaN)) return null;
  return parts[0] * 60 + (parts[1] || 0);
}

/**
 * Rank eligible drivers best-first for a given slot.
 * @returns Array<{ driver, vehicle, score, dayAllocations, totalAllocations, priorOnRoute, distanceTravelled }>
 */
export function rankEligibleDrivers({
  route,
  date,
  departureTime,
  drivers,
  vehiclesByDriver,
  existingAllocations,
  excludeDriverIds = [],
}) {
  const routeKm = route.distance_km || 0;
  const depMin = toMinutes(departureTime);
  const key = routeKey(route.origin_town, route.destination_town);
  const altKey = `${route.origin_town} → ${route.destination_town}`;
  const excluded = new Set(excludeDriverIds);
  const candidates = [];

  for (const d of drivers) {
    if (excluded.has(d.id)) continue;
    // Driver status
    if (d.account_status && d.account_status !== "active") continue;
    if (d.verification_status && d.verification_status !== "approved") continue;
    if (d.availability_status && d.availability_status !== "available") continue;

    // Route qualification / selected routes
    const preferred = d.preferred_routes || [];
    const matchesRoute = preferred.some(
      (r) => r === key || r === altKey || r === `${route.origin_town} - ${route.destination_town}`
    );
    if (!matchesRoute) continue;

    // Vehicle status & capacity
    const vehicle = vehiclesByDriver[d.id];
    if (!vehicle) continue;
    if (vehicle.verification_status && vehicle.verification_status !== "approved") continue;
    if (!vehicle.seating_capacity || vehicle.seating_capacity <= 0) continue;

    // Existing allocations for this driver on this date (active ones)
    const dayAllocs = existingAllocations.filter(
      (a) =>
        a.allocated_driver_id === d.id &&
        a.date === date &&
        a.status !== "declined" &&
        a.status !== "cancelled"
    );

    // Rest / fatigue: minimum gap between departures
    if (depMin != null) {
      const conflict = dayAllocs.some((a) => {
        const aMin = toMinutes(a.departure_time);
        if (aMin == null) return false;
        return Math.abs(aMin - depMin) < MIN_REST_MINUTES;
      });
      if (conflict) continue;
    }

    // Fatigue: max daily allocations
    if (dayAllocs.length >= MAX_DAILY_ALLOCATIONS) continue;

    // Stats for scoring
    const totalAllocations = existingAllocations.filter(
      (a) => a.allocated_driver_id === d.id
    ).length;
    const priorOnRoute = existingAllocations.filter(
      (a) => a.allocated_driver_id === d.id && a.route_id === route.id
    ).length;
    const distanceTravelled = existingAllocations
      .filter(
        (a) =>
          a.allocated_driver_id === d.id &&
          (a.status === "completed" || a.status === "confirmed")
      )
      .reduce((sum, a) => sum + (a.route_distance_km || 0), 0);

    // Lower score = better.
    // Fairness: fewer day + total allocations preferred.
    // Experience: prior assignments on this route slightly preferred.
    // Fatigue: more accumulated distance slightly penalised.
    const score =
      dayAllocs.length * 100 +
      totalAllocations * 10 +
      (priorOnRoute > 0 ? -15 : 0) +
      distanceTravelled * 0.05;

    candidates.push({
      driver: d,
      vehicle,
      score,
      dayAllocations: dayAllocs.length,
      totalAllocations,
      priorOnRoute,
      distanceTravelled,
      routeKm,
    });
  }

  candidates.sort(
    (a, b) =>
      a.score - b.score ||
      String(a.driver.created_date || "").localeCompare(String(b.driver.created_date || ""))
  );
  return candidates;
}

export function pickBestDriver(params) {
  const ranked = rankEligibleDrivers(params);
  return ranked[0] || null;
}