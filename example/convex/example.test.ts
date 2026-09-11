import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { register } from "../../src/test";
import { clampEraseBatch, levelForXp, MAX_ERASE_BATCH } from "../../src/shared";

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
      subjectRef: "u1",
      key: "solo",
      delta: 10,
      thresholds,
    });
    expect(first).toMatchObject({ xp: 10, level: 1, leveledUp: true, previousLevel: 0 });
    const second = await t.mutation(api.example.accrue, {
      subjectRef: "u1",
      key: "solo",
      delta: 5,
      thresholds,
    });
    expect(second).toMatchObject({ xp: 15, level: 1, leveledUp: false });
    const got = await t.query(api.example.get, { subjectRef: "u1", key: "solo" });
    expect(got?.xp).toBe(15);
  });

  test("get missing is null", async () => {
    const t = setup();
    expect(await t.query(api.example.get, { subjectRef: "no", key: "solo" })).toBeNull();
  });

  test("get recomputes level from host thresholds", async () => {
    const t = setup();
    await t.mutation(api.example.accrue, {
      subjectRef: "u1",
      key: "solo",
      delta: 10,
      thresholds: [10],
    });
    const got = await t.query(api.example.get, {
      subjectRef: "u1",
      key: "solo",
      thresholds: [100],
    });
    expect(got?.xp).toBe(10);
    expect(got?.level).toBe(0);
  });

  test("reset deletes a row and is idempotent", async () => {
    const t = setup();
    await t.mutation(api.example.accrue, {
      subjectRef: "u1",
      key: "solo",
      delta: 10,
      thresholds,
    });
    expect(await t.mutation(api.example.reset, { subjectRef: "u1", key: "solo" })).toBeNull();
    expect(await t.query(api.example.get, { subjectRef: "u1", key: "solo" })).toBeNull();
    expect(await t.mutation(api.example.reset, { subjectRef: "u1", key: "solo" })).toBeNull();
  });

  test("eraseSubject", async () => {
    const t = setup();
    await t.mutation(api.example.accrue, {
      subjectRef: "u1",
      key: "a",
      delta: 1,
      thresholds: [],
    });
    await t.mutation(api.example.accrue, {
      subjectRef: "u1",
      key: "b",
      delta: 1,
      thresholds: [],
    });
    expect(
      await t.mutation(api.example.eraseSubject, { subjectRef: "u1", batch: 1 }),
    ).toBe(1);
    expect(await t.mutation(api.example.eraseSubject, { subjectRef: "u1" })).toBe(1);
  });
});

describe("progression — streaks", () => {
  test("first activity starts a streak of 1", async () => {
    const t = setup();
    const r = await t.mutation(api.example.recordActivity, {
      subjectRef: "u1",
      key: "solo",
      periodKey: "2026-06-15",
      thresholds: [],
    });
    expect(r).toMatchObject({ streak: 1, maxStreak: 1, streakDelta: 1 });
  });

  test("same period is a no-op", async () => {
    const t = setup();
    await t.mutation(api.example.recordActivity, {
      subjectRef: "u1",
      key: "solo",
      periodKey: "d1",
      thresholds: [],
    });
    const r = await t.mutation(api.example.recordActivity, {
      subjectRef: "u1",
      key: "solo",
      periodKey: "d1",
      thresholds: [],
    });
    expect(r.streakDelta).toBe(0);
    expect(r.streak).toBe(1);
  });

  test("consecutive period increments", async () => {
    const t = setup();
    await t.mutation(api.example.recordActivity, {
      subjectRef: "u1",
      key: "solo",
      periodKey: "d1",
      thresholds: [],
    });
    const r = await t.mutation(api.example.recordActivity, {
      subjectRef: "u1",
      key: "solo",
      periodKey: "d2",
      expectedPrevious: "d1",
      thresholds: [],
    });
    expect(r.streak).toBe(2);
    expect(r.maxStreak).toBe(2);
  });

  test("a gap resets the streak", async () => {
    const t = setup();
    await t.mutation(api.example.recordActivity, {
      subjectRef: "u1",
      key: "solo",
      periodKey: "d1",
      thresholds: [],
    });
    const r = await t.mutation(api.example.recordActivity, {
      subjectRef: "u1",
      key: "solo",
      periodKey: "d5",
      expectedPrevious: "d4",
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
        subjectRef: "",
        key: "solo",
        delta: 1,
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        subjectRef: "u1",
        key: "",
        delta: 1,
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        subjectRef: "u1",
        key: "solo",
        delta: 0,
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        subjectRef: "u1",
        key: "solo",
        delta: 1,
        thresholds: [10, 5],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.accrue, {
        subjectRef: "u1",
        key: "solo",
        delta: 1,
        thresholds: [-1],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.recordActivity, {
        subjectRef: "u1",
        key: "solo",
        periodKey: "",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.recordActivity, {
        subjectRef: "",
        key: "solo",
        periodKey: "d",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.recordActivity, {
        subjectRef: "u1",
        key: "",
        periodKey: "d",
        thresholds: [],
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.reset, { subjectRef: "", key: "solo" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.reset, { subjectRef: "u1", key: "" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.eraseSubject, { subjectRef: "" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.eraseSubject, { subjectRef: "u1", batch: 0 }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.example.eraseSubject, { subjectRef: "u1", batch: 1.5 }),
    ).rejects.toThrow();
    expect(
      await t.mutation(api.example.eraseSubject, {
        subjectRef: "nobody",
        batch: 10_000,
      }),
    ).toBe(0);
    await expect(
      t.mutation(api.example.recordActivity, {
        subjectRef: "u1",
        key: "solo",
        periodKey: "d",
        thresholds: [1, 1],
      }),
    ).rejects.toThrow();
  });

  test("tenant scope is isolated", async () => {
    const t = setup();
    await t.mutation(api.example.accrueTenant, {
      subjectRef: "u1",
      key: "solo",
      delta: 10,
      thresholds,
    });
    expect(await t.query(api.example.get, { subjectRef: "u1", key: "solo" })).toBeNull();
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
