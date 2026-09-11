import { v } from "convex/values";
import { query } from "./_generated/server";
import { levelForXp } from "../shared";
import { progressState } from "./validators";

export const get = query({
  args: {
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.optional(v.array(v.number())),
  },
  returns: v.union(v.null(), progressState),
  handler: async (ctx, args) => {
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
