import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ID_CARD_THEMES, ID_CARD_CRESTS, cardTheme, cardCrests, cardFace,
  paginateCards, CARDS_PER_SHEET, DEFAULT_ID_CARD_THEME, DEFAULT_CARD_LABEL,
} from '../src/lib/idcards.js';
import {
  ID_CARD_THEME_KEYS, ID_CARD_CREST_KEYS, ID_CARD_THEME_LABELS,
  ID_CARD_CREST_LABELS, isFreeWorkshop, workshopFee, visibleWorkshopFields,
  BLOOD_GROUPS,
} from '../src/lib/schema.js';

/* ---- the two files must agree about what exists ------------------ */

test('schema and idcards list the same themes', () => {
  assert.deepEqual(ID_CARD_THEMES.map((t) => t.key), ID_CARD_THEME_KEYS);
  for (const t of ID_CARD_THEMES) assert.equal(ID_CARD_THEME_LABELS[t.key], t.label);
});

test('schema and idcards list the same crests', () => {
  assert.deepEqual(ID_CARD_CRESTS.map((c) => c.key), ID_CARD_CREST_KEYS);
  for (const c of ID_CARD_CRESTS) assert.equal(ID_CARD_CREST_LABELS[c.key], c.label);
});

test('every theme keeps its band text legible', () => {
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  for (const t of ID_CARD_THEMES) {
    const [a, b] = [lum(t.band), lum(t.onBand)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    assert.ok(ratio >= 4.5, `${t.key}: ${ratio.toFixed(2)}:1 is below 4.5:1`);
  }
});

/* ---- themes ------------------------------------------------------ */

test('theme: an unset or unknown colourway falls back rather than blanking', () => {
  assert.equal(cardTheme({}).key, DEFAULT_ID_CARD_THEME);
  assert.equal(cardTheme({ idCardTheme: 'chartreuse' }).key, DEFAULT_ID_CARD_THEME);
  assert.equal(cardTheme(null).key, DEFAULT_ID_CARD_THEME);
});

test('theme: a chosen colourway is used', () => {
  assert.equal(cardTheme({ idCardTheme: 'maroon' }).key, 'maroon');
});

/* ---- crests ------------------------------------------------------ */

test('crests: a workshop that chose none gets all four', () => {
  assert.equal(cardCrests({}).length, 4);
  assert.equal(cardCrests({ idCardCrests: [] }).length, 4);
});

test('crests: only the chosen ones appear', () => {
  assert.deepEqual(cardCrests({ idCardCrests: ['beyond', 'iic'] }).map((c) => c.key), ['iic', 'beyond']);
});

test('crests: order is the catalogue order, not the order they were ticked', () => {
  const a = cardCrests({ idCardCrests: ['beyond', 'almajeed'] }).map((c) => c.key);
  const b = cardCrests({ idCardCrests: ['almajeed', 'beyond'] }).map((c) => c.key);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ['almajeed', 'beyond']);
});

test('crests: keys that mean nothing do not empty the strip', () => {
  assert.equal(cardCrests({ idCardCrests: ['nonsense'] }).length, 4);
});

/* ---- what a card says -------------------------------------------- */

test('face: the role falls back person, then course, then default', () => {
  const w = { idCardLabel: 'DELEGATE' };
  assert.equal(cardFace(w, { idRole: 'VOLUNTEER' }).label, 'VOLUNTEER');
  assert.equal(cardFace(w, {}).label, 'DELEGATE');
  assert.equal(cardFace({}, {}).label, DEFAULT_CARD_LABEL);
});

test('face: blank rows are dropped, not printed empty', () => {
  const face = cardFace({}, { name: 'Aisha', qualification: 'B.Sc', area: '' });
  assert.deepEqual(face.rows, [['Qualification', 'B.Sc']]);
});

test('face: a free course says Free rather than an amount', () => {
  assert.ok(cardFace({ feeType: 'Free', feeAmount: 149 }, {}).backRows
    .some(([k, v]) => k === 'Fee' && v === 'Free'));
  assert.ok(cardFace({ feeType: 'Paid', feeAmount: 149 }, {}).backRows
    .some(([k, v]) => k === 'Fee' && v === '₹149'));
});

test('face: validity falls back to the end, then the start, of the course', () => {
  const w = { startDate: '2026-09-03', endDate: '2026-09-05' };
  assert.equal(cardFace(w, {}).validUntil, '2026-09-05');
  assert.equal(cardFace({ startDate: '2026-09-03' }, {}).validUntil, '2026-09-03');
  assert.equal(cardFace(w, { idValidUntil: '2026-12-31' }).validUntil, '2026-12-31');
});

test('face: a nameless record still produces a card', () => {
  const face = cardFace(null, null);
  assert.equal(face.name, '—');
  assert.equal(face.title, 'Workshop');
  assert.equal(face.crests.length, 4);
});

test('face: the blood group offered is the schema list', () => {
  const face = cardFace({}, { bloodGroup: BLOOD_GROUPS[0] });
  assert.ok(face.rows.some(([k, v]) => k === 'Blood Group' && v === 'A+'));
});

/* ---- sheets ------------------------------------------------------ */

test('sheets: a full page and a remainder', () => {
  const people = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(paginateCards(people).map((p) => p.length), [9, 9, 2]);
});

test('sheets: an exact multiple leaves no empty page', () => {
  const people = Array.from({ length: CARDS_PER_SHEET * 2 }, (_, i) => i);
  assert.equal(paginateCards(people).length, 2);
});

test('sheets: nobody registered gives no pages at all', () => {
  assert.deepEqual(paginateCards([]), []);
});

test('sheets: a nonsense page size falls back to a full sheet', () => {
  for (const bad of [0, -5, NaN, undefined, null, 'nine', Infinity]) {
    assert.deepEqual(paginateCards([1, 2, 3], bad), [[1, 2, 3]], String(bad));
  }
  assert.equal(paginateCards(Array.from({ length: 10 }), 0).length, 2);
});

/* ---- free vs paid ------------------------------------------------ */

test('free: an explicit choice wins over the amount', () => {
  assert.equal(isFreeWorkshop({ feeType: 'Free', feeAmount: 500 }), true);
  assert.equal(isFreeWorkshop({ feeType: 'Paid', feeAmount: 0 }), false);
});

test('free: a workshop saved before the field existed keeps behaving as it did', () => {
  assert.equal(isFreeWorkshop({ feeAmount: 149 }), false);
  assert.equal(isFreeWorkshop({ feeAmount: 0 }), true);
  assert.equal(isFreeWorkshop({}), true);
  assert.equal(isFreeWorkshop(null), false);
});

test('free: the fee is zero however the amount was left behind', () => {
  assert.equal(workshopFee({ feeType: 'Free', feeAmount: 500 }), 0);
  assert.equal(workshopFee({ feeType: 'Paid', feeAmount: '149' }), 149);
  assert.equal(workshopFee({}), 0);
});

test('free: the fee and payment boxes are hidden on a free course', () => {
  const keys = (w) => visibleWorkshopFields(w).map((f) => f.key);
  const free = keys({ feeType: 'Free' });
  for (const k of ['feeAmount', 'paymentUpi', 'paymentQrUrl']) {
    assert.ok(!free.includes(k), `${k} should be hidden on a free course`);
  }
  const paid = keys({ feeType: 'Paid' });
  for (const k of ['feeAmount', 'paymentUpi', 'paymentQrUrl']) {
    assert.ok(paid.includes(k), `${k} should be shown on a paid course`);
  }
  assert.ok(free.includes('feeType') && free.includes('title'));
});
