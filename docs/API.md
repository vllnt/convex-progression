# API Reference — @vllnt/convex-progression

**Compatibility:** `convex@^1.45.0`, Node.js `>=20`

## Entry points

| Import                                                      | Exports                                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@vllnt/convex-progression`                                 | `Progression` class; types `ProgressionComponent`, `ProgressionOptions`, `ProgressState`, `AccrueResult`, `ActivityResult` |
| `@vllnt/convex-progression/convex.config` (or `.js`)        | default component config for `app.use(...)`                                                                                |
| `@vllnt/convex-progression/test`                            | `register(t, name = "progression")` for `convex-test` (TypeScript source; needs Vite `import.meta.glob`)                   |
| `@vllnt/convex-progression/_generated/component` (or `.js`) | type `ComponentApi` (types only)                                                                                           |

`subjectRef`, `key`, `scope`, `periodKey` and a provided `expectedPrevious` are
opaque host strings of 1..256 UTF-16 code units. Every method's `scope` defaults
to the client's `defaultScope`. Never take these, `delta` or `thresholds` from
an end user without host authorization.

`thresholds` must be strictly increasing, finite and in
`0..Number.MAX_SAFE_INTEGER`; `[]` is valid. They are checked on every write and
on `get` when passed, even when no row exists. `level` is the number of
thresholds less than or equal to the XP total.

## Client

### `Progression`

```ts
new Progression(component: ProgressionComponent, options?: ProgressionOptions)
```

`component` is the mounted component, `components.progression` (or the name
passed to `app.use`). `options.defaultScope` defaults to `"global"`; it is the
only client option. Call mutation methods from host mutations
(`ctx.runMutation`) and `get` from host queries or mutations (`ctx.runQuery`).

### `accrue`

```ts
accrue(ctx, subjectRef: string, key: string, delta: number, thresholds: number[], scope?: string): Promise<AccrueResult>
```

Adds `delta` XP to the `(scope, subjectRef, key)` row, creating it when missing
(`streak: 0`, `maxStreak: 0`, no `lastPeriodKey`). `delta` must be positive,
finite and at most `Number.MAX_SAFE_INTEGER` (`INVALID_DELTA`). Fractions are
added with JavaScript floating-point rounding. A total above
`Number.MAX_SAFE_INTEGER`, or an addition that leaves the total unchanged, is
rejected with `XP_OVERFLOW`. `level` is recomputed from `thresholds` and stored.
`previousLevel` is the level stored by the previous write (0 for a new row) and
`leveledUp` is `level > previousLevel`, so a changed ladder can itself produce a
level-up. Streak fields are not changed. Errors: `INVALID_REF`, `INVALID_DELTA`,
`INVALID_THRESHOLDS`, `XP_OVERFLOW`.

### `recordActivity`

```ts
recordActivity(ctx, subjectRef: string, key: string, periodKey: string, thresholds: number[], options?: { expectedPrevious?: string; scope?: string }): Promise<ActivityResult>
```

- No row yet: creates it with `xp: 0` and `streak: 1`.
- Same `periodKey` as stored: streak unchanged, `streakDelta: 0`.
- Stored `lastPeriodKey === expectedPrevious`: streak + 1.
- Otherwise (including a row created by `accrue`, which has no `lastPeriodKey`):
  streak restarts at 1.

A call with the stored `periodKey` whose recomputed `level` equals the stored
level does not write: it returns the stored row with `streakDelta: 0`, and
`updatedAt` keeps the time of the last write. Every other call writes: it stores
`periodKey`, recomputes and stores `level` from `thresholds`, refreshes
`updatedAt` and keeps `maxStreak` at the highest streak reached. It adds no XP.
`streakDelta` is `0` for the same period and `1` for any new period, including
one that restarts the streak at 1; it is not the net change in `streak`. Errors:
`INVALID_REF`, `INVALID_THRESHOLDS`, `STREAK_OVERFLOW`.

### `get`

```ts
get(ctx, subjectRef: string, key: string, scope?: string, thresholds?: number[]): Promise<ProgressState | null>
```

Returns the progress row or `null`. Refs are not checked: an empty or over-long
ref returns `null`, since no row can exist for it and reactive queries may run
with placeholder values. With `thresholds`, the returned `level` is recomputed
from the stored XP; nothing is written. Errors: `INVALID_THRESHOLDS` (only when
`thresholds` is passed).

### `reset`

```ts
reset(ctx, subjectRef: string, key: string, scope?: string): Promise<null>
```

Deletes the `(scope, subjectRef, key)` row. Returns `null` whether or not the
row existed. Errors: `INVALID_REF`.

### `eraseSubject`

```ts
eraseSubject(ctx, subjectRef: string, scope?: string, batch?: number): Promise<number>
```

Deletes up to `batch` of the subject's rows in one scope (default 200; a
positive integer above 500 is clamped to 500) and returns this call's count. A
full batch schedules another pass with the same batch size. There is no
completion token or total count. Errors: `INVALID_REF`, `INVALID_BATCH`.

## Types

### `ProgressionComponent`

Type of `components.progression`: the component's `mutations.accrue`,
`mutations.recordActivity`, `mutations.reset`, `mutations.eraseSubject` and
`queries.get` function references. The generated `ComponentApi` is assignable to
it.

### `ProgressionOptions`

```ts
type ProgressionOptions = { defaultScope?: string };
```

### `ProgressState`

```ts
type ProgressState = {
  lastPeriodKey?: string;
  level: number;
  maxStreak: number;
  streak: number;
  updatedAt: number;
  xp: number;
};
```

`updatedAt` is the time of the last write in milliseconds since the epoch. A
`recordActivity` call that repeats the stored period at the same level does not
write, so it does not change `updatedAt`. `lastPeriodKey` is absent until the
first `recordActivity`.

### `AccrueResult`

```ts
type AccrueResult = ProgressState & {
  leveledUp: boolean;
  previousLevel: number;
};
```

### `ActivityResult`

```ts
type ActivityResult = ProgressState & { streakDelta: number };
```

## Other entry points

### `convex.config`

The default export of `@vllnt/convex-progression/convex.config` is the component
definition, named `progression`. Mount it with `app.use(config)`, or
`app.use(config, { name })` for more than one mount; each mount has its own
tables and scheduled work.

```ts
// convex/convex.config.ts
import progression from "@vllnt/convex-progression/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(progression);
export default app;
```

### `register`

```ts
register(t: Pick<TestConvex<typeof schema>, "registerComponent">, name?: string): void
```

Mounts the component in a `convex-test` instance under `name` (default
`"progression"`). The instance can use any host schema. Ships as TypeScript
source and calls Vite's `import.meta.glob`, so run it under Vitest.

### `ComponentApi`

Generated type of the mounted component, from
`@vllnt/convex-progression/_generated/component`. Types only, no runtime value.
`new Progression(...)` accepts it.

## Errors

Validation failures throw a `ConvexError` whose `data` is `{ code, message }`:

| Code                 | Thrown by                                                       |
| -------------------- | --------------------------------------------------------------- |
| `INVALID_REF`        | `accrue`, `recordActivity`, `reset`, `eraseSubject`             |
| `INVALID_DELTA`      | `accrue`                                                        |
| `INVALID_THRESHOLDS` | `accrue`, `recordActivity`, `get` (when `thresholds` is passed) |
| `INVALID_BATCH`      | `eraseSubject`                                                  |
| `XP_OVERFLOW`        | `accrue`                                                        |
| `STREAK_OVERFLOW`    | `recordActivity`                                                |

Messages, causes and fixes: [Errors and fixes](../README.md#errors-and-fixes).
There are no component logs; monitor rejected calls and scheduled-function
failures without logging sensitive refs.

## Lifecycle and retries

- `accrue` is additive and **not event-idempotent**. Host mutations should
  deduplicate event IDs atomically with awards. Convex transaction retries are
  distinct from submitting a new logical award request.
- Periods are opaque, not ordered. Only the latest period is remembered.
  Replaying an older period can reset or rewind a streak; the host must reject
  stale events and serialize its period policy. `expectedPrevious` declares
  adjacency, not a compare-and-set precondition.
- Erase has no tombstone or write fence. Gate writes before starting erasure and
  keep them gated until a host-controlled completion check. Concurrent or new
  writes may be deleted by scheduled passes or survive after the final pass.
  `reset` does not cancel pending subject erasure. Scheduled pass failures need
  host monitoring and retry; this component has no durable completion status.
- `get` with thresholds only recomputes the returned level; it does not persist
  the ladder or level. Threshold policy consistency belongs to the host.
