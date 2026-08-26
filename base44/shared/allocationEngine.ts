/**
 * Treba Driver Allocation Engine
 *
 * Purpose:
 * Select and rank eligible drivers for a scheduled
 * town-to-town route allocation.
 *
 * This engine does NOT:
 * - negotiate fares
 * - calculate fares
 * - create bookings
 * - match passengers
 *
 * It only determines which drivers are eligible
 * and ranks them for allocation.
 */

function toMinutes(time: string | undefined | null): number | null {
  if (!time) return null;

  const parts = String(time).split(":").map(Number);

  if (
    parts.length < 2 ||
    Number.isNaN(parts[0]) ||
    Number.isNaN(parts[1])
  ) {
    return null;
  }

  return parts[0] * 60 + parts[1];
}

function minutesBetween(
  start: string | undefined | null,
  end: string | undefined | null
): number | null {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  return Math.abs(endMinutes - startMinutes);
}

function sameDay(
  dateA: string | undefined | null,
  dateB: string | undefined | null
): boolean {
  return Boolean(dateA && dateB && dateA === dateB);
}

function isDriverEligible(driver: any): boolean {
  if (!driver) return false;

  /*
   * Driver must be active.
   */
  if (
    driver.driver_status &&
    driver.driver_status !== "active"
  ) {
    return false;
  }

  /*
   * Driver must currently be available.
   */
  if (
    driver.availability_status &&
    driver.availability_status !== "available"
  ) {
    return false;
  }

  /*
   * Some older DriverProfile records may not have
   * these fields. Therefore they are only enforced
   * when present.
   */
  if (
    driver.account_status &&
    driver.account_status !== "active"
  ) {
    return false;
  }

  if (
    driver.verification_status &&
    driver.verification_status !== "approved"
  ) {
    return false;
  }

  return true;
}

function isVehicleEligible(vehicle: any): boolean {
  if (!vehicle) return false;

  /*
   * Vehicle must be active.
   */
  if (vehicle.active === false) {
    return false;
  }

  /*
   * Vehicle must have seats.
   */
  if (
    Number(vehicle.seating_capacity || 0) <= 0
  ) {
    return false;
  }

  /*
   * If verification status exists, require
   * an approved/verified vehicle.
   */
  if (vehicle.verification_status) {
    const validStatuses = [
      "verified",
      "approved"
    ];

    if (
      !validStatuses.includes(
        vehicle.verification_status
      )
    ) {
      return false;
    }
  }

  /*
   * Roadworthiness.
   */
  if (
    vehicle.roadworthiness_status &&
    vehicle.roadworthiness_status !== "valid"
  ) {
    return false;
  }

  /*
   * Licence.
   */
  if (
    vehicle.license_status &&
    vehicle.license_status !== "valid"
  ) {
    return false;
  }

  /*
   * Operator card.
   */
  if (
    vehicle.operator_card_status &&
    vehicle.operator_card_status !== "valid"
  ) {
    return false;
  }

  return true;
}

/**
 * Count driver's allocations on a particular day.
 */
function countDriverDayAllocations(
  driverId: string,
  date: string,
  allocations: any[]
): number {
  return allocations.filter(
    (allocation) =>
      allocation.driver_id === driverId &&
      sameDay(allocation.date, date) &&
      [
        "awaiting_confirmation",
        "confirmed",
        "active"
      ].includes(allocation.status)
  ).length;
}

/**
 * Count driver's historical allocations.
 */
function countDriverAllocations(
  driverId: string,
  allocations: any[]
): number {
  return allocations.filter(
    (allocation) =>
      allocation.driver_id === driverId
  ).length;
}

/**
 * Check whether driver already has an allocation
 * at exactly the same date/time.
 */
function hasExactTimeConflict(
  driverId: string,
  date: string,
  departureTime: string,
  allocations: any[]
): boolean {
  return allocations.some(
    (allocation) =>
      allocation.driver_id === driverId &&
      allocation.date === date &&
      allocation.departure_time === departureTime &&
      [
        "awaiting_confirmation",
        "confirmed",
        "active"
      ].includes(allocation.status)
  );
}

