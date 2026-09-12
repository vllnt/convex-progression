# API Reference — @vllnt/convex-progression

**Compatibility:** `convex@^1.45.0`

```ts
import { Progression } from "@vllnt/convex-progression";

const xp = new Progression(components.progression, { defaultScope: "global" });
```

`subjectRef` and `key` are opaque host strings (1..256 characters). Never take
`delta` or `thresholds` from an end-user. `thresholds` must be strictly increasing
and ≥ 0.

### `accrue(ctx, subjectRef, key, delta, thresholds, scope?)`

Adds `delta` XP (`delta` must be a positive finite number). `level` is the count
of `thresholds` the XP has reached. `leveledUp` is true when level increased.

### `recordActivity(ctx, subjectRef, key, periodKey, thresholds, opts?)`

`opts`: `{ scope?, expectedPrevious? }`.

- Same `periodKey` as stored → no-op (`streakDelta: 0`).
- `lastPeriodKey === expectedPrevious` → streak + 1.
- Otherwise → streak resets to 1.

### `get(ctx, subjectRef, key, scope?, thresholds?)`

Returns the progress row or `null`. When `thresholds` is passed, `level` is
recomputed from stored XP.

### `reset(ctx, subjectRef, key, scope?)`

Deletes that `(scope, subjectRef, key)` row.

### `eraseSubject(ctx, subjectRef, scope?, batch?)`

Deletes up to `batch` rows (default 200, max 500) and reschedules until clean.
