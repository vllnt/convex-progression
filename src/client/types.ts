/** Public TypeScript surface for the progression client. */

/**
 * One progress row: XP total, level, current and best streak, the last
 * recorded period and the last write time (ms since epoch).
 */
export type ProgressState = {
  lastPeriodKey?: string;
  level: number;
  maxStreak: number;
  streak: number;
  updatedAt: number;
  xp: number;
};

/**
 * What adding XP returns: the new state plus `previousLevel` (the stored
 * level before this call) and `leveledUp` (`level > previousLevel`).
 */
export type AccrueResult = {
  leveledUp: boolean;
  previousLevel: number;
} & ProgressState;

/**
 * Result of `recordActivity`: the new state plus `streakDelta`, `0` for the
 * stored period and `1` for any new period. The stored period again with an
 * unchanged `level` returns the stored row, with the stored `updatedAt`.
 */
export type ActivityResult = {
  streakDelta: number;
} & ProgressState;

/** Client options. `defaultScope` defaults to `"global"`. */
export type ProgressionOptions = {
  defaultScope?: string;
};
