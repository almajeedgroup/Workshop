import test from 'node:test';
import assert from 'node:assert/strict';
import {
  profileId, groupPeople, returningPeople, attendanceAcross, findPerson,
  profileFacts, paidAcross, courseCount, RETURNING_AT,
} from '../src/lib/people.js';

const W = (id, title, startDate) => ({ id, title, startDate });
const AI = W('w1', 'Workshop on AI', '2026-09-03');
const ROBO = W('w2', 'Introduction to Robotics', '2026-01-01');
const YP = W('w3', 'Youth Parliament', '2025-06-01');

/* ------------------------------------------------------------------ *
 * Recognising one person
 * ------------------------------------------------------------------ */

test('the same phone across two courses is one person', () => {
  const people = groupPeople([
    { workshop: AI, registrations: [{ id: 'a', name: 'Adifaah Shaikh', whatsapp: '+91 9339214522' }] },
    { workshop: ROBO, registrations: [{ id: 'b', name: 'Adifaah Shaikh', whatsapp: '9339214522' }] },
  ]);
  assert.equal(people.length, 1);
  assert.equal(people[0].courses.length, 2);
});

test('a number written differently each time is still one person', () => {
  const people = groupPeople([
    { workshop: AI, registrations: [{ id: 'a', name: 'X', whatsapp: '09339214522' }] },
    { workshop: ROBO, registrations: [{ id: 'b', name: 'X', whatsapp: '+91 93392 14522' }] },
  ]);
  assert.equal(people.length, 1);
});

