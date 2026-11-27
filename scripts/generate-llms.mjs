import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Preserve existing automation; maintain llms.txt by hand instead of bundling source.
const index = readFileSync("llms.txt", "utf8");
assert.ok(index.startsWith("# @vllnt/convex-progression\n"));
assert.ok(index.includes("[README](./README.md)"));
assert.ok(index.includes("[API Reference](./docs/API.md)"));
assert.ok(index.includes("[Changelog](./CHANGELOG.md)"));
assert.ok(index.includes("node_modules/@vllnt/convex-progression/docs/API.md"));
assert.ok(index.includes("(https://oss.vllnt.com/llms.txt)"));
// llms.txt ships in the npm package: links to shipped files are relative so they
// match the installed version; anything else is an absolute https URL.
// scripts/check-pack.mjs proves each ./ link resolves inside the packed tarball.
[...index.matchAll(/]\(([^)]+)\)/g)].forEach(([, target = ""]) => {
  assert.ok(
    target.startsWith("./") || target.startsWith("https://"),
    `llms.txt link must be ./ or https: ${target}`,
  );
});
