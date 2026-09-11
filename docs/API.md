# API Reference — @vllnt/convex-progression

**Compatibility:** `convex@^1.45.0`

```ts
const xp = new Progression(components.progression, { defaultScope: "global" });
```

### `accrue(ctx, subjectRef, key, delta, thresholds, scope?)`

Adds `delta` XP. `level` is the count of `thresholds` the XP has reached.
`leveledUp` is true when level increased.

### `recordActivity(ctx, subjectRef, key, periodKey, thresholds, opts?)`

`opts.expectedPrevious` is the previous period key. Same `periodKey` is a no-op.
Matching previous increments the streak; a gap resets to 1.

### `get` / `reset` / `eraseSubject`
