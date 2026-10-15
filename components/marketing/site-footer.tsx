import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container max-w-8xl mx-auto px-4">
        <div className="footer__grid footer__grid--with-map">
          <div className="footer__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/brand/logo.jpg"
              alt="Cedar Grove Senior Health"
              className="footer__logo-img"
            />
            <p className="footer__tagline">&ldquo;Solutions You Can Count On&rdquo;</p>
            <address className="footer__contact" aria-label="Contact information">
              <ul className="footer__contact-list" role="list">
                <li>
                  <PhoneIcon />
                  <span className="sr-only">Primary Phone: </span>
                  <a href="tel:9852821000">(985) 282-1000</a>
                </li>
                <li>
                  <FaxIcon />
                  <span className="sr-only">Fax: </span>
                  <span>(985) 951-2048</span>
                </li>
                <li>
                  <MailIcon />
                  <span className="sr-only">Email: </span>
                  <a href="mailto:info@reply.cedargrovesolutiongroup.com">
                    info
                    <wbr />
                    @reply.
                    <wbr />
                    cedargrovesolutiongroup.com
                  </a>
                </li>
                <li>
                  <PinIcon />
                  <span className="sr-only">Address: </span>
                  <span>
                    406 N. Florida Street, Suite 1
                    <br />
                    Covington, LA 70433
                  </span>
                </li>
                <li>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                  </svg>
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
            </address>
          </div>

          <nav className="footer__nav" aria-label="Coverage types">
            <h4 className="footer__nav-title">Coverage</h4>
            <ul role="list">
              <li>
                <Link href="/#services">Original Medicare</Link>
              </li>
              <li>
                <Link href="/#services">Medicare Supplement</Link>
              </li>
              <li>
                <Link href="/#services">Medicare Advantage</Link>
              </li>
              <li>
                <Link href="/#services">Prescription Drug Plans</Link>
              </li>
              <li>
                <Link href="/#services">Dental / Vision / Hearing</Link>
              </li>
              <li>
                <Link href="/#services">Hospital Indemnity</Link>
              </li>
            </ul>
          </nav>

          <nav className="footer__nav" aria-label="Company">
            <h4 className="footer__nav-title">Company</h4>
            <ul role="list">
              <li>
                <Link href="/#about">About Us</Link>
              </li>
              <li>
                <Link href="/team">Our Team</Link>
              </li>
              <li>
                <Link href="/careers">Careers</Link>
              </li>
              <li>
                <Link href="/#reviews">Reviews</Link>
              </li>
              <li>
                <Link href="/#contact">Contact Us</Link>
              </li>
              <li>
                <Link href="/login">Staff sign in</Link>
              </li>
            </ul>
          </nav>

          <div className="footer__map">
            <iframe
              title="Map to Cedar Grove Senior Health Solutions — 406 N. Florida Street, Suite 1, Covington, LA 70433"
              src="https://maps.google.com/maps?q=406%20N.%20Florida%20Street%2C%20Suite%201%2C%20Covington%2C%20LA%2070433&z=15&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>

        <div className="footer__disclaimer">
          <p>
            Cedar Grove Senior Health Solutions is a licensed independent insurance agency. Use of
            this site does not obligate you to enroll in any plan.
          </p>
          <p>
            Please contact{" "}
            <a href="https://www.medicare.gov" target="_blank" rel="noopener noreferrer">
              Medicare.gov
            </a>
            , call <strong>1-800-MEDICARE</strong> (1-800-633-4227), or contact your local State
            Health Insurance Assistance Program (SHIP) to get information on all of your options.
          </p>
        </div>

        <div className="footer__bottom text-center">
          <p>&copy; 2026 Cedar Grove Senior Health Solutions. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function ReadyCta() {
  return (
    <section className="s-ready-cta" aria-label="Get started">
      <div className="container max-w-8xl mx-auto px-4">
        <div className="ready-cta__content ready-cta__content--center">
          <h2 className="ready-cta__heading">Ready to Find the Right Plan?</h2>
          <p className="ready-cta__sub">
            Our licensed specialists are here to guide you — no pressure, no cost, no confusion.
          </p>
          <a href="tel:9852821000" className="btn btn--primary">
            Call Us : 985-282-1000
          </a>
        </div>
      </div>
    </section>
  );
}

function PhoneIcon() {
  return (
    <svg
      className="footer__contact-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function FaxIcon() {
  return (
    <svg
      className="footer__contact-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      className="footer__contact-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      className="footer__contact-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
