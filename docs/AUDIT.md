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
- `pnpm build`, `pnpm typecheck`, `pnpm typecheck:ci` (now also checks test and
  example types with the runtime's Bundler module resolution)
- `pnpm lint` (zero-warning gate)
- `pnpm test:coverage`: 22 tests, 100% statements/branches/functions/lines,
  including validation and published `src/test.ts` registration/module loaders.
  The helper excludes test files from its production component module glob, not
  from coverage. All registered module loaders execute in the regression suite.
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
  A second mount retains its own 7 XP while the first mount is erased, and a
  write in the second mount does not appear in the first. This verifies real
  mount isolation in addition to runtime scope isolation.
  The owned process group was stopped after verification. This tests real backend
  behavior but does not establish that every run experienced an OCC retry.

## Independent-review corrections

The prior `972c4a7` evidence overstated two checks: its single HTTP client's
mutation queue serialized requests, and its packed compiler command could resolve
a global/hoisted `tsc` instead of the installed alias. Those checks are superseded:

- Packed consumers now invoke the installed `typescript/bin/tsc6` with the current
  Node executable. Both Node20 and Node22 with pinned pnpm9.15.4 pass, including
  the unrelated-host test-helper type consumer.
- Concurrent mutations explicitly set `skipQueue: true`. A custom fetch wrapper
  measures outstanding HTTP requests; assertions and observed peaks are 12 for
  awards and 8 for activity. Total XP, same-period streak, multi-mount and scheduled
  scope-isolated erasure assertions pass on the real local backend.
- Removed local alpha/release and interactive login scripts. CONTRIBUTING now
  matches the current-only workflow; `check:release` runs in lint and rejects
  script bypasses, stale bump instructions and unsafe stable workflow patterns.

## Rework

- Published test registration accepts unrelated host schemas via a structural
  registrar type; packed consumer compilation and runtime coverage include it.
- Full typed base ESLint now covers client/shared/test helpers, component,
  examples, configs and scripts. Focused style exceptions preserve positional
  public APIs, atomic handlers, ordered tests, Convex null returns and fixture
  endpoint names; no unsafe-type or validator rules are disabled.
- Indexed logical-row lookups use `unique()`; duplicate-state regression proves
  get/accrue/activity/reset fail rather than silently selecting one duplicate.
- Regression tests demonstrate late d1/d2 replay and erase/recreation races;
  these are intentional host-policy limitations, not tombstone guarantees.
- Stable release no longer cancels in flight. npm publication precedes git tags;
  an existing registry version stops the workflow for manual reconciliation.
  Stable dispatch publishes the reviewed package version without bot commits or
  protected-main pushes. See `docs/RELEASING.md` for recovery.

## Remaining limits / review prerequisites

- Independent security/current-target verification is required before readiness.
- Package AGENTS now links verified official Convex best practices instead of a
  missing generated AI guidance file. No generated instruction file was fabricated.
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
