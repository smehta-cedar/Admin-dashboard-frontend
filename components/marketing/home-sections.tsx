import Link from "next/link";

export function ApproachSection() {
  return (
    <section id="approach" className="s-approach" aria-labelledby="approach-heading">
      <div className="container max-w-8xl mx-auto px-4">
        <header className="section-header">
          <h2 id="approach-heading" className="section-heading text-4xl font-bold">
            Why Cedar Grove Senior Health Solutions?
          </h2>
          <p className="text-sm text-ink-muted text-center max-w-3xl mx-auto mt-2">
            Navigating Medicare doesn&rsquo;t have to be overwhelming. We&rsquo;re here to make it
            straightforward and to stay by your side every step of the way.
          </p>
        </header>

        <div className="approach__grid">
          <article className="approach-card">
            <h2 className="approach-card__title">We Work for You</h2>
            <p>
              As independent agents, we are not tied to any single carrier. We compare options across
              multiple companies and present honest side-by-side results so you choose what&rsquo;s
              best for you, not us.
            </p>
          </article>
          <article className="approach-card">
            <h2 className="approach-card__title">No &ldquo;One-Size-Fits-All&rdquo;</h2>
            <p>
              We don&rsquo;t believe everyone needs the same plan. We take the time to understand
              your doctors, your prescriptions, and your budget — long before we offer a choice.
            </p>
          </article>
          <article className="approach-card">
            <h2 className="approach-card__title">We Stay With You</h2>
            <p>
              Our relationship doesn&rsquo;t end when you sign up. We&rsquo;re here year-round for
              questions, annual plan reviews, and changes during Open Enrollment for as long as you
              need us.
            </p>
          </article>
          <article className="approach-card">
            <h2 className="approach-card__title">No Cost to You</h2>
            <p>
              Our guidance is completely free. We are compensated directly by the insurance carriers
              so you receive expert, unbiased advice at no additional charge, ever.
            </p>
          </article>
        </div>
      </div>
      <div className="approach__cta rounded-xl py-16">
        <p>
          Have questions about the process? Talk to one of our agents &mdash; we&rsquo;ll walk you
          through every step, from your first question to your final plan.
        </p>
        <Link
          href="/team"
          className="btn btn--primary bg-white text-black"
          style={{ marginTop: "1rem", display: "inline-block" }}
        >
          Meet Our Team
        </Link>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="s-faq-dark py-20 px-4" aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-white/75 mb-3">
          Still Not Sure?
        </p>
        <h2 id="faq-heading" className="text-center text-4xl font-bold !text-white mb-12">
          Frequently Asked Questions
        </h2>

        <div className="flex flex-col gap-4 mb-12">
          <details className="bg-white rounded-2xl overflow-hidden group">
            <summary className="flex justify-between items-center px-8 py-6 cursor-pointer select-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
              <span className="font-bold text-brand-teal-deep text-lg">
                When should I enroll in Medicare?
              </span>
              <Chevron />
            </summary>
            <div className="px-8 pb-6 pt-4 border-t border-line text-ink-soft leading-relaxed">
              <p>
                Your <strong>Initial Enrollment Period (IEP)</strong> starts three months before the
                month you turn 65 and ends three months after &mdash; a 7-month window in total.
                Missing this window without a qualifying Special Enrollment Period may result in
                permanent late-enrollment penalties on your premiums. We recommend reaching out 6
                months before your birthday so we can help you plan ahead.
              </p>
            </div>
          </details>

          <details className="bg-white rounded-2xl overflow-hidden group">
            <summary className="flex justify-between items-center px-8 py-6 cursor-pointer select-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
              <span className="font-bold text-brand-teal-deep text-lg">
                Does it cost me anything to work with Cedar Grove Senior Health Solutions?
              </span>
              <Chevron />
            </summary>
            <div className="px-8 pb-6 pt-4 border-t border-line text-ink-soft leading-relaxed">
              <p>
                No &mdash; our services are completely <strong>free to you as a client</strong>. We
                are licensed independent agents and are compensated directly by the insurance
                carriers whose plans we help you enroll in. You receive the same plan at the same
                premium whether you come through us or go directly to the carrier. There is no catch.
              </p>
            </div>
          </details>

          <details className="bg-white rounded-2xl overflow-hidden group">
            <summary className="flex justify-between items-center px-8 py-6 cursor-pointer select-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
              <span className="font-bold text-brand-teal-deep text-lg">
                Can I change my plan if I&rsquo;m not happy with it?
              </span>
              <Chevron />
            </summary>
            <div className="px-8 pb-6 pt-4 border-t border-line text-ink-soft leading-relaxed">
              <p>
                Yes. Medicare plans can generally be changed once per year during the{" "}
                <strong>Annual Enrollment Period (AEP)</strong>, which runs October&nbsp;15 through
                December&nbsp;7, with changes effective January&nbsp;1. Certain life events &mdash;
                such as moving, losing employer coverage, or gaining/losing Medicaid &mdash; may
                qualify you for a Special Enrollment Period outside of AEP. We contact all of our
                clients before Open Enrollment each year to review their options together.
              </p>
            </div>
          </details>
        </div>

        <div className="text-center">
          <a href="tel:9852821000" className="btn btn--primary">
            Call Us : 985-282-1000
          </a>
        </div>
      </div>
    </section>
  );
}

