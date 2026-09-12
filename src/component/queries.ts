import { v } from "convex/values";

import { levelForXp } from "../shared";

import { query } from "./_generated/server";
import { parseThresholds, requireRef } from "./validation";
import { progressState } from "./validators";

export const get = query({
  args: {
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.optional(v.array(v.number())),
  },
  // Keep boundary validation and indexed read together.
  // eslint-disable-next-line max-lines-per-function
  handler: async (ctx, arguments_) => {
    requireRef(arguments_.subjectRef, "subjectRef");
    requireRef(arguments_.key, "key");
    requireRef(arguments_.scope, "scope");
    if (arguments_.thresholds !== undefined) {
      parseThresholds(arguments_.thresholds);
    }
    const row = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", arguments_.scope)
          .eq("subjectRef", arguments_.subjectRef)
          .eq("key", arguments_.key),
      )
      .unique();
    if (row === null) {
      return null;
    }
    return {
      lastPeriodKey: row.lastPeriodKey,
      level:
        arguments_.thresholds === undefined
          ? row.level
          : levelForXp(row.xp, arguments_.thresholds),
      maxStreak: row.maxStreak,
      streak: row.streak,
      updatedAt: row.updatedAt,
      xp: row.xp,
    };
  },
  returns: v.union(v.null(), progressState),
});
