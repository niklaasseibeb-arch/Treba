/**
 * Treba Driver Allocation Engine
 *
 * Finds and ranks eligible drivers for a scheduled route allocation.
 *
 * This engine does NOT negotiate or determine passenger fares.
 *
 * Priority:
 * 1. Driver must be active
 * 2. Driver must be available
 * 3. Driver must have an active vehicle
 * 4. Vehicle must be verified
 * 5. Vehicle must have sufficient seats
 * 6. Driver must not exceed daily trip limit
 * 7. Driver must satisfy minimum rest period
 * 8. Prefer drivers with fewer trips
 * 9. Prefer fair distribution of allocations
 * 10. Prefer drivers whose preferred routes include the route
 */

function toMinutes(value: any): number | null {
  if (!value) return null;

  const parts = String(value).split(":").map(Number);

  if (
    parts.length < 2 ||
    parts.some((x) => Number.isNaN(x))
  ) {
    return null;
  }

  return parts[0] * 60 + parts[1];
}

function toDateTime(
  date: string,
  time: string
): Date | null {
  if (!date || !time) return null;

  const value = new Date(`${date}T${time}:00`);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value;
}

function isRestSatisfied(
  driver: any,
  date: string,
  departureTime: string
): boolean {
  if (!driver?.last_trip_end) return true;

  const departure = toDateTime(date, departureTime);

  if (!departure) return true;

  const lastTripEnd = new Date(driver.last_trip_end);

  if (Number.isNaN(lastTripEnd.getTime())) {
    return true;
  }

  const minimumRestHours =
    Number(driver.minimum_rest_hours ?? 8);

  const minimumRestMs =
    minimumRestHours * 60 * 60 * 1000;

  return (
    departure.getTime() - lastTripEnd.getTime() >=
    minimumRestMs
  );
}

function hasPreferredRoute(
  driver: any,
  route: any
): boolean {
  if (!Array.isArray(driver?.preferred_routes)) {
    return false;
  }

  if (!route?.id) return false;

  return driver.preferred_routes.includes(route.id);
}

export function rankEligibleDrivers({
  route,
  date,
  departureTime,
  drivers = [],
  vehiclesByDriver = {},
  existingAllocations = [],
  excludeDriverIds = []
}: {
  route: any;
  date: string;
  departureTime: string;
  drivers: any[];
  vehiclesByDriver: Record<string, any>;
  existingAllocations: any[];
  excludeDriverIds?: string[];
}) {
  const excluded = new Set(excludeDriverIds);
  const candidates: any[] = [];

  for (const driver of drivers) {
    if (!driver?.id) continue;

    if (excluded.has(driver.id)) {
      continue;
    }

    /*
     * Driver must be active.
     */
    if (
      driver.driver_status &&
      driver.driver_status !== "active"
    ) {
      continue;
    }

    /*
     * Driver must be available.
     */
    if (
      driver.availability_status &&
      driver.availability_status !== "available"
    ) {
      continue;
    }

    /*
     * Vehicle.
     */
    const vehicle =
      vehiclesByDriver[driver.id];

    if (!vehicle) continue;

    if (vehicle.active === false) {
      continue;
    }

    /*
     * Vehicle must be verified.
     *
     * Vehicle.jsonc uses "verified", not "approved".
     */
    if (
      vehicle.verification_status &&
      vehicle.verification_status !== "verified"
    ) {
      continue;
    }

    const seatingCapacity =
      Number(vehicle.seating_capacity || 0);

    if (seatingCapacity <= 0) {
      continue;
    }

    /*
     * Existing allocations for this driver
     * on the requested date.
     */
    const sameDayAllocations =
      existingAllocations.filter(
        (allocation) =>
          allocation.driver_id === driver.id &&
          allocation.date === date &&
          [
            "awaiting_confirmation",
            "confirmed",
            "active"
          ].includes(allocation.status)
      );

    /*
     * Maximum trips per day.
     */
    const maximumTrips =
      Number(
        driver.maximum_trips_per_day ?? 2
      );

    if (
      sameDayAllocations.length >=
      maximumTrips
    ) {
      continue;
    }

    /*
     * Minimum rest requirement.
     */
    if (
      !isRestSatisfied(
        driver,
        date,
        departureTime
      )
    ) {
      continue;
    }

    /*
     * Prevent duplicate allocation
     * for the same driver/date/time.
     */
    const duplicate =
      sameDayAllocations.some(
        (allocation) =>
          allocation.departure_time ===
          departureTime
      );

    if (duplicate) {
      continue;
    }

    /*
     * Calculate workload.
     */
    const totalAllocations =
      existingAllocations.filter(
        (allocation) =>
          allocation.driver_id === driver.id
      ).length;

    /*
     * Preferred route gets a small ranking advantage.
     */
    const preferredRoute =
      hasPreferredRoute(
        driver,
        route
      );

    /*
     * Lower score is better.
     */
    const score =
      sameDayAllocations.length * 100 +
      totalAllocations * 10 +
      (preferredRoute ? -20 : 0) +
      Number(driver.fairness_score || 0) +
      Number(driver.fatigue_score || 0);

    candidates.push({
      driver,
      vehicle,
      score,
      dayAllocations:
        sameDayAllocations.length,
      totalAllocations,
      preferredRoute
    });
  }

  candidates.sort(
    (a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }

      const aCreated =
        String(
          a.driver.created_date || ""
        );

      const bCreated =
        String(
          b.driver.created_date || ""
        );

      return (
        aCreated.localeCompare(
          bCreated
        ) ||
        String(a.driver.id).localeCompare(
          String(b.driver.id)
        )
      );
    }
  );

  return candidates;
}

export function pickBestEligibleDriver(
  params: any
) {
  const ranked =
    rankEligibleDrivers(params);

  return ranked[0] || null;
}