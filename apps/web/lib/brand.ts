/**
 * Product-name layer for this fork.
 *
 * Upstream ships the name "Multica" in ~324 locale strings and ~250 landing
 * dictionary strings. Editing those files would conflict on every upstream
 * i18n commit, so instead the resource trees stay byte-identical to upstream
 * and get transformed on the way into the providers. Two call sites do it:
 *
 *   - apps/web/app/layout.tsx        → the i18next bundle (4 locales x 25 ns)
 *   - apps/web/features/landing/i18n/context.tsx → the landing dictionaries
 *
 * Both are web-only. apps/desktop imports the same untransformed `RESOURCES`
 * and keeps upstream's name, which is deliberate — see FORK.md.
 *
 * Pure and dependency-free on purpose: the landing provider is a client
 * component, so everything here is bundled for the browser too.
 */

export const BRAND = {
  name: "NR AI Studio",
  shortName: "NR AI Studio",
  possessive: "NR AI Studio's",
} as const;

/**
 * Replace the upstream product name in a single string.
 *
 * Case-sensitive by design. A case-insensitive pass would also rewrite the
 * identifiers that legitimately carry the lowercase name and must keep
 * working: the `multica` CLI binary, `multica.plugin.json`, the
 * `multica-cloud` service, and the `MULTICA_OPENCLAW_CLI_TIMEOUT` env var all
 * appear inside user-facing locale strings.
 *
 * The possessive is handled first so a future brand name ending in "s" can
 * render its own possessive rather than getting a mechanical "'s" appended.
 */
export function rebrandText(value: string): string {
  return value
    .replace(/Multica's/g, BRAND.possessive)
    .replace(/Multica/g, BRAND.name);
}

/**
 * Memo keyed on the input node, so a stable module-level resource tree is
 * transformed once per process instead of once per request. `RESOURCES[locale]`
 * is a static import, which makes every request after the first a cache hit.
 */
const cache = new WeakMap<object, unknown>();

/**
 * Deep-map every string leaf of a resource tree through {@link rebrandText}.
 *
 * Copies rather than mutating: the input is the shared `RESOURCES` object that
 * the desktop app and the `packages/views` test harness also read, and an
 * in-place rewrite would leak this fork's name into both.
 */
export function rebrandResources<T>(node: T): T {
  if (typeof node === "string") return rebrandText(node) as T;
  if (node === null || typeof node !== "object") return node;

  const cached = cache.get(node);
  if (cached !== undefined) return cached as T;

  const result = Array.isArray(node)
    ? node.map((item) => rebrandResources(item))
    : Object.fromEntries(
        Object.entries(node).map(([key, value]) => [key, rebrandResources(value)]),
      );

  cache.set(node, result);
  return result as T;
}
