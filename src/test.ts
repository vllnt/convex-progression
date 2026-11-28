/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";

import schema from "./component/schema.js";

const modules = import.meta.glob([
  "./component/**/*.ts",
  "!./component/**/*.test.ts",
]);

/**
 * Mounts the component in a `convex-test` instance under `name` (default
 * `"progression"`, the name used by `app.use(config)`). Accepts an instance
 * built from any host schema. Needs Vite's `import.meta.glob`, so run it under
 * Vitest.
 */
export function register(
  t: Pick<TestConvex<typeof schema>, "registerComponent">,
  name = "progression",
): void {
  t.registerComponent(name, schema, modules);
}
