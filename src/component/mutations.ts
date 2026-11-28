import { v } from "convex/values";

import { levelForXp } from "../shared.js";

import { api } from "./_generated/api.js";
import type { Doc as ProgressDocument } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { mutation } from "./_generated/server.js";
import { fail, parseBatch, parseThresholds, requireRef } from "./validation.js";
import { accrueResult, activityResult } from "./validators.js";

type Ref = { key: string; scope: string; subjectRef: string };
type Progress = ProgressDocument<"progress">;
type ProgressRow = Omit<
  Progress,
  "_creationTime" | "_id" | "key" | "scope" | "subjectRef"
>;

function requireReferences(ref: Ref): void {
  requireRef(ref.subjectRef, "subjectRef");
  requireRef(ref.key, "key");
  requireRef(ref.scope, "scope");
}

function findProgress(ctx: MutationCtx, ref: Ref): Promise<null | Progress> {
  return ctx.db
    .query("progress")
    .withIndex("by_scope_subject_key", (q) =>
      q
        .eq("scope", ref.scope)
        .eq("subjectRef", ref.subjectRef)
        .eq("key", ref.key),
    )
    .unique();
}

async function saveProgress(
  ctx: MutationCtx,
  write: { existing: null | Progress; ref: Ref; row: ProgressRow },
): Promise<void> {
  const { existing, ref, row } = write;
  await (existing === null
    ? ctx.db.insert("progress", {
        key: ref.key,
        scope: ref.scope,
        subjectRef: ref.subjectRef,
        ...row,
      })
    : ctx.db.patch("progress", existing._id, row));
}

function requireDelta(delta: number): void {
  if (
    !Number.isFinite(delta) ||
    delta <= 0 ||
    delta > Number.MAX_SAFE_INTEGER
  ) {
    fail(
      "INVALID_DELTA",
      "delta must be positive and at most MAX_SAFE_INTEGER",
    );
  }
}

function nextXp(previous: number, delta: number): number {
  const xp = previous + delta;
  if (!Number.isFinite(xp) || xp > Number.MAX_SAFE_INTEGER || xp <= previous) {
    fail(
      "XP_OVERFLOW",
      "XP exceeds the safe bound or delta is lost to floating-point precision",
    );
  }
  return xp;
}

function nextStreak(
  existing: null | Progress,
  periodKey: string,
  expectedPrevious: string | undefined,
): number {
  if (existing === null) {
    return 1;
  }
  const { lastPeriodKey, streak } = existing;
  if (lastPeriodKey === periodKey) {
    return streak;
  }
  if (lastPeriodKey !== undefined && lastPeriodKey === expectedPrevious) {
    if (!Number.isSafeInteger(streak + 1)) {
      fail("STREAK_OVERFLOW", "streak exceeds MAX_SAFE_INTEGER");
    }
    return streak + 1;
  }
  return 1;
}

function requireActivityReferences(
  ref: Ref & { expectedPrevious?: string; periodKey: string },
): void {
  requireReferences(ref);
  requireRef(ref.periodKey, "periodKey");
  if (ref.expectedPrevious !== undefined) {
    requireRef(ref.expectedPrevious, "expectedPrevious");
  }
}

/** The stored state when activity repeats the stored period at the same level. */
function unchangedActivity(
  existing: null | Progress,
  periodKey: string,
  level: number,
): null | (ProgressRow & { streakDelta: number }) {
  if (existing?.lastPeriodKey !== periodKey || existing.level !== level) {
    return null;
  }
  return {
    lastPeriodKey: existing.lastPeriodKey,
    level,
    maxStreak: existing.maxStreak,
    streak: existing.streak,
    streakDelta: 0,
    updatedAt: existing.updatedAt,
    xp: existing.xp,
  };
}

export const accrue = mutation({
  args: {
    delta: v.number(),
    key: v.string(),
    scope: v.string(),
    subjectRef: v.string(),
    thresholds: v.array(v.number()),
  },
  handler: async (ctx, arguments_) => {
    requireReferences(arguments_);
    requireDelta(arguments_.delta);
    const thresholds = parseThresholds(arguments_.thresholds);
    const existing = await findProgress(ctx, arguments_);
    const previousLevel = existing?.level ?? 0;
    const xp = nextXp(existing?.xp ?? 0, arguments_.delta);
    const level = levelForXp(xp, thresholds);
    const row = {
      lastPeriodKey: existing?.lastPeriodKey,
      level,
      maxStreak: existing?.maxStreak ?? 0,
      streak: existing?.streak ?? 0,
      updatedAt: Date.now(),
      xp,
    };
    await saveProgress(ctx, { existing, ref: arguments_, row });
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
  handler: async (ctx, arguments_) => {
    requireActivityReferences(arguments_);
    const thresholds = parseThresholds(arguments_.thresholds);
    const existing = await findProgress(ctx, arguments_);
    const xp = existing?.xp ?? 0;
    const level = levelForXp(xp, thresholds);
    const unchanged = unchangedActivity(existing, arguments_.periodKey, level);
    if (unchanged !== null) {
      return unchanged;
    }
    const streak = nextStreak(
      existing,
      arguments_.periodKey,
      arguments_.expectedPrevious,
    );
    const row = {
      lastPeriodKey: arguments_.periodKey,
      level,
      maxStreak: Math.max(existing?.maxStreak ?? 0, streak),
      streak,
      updatedAt: Date.now(),
      xp,
    };
    await saveProgress(ctx, { existing, ref: arguments_, row });
    return {
      ...row,
      streakDelta: existing?.lastPeriodKey === arguments_.periodKey ? 0 : 1,
    };
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
    requireReferences(arguments_);
    const existing = await findProgress(ctx, arguments_);
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
    const batch = parseBatch(arguments_.batch);
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
