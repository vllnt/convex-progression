<!-- Badges -->
[![convex-component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://www.convex.dev/components)
[![license](https://img.shields.io/npm/l/@vllnt/convex-progression.svg)](./LICENSE)

# @vllnt/convex-progression

XP → level and streak windows as a Convex component.

Not money (`convex-wallet`), not a resetting cap (`convex-quota`). The host
passes opaque `subjectRef` + `key` and the level `thresholds` on each write.

```ts
const xp = new Progression(components.progression);
await xp.accrue(ctx, subjectRef, "solo", 10, [50, 150, 400]);
await xp.recordActivity(ctx, subjectRef, "solo", today, [], {
  expectedPrevious: yesterday,
});
```

Peer dependency: `convex@^1.45.0`.

```ts
import progression from "@vllnt/convex-progression/convex.config";
app.use(progression);
```

## Author

Maintained by [bntvllnt](https://github.com/bntvllnt) · [bntvllnt.com](https://bntvllnt.com)
