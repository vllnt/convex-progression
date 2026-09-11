/** Public TypeScript surface for the progression client. */

export interface ProgressState {
  xp: number;
  level: number;
  streak: number;
  maxStreak: number;
  lastPeriodKey?: string;
  updatedAt: number;
}

export interface AccrueResult extends ProgressState {
  leveledUp: boolean;
  previousLevel: number;
}

export interface ActivityResult extends ProgressState {
  streakDelta: number;
}

export interface ProgressionOptions {
  defaultScope?: string;
}
