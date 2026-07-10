/**
 * Shared distance formatting and conversion utilities.
 * Used everywhere steps or GPS distances are displayed.
 */

/**
 * Format a distance in km as a human-readable string.
 * Shows metres (m) below 1 km and kilometres (km) above.
 *
 * Examples:
 *   0.034  → "34 m"
 *   0.75   → "750 m"
 *   1.25   → "1.25 km"
 *   12.5   → "12.50 km"
 */
export const formatDistance = (km: number): string => {
  if (!km || km <= 0) return '0 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
};

/**
 * Convert a step count to approximate walking distance in km.
 * Uses 0.75 m average adult stride length.
 *
 * Examples:
 *   45 steps   → 0.03375 km → "34 m"
 *   3571 steps → 2.678 km   → "2.68 km"
 */
export const stepsToDistanceKm = (steps: number): number => {
  if (!steps || steps <= 0) return 0;
  return (steps * 0.75) / 1000;
};

/**
 * Format steps as a walking distance string.
 * Convenience wrapper over stepsToDistanceKm + formatDistance.
 */
export const formatStepsAsDistance = (steps: number): string =>
  formatDistance(stepsToDistanceKm(steps));
