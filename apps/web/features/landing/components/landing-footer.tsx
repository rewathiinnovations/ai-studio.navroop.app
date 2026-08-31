"use client";

import Link from "next/link";
import { MulticaIcon } from "@multica/ui/components/common/multica-icon";
import { cn } from "@multica/ui/lib/utils";
import { useAuthStore } from "@multica/core/auth";
import { githubUrl, twitterUrl, discordUrl } from "./shared";
import { useLocale, locales, localeLabels } from "../i18n";
import { useDashboardCtaHref } from "../utils/use-dashboard-cta";
import { BRAND } from "@/lib/brand";

// This fork does not carry upstream's community links. Filtered at render time
// rather than edited out of i18n/{en,ja,ko,zh}.ts, which stay byte-identical to
// upstream so their footer columns merge cleanly. See FORK.md.
const UPSTREAM_LINKS: readonly string[] = [githubUrl, twitterUrl, discordUrl];

export function LandingFooter() {
  const { t, locale, setLocale } = useLocale();
  const user = useAuthStore((s) => s.user);
  const ctaHref = useDashboardCtaHref();
  const groups = Object.values(t.footer.groups).map((group) => ({
    ...group,
    links: group.links.filter((link) => !UPSTREAM_LINKS.includes(link.href)),
  }));

  return (
    <footer className="bg-[#0a0d12] text-white">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        {/* Top: CTA + link columns */}
        <div className="flex flex-col gap-12 border-b border-white/10 py-16 sm:py-20 lg:flex-row lg:gap-20">
          {/* Left — newsletter / CTA */}
          <div className="lg:w-[340px] lg:shrink-0">
            <Link href="#product" className="flex items-center gap-3">
              <MulticaIcon className="size-5 text-white" noSpin />
              <span className="text-title font-semibold tracking-[0.04em]">
                {BRAND.name}
              </span>
            </Link>
            <p className="mt-4 max-w-[300px] text-body leading-[1.7] text-white/50 sm:text-body-lg">
              {t.footer.tagline}
            </p>
            <div className="mt-6">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-[11px] bg-white px-5 py-2.5 text-label font-semibold text-[#0a0d12] transition-colors hover:bg-white/88"
              >
                {user ? t.header.dashboard : t.footer.cta}
              </Link>
            </div>
          </div>

          {/* Right — link columns */}
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            {groups.map((group) => (
              <div key={group.label}>
                <h4 className="text-caption font-semibold uppercase tracking-[0.1em] text-white/40">
                  {group.label}
                </h4>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        {...(link.href.startsWith("http")
                          ? { target: "_blank", rel: "noreferrer" }
                          : {})}
                        className="text-body text-white/50 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: copyright + language switcher */}
        <div className="flex items-center justify-between py-6">
          <p className="text-label text-white/36">
            {t.footer.copyright.replace(
              "{year}",
              String(new Date().getFullYear()),
            )}
          </p>
          <div className="flex items-center">
            {locales.map((l, i) => (
              <button
                type="button"
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  "px-1.5 py-1 text-caption font-medium transition-colors",
                  l === locale
                    ? "text-white/70"
                    : "text-white/30 hover:text-white/50",
                  i > 0 && "border-l border-white/16",
                )}
              >
                {localeLabels[l]}
              </button>
            ))}
          </div>
        </div>

        {/* Giant logo */}
        <div className="relative overflow-hidden pb-4">
          <div className="flex items-end gap-6 sm:gap-8">
            <MulticaIcon
              className="size-[clamp(4rem,12vw,10rem)] shrink-0 text-white"
              noSpin
            />
            {/* Sized down from upstream's clamp(6rem,22vw,16rem): that was set
                for a 7-character wordmark and "NR AI Studio" is 12, which
                overflowed into the parent's overflow-hidden. */}
            <span className="landing-serif text-[clamp(2.5rem,11vw,8rem)] font-normal leading-[0.82] tracking-[-0.04em] text-white">
              {BRAND.name}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
