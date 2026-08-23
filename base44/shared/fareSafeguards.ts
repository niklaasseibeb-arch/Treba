/**
 * Treba fare negotiation safeguards.
 *
 * Administrators may configure optional minimum/maximum transaction rules.
 * These are operational safeguards ONLY and are NEVER presented to users as a
 * Treba fare estimate, suggested fare, or fare range. The fare is determined
 * exclusively through negotiation between passenger and driver.
 *
 * Returns an error message string if the fare breaches an active safeguard,
 * or null if the fare is acceptable (or no safeguard is configured).
 */
export async function checkFareSafeguards(admin, fare) {
  try {
    const configs = await admin.entities.FareNegotiationConfig.list('-created_date', 50);
    const active = (configs || []).find((c) => c.is_active);
    if (!active) return null;
    const min = Number(active.min_amount);
    const max = Number(active.max_amount);
    if (isFinite(min) && min > 0 && fare < min) {
      return 'This offer is outside the permitted transaction range. Please adjust your offer.';
    }
    if (isFinite(max) && max > 0 && fare > max) {
      return 'This offer is outside the permitted transaction range. Please adjust your offer.';
    }
    return null;
  } catch (e) {
    return null;
  }
}