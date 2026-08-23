/**
 * Treba luggage helpers.
 *
 * Luggage is captured in practical categories (small bags, standard bags,
 * large suitcases, oversized/bulky items) plus an approximate weight category.
 *
 * Vehicle.luggage_capacity is expressed in "large bag" units. We convert the
 * requested luggage into a large-bag equivalent to compare against capacity.
 *
 * Treba never calculates a luggage fee. Luggage may be part of fare
 * negotiation; the final fare is always agreed between passenger and driver.
 */

export const LUGGAGE_WEIGHT_CATEGORIES = [
  { value: "small_personal", label: "Small personal item" },
  { value: "standard", label: "Standard luggage" },
  { value: "large", label: "Large luggage" },
  { value: "oversized", label: "Oversized/bulky item" },
  { value: "heavy", label: "Heavy luggage" },
];

// Large-bag equivalent weights per item.
const BAG_EQUIVALENT = {
  small: 0.5,
  standard: 1,
  large: 1.5,
  oversized: 2,
};

export function weightCategoryLabel(value) {
  return LUGGAGE_WEIGHT_CATEGORIES.find((c) => c.value === value)?.label || "";
}

export function luggageItemCount(luggage = {}) {
  return (
    (Number(luggage.luggage_small_bags) || 0) +
    (Number(luggage.luggage_standard_bags) || 0) +
    (Number(luggage.luggage_large_suitcases) || 0) +
    (Number(luggage.luggage_oversized_items) || 0)
  );
}

export function luggageEquivalent(luggage = {}) {
  const small = Number(luggage.luggage_small_bags) || 0;
  const standard = Number(luggage.luggage_standard_bags) || 0;
  const large = Number(luggage.luggage_large_suitcases) || 0;
  const oversized = Number(luggage.luggage_oversized_items) || 0;
  return (
    small * BAG_EQUIVALENT.small +
    standard * BAG_EQUIVALENT.standard +
    large * BAG_EQUIVALENT.large +
    oversized * BAG_EQUIVALENT.oversized
  );
}

/**
 * Compare requested luggage against a vehicle's configured luggage capacity.
 * @returns {{ equivalent: number, capacity: number|null, exceeds: boolean, hasCapacity: boolean }}
 */
export function compareLuggageToVehicle(luggage = {}, vehicle = null) {
  const equivalent = luggageEquivalent(luggage);
  const capacity = vehicle && typeof vehicle.luggage_capacity === "number"
    ? vehicle.luggage_capacity
    : null;
  const hasCapacity = capacity !== null;
  return {
    equivalent,
    capacity,
    hasCapacity,
    exceeds: hasCapacity ? equivalent > capacity : false,
  };
}

export function summarizeLuggage(luggage = {}) {
  const parts = [];
  const small = Number(luggage.luggage_small_bags) || 0;
  const standard = Number(luggage.luggage_standard_bags) || 0;
  const large = Number(luggage.luggage_large_suitcases) || 0;
  const oversized = Number(luggage.luggage_oversized_items) || 0;
  if (small) parts.push(`${small} small`);
  if (standard) parts.push(`${standard} standard`);
  if (large) parts.push(`${large} large`);
  if (oversized) parts.push(`${oversized} oversized`);
  const cat = weightCategoryLabel(luggage.luggage_weight_category);
  const summary = parts.length ? parts.join(", ") : "No luggage";
  return cat ? `${summary} · ${cat}` : summary;
}