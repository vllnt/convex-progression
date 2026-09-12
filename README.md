<!-- Badges -->
[![convex-component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://www.convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-progression.svg)](https://www.npmjs.com/package/@vllnt/convex-progression)
[![CI](https://github.com/vllnt/convex-progression/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-progression/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-progression.svg)](./LICENSE)

# @vllnt/convex-progression

XP → level and streak windows as a Convex component.

Not money (`@vllnt/convex-wallet`), not a resetting cap (`@vllnt/convex-quota`).
The host passes opaque `subjectRef` + `key` and the level `thresholds` on each write.

```ts
const xp = new Progression(components.progression);
await xp.accrue(ctx, subjectRef, "solo", 10, [50, 150, 400]);
await xp.recordActivity(ctx, subjectRef, "solo", today, [], {
  expectedPrevious: yesterday,
});
```

## Features

- **XP / level** — `accrue` adds XP; `level` is how many host `thresholds` that XP has reached.
- **Streaks** — `recordActivity` with a host `periodKey`; pass `expectedPrevious` to continue a streak or reset on a gap.
- **Opaque refs** — `subjectRef` and `key` are host strings (max 256 chars).
- **Recompute on read** — `get(..., thresholds)` can recompute `level` if the host changed the ladder.
- **Bounded erase** — `eraseSubject` deletes in batches and reschedules until clean.
- **Scopes** — default `"global"`.

## Installation

Unreleased candidate (`0.1.0`); registry availability is not asserted. The command
below applies after publication. For pre-release evaluation, install a locally
built package tarball.

```bash
pnpm add @vllnt/convex-progression
```

Peer dependency: `convex@^1.45.0`; Node.js ≥20 (development toolchain:
Node 20.19+ or 22.12+).

## Usage

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import progression from "@vllnt/convex-progression/convex.config";

const app = defineApp();
app.use(progression);
export default app;
```

```ts
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";
import { Progression } from "@vllnt/convex-progression";

const xp = new Progression(components.progression);
const THRESHOLDS = [50, 150, 400];

export const onWin = mutation({
  args: {},
  handler: async (ctx) => {
    const subjectRef = /* host-resolved identity */ "user_1";
    await xp.accrue(ctx, subjectRef, "solo", 10, THRESHOLDS);
    await xp.recordActivity(ctx, subjectRef, "solo", "2026-09-11", THRESHOLDS, {
      expectedPrevious: "2026-09-10",
    });
  },
});
```

**Host rules:** never take `delta` or `thresholds` from the end-user.

## API Reference

| Method | Kind | Result |
|--------|------|--------|
| `accrue(ctx, subjectRef, key, delta, thresholds, scope?)` | mutation | `{ xp, level, streak, maxStreak, leveledUp, previousLevel, ... }` |
| `recordActivity(ctx, subjectRef, key, periodKey, thresholds, opts?)` | mutation | `{ streak, streakDelta, maxStreak, ... }` |
| `get(ctx, subjectRef, key, scope?, thresholds?)` | query | progress or `null` |
| `reset(ctx, subjectRef, key, scope?)` | mutation | `null` |
| `eraseSubject(ctx, subjectRef, scope?, batch?)` | mutation | `number` deleted this pass |

Full reference: [docs/API.md](docs/API.md).

## React

Backend-only — no `./react` entry.

## Security

- Auth-agnostic — the host resolves identity and passes an opaque `subjectRef`.
- Tables sandboxed — reached only through the exported functions.
- The host authorizes every read/write, derives scope and period keys, deduplicates
  award events, and rejects late activity. See [lifecycle limits](docs/API.md#lifecycle-and-retries).

## Multiple mounts

Mount with `app.use(progression, { name: "gameProgress" })` and separately with
`{ name: "learningProgress" }`; construct a client for each generated component
reference. Each mount has isolated tables and scheduled work.

## Testing

```bash
pnpm test
pnpm test:coverage
```

Tests use the `convex-test` in-memory simulation (`@edge-runtime/vm`), not a real
Convex backend. They do not prove production OCC retries or scheduler behavior.

`node scripts/check-pack.mjs` checks tarball imports and NodeNext consumer types.
For a separate **local backend** concurrency/scheduler smoke test, provision an
anonymous deployment in an isolated HOME (never a cloud/production deployment):

```bash
HOME=/tmp/progression-audit-home CONVEX_AGENT_MODE=anonymous pnpm convex dev --once --local-cloud-port 3320 --local-site-port 3321 --typecheck disable
HOME=/tmp/progression-audit-home CONVEX_AGENT_MODE=anonymous node scripts/check-local.mjs
```

The probe starts/stops its own CLI and backend. This is bounded smoke evidence,
not proof of every conflict schedule or production workload. Example wrappers
accept raw refs and awards for testing only; they are not production auth gates.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Author

Built by [bntvllnt](https://github.com/bntvllnt) · [bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet — [vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

## License

MIT — see [LICENSE](LICENSE).
