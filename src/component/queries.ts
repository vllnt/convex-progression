import { v } from "convex/values";
import { query } from "./_generated/server";
import { progressState } from "./validators";

export const get = query({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    scope: v.string(),
  },
  returns: v.union(v.null(), progressState),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q.eq("scope", args.scope).eq("subjectRef", args.subjectRef).eq("key", args.key),
      )
      .unique();
    if (row === null) {
      return null;
    }
    return {
      xp: row.xp,
      level: row.level,
      streak: row.streak,
      maxStreak: row.maxStreak,
      lastPeriodKey: row.lastPeriodKey,
      updatedAt: row.updatedAt,
    };
  },
});
