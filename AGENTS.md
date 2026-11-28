<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

For Convex API and transaction guidance, consult the official
[Convex best practices](https://docs.convex.dev/understanding/best-practices).
<!-- convex-ai-end -->

# @vllnt/convex-progression

XP / level / streak windows as a Convex component. Follows the vllnt Component
Standard (hub `AGENTS.md`).

`AGENTS.md` is the sole agent-instruction source. Do not add `CLAUDE.md`.

## Architecture

```
src/
├── shared.ts
├── test.ts
├── client/
└── component/   # schema, mutations, queries, validators, convex.config.ts
```

## Ownership

- **Component owns:** progress row, level-from-thresholds math, streak
  transitions.
- **Host owns:** auth, `subjectRef` / `key`, the threshold list, period keys.
- **Not this component:** wallet, quota, leaderboards (`@convex-dev/aggregate`).

## Conventions

- Mutations in `mutations.ts`, queries in `queries.ts`.
- Explicit `args` + `returns`. No bare `v.any()`.
- 100% test coverage is BLOCKING.
- `**/_generated/**` is Convex CLI-owned; run `pnpm codegen`.
- README, `llms.txt` and `docs/API.md` follow the shared docs contract in
  `scripts/check-documentation.mjs`, run by `pnpm lint` and, on the packed
  package, by `node scripts/check-pack.mjs`, which also type-checks the README
  and `docs/API.md` examples (`ts` blocks that start with `// <path>.ts`)
  against the built package.
