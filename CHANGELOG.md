# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Bound XP/streak arithmetic and reject silently lost awards.
- Validate query thresholds and all namespace/period refs.
- Clarify replay, erasure, simulation-test, and unreleased-candidate limitations.

### Added

- Initial unpublished candidate of `@vllnt/convex-progression`.
- `accrue`, `recordActivity`, `get` (optional threshold recompute), `reset`,
  `eraseSubject` (batched).
