"use client";

import { useEffect, useRef, useState } from "react";
import { FAQ, FEATURE_CARDS, HOW_STEPS, PRODUCT_NOTES } from "@/lib/content";
import { FUNDS_DISCLOSURE, NO_FEE_DISCLOSURE, RESOLVER_DISCLOSURE } from "@/lib/escrow/constants";
import { Button } from "@/components/ui";
import HeroSectionwithPixelBackground from "@/components/ui/hero-with-pixelbackground";

function FeatureMark({ mark }: { mark: (typeof FEATURE_CARDS)[number]["mark"] }) {
  const common = "h-24 w-24 sm:h-28 sm:w-28";
  if (mark === "lock") {
    return (
      <svg viewBox="0 0 112 112" className={common} aria-hidden>
        <circle cx="56" cy="56" r="52" fill="#163300" />
        <rect x="30" y="28" width="52" height="62" rx="10" fill="#9fe870" />
        <circle cx="48" cy="48" r="8" fill="#163300" />
        <path d="M44 64h24M44 74h16" stroke="#163300" strokeWidth="4" strokeLinecap="round" />
        <path d="M62 46l4 4 8-9" fill="none" stroke="#163300" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mark === "planet") {
    return (
      <svg viewBox="0 0 112 112" className={common} aria-hidden>
        <circle cx="56" cy="56" r="52" fill="#9fe870" />
        <circle cx="40" cy="56" r="12" fill="#163300" />
        <circle cx="74" cy="44" r="10" fill="#0e0f0c" />
        <path d="M50 52c8-10 16-8 24-12" fill="none" stroke="#163300" strokeWidth="4" strokeLinecap="round" />
        <path d="M68 58l12 6-2 8" fill="none" stroke="#163300" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mark === "hash") {
    return (
      <svg viewBox="0 0 112 112" className={common} aria-hidden>
        <circle cx="56" cy="56" r="52" fill="#163300" />
        <rect x="30" y="26" width="44" height="58" rx="6" fill="#9fe870" />
        <path d="M40 42h24M40 52h24M40 62h14" stroke="#163300" strokeWidth="3" strokeLinecap="round" />
        <circle cx="74" cy="72" r="14" fill="#0e0f0c" />
        <path d="M68 72h12M74 66v12" stroke="#9fe870" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (mark === "clock") {
    return (
      <svg viewBox="0 0 112 112" className={common} aria-hidden>
        <circle cx="56" cy="56" r="52" fill="#9fe870" />
        <circle cx="56" cy="56" r="30" fill="none" stroke="#163300" strokeWidth="6" />
        <path d="M74 38a28 28 0 0 1 4 22" fill="none" stroke="#163300" strokeWidth="6" strokeLinecap="round" />
        <path d="M40 70l10-8 16 6" fill="none" stroke="#163300" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="56" cy="56" r="4" fill="#163300" />
      </svg>
    );
  }
  if (mark === "agent") {
    return (
      <svg viewBox="0 0 112 112" className={common} aria-hidden>
        <circle cx="56" cy="56" r="52" fill="#9fe870" />
        <circle cx="40" cy="46" r="14" fill="#163300" />
        <circle cx="74" cy="46" r="14" fill="#0e0f0c" />
        <path d="M28 78c2-12 10-18 18-18s16 6 18 18" fill="none" stroke="#163300" strokeWidth="4" strokeLinecap="round" />
        <path d="M58 78c2-12 8-18 16-18 6 0 12 4 16 12" fill="none" stroke="#0e0f0c" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 112 112" className={common} aria-hidden>
      <circle cx="56" cy="56" r="52" fill="#163300" />
      <path d="M56 24v64" stroke="#9fe870" strokeWidth="4" strokeLinecap="round" />
      <path d="M56 34H34l8 16-8 16h22" fill="none" stroke="#9fe870" strokeWidth="4" strokeLinejoin="round" />
      <path d="M56 34h22l-8 16 8 16H56" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="34" cy="66" r="5" fill="#9fe870" />
      <circle cx="78" cy="66" r="5" fill="#ffffff" />
    </svg>
  );
}

function FeatureCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const busy = useRef(false);
  const last = FEATURE_CARDS.length - 1;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const cards = el.querySelectorAll("article");
      if (cards.length < 2) return;
      const step = (cards[1] as HTMLElement).offsetLeft - (cards[0] as HTMLElement).offsetLeft;
      el.style.setProperty("--feature-step", `${step}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function move(direction: -1 | 1) {
    if (busy.current) return;
    if (direction === 1 && index >= last) return;
    if (direction === -1 && index <= 0) return;
    busy.current = true;
    window.setTimeout(() => {
      busy.current = false;
    }, 1000);
    if (direction === 1) {
      setLeaving(index);
      setIndex(index + 1);
      return;
    }
    setLeaving(index - 1);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIndex((current) => current - 1);
        setLeaving(null);
      });
    });
  }

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(22rem,34rem)] lg:gap-8" role="region" aria-roledescription="carousel" aria-label="How a RELAY payment is held">
      <div className="px-5 sm:px-8 lg:pl-12 lg:pr-4">
        <h2 className="display-feature">
          <span className="block">For funds</span>
          <span className="block">that wait</span>
        </h2>
        <div className="mt-5 flex gap-3">
          <button type="button" aria-label="Previous feature" disabled={index === 0} onClick={() => move(-1)} className="grid size-12 place-items-center rounded-full bg-[#eceee8] text-ink transition hover:bg-[#e4e7dc] disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M11 4 6 9l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" aria-label="Next feature" disabled={index >= last} onClick={() => move(1)} className="grid size-12 place-items-center rounded-full bg-meadow text-brand transition hover:bg-[#8fdf55] disabled:bg-[#eceee8] disabled:text-ink disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M7 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden py-3 sm:py-5">
        <div ref={track} className="feature-track flex w-max" style={{ transform: `translateX(calc(var(--feature-step, 26rem) * ${-index}))` }}>
          {FEATURE_CARDS.map((card, cardIndex) => (
            <article
              key={card.label}
              className={`feature-card flex h-[min(34rem,68vh)] w-[min(22rem,78vw)] shrink-0 flex-col items-center rounded-[32px] px-7 py-8 text-center ${card.tone === "meadow" ? "bg-meadow text-ink" : "bg-brand text-white"} ${leaving === cardIndex ? "is-exit" : ""}`}
            >
              <div className="grid size-32 place-items-center sm:size-40">
                <FeatureMark mark={card.mark} />
              </div>
              <p className={`mt-6 max-w-[18rem] text-lg font-medium leading-snug sm:text-xl ${card.tone === "brand" ? "text-meadow" : ""}`}>{card.copy}</p>
              <p className={`mt-auto inline-flex rounded-full px-4 py-2 text-sm font-semibold ${card.tone === "meadow" ? "bg-brand text-white" : "bg-meadow text-brand"}`}>{card.label}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

const CHASE_MARKS = [
  "/images/scroll-wave.webp",
  "/images/scroll-s.png",
  "/images/scroll-dollar.png",
  "/images/scroll-stable.png",
  "/images/scroll-btc.png",
];

function ChaseStrip() {
  const root = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = root.current;
    const arrowEl = arrow.current;
    if (!rootEl || !arrowEl) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const update = () => {
      const rect = rootEl.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      const minWidth = window.innerWidth < 640 ? 88 : 112;
      const maxWidth = Math.min(window.innerWidth * 0.62, 980);
      arrowEl.style.width = `${reduce ? minWidth + (maxWidth - minWidth) * 0.45 : minWidth + (maxWidth - minWidth) * progress}px`;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const marks = [...CHASE_MARKS, ...CHASE_MARKS, ...CHASE_MARKS, ...CHASE_MARKS];

  return (
    <div ref={root} className="relative z-10 overflow-hidden border-t border-line bg-white py-6" aria-label="Marks for a RELAY agreement">
      <div className="flex items-center">
        <div ref={arrow} className="flex h-20 shrink-0 items-center justify-end rounded-r-full bg-meadow pr-2 sm:h-28" style={{ width: 112 }}>
          <span className="grid size-16 place-items-center rounded-full bg-brand text-meadow sm:size-[5.5rem]">
            <svg width="26" height="26" viewBox="0 0 18 18" aria-hidden>
              <path d="M4 9h10M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3 pl-3 sm:gap-5 sm:pl-4">
          {marks.map((src, index) => (
            <img key={`${src}-${index}`} src={src} alt="" className="size-[4.5rem] shrink-0 rounded-full object-cover sm:size-28" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingScreen() {
  return (
    <div className="landing-root relative w-full">
      <section className="hero-screen bg-white">
        <HeroSectionwithPixelBackground />
      </section>

      <ChaseStrip />

      <section className="px-4 pb-4 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl grid-rows-3 gap-3 sm:h-[min(36rem,72vh)] sm:grid-cols-3 sm:grid-rows-1 sm:gap-4">
        <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] bg-brand p-5 text-white sm:p-6">
          <h2 className="display text-2xl uppercase leading-[0.92] sm:text-3xl">Funds stay locked</h2>
          <p className="mt-2 text-sm text-white/80 sm:text-base">MUSD sits in the escrow until release, a missed-delivery refund, or a resolver settlement. The app cannot move it on its own.</p>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <img src="/images/lock-clear.png?v=3" alt="A painted padlock in teal and green" className="max-h-full w-auto object-contain" />
          </div>
        </article>
        <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] bg-white p-5 text-ink shadow-[0_16px_40px_rgb(14_15_12_/_8%)] sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Product preview · not a live transaction</p>
          <h2 className="display mt-1 text-xl uppercase leading-[0.95] sm:text-2xl">Low-friction protected checkout</h2>
          <p className="mt-1 text-sm text-muted">Sample figures. A live checkout shows the amount, deadlines, and resolver read from the contract.</p>
          <div className="mt-3 flex items-end justify-between border-b border-line pb-2 text-sm">
            <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold">MUSD</span>
            <span className="num display text-4xl leading-none">50.00</span>
          </div>
          <div className="mt-2 flex items-end justify-between border-b border-line pb-2 text-sm">
            <span>After release</span>
            <span className="num display text-4xl leading-none">50.00</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>Protocol fee</span>
            <span className="font-semibold">0.00 MUSD</span>
          </div>
          <p className="mt-1 text-xs text-faint">Review window in this example: 48 hours after delivery.</p>
          <Button href="/create" className="mt-auto w-full !bg-meadow !text-brand hover:!bg-[#8fdf55]">Create a checkout</Button>
        </article>
        <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] bg-[#07140f] p-5 text-white sm:p-6">
          <h2 className="display text-2xl uppercase leading-[0.92] text-meadow sm:text-3xl">MUSD on Mezo</h2>
          <p className="mt-2 text-sm text-white/75 sm:text-base">Mezo Testnet in this app. Gas is BTC. MUSD is the payment token, and on testnet it is borrowed rather than sent by the faucet.</p>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <img src="/images/planet.webp" alt="" className="max-h-full w-auto object-contain" />
          </div>
        </article>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col justify-center gap-6">
        <h2 className="display-feature text-center">The rules are not hidden</h2>
        <p className="mx-auto max-w-2xl text-center text-base text-muted sm:text-lg">{FUNDS_DISCLOSURE} {NO_FEE_DISCLOSURE}</p>
        <div className="flex items-center justify-center rounded-[32px] bg-meadow px-6 py-12 sm:py-16">
          <div className="text-center">
            <p className="display text-[clamp(3rem,6vw,5.5rem)] uppercase leading-[0.86]">0 protocol fee</p>
            <p className="mt-3 text-base text-ink/80 sm:text-lg">The wallet still shows the network fee in BTC before you sign. RELAY does not invent that number.</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-3 gap-3 text-left sm:gap-4">
          {[
            ["Contract", "The escrow holds the MUSD until release, refund, or a full or split settlement."],
            ["Terms first", "A buyer can read the seller, amount, deadlines, review window, and resolver before connecting."],
            ["Settlement", "A missed deadline can refund the buyer. A dispute can be paid, refunded, or split by the resolver."],
          ].map(([title, copy]) => (
            <div key={title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-meadow text-sm font-bold text-brand" aria-hidden>{title.slice(0, 1)}</span>
              <div>
                <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
                <p className="mt-1 text-xs text-muted sm:text-base">{copy}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col">
        <h2 className="display-feature text-center">Agree, fund, deliver, release</h2>
        <ol className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {HOW_STEPS.map((step, index) => (
            <li key={step.title} className="flex min-h-56 flex-col rounded-[28px] bg-raised p-4 sm:min-h-72 sm:p-6">
              <p className="text-sm font-semibold text-faint">0{index + 1}</p>
              <h3 className="display mt-2 text-2xl uppercase leading-[0.92] sm:text-4xl">{step.title}</h3>
              <p className="mt-3 text-sm text-muted sm:text-base">{step.copy}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {PRODUCT_NOTES.map((note) => (
            <article key={note.title} className="rounded-[28px] border border-line bg-white p-4 sm:p-5">
              <h3 className="font-semibold">{note.title}</h3>
              <p className="mt-2 text-sm text-muted">{note.copy}</p>
            </article>
          ))}
        </div>
        </div>
      </section>

      <section>
        <FeatureCarousel />
      </section>

      <section className="px-3 sm:px-6">
        <div className="relative mx-auto h-[min(42rem,78vh)] w-full max-w-[96rem]">
          <img src="/images/planet.webp" alt="" className="pointer-events-none absolute left-1/2 top-0 z-10 w-[min(260px,32vw)] -translate-x-1/2 -translate-y-[12%]" />
          <div className="flex h-full flex-col items-center justify-center rounded-[36px] bg-brand px-6 pb-10 pt-48 text-center text-white sm:px-12 sm:pt-56">
            <h2 className="display-feature text-meadow">
              <span className="block">The money</span>
              <span className="block">waits here</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-snug text-white/80 sm:text-lg">The buyer releases it, a missed deadline can refund it, the review window can finalize it to the seller, or the resolver settles a dispute in full or as a split.</p>
            <Button href="/how-it-works" className="mt-5 !bg-meadow !text-brand hover:!bg-[#8fdf55]">How it works</Button>
          </div>
        </div>
      </section>

      <section className="px-3 py-6 sm:px-6">
        <div className="mx-auto flex h-[min(42rem,78vh)] w-full max-w-[96rem] items-center rounded-[36px] bg-meadow px-4 py-6 sm:px-8">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center rounded-[32px] bg-white px-6 py-8 text-center sm:px-12">
            <h2 className="display-feature">
              <span className="block">Open the app</span>
              <span className="block">for a protected</span>
              <span className="block">checkout</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-snug text-muted sm:text-lg">Create one checkout or a milestone plan, set an agent budget, and follow each agreement from the dashboard.</p>
            <Button href="/dashboard" className="mt-6 !bg-meadow !text-brand hover:!bg-[#8fdf55]">Launch app</Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <div className="grid grid-cols-3 gap-3 border-b border-line pb-4 sm:gap-4 sm:pb-5">
              {[
                ["No protocol fee", "This version adds no fee of its own. Your wallet shows the network fee in BTC."],
                ["Named buyer or open link", "A named buyer is the funder. An open link lets the first allowed funder become the buyer."],
                ["No admin sweep", "There is no key in this app that can withdraw funds from the escrow."],
              ].map(([title, copy]) => (
                <div key={title}>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-xs text-muted sm:text-base">{copy}</p>
                </div>
              ))}
            </div>
            <div className="grid items-center gap-6 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <h2 className="display-feature max-w-[10ch]">Funds stay locked</h2>
                <p className="mt-4 max-w-lg text-base text-muted sm:text-lg">A buyer funds one agreement. The seller is paid only when release, the review window, or the resolver says so.</p>
                <Button href="/docs" className="mt-6 !bg-meadow !text-brand hover:!bg-[#8fdf55]">Read the contract rules</Button>
              </div>
              <img src="/images/lock-clear.png?v=3" alt="A painted padlock in teal and green" className="mx-auto max-h-[24vh] w-auto object-contain sm:max-h-[42vh]" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:mt-6 sm:gap-4">
              {[
                ["Missed delivery", "The buyer can refund only after the deadline, and only if nothing was submitted."],
                ["Evidence hash", "The hash records the note and link. It does not prove the work is acceptable."],
                ["Not audited", "RELAY has not been independently audited. Read the docs before you fund."],
              ].map(([title, copy]) => (
                <div key={title} className="text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-full bg-raised text-sm font-semibold text-brand" aria-hidden>{title.slice(0, 1)}</span>
                  <p className="mt-2 text-xs text-muted sm:mt-3 sm:text-base">{copy}</p>
                </div>
              ))}
            </div>
          </div>
      </section>

      <section className="px-4 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col py-4">
        <h2 className="display-feature text-center">Questions</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted sm:text-base">{RESOLVER_DISCLOSURE}</p>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.question} className="py-3">
              <summary className="cursor-pointer list-none text-lg font-semibold sm:text-xl">{item.question}</summary>
              <p className="mt-1 text-sm text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
        </div>
      </section>
    </div>
  );
}
