import { v } from "convex/values";

const progressFields = {
  xp: v.number(),
  level: v.number(),
  streak: v.number(),
  maxStreak: v.number(),
  lastPeriodKey: v.optional(v.string()),
  updatedAt: v.number(),
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
