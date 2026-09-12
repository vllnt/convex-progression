/** Shared constants used by both `client/` and `component/`. */

export const COMPONENT_NAME = "progression";

/** Default namespace when the host does not scope progress. */
export const DEFAULT_SCOPE = "global";

export const MAX_REF_LENGTH = 256;
export const DEFAULT_ERASE_BATCH = 200;
export const MAX_ERASE_BATCH = 500;

/**
 * Level is the count of thresholds the current XP has reached.
 * `thresholds` must be strictly increasing non-negative numbers.
 */
export function levelForXp(xp: number, thresholds: readonly number[]): number {
  return thresholds.reduce((level, threshold) => {
    return xp >= threshold ? level + 1 : level;
  }, 0);
}

export function assertThresholds(thresholds: readonly number[]): void {
  thresholds.reduce<number>((previous, threshold) => {
    if (
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > Number.MAX_SAFE_INTEGER
    ) {
      throw new Error(
        "INVALID_THRESHOLDS: thresholds must be finite and in 0..MAX_SAFE_INTEGER",
      );
    }
    if (threshold <= previous) {
      throw new Error(
        "INVALID_THRESHOLDS: thresholds must be strictly increasing",
      );
    }
    return threshold;
  }, -1);
}

export function clampEraseBatch(batch: number): number {
  if (!Number.isInteger(batch) || batch < 1) {
    throw new Error("INVALID_BATCH: batch must be a positive integer");
  }
  return Math.min(batch, MAX_ERASE_BATCH);
}
