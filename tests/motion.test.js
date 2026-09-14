import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Motion cannot be unit-tested without a browser — every line of it measures
 * or moves a DOM node. What CAN be tested without one is the set of promises
 * the rest of the app relies on, and every one of these was a real bug or a
 * real risk at some point in writing it.
 */

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const motion = read('src/lib/motion.js');
const shell = read('src/components/site/PublicShell.jsx');
const css = read('src/site.css');
const pkg = JSON.parse(read('package.json'));

/* ---------------- reduced motion ---------------- */

test('reduced motion is a full stop, not a smaller movement', () => {
  // Somebody who gets motion sickness from a parallax layer does not want a
  // shorter parallax layer. startMotion must return before starting anything.
  const body = motion.slice(motion.indexOf('export function startMotion'));
  const guard = body.indexOf('prefersReducedMotion()');
  const firstTween = Math.min(
    ...['gsap.context(', 'ScrollTrigger.batch(', 'gsap.to(', 'gsap.from(']
      .map((t) => { const i = body.indexOf(t); return i < 0 ? Infinity : i; })
  );
  assert.ok(guard > -1, 'startMotion does not check for reduced motion');
  assert.ok(guard < firstTween, 'something animates before the reduced-motion check');
});

test('the shell checks reduced motion BEFORE it hides anything', () => {
  // The class is what hides [data-reveal] while the chunk is fetched. Adding
  // it first and checking after leaves a visitor who asked for no motion
  // staring at a blank page for the length of a network round trip.
  const hide = shell.indexOf("classList.add('motion')");
  const check = shell.indexOf('prefers-reduced-motion');
  assert.ok(check > -1 && hide > -1);
  assert.ok(check < hide, 'the motion class goes on before the reduced-motion check');
});

/* ---------------- the no-JavaScript fallback ---------------- */

test('nothing is hidden unless JavaScript is running', () => {
  // [data-reveal] is only ever hidden under `.motion`, which is added by
  // script. A page with no JavaScript, or one whose motion chunk fails,
  // shows everything — which is the correct fallback, not a broken one.
  const hides = [...css.matchAll(/([^{}]*)\{[^{}]*opacity\s*:\s*0[^{}]*\}/g)]
    .map((m) => m[1].trim())
    .filter((sel) => sel.includes('[data-reveal]'));
  assert.ok(hides.length > 0, 'nothing hides [data-reveal] at all');
  for (const sel of hides) {
    assert.match(sel, /\.motion\b/, `"${sel}" hides the page without waiting for script`);
  }
});

test('a chunk that fails to load says so rather than leaving a blank page', () => {
  assert.match(shell, /\.catch\(\(err\) => \{[\s\S]*?classList\.remove\('motion'\)/);
  assert.match(shell, /console\.error\('motion failed to start'/,
    'a silent catch here hid a TDZ error behind a clean console and a 200');
});

/* ---------------- what it costs ---------------- */

test('GSAP is loaded on demand, so the admin never pays for it', () => {
  // It is ~47KB gzipped and only the public site uses it. A static import
  // puts it in the chunk every screen loads.
  assert.ok(pkg.dependencies.gsap, 'gsap is not a dependency');
  assert.match(shell, /import\('\.\.\/\.\.\/lib\/motion\.js'\)/, 'motion.js is not imported dynamically');
  assert.ok(!/^import .*motion\.js/m.test(shell), 'motion.js is also imported statically, which defeats the split');
  // And nothing else may pull it in statically either.
  for (const f of ['src/App.jsx', 'src/main.jsx']) {
    assert.ok(!read(f).includes('lib/motion.js'), `${f} imports motion.js statically`);
  }
});

/* ---------------- the traps ---------------- */

test('the helpers do not read the context they are being created inside', () => {
  // gsap.context() runs its callback SYNCHRONOUSLY, so passing the const it
  // is being assigned to into a helper throws before a single tween is made —
  // which looked exactly like "the animation just does not run".
  assert.ok(!/\(ctx, root\)/.test(motion), 'a helper still takes the context as an argument');
  assert.match(motion, /const ctx = gsap\.context\(/);
  assert.match(motion, /ctx\.revert\(\)/, 'the cleanup must kill what the context tracked');
});

test('route changes cannot leave a trigger or a rail behind', () => {
  assert.match(motion, /root\.querySelector\('\.scroll-rail'\)\?\.remove\(\)/);
  assert.match(shell, /return \(\) => \{[\s\S]*?if \(stop\) stop\(\)/);
});

test('pointer effects are only bound where there is a pointer', () => {
  assert.match(motion, /hover: hover\) and \(pointer: fine/);
  // And a keyboard user must never be left with a button parked off centre.
  assert.match(motion, /addEventListener\('blur', reset\)/);
});

test('the split headline keeps a readable accessible name', () => {
  // Splitting on <br> leaves the fragments aria-hidden, so the heading needs
  // its own label — and building that from textContent loses the break and
  // announces "Learn it bybuilding it".
  assert.match(motion, /aria-hidden="true"/);
  assert.match(motion, /setAttribute\('aria-label', spoken\)/);
  assert.match(motion, /\.join\(' '\)/, 'the label must join the lines with a space');
});

test('figures only count up when they are actually figures', () => {
  // "QR" and "24/7" live in the same slot as "4".
  assert.match(motion, /\/\^\\d\+\$\/\.test\(text\)/);
});
