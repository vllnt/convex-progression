# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-28

Documentation, packaging and release checks only. The component's runtime code
and the `convex@^1.45.0` peer range are unchanged from 0.1.0. The compiled
`dist` differs from 0.1.0 only by added TSDoc comments and the matching source
maps.

### Added

- The npm package documents itself for coding agents: `README.md` and `llms.txt`
  say where the shipped docs are (`docs/API.md`, plus `README.md`,
  `CHANGELOG.md`, `llms.txt` and `src/` at the package root) and that they match
  the installed version.
- `docs/API.md` lists the package entry points and states what `streakDelta`
  reports.
- `scripts/check-pack.mjs` (run in CI) fails when a required file is missing
  from the packed tarball, a contributor file ships, or an `llms.txt` link does
  not resolve inside it.
- `register` from `@vllnt/convex-progression/test` has a TSDoc summary. It
  accepts a `convexTest` instance built from any host schema.

### Documentation

- The README follows the section layout shared by every @vllnt package: For
  coding agents, When to use, Install, Quick start, API, Common tasks, Errors
  and fixes, Limits and gotchas, Compatibility, then Testing, Security, Related
  packages, Contributing, Links and License. It has a table of every export and
  of every error code with its message, cause and fix, and common tasks for
  daily streaks, awarding XP once per event, changing the level ladder, erasing
  a user and multiple mounts.
- `docs/API.md` has one heading per export and `Progression` method, so the
  README links straight to each entry, plus an errors table and the lifecycle
  and retry rules.
- `llms.txt` adds "When to use", links to the errors table, and ends with an
  Ecosystem block: the package page, its release feed, the @vllnt package index,
  package and docs search, vllnt and the author.
- Every public export, `Progression` method and the component config have a
  TSDoc summary; `Progression` links its package page with `@see`.
- `package.json` `description` and `keywords` describe what the package does.
  The same description sentence opens the README and is the `llms.txt` summary.
- The README Related packages section says the package works with no other
  package in code; packages for other needs are named under When to use.
- A Links section lists the package page and release feed, the @vllnt package
  index and search, the source, issues and npm, Discord and X, the company and
  author, and sponsorship. The README ends with links to vllnt open source, the
  package page, vllnt.com and the author.
- `scripts/check-documentation.mjs` (run by `pnpm lint`, and by
  `scripts/check-pack.mjs` on the packed package) enforces this layout: section
  order, install and first example near the top, tagged code blocks, relative
  links and anchors that resolve, external links that are well-formed https
  URLs, every export and error code documented, the Links, footer and Ecosystem
  blocks, and no retired domain. `check-pack.mjs` type-checks the README and
  `docs/API.md` examples against the built package with convex 1.45.0.

### Changed

- `llms.txt` links to shipped files (`README.md`, `docs/API.md`, `CHANGELOG.md`,
  `LICENSE`) are relative, so they point at the installed version instead of
  GitHub `main`.
- `homepage` is `https://oss.vllnt.com/packages/convex-progression`.
- Every push to `main` publishes a canary; a repository variable no longer gates
  it.

### Release process

- The package-contents check run before every publish also rejects `.spec.mts`
  and `.spec.cts` test files.
- CI runs the package-contents check's own tests. The 7-day dependency
  release-age gate, which pnpm 10 ignored in the `package.json` `pnpm` field, is
  now in `pnpm-workspace.yaml`. `files` excludes test files of every extension.
- The package test's lockfile-free install uses the same gate.
- Internal: there is no version-update bot; dependency updates are a manual pass
  under the 7-day gate. CI and publish set up pnpm through Corepack, the package
  test installs with the repo's pinned pnpm, every action in the workflows is
  pinned to a commit, and a test pins `INVALID_DELTA` for a zero award.

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
