import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const base = { key: "k", scope: "global", subjectRef: "s" };

test("duplicate logical rows fail closed for reads, awards, activity and reset", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const row = {
      ...base,
      level: 0,
      maxStreak: 0,
      streak: 0,
      updatedAt: 0,
      xp: 1,
    };
    await ctx.db.insert("progress", row);
    await ctx.db.insert("progress", row);
  });
  await expect(t.query(api.queries.get, base)).rejects.toThrow();
  await expect(
    t.mutation(api.mutations.accrue, { ...base, delta: 1, thresholds: [] }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.mutations.recordActivity, {
      ...base,
      periodKey: "d1",
      thresholds: [],
    }),
  ).rejects.toThrow();
  await expect(t.mutation(api.mutations.reset, base)).rejects.toThrow();
  const rows = await t.run(async (ctx) => ctx.db.query("progress").collect());
  expect(rows).toHaveLength(2);
});

test("late replay rewinds opaque periods: hosts must enforce ordering", async () => {
  const t = convexTest(schema, modules);
  const activity = { ...base, thresholds: [] };
  await t.mutation(api.mutations.recordActivity, {
    ...activity,
    periodKey: "d1",
  });
  await t.mutation(api.mutations.recordActivity, {
    ...activity,
    expectedPrevious: "d1",
    periodKey: "d2",
  });
  const late = await t.mutation(api.mutations.recordActivity, {
    ...activity,
    periodKey: "d1",
  });
  expect(late).toMatchObject({ lastPeriodKey: "d1", maxStreak: 2, streak: 1 });
  const replay = await t.mutation(api.mutations.recordActivity, {
    ...activity,
    expectedPrevious: "d1",
    periodKey: "d2",
  });
  expect(replay).toMatchObject({ streak: 2, streakDelta: 1 });
});

test("erase can delete a recreation before draining; later writes survive without a host fence", async () => {
  vi.useFakeTimers();
  try {
    const t = convexTest(schema, modules);
    const award = { ...base, delta: 1, thresholds: [] };
    await t.mutation(api.mutations.accrue, award);
    await t.mutation(api.mutations.eraseSubject, {
      batch: 1,
      scope: base.scope,
      subjectRef: base.subjectRef,
    });
    await t.mutation(api.mutations.accrue, award);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.queries.get, base)).toBeNull();
    await t.mutation(api.mutations.accrue, award);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const recreated = await t.query(api.queries.get, base);
    expect(recreated?.xp).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});
