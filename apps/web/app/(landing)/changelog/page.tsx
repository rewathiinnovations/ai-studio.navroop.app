import type { Metadata } from "next";
import { ChangelogPageClient } from "@/features/landing/components/changelog-page-client";
import { BRAND } from "@/lib/brand";
import { TITLE_SUFFIX } from "@/platform/document-title";

export const metadata: Metadata = {
  title: "Changelog",
  description: `See what's new in ${BRAND.name} — latest features, improvements, and fixes.`,
  openGraph: {
    title: `Changelog${TITLE_SUFFIX}`,
    description: `Latest updates and releases from ${BRAND.name}.`,
    url: "/changelog",
  },
  alternates: {
    canonical: "/changelog",
  },
};

export default function ChangelogPage() {
  return <ChangelogPageClient />;
}
