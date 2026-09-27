import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The scales, and the rule that keeps them worth having.
 *
 * A token layer only helps while the pages actually use it. The moment a
 * page inlines `fontSize: 14.5` again, "change the app's type" goes back to
 * being 80 edits, and the next theme change leaves something behind — which
 * is not hypothetical here: it has already happened twice, with the dark
 * band's greys and a ghost button's white, both inlined across five page
 * components each and both silently surviving a palette change.
 */

const SRC = new URL('../src/', import.meta.url).pathname;
const tokens = readFileSync(join(SRC, 'tokens.css'), 'utf8');

function jsxFiles(dir = SRC, out = []) {
  for (const name of readdirSync(dir)) {
    const at = join(dir, name);
    if (statSync(at).isDirectory()) jsxFiles(at, out);
    else if (name.endsWith('.jsx')) out.push(at);
  }
  return out;
}
const files = jsxFiles();
const read = (f) => readFileSync(f, 'utf8');

/* ---------------- the scales exist and are ordered ---------------- */

test('the spacing scale is nine ascending steps', () => {
  const steps = [...tokens.matchAll(/--sp-(\d):\s*(\d+)px/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.equal(steps.length, 9);
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i][1] > steps[i - 1][1],
      `--sp-${steps[i][0]} (${steps[i][1]}px) is not larger than --sp-${steps[i - 1][0]}`);
  }
  // Everything above the hairline nudge is a multiple of four, or it is not
  // a scale — it is the same pile of numbers with new names.
  for (const [n, px] of steps.slice(1)) assert.equal(px % 4, 0, `--sp-${n} is ${px}px`);
});

test('the type scale ascends too', () => {
  const order = ['3xs', '2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'];
  const size = (n) => Number(new RegExp(`--tx-${n.replace(/(\d)/, '$1')}:\\s*([\\d.]+)px`)
    .exec(tokens)?.[1]);
  let last = 0;
  for (const n of order) {
    const v = size(n);
    assert.ok(Number.isFinite(v), `--tx-${n} is missing`);
    assert.ok(v > last, `--tx-${n} (${v}px) does not follow ${last}px`);
    last = v;
  }
});

/* ---------------- the utilities have to win ---------------- */

test('a spacing or type utility beats the component rule it replaced', () => {
  // These stand in for inline styles, and an inline style beats every
  // selector there is. Measured across nine pages, plain classes lost 37 of
  // 61 times — `.site .ticks` sets its own margin and `.site p` zeroes it.
  // A drop-in replacement that quietly renders differently is worse than
  // no replacement.
  const utils = [...tokens.matchAll(/\.(mt|mb|t)-[\w-]+\s*\{([^}]*)\}/g)];
  assert.ok(utils.length >= 25, `only ${utils.length} utilities found`);
  for (const [, name, body] of utils) {
    assert.match(body, /!important/, `.${name}-… does not assert itself`);
  }
});

test('the scales are loaded before anything that uses them', () => {
  const main = readFileSync(join(SRC, 'main.jsx'), 'utf8');
  const order = [...main.matchAll(/import '\.\/([\w-]+\.css)'/g)].map((m) => m[1]);
  assert.equal(order[0], 'tokens.css', `stylesheet order is ${order.join(' → ')}`);
});

/* ---------------- theme values stay out of the pages ---------------- */

/** The four inline sizes that are not theme, and why each is allowed. */
const FONT_SIZE_EXEMPT = {
  'FittedName.jsx': 'a computed pt size — the certificate name shrinks to fit its box',
  'AttendanceSheet.jsx': 'a print size in points, which the screen scale does not describe',
};

test('font size is not inlined, except where it is not a theme value', () => {
  const offenders = [];
  for (const f of files) {
    const name = f.split('/').pop();
    if (name in FONT_SIZE_EXEMPT) continue;
    for (const line of read(f).split('\n')) {
      if (/fontSize:/.test(line)) offenders.push(`${name}: ${line.trim().slice(0, 70)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('no page paints a raw hex colour', () => {
  // Colour inlined as a hex is the exact shape of the bug that survived two
  // theme changes. Inline `var(--token)` is fine — it moves when the theme
  // moves; a hex does not.
  const offenders = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/(?:color|background|borderColor|fill|stroke)\s*:\s*'(#[0-9A-Fa-f]{3,8})'/g)) {
      offenders.push(`${f.split('/').pop()}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the public forms share their styling rather than each inlining it', () => {
  // They are the only two places a student types into this site and they
  // have to match. Each inlining the same eight declarations is how one kept
  // an invisible 1.46:1 field border after the other was fixed.
  const site = readFileSync(join(SRC, 'site.css'), 'utf8');
  assert.match(site, /\.site \.f-input\{/);
  assert.match(site, /\.site \.f-label\{/);
  assert.match(site, /\.site \.f-input\{[^}]*var\(--control-line\)/,
    'the shared field border must be the one that can be seen');
  for (const page of ['pages/site/RegisterPage.jsx', 'pages/site/JoinClassPage.jsx']) {
    const t = readFileSync(join(SRC, page), 'utf8');
    assert.match(t, /className="f-input"/, `${page} does not use the shared field`);
    assert.ok(!t.includes('--hair-2'), `${page} still draws a field edge with a decorative hairline`);
  }
});

/* ---------------- and it does not creep back ---------------- */

test('inline style objects stay under the line they were brought down to', () => {
  // 359 before this pass. The remainder is one-off geometry — a maxWidth on
  // one hero, a flex spacer, an aspect ratio — which is layout for a single
  // element and not something a restyle moves. The ceiling is here so the
  // number is a decision rather than a drift.
  const count = files.reduce((n, f) => n + (read(f).match(/style=\{\{/g) || []).length, 0);
  assert.ok(count <= 245, `inline style objects have grown back to ${count}`);
});
