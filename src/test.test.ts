import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { register } from "./test";

test("register accepts a different host schema and custom component name", async () => {
  const host = defineSchema({ unrelated: defineTable({ title: v.string() }) });
  const t = convexTest(host, import.meta.glob("./component/**/*.ts"));
  register(t, "alternate");
  const loaders: (() => Promise<unknown>)[] = [];
  register({
    registerComponent: (name, componentSchema, modules) => {
      expect(name).toBe("progression");
      expect(componentSchema).toBeDefined();
      expect(Object.keys(modules).length).toBeGreaterThan(0);
      loaders.push(...Object.values(modules));
    },
  });
  await Promise.all(loaders.map((load) => load()));
  await t.run(async (ctx) => {
    const id = await ctx.db.insert("unrelated", { title: "host owned" });
    const row = await ctx.db.get("unrelated", id);
    expect(row?.title).toBe("host owned");
  });
});
