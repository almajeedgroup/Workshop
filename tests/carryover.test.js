import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARRIED_FIELDS, carriedRegistration, carryPlan, carryRows, describePlan, carrySources,
  pickAll, togglePick, chosenFrom, filterBring,
} from '../src/lib/carryover.js';

const OLD = { id: 'w0', title: 'Youth Parliament', startDate: '2025-06-01' };

const FULL = {
  id: 'r1', name: 'Adifaah Shaikh', dob: '2004-12-21', qualification: 'Graduation',
  courseName: 'BBA in Aviation', whatsapp: '+91 9339214522', email: 'a@example.com',
  area: 'Marathahalli', bloodGroup: 'O+', emergencyContact: '+91 6364630740',
  // …and everything that belongs to the OLD course:
  ticketId: 'YP25-001', paymentStatus: 'Paid', amountPaid: 149, paymentMode: 'UPI',
  paymentRef: 'UTR123', notes: 'Sat at the front', idValidUntil: '2025-06-30',
};

/* ---------------- what comes across ---------------- */

test('the person comes across', () => {
  const out = carriedRegistration(FULL, OLD);
  for (const key of ['name', 'dob', 'qualification', 'courseName', 'whatsapp', 'email', 'area']) {
    assert.equal(out[key], FULL[key], key);
  }
});

test('the old enrolment does NOT', () => {
  const out = carriedRegistration(FULL, OLD);
  // Carrying these forward opens a new course with people already marked
  // Paid for a fee nobody has collected, holding tickets from another course.
  for (const key of ['ticketId', 'amountPaid', 'paymentMode', 'paymentRef', 'idValidUntil']) {
    assert.ok(!(key in out), `${key} must not come across`);
  }
});

test('everybody arrives unpaid', () => {
  assert.equal(carriedRegistration(FULL, OLD).paymentStatus, 'Pending');
});

test('the note says where they came from, replacing the old one', () => {
  const out = carriedRegistration(FULL, OLD);
  assert.equal(out.notes, 'Brought forward from Youth Parliament');
  assert.ok(!out.notes.includes('Sat at the front'));
});

test('a course with no title leaves no note rather than a broken one', () => {
  assert.ok(!('notes' in carriedRegistration(FULL, { id: 'x' })));
  assert.ok(!('notes' in carriedRegistration(FULL, OLD, { note: false })));
});

test('empty fields are left out, not carried as blanks', () => {
  const out = carriedRegistration({ name: 'X', area: '', email: null }, OLD);
  assert.equal(out.name, 'X');
  assert.ok(!('area' in out));
  assert.ok(!('email' in out));
});

test('the carried list is an allow-list, so a new field is not carried by accident', () => {
  const out = carriedRegistration({ ...FULL, somethingAddedLater: 'nope' }, OLD);
  assert.ok(!('somethingAddedLater' in out));
  assert.ok(CARRIED_FIELDS.includes('name') && !CARRIED_FIELDS.includes('ticketId'));
});

/* ---------------- who comes across ---------------- */

const SRC = [
  { id: 's1', name: 'Adifaah Shaikh', whatsapp: '+91 9339214522' },
  { id: 's2', name: 'Sabnam Khatun', email: 'sab@example.com' },
  { id: 's3', name: 'Mohammed Khan', dob: '1999-01-01' },
];

test('everybody comes when the new course is empty', () => {
  const plan = carryPlan(SRC, []);
  assert.equal(plan.bring.length, 3);
  assert.deepEqual(plan.already, []);
});

test('somebody already registered here is skipped, not given a second ticket', () => {
  const plan = carryPlan(SRC, [{ id: 't1', name: 'Adifaah S', whatsapp: '9339214522' }]);
  assert.deepEqual(plan.bring.map((r) => r.id), ['s2', 's3']);
  assert.deepEqual(plan.already.map((r) => r.id), ['s1']);
});

test('matching is by phone, email or name with date of birth — the usual identity', () => {
  assert.equal(carryPlan(SRC, [{ email: 'sab@example.com' }]).bring.length, 2);
  assert.equal(carryPlan(SRC, [{ name: 'Mohammed Khan', dob: '1999-01-01' }]).bring.length, 2);
  // A name alone is not an identity, so this Mohammed Khan is a different one.
  assert.equal(carryPlan(SRC, [{ name: 'Mohammed Khan' }]).bring.length, 3);
});

test('somebody listed twice on the old course arrives once', () => {
  const plan = carryPlan([...SRC, { id: 's4', name: 'Adifaah again', whatsapp: '+91 9339214522' }], []);
  assert.equal(plan.bring.length, 3);
  assert.deepEqual(plan.already.map((r) => r.id), ['s4']);
});

test('somebody with nothing to match on is brought, not silently dropped', () => {
  // The office can delete a duplicate. It cannot add somebody it was never
  // told about.
  const plan = carryPlan([{ id: 'x', name: 'No Contact' }], [{ id: 'y', name: 'No Contact' }]);
  assert.equal(plan.bring.length, 1);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(carryPlan([], []), { bring: [], already: [] });
  assert.deepEqual(carryPlan(), { bring: [], already: [] });
  assert.deepEqual(carryRows([], OLD), []);
  assert.deepEqual(carryRows(undefined, OLD), []);
});

/* ---------------- choosing which of them come ---------------- */

test('everybody starts ticked — unticking two beats ticking eighteen', () => {
  const plan = carryPlan(SRC, []);
  assert.deepEqual([...pickAll(plan)], ['s1', 's2', 's3']);
});

test('one student can be brought on their own', () => {
  const plan = carryPlan(SRC, []);
  const chosen = chosenFrom(plan, new Set(['s2']));
  assert.deepEqual(chosen.map((r) => r.name), ['Sabnam Khatun']);
  assert.equal(carryRows(chosen, OLD).length, 1);
});

