/* eslint-disable functional/no-loop-statements -- The smoke probe sequences writes and bounded polling. */
// Runs an anonymous loopback deployment; use an isolated HOME.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

import { ConvexHttpClient } from "convex/browser";

import { api } from "../example/convex/_generated/api.js";

assert.equal(process.env.CONVEX_AGENT_MODE, "anonymous");
assert.ok(process.env.HOME?.includes("progression-audit"));
const child = spawn(
  "pnpm",
  [
    "convex",
    "dev",
    "--local-cloud-port",
    "3320",
    "--local-site-port",
    "3321",
    "--typecheck",
    "disable",
    "--tail-logs",
    "disable",
  ],
  { detached: true, stdio: ["ignore", "pipe", "pipe"] },
);
const exited = once(child, "exit");
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("local deployment readiness timeout"));
    }, 60_000);
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("CLI exited before readiness"));
    });
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (/** @type {Buffer} */ data) => {
        const text = data.toString();
        process.stdout.write(text);
        if (text.includes("Convex functions ready")) {
          clearTimeout(timer);
          resolve();
        }
      });
  });
  let inFlight = 0;
  let peak = 0;
  const client = new ConvexHttpClient("http://127.0.0.1:3320", {
    fetch: async (...parameters) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await globalThis.fetch(...parameters);
      } finally {
        inFlight -= 1;
      }
    },
  });
  const base = { key: "xp", subjectRef: `probe-${String(Date.now())}` };
  await client.mutation(api.example.accrueSecondary, base);
  // Convex serializes missing rows as null.
  // eslint-disable-next-line unicorn/no-null
  assert.equal(await client.query(api.example.get, base), null);
  await Promise.all(
    Array.from({ length: 12 }, () =>
      client.mutation(
        api.example.accrue,
        {
          ...base,
          delta: 1,
          thresholds: [10],
        },
        { skipQueue: true },
      ),
    ),
  );
  assert.equal(inFlight, 0);
  assert.equal(peak, 12, "award HTTP requests must overlap");
  console.info(`Award HTTP peak: ${String(peak)}`);
  peak = 0;
  const awarded = await client.query(api.example.get, base);
  assert.equal(awarded?.xp, 12);
  await Promise.all(
    Array.from({ length: 8 }, () =>
      client.mutation(
        api.example.recordActivity,
        {
          ...base,
          periodKey: "p",
          thresholds: [],
        },
        { skipQueue: true },
      ),
    ),
  );
  assert.equal(inFlight, 0);
  assert.equal(peak, 8, "activity HTTP requests must overlap");
  console.info(`Activity HTTP peak: ${String(peak)}`);
  const active = await client.query(api.example.get, base);
  assert.equal(active?.streak, 1);
  for (const key of ["a", "b", "c"])
    await client.mutation(api.example.accrue, {
      ...base,
      delta: 1,
      key,
      thresholds: [],
    });
  await client.mutation(api.example.accrue, {
    ...base,
    delta: 1,
    scope: "isolated",
    thresholds: [],
  });
  assert.equal(
    await client.mutation(api.example.eraseSubject, {
      batch: 1,
      subjectRef: base.subjectRef,
    }),
    1,
  );
  const deadline = Date.now() + 15_000;
  for (;;) {
    const rows = await Promise.all(
      ["xp", "a", "b", "c"].map((key) =>
        client.query(api.example.get, { ...base, key }),
      ),
    );
    if (rows.every((row) => row === null)) break;
    assert.ok(Date.now() < deadline, "scheduled erase did not finish");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const isolated = await client.query(api.example.get, {
    ...base,
    scope: "isolated",
  });
  assert.equal(isolated?.xp, 1);
  await client.mutation(api.example.eraseSubject, {
    scope: "isolated",
    subjectRef: base.subjectRef,
  });
  const otherMount = await client.query(api.example.getSecondary, base);
  assert.equal(otherMount?.xp, 7);
  console.info(
    "PASS: real local concurrent awards, same-period writes, scheduled multi-pass erase, scope isolation",
  );
} finally {
  // This process owns this newly spawned process group, not an arbitrary PID.
  assert.ok(child.pid);
  process.kill(-child.pid, "SIGTERM");
  await exited;
}