test('joining is transitive — phone, then email, then both', () => {
  // Phone on the first, email on the second, both on the third. Matching
  // pairwise in the order they were read would give three people, or two,
  // depending on that order.
  const people = groupPeople([
    { workshop: YP, registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001' }] },
    { workshop: ROBO, registrations: [{ id: 'b', name: 'X', email: 'x@y.com' }] },
    { workshop: AI, registrations: [{ id: 'c', name: 'X', whatsapp: '+91 9000000001', email: 'x@y.com' }] },
  ]);
  assert.equal(people.length, 1);
  assert.equal(people[0].courses.length, 3);
});

test('two people of the same name are NOT merged', () => {
  // There are two Mohammed Khans. A name is not an identity, and merging
  // them puts one student's attendance and certificates on another's profile.
  const people = groupPeople([
    { workshop: AI, registrations: [{ id: 'a', name: 'Mohammed Khan' }] },
    { workshop: ROBO, registrations: [{ id: 'b', name: 'Mohammed Khan' }] },
  ]);
  assert.equal(people.length, 2);
  assert.ok(people.every((p) => p.identified === false));
});

test('name and date of birth together do identify', () => {
  const people = groupPeople([
    { workshop: AI, registrations: [{ id: 'a', name: 'Mohammed Khan', dob: '2004-12-21' }] },
    { workshop: ROBO, registrations: [{ id: 'b', name: 'Mohammed Khan', dob: '2004-12-21' }] },
    { workshop: YP, registrations: [{ id: 'c', name: 'Mohammed Khan', dob: '1999-01-01' }] },
  ]);
  assert.equal(people.length, 2);
  assert.equal(people[0].courses.length, 2);
});

test('somebody registered twice for the SAME course is one person on two rows', () => {
  const people = groupPeople([
    { workshop: AI, registrations: [
      { id: 'a', name: 'X', whatsapp: '+91 9000000001', ticketId: 'A-1' },
      { id: 'b', name: 'X', whatsapp: '+91 9000000001', ticketId: 'A-2' },
    ] },
  ]);
  assert.equal(people.length, 1);
  assert.equal(people[0].courses.length, 2);
  // …and is NOT a returning student: two tickets on one course is a
  // duplicate registration, not a second visit.
  assert.equal(courseCount(people[0]), 1);
  assert.deepEqual(returningPeople(people), []);
});

test('a duplicate registration is not two attendances either', () => {
  const [p] = groupPeople([
    { workshop: AI, registrations: [
      { id: 'a', name: 'X', whatsapp: '+91 9000000001' },
      { id: 'b', name: 'X', whatsapp: '+91 9000000001' },
    ] },
  ]);
  const tally = attendanceAcross(p, { w1: { '2026-09-03': { a: 'present', b: 'present' } } });
  assert.equal(tally.attended, 1, 'one course attended, however many rows they have on it');
  assert.equal(tally.recorded, 1);
  assert.equal(tally.unrecorded, 0);
});

test('a person carries the fullest version of each detail', () => {
  const [p] = groupPeople([
    { workshop: ROBO, registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001' }] },
    { workshop: AI, registrations: [{ id: 'b', name: 'X', whatsapp: '+91 9000000001', email: 'x@y.com', area: 'Marathahalli' }] },
  ]);
  assert.equal(p.email, 'x@y.com');
  assert.equal(p.area, 'Marathahalli');
});

test('courses are newest first', () => {
  const [p] = groupPeople([
    { workshop: YP, registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001' }] },
    { workshop: AI, registrations: [{ id: 'b', name: 'X', whatsapp: '+91 9000000001' }] },
  ]);
  assert.deepEqual(p.courses.map((c) => c.workshop.id), ['w1', 'w3']);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(groupPeople(), []);
  assert.deepEqual(groupPeople([{ workshop: AI, registrations: [] }]), []);
});

/* ------------------------------------------------------------------ *
 * The profile address
 * ------------------------------------------------------------------ */

test('a profile id is stable, and is not the phone number', () => {
  const a = profileId('tel:919339214522');
  assert.equal(a, profileId('tel:919339214522'));
  assert.ok(!a.includes('9339214522'), 'a phone number must not sit in the URL bar');
  assert.match(a, /^[0-9a-f]{16}$/);
});

test('different people get different ids', () => {
  const ids = new Set(['tel:919339214522', 'tel:919339214523', 'mail:a@b.com', 'mail:a@b.co']
    .map(profileId));
  assert.equal(ids.size, 4);
});

test('an empty key has no id', () => {
  assert.equal(profileId(''), '');
  assert.equal(profileId(null), '');
});

test('a person is found again by the id in their address', () => {
  const people = groupPeople([
    { workshop: AI, registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001' }] },
  ]);
  assert.equal(findPerson(people, people[0].id).name, 'X');
  assert.equal(findPerson(people, 'nope'), null);
});

/* ------------------------------------------------------------------ *
 * Registered, versus actually there
 * ------------------------------------------------------------------ */

const TWICE = groupPeople([
  { workshop: { ...AI, feeType: 'Paid', feeAmount: 149 }, registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001', ticketId: 'A-1', paymentStatus: 'Paid', amountPaid: 149 }] },
  { workshop: { ...ROBO, feeType: 'Free' }, registrations: [{ id: 'b', name: 'X', whatsapp: '+91 9000000001', ticketId: 'R-1' }] },
]);

test('registered on two courses makes a returning student', () => {
  assert.equal(returningPeople(TWICE).length, 1);
});

test('one course does not', () => {
  const once = groupPeople([{ workshop: AI, registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001' }] }]);
  assert.deepEqual(returningPeople(once), []);
  assert.equal(RETURNING_AT, 2);
});

test('a course whose register was never taken counts towards neither side', () => {
  // Not zero. Counting an untaken register as absence says a student skipped
  // a course when the truth is that nobody wrote anything down.
  const tally = attendanceAcross(TWICE[0], { w1: { '2026-09-03': { a: 'present' } } });
  assert.equal(tally.recorded, 1);
  assert.equal(tally.attended, 1);
  assert.equal(tally.unrecorded, 1);
});

test('attended counts only courses they were actually marked at', () => {
  const marks = {
    w1: { '2026-09-03': { a: 'present' } },
    w2: { '2026-01-01': { b: 'absent' } },
  };
  assert.deepEqual(returningPeople(TWICE, { basis: 'attended', marksByWorkshop: marks }), []);
  const both = { w1: { '2026-09-03': { a: 'present' } }, w2: { '2026-01-01': { b: 'late' } } };
  assert.equal(returningPeople(TWICE, { basis: 'attended', marksByWorkshop: both }).length, 1);
});

test('late still counts as having been there', () => {
  const tally = attendanceAcross(TWICE[0], { w1: { '2026-09-03': { a: 'late' } } });
  assert.equal(tally.attended, 1);
});

test('with no registers at all, attended finds nobody — and says so rather than lying', () => {
  assert.deepEqual(returningPeople(TWICE, { basis: 'attended', marksByWorkshop: {} }), []);
  assert.equal(returningPeople(TWICE).length, 1, 'registered still finds them');
});

/* ------------------------------------------------------------------ *
 * Reading the profile
 * ------------------------------------------------------------------ */

test('the profile leads with how many courses, then how many were attended', () => {
  const tally = attendanceAcross(TWICE[0], { w1: { '2026-09-03': { a: 'present' } } });
  const facts = profileFacts(TWICE[0], tally);
  assert.deepEqual(facts[0], ['Courses', '2']);
  assert.deepEqual(facts[1], ['Attended', '1 of 1 with a register taken']);
});

test('with no register taken anywhere, the profile says that plainly', () => {
  const facts = Object.fromEntries(profileFacts(TWICE[0], attendanceAcross(TWICE[0], {})));
  assert.equal(facts.Attended, 'no registers taken yet');
});

test('an empty detail is not listed as a blank fact', () => {
  const keys = profileFacts(TWICE[0], null).map(([k]) => k);
  assert.ok(keys.includes('WhatsApp'));
  assert.ok(!keys.includes('Email'));
  assert.ok(!keys.includes('Attended'), 'no tally, no attendance line');
});

test('money is totalled across courses, and unpaid ones counted', () => {
  // AI is paid at 149; ROBO is free, so it is neither paid nor owed.
  assert.deepEqual(paidAcross(TWICE[0]), { total: 149, owing: 0 });
});

test('a free course is never counted as owing', () => {
  // Otherwise somebody on one paid course and two free ones is reported as
  // owing on two of them, and gets chased for money never asked for.
  const [p] = groupPeople([
    { workshop: { ...AI, feeType: 'Paid', feeAmount: 149 },
      registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001', paymentStatus: 'Paid', amountPaid: 149 }] },
    { workshop: { ...ROBO, feeType: 'Free' },
      registrations: [{ id: 'b', name: 'X', whatsapp: '+91 9000000001' }] },
    { workshop: { ...YP, feeType: 'Free' },
      registrations: [{ id: 'c', name: 'X', whatsapp: '+91 9000000001' }] },
  ]);
  assert.deepEqual(paidAcross(p), { total: 149, owing: 0 });
});

test('an unpaid PAID course is still counted', () => {
  const [p] = groupPeople([
    { workshop: { ...AI, feeType: 'Paid', feeAmount: 149 },
      registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001', paymentStatus: 'Pending' }] },
  ]);
  assert.deepEqual(paidAcross(p), { total: 0, owing: 1 });
});

test('a waived course is not counted as owing', () => {
  const [p] = groupPeople([
    { workshop: AI, registrations: [{ id: 'a', name: 'X', whatsapp: '+91 9000000001', paymentStatus: 'Waived' }] },
  ]);
  assert.deepEqual(paidAcross(p), { total: 0, owing: 0 });
});
