import type { Metadata } from "next";
import { AboutPageClient } from "@/features/landing/components/about-page-client";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  // Upstream's description expanded "Multica" as a backronym ("multiplexed
  // information and computing agent"), which does not survive the rename.
  description: `Learn about ${BRAND.name} — a project management platform for human + agent teams.`,
  openGraph: {
    title: `About ${BRAND.name}`,
    description: `The story behind ${BRAND.name} and why we're building project management for human + agent teams.`,
    url: "/about",
  },
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
