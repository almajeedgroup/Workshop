/**
 * The console's arithmetic.
 *
 * These numbers are what somebody trusts instead of opening every workshop,
 * so a wrong one is worse than no console at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { headlineFigures, needsAttention, unpaidCount, upcoming } from '../src/lib/overview.js';
import { seatPressure } from '../src/lib/stats.js';

const paid = (over = {}) => ({
  id: 'a', title: 'AI Workshop', feeType: 'Paid', feeAmount: 149,
  startDate: '2026-09-03', endDate: '2026-09-05', ...over,
});
const free = (over = {}) => ({
  id: 'b', title: 'Youth Parliament', feeType: 'Free',
  startDate: '2026-09-07', endDate: '2026-09-12', ...over,
});
const regs = (...statuses) => statuses.map((paymentStatus) => ({ paymentStatus }));

/* ---- who still owes ---------------------------------------------- */

test('unpaid: Pending and Refunded owe; Paid and Waived do not', () => {
  assert.equal(unpaidCount(paid(), regs('Paid', 'Pending', 'Waived', 'Refunded')), 2);
});

test('unpaid: a missing status counts as Pending', () => {
  assert.equal(unpaidCount(paid(), [{}, {}]), 2);
});

test('unpaid: a free course has nothing to owe, whatever the statuses say', () => {
  assert.equal(unpaidCount(free(), regs('Pending', 'Pending', 'Pending')), 0);
});

/* ---- the headline figures ----------------------------------------- */

test('figures: totals run across every workshop', () => {
  const bundles = [
    { workshop: paid(), registrations: regs('Paid', 'Pending') },
    { workshop: free(), registrations: regs('Pending', 'Pending', 'Pending') },
  ];
  const by = Object.fromEntries(headlineFigures(bundles, [{}, {}]).map((f) => [f.key, f.value]));
  assert.equal(by.workshops, 2);
  assert.equal(by.registered, 5);
  assert.equal(by.collected, 149, 'only the paid course collected anything');
  assert.equal(by.waiting, 2);
  assert.equal(by.owing, 1, 'the free course owes nothing');
});

test('figures: an empty database gives zeroes, not an error', () => {
  for (const f of headlineFigures([], [])) assert.equal(f.value, 0);
});

/* ---- what needs doing --------------------------------------------- */

test('attention: a settled workshop is not listed at all', () => {
  const bundles = [{ workshop: free({ seatLimit: 40 }), registrations: regs('Waived') }];
  assert.deepEqual(needsAttention(bundles, []), []);
});

test('attention: waiting requests outrank unpaid fees', () => {
  const bundles = [
    { workshop: paid({ id: 'a' }), registrations: regs('Pending', 'Pending', 'Pending') },
    { workshop: paid({ id: 'c', title: 'Other' }), registrations: regs('Paid') },
  ];
  const rows = needsAttention(bundles, [{ workshopId: 'c' }]);
  assert.equal(rows[0].workshop.id, 'c', 'a request nobody has looked at comes first');
  assert.equal(rows[0].reasons[0].kind, 'requests');
  assert.equal(rows[1].reasons[0].kind, 'unpaid');
});

test('attention: being over the limit outranks unpaid fees', () => {
  const bundles = [{
    workshop: paid({ seatLimit: 2 }),
    registrations: regs('Pending', 'Pending', 'Pending'),
  }];
  const [row] = needsAttention(bundles, []);
  assert.equal(row.reasons[0].kind, 'over');
  assert.match(row.reasons[0].text, /1 over the seat limit of 2/);
});

test('attention: a course filling up is reported before it is too late', () => {
  const bundles = [{ workshop: free({ seatLimit: 4 }), registrations: regs('', '', '') }];
  const [row] = needsAttention(bundles, []);
  assert.equal(row.reasons[0].kind, 'seats');
  assert.match(row.reasons[0].text, /Nearly full — 1 seat left/);
});

test('attention: one seat left and one person unpaid both show', () => {
  const bundles = [{
    workshop: paid({ seatLimit: 4 }),
    registrations: regs('Paid', 'Paid', 'Pending'),
  }];
  const [row] = needsAttention(bundles, []);
  assert.deepEqual(row.reasons.map((r) => r.kind), ['unpaid', 'seats']);
});

test('attention: counts are pluralised', () => {
  const one = needsAttention([{ workshop: paid(), registrations: regs('Pending') }], []);
  assert.match(one[0].reasons[0].text, /1 person has not paid/);
  const two = needsAttention([{ workshop: paid(), registrations: regs('Pending', 'Pending') }], []);
  assert.match(two[0].reasons[0].text, /2 people have not paid/);
});

