# Publication candidate audit

This is evidence for the current remediation, not a publication authorization.

## Fixed defects

- Positive finite awards previously overflowed to Infinity or silently disappeared
  at floating-point precision limits. Delta and totals now stay within
  MAX_SAFE_INTEGER, and non-increasing additions reject atomically. Fractions
  remain supported; arithmetic is not decimal-exact.
- Query thresholds bypassed write validation, including on missing rows. Reads
  now enforce the same finite, bounded, strictly increasing ladder contract.
- Scope and expectedPrevious lacked ref limits. All boundary refs are now
  nonempty and at most 256 UTF-16 code units. Streak overflow rejects.
- Documentation conflated convex-test with a backend and claimed an unpublished
  initial release. These claims are corrected; same-period timestamp/level updates,
  policy changes, replay and erase limitations are explicit.
- Node >=18 metadata contradicted Convex 1.45's Node >=20 requirement.
- Packed docs were absent; tarballs now include API/changelog/LLM docs and omit tests.
- Release notes previously interpolated commit-derived text into shell source;
  environment passing removes that injection path. Manual release is main-only,
  requires `RELEASE_ENABLED=true`, and top-level permissions are read-only.
- Lint now rejects warnings; test command no longer passes empty test suites.
  CI/release quality gates check packed consumers and generated-doc drift.

## Reproduced checks

On Darwin arm64, Node 26.7.0, Convex 1.45.0:

- `pnpm install --frozen-lockfile`
- `pnpm build`, `pnpm typecheck`, `pnpm typecheck:ci`
- `pnpm lint` (zero-warning gate)
- `pnpm test:coverage`: 18 tests, 100% statements/branches/functions/lines,
  including the newly extracted validation module (no coverage exclusions added).
- Node 20.20.2 with pinned pnpm 9.15.4 independently passes build, CI typecheck,
  strict lint and 100% coverage. System pnpm 11 fails on Node20; CI explicitly
  installs the packageManager-pinned pnpm9, which avoids that mismatch.
- `node scripts/check-pack.mjs`: isolated installed tarball; strict NodeNext type
  consumer, runtime root and config imports with Convex 1.45.0.
- Anonymous isolated-HOME CLI deployment on loopback 3320/3321 succeeded. All
  changed `_generated` files are unchanged Convex CLI output.
- `HOME=/tmp/progression-audit-home CONVEX_AGENT_MODE=anonymous node scripts/check-local.mjs`:
  12 simultaneous additive writes preserve total XP, 8 same-period writes retain
  streak 1, scheduler drains four rows in one-row passes, other scope survives.
  The owned process group was stopped after verification. This tests real backend
  behavior but does not establish that every run experienced an OCC retry.

## Remaining limits / review prerequisites

- Independent security/current-target verification is required before readiness.
- Package AGENTS points to missing `example/convex/_generated/ai/guidelines.md`;
  CLI generation did not produce it. No generated instruction file was fabricated.
- `get`/mutations use a scoped subject/key index. Erase is capped at 500 rows/pass.
  Threshold processing remains linear and bounded by Convex argument limits;
  no new arbitrary ladder cap was imposed on supported callers.
- No durable event dedupe, period ordering, erase tombstone, completion API, or
  scheduler failure recovery is claimed. Host fences, authorization, monitoring,
  and atomic event dedupe are necessary (see API reference).
- Local smoke coverage is not Cloud/self-hosted compatibility certification, a
  benchmark, exhaustive concurrency testing, or a proof of safe host auth.
- Release workflow still performs version/tag/publish side effects by design when
  authorized separately. Nothing was published, pushed, tagged, merged, or made public.
