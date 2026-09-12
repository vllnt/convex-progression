import { v } from "convex/values";
import { query } from "./_generated/server";
import { levelForXp } from "../shared";
import { progressState } from "./validators";
import { parseThresholds, requireRef } from "./validation";

export const get = query({
  args: {
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.optional(v.array(v.number())),
  },
  returns: v.union(v.null(), progressState),
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.key, "key");
    requireRef(args.scope, "scope");
    if (args.thresholds !== undefined) {
      parseThresholds(args.thresholds);
    }
    const row = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", args.scope)
          .eq("subjectRef", args.subjectRef)
          .eq("key", args.key),
      )
      .first();
    if (row === null) {
      return null;
    }
    return {
      lastPeriodKey: row.lastPeriodKey,
      level:
        args.thresholds === undefined
          ? row.level
          : levelForXp(row.xp, args.thresholds),
      maxStreak: row.maxStreak,
      streak: row.streak,
      updatedAt: row.updatedAt,
      xp: row.xp,
    };
  },
});
