/**
 * Treba luggage helpers — server-side copy used by backend functions.
 * Kept in sync with src/lib/luggage.js (frontend). Backend functions cannot
 * import from src/, so the logic is duplicated here.
 */

export const LUGGAGE_WEIGHT_CATEGORIES = [
  { value: "small_personal", label: "Small personal item" },
  { value: "standard", label: "Standard luggage" },
  { value: "large", label: "Large luggage" },
  { value: "oversized", label: "Oversized/bulky item" },
  { value: "heavy", label: "Heavy luggage" },
];

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