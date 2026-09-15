/**
 * The rendered half of the colour check.
 *
 * `tests/contrast.test.js` does the sums that a file can settle on its own —
 * the tokens, and which of them may be text. It deliberately does not guess
 * what sits behind an arbitrary selector, because a static reader cannot know
 * that `.band-dark p` is light text on navy rather than grey on paper, and one
 * that guesses produces a page of false findings nobody reads.
 *
 * Ancestry is this script's job. It opens a real browser, walks every element
 * that has text of its own, and composites the background up the ancestor
 * chain — alpha, and gradient stops, taking the worst stop rather than the
 * first. It also checks the two non-text things WCAG asks 3:1 of: the focus
 * indicator, and the edge of a control you are meant to type into.
 *
 * Not part of `npm test`: it needs a browser and a built site. Run it when
 * colours change.
 *
 *   npm run build && npx vite preview --port 4177 &
 *   npm i --no-save playwright-core
 *   node tools/contrast-audit.mjs
 *
 * Set BASE to point it somewhere else, and WIDTHS to change the viewports.
 *
 * ── WHAT IT DOES NOT CHECK ───────────────────────────────────────────────
 * The admin screens. They need a live Firestore to render, so there is
 * nothing to walk without one. `styles.css` is checked statically instead.
 */

import { chromium } from 'playwright-core';

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 4177}`;

/* Prove the origin answers before measuring it. A sweep pointed at a port
   nobody was serving reported every page clean once, and a stale preview
   left running on that port is worse: it answers, and reports a clean
   audit of a build from last week. */
const probe = await fetch(BASE).catch(() => null);
if (!probe || !probe.ok) {
  console.error(`NOTHING SERVING ${BASE} — run \`npm run build && npx vite preview --port ${process.env.PORT || 4177}\` first,`);
  console.error('or point this at a running preview with PORT=… or BASE=…');
  process.exit(2);
}
const WIDTHS = (process.env.WIDTHS || '1440,1280,1079,768,390').split(',').map(Number);
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const PATHS = [
  '/', '/programmes', '/features', '/certificates', '/about', '/contact', '/verify', '/login',
  '/features/registration', '/features/tickets', '/features/online-classes',
  '/features/class-record', '/features/attendance', '/features/id-cards',
  '/features/certificates', '/features/verification', '/features/records', '/features/printing',
];

/* The page-side pass. A template literal, so every backslash in a regex here
   has to be doubled — a lone \s arrives as a plain "s" and quietly matches
   nothing, which is its own afternoon. */
