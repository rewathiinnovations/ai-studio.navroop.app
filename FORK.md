# Fork notes — NR AI Studio

This is a fork of [multica-ai/multica](https://github.com/multica-ai/multica) that renames the
**web app** to *NR AI Studio* and deploys it to Coolify. Deployment specifics live in
[COOLIFY.md](./COOLIFY.md).

> ## ⚠️ License constraint — read before extending this work
>
> Upstream is **not** plain Apache 2.0. `LICENSE` is the "Multica License": Apache 2.0 plus
> additional conditions. Condition **1(b)** states:
>
> > *Branding and copyright information: Unless the producer has granted you a written branding
> > waiver, you may not remove or modify the Multica LOGO, the Multica product name, or the
> > copyright and attribution information displayed by a Multica user interface.*
>
> Its definition of "Multica user interface" explicitly names `apps/web/`, `packages/views/` and
> `packages/ui/`, and adds that the code "remains covered when it is modified, moved, renamed, or
> extracted into another package or repository."
>
> **Everything in this document is what condition 1(b) restricts**, as is the removal of the
> upstream community links (see [Attribution removed](#attribution-removed)). Note this is separate
> from condition 1(a): internal single-organization use does not need a commercial license, but
> 1(b) is not scoped to hosted services, and 1(d) says a commercial license does not by itself waive
> it.
>
> This rebrand was applied as a deliberate, informed decision by the repository owner for a private
> internal instance. It is recorded here — not as legal advice — so that no future reader assumes
> the rename was licence-clean by default. If a written branding waiver is obtained, note it here.
> If one cannot be, the whole rebrand is confined to the files tabulated below and to
> `apps/web/lib/brand.ts`, and is straightforward to revert.

Upstream commits constantly, much of it i18n and UI churn. The whole design of this rebrand exists
to make `git merge upstream/main` boring.

```bash
git remote add upstream https://github.com/multica-ai/multica.git
git fetch upstream
git checkout -b brand/nr-ai-studio
```

## The rule that shapes everything

`multica` appears in roughly 2,650 files. Almost all of them are **identifiers**, not branding, and
renaming any of them would conflict on nearly every upstream commit forever:

| Kind | Example | Why it must not change |
| --- | --- | --- |
| Workspace package names | `@multica/core`, `@multica/ui`, `@multica/views` | ~2,000 import sites |
| Component and file names | `MulticaIcon`, `multica-landing.tsx` | conflicts on every upstream edit to those files |
| Cookies and storage keys | `multica_token`, `__multica` | breaks sessions and the backend contract |
| HTTP headers | `x-multica-locale` | read by `proxy.ts` and the RSC layouts |
| Env var names | `MULTICA_APP_URL`, `MULTICA_VCS_SECRET_KEY` | the Go backend reads these |
| Go module path, DB name and user | `server/go.mod`, `postgres://multica:…` | out of scope |
| CLI and plugin identifiers | `multica daemon restart`, `multica.plugin.json` | real commands users type |
| Code comments | `// Multica's built-in agents…` | invisible to users |

**Only user-visible text and visual assets change.** Nothing in `apps/desktop`, `apps/mobile`,
`server/`, or `deploy/helm` is touched.

## How the rename actually works

Rather than editing 324 locale strings and ~250 landing dictionary strings — which would conflict
constantly — the resource trees stay **byte-identical to upstream** and are transformed on the way
into the providers. New upstream strings get renamed automatically.

```
apps/web/lib/brand.ts ──┬─→ apps/web/app/layout.tsx:143        (i18next: 4 locales x 25 namespaces)
                        ├─→ features/landing/i18n/context.tsx   (4 landing dictionaries)
                        └─→ apps/web/lib/use-cases-i18n.ts      (8 use-case index strings)

packages/views/locales/**  UNCHANGED  ──→  apps/desktop  (keeps upstream's name, by design)
```

`rebrandText` is **case-sensitive**. A case-insensitive pass would rewrite the lowercase
identifiers that legitimately appear inside user-facing strings — `multica login --token`,
`multica.plugin.json`, `multica-cloud`, `MULTICA_OPENCLAW_CLI_TIMEOUT`, `multica CLI`. That is
pinned by tests in `apps/web/lib/brand.test.ts`.

`rebrandResources` copies and never mutates: the input is the shared `RESOURCES` object that the
desktop renderer and the `packages/views` test harness also read.

### Why there is no hydration mismatch

`apps/web/components/web-providers.tsx` does **not** import `RESOURCES` — `resources` is a
pass-through prop, and `createI18n` receives it directly with no merge and no backend plugin. The
server render and the client hydration therefore see one object from one transform.

### Why there is no CJK branch

There is no translated form of the product name anywhere in the locale tree — zero hits for `多卡`,
`マルチカ`, `멀티카`. All four locales carry the Latin `Multica`, so one regex covers everything.

## Files this fork changes

### New files (these can never conflict)

| File | Purpose |
| --- | --- |
| `apps/web/lib/brand.ts` | `BRAND`, `rebrandText`, `rebrandResources` |
| `apps/web/lib/brand.test.ts` | the regression guard against upstream i18n churn |
| `scripts/generate-web-icons.mjs` | rasterizes `icon.svg` (replaces upstream's macOS-only `sips` recipe) |
| `docker-compose.coolify.yml` | the Coolify deployment |
| `FORK.md`, `COOLIFY.md` | this file and the deploy notes |

### Transform wires — two lines, the highest-value edits here

| File | Change |
| --- | --- |
| `apps/web/app/layout.tsx` | wrap `RESOURCES[locale]` in `rebrandResources` |
| `apps/web/features/landing/i18n/context.tsx` | wrap the dictionary factory **result** (the factories take `allowSignup`, so they must be called first) |
| `apps/web/lib/use-cases-i18n.ts` | wrap the exported `useCaseText` object |

### Direct string edits

| File | What |
| --- | --- |
| `apps/web/platform/document-title.ts` | `SITE_TITLE` and `TITLE_SUFFIX` — rebrands **every** tab title in the app |
| `apps/web/app/layout.tsx` | `appleWebApp.title`, `openGraph.siteName`, `metadataBase`; dropped `twitter.site`/`creator` (upstream's `@multica_hq` is not ours) |
| `apps/web/app/manifest.ts` | `name`, `short_name`, and the icon-regeneration comment |
| `apps/web/app/not-found.tsx` | "Back to …" |
| `apps/web/app/auth/callback/page.tsx` | the desktop hand-off copy — see the caveat below |
| `apps/web/app/(landing)/layout.tsx` | JSON-LD `Organization` and `SoftwareApplication` name and url; dropped `sameAs` (pointed at upstream's GitHub org) |
| `apps/web/app/(landing)/{page,homepage,about,changelog,contact-sales,download}/page.tsx` | metadata titles and descriptions. `page.tsx` and `homepage/page.tsx` now reuse `SITE_TITLE`, and `changelog` reuses `TITLE_SUFFIX`, instead of re-hardcoding it |
| `apps/web/features/landing/components/features-section.tsx` | two "… Demo" labels in the mock UI |
| `apps/web/content/use-cases/auto-data-analysis.{en,zh,ja,ko}.mdx` | 27 occurrences in prose, headings and image alt text |

`about/page.tsx` needed rewriting rather than substituting: upstream's description expanded
*Multica* as a backronym ("multiplexed information and computing agent"), which does not survive
the rename.

### Assets

`apps/web/public/favicon.svg` and `apps/web/public/icons/icon.svg` are a placeholder **"NR"
monogram**, built from stroked geometric primitives rather than `<text>` so rasterization never
depends on an installed font. The four PNGs are generated:

```bash
node scripts/generate-web-icons.mjs
```

All four derive from `icon.svg`. Upstream sourced `icon-192.png` and `icon-512.png` from
`apps/desktop/build/icon.png` so the web and desktop app icons matched; this fork does not rebrand
desktop, so pulling from it would ship upstream artwork on our web icon.

`packages/ui/components/common/multica-icon.tsx` — the 8-point asterisk still used as the in-app
mark and the loading indicator — is **not** touched. It is shared with desktop and carries no name,
so it needs no change.

### Tests changed

| File | Change |
| --- | --- |
| `apps/web/platform/document-title.test.tsx` | 9 assertions now use `TITLE_SUFFIX` instead of a literal `" \| Multica"`. They cover the page-name-then-suffix **contract**, so they will not break on a future rename either. |
| `e2e/navigation.spec.ts` | 3 `toHaveTitle` assertions → `TITLE_SUFFIX` |
| `e2e/auth.spec.ts` | 4 "Sign in to …" assertions → `BRAND.name` |
| `e2e/issues.spec.ts` | 1 tab-title assertion → `BRAND.name` |
| `e2e/onboarding-smoke.spec.ts` | 2 onboarding question assertions → `BRAND.name` |

The 25 brand assertions in `packages/views` **stay green untouched**, because the transform is
web-local and the locale JSON is byte-identical to upstream — those tests render raw `RESOURCES`
through `packages/views/test/i18n.tsx`. `locales/parity.test.ts` compares key sets, not values, so
it is indifferent.

## Known leaks and caveats

Three deliberate compromises, all reversible:

1. **`packages/views` is shared with desktop.** Two files are edited there, so the desktop app also
   shows the new name in those two places:
   - `packages/views/layout/app-sidebar.tsx` — the `workspace?.name` fallback (and its paired
     avatar initial, `"M"` → `"N"`). Only visible before a workspace loads.
   - `packages/views/onboarding/templates/install-runtime-issue.ts` — 15 strings across the
     `en`/`zh`/`ko`/`ja` onboarding markdown. Its `INSTALL_RUNTIME_ISSUE_TITLE` export carries no
     brand string, so the Go server's title-based dedupe in `onboarding_shim.go` is unaffected, and
     the `multica daemon restart` command inside the template is left alone.

   To un-leak later: thread the name through props or i18n instead of hardcoding.

2. **`apps/web/app/auth/callback/page.tsx` says "Open NR AI Studio Desktop"** but the desktop app it
   deep-links to (`multica://`) is upstream's, still branded Multica. Renamed anyway for
   consistency: the equivalent i18n string in `auth.json` goes through the transform, so leaving
   this hardcoded one would have produced a visible split.

3. **`/download` still points at upstream's GitHub releases.** `features/landing/utils/github-release.ts`
   and `app/(landing)/download/download-client.tsx` fetch and link
   `github.com/multica-ai/multica/releases`. This fork does not build the desktop app, so those are
   the only real download artifacts — the URLs are load-bearing, not branding. `multica-ai`
   therefore still appears in the HTML of `/download`.

## Attribution removed

The upstream community links were **removed** from the landing surfaces at the repository owner's
explicit instruction. See the [licence note](#️-license-constraint--read-before-extending-this-work)
above: this is the attribution material condition 1(b) covers.

`features/landing/components/shared.tsx` still *exports* `githubUrl`, `twitterUrl` and `discordUrl`
— left in place so upstream edits to that file merge cleanly — but nothing renders them any more:

| File | Removed |
| --- | --- |
| `landing-footer.tsx` | the X / GitHub / Discord icon row; the `UPSTREAM_LINKS` filter also drops the "API", "Discord" and "GitHub" entries out of the dictionary-driven footer columns at render time, so `i18n/{en,ja,ko,zh}.ts` stay byte-identical to upstream |
| `landing-header.tsx` | the desktop and mobile GitHub buttons, plus the `useGithubStars` hook and the `GitHubStarsBadge` component that only existed to decorate them |
| `open-source-section.tsx`, `how-it-works-section.tsx`, `about-page-client.tsx` | one GitHub CTA button each |

Their i18n strings (`t.header.github`, `t.openSource.cta`, `t.about.cta`,
`t.howItWorks.ctaGithub`) are now unreferenced but left in the dictionaries, again to avoid
conflicts. To restore attribution, re-add the links — the constants and the copy are all still
there.

### Lowercase wordmarks — easy to miss

Three visible wordmarks rendered the name in **lowercase** (`multica`, via a CSS `lowercase`
class), so a case-sensitive `/Multica/` sweep does not find them and neither does a check of the
rendered HTML. They were caught by grepping for the lowercase form in JSX:

- `landing-header.tsx` — the header wordmark
- `landing-footer.tsx` — the small footer wordmark, and the giant serif one

All three now render `BRAND.name` with the `lowercase` class dropped, because "nr ai studio" reads
badly for an acronym. The giant footer wordmark also needed its font size reduced from
`clamp(6rem,22vw,16rem)` to `clamp(2.5rem,11vw,8rem)`: upstream sized it for 7 characters and
"NR AI Studio" is 12, which overflowed its `overflow-hidden` parent.

A fourth, `features-section.tsx`, had `github.com/multica/server/internal/handler` as fake terminal
output in the product mock; it now reads `github.com/nrai/...`.

When merging upstream, re-run this check — it is the one the main sweep misses:

```bash
rg -n '(?-i)\bmultica\b' apps/web/features apps/web/app --glob '*.tsx' \
  | rg -v 'https://|@multica/|multica-icon|multica-landing|multica://'
```

## Not touched, on purpose

`apps/web/lib/public-host.ts` keeps `OFFICIAL_MARKETING_HOSTS = { multica.ai, www.multica.ai }`.
Because our host is **not** in that set, `proxy.ts` sends a signed-in user hitting `/` straight to
their workspace instead of the landing page — the correct self-host behaviour. Do not add our
domain there.

## Re-applying after `git merge upstream/main`

The transform absorbs new upstream i18n strings by itself. The work is confined to conflicts in the
files listed above.

```bash
git fetch upstream
git checkout brand/nr-ai-studio
git merge upstream/main
```

1. **Resolve conflicts.** Only the "Direct string edits" and "Transform wires" tables above can
   conflict; the new files cannot. In each case keep *our* side and re-apply upstream's semantic
   change on top.

2. **Re-run the guard.** This is the check that matters — it fails if upstream added a brand string
   the transform does not reach, or if a new locale string introduced an identifier the
   case-sensitive regex would eat:

   ```bash
   pnpm --filter @multica/web test -- lib/brand.test.ts
   ```

3. **Full gate.**

   ```bash
   pnpm --filter @multica/web test && pnpm --filter @multica/views test \
     && pnpm --filter @multica/web typecheck && pnpm --filter @multica/web lint \
     && pnpm --filter @multica/ui typecheck && pnpm --filter @multica/views typecheck
   ```

4. **Sweep for anything the transform missed.** Every remaining hit should be an identifier, a
   comment, a URL, or one of the two intentionally-untransformed source files
   (`lib/use-cases-i18n.ts`, `lib/brand.ts`):

   ```bash
   rg -n 'Multica' apps/web --glob '!**/*.test.*' \
     | rg -v 'MulticaIcon|MulticaLanding|@multica/|multica-icon|multica-landing|https://'
   ```

5. **If upstream changed `apps/desktop/build/icon.png` or the icon pipeline**, regenerate ours:
   `node scripts/generate-web-icons.mjs`.

6. **Rebuild, do not restart.** The brand name is compiled into the JS bundle by `next build`.

## Pre-existing upstream failures

Present on a clean checkout of this commit, unrelated to the rebrand. Do not mistake them for
regressions:

- `apps/web` → `app/type-scale.test.ts` fails on arbitrary font sizes in `landing-hero.tsx` and
  `open-source-section.tsx`.
- `packages/views` → `rich-content/rich-content-boundary.test.ts` fails on
  `editor/extensions/code-block-view.tsx`.
- `e2e/plugin-surface-document.spec.ts` imports `buildSurfaceDocument`, but the module exports
  `buildSurfaceFrameDocument`. This aborts the **entire** Playwright run, so pass explicit spec
  names until upstream fixes it.
- The `packages/views` suite is flaky under parallel load — `search/search-command.test.tsx` in
  particular. Re-run a failing file in isolation before believing it.
