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

```bash
pnpm add @vllnt/convex-progression
```

Peer dependency: `convex@^1.45.0`.

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

## Testing

```bash
pnpm test
pnpm test:coverage
```

Tests run against the real component runtime via `convex-test` (`@edge-runtime/vm`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Author

Built by [bntvllnt](https://github.com/bntvllnt) · [bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet — [vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

## License

MIT — see [LICENSE](LICENSE).
