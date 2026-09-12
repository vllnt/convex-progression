import type { TestConvex } from "convex-test";

import schema from "./component/schema.js";

const modules = import.meta.glob([
  "./component/**/*.ts",
  "!./component/**/*.test.ts",
]);

export function register(
  t: Pick<TestConvex<typeof schema>, "registerComponent">,
  name = "progression",
): void {
  t.registerComponent(name, schema, modules);
}