/**
 * Rank eligible drivers for a scheduled route.
 *
 * Lower score = better candidate.
 *
 * Priority:
 *
 * 1. Driver eligibility
 * 2. Vehicle eligibility
 * 3. Route preference
 * 4. Exact scheduling conflict
 * 5. Maximum trips per day
 * 6. Rest/fatigue
 * 7. Fair allocation
 * 8. Driver rating
 */
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
  const excluded = new Set(
    excludeDriverIds || []
  );

  const candidates: any[] = [];

  if (!route) {
    return candidates;
  }

  for (const driver of drivers) {
    if (!driver?.id) continue;

    /*
     * Excluded driver.
     */
    if (excluded.has(driver.id)) {
      continue;
    }

    /*
     * Driver eligibility.
     */
    if (!isDriverEligible(driver)) {
      continue;
    }

    /*
     * Vehicle.
     */
    const vehicle =
      vehiclesByDriver[driver.id];

    if (!isVehicleEligible(vehicle)) {
      continue;
    }

    /*
     * Preferred route.
     *
     * preferred_routes may contain route IDs
     * or route codes.
     *
     * Preference is used for ranking, not as
     * a hard requirement.
     */
    const preferredRoutes =
      Array.isArray(driver.preferred_routes)
        ? driver.preferred_routes
        : [];

    const routePreferred =
      preferredRoutes.includes(route.id) ||
      preferredRoutes.includes(route.route_code);

    /*
     * Existing same-day allocations.
     */
    const dayAllocations =
      countDriverDayAllocations(
        driver.id,
        date,
        existingAllocations
      );

    /*
     * Maximum trips per day.
     */
    const maximumTrips =
      Number(
        driver.maximum_trips_per_day || 2
      );

    if (
      dayAllocations >= maximumTrips
    ) {
      continue;
    }

    /*
     * Exact time conflict.
     */
    if (
      hasExactTimeConflict(
        driver.id,
        date,
        departureTime,
        existingAllocations
      )
    ) {
      continue;
    }

    /*
     * Historical allocation count.
     */
    const totalAllocations =
      countDriverAllocations(
        driver.id,
        existingAllocations
      );

    /*
     * Last trip/rest consideration.
     */
    let restPenalty = 0;

    if (driver.last_trip_end) {
      const lastTripEnd =
        new Date(driver.last_trip_end);

      if (!Number.isNaN(lastTripEnd.getTime())) {
        const scheduledStart =
          new Date(
            `${date}T${departureTime}:00`
          );

        if (
          !Number.isNaN(
            scheduledStart.getTime()
          )
        ) {
          const restHours =
            (
              scheduledStart.getTime() -
              lastTripEnd.getTime()
            ) /
            (1000 * 60 * 60);

          const minimumRest =
            Number(
              driver.minimum_rest_hours || 8
            );

          if (
            restHours < minimumRest
          ) {
            continue;
          }

          /*
           * Small ranking penalty for drivers
           * who have less rest than others.
           */
          restPenalty =
            Math.max(
              0,
              minimumRest - restHours
            );
        }
      }
    }

    /*
     * Driver rating.
     */
    const rating =
      Number(driver.rating || 0);

    /*
     * Existing scheduling/fairness scores
     * can influence ranking if available.
     */
    const schedulingScore =
      Number(
        driver.scheduling_score || 0
      );

    const fatigueScore =
      Number(
        driver.fatigue_score || 0
      );

    const fairnessScore =
      Number(
        driver.fairness_score || 0
      );

    /*
     * Route preference gets a strong advantage.
     */
    const routePreferencePenalty =
      routePreferred ? 0 : 100;

    /*
     * Lower score = better candidate.
     *
     * Fairness and workload are deliberately
     * stronger than rating.
     */
    const score =
      routePreferencePenalty +
      dayAllocations * 100 +
      totalAllocations * 20 +
      fatigueScore * 10 +
      restPenalty * 10 +
      schedulingScore * 5 -
      fairnessScore * 5 -
      rating * 5;

    candidates.push({
      driver,
      vehicle,

      score,

      routePreferred,

      dayAllocations,

      totalAllocations,

      restPenalty,

      rating,

      schedulingScore,

      fatigueScore,

      fairnessScore
    });
  }

  /*
   * Best candidate first.
   */
  candidates.sort(
    (a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }

      /*
       * Prefer higher rating when scores tie.
       */
      if (a.rating !== b.rating) {
        return b.rating - a.rating;
      }

      /*
       * Stable deterministic tie-breaker.
       */
      return String(
        a.driver.id || ""
      ).localeCompare(
        String(
          b.driver.id || ""
        )
      );
    }
  );

  /*
   * Add queue positions.
   */
  return candidates.map(
    (candidate, index) => ({
      ...candidate,
      queue_position: index + 1
    })
  );
}

/**
 * Return the single best eligible driver.
 */
export function pickBestEligibleDriver(
  params: any
) {
  const ranked =
    rankEligibleDrivers(params);

  return ranked[0] || null;
}