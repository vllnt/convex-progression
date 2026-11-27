# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The npm package documents itself for coding agents: `README.md` and `llms.txt`
  say where the shipped docs are (`docs/API.md`, plus `README.md`,
  `CHANGELOG.md`, `llms.txt` and `src/` at the package root) and that they match
  the installed version. `llms.txt` gains an Ecosystem link to
  `https://oss.vllnt.com/llms.txt`; the README gains a Related packages section.
- `docs/API.md` lists the package entry points and states what `streakDelta`
  reports.
- `scripts/check-pack.mjs` (run in CI) fails when a required file is missing
  from the packed tarball, a contributor file ships, or an `llms.txt` link does
  not resolve inside it.

### Changed

- `llms.txt` links to shipped files (`README.md`, `docs/API.md`, `CHANGELOG.md`,
  `LICENSE`) are relative, so they point at the installed version instead of
  GitHub `main`.
- `homepage` is `https://oss.vllnt.com/packages/convex-progression`.
- Every push to `main` that touches the package or its shipped docs publishes a
  canary; a repository variable no longer gates it.

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
