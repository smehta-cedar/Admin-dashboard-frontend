import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { SiteNav, type SiteNavSection } from "./site-nav";

/*
 * The Cedar Grove Senior Health homepage, public and outside the dashboard
 * group: no sidebar, no session gate, the same logo and theme toggle as
 * sign-in. One page of in-page sections with the copy from
 * cedargroveseniorhealth.com and the service tiles, reviews and FAQ from the
 * Medicare site. The one way in is staff sign-in at /login.
 * A visitor who is already signed in goes straight to the CRM home instead.
 *
 * Color: the brand gradient (globals.css, sampled from assests/Gradient.jpg)
 * paints the hero, the reviews band and the FAQ. It is too light for white
 * text, so headings on it use `gradient-ink` (dark in both themes) and body
 * copy sits on surface cards, which follow the theme. Service tiles are
 * brand-strong with white labels, which already clears contrast.
 *
 * No booking form and no mailer: contact is the office's phone and email.
 */

export const metadata: Metadata = {
  title: "Cedar Grove Senior Health Solutions",
};

const PHONE = "985-282-1000";
const FAX = "985-951-2048";
const EMAIL = "info@cedargroveseniorhealth.com";
const ADDRESS = ["406 N. Florida Street, Suite 1", "Covington, LA 70433"];
const FACEBOOK = "https://www.facebook.com/cedargrovemedins";
const WEBINAR = "https://www.cedargrovemedicare.com/webinar";

