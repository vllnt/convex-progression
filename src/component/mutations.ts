import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertThresholds, levelForXp } from "../shared";
import { accrueResult, activityResult } from "./validators";

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

function requireRef(value: string, name: string): void {
  if (value.length === 0) {
    fail("INVALID_REF", `${name} must be a non-empty string`);
  }
}

function parseThresholds(thresholds: number[]): number[] {
  assertThresholds(thresholds);
  return thresholds;
}

export const accrue = mutation({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    scope: v.string(),
    delta: v.number(),
    thresholds: v.array(v.number()),
  },
  returns: accrueResult,
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.key, "key");
    if (!Number.isFinite(args.delta) || args.delta <= 0) {
      fail("INVALID_DELTA", "delta must be a positive finite number");
    }
    const thresholds = parseThresholds(args.thresholds);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q.eq("scope", args.scope).eq("subjectRef", args.subjectRef).eq("key", args.key),
      )
      .unique();
    const now = Date.now();
    const previousLevel = existing?.level ?? 0;
    const xp = (existing?.xp ?? 0) + args.delta;
    const level = levelForXp(xp, thresholds);
    const streak = existing?.streak ?? 0;
    const maxStreak = existing?.maxStreak ?? 0;
    const lastPeriodKey = existing?.lastPeriodKey;
    const row = {
      xp,
      level,
      streak,
      maxStreak,
      lastPeriodKey,
      updatedAt: now,
    };
    if (existing === null) {
      await ctx.db.insert("progress", {
        subjectRef: args.subjectRef,
        key: args.key,
        scope: args.scope,
        ...row,
      });
    } else {
      await ctx.db.patch("progress", existing._id, row);
    }
    return { ...row, leveledUp: level > previousLevel, previousLevel };
  },
});

export const recordActivity = mutation({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    scope: v.string(),
    periodKey: v.string(),
    expectedPrevious: v.optional(v.string()),
    thresholds: v.array(v.number()),
  },
  returns: activityResult,
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.key, "key");
    requireRef(args.periodKey, "periodKey");
    const thresholds = parseThresholds(args.thresholds);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q.eq("scope", args.scope).eq("subjectRef", args.subjectRef).eq("key", args.key),
      )
      .unique();
    const now = Date.now();
    const xp = existing?.xp ?? 0;
    const lastPeriodKey = existing?.lastPeriodKey;
    let streak = existing?.streak ?? 0;
    let streakDelta = 0;
    if (lastPeriodKey === args.periodKey) {
      streakDelta = 0;
    } else if (lastPeriodKey !== undefined && lastPeriodKey === args.expectedPrevious) {
      streak += 1;
      streakDelta = 1;
    } else {
      streak = 1;
      streakDelta = 1;
    }
    const maxStreak = Math.max(existing?.maxStreak ?? 0, streak);
    const row = {
      xp,
      level: levelForXp(xp, thresholds),
      streak,
      maxStreak,
      lastPeriodKey: args.periodKey,
      updatedAt: now,
    };
    if (existing === null) {
      await ctx.db.insert("progress", {
        subjectRef: args.subjectRef,
        key: args.key,
        scope: args.scope,
        ...row,
      });
    } else {
      await ctx.db.patch("progress", existing._id, row);
    }
    return { ...row, streakDelta };
  },
});

export const reset = mutation({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    scope: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.key, "key");
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q.eq("scope", args.scope).eq("subjectRef", args.subjectRef).eq("key", args.key),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.delete("progress", existing._id);
    }
    return null;
  },
});

export const eraseSubject = mutation({
  args: { subjectRef: v.string(), scope: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q.eq("scope", args.scope).eq("subjectRef", args.subjectRef),
      )
      .collect();
    for (const row of rows) {
      await ctx.db.delete("progress", row._id);
    }
    return rows.length;
  },
});
