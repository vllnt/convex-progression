import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api.js";
import type * as Server from "./_generated/server.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

const writes = vi.hoisted((): string[] => []);

vi.mock("./_generated/server.js", async (importOriginal) => {
  const original = await importOriginal<typeof Server>();
  const WRITE_METHODS = new Set(["delete", "insert", "patch", "replace"]);
  function countingDatabase<T extends object>(database: T): T {
    return new Proxy(database, {
      get(target, property, receiver) {
        const value: unknown = Reflect.get(target, property, receiver);
        if (typeof value !== "function") {
          return value;
        }
        return (...callArguments: unknown[]) => {
          if (typeof property === "string" && WRITE_METHODS.has(property)) {
            writes.push(`${property}:${String(callArguments[0])}`);
          }
          const result: unknown = Reflect.apply(value, target, callArguments);
          return result;
        };
      },
    });
  }
  const mutation: typeof original.mutation = (definition) => {
    if (typeof definition === "function") {
      return original.mutation((ctx, ...arguments_) =>
        definition({ ...ctx, db: countingDatabase(ctx.db) }, ...arguments_),
      );
    }
    return original.mutation({
      ...definition,
      handler: (ctx, ...arguments_) =>
        definition.handler(
          { ...ctx, db: countingDatabase(ctx.db) },
          ...arguments_,
        ),
    });
  };
  return { ...original, mutation };
});
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

test("a same-period repeat performs zero writes and preserves xp and the historical maxStreak", async () => {
  const t = convexTest(schema, modules);
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
    await t.mutation(api.mutations.recordActivity, {
      ...base,
      expectedPrevious,
      periodKey,
      thresholds: [5],
    });
  }
  const before = await t.query(api.queries.get, base);
  expect(before).toMatchObject({
    lastPeriodKey: "d9",
    level: 1,
    maxStreak: 3,
    streak: 1,
    xp: 7,
  });
  writes.length = 0;
  const repeat = await t.mutation(api.mutations.recordActivity, {
    ...base,
    expectedPrevious: "d8",
    periodKey: "d9",
    thresholds: [5],
  });
  expect(writes).toEqual([]);
  expect(repeat).toEqual({ ...before, streakDelta: 0 });
});
