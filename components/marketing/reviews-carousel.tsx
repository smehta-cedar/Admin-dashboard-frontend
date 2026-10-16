"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REVIEWS = [
  {
    quote:
      "After turning 65, I was completely lost trying to figure out Medicare. The team at Cedar Grove Senior Health Solutions sat down with me, explained everything in plain language, and helped me find a plan that actually covers my prescriptions. No pressure, no confusion — just honest help.",
    author: (
      <>
        <strong>Margaret T.</strong> &mdash; Covington, LA
      </>
    ),
  },
  {
    quote:
      "I've been with Cedar Grove Senior Health Solutions for three years now. When my old plan's premiums went up, they called me during Open Enrollment to review my options. That kind of attention is rare, and I'm grateful for it every year.",
    author: (
      <>
        <strong>Robert K.</strong> &mdash; Mandeville, LA
      </>
    ),
  },
  {
    quote:
      "My husband and I needed two different plans because of our different doctors and medications. They handled both of us at the same time and made sure we each got the right fit. We could not recommend them more highly.",
    author: (
      <>
        <strong>Dorothy &amp; Frank M.</strong> &mdash; Slidell, LA
      </>
    ),
  },
  {
    quote:
      "DJ went over several different plans to fine the one that fit me and my wife the best. I wanted the advantage plan and the supplement plan worked best for her. He also made us aware of our exposure to the possibility being hit with 2 large out of pocket payments if we got hit with it in Nov or Dec and then again in Jan. So we got coverage to satisfy that scenario.",
    author: (
      <>
        <strong>Rusty Creswell</strong>
        <span className="review-card__meta">13 reviews · 11 months ago</span>
      </>
    ),
  },
  {
    quote:
      "I enjoyed working with, Brandon. Very knowledgeable, easy to understand and helpful with Medicare. He is helping me sign up for it. I believe that he will be there when I have questions.",
    author: (
      <>
        <strong>Debi Butler</strong>
        <span className="review-card__meta">7 reviews · 1 photo · 4 months ago</span>
      </>
    ),
  },
  {
    quote:
      "Joey was professional and I felt like he was really taking my concerns into account when he made a recommendation. I highly encourage anyone interested in Medicaide take the time to discuss their options with Joey. He made the process painless.",
    author: (
      <>
        <strong>Tom Kimmitt</strong>
        <span className="review-card__meta">
          Local Guide · 13 reviews · 4 photos · Edited 3 months ago
        </span>
      </>
    ),
  },
  {
    quote:
      "I was really stressed out about signing up for Medicare, but DJ really took it slow and helped me get signed up quickly, and continues to work with me to make sure the plan I have continues to work best for me. Really took the headache out of choosing! Cedar Grove folks are life-savers, thanks DJ and Cedar Grove!",
    author: (
      <>
        <strong>Dianne Drinkard</strong>
        <span className="review-card__meta">
          Local Guide · 34 reviews · 1 photo · 3 months ago
        </span>
      </>
    ),
  },
  {
    quote:
      "Our agent, Brandon Wahl, was very knowledgeable and helpful with us in finding the best Medicare Advantage plan that would fit all our needs. Would highly recommend Cedar Grove Senior Health Solutions and Brandon Wahl.",
    author: (
      <>
        <strong>Carolyn Darby</strong>
        <span className="review-card__meta">
          Local Guide · 47 reviews · 20 photos · 3 months ago
        </span>
      </>
    ),
  },
] as const;

