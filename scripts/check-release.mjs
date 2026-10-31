import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** @type {{ scripts: Record<string, string> }} */
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
Object.entries(manifest.scripts).forEach(([name, command]) => {
  assert.ok(
    !/^(?:alpha|release|prepublishOnly)$/.test(name),
    `Unsafe release script: ${name}`,
  );
  assert.ok(
    !/npm (?:publish|login)|git (?:push|tag)|npm version/.test(command),
    `Release bypass: ${name}`,
  );
});
const workflow = readFileSync(".github/workflows/publish.yml", "utf8");
const stable = workflow.slice(workflow.indexOf("  release:"));
assert.ok(stable.includes("startsWith(github.ref, 'refs/tags/v')"));
assert.ok(stable.includes("git merge-base --is-ancestor"));
assert.ok(stable.includes("--provenance"));
assert.ok(workflow.includes("cancel-in-progress: false"));
assert.ok(!/inputs\.bump|npm version|git (?:push|commit)/.test(stable));
assert.ok(!workflow.includes("NODE_AUTH_TOKEN: ${{"));
["CONTRIBUTING.md", "docs/RELEASING.md"].forEach((path) => {
  const text = readFileSync(path, "utf8");
  assert.ok(
    !/pnpm (?:release|alpha)|patch\/minor\/major/.test(text),
    `Stale release instructions: ${path}`,
  );
});
console.info("PASS: tag-driven release contract");
