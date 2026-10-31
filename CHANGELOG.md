# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - Unreleased

First stable release. Earlier builds were published only to the `canary`
dist-tag (`0.1.0-canary.0` on 2026-09-12 and rolling `0.1.0-canary.<sha>`
builds).

### Added

- `accrue`, `recordActivity`, `get` (optional threshold recompute), `reset`,
  `eraseSubject` (batched).
- `@vllnt/convex-progression/test` helper (`register`) for `convex-test`.

### Fixed

- Bound XP/streak arithmetic and reject silently lost awards (`INVALID_DELTA`,
  `XP_OVERFLOW`, `STREAK_OVERFLOW`).
- Validate query thresholds and all namespace/period refs.
- `get` returns `null` for an empty or over-long ref instead of throwing, so
  reactive queries with placeholder values do not error; mutations still reject
  them with `INVALID_REF`.
- The `/test` entry and component sources use `.js` relative imports and
  reference Vite client types, so they type-check for `nodenext` consumers.

### Changed

- Documented replay, erasure, simulation-test, and lifecycle limitations.
- Releases are published only from a `vX.Y.Z` tag on `main` through npm trusted
  publishing with provenance.
