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
assert.ok(stable.includes("github.ref == 'refs/heads/main'"));
assert.ok(stable.includes("vars.RELEASE_ENABLED == 'true'"));
assert.ok(workflow.includes("cancel-in-progress: false"));
assert.ok(!/inputs\.bump|npm version|git (?:push|commit|tag)/.test(stable));
assert.ok(stable.includes('--notes "$RELEASE_NOTES"'));
assert.ok(
  stable.indexOf("- name: Publish to npm") <
    stable.indexOf("- name: Create GitHub Release"),
);
["CONTRIBUTING.md", "docs/RELEASING.md"].forEach((path) => {
  const text = readFileSync(path, "utf8");
  assert.ok(
    !/pnpm (?:release|alpha)|patch\/minor\/major/.test(text),
    `Stale release instructions: ${path}`,
  );
});
console.info("PASS: current-only release contract");
