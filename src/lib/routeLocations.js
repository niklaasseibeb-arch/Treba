/**
 * Treba route location classifier.
 *
 * A route has designated STANDARD pickup and drop-off points. A passenger may
 * request a specific pickup/drop-off location, which Treba classifies as either
 * STANDARD or NON-STANDARD against the selected route.
 *
 * Treba does NOT calculate, estimate or suggest any fare. The classification is
 * provided to the driver and passenger to inform fare negotiation only.
 *
 * Cash bookings require BOTH pickup and drop-off to be standard locations.
 */

export const CASH_NONSTANDARD_MESSAGE =
  "Cash payment is unavailable for non-standard pickup/drop-off. Please select a digital payment method.";

export function normalizePoint(point) {
  return (point || "").trim().toLowerCase();
}

/**
 * Classify a pickup location against a route's standard pickup points.
 * @returns {{ isStandard: boolean, matched: string|null }}
 */
export function classifyPickup(route, point) {
  const standards = (route?.standard_pickup_points || []).map(normalizePoint);
  const norm = normalizePoint(point);
  if (!norm) return { isStandard: false, matched: null };
  const matchedIndex = standards.indexOf(norm);
  if (matchedIndex === -1) return { isStandard: false, matched: null };
  return { isStandard: true, matched: route.standard_pickup_points[matchedIndex] };
}

/**
 * Classify a drop-off location against a route's standard drop-off points.
 * @returns {{ isStandard: boolean, matched: string|null }}
 */
export function classifyDropoff(route, point) {
  const standards = (route?.standard_drop_off_points || []).map(normalizePoint);
  const norm = normalizePoint(point);
  if (!norm) return { isStandard: false, matched: null };
  const matchedIndex = standards.indexOf(norm);
  if (matchedIndex === -1) return { isStandard: false, matched: null };
  return { isStandard: true, matched: route.standard_drop_off_points[matchedIndex] };
}

/**
 * Cash is allowed only when BOTH pickup and drop-off are standard locations.
 */
export function isCashAllowed(route, pickupPoint, dropoffPoint) {
  return (
    classifyPickup(route, pickupPoint).isStandard &&
    classifyDropoff(route, dropoffPoint).isStandard
  );
}