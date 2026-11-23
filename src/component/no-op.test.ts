import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");
const base = { key: "k", scope: "global", subjectRef: "s" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
});

afterEach(() => {
  vi.useRealTimers();
});

test("repeat activity in the same period with an unchanged level does not write", async () => {
  const t = convexTest(schema, modules);
  const first = await t.mutation(api.mutations.recordActivity, {
    ...base,
    periodKey: "d1",
    thresholds: [],
  });
  vi.setSystemTime(5000);
  const repeat = await t.mutation(api.mutations.recordActivity, {
    ...base,
    periodKey: "d1",
    thresholds: [],
  });
  expect(repeat).toEqual({ ...first, streakDelta: 0 });
  const state = await t.query(api.queries.get, base);
  expect(state?.updatedAt).toBe(first.updatedAt);
});

test("repeat activity in the same period still writes when the level changes", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.mutations.accrue, { ...base, delta: 5, thresholds: [] });
  const first = await t.mutation(api.mutations.recordActivity, {
    ...base,
    periodKey: "d1",
    thresholds: [],
  });
  vi.setSystemTime(5000);
  const relevelled = await t.mutation(api.mutations.recordActivity, {
    ...base,
    periodKey: "d1",
    thresholds: [1, 3],
  });
  expect(relevelled).toMatchObject({ level: 2, streak: 1, streakDelta: 0 });
  expect(relevelled.updatedAt).toBeGreaterThan(first.updatedAt);
  const state = await t.query(api.queries.get, base);
  expect(state?.level).toBe(2);
});
