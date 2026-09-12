/** Public TypeScript surface for the progression client. */

export type ProgressState = {
  lastPeriodKey?: string;
  level: number;
  maxStreak: number;
  streak: number;
  updatedAt: number;
  xp: number;
};

export type AccrueResult = {
  leveledUp: boolean;
  previousLevel: number;
} & ProgressState;

export type ActivityResult = {
  streakDelta: number;
} & ProgressState;

export type ProgressionOptions = {
  defaultScope?: string;
};
