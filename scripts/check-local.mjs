// Runs only an anonymous loopback deployment; use an isolated HOME.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { ConvexHttpClient } from "convex/browser";

assert.equal(process.env.CONVEX_AGENT_MODE, "anonymous");
assert.ok(process.env.HOME?.includes("progression-audit"));
const child = spawn("pnpm", ["convex", "dev", "--local-cloud-port", "3320", "--local-site-port", "3321", "--typecheck", "disable", "--tail-logs", "disable"], { stdio: ["ignore", "pipe", "pipe"], detached: true });
const exited = once(child, "exit");
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("local deployment readiness timeout")), 60000);
    child.once("exit", () => { clearTimeout(timer); reject(new Error("CLI exited before readiness")); });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => {
      const text = data.toString();
      process.stdout.write(text);
      if (text.includes("Convex functions ready")) { clearTimeout(timer); resolve(); }
    });
  });
  const client = new ConvexHttpClient("http://127.0.0.1:3320");
  const base = { subjectRef: `probe-${Date.now()}`, key: "xp" };
  await Promise.all(Array.from({ length: 12 }, () => client.mutation("example:accrue", { ...base, delta: 1, thresholds: [10] })));
  assert.equal((await client.query("example:get", base)).xp, 12);
  await Promise.all(Array.from({ length: 8 }, () => client.mutation("example:recordActivity", { ...base, periodKey: "p", thresholds: [] })));
  assert.equal((await client.query("example:get", base)).streak, 1);
  for (const key of ["a", "b", "c"]) await client.mutation("example:accrue", { ...base, key, delta: 1, thresholds: [] });
  await client.mutation("example:accrue", { ...base, scope: "isolated", delta: 1, thresholds: [] });
  assert.equal(await client.mutation("example:eraseSubject", { subjectRef: base.subjectRef, batch: 1 }), 1);
  const deadline = Date.now() + 15000;
  for (;;) {
    const rows = await Promise.all(["xp", "a", "b", "c"].map((key) => client.query("example:get", { ...base, key })));
    if (rows.every((row) => row === null)) break;
    assert.ok(Date.now() < deadline, "scheduled erase did not finish");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal((await client.query("example:get", { ...base, scope: "isolated" })).xp, 1);
  await client.mutation("example:eraseSubject", { subjectRef: base.subjectRef, scope: "isolated" });
  console.log("PASS: real local concurrent awards, same-period writes, scheduled multi-pass erase, scope isolation");
} finally {
  // This process owns this newly spawned process group, not an arbitrary PID.
  process.kill(-child.pid, "SIGTERM");
  await exited;
}
