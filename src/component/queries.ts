import { v } from "convex/values";

import { levelForXp } from "../shared.js";

import { query } from "./_generated/server.js";
import { parseThresholds } from "./validation.js";
import { progressState } from "./validators.js";

export const get = query({
  args: {
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.optional(v.array(v.number())),
  },
  handler: async (ctx, arguments_) => {
    // Refs are not validated here: a reactive query may run with placeholder
    // values (e.g. an empty id), and no row can exist for an invalid ref.
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
