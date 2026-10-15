import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../site-nav";

/*
 * Public careers page: who we are and open roles for potential employees.
 * Same shell as the landing page — no dashboard, no session gate. Jobs are
 * static; apply via Indeed when a URL is set, otherwise mailto to hiring.
 */

export const metadata: Metadata = {
  title: "Careers — Cedar Grove Senior Health Solutions",
};

const PHONE = "985-282-1000";
const APPLY_EMAIL = "jmonte@cedargrovemedins.com";
const ADDRESS = ["406 N. Florida Street, Suite 1", "Covington, LA 70433"];

const WHO_WE_ARE =
  "Cedar Grove Senior Health Solutions is a local Medicare-focused agency in Covington, Louisiana. Our goal is to help clients feel comfortable and confident in their health insurance decisions. By working with licensed agents, clients get outstanding service and a tailored experience, with their best interests at heart.";

const WHY_JOIN =
  "We are a small, hands-on team that values personal attention, clear communication, and doing right by the people we serve. If you care about helping seniors navigate Medicare with patience and expertise, we would like to hear from you.";

type Job = {
  id: string;
  title: string;
  location: string;
  summary: string;
  /** Paste a real Indeed posting URL when ready; null uses email only. */
  indeedUrl: string | null;
};

const JOBS: Job[] = [
  {
    id: "medicare-advisor",
    title: "Medicare Advisor",
    location: "Covington, LA",
    summary:
      "Help seniors compare and enroll in Medicare plans. Work with a licensed local team that puts clients first.",
    indeedUrl: null,
  },
  {
    id: "client-service-specialist",
    title: "Client Service Specialist",
    location: "Covington, LA",
    summary:
      "Support clients and agents with day-to-day service — questions, paperwork, and follow-up that keeps coverage on track.",
    indeedUrl: null,
  },
];

const WRAP = "mx-auto w-full max-w-(--breakpoint-2xl) px-4 sm:px-6 lg:px-10";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-md bg-brand-strong px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const TEXT_LINK_CLASS = "font-medium text-brand-ink hover:underline";

function applyMailto(title: string): string {
  return `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(`Application: ${title}`)}`;
}

export default function CareersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteNav sections={[]} phone={PHONE} pageLinks={[{ href: "/careers", label: "Careers" }]} />

      <main className="flex-1">
        <section className="bg-brand-gradient">
          <div className={`${WRAP} py-16 sm:py-24`}>
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight text-gradient-ink sm:text-5xl">
                Careers at Cedar Grove
              </h1>
              <p className="mt-5 text-lg text-gradient-ink-muted">
                Join a local team helping seniors make confident Medicare decisions.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="who-heading" className={`${WRAP} py-14`}>
          <h2 id="who-heading" className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Who we are
          </h2>
          <p className="mt-4 max-w-2xl text-base text-fg-muted">{WHO_WE_ARE}</p>
          <p className="mt-4 max-w-2xl text-base text-fg-muted">{WHY_JOIN}</p>
          <p className="mt-4 text-sm text-fg-muted">
            {ADDRESS[0]}, {ADDRESS[1]}
          </p>
        </section>

        <section
          id="openings"
          aria-labelledby="openings-heading"
          className={`${WRAP} scroll-mt-16 border-t border-line py-14`}
        >
          <h2 id="openings-heading" className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Open roles
          </h2>

          {JOBS.length === 0 ? (
            <p className="mt-6 max-w-2xl text-base text-fg-muted">
              No openings right now. You can still reach out at{" "}
              <a href={`mailto:${APPLY_EMAIL}`} className={TEXT_LINK_CLASS}>
                {APPLY_EMAIL}
              </a>
              .
            </p>
          ) : (
            <ul className="mt-8 space-y-4">
              {JOBS.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-fg">{job.title}</h3>
                    <p className="mt-1 text-sm text-fg-muted">{job.location}</p>
                    <p className="mt-3 text-sm text-fg-muted">{job.summary}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-stretch">
                    {job.indeedUrl ? (
                      <>
                        <a
                          href={job.indeedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={PRIMARY_BUTTON_CLASS}
                        >
                          Apply on Indeed
                        </a>
                        <a href={applyMailto(job.title)} className={SECONDARY_BUTTON_CLASS}>
                          Email to apply
                        </a>
                      </>
                    ) : (
                      <a href={applyMailto(job.title)} className={PRIMARY_BUTTON_CLASS}>
                        Email to apply
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-line bg-surface-muted">
        <div className={`${WRAP} py-10 text-sm text-fg-muted`}>
          <p className="font-medium text-fg">Cedar Grove Senior Health Solutions</p>
          <p className="mt-2">
            {ADDRESS[0]}, {ADDRESS[1]} ·{" "}
            <a href={`tel:${PHONE}`} className="hover:text-fg hover:underline">
              {PHONE}
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/" className="hover:text-fg hover:underline">
              Home
            </Link>
            <Link href="/login" className="hover:text-fg hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
