import type { Metadata } from "next";
import { MulticaLanding } from "@/features/landing/components/multica-landing";
import { BRAND } from "@/lib/brand";
import { SITE_TITLE } from "@/platform/document-title";

export const metadata: Metadata = {
  title: "Homepage",
  description: `${BRAND.name} — open-source platform that turns coding agents into real teammates. Assign tasks, track progress, compound skills.`,
  openGraph: {
    title: SITE_TITLE,
    description:
      "Manage your human + agent workforce in one place.",
    url: "/homepage",
  },
  alternates: {
    canonical: "/homepage",
  },
};

export default function HomepagePage() {
  return <MulticaLanding />;
}
