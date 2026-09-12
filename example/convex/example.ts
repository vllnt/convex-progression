import { v } from "convex/values";

import { Progression } from "../../src/client";
import {
  accrueResult,
  activityResult,
  progressState,
} from "../../src/component/validators";

import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";

const progression = new Progression(components.progression);
const secondary = new Progression(components.secondary);

export const accrueSecondary = mutation({
  args: { key: v.string(), subjectRef: v.string() },
  handler: (ctx, a) => secondary.accrue(ctx, a.subjectRef, a.key, 7, []),
  returns: accrueResult,
});

export const getSecondary = query({
  args: { key: v.string(), subjectRef: v.string() },
  handler: (ctx, a) => secondary.get(ctx, a.subjectRef, a.key),
  returns: v.union(v.null(), progressState),
});
const tenant = new Progression(components.progression, {
  defaultScope: "tenant",
});

export const accrue = mutation({
  args: {
    delta: v.number(),
    key: v.string(),
    scope: v.optional(v.string()),
    subjectRef: v.string(),
    thresholds: v.array(v.number()),
  },
  handler: (ctx, a) =>
    progression.accrue(
      ctx,
      a.subjectRef,
      a.key,
      a.delta,
      a.thresholds,
      a.scope,
    ),
  returns: accrueResult,
});

export const recordActivity = mutation({
  args: {
    expectedPrevious: v.optional(v.string()),
    key: v.string(),
    periodKey: v.string(),
    scope: v.optional(v.string()),
    subjectRef: v.string(),
    thresholds: v.array(v.number()),
  },
  handler: (ctx, a) =>
    progression.recordActivity(
      ctx,
      a.subjectRef,
      a.key,
      a.periodKey,
      a.thresholds,
      {
        expectedPrevious: a.expectedPrevious,
        scope: a.scope,
      },
    ),
  returns: activityResult,
});

export const get = query({
  args: {
    key: v.string(),
    scope: v.optional(v.string()),
    subjectRef: v.string(),
    thresholds: v.optional(v.array(v.number())),
  },
  handler: (ctx, a) =>
    progression.get(ctx, a.subjectRef, a.key, a.scope, a.thresholds),
  returns: v.union(v.null(), progressState),
});

export const reset = mutation({
  args: {
    key: v.string(),
    scope: v.optional(v.string()),
    subjectRef: v.string(),
  },
  handler: (ctx, a) => progression.reset(ctx, a.subjectRef, a.key, a.scope),
  returns: v.null(),
});

export const eraseSubject = mutation({
  args: {
    batch: v.optional(v.number()),
    scope: v.optional(v.string()),
    subjectRef: v.string(),
  },
  handler: (ctx, a) =>
    progression.eraseSubject(ctx, a.subjectRef, a.scope, a.batch),
  returns: v.number(),
});

export const accrueTenant = mutation({
  args: {
    delta: v.number(),
    key: v.string(),
    subjectRef: v.string(),
    thresholds: v.array(v.number()),
  },
  handler: (ctx, a) =>
    tenant.accrue(ctx, a.subjectRef, a.key, a.delta, a.thresholds),
  returns: accrueResult,
});
