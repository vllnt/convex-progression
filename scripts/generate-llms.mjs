import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Preserve existing automation; maintain llms.txt by hand instead of bundling source.
const index = readFileSync("llms.txt", "utf8");
assert.ok(index.startsWith("# @vllnt/convex-progression\n"));
const base = "https://github.com/vllnt/convex-progression/blob/main/";
assert.ok(index.includes(`[README](${base}README.md)`));
assert.ok(index.includes(`[API Reference](${base}docs/API.md)`));
// llms.txt ships in the npm package, where relative links would not resolve.
assert.ok(!/]\((?!https:\/\/)/.test(index), "llms.txt links must be absolute");
