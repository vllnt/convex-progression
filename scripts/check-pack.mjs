import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "progression-pack-"));
/** @param {string} command @param {string[]} arguments_ @param {string} [cwd] */
const run = (command, arguments_, cwd = directory) =>
  execFileSync(command, arguments_, { cwd, stdio: "inherit" });
try {
  run("pnpm", ["pack", "--pack-destination", directory], process.cwd());
  const tarball = readdirSync(directory).find((name) => name.endsWith(".tgz"));
  assert.ok(tarball);
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      dependencies: {
        "@vllnt/convex-progression": `file:${join(directory, tarball)}`,
        convex: "1.45.0",
        "convex-test": "0.0.56",
        typescript: "npm:@typescript/typescript6@6.0.2",
        vite: "8.2.2",
      },
      private: true,
      type: "module",
    }),
  );
  run("pnpm", ["install", "--ignore-scripts"]);
  writeFileSync(
    join(directory, "check.ts"),
    `import { Progression } from "@vllnt/convex-progression";
import component from "@vllnt/convex-progression/convex.config.js";
import type { ComponentApi } from "@vllnt/convex-progression/_generated/component.js";
import { register } from "@vllnt/convex-progression/test";
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
const host = defineSchema({ unrelated: defineTable({ title: v.string() }) });
register(convexTest(host, {}), "alternate");
declare const refs: ComponentApi;
new Progression(refs);
void component;
`,
  );
  // Invoke the installed alias package compiler, not a global or hoisted tsc.
  run(process.execPath, [
    join(directory, "node_modules/typescript/bin/tsc6"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--types",
    "vite/client",
    "check.ts",
  ]);
  run("node", [
    "--input-type=module",
    "-e",
    'import {Progression} from "@vllnt/convex-progression"; import c from "@vllnt/convex-progression/convex.config.js"; if(typeof Progression!=="function" || !c) throw Error("bad exports");',
  ]);
  console.info("PASS: packed NodeNext types and runtime root/config exports");
} finally {
  rmSync(directory, { force: true, recursive: true });
}