test('attention: requests are attributed to their own workshop', () => {
  const bundles = [
    { workshop: paid({ id: 'a' }), registrations: [] },
    { workshop: free({ id: 'b' }), registrations: [] },
  ];
  const rows = needsAttention(bundles, [{ workshopId: 'b' }, { workshopId: 'b' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].workshop.id, 'b');
  assert.match(rows[0].reasons[0].text, /2 registration requests waiting/);
});

/* ---- what is coming up -------------------------------------------- */

test('upcoming: a finished course is left out', () => {
  const bundles = [
    { workshop: paid({ id: 'old', startDate: '2026-01-01', endDate: '2026-01-02' }), registrations: [] },
    { workshop: paid({ id: 'new' }), registrations: [] },
  ];
  assert.deepEqual(upcoming(bundles, '2026-09-01').map((u) => u.workshop.id), ['new']);
});

test('upcoming: a course running today still counts', () => {
  const bundles = [{ workshop: paid({ startDate: '2026-09-03', endDate: '2026-09-05' }), registrations: [] }];
  assert.equal(upcoming(bundles, '2026-09-04').length, 1);
});

test('upcoming: soonest first, and capped', () => {
  const bundles = ['2026-12-01', '2026-09-10', '2026-10-05'].map((d, i) => ({
    workshop: paid({ id: `w${i}`, startDate: d, endDate: d }), registrations: [],
  }));
  assert.deepEqual(
    upcoming(bundles, '2026-09-01').map((u) => u.workshop.startDate),
    ['2026-09-10', '2026-10-05', '2026-12-01'],
  );
  assert.equal(upcoming(bundles, '2026-09-01', 2).length, 2);
});

test('upcoming: a course with no dates is not guessed at', () => {
  assert.deepEqual(upcoming([{ workshop: paid({ startDate: '', endDate: '' }), registrations: [] }], '2026-09-01'), []);
});

/* ---- the bar ------------------------------------------------------- */

test('seats: the levels turn where they should', () => {
  assert.equal(seatPressure({ seatLimit: 40 }, 10).level, 'open');
  assert.equal(seatPressure({ seatLimit: 40 }, 29).level, 'open');
  assert.equal(seatPressure({ seatLimit: 40 }, 30).level, 'nearly');
  assert.equal(seatPressure({ seatLimit: 40 }, 40).level, 'full');
  assert.equal(seatPressure({ seatLimit: 40 }, 41).level, 'over');
});

test('seats: no limit means no bar', () => {
  assert.equal(seatPressure({}, 10), null);
  assert.equal(seatPressure({ seatLimit: 0 }, 10), null);
  assert.equal(seatPressure(null, 10), null);
});

test('seats: the bar never draws past its own track', () => {
  assert.equal(seatPressure({ seatLimit: 10 }, 40).filled, 1);
  assert.equal(seatPressure({ seatLimit: 10 }, 40).left, -30, 'the label still says how far over');
});

test('seats: nonsense counts do not produce a negative bar', () => {
  assert.equal(seatPressure({ seatLimit: 10 }, -5).filled, 0);
  assert.equal(seatPressure({ seatLimit: 10 }, undefined).taken, 0);
});

/* ---- colour is a second answer, so it must not contradict the first ---- */

test('tone: a seat warning takes the colour of the bar beside it', () => {
  const nearly = needsAttention([{ workshop: free({ seatLimit: 4 }), registrations: regs('', '', '') }], []);
  assert.equal(nearly[0].reasons[0].tone, 'tangerine', 'nearly full is amber, like its bar');

  const full = needsAttention([{ workshop: free({ seatLimit: 3 }), registrations: regs('', '', '') }], []);
  assert.equal(full[0].reasons[0].tone, 'blue', 'full is blue, like its bar');

  assert.equal(seatPressure({ seatLimit: 4 }, 3).level, 'nearly');
  assert.equal(seatPressure({ seatLimit: 3 }, 3).level, 'full');
});

test('tone: every reason carries one, and only from the palette', () => {
  const bundles = [{
    workshop: paid({ id: 'a', seatLimit: 3 }),
    registrations: regs('Pending', 'Pending', 'Pending'),
  }];
  const [row] = needsAttention(bundles, [{ workshopId: 'a' }]);
  assert.ok(row.reasons.length >= 2);
  for (const r of row.reasons) {
    assert.ok(['jade', 'tangerine', 'red', 'blue'].includes(r.tone), `${r.kind} has tone ${r.tone}`);
  }
});
