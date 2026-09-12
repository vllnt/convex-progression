import { v } from "convex/values";

import { DEFAULT_ERASE_BATCH, levelForXp, MAX_ERASE_BATCH } from "../shared";

import { api } from "./_generated/api";
import { mutation } from "./_generated/server";
import { fail, parseThresholds, requireRef } from "./validation";
import { accrueResult, activityResult } from "./validators";

export const accrue = mutation({
  args: {
    delta: v.number(),
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.array(v.number()),
  },
  // Keep each atomic transaction readable as one handler.
  // eslint-disable-next-line max-lines-per-function
  handler: async (ctx, arguments_) => {
    requireRef(arguments_.subjectRef, "subjectRef");
    requireRef(arguments_.key, "key");
    requireRef(arguments_.scope, "scope");
    if (
      !Number.isFinite(arguments_.delta) ||
      arguments_.delta <= 0 ||
      arguments_.delta > Number.MAX_SAFE_INTEGER
    ) {
      fail(
        "INVALID_DELTA",
        "delta must be positive and at most MAX_SAFE_INTEGER",
      );
    }
    const thresholds = parseThresholds(arguments_.thresholds);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", arguments_.scope)
          .eq("subjectRef", arguments_.subjectRef)
          .eq("key", arguments_.key),
      )
      .unique();
    const now = Date.now();
    const previousLevel = existing?.level ?? 0;
    const xp = (existing?.xp ?? 0) + arguments_.delta;
    if (
      !Number.isFinite(xp) ||
      xp > Number.MAX_SAFE_INTEGER ||
      xp <= (existing?.xp ?? 0)
    ) {
      fail(
        "XP_OVERFLOW",
        "XP exceeds the safe bound or delta is lost to floating-point precision",
      );
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
    await (existing === null
      ? ctx.db.insert("progress", {
          key: arguments_.key,
          scope: arguments_.scope,
          subjectRef: arguments_.subjectRef,
          ...row,
        })
      : ctx.db.patch("progress", existing._id, row));
    return { ...row, leveledUp: level > previousLevel, previousLevel };
  },
  returns: accrueResult,
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
  // Keep each atomic transaction readable as one handler.
  // eslint-disable-next-line max-lines-per-function
  handler: async (ctx, arguments_) => {
    requireRef(arguments_.subjectRef, "subjectRef");
    requireRef(arguments_.key, "key");
    requireRef(arguments_.scope, "scope");
    requireRef(arguments_.periodKey, "periodKey");
    if (arguments_.expectedPrevious !== undefined) {
      requireRef(arguments_.expectedPrevious, "expectedPrevious");
    }
    const thresholds = parseThresholds(arguments_.thresholds);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", arguments_.scope)
          .eq("subjectRef", arguments_.subjectRef)
          .eq("key", arguments_.key),
      )
      .unique();
    const now = Date.now();
    const xp = existing?.xp ?? 0;
    const lastPeriodKey = existing?.lastPeriodKey;
    const samePeriod = lastPeriodKey === arguments_.periodKey;
    const consecutive =
      lastPeriodKey !== undefined &&
      lastPeriodKey === arguments_.expectedPrevious;
    const continuedStreak =
      consecutive && existing !== null ? existing.streak + 1 : 1;
    const streak =
      samePeriod && existing !== null ? existing.streak : continuedStreak;
    if (!Number.isSafeInteger(streak)) {
      fail("STREAK_OVERFLOW", "streak exceeds MAX_SAFE_INTEGER");
    }
    const streakDelta = samePeriod ? 0 : 1;
    const row = {
      lastPeriodKey: arguments_.periodKey,
      level: levelForXp(xp, thresholds),
      maxStreak: Math.max(existing?.maxStreak ?? 0, streak),
      streak,
      updatedAt: now,
      xp,
    };
    await (existing === null
      ? ctx.db.insert("progress", {
          key: arguments_.key,
          scope: arguments_.scope,
          subjectRef: arguments_.subjectRef,
          ...row,
        })
      : ctx.db.patch("progress", existing._id, row));
    return { ...row, streakDelta };
  },
  returns: activityResult,
});

export const reset = mutation({
  args: {
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
  },
  handler: async (ctx, arguments_) => {
    requireRef(arguments_.subjectRef, "subjectRef");
    requireRef(arguments_.key, "key");
    requireRef(arguments_.scope, "scope");
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_scope_subject_key", (q) =>
        q
          .eq("scope", arguments_.scope)
          .eq("subjectRef", arguments_.subjectRef)
          .eq("key", arguments_.key),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.delete("progress", existing._id);
    }
    return null;
  },
  returns: v.null(),
});

export const eraseSubject = mutation({
  args: {
    batch: v.optional(v.number()),
    scope: v.string(),
    subjectRef: v.string(),
  },
  handler: async (ctx, arguments_) => {
    requireRef(arguments_.subjectRef, "subjectRef");
    requireRef(arguments_.scope, "scope");
    const raw = arguments_.batch ?? DEFAULT_ERASE_BATCH;
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
        q.eq("scope", arguments_.scope).eq("subjectRef", arguments_.subjectRef),
      )
      .take(batch);
    await Promise.all(rows.map((row) => ctx.db.delete("progress", row._id)));
    if (rows.length === batch) {
      await ctx.scheduler.runAfter(0, api.mutations.eraseSubject, {
        batch,
        scope: arguments_.scope,
        subjectRef: arguments_.subjectRef,
      });
    }
    return rows.length;
  },
  returns: v.number(),
});
