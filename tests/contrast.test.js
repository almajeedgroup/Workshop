import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The colour rules, as arithmetic.
 *
 * Every stylesheet here states its discipline in a comment at the top —
 * styles.css has said for a long time that the palette is fills and never
 * text. Comments do not fail builds. This does the sums instead.
 *
 * It deliberately does NOT try to work out what sits behind an arbitrary
 * selector: a static reader cannot know that `.band-dark p` is light text on
 * a navy panel rather than unreadable grey on paper, and one that guesses
 * produces a page of false findings nobody reads. Ancestry is the rendered
 * audit's job. What is checked here is the part that is knowable from the
 * file alone — the tokens, and the rule about which of them may be text.
 */

const sheet = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');

const site = sheet('site.css');
const cert = sheet('certificate.css');

/** Every custom property declared in a file, by name. */
function tokens(text) {
  const out = {};
  for (const [, k, v] of code(text).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) out[k] = v.trim();
  return out;
}

function rgb(value, vars, depth = 0) {
  if (!value || depth > 6) return null;
  const v = String(value).trim();
  const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (ref) return rgb(vars[ref[1]] ?? ref[2], vars, depth + 1);
  if (/^#[0-9a-f]{6}$/i.test(v)) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  if (/^#[0-9a-f]{3}$/i.test(v)) return [1, 2, 3].map((i) => parseInt(v[i] + v[i], 16));
  if (/^white$/i.test(v)) return [255, 255, 255];
  if (/^black$/i.test(v)) return [0, 0, 0];
  return null;
}

const luminance = (c) => {
  const f = (x) => { const u = x / 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};

/** WCAG 2.x contrast ratio, rounded the way the spec's examples are. */
function contrast(a, b) {
  const [L1, L2] = [luminance(a), luminance(b)];
  return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2));
}

const S = tokens(site);
const C = tokens(cert);
const of = (name, vars = S) => {
  const c = rgb(vars[name], vars);
  assert.ok(c, `${name} is not declared, or is not a plain colour`);
  return c;
};

/* ---------------- the maths itself ---------------- */

test('the contrast sum agrees with the values WCAG publishes', () => {
  assert.equal(contrast([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrast([255, 255, 255], [255, 255, 255]), 1);
  assert.equal(contrast([119, 119, 119], [255, 255, 255]), 4.48);   // #777 — the classic near-miss
});

/* ---------------- the public palette ---------------- */

test('the readable saffron is readable, both ways round', () => {
  // It is used as a label on the two page grounds AND as a button fill with
  // white on it. All three have to hold, or one of its jobs is broken.
  const ink = of('--saffron-ink');
  for (const ground of ['--paper', '--paper-2', '--paper-3']) {
    const r = contrast(ink, of(ground));
    assert.ok(r >= 4.5, `--saffron-ink is ${r}:1 on ${ground}`);
  }
  const onFill = contrast([255, 255, 255], ink);
  assert.ok(onFill >= 4.5, `white on --saffron-ink is ${onFill}:1`);

  // And the hover state must not be the one that fails.
  const hover = contrast([255, 255, 255], of('--saffron-ink-2'));
  assert.ok(hover >= 4.5, `white on --saffron-ink-2 is ${hover}:1`);
});

test('the bright saffron is still too light to be text, which is why the other one exists', () => {
  // If this ever passes, the two tokens have collapsed into one and the
  // comment above them has stopped being true.
  const r = contrast(of('--saffron'), of('--paper'));
  assert.ok(r < 4.5, `--saffron is now ${r}:1 — it is meant to be the unreadable fill`);
});

test('nothing paints the unreadable saffron as text', () => {
  // The rule the stylesheet states: the bright one is a fill, a bar, a glow.
  const offenders = [];
  for (const [, sel, body] of code(site).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/(?:^|;)\s*color\s*:\s*var\(--saffron(?:-2)?\)/.test(body)) offenders.push(sel.trim());
  }
  assert.deepEqual(offenders, []);
});

test('the faint ink is faint, not invisible', () => {
  for (const ground of ['--paper', '--paper-2', '--paper-3']) {
    const r = contrast(of('--ink-faint'), of(ground));
    assert.ok(r >= 4.5, `--ink-faint is ${r}:1 on ${ground}`);
  }
});

test('the edge of something you type into can be seen', () => {
  // 1.4.11 wants 3:1 for a control boundary. --hair-2 was 1.46:1 and was
  // doing this job; --control-line exists so it no longer has to.
  const r = contrast(of('--control-line'), of('--paper'));
  assert.ok(r >= 3, `--control-line is ${r}:1 on paper`);
});

test('the focus ring is visible on paper, and something else takes over on the dark panels', () => {
  const ring = code(site).match(/:focus-visible\{outline:\s*3px solid var\((--[\w-]+)\)/);
  assert.ok(ring, 'the focus ring is no longer a 3px outline in a variable');
  const r = contrast(of(ring[1]), of('--paper'));
  assert.ok(r >= 3, `the focus ring is ${r}:1 on paper`);

  // Saffron on navy is under 3:1, so every dark ground must restate it.
  for (const scope of ['band-dark', 'cta-band', 'ftr']) {
    assert.match(code(site), new RegExp(`\\.site \\.${scope} :focus-visible`),
      `.${scope} does not override the focus ring colour`);
  }
});

/* ---------------- the certificate ---------------- */

test('the certificate names its issuer in something you can read', () => {
  const r = contrast(of('--saffron-ink', C), of('--paper', C));
  assert.ok(r >= 4.5, `the certificate's --saffron-ink is ${r}:1 on its paper`);
});

test('the two labels that say how to check a certificate are readable', () => {
  // 6.5pt caps. They were #8a8f9c — 3.24:1 — which on the most public
  // document this app produces is the wrong place to save a shade.
  const labels = [...code(cert).matchAll(/\.sheet [^{}]*\b(?:cid|verify)[^{}]*\bb\{[^}]*color:\s*(#[0-9a-f]{3,6})/gi)]
    .map((m) => m[1]);
  assert.ok(labels.length >= 2, 'could not find the certificate ID / verify labels');
  for (const hex of labels) {
    const r = contrast(rgb(hex, C), of('--paper', C));
    assert.ok(r >= 4.5, `a certificate label is ${hex} — ${r}:1 on the sheet`);
  }
});

/* ---------------- the mark ---------------- */

test('the lockup’s second line is legible on a dark ground', () => {
  // `.wm-by` is a SIBLING of the toned mark, so this only works while the
  // tone class is also on the wrapper — see Wordmark.jsx.
  const brand = sheet('brand.css');
  const dark = code(brand).match(/\.wm-invert \.wm-by\s*\{\s*color:\s*var\(--wm-by-ink,\s*(#[0-9A-Fa-f]{6})\)/);
  assert.ok(dark, '.wm-invert .wm-by no longer names a fallback colour');
  const r = contrast(rgb(dark[1], {}), [3, 26, 67]);   // the site footer's navy
  assert.ok(r >= 4.5, `the inverted by-line is ${r}:1 on the footer`);
});
