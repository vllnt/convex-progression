<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.
<!-- convex-ai-end -->

# @vllnt/convex-progression

XP / level / streak windows as a Convex component. Follows the vllnt Component
Standard (hub `AGENTS.md`).

`AGENTS.md` is the sole agent-instruction source. Do not add `CLAUDE.md`.

## Ownership

- **Component owns:** progress row, level-from-thresholds math, streak transitions.
- **Host owns:** auth, `subjectRef` / `key`, the threshold list, period keys.
- **Not this component:** wallet, quota, leaderboards (`@convex-dev/aggregate`).

100% coverage is BLOCKING. No bare `v.any()`.
