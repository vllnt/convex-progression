import { v } from "convex/values";

const progressFields = {
  lastPeriodKey: v.optional(v.string()),
  level: v.number(),
  maxStreak: v.number(),
  streak: v.number(),
  updatedAt: v.number(),
  xp: v.number(),
};

export const progressState = v.object(progressFields);

export const accrueResult = v.object({
  ...progressFields,
  leveledUp: v.boolean(),
  previousLevel: v.number(),
});

export const activityResult = v.object({
  ...progressFields,
  streakDelta: v.number(),
});
