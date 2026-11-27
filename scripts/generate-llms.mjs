import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Preserve existing automation; maintain llms.txt by hand instead of bundling source.
const index = readFileSync("llms.txt", "utf8");
assert.ok(index.startsWith("# @vllnt/convex-progression\n"));
assert.ok(index.includes("[README](./README.md)"));
assert.ok(index.includes("[API Reference](./docs/API.md)"));
assert.ok(index.includes("[Changelog](./CHANGELOG.md)"));
assert.ok(index.includes("node_modules/@vllnt/convex-progression/docs/"));
assert.ok(index.includes("(https://oss.vllnt.com/llms.txt)"));
// llms.txt ships in the npm package: links to shipped files are relative so they
// match the installed version; anything else is an absolute https URL.
for (const [, target = ""] of index.matchAll(/]\(([^)]+)\)/g)) {
  if (target.startsWith("https://")) continue;
  assert.ok(
    target.startsWith("./"),
    `llms.txt link must be ./ or https: ${target}`,
  );
  assert.ok(existsSync(target), `llms.txt link target is missing: ${target}`);
}
// scripts/check-pack.mjs proves each ./ link resolves inside the packed tarball.
