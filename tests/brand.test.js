import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WORDMARK, BRAND_NAME, BRAND_SPOKEN, BRAND_LIME, BRAND_INK,
  brandLockup, brandBy, brandTitle,
  DOT_DIAMETER_EM, CAP_CENTRE_EM, DOT_RISE_EM, WORDMARK_TONES, wordmarkTone,
} from '../src/lib/brand.js';
import { ISSUER } from '../src/lib/schema.js';

const css = readFileSync(new URL('../src/brand.css', import.meta.url), 'utf8');

/* ---------------- the word ---------------- */

test('the pieces still spell the name', () => {
  // The mark is drawn in three parts. Assembled by hand in five places it
  // would end up spelled four ways; this is the only thing that knows how
  // they go together, so this is where it is checked.
  assert.equal(`${WORDMARK.head}${WORDMARK.tail[0]}${WORDMARK.dot}${WORDMARK.tail[1]}`, 'WORKSHOP');
  assert.equal(BRAND_NAME, 'WORKSHOP');
});

test('the dot stands in for an O, not for a letter that is missing', () => {
  assert.equal(WORDMARK.dot, 'O');
  assert.equal(`${WORDMARK.tail[0]}${WORDMARK.dot}${WORDMARK.tail[1]}`, 'SHOP');
});

test('it is read out as a word, not as an abbreviation', () => {
  assert.equal(BRAND_SPOKEN, 'Workshop');
});

test('the drawn mark and the written name are the same word', () => {
  // brand.js draws WORKSH•P; schema.js carries the plain word for a ticket
  // pasted into WhatsApp and a heading in a spreadsheet, which cannot draw
  // anything. Two spellings of one brand is the thing to catch here.
  assert.equal(ISSUER.name, BRAND_NAME);
});

/* ---------------- the lockup ---------------- */

test('the lockup takes the school name from the one canonical place', () => {
  // ISSUER.operator exists precisely to stop the school being written three
  // different ways. The brand must not become the fourth.
  assert.equal(brandLockup(), `WORKSHOP by ${ISSUER.operator}`);
  assert.ok(brandLockup().includes('and Innovation'));
  assert.equal(brandBy(), `by ${ISSUER.operator}`);
});

test('a different operator flows through rather than being hard-coded', () => {
  assert.equal(brandLockup('Another School'), 'WORKSHOP by Another School');
});

/* ---------------- the browser tab ---------------- */

test('the page comes first in a title, the brand second', () => {
  // Nine tabs all beginning WORKSHOP tell you nothing; somebody with nine
  // open is looking for "Attendance".
  assert.equal(brandTitle('Attendance'), 'Attendance · WORKSHOP');
  assert.equal(brandTitle(), 'WORKSHOP');
  assert.equal(brandTitle('  '), 'WORKSHOP');
});

/* ---------------- the dot ---------------- */

test('the rise is derived from the measured centre, not typed in twice', () => {
  assert.equal(DOT_RISE_EM, +(CAP_CENTRE_EM - DOT_DIAMETER_EM / 2).toFixed(3));
});

test('the measured figure is the one Anton actually has', () => {
  // Measured in Chromium against a rendered capital O: its centre sits
  // 0.422em above the baseline. The first guess was 0.352, which put the dot
  // four and a half pixels low at 64px.
  assert.equal(CAP_CENTRE_EM, 0.422);
  assert.equal(DOT_RISE_EM, 0.272);
});

test('the stylesheet and the constant have not drifted apart', () => {
  // The number lives in two places because CSS cannot import a module. This
  // is what stops one being corrected and the other left behind.
  const m = css.match(/--wm-dot-rise,\s*([\d.]+)em/);
  assert.ok(m, 'brand.css must carry a default rise');
  assert.equal(parseFloat(m[1]), DOT_RISE_EM);

  const d = css.match(/\.wm-dot\s*\{[^}]*width:\s*([\d.]+)em/);
  assert.ok(d, 'brand.css must size the dot');
  assert.equal(parseFloat(d[1]), DOT_DIAMETER_EM);
});

test('the dot is smaller than the letter it replaces', () => {
  // Anton's O measures 0.501em wide. A dot as wide would be a filled O.
  assert.ok(DOT_DIAMETER_EM < 0.5);
});

/* ---------------- colour ---------------- */

test('the lime is the one that was chosen', () => {
  assert.equal(BRAND_LIME, '#32CD32');
  assert.equal(BRAND_INK, '#0A0A0A');
});

test('the lime is a wordmark colour, and the figures say why', () => {
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
  const onWhite = 1.05 / (lum(BRAND_LIME) + 0.05);
  const withBlack = (lum(BRAND_LIME) + 0.05) / 0.05;

  // Below the 4.5 floor on white, so it is never body text — a logotype is
  // exempt from that floor, which is why the mark may use it.
  assert.ok(onWhite < 4.5, `lime on white is ${onWhite.toFixed(2)}:1`);
  // Comfortably above it as a fill with black on top, if it is ever reused.
  assert.ok(withBlack > 4.5, `black on lime is ${withBlack.toFixed(2)}:1`);
});

test('the lime is not smuggled into the admin palette', () => {
  // That palette's jade already means "the action that moves work forward".
  // A second green beside it blunts the one meaning it has.
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.ok(!styles.includes(BRAND_LIME), 'lime belongs to the brand, not the interface');
  assert.ok(!styles.includes('--lime'));
});

/* ---------------- tones ---------------- */

test('only the three tones exist, and anything else falls back', () => {
  assert.deepEqual(WORDMARK_TONES, ['brand', 'mono', 'invert']);
  for (const t of WORDMARK_TONES) assert.equal(wordmarkTone(t), t);
  for (const junk of ['lime', '', null, undefined, 'BRAND']) {
    assert.equal(wordmarkTone(junk), 'brand', String(junk));
  }
});

test('every tone is actually styled', () => {
  for (const tone of WORDMARK_TONES) {
    if (tone === 'brand') continue;      // the default needs no override
    assert.match(css, new RegExp(`\\.wm-${tone}\\b`), `brand.css has no rules for ${tone}`);
  }
});

test('the second line lightens on a dark ground without the caller knowing', () => {
  assert.match(css, /\.wm-invert \.wm-by\s*\{/);
});

test('the mark prints in colour', () => {
  // A masthead that comes out of the printer as WORK followed by nothing is
  // not the mark.
  assert.match(css, /print-color-adjust:\s*exact/);
});

test('the second line has a floor, so it never sets at four pixels', () => {
  assert.match(css, /font-size:\s*max\(\s*[\d.]+px/);
});