export function AboutSection() {
  return (
    <section id="about" className="s-about" aria-labelledby="about-heading">
      <div className="container about__inner max-w-8xl mx-auto px-4">
        <div className="about__content">
          <h2 id="about-heading" className="section-heading section-heading--light">
            About Cedar Grove Senior Health Solutions
          </h2>
          <p className="about__lead">
            We are a team of licensed, independent Medicare specialists based in Covington,
            Louisiana &mdash; dedicated to helping individuals and families navigate one of the most
            important decisions of their lives.
          </p>
          <p>
            We have no allegiance to any single insurance carrier, which means our only obligation
            is to you. We take the time to understand your health needs, your doctors, your
            medications, and your financial situation before we ever suggest a plan.
          </p>
          <p>
            Whether you&rsquo;re turning 65 for the first time, transitioning off an employer plan,
            or simply looking for a better option during Open Enrollment, we&rsquo;re here to help
            &mdash; at no cost, without pressure, and for as long as you need us.
          </p>
          <div className="about__tags">
            <span className="about__tag">Independent Agents</span>
            <span className="about__tag">Licensed Nationwide</span>
            <span className="about__tag">No Cost to You</span>
          </div>
        </div>

        <div className="about__contact-card" id="contact">
          <h3 className="about__contact-title">Get in Touch</h3>
          <ul className="contact-list" aria-label="Contact information">
            <li>
              <span className="contact-list__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <span>
                <a href="tel:9852821000">(985) 282-1000</a>
              </span>
            </li>
            <li>
              <span className="contact-list__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9V2h12v7" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
              </span>
              <span>
                <span>(985) 951-2048</span>
              </span>
            </li>
            <li>
              <span className="contact-list__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span>
                <span>
                  406 N. Florida Street, Suite 1
                  <br />
                  Covington, LA 70433
                </span>
              </span>
            </li>
            <li>
              <span className="contact-list__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <span>
                <a href="mailto:info@reply.cedargrovesolutiongroup.com">
                  info
                  <wbr />
                  @reply.
                  <wbr />
                  cedargrovesolutiongroup.com
                </a>
              </span>
            </li>
            <li>
              <span className="contact-list__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                </svg>
              </span>
              <span>
                <a
                  href="https://www.facebook.com/cedargroveseniorhealthsolutions/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  facebook.com/cedargrovesolutiongroup/
                </a>
              </span>
            </li>
          </ul>
          <a
            href="https://event.cedargrovesolutiongroup.com/"
            className="btn btn--primary btn--full contact-cta-btn"
            target="_blank"
            rel="noopener noreferrer"
          >
            Register for our Webinar
          </a>
        </div>
      </div>
    </section>
  );
}

function Chevron() {
  return (
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
  );
}
