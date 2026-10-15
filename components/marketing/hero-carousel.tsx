"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const SLIDES = [
  {
    mobile: "/assets/hero/home1-mobile.webp",
    desktop: "/assets/hero/home1.webp",
    alt: "A licensed Medicare specialist meeting with a client at Cedar Grove Senior Health Solutions",
    heading: (
      <>
        Solutions
        <br />
        You Can
        <br />
        Count On.
      </>
    ),
    sub: (
      <>
        We work for <strong>you</strong> &mdash; not the insurance companies.
      </>
    ),
    cta: { href: "/team", label: "Meet Our Team" },
  },
  {
    mobile: "/assets/hero/home2-mobile.webp",
    desktop: "/assets/hero/home2.webp",
    alt: "Happy retirees who found the right Medicare coverage through Cedar Grove Senior Health Solutions",
    heading: (
      <>
        The Right Plan.
        <br />
        The Right Fit.
      </>
    ),
    sub: <>We compare plans across multiple carriers to find what&rsquo;s best for your life and your budget.</>,
    cta: { href: "/#services", label: "Explore Your Coverage Options" },
  },
  {
    mobile: "/assets/hero/home3-mobile.webp",
    desktop: "/assets/hero/home3.webp",
    alt: "Cedar Grove Senior Health Solutions team — independent Medicare agents serving Louisiana",
    heading: (
      <>
        Your Partner
        <br />
        in Medicare.
        <br />
        For Life.
      </>
    ),
    sub: <>From enrollment to annual reviews, we&rsquo;re with you every step of the way.</>,
    cta: { href: "/#reviews", label: "See What Our Clients Say" },
  },
] as const;

const REAL_TOTAL = SLIDES.length;
const INTERVAL = 9000;
const TRANSITION_MS = 900;

export function HeroCarousel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(1);
  const [animate, setAnimate] = useState(false);
  const [slideW, setSlideW] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jumpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduced, setReduced] = useState(false);

  // Layout: [clone-last | s1 | s2 | s3 | clone-first]
  const total = REAL_TOTAL + 2;

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    setSlideW(Math.round(root.getBoundingClientRect().width) || window.innerWidth);
  }, []);

  const snapIfClone = useCallback(
    (idx: number) => {
      if (idx === 0) {
        setAnimate(false);
        setCurrent(REAL_TOTAL);
        return REAL_TOTAL;
      }
      if (idx === total - 1) {
        setAnimate(false);
        setCurrent(1);
        return 1;
      }
      return idx;
    },
    [total],
  );

  const goTo = useCallback(
    (n: number) => {
      let idx = current;
      if (current === 0 || current === total - 1) {
        idx = snapIfClone(current);
      }
      setAnimate(true);
      setCurrent(n);
      if (n === 0 || n === total - 1) {
        clearTimeout(jumpRef.current ?? undefined);
        jumpRef.current = setTimeout(
          () => snapIfClone(n),
          reduced ? 0 : TRANSITION_MS + 50,
        );
      } else {
        clearTimeout(jumpRef.current ?? undefined);
      }
      void idx;
    },
    [current, reduced, snapIfClone, total],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  const stopAuto = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startAuto = useCallback(() => {
    if (reduced) return;
    stopAuto();
    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        const n = c + 1;
        setAnimate(true);
        if (n === 0 || n === REAL_TOTAL + 1) {
          clearTimeout(jumpRef.current ?? undefined);
          jumpRef.current = setTimeout(() => {
            setAnimate(false);
            setCurrent(n === 0 ? REAL_TOTAL : 1);
          }, TRANSITION_MS + 50);
        }
        return n;
      });
    }, INTERVAL);
  }, [reduced, stopAuto]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    measure();
    startAuto();
    const onResize = () => {
      measure();
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      stopAuto();
      clearTimeout(jumpRef.current ?? undefined);
      window.removeEventListener("resize", onResize);
    };
  }, [measure, startAuto, stopAuto]);

  const realIndex = ((current - 1) % REAL_TOTAL + REAL_TOTAL) % REAL_TOTAL;

  const ordered = [
    SLIDES[REAL_TOTAL - 1],
    ...SLIDES,
    SLIDES[0],
  ];

  return (
    <section id="home" className="s-hero" aria-label="Hero slideshow">
      <div
        ref={rootRef}
        className="hero-carousel"
        aria-roledescription="carousel"
        onMouseEnter={stopAuto}
        onMouseLeave={startAuto}
      >
        <div
          ref={trackRef}
          className="carousel__track"
          aria-live="off"
          style={{
            width: slideW ? slideW * total : undefined,
            transform: slideW ? `translate3d(-${current * slideW}px, 0, 0)` : undefined,
            transition:
              animate && !reduced
                ? `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
                : "none",
          }}
          onTransitionEnd={(event) => {
            if (event.target !== trackRef.current) return;
            if (event.propertyName !== "transform") return;
            if (current === 0 || current === total - 1) snapIfClone(current);
          }}
        >
          {ordered.map((slide, i) => {
            const isClone = i === 0 || i === ordered.length - 1;
            return (
              <div
                key={`${i}-${isClone ? "clone" : "real"}`}
                className="carousel__slide"
                aria-roledescription={isClone ? undefined : "slide"}
                aria-label={isClone ? undefined : `Slide ${i} of ${REAL_TOTAL}`}
                aria-hidden={isClone ? true : undefined}
                style={slideW ? { width: slideW, flex: `0 0 ${slideW}px` } : undefined}
              >
                <picture>
                  <source media="(max-width: 768px)" srcSet={slide.mobile} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.desktop}
                    alt={isClone ? "" : slide.alt}
                    className="carousel__img"
                    width={1600}
                    height={900}
                  />
                </picture>
                <div className="carousel__overlay" aria-hidden="true" />
                <div className="carousel__text">
                  <h1 className="carousel__heading">{slide.heading}</h1>
                  <p className="carousel__sub">{slide.sub}</p>
                  {slide.cta.href.startsWith("/") && !slide.cta.href.includes("#") ? (
                    <Link href={slide.cta.href} className="btn btn--primary carousel__cta">
                      {slide.cta.label}
                    </Link>
                  ) : (
                    <a href={slide.cta.href} className="btn btn--primary carousel__cta">
                      {slide.cta.label}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="carousel__btn carousel__btn--prev"
          aria-label="Previous slide"
          onClick={() => {
            stopAuto();
            prev();
            startAuto();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          type="button"
          className="carousel__btn carousel__btn--next"
          aria-label="Next slide"
          onClick={() => {
            stopAuto();
            next();
            startAuto();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div className="carousel__dots" role="tablist" aria-label="Select a slide">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`carousel__dot${i === realIndex ? " carousel__dot--active" : ""}`}
              role="tab"
              aria-label={`Slide ${i + 1}`}
              aria-selected={i === realIndex}
              onClick={() => {
                stopAuto();
                goTo(i + 1);
                startAuto();
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
