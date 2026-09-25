import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinedRegistrationIds, withSelfJoins, attendanceSummary } from '../src/lib/attendance.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* A register of three, two of whom have tickets. */
const ROWS = [
  { id: 'r1', name: 'Aisha', ticketId: 'AIHOW26-014' },
  { id: 'r2', name: 'Bilal', ticketId: 'AIHOW26-015' },
  { id: 'r3', name: 'Chandni' },
];

/* ---- matching a sign-in back to a person ------------------------- */

test('a sign-in is matched to the person holding that ticket', () => {
  const got = joinedRegistrationIds({ 'AIHOW26-014': 1 }, ROWS);
  assert.deepEqual([...got], ['r1']);
});

test('the match ignores case, spaces and punctuation', () => {
  // The number is typed off a printed ticket by somebody on a phone. If a
  // lower-case letter or a stray space loses them their attendance, the
  // feature has made the office MORE work, not less.
  for (const typed of ['aihow26-014', 'AIHOW26 014', 'AIHOW26014', ' aihow26_014 ']) {
    assert.deepEqual([...joinedRegistrationIds({ [typed]: 1 }, ROWS)], ['r1'], typed);
  }
});

test('a sign-in against no ticket on the register matches nobody, quietly', () => {
  // A typo must not throw and must not mark the wrong person.
  assert.deepEqual([...joinedRegistrationIds({ 'AIHOW26-999': 1 }, ROWS)], []);
});

test('somebody with no ticket number is never matched by an empty one', () => {
  assert.deepEqual([...joinedRegistrationIds({ '': 1, '   ': 1 }, ROWS)], []);
});

/* ---- folding sign-ins into the day ------------------------------- */

test('a sign-in fills a row nobody has reached', () => {
  const out = withSelfJoins({}, { 'AIHOW26-014': 1 }, ROWS);
  assert.equal(out.r1, 'present');
  assert.equal(out.r2, undefined);
});

test('THE OFFICE ALWAYS WINS: a sign-in never overwrites a mark', () => {
  // The whole trust model rests on this one line. Somebody stood in the room
  // and said this person was not there; a browser opening a link is not an
  // argument against them.
  const out = withSelfJoins({ r1: 'absent' }, { 'AIHOW26-014': 1 }, ROWS);
  assert.equal(out.r1, 'absent');
});

test('a sign-in does not downgrade a late mark to present', () => {
  const out = withSelfJoins({ r1: 'late' }, { 'AIHOW26-014': 1 }, ROWS);
  assert.equal(out.r1, 'late');
});

test('folding does not mutate the marks it was handed', () => {
  const office = { r2: 'late' };
  const out = withSelfJoins(office, { 'AIHOW26-014': 1 }, ROWS);
  assert.deepEqual(office, { r2: 'late' }, 'the stored day must be left alone');
  assert.equal(out.r1, 'present');
});

test('with nothing to fold the same object comes back', () => {
  const office = { r1: 'present' };
  assert.equal(withSelfJoins(office, {}, ROWS), office);
});

test('the totals count a sign-in as attendance, like any other present', () => {
  const marks = withSelfJoins({ r2: 'absent' }, { 'AIHOW26-014': 1 }, ROWS);
  const sum = attendanceSummary(ROWS, marks);
  assert.equal(sum.attended, 1);
  assert.equal(sum.absent, 1);
  assert.equal(sum.unmarked, 1, 'Chandni has no ticket and nobody marked her');
});

/* ---- the write a student is allowed to make ---------------------- */

test('the ticket is required before the class will open', () => {
  const page = read('../src/pages/site/JoinClassPage.jsx');
  assert.match(page, /disabled=\{!name\.trim\(\) \|\| !ticket\.trim\(\)\}/);
  assert.match(page, /if \(!clean \|\| !tick\) return;/);
  assert.match(page, /looksLikeTicketId/);
});

test('joining records the sign-in, and does not wait for it', () => {
  // Being in the class beats recording that you are. If Firestore is slow or
  // refuses, the student still gets through the door.
  const page = read('../src/pages/site/JoinClassPage.jsx');
  assert.match(page, /recordSelfJoin\(workshopId, today\(\), tick\)\.then\(setRecorded/);
  assert.doesNotMatch(page, /await recordSelfJoin/);
  // …and the student is told either way, because they were told they no
  // longer have to be marked by hand.
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /could not be recorded from here/);
});

