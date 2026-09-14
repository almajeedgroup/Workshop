/**
 * The landing site's motion, in one place.
 *
 * Everything that moves on the public site is started from here and nowhere
 * else. Scattering GSAP calls through the pages is how a site ends up with
 * four competing scroll listeners, three definitions of "in view", and an
 * animation nobody can find to turn off.
 *
 * ── REDUCED MOTION IS NOT A DEGRADED MODE ────────────────────────────────
 *
 * If the visitor has asked their operating system for less motion, nothing
 * here runs at all: every element is simply shown, in its final state, with
 * no transition. Not "shown faster" and not "shown with a smaller movement" —
 * shown. Somebody who gets motion sickness from a parallax layer does not
 * want a shorter parallax layer.
 *
 * That path is also the one the contrast audit measures, because the final
 * colour of a thing is the colour it settles at.
 *
 * ── WHY ScrollTrigger.batch RATHER THAN AN OBSERVER ──────────────────────
 *
 * This replaced a hand-rolled scroll sweep. The sweep existed because a plain
 * IntersectionObserver only reports what is intersecting NOW, so jumping down
 * the page — an anchor link, a flick-scroll on a phone — left everything in
 * between permanently invisible. `batch` handles that case, and handles the
 * grouping the sweep never did: six cards entering together animate as one
 * staggered run rather than six unrelated fades.
 *
 * ── WHAT EACH PIECE IS FOR ───────────────────────────────────────────────
 *
 *   reveal      the base: anything marked [data-reveal] rises into place
 *   headline    the display heading arrives a line at a time
 *   depth       the hero's two colour washes drift at different rates
 *   counters    a figure counts up to itself once, when it is first seen
 *   rail        a scroll-progress line under the header
 *   steps       the numbered sequence advances as you scroll through it
 *   magnetic    buttons lean very slightly towards the pointer
 *   tilt        cards take on a few degrees of perspective under the pointer
 *
 * Pointer effects are bound only for a device that actually has a pointer
 * (`hover: hover`), so nothing listens to touch events it will never get.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** The house curve. One ease everywhere, so the site moves like one thing. */
const EASE = 'power3.out';

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

const hasPointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

/** Anything marked [data-reveal], in the groups it appears in. */
function reveal(root) {
  const nodes = gsap.utils.toArray('[data-reveal]', root);
  if (!nodes.length) return;

  // Already at opacity 0 from the `.motion` class; only the offset is new.
  gsap.set(nodes, { opacity: 0, y: 20 });
  ScrollTrigger.batch(nodes, {
    start: 'top 88%',
    once: true,
    batchMax: 8,
    onEnter: (batch) => gsap.to(batch, {
      opacity: 1, y: 0, duration: 0.72, ease: EASE, stagger: 0.075, overwrite: true,
    }),
  });

  // Anything already above the fold on load should not wait for a scroll.
  ScrollTrigger.refresh();
}

/**
 * The display heading, a line at a time.
 *
 * Split by the <br> the markup already has rather than by measuring text:
 * a measured split re-wraps differently at every width and has to be rebuilt
 * on resize, and it breaks screen readers unless every fragment is hidden and
 * the whole is relabelled. The markup's own line breaks are the author's
 * intent and they are stable.
 */