export function ReviewsCarousel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("");
  const startX = useRef(0);
  const swiped = useRef(false);

  const total = REVIEWS.length;

  const wrapIndex = (n: number) => ((n % total) + total) % total;

  const layout = useCallback(
    (idx: number) => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) return;

      const count = viewport.getBoundingClientRect().width >= 860 ? 3 : 1;
      const gap = 24;
      const cardW = (viewport.clientWidth - gap * (count - 1)) / count;
      const offsets = count === 3 ? [-1, 0, 1] : [0];

      cardRefs.current.forEach((card) => {
        if (!card) return;
        card.style.width = `${cardW}px`;
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
        card.style.transform = "none";
        card.classList.remove("is-center", "is-side");
        card.setAttribute("aria-hidden", "true");
      });

      let tallest = 0;
      offsets.forEach((offset, slot) => {
        const card = cardRefs.current[wrapIndex(idx + offset)];
        if (!card) return;
        card.classList.toggle("is-center", offset === 0);
        card.classList.toggle("is-side", offset !== 0);
        card.style.opacity = "1";
        card.style.pointerEvents = "auto";
        card.style.transform = `translateX(${slot * (cardW + gap)}px)`;
        card.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
        if (card.offsetHeight > tallest) tallest = card.offsetHeight;
      });
      track.style.height = `${tallest}px`;

      const author = cardRefs.current[idx]?.querySelector(".review-card__author");
      if (author) {
        setStatus(
          `Review ${idx + 1} of ${total}, ${author.textContent?.replace(/\s+/g, " ").trim() ?? ""}`,
        );
      }
    },
    [total],
  );

  const goTo = useCallback(
    (n: number) => {
      const next = wrapIndex(n);
      setIndex(next);
      layout(next);
    },
    [layout],
  );

  useEffect(() => {
    layout(index);
    const onResize = () => {
      layout(index);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [index, layout]);

  return (
    <section id="reviews" className="s-reviews" aria-labelledby="reviews-heading">
      <div className="container max-w-8xl mx-auto px-4">
        <header className="section-header">
          <div className="reviews__aggregate">
            <div
              className="reviews__score"
              role="img"
              aria-label="4.9 out of 5 stars from over 450 Google reviews."
            >
              <span className="reviews__stars" aria-hidden="true">
                &#9733;&#9733;&#9733;&#9733;&#9733;
              </span>
              <span className="reviews__count">4.9 out of 5 · 450+ Google reviews</span>
            </div>
            <a
              className="reviews__badge"
              href="https://www.bbb.org/us/la/covington/profile/health-insurance/cedar-grove-senior-health-solutions-0985-90045862"
              target="_blank"
              rel="noopener noreferrer"
            >
              A+ BBB Accredited
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span className="sr-only">(opens BBB profile in a new tab)</span>
            </a>
          </div>
          <h2 id="reviews-heading" className="section-heading">
            What Our Clients Say
          </h2>
        </header>

        <div
          ref={rootRef}
          className="reviews-carousel"
          tabIndex={0}
          aria-roledescription="carousel"
          aria-label="Client reviews"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              goTo(index - 1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              goTo(index + 1);
            }
          }}
        >
          <div
            className="reviews-carousel__viewport"
            ref={viewportRef}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              startX.current = event.clientX;
              swiped.current = false;
            }}
            onPointerUp={(event) => {
              const dx = event.clientX - startX.current;
              if (Math.abs(dx) < 40) return;
              swiped.current = true;
              goTo(dx < 0 ? index + 1 : index - 1);
            }}
          >
            <div className="reviews-carousel__track" ref={trackRef}>
              {REVIEWS.map((review, i) => (
                <article
                  key={i}
                  className="review-card"
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  onClick={() => {
                    if (swiped.current) {
                      swiped.current = false;
                      return;
                    }
                    let d = i - index;
                    if (d > total / 2) d -= total;
                    if (d < -total / 2) d += total;
                    if (d !== 0 && Math.abs(d) === 1) goTo(i);
                  }}
                >
                  <div className="review-card__stars" role="img" aria-label="Five stars">
                    &#9733;&#9733;&#9733;&#9733;&#9733;
                  </div>
                  <blockquote className="review-card__quote">{review.quote}</blockquote>
                  <footer className="review-card__author">{review.author}</footer>
                </article>
              ))}
            </div>
          </div>

          <div className="reviews-carousel__controls">
            <button
              type="button"
              className="reviews-carousel__btn reviews-carousel__btn--prev"
              aria-label="Previous review"
              onClick={() => goTo(index - 1)}
            >
              &#8249;
            </button>
            <div className="reviews-carousel__dots" role="tablist" aria-label="Choose a review">
              {REVIEWS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className="reviews-carousel__dot"
                  role="tab"
                  aria-label={`Show review ${i + 1}`}
                  aria-selected={i === index}
                  tabIndex={i === index ? 0 : -1}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="reviews-carousel__btn reviews-carousel__btn--next"
              aria-label="Next review"
              onClick={() => goTo(index + 1)}
            >
              &#8250;
            </button>
          </div>
          <p className="reviews-carousel__status visually-hidden" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
