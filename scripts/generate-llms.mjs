import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Preserve existing automation; maintain llms.txt by hand instead of bundling source.
const index = readFileSync("llms.txt", "utf8");
assert.ok(index.startsWith("# @vllnt/convex-progression\n"));
assert.ok(index.includes("[README](README.md)"));
assert.ok(index.includes("[API Reference](docs/API.md)"));
