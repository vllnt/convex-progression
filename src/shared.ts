/** Shared constants used by both `client/` and `component/`. */

export const COMPONENT_NAME = "progression";

/** Default namespace when the host does not scope progress. */
export const DEFAULT_SCOPE = "global";

/**
 * Level is the count of thresholds the current XP has reached.
 * `thresholds` must be strictly increasing non-negative numbers.
 */
export function levelForXp(xp: number, thresholds: number[]): number {
  let level = 0;
  for (const threshold of thresholds) {
    if (xp >= threshold) {
      level += 1;
    } else {
      break;
    }
  }
  return level;
}

export function assertThresholds(thresholds: number[]): void {
  let previous: number | undefined;
  for (const threshold of thresholds) {
    if (!Number.isFinite(threshold) || threshold < 0) {
      throw new Error("INVALID_THRESHOLDS: thresholds must be finite and ≥ 0");
    }
    if (previous !== undefined && threshold <= previous) {
      throw new Error("INVALID_THRESHOLDS: thresholds must be strictly increasing");
    }
    previous = threshold;
  }
}