test('the ticket is upper-cased before it is written', () => {
  // The document id IS the ticket, so two cases would be two documents and
  // the office would see one person sign in twice.
  const page = read('../src/pages/site/JoinClassPage.jsx');
  assert.match(page, /const tick = ticket\.trim\(\)\.toUpperCase\(\);/);
  const db = read('../src/lib/attendancedb.js');
  assert.match(db, /String\(ticketId \|\| ''\)\.trim\(\)\.toUpperCase\(\)/);
});

test('a failed sign-in is swallowed rather than thrown at the student', () => {
  const db = read('../src/lib/attendancedb.js');
  assert.match(db, /try \{[\s\S]{0,240}?\} catch \{[\s\S]{0,240}?return false;/);
});

/* ---- what the rules let a stranger do ---------------------------- */

test('the rule lets a stranger create exactly one field, and never change it', () => {
  const rules = read('../firestore.rules');
  const block = rules.slice(rules.indexOf('match /joins/{ticketId}'));
  assert.match(block, /allow read, update, delete: if isAdmin\(\)/);
  assert.match(block, /allow create: if classIsOpen\(workshopId\)/);
  assert.match(block, /hasOnly\(\['at'\]\)/);
  assert.match(block, /request\.resource\.data\.at == request\.time/);
  assert.match(block, /ticketId\.size\(\) >= 3 && ticketId\.size\(\) <= 40/);
  assert.match(block, /day\.matches\('\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}'\)/);
});

test('the registers themselves stay unreadable to a stranger', () => {
  // The sign-in exists BECAUSE the roster cannot be read. If this ever
  // loosened, the whole shape would have been unnecessary — and the phone
  // numbers on the register would be public.
  const rules = read('../firestore.rules');
  const regs = rules.slice(rules.indexOf('match /registrations/'));
  const firstAllow = regs.slice(0, regs.indexOf('match /', 10));
  assert.doesNotMatch(firstAllow, /allow read: if true/);
});

/* ---- what the office sees ---------------------------------------- */

test('the register shows which marks it made and which the door made', () => {
  const reg = read('../src/components/AttendanceRegister.jsx');
  assert.match(reg, /joined, officeMarks/);
  assert.match(reg, /const byHand = officeMarks \|\| marks;/);
  assert.match(reg, /Signed in with their ticket/);
  assert.match(reg, /Also signed in with their ticket/);
  assert.match(reg, /marked absent here/);
  assert.match(reg, /reg-self/);
});

test('a contradiction between the room and the link is shown as one', () => {
  const reg = read('../src/components/AttendanceRegister.jsx');
  assert.match(reg, /const clash = self && hand === 'absent';/);
  const css = read('../src/styles.css');
  assert.match(css, /\.reg-row\[data-self='clash'\] \.reg-self \{ color: var\(--alert\); \}/);
});

test('clearing the day is disabled once there is nothing of the office\'s left', () => {
  // Sign-ins refill themselves, so a button that cannot clear them must not
  // sit there enabled looking like it can.
  const reg = read('../src/components/AttendanceRegister.jsx');
  assert.match(reg, /const anyByHand = people\.some\(\(r\) => byHand\[r\.id\]\)/);
  assert.match(reg, /disabled=\{saving \|\| !anyByHand\}/);
});

test('the page hands the register the office marks unfolded', () => {
  const page = read('../src/pages/AttendancePage.jsx');
  assert.match(page, /officeMarks=\{byDay\[takingDay\] \|\| \{\}\}/);
  assert.match(page, /joined=\{joinedToday\}/);
  assert.match(page, /marks=\{marks\}/);
});

test('the filed sheet carries the sign-ins too', () => {
  // A register printed as the record of the course cannot show somebody
  // unmarked when the system knows they were there.
  const page = read('../src/pages/AttendancePage.jsx');
  assert.match(page, /byDay=\{withMarks && Object\.keys\(byDayMerged\)\.length > 0 \? byDayMerged : null\}/);
});
