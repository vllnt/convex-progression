import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { components } from "../example/convex/_generated/api.js";

import { register } from "./test.js";

const modules = import.meta.glob("./component/**/*.ts");

test("register accepts a different host schema and custom component name", async () => {
  const host = defineSchema({ unrelated: defineTable({ title: v.string() }) });
  const t = convexTest(host, modules);
  register(t, "alternate");
  const loaders: (() => Promise<unknown>)[] = [];
  register({
    registerComponent: (name, componentSchema, modules) => {
      expect(name).toBe("progression");
      expect(componentSchema).toBeDefined();
      expect(Object.keys(modules).length).toBeGreaterThan(0);
      loaders.push(...Object.values(modules));
      // The real API returns the component's function references.
      return undefined as never;
    },
  });
  await Promise.all(loaders.map((load) => load()));
  await t.run(async (ctx) => {
    const id = await ctx.db.insert("unrelated", { title: "host owned" });
    const row = await ctx.db.get("unrelated", id);
    expect(row?.title).toBe("host owned");
  });
});

test("register mounts a callable component next to host tables", async () => {
  const hostSchema = defineSchema({ notes: defineTable({ body: v.string() }) });
  const t = convexTest(hostSchema, modules);
  register(t);
  const { progression } = components;
  const ref = { key: "k", scope: "global", subjectRef: "u1" };
  const awarded = await t.mutation(progression.mutations.accrue, {
    ...ref,
    delta: 10,
    thresholds: [10],
  });
  expect(awarded).toMatchObject({ level: 1, leveledUp: true, xp: 10 });
  expect(await t.query(progression.queries.get, ref)).toMatchObject({
    xp: 10,
  });
  await t.run(async (ctx) => {
    const id = await ctx.db.insert("notes", { body: "host owned" });
    const note = await ctx.db.get("notes", id);
    expect(note?.body).toBe("host owned");
  });
});
