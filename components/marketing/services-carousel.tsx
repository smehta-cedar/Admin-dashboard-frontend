"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SERVICES = [
  {
    tag: "Medicare",
    title: "Original Medicare",
    desc: "Parts A & B form the foundation of Medicare coverage — hospital care, doctor visits, and outpatient services. We help you understand exactly what's covered and where the gaps are.",
  },
  {
    tag: "Supplement",
    title: "Medicare Supplement",
    desc: "Also called Medigap, these plans cover copayments, coinsurance, and deductibles that Original Medicare leaves behind. We compare plans across carriers to find your best value.",
  },
  {
    tag: "Advantage",
    title: "Medicare Advantage",
    desc: "All-in-one HMO and PPO plans from private insurers that often bundle dental, vision, and drug coverage. We help you weigh network flexibility against added benefits.",
  },
  {
    tag: "Part D",
    title: "Prescription Drug Plans",
    desc: "Medicare Part D helps cover prescription medication costs. We review your specific drug list to identify the plan with the lowest overall out-of-pocket cost for you personally.",
  },
  {
    tag: "Extras",
    title: "Dental, Vision & Hearing",
    desc: "Original Medicare doesn't cover most routine dental, vision, or hearing care. We connect you with affordable supplemental plans that fill these important gaps.",
  },
  {
    tag: "Critical Illness",
    title: "Cancer / Heart Attack / Stroke",
    desc: "A critical illness diagnosis brings costs Medicare may not cover. These specialized plans pay a direct benefit to you upon diagnosis — for treatment, recovery, or any need.",
  },
  {
    tag: "Indemnity",
    title: "Hospital Indemnity",
    desc: "Receive a cash benefit for each day spent in the hospital, regardless of other coverage. Ideal for covering Medicare Part A deductibles and daily coinsurance costs that add up quickly.",
  },
] as const;

export function ServicesCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);

  const getVisible = () =>
    window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;

  const maxIdx = useCallback(() => {
    const total = SERVICES.length;
    return Math.max(0, total - getVisible());
  }, []);

  const setSizes = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const visible = getVisible();
    const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
    const cardW = (viewport.getBoundingClientRect().width - gap * (visible - 1)) / visible;
    Array.from(track.children).forEach((child) => {
      (child as HTMLElement).style.flexBasis = `${cardW}px`;
    });
  }, []);

  const scrollLeftFor = useCallback((n: number) => {
    const track = trackRef.current;
    if (!track || !track.children[0]) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
    const cardW = track.children[0].getBoundingClientRect().width;
    return n * (cardW + gap);
  }, []);

  const goTo = useCallback(
    (n: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const max = maxIdx();
      const next = max === 0 ? 0 : ((n % (max + 1)) + (max + 1)) % (max + 1);
      setCurrent(next);
      setProgress(max === 0 ? 100 : (next / max) * 100);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      viewport.scrollTo({
        left: scrollLeftFor(next),
        behavior: reduced ? "instant" : "smooth",
      });
    },
    [maxIdx, scrollLeftFor],
  );

  useEffect(() => {
    setSizes();
    goTo(0);
    const onResize = () => {
      setSizes();
      goTo(Math.min(current, maxIdx()));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; resize handler closes over latest via goTo/maxIdx
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
        const cardW = track.children[0]
          ? track.children[0].getBoundingClientRect().width
          : 0;
        const step = cardW + gap;
        const max = maxIdx();
        const idx = step > 0 ? Math.min(Math.round(viewport.scrollLeft / step), max) : 0;
        setCurrent(idx);
        setProgress(max === 0 ? 100 : (idx / max) * 100);
      });
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [maxIdx]);

  return (
    <section id="services" className="s-services" aria-labelledby="services-heading">
      <div className="container max-w-8xl mx-auto px-4">
        <header className="section-header">
          <h2 id="services-heading" className="section-heading text-4xl font-bold">
            Medicare &amp; Health Coverage
          </h2>
          <p className="section-sub text-sm">
            We offer guidance across the full range of Medicare and supplemental health coverage
            options.
          </p>
        </header>

        <div
          className="mc-carousel"
          tabIndex={0}
          aria-roledescription="carousel"
          aria-label="Medicare and Health Coverage options"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              goTo(current - 1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              goTo(current + 1);
            }
            if (event.key === "Home") {
              event.preventDefault();
              goTo(0);
            }
            if (event.key === "End") {
              event.preventDefault();
              goTo(maxIdx());
            }
          }}
        >
          <div className="mc-carousel__viewport" ref={viewportRef}>
            <div className="mc-carousel__track" ref={trackRef}>
              {SERVICES.map((service) => (
                <article key={service.title} className="service-card">
                  <div className="service-card__tag" aria-hidden="true">
                    {service.tag}
                  </div>
                  <h3 className="service-card__title">{service.title}</h3>
                  <p className="service-card__desc">{service.desc}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="mc-carousel__controls">
            <button
              type="button"
              className="mc-carousel__btn mc-carousel__btn--prev"
              aria-label="Previous coverage types"
              onClick={() => goTo(current - 1)}
            >
              &#8249;
            </button>
            <div className="mc-carousel__progress" role="presentation" aria-hidden="true">
              <div className="mc-carousel__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <button
              type="button"
              className="mc-carousel__btn mc-carousel__btn--next"
              aria-label="Next coverage types"
              onClick={() => goTo(current + 1)}
            >
              &#8250;
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