function headline(root) {
  const h1 = root.querySelector('.hero .display');
  if (!h1 || h1.dataset.split === 'done') return;

  const html = h1.innerHTML;
  if (!html.includes('<br')) return;                    // one line: nothing to stagger

  const lines = html.split(/<br\s*\/?>/i);
  // The label is built from the LINES, joined with a space. Reading
  // h1.textContent instead loses the break and announces "Learn it bybuilding
  // it" — the markup's <br> is a word boundary, not just a line one.
  const spoken = lines
    .map((line) => line.replace(/<[^>]*>/g, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  h1.setAttribute('aria-label', spoken);
  h1.innerHTML = lines
    .map((line) => `<span class="ln" aria-hidden="true"><span class="ln-i">${line}</span></span>`)
    .join('');
  h1.dataset.split = 'done';

  gsap.from(h1.querySelectorAll('.ln-i'), {
    yPercent: 115, duration: 0.9, ease: EASE, stagger: 0.09, delay: 0.05,
  });
}

/**
 * Depth in the hero.
 *
 * The two washes are painted by a pseudo-element, which cannot be animated
 * directly — so the positions are custom properties and those are what move.
 * Percentages, not pixels, so the drift is the same shape on a phone.
 */
function depth(root) {
  const hero = root.querySelector('.hero');
  if (!hero) return;

  gsap.to(hero, {
    '--glow-a': '18%',
    '--glow-b': '-14%',
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
  });

  // The card in the hero sits a little in front of everything else.
  const card = hero.querySelector('.vcard');
  if (card) {
    gsap.to(card, {
      yPercent: -8,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
  }
}

/**
 * Figures count up to themselves.
 *
 * Only where the label IS a number. "QR" and "24/7" are labels that happen to
 * live in the same slot, and counting them up would produce nonsense — so the
 * text has to parse as an integer before anything animates.
 */
function counters(root) {
  gsap.utils.toArray('.stats .n', root).forEach((el) => {
    const text = el.textContent.trim();
    if (!/^\d+$/.test(text)) return;
    const target = Number(text);
    if (!target) return;

    const counter = { v: 0 };
    gsap.to(counter, {
      v: target,
      duration: Math.min(1.4, 0.35 + target * 0.035),
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onUpdate: () => { el.textContent = String(Math.round(counter.v)); },
      onComplete: () => { el.textContent = text; },
    });
  });
}

/** A hairline under the sticky header showing how far down the page you are. */
function rail(root) {
  const header = root.querySelector('.hdr');
  if (!header || header.querySelector('.scroll-rail')) return;

  const bar = document.createElement('i');
  bar.className = 'scroll-rail';
  bar.setAttribute('aria-hidden', 'true');
  header.appendChild(bar);

  gsap.fromTo(bar, { scaleX: 0 }, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: () => document.body.scrollHeight - window.innerHeight, scrub: 0.3 },
  });
}

/**
 * The numbered sequence advances as it is scrolled through.
 *
 * NOT pinned. Pinning hijacks the scrollbar — the page stops moving while the
 * content changes, which on a phone reads as the site having frozen. The
 * steps simply light one after another as they pass, and the page keeps
 * scrolling the way the reader expects it to.
 */
function steps(root) {
  const rows = gsap.utils.toArray('.steps .step', root);
  if (rows.length < 2) return;

  rows.forEach((row) => {
    const num = row.querySelector('.num');
    gsap.fromTo(row, { opacity: 0.42 }, {
      opacity: 1,
      duration: 0.45,
      ease: 'none',
      scrollTrigger: { trigger: row, start: 'top 82%', end: 'bottom 40%', toggleActions: 'play none none reverse' },
    });
    if (num) {
      gsap.fromTo(num, { scale: 0.72, rotate: -12 }, {
        scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(2)',
        scrollTrigger: { trigger: row, start: 'top 82%', once: true },
      });
    }
  });
}

/** Buttons lean a few pixels towards the pointer, and snap back when it goes. */
function magnetic(root) {
  if (!hasPointer()) return;

  gsap.utils.toArray('.btn', root).forEach((btn) => {
    const move = (e) => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - (r.left + r.width / 2)) * 0.16,
        y: (e.clientY - (r.top + r.height / 2)) * 0.28,
        duration: 0.4, ease: 'power3.out',
      });
    };
    const reset = () => gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.45)' });
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerleave', reset);
    // Focus is not hover: a keyboard user must never be left with a button
    // parked off its own centre.
    btn.addEventListener('blur', reset);
  });
}

/** A few degrees of perspective on a card under the pointer. */
function tilt(root) {
  if (!hasPointer()) return;

  gsap.utils.toArray('.card, .fstrip a, .vcard', root).forEach((card) => {
    const move = (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(card, {
        rotateY: px * 5, rotateX: -py * 5, transformPerspective: 900,
        duration: 0.45, ease: 'power2.out',
      });
    };
    const reset = () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'power3.out' });
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerleave', reset);
  });
}

/* ------------------------------------------------------------------ *
 * The one entry point
 * ------------------------------------------------------------------ */

/**
 * Start everything for the page that is currently rendered.
 *
 * Returns a cleanup that kills every tween, trigger and listener this call
 * created — `gsap.context` tracks them, so a route change cannot leave a
 * ScrollTrigger behind measuring a page that no longer exists.
 */
export function startMotion(rootEl) {
  const root = rootEl || document.querySelector('.site');
  if (!root) return () => {};

  if (prefersReducedMotion()) {
    // Shown, not shown differently.
    root.querySelectorAll('[data-reveal]').forEach((n) => gsap.set(n, { clearProps: 'all' }));
    return () => {};
  }

  root.classList.add('motion');
  // Everything created inside this callback is tracked by the context, so one
  // revert() takes all of it — tweens, ScrollTriggers and the listeners the
  // pointer effects add. The helpers do NOT take `ctx` as an argument: the
  // callback runs synchronously inside gsap.context(), so reading the const it
  // is being assigned to throws before a single tween is made.
  const ctx = gsap.context(() => {
    reveal(root);
    headline(root);
    depth(root);
    counters(root);
    rail(root);
    steps(root);
    magnetic(root);
    tilt(root);
  }, root);

  return () => {
    ctx.revert();
    root.classList.remove('motion');
    root.querySelector('.scroll-rail')?.remove();
  };
}