test('several can be brought without bringing the rest', () => {
  const plan = carryPlan(SRC, []);
  const chosen = chosenFrom(plan, new Set(['s1', 's3']));
  assert.deepEqual(chosen.map((r) => r.id), ['s1', 's3']);
});

test('ticking is a new set, never a mutation of the old one', () => {
  const before = new Set(['s1']);
  const after = togglePick(before, 's2');
  assert.deepEqual([...before], ['s1'], 'the old set is untouched');
  assert.deepEqual([...after], ['s1', 's2']);
  assert.deepEqual([...togglePick(after, 's1')], ['s2']);
});

test('the chosen keep the order they are shown in', () => {
  const plan = carryPlan(SRC, []);
  assert.deepEqual(chosenFrom(plan, new Set(['s3', 's1'])).map((r) => r.id), ['s1', 's3']);
});

test('a tick left over from another course cannot conjure a student', () => {
  // The set is filtered against the list, not read out of, so switching
  // course and back cannot bring somebody who is not on it.
  const plan = carryPlan(SRC, []);
  assert.deepEqual(chosenFrom(plan, new Set(['somebody-else'])), []);
  assert.deepEqual(chosenFrom(plan, null), []);
});

test('an array of ids works as well as a set', () => {
  assert.equal(chosenFrom(carryPlan(SRC, []), ['s1']).length, 1);
});

test('a long list can be narrowed to find one person', () => {
  const plan = carryPlan(SRC, []);
  assert.deepEqual(filterBring(plan, 'khatun').map((r) => r.id), ['s2']);
  assert.deepEqual(filterBring(plan, 'sab@example.com').map((r) => r.id), ['s2']);
  assert.equal(filterBring(plan, '').length, 3, 'an empty filter hides nobody');
  assert.equal(filterBring(plan, 'zzz').length, 0);
});

test('filtering never changes who is ticked', () => {
  // Narrowing the list is a way of finding somebody, not a way of choosing
  // them — a filter that silently unticked the hidden ones would lose work.
  const plan = carryPlan(SRC, []);
  const marks = pickAll(plan);
  filterBring(plan, 'khatun');
  assert.equal(chosenFrom(plan, marks).length, 3);
});

/* ---------------- what the button says ---------------- */

test('the button carries the count, so pressing it is a decision', () => {
  assert.match(describePlan(carryPlan(SRC, [])), /^3 students would be added\.$/);
  assert.match(describePlan(carryPlan([SRC[0]], [])), /^1 student would be added\.$/);
});

test('once some are unticked it says how many of how many', () => {
  // Otherwise the button's number and the list on screen disagree with no
  // explanation for the difference.
  const plan = carryPlan(SRC, []);
  assert.match(describePlan(plan, null, new Set(['s1'])), /^1 of 3 chosen\.$/);
  assert.match(describePlan(plan, null, new Set()), /^Nobody chosen yet\.$/);
  assert.match(describePlan(plan, null, pickAll(plan)), /^3 students would be added\.$/);
});

test('the seat warning follows the selection, not the whole course', () => {
  const plan = carryPlan(SRC, []);
  assert.ok(describePlan(plan, 1, pickAll(plan)).includes('only 1 seat left'));
  assert.ok(!describePlan(plan, 1, new Set(['s1'])).includes('seat'),
    'bringing one into one free seat is not a warning');
});

test('it says how many are already here', () => {
  const plan = carryPlan(SRC, [{ whatsapp: '+91 9339214522' }]);
  assert.match(describePlan(plan), /2 students would be added · 1 already here\./);
});

test('when everybody is already here it says so, and saves the press', () => {
  const plan = carryPlan(SRC, SRC);
  assert.equal(plan.bring.length, 0);
  assert.match(describePlan(plan), /all 3 — is already registered here/);
});

test('an empty course says that, rather than nothing', () => {
  assert.match(describePlan(carryPlan([], [])), /no registrations to bring/);
});

test('it warns before overfilling the course', () => {
  assert.match(describePlan(carryPlan(SRC, []), 1), /only 1 seat left/);
  assert.match(describePlan(carryPlan(SRC, []), 0), /already full/);
  assert.ok(!describePlan(carryPlan(SRC, []), 10).includes('seat'));
  assert.ok(!describePlan(carryPlan(SRC, []), null).includes('seat'));
});

/* ---------------- which courses are offered ---------------- */

const BUNDLES = [
  { workshop: { id: 'a', title: 'Older', startDate: '2025-01-01' }, registrations: [{ id: '1' }] },
  { workshop: { id: 'b', title: 'Newer', startDate: '2026-01-01' }, registrations: [{ id: '2' }] },
  { workshop: { id: 'c', title: 'Empty', startDate: '2026-05-01' }, registrations: [] },
  { workshop: { id: 'me', title: 'This one', startDate: '2026-09-01' }, registrations: [{ id: '3' }] },
];

test('this course is never offered as its own source', () => {
  // It would duplicate every registration on it.
  const ids = carrySources(BUNDLES, 'me').map((b) => b.workshop.id);
  assert.ok(!ids.includes('me'));
});

test('a course with nobody on it is not offered', () => {
  assert.ok(!carrySources(BUNDLES, 'me').map((b) => b.workshop.id).includes('c'));
});

test('the newest comes first, because that is nearly always the one meant', () => {
  assert.deepEqual(carrySources(BUNDLES, 'me').map((b) => b.workshop.id), ['b', 'a']);
});

test('no other courses is an empty list, not a crash', () => {
  assert.deepEqual(carrySources([], 'me'), []);
  assert.deepEqual(carrySources(), []);
});
