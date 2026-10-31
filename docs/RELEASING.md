# Release controls and recovery

Every publish runs in `.github/workflows/publish.yml` with npm trusted
publishing and provenance. The workflow holds no npm token and nothing is
published from a local machine.

- Canary (`@canary`): a push to `main` publishes one when the `CANARY_ENABLED`
  repository variable is `true`; otherwise run the workflow manually on `main`.
- Stable (`@latest`): merge a reviewed PR that sets `package.json` `version` and
  adds a matching `## [X.Y.Z]` entry to `CHANGELOG.md`, then push the tag
  `vX.Y.Z` on that `main` commit. The workflow refuses a tag that does not match
  `package.json`, has no changelog entry, or is not on `main`. It never bumps
  versions, commits, or pushes.

npm publication precedes GitHub release creation. If npm succeeded but the
release step failed, re-running the workflow skips the publish and creates the
release. An existing npm version is never overwritten; if npm failed, verify
registry state before retrying because transport errors can be ambiguous. Never
delete or overwrite a published version as automatic recovery.
