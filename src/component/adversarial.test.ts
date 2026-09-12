import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const base = { key: "k", scope: "global", subjectRef: "s" };
const award = { ...base, delta: 1, thresholds: [] };

describe("adversarial boundaries", () => {
  test("XP cannot overflow or silently discard a positive award", async () => {
    const t = convexTest(schema, modules);
    for (const delta of [
      Number.NaN,
      Infinity,
      -1,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await expect(
        t.mutation(api.mutations.accrue, { ...award, delta }),
      ).rejects.toThrow("INVALID_DELTA");
    }
    await t.mutation(api.mutations.accrue, {
      ...award,
      delta: Number.MAX_SAFE_INTEGER,
    });
    for (const delta of [1, 0.01]) {
      await expect(
        t.mutation(api.mutations.accrue, { ...award, delta }),
      ).rejects.toThrow("XP_OVERFLOW");
    }
    const state = await t.query(api.queries.get, base);
    expect(state?.xp).toBe(Number.MAX_SAFE_INTEGER);
  });

  test("reads validate thresholds even when no row exists", async () => {
    const t = convexTest(schema, modules);
    for (const thresholds of [
      [Number.NaN],
      [Infinity],
      [Number.MAX_SAFE_INTEGER + 1],
      [2, 1],
      [1, 1],
    ]) {
      await expect(
        t.query(api.queries.get, { ...base, thresholds }),
      ).rejects.toThrow("INVALID_THRESHOLDS");
    }
    expect(
      await t.query(api.queries.get, { ...base, thresholds: [] }),
    ).toBeNull();
    for (const field of ["subjectRef", "key", "scope"] as const) {
      for (const value of ["", "x".repeat(257)]) {
        await expect(
          t.query(api.queries.get, { ...base, [field]: value }),
        ).rejects.toThrow("INVALID_REF");
      }
    }
    await expect(
      t.mutation(api.mutations.recordActivity, {
        ...base,
        expectedPrevious: "",
        periodKey: "p",
        thresholds: [],
      }),
    ).rejects.toThrow("INVALID_REF");
  });

  test("streak overflow rejects atomically; fractions remain supported", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.mutations.accrue, {
      ...award,
      delta: 0.5,
      thresholds: [0, 0.5],
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("progress").first();
      if (row === null) throw new Error("missing fixture");
      await ctx.db.patch("progress", row._id, {
        lastPeriodKey: "p",
        streak: Number.MAX_SAFE_INTEGER,
      });
    });
    await expect(
      t.mutation(api.mutations.recordActivity, {
        ...base,
        expectedPrevious: "p",
        periodKey: "q",
        thresholds: [],
      }),
    ).rejects.toThrow("STREAK_OVERFLOW");
    const state = await t.query(api.queries.get, base);
    expect(state?.lastPeriodKey).toBe("p");
  });

  test("scheduled erase drains only the requested partition", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      for (const key of ["a", "b", "c"])
        await t.mutation(api.mutations.accrue, { ...award, key });
      await t.mutation(api.mutations.accrue, { ...award, scope: "other" });
      expect(
        await t.mutation(api.mutations.eraseSubject, {
          batch: 1,
          scope: base.scope,
          subjectRef: base.subjectRef,
        }),
      ).toBe(1);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(
        await t.run(async (ctx) => ctx.db.query("progress").collect()),
      ).toMatchObject([{ scope: "other" }]);
    } finally {
      vi.useRealTimers();
    }
  });
});
