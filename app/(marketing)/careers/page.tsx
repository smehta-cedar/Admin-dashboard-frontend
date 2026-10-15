import type { Metadata } from "next";
import { ReadyCta, SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/*
 * Public careers page: who we are and open roles. Uses the marketing shell
 * (same header/footer as home). Apply via Indeed when set, else mailto.
 */

export const metadata: Metadata = {
  title: "Careers — Cedar Grove Senior Health Solutions",
};

const APPLY_EMAIL = "jmonte@cedargrovemedins.com";
const ADDRESS = ["406 N. Florida Street, Suite 1", "Covington, LA 70433"];

const WHO_WE_ARE =
  "Cedar Grove Senior Health Solutions is a local Medicare-focused agency in Covington, Louisiana. Our goal is to help clients feel comfortable and confident in their health insurance decisions. By working with licensed agents, clients get outstanding service and a tailored experience, with their best interests at heart.";

const WHY_JOIN =
  "We value drive, coachability, and work ethic. All leads are provided, training is structured, and top performers have a clear path to six-figure income — built on long-term client relationships, not churn-and-burn sales.";

type Job = {
  id: string;
  title: string;
  location: string;
  pay: string;
  schedule: string;
  benefits: string[];
  overview: string;
  responsibilities: string[];
  requirements: string[];
  whyUs: string[];
  closing: string;
  indeedUrl: string | null;
};

const JOBS: Job[] = [
  {
    id: "insurance-sales-representative",
    title: "Insurance Sales Representative (Medicare | All Leads Provided)",
    location: "406 N Florida St Ste 1, Covington, LA 70433",
    pay: "$65,000 – $120,000 a year",
    schedule: "Full-time · Monday to Friday · In person",
    benefits: [
      "401(k)",
      "401(k) matching",
      "Health insurance",
      "Dental insurance",
      "Vision insurance",
      "Paid time off",
    ],
    overview:
      "Cedar Grove Senior Health Solutions is growing rapidly, and we’re looking for motivated, competitive Sales Representatives who want a long-term career in Medicare sales—not just another sales job. This role is ideal for someone who thrives in a high-energy, performance-driven environment, enjoys talking with people, and wants clear earning potential backed by structure and support. You’ll work on-site from our downtown Covington office, receive all leads, and be supported by proven systems, training, and a dedicated team. We offer a base salary + uncapped commission + performance bonuses, with top performers earning well into six figures.",
    responsibilities: [
      "Present Medicare products to potential prospects, including Medicare Advantage, Medicare Supplements, and Ancillary products.",
      "Educate prospects on the difference between Medicare products, ensuring they understand their options and how each product fits their needs.",
      "Maintain CRM records: Accurately document client interactions, updates, and sales progress in the CRM system to ensure seamless tracking and reporting.",
      "Meet or exceed sales targets and performance metrics.",
      "Adhere to compliance standards: Ensure all sales activities comply with Medicare guidelines and regulations, including obtaining and maintaining proper certifications and licensing.",
      "Collaborate with team members: Share best practices and work together to improve processes and achieve team goals.",
      "Represent the company professionally: Maintain a high level of professionalism in all interactions, both internally and externally.",
    ],
    requirements: [
      "Comfortable with high-volume outbound calling",
      "Strong communication skills and confidence on the phone",
      "Coachable mindset and openness to feedback",
      "Competitive, goal-oriented, and self-motivated",
      "Ability to work independently while contributing to a team culture",
      "Basic computer skills (CRM, email, Microsoft Office)",
      "Ability to work on-site, Monday–Friday",
    ],
    whyUs: [
      "All leads provided — no cold prospecting",
      "Clear path to six-figure income",
      "Structured training and ongoing coaching",
      "Supportive team environment that celebrates wins",
      "A company built on long-term client relationships—not churn and burn sales",
    ],
    closing:
      "We value drive, coachability, and work ethic more than prior insurance experience. If you’re motivated, willing to learn, and comfortable on the phone, we can teach the rest. If you’re driven, coachable, and ready to control your income in a fast-growing Medicare agency, we’d love to meet you.",
    indeedUrl: null,
  },
];

function applyMailto(title: string): string {
  return `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(`Application: ${title}`)}`;
}

export default function CareersPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SiteHeader current="careers" />
      <main id="main">
        <section className="s-page-banner" aria-labelledby="careers-heading">
          <div className="container max-w-8xl mx-auto px-2">
            <h1 id="careers-heading" className="page-banner__heading">
              Careers
            </h1>
          </div>
        </section>

        <section className="s-team" aria-labelledby="who-heading">
          <div className="container max-w-8xl mx-auto px-4">
            <h2 id="who-heading" className="section-heading">
              Who we are
            </h2>
            <p className="section-sub" style={{ textAlign: "left", marginInline: 0 }}>
              {WHO_WE_ARE}
            </p>
            <p className="section-sub" style={{ textAlign: "left", marginInline: 0, marginTop: "1rem" }}>
              {WHY_JOIN}
            </p>
            <p style={{ marginTop: "1rem", color: "var(--c-text-muted)", fontSize: "var(--text-sm)" }}>
              {ADDRESS[0]}, {ADDRESS[1]}
            </p>
          </div>
        </section>

        <section id="openings" className="s-team s-team--alt" aria-labelledby="openings-heading">
          <div className="container max-w-8xl mx-auto px-4">
            <header className="section-header section-header--light">
              <h2 id="openings-heading" className="section-heading section-heading--light">
                Open roles
              </h2>
            </header>

            {JOBS.length === 0 ? (
              <p className="section-sub section-sub--light">
                No openings right now. You can still reach out at{" "}
                <a href={`mailto:${APPLY_EMAIL}`}>{APPLY_EMAIL}</a>.
              </p>
            ) : (
              <ul style={{ listStyle: "none", display: "grid", gap: "1.5rem", maxWidth: "48rem", marginInline: "auto" }}>
                {JOBS.map((job) => (
                  <li key={job.id} className="team-card" style={{ padding: "1.5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div>
                        <h3 className="team-card__name" style={{ fontSize: "1.35rem" }}>
                          {job.title}
                        </h3>
                        <p className="team-card__role">{job.location}</p>
                        <p style={{ marginTop: "0.35rem", fontWeight: 700, color: "var(--c-heading)" }}>
                          {job.pay}
                        </p>
                        <p style={{ color: "var(--c-text-muted)", fontSize: "var(--text-sm)" }}>
                          {job.schedule}
                        </p>
                      </div>
                      <div>
                        {job.indeedUrl ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                            <a
                              href={job.indeedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn--primary"
                            >
                              Apply on Indeed
                            </a>
                            <a href={applyMailto(job.title)} className="btn btn--ghost-gold">
                              Email to apply
                            </a>
                          </div>
                        ) : (
                          <a href={applyMailto(job.title)} className="btn btn--primary">
                            Email to apply
                          </a>
                        )}
                      </div>
                    </div>

                    <ul
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem 1rem",
                        marginTop: "1rem",
                        fontSize: "var(--text-sm)",
                        color: "var(--c-text-muted)",
                      }}
                    >
                      {job.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>

                    <div style={{ marginTop: "1.5rem", display: "grid", gap: "1.25rem", color: "var(--c-text-secondary)", fontSize: "var(--text-sm)" }}>
                      <div>
                        <h4 style={{ color: "var(--c-heading)", marginBottom: "0.5rem" }}>
                          Position overview
                        </h4>
                        <p style={{ maxWidth: "none" }}>{job.overview}</p>
                      </div>
                      <div>
                        <h4 style={{ color: "var(--c-heading)", marginBottom: "0.5rem" }}>
                          What you’ll do
                        </h4>
                        <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", display: "grid", gap: "0.4rem" }}>
                          {job.responsibilities.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ color: "var(--c-heading)", marginBottom: "0.5rem" }}>
                          What we’re looking for
                        </h4>
                        <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", display: "grid", gap: "0.4rem" }}>
                          {job.requirements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ color: "var(--c-heading)", marginBottom: "0.5rem" }}>
                          Why Cedar Grove Senior Health Solutions?
                        </h4>
                        <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", display: "grid", gap: "0.4rem" }}>
                          {job.whyUs.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        <p style={{ marginTop: "1rem", maxWidth: "none" }}>{job.closing}</p>
                      </div>
                    </div>

                    <div style={{ marginTop: "1.5rem" }}>
                      {job.indeedUrl ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                          <a
                            href={job.indeedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--primary"
                          >
                            Apply on Indeed
                          </a>
                          <a href={applyMailto(job.title)} className="btn btn--ghost-gold">
                            Email to apply
                          </a>
                        </div>
                      ) : (
                        <a href={applyMailto(job.title)} className="btn btn--primary">
                          Email to apply
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <ReadyCta />
      <SiteFooter />
    </>
  );
}
