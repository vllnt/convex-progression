import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation } from "./_generated/server";
import {
  DEFAULT_ERASE_BATCH,
  MAX_ERASE_BATCH,
  levelForXp,
} from "../shared";
import { accrueResult, activityResult } from "./validators";

import { fail, parseThresholds, requireRef } from "./validation";

export const accrue = mutation({
  args: {
    delta: v.number(),
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.array(v.number()),
  },
  returns: accrueResult,
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.key, "key");
    requireRef(args.scope, "scope");
    if (!Number.isFinite(args.delta) || args.delta <= 0 || args.delta > Number.MAX_SAFE_INTEGER) {
      fail("INVALID_DELTA", "delta must be positive and at most MAX_SAFE_INTEGER");
    }
    const thresholds = parseThresholds(args.thresholds);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", args.scope)
          .eq("subjectRef", args.subjectRef)
          .eq("key", args.key),
      )
      .first();
    const now = Date.now();
    const previousLevel = existing?.level ?? 0;
    const xp = (existing?.xp ?? 0) + args.delta;
    if (!Number.isFinite(xp) || xp > Number.MAX_SAFE_INTEGER || xp <= (existing?.xp ?? 0)) {
      fail("XP_OVERFLOW", "XP exceeds the safe bound or delta is lost to floating-point precision");
    }
    const level = levelForXp(xp, thresholds);
    const row = {
      lastPeriodKey: existing?.lastPeriodKey,
      level,
      maxStreak: existing?.maxStreak ?? 0,
      streak: existing?.streak ?? 0,
      updatedAt: now,
      xp,
    };
    if (existing === null) {
      await ctx.db.insert("progress", {
        key: args.key,
        scope: args.scope,
        subjectRef: args.subjectRef,
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
    expectedPrevious: v.optional(v.string()),
    key: v.string(),
    periodKey: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.array(v.number()),
  },
  returns: activityResult,
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.key, "key");
    requireRef(args.scope, "scope");
    requireRef(args.periodKey, "periodKey");
    if (args.expectedPrevious !== undefined) {
      requireRef(args.expectedPrevious, "expectedPrevious");
    }
    const thresholds = parseThresholds(args.thresholds);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", args.scope)
          .eq("subjectRef", args.subjectRef)
          .eq("key", args.key),
      )
      .first();
    const now = Date.now();
    const xp = existing?.xp ?? 0;
    const lastPeriodKey = existing?.lastPeriodKey;
    const samePeriod = lastPeriodKey === args.periodKey;
    const consecutive =
      lastPeriodKey !== undefined && lastPeriodKey === args.expectedPrevious;
    const streak =
      samePeriod && existing !== null
        ? existing.streak
        : consecutive && existing !== null
          ? existing.streak + 1
          : 1;
    if (!Number.isSafeInteger(streak)) {
      fail("STREAK_OVERFLOW", "streak exceeds MAX_SAFE_INTEGER");
    }
    const streakDelta = samePeriod ? 0 : 1;
    const row = {
      lastPeriodKey: args.periodKey,
      level: levelForXp(xp, thresholds),
      maxStreak: Math.max(existing?.maxStreak ?? 0, streak),
      streak,
      updatedAt: now,
      xp,
    };
    if (existing === null) {
      await ctx.db.insert("progress", {
        key: args.key,
        scope: args.scope,
        subjectRef: args.subjectRef,
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
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.key, "key");
    requireRef(args.scope, "scope");
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", args.scope)
          .eq("subjectRef", args.subjectRef)
          .eq("key", args.key),
      )
      .first();
    if (existing !== null) {
      await ctx.db.delete("progress", existing._id);
    }
    return null;
  },
});

export const eraseSubject = mutation({
  args: {
    batch: v.optional(v.number()),
    scope: v.string(),
    subjectRef: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    requireRef(args.subjectRef, "subjectRef");
    requireRef(args.scope, "scope");
    const raw = args.batch ?? DEFAULT_ERASE_BATCH;
    if (!Number.isInteger(raw)) {
      fail("INVALID_BATCH", "batch must be a positive integer");
    }
    if (raw < 1) {
      fail("INVALID_BATCH", "batch must be a positive integer");
    }
    const batch = Math.min(raw, MAX_ERASE_BATCH);
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q.eq("scope", args.scope).eq("subjectRef", args.subjectRef),
      )
      .take(batch);
    await Promise.all(rows.map((row) => ctx.db.delete("progress", row._id)));
    if (rows.length === batch) {
      await ctx.scheduler.runAfter(0, api.mutations.eraseSubject, {
        batch,
        scope: args.scope,
        subjectRef: args.subjectRef,
      });
    }
    return rows.length;
  },
});
