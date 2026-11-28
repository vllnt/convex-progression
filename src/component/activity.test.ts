import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api.js";
import type { Doc as ProgressDocument } from "./_generated/dataModel.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");
const base = { key: "k", scope: "global", subjectRef: "s" };

type Activity = {
  expectedPrevious?: string;
  periodKey: string;
  thresholds: number[];
};
type Test = ReturnType<typeof newTest>;

function newTest() {
  return convexTest(schema, modules);
}

async function record(t: Test, activity: Activity) {
  return t.run(async (ctx) => {
    const result = await ctx.runMutation(api.mutations.recordActivity, {
      ...base,
      ...activity,
    });
    const metrics = await ctx.meta.getTransactionMetrics();
    return { result, writes: metrics.documentsWritten.used };
  });
}

async function storedRow(t: Test): Promise<ProgressDocument<"progress">> {
  const row = await t.run(async (ctx) => ctx.db.query("progress").unique());
  if (row === null) {
    throw new Error("expected one progress row");
  }
  return row;
}

async function historyWithXpAndPastBestStreak(t: Test): Promise<void> {
  await t.mutation(api.mutations.accrue, {
    ...base,
    delta: 7,
    thresholds: [5],
  });
  for (const [periodKey, expectedPrevious] of [
    ["d1", undefined],
    ["d2", "d1"],
    ["d3", "d2"],
    ["d9", "d8"],
  ] as const) {
    vi.advanceTimersByTime(1000);
    await record(t, { expectedPrevious, periodKey, thresholds: [5] });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

test("a same-period repeat with an unchanged level writes nothing and returns the stored row", async () => {
  const t = newTest();
  await historyWithXpAndPastBestStreak(t);
  const before = await storedRow(t);
  expect(before).toMatchObject({
    lastPeriodKey: "d9",
    level: 1,
    maxStreak: 3,
    streak: 1,
    xp: 7,
  });
  vi.advanceTimersByTime(60_000);
  const repeat = await record(t, {
    expectedPrevious: "d8",
    periodKey: "d9",
    thresholds: [5],
  });
  expect(repeat.writes).toBe(0);
  expect(repeat.result).toEqual({
    lastPeriodKey: "d9",
    level: 1,
    maxStreak: 3,
    streak: 1,
    streakDelta: 0,
    updatedAt: before.updatedAt,
    xp: 7,
  });
  expect(await storedRow(t)).toEqual(before);
  expect(await t.query(api.queries.get, base)).toEqual({
    lastPeriodKey: "d9",
    level: 1,
    maxStreak: 3,
    streak: 1,
    updatedAt: before.updatedAt,
    xp: 7,
  });
});

test("a same-period call with a new ladder that changes the level writes the new level and updatedAt", async () => {
  const t = newTest();
  await historyWithXpAndPastBestStreak(t);
  const before = await storedRow(t);
  vi.advanceTimersByTime(60_000);
  const relevelled = await record(t, { periodKey: "d9", thresholds: [1, 3] });
  expect(relevelled.writes).toBe(1);
  expect(relevelled.result).toEqual({
    lastPeriodKey: "d9",
    level: 2,
    maxStreak: 3,
    streak: 1,
    streakDelta: 0,
    updatedAt: before.updatedAt + 60_000,
    xp: 7,
  });
  const after = await storedRow(t);
  expect(after).toEqual({
    ...before,
    level: 2,
    updatedAt: before.updatedAt + 60_000,
  });
});

test("a new period still writes and refreshes updatedAt, both when continuing and when restarting", async () => {
  const t = newTest();
  await historyWithXpAndPastBestStreak(t);
  const before = await storedRow(t);
  vi.advanceTimersByTime(60_000);
  const continued = await record(t, {
    expectedPrevious: "d9",
    periodKey: "d10",
    thresholds: [5],
  });
  expect(continued.writes).toBe(1);
  expect(continued.result).toMatchObject({
    lastPeriodKey: "d10",
    streak: 2,
    streakDelta: 1,
    updatedAt: before.updatedAt + 60_000,
  });
  vi.advanceTimersByTime(60_000);
  const restarted = await record(t, { periodKey: "d20", thresholds: [5] });
  expect(restarted.writes).toBe(1);
  expect(restarted.result).toEqual({
    lastPeriodKey: "d20",
    level: 1,
    maxStreak: 3,
    streak: 1,
    streakDelta: 1,
    updatedAt: before.updatedAt + 120_000,
    xp: 7,
  });
  expect(await storedRow(t)).toMatchObject({
    _id: before._id,
    lastPeriodKey: "d20",
    updatedAt: before.updatedAt + 120_000,
  });
});

test("rows stored by 0.1.x code keep working: same shape, read as stored, written only on change", async () => {
  const t = newTest();
  const state = {
    lastPeriodKey: "d1",
    level: 0,
    maxStreak: 4,
    streak: 2,
    updatedAt: 500,
    xp: 3,
  };
  await t.run(async (ctx) => ctx.db.insert("progress", { ...base, ...state }));
  expect(await t.query(api.queries.get, base)).toEqual(state);
  const repeat = await record(t, { periodKey: "d1", thresholds: [5] });
  expect(repeat).toEqual({ result: { ...state, streakDelta: 0 }, writes: 0 });
  const relevelled = await record(t, { periodKey: "d1", thresholds: [2] });
  expect(relevelled.writes).toBe(1);
  expect(relevelled.result).toMatchObject({ level: 1, streak: 2 });
  expect(relevelled.result.updatedAt).toBeGreaterThan(500);
});

test("a row created by accrue has no stored period, so the first activity writes", async () => {
  const t = newTest();
  await t.mutation(api.mutations.accrue, { ...base, delta: 1, thresholds: [] });
  vi.advanceTimersByTime(1000);
  const first = await record(t, { periodKey: "d1", thresholds: [] });
  expect(first.writes).toBe(1);
  expect(first.result).toMatchObject({
    lastPeriodKey: "d1",
    streak: 1,
    streakDelta: 1,
  });
});

test("a same-period repeat still validates its input before returning the stored row", async () => {
  const t = newTest();
  await record(t, { periodKey: "d1", thresholds: [] });
  await expect(
    record(t, { periodKey: "d1", thresholds: [2, 1] }),
  ).rejects.toThrow("INVALID_THRESHOLDS");
  await expect(
    record(t, { expectedPrevious: "", periodKey: "d1", thresholds: [] }),
  ).rejects.toThrow("INVALID_REF");
});
