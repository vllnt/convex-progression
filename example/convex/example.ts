import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { Progression } from "../../src/client";
import { accrueResult, activityResult, progressState } from "../../src/component/validators";

const progression = new Progression(components.progression);
const tenant = new Progression(components.progression, { defaultScope: "tenant" });

export const accrue = mutation({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    delta: v.number(),
    thresholds: v.array(v.number()),
    scope: v.optional(v.string()),
  },
  returns: accrueResult,
  handler: (ctx, a) =>
    progression.accrue(ctx, a.subjectRef, a.key, a.delta, a.thresholds, a.scope),
});

export const recordActivity = mutation({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    periodKey: v.string(),
    thresholds: v.array(v.number()),
    expectedPrevious: v.optional(v.string()),
    scope: v.optional(v.string()),
  },
  returns: activityResult,
  handler: (ctx, a) =>
    progression.recordActivity(ctx, a.subjectRef, a.key, a.periodKey, a.thresholds, {
      expectedPrevious: a.expectedPrevious,
      scope: a.scope,
    }),
});

export const get = query({
  args: {
    key: v.string(),
    scope: v.optional(v.string()),
    subjectRef: v.string(),
    thresholds: v.optional(v.array(v.number())),
  },
  returns: v.union(v.null(), progressState),
  handler: (ctx, a) =>
    progression.get(ctx, a.subjectRef, a.key, a.scope, a.thresholds),
});

export const reset = mutation({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    scope: v.optional(v.string()),
  },
  returns: v.null(),
  handler: (ctx, a) => progression.reset(ctx, a.subjectRef, a.key, a.scope),
});

export const eraseSubject = mutation({
  args: {
    batch: v.optional(v.number()),
    scope: v.optional(v.string()),
    subjectRef: v.string(),
  },
  returns: v.number(),
  handler: (ctx, a) =>
    progression.eraseSubject(ctx, a.subjectRef, a.scope, a.batch),
});

export const accrueTenant = mutation({
  args: {
    subjectRef: v.string(),
    key: v.string(),
    delta: v.number(),
    thresholds: v.array(v.number()),
  },
  returns: accrueResult,
  handler: (ctx, a) => tenant.accrue(ctx, a.subjectRef, a.key, a.delta, a.thresholds),
});
