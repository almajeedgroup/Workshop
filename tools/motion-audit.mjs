/**
 * Do the animations actually animate?
 *
 * Twice now an effect has been reported as "not working" and the cause was
 * the same: the tween ran perfectly against a selector that no longer
 * matched anything, because the markup underneath it had been rebuilt. Code
 * that runs is not an effect that happens, and neither a unit test nor a
 * static read of motion.js can tell those apart — only a browser can.
 *
 * So this measures the page in two states, before and after a scroll, and
 * fails if the numbers are the same. Every check names the ONE thing it
 * would catch.
 *
 *   npm run build && npx vite preview --port 4177 &
 *   node tools/motion-audit.mjs
 */

import { chromium } from 'playwright-core';

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 4177}`;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const probe = await fetch(BASE).catch(() => null);
if (!probe || !probe.ok) {
  console.error(`NOTHING SERVING ${BASE} — build and preview first, or pass BASE=…`);
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: CHROME });
const failures = [];
let passed = 0;
const show = (ok, what, detail = '') => {
  if (ok) { passed += 1; console.log(`  ok    ${what}${detail ? `  ${detail}` : ''}`); }
  else { failures.push(`${what}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL  ${what}  ${detail}`); }
};

async function page(path, { motion = true } = {}) {
  const p = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: motion ? 'no-preference' : 'reduce',
  });
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  // The motion module is code-split; give the import and the first frames time.
  await p.waitForTimeout(1400);
  return p;
}
const rounded = (n) => Math.round(Number(n) * 100) / 100;

/* ------------------------------------------------------------------ */
console.log(`\nanimations on ${BASE}\n`);
const home = await page('/');

/* reveal — the thing that hides content until it scrolls in. If this runs
   against nothing, nothing is hidden; if it hides and never un-hides, the
   page is BLANK, which is the failure that actually matters. */
{
  const n = await home.$$eval('[data-reveal]', (e) => e.length);
  show(n > 0, 'the page has things to reveal', `${n} marked`);
  /* Judged against the reveal's OWN trigger line — `start: 'top 88%'` — not
     against the bottom of the window. An element with 16px of itself
     peeking over the fold has not reached its trigger and is supposed to
     still be hidden; testing it against the window edge reports that
     correct behaviour as a failure, which this check did on its first run. */
  const visible = await home.$$eval('[data-reveal]', (els) => els
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return r.top < window.innerHeight * 0.88 && r.bottom > 0;
    })
    .map((e) => Number(getComputedStyle(e).opacity)));
  show(visible.length > 0 && visible.every((o) => o > 0.99),
    'everything past the reveal line is shown without a scroll',
    `${visible.filter((o) => o > 0.99).length}/${visible.length} at full opacity`);
}

/* headline — the display heading is split into lines and each slides up.
   The split is the observable part: no .ln-i means it ran against markup
   that had been renamed, which is exactly what happened before. */
{
  const split = await home.evaluate(() => {
    const h = document.querySelector('.display-lead, .hero .display');
    return h ? { found: true, lines: h.querySelectorAll('.ln-i').length, label: h.getAttribute('aria-label') } : { found: false };
  });
  show(split.found, 'the hero has a display heading');
  show(split.lines > 1, 'the heading is split into lines to stagger', `${split.lines} lines`);
  show(!!split.label && !/\w{25,}/.test(split.label),
    'and the split leaves a spoken label with its word breaks intact',
    JSON.stringify(split.label));
}

/* depth — the hero washes drift as the page scrolls. These are custom
   properties on .hero read by a pseudo-element, so the only way to see them
   move is to read the property before and after. */
{
  const read = () => home.evaluate(() => {
    const h = document.querySelector('.hero');
    return h ? getComputedStyle(h).getPropertyValue('--glow-a').trim() : null;
  });
  const before = await read();
  await home.evaluate(() => window.scrollTo(0, window.innerHeight * 0.6));
  await home.waitForTimeout(900);
  const after = await read();
  show(before !== null, 'the hero is there to animate');
  show(before !== after, 'the hero washes move as it scrolls', `${before || '(unset)'} → ${after || '(unset)'}`);
}

/* counters — figures count up to themselves. Checked by catching one
   mid-count, then confirming it lands exactly on the text it started with. */
{
  const fresh = await page('/');
  const target = await fresh.evaluate(() => {
    const el = [...document.querySelectorAll('.bt-fig, .stats .n')].find((e) => /^\d+$/.test(e.textContent.trim()));
    if (!el) return null;
    el.setAttribute('data-counter-probe', '');
    return el.textContent.trim();
  });
  if (!target) { show(false, 'a figure that is a number exists to count up'); }
  else {
    show(true, 'a figure that is a number exists to count up', target);
    await fresh.evaluate(() => document.querySelector('[data-counter-probe]')
      .scrollIntoView({ block: 'center', behavior: 'auto' }));
    const seen = new Set();
    for (let i = 0; i < 26; i += 1) {
      seen.add(await fresh.$eval('[data-counter-probe]', (e) => e.textContent.trim()));
      await fresh.waitForTimeout(55);
    }
    show(seen.size > 1, 'and it counts rather than appearing', `saw ${seen.size} values`);
    await fresh.waitForTimeout(1200);
    const landed = await fresh.$eval('[data-counter-probe]', (e) => e.textContent.trim());
    show(landed === target, 'and it lands on the real figure, not a rounded one', `${landed} vs ${target}`);
  }
  await fresh.close();
}

/* steps — the numbered sequence lights one at a time. Dimmed ahead of the
   reader, full once passed: if the tween is aimed at nothing they are all
   already at 1 and nothing ever lights. */
{
  const stepped = await page('/');
  const rows = await stepped.$$eval('.steps .step', (e) => e.length);
  if (rows < 2) { show(false, 'the page has a numbered sequence', `${rows} rows`); }
  else {
    show(true, 'the page has a numbered sequence', `${rows} rows`);
    const last = await stepped.evaluate(() => {
      const r = [...document.querySelectorAll('.steps .step')].pop();
      r.scrollIntoView({ block: 'end', behavior: 'auto' });
      return Number(getComputedStyle(r).opacity);
    });
    await stepped.evaluate(() => window.scrollTo(0, 0));
    await stepped.waitForTimeout(700);
    const dimmed = await stepped.evaluate(() => {
      const r = [...document.querySelectorAll('.steps .step')].pop();
      return Number(getComputedStyle(r).opacity);
    });
    show(rounded(dimmed) < 0.99, 'a step ahead of the reader is dimmed', `${rounded(dimmed)} before`);
    const lit = await stepped.evaluate(async () => {
      const r = [...document.querySelectorAll('.steps .step')].pop();
      r.scrollIntoView({ block: 'center', behavior: 'auto' });
      await new Promise((f) => setTimeout(f, 900));
      return Number(getComputedStyle(r).opacity);
    });
    show(rounded(lit) > rounded(dimmed), 'and lights as it is reached', `${rounded(dimmed)} → ${rounded(lit)}`);
    void last;
  }
  await stepped.close();
}

/* tilt — a card leans towards the pointer, in THREE dimensions. Comparing
   any two transforms is not enough: the first version of this check moved
   the pointer while the reveal tween was still running and passed on that
   tween's translate, which would have gone on passing with tilt deleted.
   So it waits for the card to settle and then looks for the 3D matrix that
   only a rotateX/rotateY can produce. */
{
  const card = await home.$('.fstrip a, .bt, .posters .pc, .card, .vcard');
  if (!card) { show(false, 'there is a card to tilt'); }
  else {
    await card.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    let settled = '';
    for (let i = 0; i < 20; i += 1) {
      await home.waitForTimeout(150);
      const now = await card.evaluate((e) => getComputedStyle(e).transform);
      if (now === settled) break;
      settled = now;
    }
    const flat = (t) => t === 'none' || !t.startsWith('matrix3d');
    show(flat(settled), 'a card sits flat until it is pointed at', settled);
    const box = await card.boundingBox();
    await home.mouse.move(box.x + box.width * 0.18, box.y + box.height * 0.18);
    await home.waitForTimeout(600);
    const leaned = await card.evaluate((e) => getComputedStyle(e).transform);
    show(leaned.startsWith('matrix3d') && leaned !== settled,
      'and leans in three dimensions towards the pointer', leaned.slice(0, 58) + '…');
    await home.mouse.move(box.x + box.width / 2, box.y - 300);
    await home.waitForTimeout(900);
    const reset = await card.evaluate((e) => getComputedStyle(e).transform);
    /* The ROTATION has to come back, not the whole matrix. GSAP leaves the
       perspective it set — m34, which is -1/900 = -0.00111 — sitting in the
       matrix afterwards, and that is right: it is the lens, not the lean.
       Demanding a pure identity matrix failed a card that had in fact come
       all the way back. So the nine rotation terms are what get checked. */
    const spin = (t) => {
      if (!t.startsWith('matrix3d')) return 0;
      const n = t.slice(9, -1).split(',').map(Number);
      const want = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      const got = [n[0], n[1], n[2], n[4], n[5], n[6], n[8], n[9], n[10]];
      return Math.max(...got.map((v, i) => Math.abs(v - want[i])));
    };
    show(spin(reset) < 0.001, 'and lies flat again when the pointer goes',
      `worst rotation term off by ${spin(reset).toExponential(1)}, leaned by ${spin(leaned).toFixed(3)}`);
  }
}

/* magnetic — a button leans too, and must snap back when the pointer goes,
   or it is left sitting a few pixels off its own layout. */
{
  const btn = await home.$('.site .btn');
  if (!btn) { show(false, 'there is a button to pull'); }
  else {
    await btn.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await home.waitForTimeout(300);
    const box = await btn.boundingBox();
    await home.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5);
    await home.waitForTimeout(400);
    const pulled = await btn.evaluate((e) => getComputedStyle(e).transform);
    await home.mouse.move(box.x + box.width * 0.85, box.y - 260);
    await home.waitForTimeout(900);
    const back = await btn.evaluate((e) => getComputedStyle(e).transform);
    show(pulled !== 'none' && pulled !== back, 'a button leans towards the pointer', pulled);
    show(back === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(back), 'and snaps back when it leaves', back);
  }
}

/* The setting that overrides all of it. Someone who asked their system for
   less motion must get the page SHOWN, not shown differently — a reveal
   left at opacity 0 for them is a blank page. */
{
  const still = await page('/', { motion: false });
  const hidden = await still.$$eval('[data-reveal]',
    (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.99).length);
  show(hidden === 0, 'reduced motion shows everything, animating nothing', `${hidden} still hidden`);
  const splitAnyway = await still.$$eval('.ln-i', (e) => e.length);
  show(splitAnyway === 0, 'and does not split the heading it will not animate', `${splitAnyway} fragments`);
  await still.close();
}

await home.close();

/* THE WORST FAILURE, ON EVERY PAGE. Each check above is about one effect on
   the home page. This one is about the only outcome that matters everywhere:
   content that is hidden to be revealed and then never revealed. That is not
   a missing animation, it is a blank page — and it would reach a reader as
   "the site is broken", not "the site is plain". */
console.log('\n  nothing left hidden, on every public page\n');
const PAGES = [
  '/', '/programmes', '/features', '/certificates', '/about', '/contact', '/verify',
  '/features/registration', '/features/tickets', '/features/online-classes',
  '/features/class-record', '/features/attendance', '/features/id-cards',
];
for (const path of PAGES) {
  const p = await page(path);
  const stuck = await p.evaluate(async () => {
    // Walk the whole page, because a reveal only fires as it is reached.
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((f) => setTimeout(f, 130));
    }
    window.scrollTo(0, document.body.scrollHeight);
    /* Long enough for the LAST way in to finish, not just the first. The
       safety sweep only starts once scrolling has stopped, and then runs a
       staggered 0.72s tween — so a page caught by the net settles about two
       seconds after the scroll, not half of one. Waiting 900ms here reported
       four pages broken that were merely still arriving. */
    await new Promise((f) => setTimeout(f, 3000));
    return [...document.querySelectorAll('[data-reveal]')]
      .filter((e) => Number(getComputedStyle(e).opacity) < 0.99)
      .map((e) => (e.tagName + '.' + String(e.className)).slice(0, 44));
  });
  show(stuck.length === 0, path, stuck.length ? stuck.join(', ') : 'all shown');
  await p.close();
}

await browser.close();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) console.log('\n' + failures.map((f) => `  · ${f}`).join('\n'));
process.exit(failures.length ? 1 : 0);
