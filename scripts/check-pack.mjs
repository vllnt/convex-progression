import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "progression-pack-"));
const run = (command, args, cwd = dir) => execFileSync(command, args, { cwd, stdio: "inherit" });
try {
  run("pnpm", ["pack", "--pack-destination", dir], process.cwd());
  const tarball = readdirSync(dir).find((name) => name.endsWith(".tgz"));
  assert.ok(tarball);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ private: true, type: "module", dependencies: { "@vllnt/convex-progression": `file:${join(dir, tarball)}`, convex: "1.45.0", typescript: "npm:@typescript/typescript6@6.0.2" } }));
  run("pnpm", ["install", "--ignore-scripts"]);
  writeFileSync(join(dir, "check.ts"), `import { Progression } from "@vllnt/convex-progression";
import component from "@vllnt/convex-progression/convex.config.js";
import type { ComponentApi } from "@vllnt/convex-progression/_generated/component.js";
declare const refs: ComponentApi;
new Progression(refs);
void component;
`);
  run("pnpm", ["exec", "tsc", "--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "check.ts"]);
  run("node", ["--input-type=module", "-e", 'import {Progression} from "@vllnt/convex-progression"; import c from "@vllnt/convex-progression/convex.config.js"; if(typeof Progression!=="function" || !c) throw Error("bad exports");']);
  console.log("PASS: packed NodeNext types and runtime root/config exports");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
