import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { clampEraseBatch, levelForXp, MAX_ERASE_BATCH } from "../../src/shared";
import { register } from "../../src/test";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

const thresholds = [10, 30, 60];

describe("progression — xp / level", () => {
  test("accrue crosses a threshold", async () => {
    const t = setup();
    const first = await t.mutation(api.example.accrue, {
      delta: 10,
      key: "solo",
      subjectRef: "u1",
      thresholds,
    });
    expect(first).toMatchObject({
      level: 1,
      leveledUp: true,
      previousLevel: 0,
      xp: 10,
    });
    const second = await t.mutation(api.example.accrue, {
      delta: 5,
      key: "solo",
      subjectRef: "u1",
      thresholds,
    });
    expect(second).toMatchObject({ level: 1, leveledUp: false, xp: 15 });
    const got = await t.query(api.example.get, {
      key: "solo",
      subjectRef: "u1",
    });
    expect(got?.xp).toBe(15);
  });

  test("get missing is null", async () => {
    const t = setup();
    expect(
      await t.query(api.example.get, { key: "solo", subjectRef: "no" }),
    ).toBeNull();
  });

  test("get recomputes level from host thresholds", async () => {
    const t = setup();
    await t.mutation(api.example.accrue, {
      delta: 10,
      key: "solo",
      subjectRef: "u1",
      thresholds: [10],
    });
    const got = await t.query(api.example.get, {
      key: "solo",
      subjectRef: "u1",
      thresholds: [100],
    });
    expect(got?.xp).toBe(10);
    expect(got?.level).toBe(0);
  });

  test("reset deletes a row and is idempotent", async () => {
    const t = setup();
    await t.mutation(api.example.accrue, {
      delta: 10,
      key: "solo",
      subjectRef: "u1",
      thresholds,
    });
    expect(
      await t.mutation(api.example.reset, { key: "solo", subjectRef: "u1" }),
    ).toBeNull();
    expect(
      await t.query(api.example.get, { key: "solo", subjectRef: "u1" }),
    ).toBeNull();
    expect(
      await t.mutation(api.example.reset, { key: "solo", subjectRef: "u1" }),
    ).toBeNull();
  });

  test("eraseSubject", async () => {
    const t = setup();
    await t.mutation(api.example.accrue, {
      delta: 1,
      key: "a",
      subjectRef: "u1",
      thresholds: [],
    });
    await t.mutation(api.example.accrue, {
      delta: 1,
      key: "b",
      subjectRef: "u1",
      thresholds: [],
    });
    expect(
      await t.mutation(api.example.eraseSubject, {
        batch: 1,
        subjectRef: "u1",
      }),
    ).toBe(1);
    expect(
      await t.mutation(api.example.eraseSubject, { subjectRef: "u1" }),
    ).toBe(1);
  });
});

describe("progression — streaks", () => {
  test("first activity starts a streak of 1", async () => {
    const t = setup();
    const r = await t.mutation(api.example.recordActivity, {
      key: "solo",
      periodKey: "2026-06-15",
      subjectRef: "u1",
      thresholds: [],
    });
    expect(r).toMatchObject({ maxStreak: 1, streak: 1, streakDelta: 1 });
  });

  test("same period is a no-op", async () => {
    const t = setup();
    await t.mutation(api.example.recordActivity, {
      key: "solo",
      periodKey: "d1",
      subjectRef: "u1",
      thresholds: [],
    });
    const r = await t.mutation(api.example.recordActivity, {
      key: "solo",
      periodKey: "d1",
      subjectRef: "u1",
      thresholds: [],
    });
    expect(r.streakDelta).toBe(0);
    expect(r.streak).toBe(1);
  });

  test("consecutive period increments", async () => {
    const t = setup();
    await t.mutation(api.example.recordActivity, {
      key: "solo",
      periodKey: "d1",
      subjectRef: "u1",
      thresholds: [],
    });
    const r = await t.mutation(api.example.recordActivity, {
      expectedPrevious: "d1",
      key: "solo",
      periodKey: "d2",
      subjectRef: "u1",
      thresholds: [],
    });
    expect(r.streak).toBe(2);
    expect(r.maxStreak).toBe(2);
  });

  test("a gap resets the streak", async () => {
    const t = setup();
    await t.mutation(api.example.recordActivity, {
      key: "solo",
      periodKey: "d1",
      subjectRef: "u1",
      thresholds: [],
    });
    const r = await t.mutation(api.example.recordActivity, {
      expectedPrevious: "d4",
      key: "solo",
      periodKey: "d5",
      subjectRef: "u1",
      thresholds: [],
    });
    expect(r.streak).toBe(1);
  });
});

describe("progression — validation and scope", () => {
  test("rejects empty refs, non-positive delta, bad thresholds", async () => {
    const t = setup();
    await expect(
      t.mutation(api.example.accrue, {
        delta: 1,
        key: "solo",
        subjectRef: "",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        delta: 1,
        key: "",
        subjectRef: "u1",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        delta: 0,
        key: "solo",
        subjectRef: "u1",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        delta: 1,
        key: "solo",
        subjectRef: "u1",
        thresholds: [10, 5],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        delta: 1,
        key: "solo",
        subjectRef: "u1",
        thresholds: [-1],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.recordActivity, {
        key: "solo",
        periodKey: "",
        subjectRef: "u1",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.recordActivity, {
        key: "solo",
        periodKey: "d",
        subjectRef: "",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.recordActivity, {
        key: "",
        periodKey: "d",
        subjectRef: "u1",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.reset, { key: "solo", subjectRef: "" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.reset, { key: "", subjectRef: "u1" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.eraseSubject, { subjectRef: "" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.eraseSubject, { batch: 0, subjectRef: "u1" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.eraseSubject, { batch: 1.5, subjectRef: "u1" }),
    ).rejects.toThrow();
    expect(
      await t.mutation(api.example.eraseSubject, {
        batch: 10_000,
        subjectRef: "nobody",
      }),
    ).toBe(0);
    await expect(
      t.mutation(api.example.recordActivity, {
        key: "solo",
        periodKey: "d",
        subjectRef: "u1",
        thresholds: [1, 1],
      }),
    ).rejects.toThrow();
  });

  test("tenant scope is isolated", async () => {
    const t = setup();
    await t.mutation(api.example.accrueTenant, {
      delta: 10,
      key: "solo",
      subjectRef: "u1",
      thresholds,
    });
    expect(
      await t.query(api.example.get, { key: "solo", subjectRef: "u1" }),
    ).toBeNull();
  });
});

describe("levelForXp", () => {
  test("empty thresholds stay at 0", () => {
    expect(levelForXp(100, [])).toBe(0);
  });
  test("counts reached thresholds", () => {
    expect(levelForXp(30, [10, 30, 60])).toBe(2);
    expect(levelForXp(9, [10, 30])).toBe(0);
  });
});

describe("clampEraseBatch", () => {
  test("clamps and rejects", () => {
    expect(clampEraseBatch(10)).toBe(10);
    expect(clampEraseBatch(MAX_ERASE_BATCH + 1)).toBe(MAX_ERASE_BATCH);
    expect(() => clampEraseBatch(0)).toThrow();
  });
});
