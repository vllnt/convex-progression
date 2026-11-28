import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkDocumentation,
  convexHost,
  writeHost,
} from "./check-documentation.mjs";

// Files agents and consumers read from node_modules; they must ship.
const required = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "docs/API.md",
  "dist/client/index.d.ts",
  "dist/client/index.js",
  "dist/component/convex.config.js",
  "llms.txt",
  "package.json",
  "src/test.ts",
];
// Contributor and maintainer files; they must not ship.
const forbidden = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/RELEASING.md",
  "example",
  "scripts",
];

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
        "convex-test": "0.0.65",
        typescript: "npm:@typescript/typescript6@6.0.2",
        vite: "8.3.5",
        vitest: "5.1.1",
      },
      private: true,
      type: "module",
    }),
  );
  // No lockfile here, so the repo's release-age gate (pnpm-workspace.yaml)
  // must reach this install too, or floating transitive deps can pull a fresh
  // release. Without a packages list the copy is a single-package workspace.
  copyFileSync(
    join(process.cwd(), "pnpm-workspace.yaml"),
    join(directory, "pnpm-workspace.yaml"),
  );
  run("pnpm", ["install", "--ignore-scripts"]);
  const installed = join(directory, "node_modules/@vllnt/convex-progression");
  const missing = required.filter((path) => !existsSync(join(installed, path)));
  assert.deepEqual(
    missing,
    [],
    `missing from the tarball: ${missing.join(", ")}`,
  );
  const extra = forbidden.filter((path) => existsSync(join(installed, path)));
  assert.deepEqual(extra, [], `must not ship: ${extra.join(", ")}`);
  const links = [
    ...readFileSync(join(installed, "llms.txt"), "utf8").matchAll(
      /]\((\.\/[^)#]+)/g,
    ),
  ].map((match) => match[1] ?? "");
  assert.ok(links.length > 0, "llms.txt has no relative links");
  const broken = links.filter((path) => !existsSync(join(installed, path)));
  assert.deepEqual(
    broken,
    [],
    `llms.txt links outside the tarball: ${broken.join(", ")}`,
  );
  // Docs contract on what consumers receive, then the README and docs/API.md
  // examples type-check against the built package in a stub Convex host.
  const examples = checkDocumentation(installed);
  const host = writeHost(directory, convexHost(installed, examples), examples);
  run(process.execPath, [
    join(directory, "node_modules/typescript/bin/tsc6"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    "ESNext",
    "--moduleResolution",
    "Bundler",
    "--types",
    "vite/client",
    ...host,
  ]);
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
  console.info(
    `PASS: packed files, docs contract, ${String(examples.length)} doc examples, llms.txt links, NodeNext types and runtime root/config exports`,
  );
} finally {
  rmSync(directory, { force: true, recursive: true });
}