const TEXT_AUDIT = `(() => {
  const px = (c) => { const m = String(c).match(/[\\d.]+/g); if (!m) return { r:0,g:0,b:0,a:0 };
    const n = m.map(Number); return { r:n[0], g:n[1], b:n[2], a: n.length > 3 ? n[3] : 1 }; };
  const over = (f,bg) => ({ r:f.r*f.a+bg.r*(1-f.a), g:f.g*f.a+bg.g*(1-f.a), b:f.b*f.a+bg.b*(1-f.a), a:1 });
  const lum = (c) => { const f=(v)=>{v/=255; return v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4;};
    return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
  const hex = (c) => '#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();

  const bgOf = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      stack.push(px(cs.backgroundColor));
      // A gradient only counts as the ground if it actually covers the box.
      // The admin sidebar paints the flag as a 3px stripe down one edge; a
      // naive reader calls that the page background and invents findings.
      const size = cs.backgroundSize;
      const box = n.getBoundingClientRect();
      const parts = size.split(/\\s+/);
      const fits = (v, whole) => (!v || v === 'auto' || v.endsWith('%')) ? true : parseFloat(v) >= whole - 1;
      const covers = /^(auto|cover|contain)/.test(size) ? true : (fits(parts[0], box.width) && fits(parts[1], box.height));
      if (covers && cs.backgroundImage && cs.backgroundImage !== 'none') {
        const stops = [...cs.backgroundImage.matchAll(/rgba?\\([^)]*\\)/g)].map(m => px(m[0])).filter(c => c.a > 0);
        if (stops.length) stack.push({ stops });
        else stack.push({ img: true, r:0, g:0, b:0, a:0 });
      }
    }
    let base = { r:255,g:255,b:255,a:1 }, img = false, grad = null;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].stops) { grad = stack[i].stops; base = stack[i].stops[0]; continue; }
      if (stack[i].img) { img = true; continue; }
      // An opaque colour nearer the text hides whatever gradient is behind it.
      if (stack[i].a >= 1) { grad = null; base = stack[i]; continue; }
      if (stack[i].a > 0) base = over(stack[i], base);
    }
    return { c: base, img, grad };
  };

  const out = [], seen = new Set();
  for (const el of document.querySelectorAll('*')) {
    // WCAG exempts text that is part of a logo or brand name. That is what
    // makes the lime lawful at 2.12:1, and it is the only exemption taken.
    if (el.closest('.wm-head, .wm-tail')) continue;
    const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own && !isField) continue;
    const text = (isField ? (el.value || el.placeholder || '')
      : [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')).trim();
    if (!text) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.1) continue;

    const bg = bgOf(el);
    const fg = over(px(cs.color), bg.c);
    const L1 = lum(fg);
    // Against a gradient, the worst stop is the one the text has to survive.
    const grounds = bg.grad || [bg.c];
    let worst = grounds[0], ratio = Infinity;
    for (const g of grounds) {
      const L2 = lum(g);
      const r2 = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      if (r2 < ratio) { ratio = r2; worst = g; }
    }
    const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (weight >= 700 && size >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio >= need) continue;

    const sel = el.tagName.toLowerCase()
      + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
    const key = [sel, hex(fg), hex(worst), size].join('|');
    if (seen.has(key)) continue; seen.add(key);
    out.push({ sel, text: text.slice(0,44), fg: hex(fg), bg: hex(worst),
      ratio: +ratio.toFixed(2), need, size: +size.toFixed(1), weight, unknownImage: bg.img || undefined });
  }
  return out;
})()`;

