import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");
const base = { key: "k", scope: "global", subjectRef: "s" };
const award = { ...base, delta: 1, thresholds: [] };
const subject = { scope: base.scope, subjectRef: base.subjectRef };
const edge = "y".repeat(256);
const long = "x".repeat(257);

async function errorData(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) {
      return error.data;
    }
    throw error;
  }
  throw new Error("expected a ConvexError");
}

async function countRows(t: ReturnType<typeof convexTest>): Promise<number> {
  const rows = await t.run(async (ctx) => ctx.db.query("progress").collect());
  return rows.length;
}

describe("documented error data", () => {
  test("every code carries exactly the documented { code, message }", async () => {
    const t = convexTest(schema, modules);
    expect(
      await errorData(t.mutation(api.mutations.accrue, { ...award, key: "" })),
    ).toEqual({
      code: "INVALID_REF",
      message: "key must be 1..256 characters",
    });
    expect(
      await errorData(t.mutation(api.mutations.accrue, { ...award, delta: 0 })),
    ).toEqual({
      code: "INVALID_DELTA",
      message: "delta must be positive and at most MAX_SAFE_INTEGER",
    });
    expect(
      await errorData(
        t.mutation(api.mutations.accrue, { ...award, thresholds: [-1] }),
      ),
    ).toEqual({
      code: "INVALID_THRESHOLDS",
      message: "thresholds must be finite and in 0..MAX_SAFE_INTEGER",
    });
    expect(
      await errorData(
        t.query(api.queries.get, { ...base, thresholds: [2, 2] }),
      ),
    ).toEqual({
      code: "INVALID_THRESHOLDS",
      message: "thresholds must be strictly increasing",
    });
    expect(
      await errorData(
        t.mutation(api.mutations.eraseSubject, { ...subject, batch: 0 }),
      ),
    ).toEqual({
      code: "INVALID_BATCH",
      message: "batch must be a positive integer",
    });
    await t.mutation(api.mutations.accrue, {
      ...award,
      delta: Number.MAX_SAFE_INTEGER,
    });
    expect(await errorData(t.mutation(api.mutations.accrue, award))).toEqual({
      code: "XP_OVERFLOW",
      message:
        "XP exceeds the safe bound or delta is lost to floating-point precision",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("progress", {
        ...base,
        key: "days",
        lastPeriodKey: "p",
        level: 0,
        maxStreak: Number.MAX_SAFE_INTEGER,
        streak: Number.MAX_SAFE_INTEGER,
        updatedAt: 0,
        xp: 0,
      });
    });
    expect(
      await errorData(
        t.mutation(api.mutations.recordActivity, {
          ...base,
          expectedPrevious: "p",
          key: "days",
          periodKey: "q",
          thresholds: [],
        }),
      ),
    ).toEqual({
      code: "STREAK_OVERFLOW",
      message: "streak exceeds MAX_SAFE_INTEGER",
    });
  });
});

describe("ref limits", () => {
  test("every mutation accepts 256-character refs and rejects 257", async () => {
    const t = convexTest(schema, modules);
    const wide = { key: edge, scope: edge, subjectRef: edge };
    await t.mutation(api.mutations.accrue, { ...award, ...wide });
    await t.mutation(api.mutations.recordActivity, {
      ...wide,
      expectedPrevious: edge,
      periodKey: edge,
      thresholds: [],
    });
    expect(await t.query(api.queries.get, wide)).toMatchObject({
      lastPeriodKey: edge,
      xp: 1,
    });
    expect(await t.mutation(api.mutations.reset, wide)).toBeNull();
    expect(
      await t.mutation(api.mutations.eraseSubject, {
        scope: edge,
        subjectRef: edge,
      }),
    ).toBe(0);
    for (const field of ["subjectRef", "key", "scope"] as const) {
      const bad = { [field]: long };
      await expect(
        t.mutation(api.mutations.accrue, { ...award, ...bad }),
      ).rejects.toThrow(`${field} must be 1..256 characters`);
      await expect(
        t.mutation(api.mutations.recordActivity, {
          ...base,
          ...bad,
          periodKey: "p",
          thresholds: [],
        }),
      ).rejects.toThrow(`${field} must be 1..256 characters`);
      await expect(
        t.mutation(api.mutations.reset, { ...base, ...bad }),
      ).rejects.toThrow(`${field} must be 1..256 characters`);
    }
    for (const field of ["subjectRef", "scope"] as const) {
      await expect(
        t.mutation(api.mutations.eraseSubject, { ...subject, [field]: long }),
      ).rejects.toThrow(`${field} must be 1..256 characters`);
      await expect(
        t.mutation(api.mutations.eraseSubject, { ...subject, [field]: "" }),
      ).rejects.toThrow(`${field} must be 1..256 characters`);
    }
    const activity = { ...base, periodKey: "p", thresholds: [] };
    for (const field of ["periodKey", "expectedPrevious"] as const) {
      await expect(
        t.mutation(api.mutations.recordActivity, {
          ...activity,
          [field]: long,
        }),
      ).rejects.toThrow(`${field} must be 1..256 characters`);
    }
    expect(await countRows(t)).toBe(0);
  });
});

describe("eraseSubject batches", () => {
  test("rejects every batch that is not a positive integer", async () => {
    const t = convexTest(schema, modules);
    for (const batch of [0, -1, 1.5, Number.NaN, Infinity]) {
      await expect(
        t.mutation(api.mutations.eraseSubject, { ...subject, batch }),
      ).rejects.toThrow("INVALID_BATCH");
    }
  });

  test("defaults to 200, clamps to 500 and scheduled passes drain the rest", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => {
        for (let index = 0; index < 1203; index += 1) {
          await ctx.db.insert("progress", {
            ...base,
            key: `k${String(index)}`,
            level: 0,
            maxStreak: 0,
            streak: 0,
            updatedAt: 0,
            xp: 1,
          });
        }
      });
      expect(await t.mutation(api.mutations.eraseSubject, subject)).toBe(200);
      expect(await countRows(t)).toBe(1003);
      await t.finishInProgressScheduledFunctions();
      vi.runOnlyPendingTimers();
      await t.finishInProgressScheduledFunctions();
      expect(await countRows(t)).toBe(803);
      expect(
        await t.mutation(api.mutations.eraseSubject, {
          ...subject,
          batch: 10_000,
        }),
      ).toBe(500);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await countRows(t)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("accrue and activity stay separate", () => {
  test("accrue keeps the streak fields of an activity row; [0] is level 1 at 0 XP", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.mutations.recordActivity, {
      ...base,
      periodKey: "d1",
      thresholds: [0],
    });
    expect(first).toMatchObject({ level: 1, streak: 1, xp: 0 });
    await t.mutation(api.mutations.recordActivity, {
      ...base,
      expectedPrevious: "d1",
      periodKey: "d2",
      thresholds: [0],
    });
    const awarded = await t.mutation(api.mutations.accrue, {
      ...award,
      delta: 5,
      thresholds: [0, 1, 2],
    });
    expect(awarded).toMatchObject({
      lastPeriodKey: "d2",
      level: 3,
      leveledUp: true,
      maxStreak: 2,
      previousLevel: 1,
      streak: 2,
      xp: 5,
    });
  });
});