/** The navbar's section links, in page order. Each id is on its `<section>`. */
const SECTIONS: SiteNavSection[] = [
  { id: "services", label: "Services" },
  { id: "about", label: "About" },
  { id: "reviews", label: "Reviews" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

const ABOUT =
  "Here at Cedar Grove, our goal is to help our clients feel comfortable and confident in their health insurance decisions. By working with a local, licensed agent, our clients can feel secure knowing we are providing outstanding service and a tailored experience, while keeping their best interests at heart.";

/** Six tiles; each "Read more" scrolls to the block with the same id below them. */
const SERVICES = [
  {
    id: "medicare-supplements",
    name: "Medicare Supplements",
    line: "A popular way to supplement Original Medicare Parts A and B.",
    body: "Medicare Supplements, also known as Medigap plans, are sold by private insurance companies to help cover the out-of-pocket costs that Medicare Parts A and B leave behind.",
  },
  {
    id: "medicare-advantage",
    name: "Medicare Advantage",
    line: "An alternative to Original Medicare, typically HMO and PPO plans with network providers.",
    body: "Medicare Advantage, also known as Medicare Part C, is health coverage from private insurance companies approved by Medicare. Every plan covers at least what Original Medicare does, and most add extra benefits on top.",
  },
  {
    id: "prescription-drug-plans",
    name: "Prescription Drug Plans",
    line: "CMS drug coverage that helps with the cost of prescriptions.",
    body: "Medicare Part D is the federal prescription drug program, administered through private insurance companies. It covers medications at the pharmacy, which Original Medicare does not include.",
  },
  {
    id: "dental-plans",
    name: "Dental Plans",
    line: "A sought-after benefit, with plans to compare.",
    body: "One of the most sought after plans is Dental insurance. We have a variety of plans to review to see which is best for you and your needs.",
  },
  {
    id: "vision-plans",
    name: "Vision Plans",
    line: "Help when a medical plan has little or no coverage for exams and prescription eyewear.",
    body: "Many plans have little or no coverage when it comes to prescription eye wear and exams. We can help find a plan that is right for you.",
  },
  {
    id: "hearing-plans",
    name: "Hearing Plans",
    line: "Options for hearing aids and exams.",
    body: "Many of our clients came to us with a need to have benefits for hearing aids and exams. We have options to help with this benefit.",
  },
];

/** The public site's roster, name and title only. Not the CRM's agents list. */
const TEAM: { name: string; title: string }[] = [
  { name: "Michael Wahl", title: "Agency Owner" },
  { name: "John Montelepre", title: "Agency Owner" },
  { name: "Luke Ordogne", title: "Agency Owner" },
  { name: "Brandon Wahl", title: "Medicare Advisor" },
  { name: "Daniel Wanner", title: "Medicare Advisor" },
  { name: "Douglas McRae", title: "Medicare Advisor" },
  { name: "Joey Carbo", title: "Medicare Advisor" },
  { name: "Robert Flatt", title: "Medicare Advisor" },
  { name: "Kimberly Curtis", title: "Office Manager" },
  { name: "Tiffani Myers", title: "Policy Mgmt Specialist" },
  { name: "Christina Gonzales", title: "Client Service Specialist" },
  { name: "Jamiah McDowell", title: "Administrative Assistant" },
];

const REVIEW_POINTS = ["Knowledgeable agents", "Friendly staff", "Personal attention"];

/*
 * Google review cards from the Medicare site, as shown there. The wording
 * comes from the site's screenshot and is kept exactly, including a trailing
 * "More" where the card is cut off; nothing is completed by hand. A card
 * whose text is still empty is not rendered.
 */
type Review = { initials: string; date: string; text: string };
const REVIEWS: Review[] = [
  { initials: "S C", date: "Apr 13, 2026", text: "" },
  { initials: "M H", date: "Apr 2, 2026", text: "" },
  { initials: "B R", date: "Feb 12, 2026", text: "" },
  { initials: "E C", date: "Feb 10, 2026", text: "" },
  { initials: "D H", date: "Feb 10, 2026", text: "" },
  { initials: "T H", date: "Jan 28, 2026", text: "" },
];

const FAQ = [
  {
    question: "When should I enroll?",
    answer:
      "Most people enroll during their Initial Enrollment Period, which starts three months before they turn 65.",
  },
  {
    question: "Does your help cost anything?",
    answer: "No. Consulting is free to the client; the agency is compensated by the insurance carriers.",
  },
  {
    question: "Can I change plans later?",
    answer: "Yes. Specific open-enrollment periods each year are when coverage can be adjusted.",
  },
];

const TEXT_LINK_CLASS = "font-medium text-brand-ink hover:underline";
/* On the gradient: a dark, solid button so it reads against the light green. */
const ON_GRADIENT_BUTTON_CLASS =
  "inline-block rounded-md bg-gradient-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gradient-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gradient-ink";

function SectionHeading({ id, children, onGradient = false }: { id: string; children: string; onGradient?: boolean }) {
  return (
    <h2
      id={`${id}-heading`}
      className={`text-2xl font-semibold tracking-tight sm:text-3xl ${onGradient ? "text-gradient-ink" : "text-fg"}`}
    >
      {children}
    </h2>
  );
}

/** Shared inner width for every band: the 2xl breakpoint (96rem), centred. */
const WRAP = "mx-auto w-full max-w-(--breakpoint-2xl) px-4 sm:px-6 lg:px-10";

export default async function LandingPage() {
  if (await getSessionUser()) redirect("/overview");

  const reviews = REVIEWS.filter((review) => review.text);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteNav sections={SECTIONS} phone={PHONE} />

      <main className="flex-1">
        {/* Hero, on the gradient. */}
        <section className="bg-brand-gradient">
          <div className={`${WRAP} py-16 sm:py-24`}>
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-tight text-gradient-ink sm:text-5xl">
                Senior Health Solutions Simplified
              </h1>
              <p className="mt-5 text-lg text-gradient-ink-muted">
                At Cedar Grove our goal is to help our clients feel comfortable and confident in their
                health insurance decisions. By working with a local licensed agent our clients can feel
                secure knowing we are providing outstanding service and a tailored experience while
                keeping their best interests at heart.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={WEBINAR}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ON_GRADIENT_BUTTON_CLASS} text-center`}
                >
                  Watch our webinar
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Services: six brand-strong tiles, then a short block for each. */}
        <section id="services" aria-labelledby="services-heading" className={`${WRAP} scroll-mt-16 py-14`}>
          <SectionHeading id="services">Services we provide</SectionHeading>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <li key={service.id} className="flex flex-col rounded-lg bg-brand-strong p-5 text-white shadow-sm">
                <h3 className="text-base font-semibold">{service.name}</h3>
                <p className="mt-2 flex-1 text-sm text-white/90">{service.line}</p>
                <a
                  href={`#${service.id}`}
                  className="mt-4 self-start text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Read more
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {SERVICES.map((service) => (
              <article
                key={service.id}
                id={service.id}
                aria-labelledby={`${service.id}-heading`}
                className="scroll-mt-20 rounded-lg border border-line bg-surface p-5"
              >
                <h3 id={`${service.id}-heading`} className="text-lg font-semibold text-fg">
                  {service.name}
                </h3>
                <p className="mt-2 text-sm text-fg-muted">{service.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Team */}
        <section id="about" aria-labelledby="about-heading" className={`${WRAP} scroll-mt-16 border-t border-line py-14`}>
          <SectionHeading id="about">About Us</SectionHeading>
          <p className="mt-4 max-w-2xl text-base text-fg-muted">{ABOUT}</p>
          <ul className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((person) => (
              <li key={person.name} className="rounded-md border border-line bg-surface px-4 py-3">
                <p className="text-sm font-semibold text-fg">{person.name}</p>
                <p className="text-sm text-fg-muted">{person.title}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Reviews: a surface panel on a gradient band. */}
        <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-16 bg-brand-gradient">
          <div className={`${WRAP} py-14`}>
            <SectionHeading id="reviews" onGradient>
              5 star Google reviews
            </SectionHeading>
            <p className="mt-2 text-base text-gradient-ink-muted">We have 400 five star Google reviews.</p>
            <div className="mt-6 rounded-lg bg-surface p-5 shadow-sm sm:p-6">
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {REVIEW_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm font-medium text-fg">
                    <span aria-hidden="true" className="text-brand">
                      ★
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              {reviews.length > 0 ? (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {reviews.map((review) => (
                    <li key={`${review.initials}-${review.date}`} className="rounded-md border border-line p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-fg">{review.initials}</p>
                        <p className="text-xs text-fg-subtle">{review.date}</p>
                      </div>
                      <p aria-label="5 stars" className="mt-1 text-sm tracking-wide text-brand">
                        ★★★★★
                      </p>
                      <p className="mt-2 text-sm text-fg-muted">{review.text}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>

        {/* FAQ, on the gradient; each row is a native disclosure. */}
        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 bg-brand-gradient">
          <div className={`${WRAP} py-14`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-gradient-ink-muted">Still not sure?</p>
            <SectionHeading id="faq" onGradient>
              Frequently asked questions
            </SectionHeading>
            <div className="mt-6 max-w-3xl space-y-3">
              {FAQ.map((item) => (
                <details key={item.question} className="group rounded-lg bg-surface shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-medium text-fg [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span aria-hidden="true" className="text-fg-faint transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-4 text-sm text-fg-muted">{item.answer}</p>
                </details>
              ))}
            </div>
            <a
              href={WEBINAR}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ON_GRADIENT_BUTTON_CLASS} mt-8`}
            >
              Watch our webinar
            </a>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" aria-labelledby="contact-heading" className={`${WRAP} scroll-mt-16 py-14`}>
          <SectionHeading id="contact">Thinking about your Medicare coverage? Let&rsquo;s talk.</SectionHeading>
          <p className="mt-3 max-w-2xl text-base text-fg-muted">
            Call or email the office and a local licensed agent will set up a time with you.
          </p>
          <dl className="mt-8 grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-fg">Office</dt>
              <dd className="mt-1 text-sm text-fg-muted">
                {ADDRESS[0]}
                <br />
                {ADDRESS[1]}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-fg">Phone</dt>
              <dd className="mt-1 text-sm">
                <a href={`tel:${PHONE}`} className={TEXT_LINK_CLASS}>
                  {PHONE}
                </a>
              </dd>
              <dt className="mt-4 text-sm font-medium text-fg">Fax</dt>
              <dd className="mt-1 text-sm text-fg-muted">{FAX}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-fg">Email</dt>
              <dd className="mt-1 text-sm">
                <a href={`mailto:${EMAIL}`} className={TEXT_LINK_CLASS}>
                  {EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="border-t border-line bg-surface-muted">
        <div className={`${WRAP} py-10 text-sm text-fg-muted`}>
          <p className="font-medium text-fg">
            Cedar Grove Health Insurance, DBA Cedar Grove Senior Health Solutions, DBA Cedar Grove
            Medicare
          </p>
          <p className="mt-2">
            {ADDRESS[0]}, {ADDRESS[1]} ·{" "}
            <a href={`tel:${PHONE}`} className="hover:text-fg hover:underline">
              {PHONE}
            </a>{" "}
            · Fax {FAX}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="hover:text-fg hover:underline">
              Facebook
            </a>
            <Link href="/login" className="hover:text-fg hover:underline">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