/* Focus indicators and control edges: 1.4.11 wants 3:1 for both. */
const NONTEXT_AUDIT = `(() => {
  const px = (c) => { const m = String(c).match(/[\\d.]+/g); if (!m) return { r:0,g:0,b:0,a:0 };
    const n = m.map(Number); return { r:n[0], g:n[1], b:n[2], a: n.length > 3 ? n[3] : 1 }; };
  const over = (f,bg) => ({ r:f.r*f.a+bg.r*(1-f.a), g:f.g*f.a+bg.g*(1-f.a), b:f.b*f.a+bg.b*(1-f.a), a:1 });
  const lum = (c) => { const f=(v)=>{v/=255; return v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4;};
    return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
  const hex = (c) => '#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
  const ground = (el) => {
    const st = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      st.push(px(cs.backgroundColor));
      const size = cs.backgroundSize, box = n.getBoundingClientRect(), parts = size.split(/\\s+/);
      const fits = (v, whole) => (!v || v === 'auto' || v.endsWith('%')) ? true : parseFloat(v) >= whole - 1;
      const covers = /^(auto|cover|contain)/.test(size) ? true : (fits(parts[0], box.width) && fits(parts[1], box.height));
      if (covers && cs.backgroundImage !== 'none') {
        const stops = [...cs.backgroundImage.matchAll(/rgba?\\([^)]*\\)/g)].map(m => px(m[0])).filter(c => c.a > 0);
        // A ring has to stay visible against the lightest part of a gradient.
        if (stops.length) st.push({ stop: stops.reduce((a,c) => lum(c) > lum(a) ? c : a) });
      }
    }
    let base = { r:255,g:255,b:255,a:1 };
    for (let i = st.length - 1; i >= 0; i--) {
      if (st[i].stop) { base = st[i].stop; continue; }
      if (st[i].a > 0) base = st[i].a >= 1 ? st[i] : over(st[i], base);
    }
    return base;
  };
  const ratio = (a,b) => { const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05); };
  const name = (el) => el.tagName.toLowerCase()
    + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '');

  const out = [];
  for (const el of document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (el.disabled) continue;                       // not focusable, nothing to indicate
    el.focus({ preventScroll: true });
    const cs = getComputedStyle(el);
    const width = parseFloat(cs.outlineWidth) || 0;
    const bg = ground(el.parentElement || document.body);
    if (cs.outlineStyle === 'none' || width < 1) {
      // Not necessarily wrong — a control may indicate focus by changing its
      // own fill instead. Reported so a person can look.
      out.push({ kind: 'focus', issue: 'no outline; check for another indicator', sel: name(el) });
    } else {
      const rr = ratio(over(px(cs.outlineColor), bg), bg);
      if (rr < 3) out.push({ kind: 'focus', issue: 'outline ' + rr.toFixed(2) + ':1', sel: name(el), fg: hex(px(cs.outlineColor)), bg: hex(bg) });
    }
    el.blur();
  }
  for (const el of document.querySelectorAll('input,textarea,select')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    // A control can be present, focusable and keyboard-operable while being
    // invisible on purpose: the radios behind a styled picker, and the
    // honeypot the registration form hides off-screen. The thing a person
    // sees is the label, which is checked as an element in its own right.
    // Flagging the input itself means crying wolf on every page that has one.
    if (Number(cs.opacity) < 0.1 || r.width <= 2 || r.height <= 2
        || r.right < 0 || r.left > innerWidth) continue;
    const around = ground(el.parentElement || document.body);
    const bw = parseFloat(cs.borderTopWidth) || 0;
    if (bw < 1) {
      // A control's visible boundary is not always its own border. The email
      // capture draws one edge round the input AND its button, which is what
      // a person sees and what 1.4.11 is actually about — so look up a
      // couple of levels for a bounded edge before calling it unbounded.
      let bounded = false;
      let n = el.parentElement;
      for (let up = 0; n && up < 3; up++, n = n.parentElement) {
        const pcs = getComputedStyle(n);
        const pw = parseFloat(pcs.borderTopWidth) || 0;
        if (pw >= 1 && ratio(over(px(pcs.borderTopColor), around), around) >= 3) { bounded = true; break; }
      }
      const own = px(cs.backgroundColor);
      if (!bounded && ratio(own.a > 0 ? own : around, around) < 3) {
        out.push({ kind: 'field', issue: 'no border, and nothing around it draws one', sel: name(el) });
      }
      continue;
    }
    const rr = ratio(over(px(cs.borderTopColor), around), around);
    if (rr < 3) out.push({ kind: 'field', issue: 'border ' + rr.toFixed(2) + ':1', sel: name(el), fg: hex(px(cs.borderTopColor)), bg: hex(around) });
  }

  /* BUTTONS TOO. This used to check only input, textarea and select, which
     is how a button border went from 21:1 to 1.35:1 across the admin with
     a clean audit — 1.4.11 is about user interface components, and a
     button is the commonest one on the screen.

     Either edge may carry it: a filled button is bounded by its fill, an
     outlined one by its border. It fails only when NEITHER reaches 3:1. */
  for (const el of document.querySelectorAll('button, a.btn, .btn, .chip, [role="button"]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.width <= 2 || r.height <= 2) continue;
    const cs = getComputedStyle(el);
    if (Number(cs.opacity) < 0.1 || cs.visibility === 'hidden') continue;
    if (r.right < 0 || r.left > innerWidth) continue;
    // 1.4.11 exempts inactive components by name. A submit button greyed
    // out until its form is valid is the commonest one on this site, and
    // flagging it every time is how a checker gets ignored.
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;

    const around = ground(el.parentElement || document.body);
    const fill = px(cs.backgroundColor);
    const byFill = fill.a > 0 ? ratio(over(fill, around), around) : 0;

    const bw = parseFloat(cs.borderTopWidth) || 0;
    const byBorder = bw >= 1 ? ratio(over(px(cs.borderTopColor), around), around) : 0;

    // An inset box-shadow is how the public site draws an outlined button.
    // Its COLOUR is measured, not assumed: treating any inset shadow as a
    // pass makes the commonest outlined button on the site unmeasurable.
    let ring = 0;
    if (/inset/.test(cs.boxShadow)) {
      const c = cs.boxShadow.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
      ring = c ? ratio(over(px(c[0]), around), around) : 0;
    }

    // A control's visible boundary is not always its own: an accordion's
    // lip fills its panel, and the panel is what a person sees the edge
    // of. Same lookup the field check does, for the same reason.
    let byContainer = 0;
    let n = el.parentElement;
    for (let up = 0; n && up < 3 && byContainer < 3; up++, n = n.parentElement) {
      const pcs = getComputedStyle(n);
      const pw = parseFloat(pcs.borderTopWidth) || 0;
      if (pw >= 1) byContainer = Math.max(byContainer, ratio(over(px(pcs.borderTopColor), around), around));
    }

    // A control that draws NOTHING — no fill, no border, no ring — is a
    // text control, identified by its label. 1.4.11 is about the visual
    // information needed to identify a component, and where the text IS
    // that information, 1.4.3 governs it instead. The nav's menu buttons
    // are this, exactly like the plain links beside them.
    //
    // This is not a loophole for the bug above: a button that draws
    // something has to draw it at 3:1. It only excuses drawing nothing.
    const drawsNothing = byFill === 0 && bw < 1 && !/inset/.test(cs.boxShadow);
    if (drawsNothing) continue;

    const best = Math.max(byFill, byBorder, ring, byContainer);
    if (best < 3) {
      out.push({ kind: 'control', sel: name(el),
        issue: 'edge ' + best.toFixed(2) + ':1 (fill ' + byFill.toFixed(2)
             + ', border ' + byBorder.toFixed(2) + ')',
        fg: hex(bw >= 1 ? over(px(cs.borderTopColor), around) : over(fill, around)), bg: hex(around) });
    }
  }
  return out;
})()`;

