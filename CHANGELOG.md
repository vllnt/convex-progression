# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-28

One behaviour change in `recordActivity` (below); everything else is
documentation and packaging. The `convex@^1.45.0` peer range, the Node.js `>=20`
range and the stored row shape are unchanged from 0.1.0.

### Added

- The npm package documents itself for coding agents: `README.md` and `llms.txt`
  say where the shipped docs are (`docs/API.md`, plus `README.md`,
  `CHANGELOG.md`, `llms.txt` and `src/` at the package root) and that they match
  the installed version.
- The README has a table of every export, a table of every error code with its
  message, cause and fix, Limits and gotchas, Compatibility, and common tasks
  for daily streaks, awarding XP once per event, changing the level ladder,
  erasing a user and multiple mounts. A Links section lists the package page,
  release feed, package index and search, source, issues, npm, Discord, X, the
  company, the author and sponsorship.
- `docs/API.md` lists the package entry points, has one heading per export and
  `Progression` method, states what `streakDelta` reports, and has an errors
  table and the lifecycle and retry rules.
- `llms.txt` adds "When to use", a link to the errors table and an Ecosystem
  block: the package page, its release feed, the @vllnt package index, package
  and docs search, vllnt and the author.
- Every public export, `Progression` method, the component config and `register`
  from `@vllnt/convex-progression/test` have a TSDoc summary; `Progression`
  links its package page with `@see`.
- The README Compatibility section says that convex 1.49 and newer need Node.js
  22 or later.

### Changed

- **Breaking:** `recordActivity` with the stored `periodKey` and an unchanged
  recomputed `level` no longer writes the row. It returns the stored state
  (`streakDelta: 0`, the stored `updatedAt`), which saves one write and a re-run
  of every `get` subscription on that row per repeat call. A changed `level` (a
  new threshold ladder) in the same period, and every new period, still write
  and refresh `updatedAt`. Hosts that read `updatedAt` as "last activity time"
  within a period must store their own timestamp. Rows written by 0.1.x have the
  same shape and need no migration: they are read as stored, and the first call
  that changes the period or the level writes them as before.
- `llms.txt` links to shipped files (`README.md`, `docs/API.md`, `CHANGELOG.md`,
  `LICENSE`) are relative, so they point at the installed version instead of
  GitHub `main`.
- `package.json` `description` and `keywords` describe what the package does;
  the same description opens the README and is the `llms.txt` summary.
  `homepage` is `https://oss.vllnt.com/packages/convex-progression`.
- Internal: stricter CI and publish checks (docs contract, packed package and
  doc examples type-checked against convex 1.45.0, package contents, 7-day
  dependency age), a canary on every push to `main`, and tests for every error
  code, ref limit and erase batch size.

## [0.1.0] - 2026-11-23

First stable release. Earlier builds were published only to the `canary`
dist-tag.

### Added

- XP, levels and streaks per opaque `(scope, subjectRef, key)`:
  - `accrue` adds XP and reports `leveledUp` / `previousLevel`. `level` is the
    number of host-supplied `thresholds` the XP has reached.
  - `recordActivity` records a host `periodKey`. A matching `expectedPrevious`
    continues the streak, the same period leaves it unchanged, anything else
    restarts it at 1. It tracks `maxStreak`.
  - `get` returns the state or `null`, and recomputes `level` when `thresholds`
    are passed.
  - `reset` deletes one row; `eraseSubject` deletes a subject in bounded batches
    (default 200, clamped to 500) and reschedules until clean.
- Host-wrapper design: the component stores one sandboxed `progress` table and
  never reads host tables or environment. The host owns auth, refs, thresholds
  and period keys.
- Multiple named mounts with isolated tables and scheduled work.
- `@vllnt/convex-progression/test` exports `register` for `convex-test`.

### Guarantees and limits

- Fail closed: invalid input throws a `ConvexError` with a code (`INVALID_REF`,
  `INVALID_THRESHOLDS`, `INVALID_DELTA`, `INVALID_BATCH`, `XP_OVERFLOW`,
  `STREAK_OVERFLOW`). XP and streaks stay within `MAX_SAFE_INTEGER`, and an
  award that would be silently lost to floating-point precision is rejected.
- `get` returns `null` for an empty or over-long ref so reactive queries with
  placeholder values do not error; mutations reject them with `INVALID_REF`.
- Awards are not event-idempotent, periods are opaque and unordered, and erasure
  has no write fence or completion token: the host deduplicates, orders and
  fences. See [docs/API.md](docs/API.md#lifecycle-and-retries).
- Tests use the `convex-test` simulation, not a real Convex backend.

### Release process

- Stable releases are published only from a `vX.Y.Z` tag on `main` through npm
  trusted publishing with provenance. Test files are not shipped.
