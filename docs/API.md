# API Reference — @vllnt/convex-progression

**Compatibility:** `convex@^1.45.0`

```ts
import { Progression } from "@vllnt/convex-progression";

const xp = new Progression(components.progression, { defaultScope: "global" });
```

`subjectRef`, `key`, `scope`, `periodKey`, and provided `expectedPrevious` are
opaque host strings (1..256 UTF-16 code units). Never trust these, `delta`, or
`thresholds` from an end-user without host authorization. `thresholds` must be
strictly increasing, finite, and in `0..Number.MAX_SAFE_INTEGER` (empty is valid).
These rules apply to reads as well as writes, including missing-row queries.

### `accrue(ctx, subjectRef, key, delta, thresholds, scope?)`

Adds `delta` XP (positive finite, at most `Number.MAX_SAFE_INTEGER`). Fractions
are supported with JavaScript floating-point rounding. Rejects totals above that
bound or an addition that makes no progress (`XP_OVERFLOW`). `level` counts
reached thresholds. `previousLevel` is the stored level from the previous write;
`leveledUp` compares against it, so a changed ladder can itself produce a level-up.

### `recordActivity(ctx, subjectRef, key, periodKey, thresholds, opts?)`

`opts`: `{ scope?, expectedPrevious? }`.

- Same `periodKey` as stored → streak unchanged (`streakDelta: 0`), but level
  is recomputed and `updatedAt` is refreshed.
- `lastPeriodKey === expectedPrevious` → streak + 1.
- Otherwise → streak resets to 1.

### `get(ctx, subjectRef, key, scope?, thresholds?)`

Returns the progress row or `null`. When `thresholds` is passed, `level` is
recomputed from stored XP.

### `reset(ctx, subjectRef, key, scope?)`

Deletes that `(scope, subjectRef, key)` row.

### `eraseSubject(ctx, subjectRef, scope?, batch?)`

Deletes up to `batch` rows (default 200, positive integer clamped to 500),
returning only this pass's count. A full batch atomically schedules another pass;
there is no completion token or aggregate count.

### Lifecycle and retries

- `accrue` is additive, **not event-idempotent**. Host mutations should deduplicate
  event IDs atomically with awards. Convex transaction retries are distinct from
  submitting a new logical award request.
- Periods are opaque, not ordered. Only the latest period is remembered. Replaying
  an older period can reset/rewind a streak; the host must reject stale events and
  serialize its period policy. `expectedPrevious` declares adjacency, not a CAS
  precondition. Streaks exceeding `MAX_SAFE_INTEGER` reject with `STREAK_OVERFLOW`.
- Erase has no tombstone or write fence. Gate writes before starting erasure and
  keep them gated until a host-controlled completion check. Concurrent/new writes
  may be deleted by scheduled passes or survive after the final pass. Reset does
  not cancel pending subject erasure. Schedule execution failures require host
  monitoring and retry; this component has no durable completion status.
- `get` with thresholds only recomputes the returned level; it does not persist
  the ladder or level. Threshold policy consistency belongs to the host.

Validation failures use `ConvexError` data `{ code, message }`: `INVALID_REF`,
`INVALID_THRESHOLDS`, `INVALID_DELTA`, `INVALID_BATCH`, `XP_OVERFLOW`, or
`STREAK_OVERFLOW`. There are no component logs; hosts should monitor rejected
calls and scheduled-function failures without logging sensitive refs.
