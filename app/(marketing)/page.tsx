import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { ReadyCta, SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getSessionUser } from "@/lib/session";

/*
 * The Cedar Grove Senior Health homepage, public and outside the dashboard.
 * Copy from cedargroveseniorhealth.com and the Medicare site; look from
 * cg-seniorhealth/index.html (marketing.css classes, shared header, footer).
 * A visitor who is already signed in goes straight to the CRM home instead.
 *
 * No booking form and no mailer: contact is the office's phone and email.
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

const PHONE = "985-282-1000";
const FAX = "985-951-2048";
const EMAIL = "info@cedargroveseniorhealth.com";
const ADDRESS = ["406 N. Florida Street, Suite 1", "Covington, LA 70433"];
const WEBINAR = "https://www.cedargrovemedicare.com/webinar";

const ABOUT =
  "From enrollment to annual reviews, we're with you every step of the way.";

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

/** The inner width every section shares, as in index.html. */
const CONTAINER = "container max-w-8xl mx-auto px-4";

export default async function LandingPage() {
  if (await getSessionUser()) redirect("/overview");

  const reviews = REVIEWS.filter((review) => review.text);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SiteHeader current="home" />
      <main id="main">
        <HeroCarousel />

        <section id="services" className="s-services" aria-labelledby="services-heading">
          <div className={CONTAINER}>
            <header className="section-header">
              <h2 id="services-heading" className="section-heading text-4xl font-bold">
                Services We Provide
              </h2>
            </header>
            <div className="services__grid">
              {SERVICES.map((service) => (
                <article key={service.id} className="service-card">
                  <h3 className="service-card__title">{service.name}</h3>
                  <p className="service-card__desc">{service.line}</p>
                  <a href={`#${service.id}`} className="service-card__link">
                    Read more
                  </a>
                </article>
              ))}
            </div>
            <div className="services__grid mt-10">
              {SERVICES.map((service) => (
                <article
                  key={service.id}
                  id={service.id}
                  className="service-card scroll-mt-28"
                  aria-label={service.name}
                >
                  <span className="service-card__tag">{service.name}</span>
                  <p className="service-card__desc">{service.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="s-about" aria-labelledby="about-heading">
          <div className={CONTAINER}>
            <header className="section-header section-header--light">
              <h2 id="about-heading" className="section-heading section-heading--light">
                About Us
              </h2>
              <p className="section-sub section-sub--light">{ABOUT}</p>
            </header>
            <div className="team__agents">
              {TEAM.map((person) => (
                <article key={person.name} className="team-card">
                  <div className="team-card__body">
                    <h3 className="team-card__name">{person.name}</h3>
                    <p className="team-card__role">{person.title}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="reviews" className="s-reviews" aria-labelledby="reviews-heading">
          <div className={CONTAINER}>
            <header className="section-header">
              <div className="reviews__aggregate">
                <div className="reviews__score" role="img" aria-label="400 five star Google reviews.">
                  <span className="reviews__stars" aria-hidden="true">
                    &#9733;&#9733;&#9733;&#9733;&#9733;
                  </span>
                  <span className="reviews__count">400 five star Google reviews</span>
                </div>
              </div>
              <h2 id="reviews-heading" className="section-heading">
                5 Star Google Reviews
              </h2>
              <p className="section-sub">{REVIEW_POINTS.join(" · ")}</p>
            </header>
            {reviews.length > 0 ? (
              <div className="services__grid">
                {reviews.map((review) => (
                  <article key={`${review.initials}-${review.date}`} className="review-card">
                    <div className="review-card__stars" role="img" aria-label="Five stars">
                      &#9733;&#9733;&#9733;&#9733;&#9733;
                    </div>
                    <blockquote className="review-card__quote">{review.text}</blockquote>
                    <footer className="review-card__author">
                      <strong>{review.initials}</strong>
                      <span className="review-card__meta">{review.date}</span>
                    </footer>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section id="faq" className="s-faq-dark py-20 px-4" aria-labelledby="faq-heading">
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-white/75 mb-3">
              Still Not Sure?
            </p>
            <h2 id="faq-heading" className="text-center text-4xl font-bold !text-white mb-12">
              Frequently Asked Questions
            </h2>
            <div className="flex flex-col gap-4 mb-12">
              {FAQ.map((item) => (
                <details key={item.question} className="bg-white rounded-2xl overflow-hidden group">
                  <summary className="flex justify-between items-center px-8 py-6 cursor-pointer select-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                    <span className="font-bold text-brand-teal-deep text-lg">{item.question}</span>
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-brand-teal transition-transform duration-200 group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-8 pb-6 pt-4 border-t border-line text-ink-soft leading-relaxed">
                    <p>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
            <div className="text-center">
              <a href={WEBINAR} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
                Watch our webinar
              </a>
            </div>
          </div>
        </section>

        <section id="contact" className="s-approach" aria-labelledby="contact-heading">
          <div className={CONTAINER}>
            <header className="section-header">
              <h2 id="contact-heading" className="section-heading text-4xl font-bold">
                Thinking about your Medicare coverage? Let&rsquo;s talk.
              </h2>
              <p className="section-sub">
                Call or email the office and a local licensed agent will set up a time with you.
              </p>
            </header>
            <div className="approach__grid">
              <article className="approach-card">
                <h3 className="approach-card__title">Office</h3>
                <p>
                  {ADDRESS[0]}
                  <br />
                  {ADDRESS[1]}
                </p>
              </article>
              <article className="approach-card">
                <h3 className="approach-card__title">Phone</h3>
                <p>
                  <a href={`tel:${PHONE}`}>{PHONE}</a>
                  <br />
                  Fax {FAX}
                </p>
              </article>
              <article className="approach-card">
                <h3 className="approach-card__title">Email</h3>
                <p>
                  <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
      <ReadyCta />
      <SiteFooter />
    </>
  );
}
