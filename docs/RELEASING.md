# Release controls and recovery

No release is authorized by this document. Keep `CANARY_ENABLED=false` and
`RELEASE_ENABLED=false` during candidate review. Stable dispatch requires main
and explicit `RELEASE_ENABLED=true`. Stable jobs do not cancel each other.

Stable dispatch publishes only the already-reviewed version in package.json.
Prepare version and changelog changes through a normal reviewed, signed PR.
The workflow never bumps versions, commits, or pushes to protected main.

Publication precedes GitHub release/tag creation so a failed registry upload
cannot strand an unreleased version behind an existing tag. GitHub creates the
release tag targeting the checked-out SHA after publication. This is not an
atomic transaction across npm and GitHub. An existing npm version fails closed;
do not blindly rerun or bump to bypass it.

If npm succeeded but release creation failed, a maintainer must compare registry
tarball integrity, source commit and intended version, then perform the missing
release step under separate authorization. If npm failed, verify registry state
before retrying; transport errors can be ambiguous. Never delete or overwrite a
published version as automatic recovery. No workflow was triggered in this audit.