const browser = await chromium.launch({ executablePath: CHROME });
let findings = 0;

for (const width of WIDTHS) {
  const seen = new Map();
  for (const path of PATHS) {
    // Reduced motion, deliberately: startMotion() then does nothing and every
    // element sits at its final colour, which is the colour being measured.
    // It is also the accessible path, so auditing it audits the one that has
    // to be right.
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    for (const f of await page.evaluate(TEXT_AUDIT)) {
      const key = `${f.sel}|${f.fg}|${f.bg}|${f.size}`;
      if (!seen.has(key)) seen.set(key, { ...f, where: [] });
      seen.get(key).where.push(path);
    }
    if (errors.length) console.log(`   !! ${path} — ${errors[0]}`);
    await page.close();
  }
  findings += seen.size;
  console.log(`text @${width}px: ${seen.size || 'clean'}`);
  for (const f of [...seen.values()].sort((a, b) => a.ratio - b.ratio)) {
    console.log('  ', String(f.ratio).padStart(5), '<', f.need, f.fg, 'on', f.bg,
      `${f.size}px/${f.weight}`.padEnd(11), f.sel.slice(0, 46).padEnd(47),
      JSON.stringify(f.text).slice(0, 34), f.where.length > 3 ? `(${f.where.length} pages)` : f.where.join(','));
  }
}

for (const path of PATHS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const rows = [...new Map((await page.evaluate(NONTEXT_AUDIT)).map((r) => [r.kind + r.sel + r.issue, r])).values()];
  if (rows.length) {
    console.log(`non-text ${path}`);
    for (const r of rows) { console.log('  ', r.kind, r.issue, r.sel, r.fg || '', r.bg || ''); findings++; }
  }
  await page.close();
}

await browser.close();
console.log(findings ? `\n${findings} to look at` : '\nnothing under threshold');
