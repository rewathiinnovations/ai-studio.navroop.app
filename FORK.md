# Fork notes

This is a fork of [multica-ai/multica](https://github.com/multica-ai/multica) that adds a
Coolify single-domain self-hosting deployment. It changes nothing else. Deployment specifics
live in [COOLIFY.md](./COOLIFY.md).

The web UI ships with upstream Multica branding. License condition 1(b) prohibits changing it
without a written branding waiver. The rebrand work is parked, undeployed, on branch
`brand/nr-ai-studio`.

Internal single-organization self-hosting is permitted by condition 1(a) without a commercial
license. Condition 1(b) is separate and is not waived by 1(a).

```bash
git remote add upstream https://github.com/multica-ai/multica.git
git fetch upstream
```

## Pre-existing upstream test failures

Present on a clean checkout of `main`, unrelated to this fork. Do not mistake them for
regressions:

- `apps/web` → `app/type-scale.test.ts` fails on arbitrary font sizes in `landing-hero.tsx` and
  `open-source-section.tsx`.
- `packages/views` → `rich-content/rich-content-boundary.test.ts` fails on
  `editor/extensions/code-block-view.tsx`.
- `e2e/plugin-surface-document.spec.ts` imports `buildSurfaceDocument`, but the module exports
  `buildSurfaceFrameDocument`. This aborts the entire Playwright run, so pass explicit spec
  names until upstream fixes it.
- The `packages/views` suite is flaky under parallel load — `search/search-command.test.tsx` in
  particular. Re-run a failing file in isolation before believing it.
