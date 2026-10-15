import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import {
  AboutSection,
  ApproachSection,
  FaqSection,
} from "@/components/marketing/home-sections";
import { ReviewsCarousel } from "@/components/marketing/reviews-carousel";
import { ServicesCarousel } from "@/components/marketing/services-carousel";
import { ReadyCta, SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getSessionUser } from "@/lib/session";

/*
 * Public homepage ported from cg-seniorhealth (HTML/Tailwind/JS → Next.js).
 * Signed-in staff still skip this and land in the CRM.
 */

export const metadata: Metadata = {
  title: "Cedar Grove Senior Health Solutions | Solutions You Can Count On",
  description:
    "Cedar Grove Senior Health Solutions — Independent Medicare specialists in Covington, Louisiana. Solutions You Can Count On.",
  icons: {
    icon: "/assets/brand/favicon.png",
    apple: "/assets/brand/favicon.png",
  },
};

export default async function LandingPage() {
  if (await getSessionUser()) redirect("/overview");

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SiteHeader current="home" />
      <main id="main">
        <HeroCarousel />
        <ApproachSection />
        <ServicesCarousel />
        <FaqSection />
        <ReviewsCarousel />
        <AboutSection />
      </main>
      <ReadyCta />
      <SiteFooter />
    </>
  );
}
