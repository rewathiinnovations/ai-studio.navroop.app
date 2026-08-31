// @vitest-environment node
/**
 * Guards the fork's product-name layer.
 *
 * Nothing else covers it: `packages/views` tests render the untransformed
 * `RESOURCES` through their own i18n harness, and the web app's own tests
 * never mount the root layout. So this is the only thing standing between an
 * upstream i18n commit and "Multica" reappearing in the UI.
 */
import { describe, expect, it } from "vitest";
import { RESOURCES } from "@multica/views/locales";
import type { SupportedLocale } from "@multica/core/i18n";
import { createEnDict } from "@/features/landing/i18n/en";
import { createJaDict } from "@/features/landing/i18n/ja";
import { createKoDict } from "@/features/landing/i18n/ko";
import { createZhDict } from "@/features/landing/i18n/zh";
import { BRAND, rebrandResources, rebrandText } from "./brand";

const LOCALES: SupportedLocale[] = ["en", "zh-Hans", "ko", "ja"];

/** Every string leaf in a resource tree, flattened. */
function strings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (node === null || typeof node !== "object") return [];
  return Object.values(node).flatMap(strings);
}

describe("rebrandText", () => {
  it("replaces the product name", () => {
    expect(rebrandText("Welcome to Multica.")).toBe(`Welcome to ${BRAND.name}.`);
  });

  it("uses the brand's own possessive rather than appending an apostrophe", () => {
    expect(rebrandText("Multica's built-in agents")).toBe(
      `${BRAND.possessive} built-in agents`,
    );
  });

  // The locale files carry the lowercase name as a CLI binary, a plugin
  // manifest filename, a service name and an env var. A case-insensitive pass
  // would rewrite all four into commands that do not exist.
  it.each([
    "multica login --token <PAT>",
    "A .zip holding multica.plugin.json and every file it names.",
    "Direct passthrough to multica-cloud's /api/v1/billing/*.",
    "raised (MULTICA_OPENCLAW_CLI_TIMEOUT).",
    "Create with agent needs multica CLI >= 0.4.0.",
  ])("leaves the identifier in %j untouched", (line) => {
    expect(rebrandText(line)).toBe(line);
  });
});

describe("rebrandResources", () => {
  it.each(LOCALES)("leaves no display occurrence in %s", (locale) => {
    const remaining = strings(rebrandResources(RESOURCES[locale])).filter((s) =>
      s.includes("Multica"),
    );
    expect(remaining).toEqual([]);
  });

  it.each(LOCALES)("preserves the lowercase identifiers in %s", (locale) => {
    const before = strings(RESOURCES[locale]).filter((s) => /(?<!\w)multica/.test(s));
    const after = strings(rebrandResources(RESOURCES[locale])).filter((s) =>
      /(?<!\w)multica/.test(s),
    );

    expect(before.length).toBeGreaterThan(0);
    expect(after).toHaveLength(before.length);
  });

  // The desktop renderer and the packages/views test harness read the same
  // object, so an in-place rewrite would leak this fork's name into both.
  it("does not mutate its input", () => {
    const before = JSON.stringify(RESOURCES.en);
    rebrandResources(RESOURCES.en);
    expect(JSON.stringify(RESOURCES.en)).toBe(before);
  });

  it("maps string leaves inside arrays", () => {
    expect(rebrandResources({ items: ["Open Multica", 1, null] })).toEqual({
      items: [`Open ${BRAND.name}`, 1, null],
    });
  });

  it("returns a stable object for a stable input so the tree is built once", () => {
    expect(rebrandResources(RESOURCES.en)).toBe(rebrandResources(RESOURCES.en));
  });
});

// The landing pages have their own dictionaries that never touch RESOURCES, so
// the check above would not catch a regression here. The factories take
// `allowSignup` and both branches carry copy, so each is checked twice.
describe("landing dictionaries", () => {
  const factories = { en: createEnDict, ja: createJaDict, ko: createKoDict, zh: createZhDict };

  for (const [locale, factory] of Object.entries(factories)) {
    for (const allowSignup of [true, false]) {
      it(`leaves no display occurrence in ${locale} (allowSignup=${allowSignup})`, () => {
        const remaining = strings(rebrandResources(factory(allowSignup))).filter((s) =>
          s.includes("Multica"),
        );
        expect(remaining).toEqual([]);
      });
    }
  }

  it("preserves the lowercase CLI identifier in the changelog copy", () => {
    const all = strings(rebrandResources(createEnDict(true)));
    expect(all.some((s) => s.includes("multica login --token"))).toBe(true);
  });
});
