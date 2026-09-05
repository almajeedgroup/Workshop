import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseDays, signatureColumns, needsPerDaySheets, attendanceRows,
  sheetSignatories, MAX_DAY_COLUMNS,
  ATTENDANCE_MARKS, attendanceMark, nextMark, attendanceSummary, attendanceRate,
} from '../src/lib/attendance.js';

/* ---- which days the course runs ---------------------------------- */

test('days: a one-day course is one day', () => {
  assert.deepEqual(courseDays({ startDate: '2026-09-03' }), ['2026-09-03']);
  assert.deepEqual(courseDays({ startDate: '2026-09-03', endDate: '2026-09-03' }), ['2026-09-03']);
});

test('days: a range is every day inclusive of both ends', () => {
  assert.deepEqual(
    courseDays({ startDate: '2026-09-03', endDate: '2026-09-05' }),
    ['2026-09-03', '2026-09-04', '2026-09-05'],
  );
});

test('days: only an end date still gives a sheet', () => {
  assert.deepEqual(courseDays({ endDate: '2026-09-05' }), ['2026-09-05']);
});

test('days: dates typed the wrong way round are read as a range, not refused', () => {
  assert.deepEqual(
    courseDays({ startDate: '2026-09-05', endDate: '2026-09-03' }),
    ['2026-09-03', '2026-09-04', '2026-09-05'],
  );
});

test('days: a course with no dates has none', () => {
  assert.deepEqual(courseDays({}), []);
  assert.deepEqual(courseDays(null), []);
  assert.deepEqual(courseDays({ startDate: 'next Tuesday' }), []);
});

test('days: a month boundary is crossed correctly', () => {
  assert.deepEqual(
    courseDays({ startDate: '2026-01-30', endDate: '2026-02-02' }),
    ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'],
  );
});

test('days: a leap day is not skipped', () => {
  assert.deepEqual(
    courseDays({ startDate: '2028-02-27', endDate: '2028-03-01' }),
    ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'],
  );
});

test('days: a runaway range is capped rather than generating thousands', () => {
  const days = courseDays({ startDate: '2026-01-01', endDate: '2030-01-01' });
  assert.ok(days.length <= 60, `${days.length} days is too many`);
  assert.equal(days[0], '2026-01-01');
});

/* ---- signature columns ------------------------------------------- */

test('columns: one per day while they stay wide enough to sign', () => {
  const cols = signatureColumns({ startDate: '2026-09-03', endDate: '2026-09-05' });
  assert.equal(cols.length, 3);
  assert.deepEqual(cols.map((c) => c.label), ['3 Sep 2026', '4 Sep 2026', '5 Sep 2026']);
});

test('columns: exactly at the limit still gets a column each', () => {
  const end = `2026-09-${String(2 + MAX_DAY_COLUMNS).padStart(2, '0')}`;
  const cols = signatureColumns({ startDate: '2026-09-03', endDate: end });
  assert.equal(cols.length, MAX_DAY_COLUMNS);
});

test('columns: one past the limit collapses to a single signature column', () => {
  const end = `2026-09-${String(3 + MAX_DAY_COLUMNS).padStart(2, '0')}`;
  const cols = signatureColumns({ startDate: '2026-09-03', endDate: end });
  assert.deepEqual(cols, [{ key: 'signature', label: 'Signature' }]);
});

test('columns: picking one day gives that day alone', () => {
  const w = { startDate: '2026-09-01', endDate: '2026-09-10' };
  assert.deepEqual(signatureColumns(w, '2026-09-04'), [{ key: '2026-09-04', label: '4 Sep 2026' }]);
});

test('columns: a day outside the course is ignored rather than printed', () => {
  const w = { startDate: '2026-09-01', endDate: '2026-09-03' };
  const cols = signatureColumns(w, '2027-01-01');
  assert.ok(!cols.some((c) => c.key === '2027-01-01'));
  assert.equal(cols.length, 3);
});

test('columns: a course with no dates still has somewhere to sign', () => {
  assert.deepEqual(signatureColumns({}), [{ key: 'signature', label: 'Signature' }]);
});

test('columns: a one-day course labels the column with its date', () => {
  assert.deepEqual(
    signatureColumns({ startDate: '2026-09-03' }),
    [{ key: '2026-09-03', label: 'Signature — 3 Sep 2026' }],
  );
});

test('per-day sheets are needed only past the column limit', () => {
  assert.equal(needsPerDaySheets({ startDate: '2026-09-03', endDate: '2026-09-05' }), false);
  assert.equal(needsPerDaySheets({ startDate: '2026-09-01', endDate: '2026-09-30' }), true);
  assert.equal(needsPerDaySheets({}), false);
});

/* ---- the order people are called in ------------------------------- */

test('rows: ordered by ticket number, and numerically not as text', () => {
  const rows = attendanceRows([
    { ticketId: 'IIC-010', name: 'Zainab' },
    { ticketId: 'IIC-002', name: 'Aisha' },
    { ticketId: 'IIC-001', name: 'Bilal' },
  ]);
  assert.deepEqual(rows.map((r) => r.ticketId), ['IIC-001', 'IIC-002', 'IIC-010']);
});

test('rows: anyone without a ticket goes last, in name order', () => {
  const rows = attendanceRows([
    { ticketId: '', name: 'Zainab' },
    { ticketId: 'IIC-002', name: 'Aisha' },
    { ticketId: '', name: 'Bilal' },
  ]);
  assert.deepEqual(rows.map((r) => r.name), ['Aisha', 'Bilal', 'Zainab']);
});

test('rows: the original list is not reordered underneath the caller', () => {
  const original = [{ ticketId: 'B' }, { ticketId: 'A' }];
  attendanceRows(original);
  assert.deepEqual(original.map((r) => r.ticketId), ['B', 'A']);
});

test('rows: nothing registered is not an error', () => {
  assert.deepEqual(attendanceRows([]), []);
  assert.deepEqual(attendanceRows(null), []);
});

/* ---- who signs the foot ------------------------------------------ */

test('signatories: the presenter is named from the workshop', () => {
  const s = sheetSignatories({ resourcePersons: ['Mr Sulaimaan'], coordinators: ['Ms Arshiya'] });
  assert.equal(s[0].name, 'Mr Sulaimaan');
  assert.equal(s[1].name, 'Ms Arshiya');
});

test('signatories: presentedBy stands in when no resource person is recorded', () => {
  assert.equal(sheetSignatories({ presentedBy: 'Beyond Guidance' })[0].name, 'Beyond Guidance');
});

test('signatories: three lines are always printed, named or blank', () => {
  const s = sheetSignatories({});
  assert.equal(s.length, 3);
  for (const line of s) assert.ok(line.role, 'every line is labelled');
});

/* ------------------------------------------------------------------ *
 * Taking the register
 * ------------------------------------------------------------------ */

test('marks: unmarked is a state of its own, not a missing one', () => {
  // A register that cannot tell "nobody reached them" from "they did not
  // come" turns an unfinished job into an accusation.
  assert.equal(attendanceMark('').key, '');
  assert.equal(attendanceMark('').label, 'Unmarked');
  assert.equal(attendanceMark(undefined).key, '');
  assert.notEqual(attendanceMark('').key, attendanceMark('absent').key);
});

test('marks: an unknown mark falls back to unmarked rather than blank', () => {
  assert.equal(attendanceMark('truant').key, '');
  assert.ok(attendanceMark('truant').label);
});

test('marks: every mark carries a palette tone', () => {
  for (const m of ATTENDANCE_MARKS) {
    assert.ok(['jade', 'tangerine', 'red', 'none'].includes(m.tone), `${m.key} has tone ${m.tone}`);
  }
});

test('cycle: one tap gets to present, and it comes back round', () => {
  assert.equal(nextMark(''), 'present');
  assert.equal(nextMark('present'), 'late');
  assert.equal(nextMark('late'), 'absent');
  assert.equal(nextMark('absent'), '', 'a mistake can be undone by tapping on');
});

test('cycle: an unknown mark rejoins the cycle rather than sticking', () => {
  assert.equal(nextMark('truant'), 'present');
  assert.equal(nextMark(undefined), 'present');
});

/* ---- the day's totals --------------------------------------------- */

const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

test('summary: counts every state, and unmarked among them', () => {
  const s = attendanceSummary(people, { a: 'present', b: 'late', c: 'absent' });
  assert.deepEqual(
    { total: s.total, present: s.present, late: s.late, absent: s.absent, unmarked: s.unmarked },
    { total: 4, present: 1, late: 1, absent: 1, unmarked: 1 },
  );
});

test('summary: late counts as having attended', () => {
  // Somebody who arrived twenty minutes in was there.
  assert.equal(attendanceSummary(people, { a: 'present', b: 'late' }).attended, 2);
});

test('summary: nobody marked means everybody unmarked, not everybody absent', () => {
  const s = attendanceSummary(people, {});
  assert.equal(s.unmarked, 4);
  assert.equal(s.absent, 0);
});

test('summary: a mark left behind for somebody since removed is ignored', () => {
  const s = attendanceSummary(people, { a: 'present', gone: 'present' });
  assert.equal(s.total, 4);
  assert.equal(s.attended, 1);
});

test('summary: an empty register is not an error', () => {
  assert.equal(attendanceSummary([], {}).total, 0);
  assert.equal(attendanceSummary().total, 0);
});

/* ---- how much of the course somebody attended ---------------------- */

test('rate: only days actually taken count towards the total', () => {
  // Six days with two taken is two days of attendance, not a third of the
  // course — reporting it as a third understates everybody until the last
  // day is marked.
  const byDay = {
    '2026-09-03': { a: 'present' },
    '2026-09-04': { a: 'absent' },
    '2026-09-05': {},
  };
  assert.deepEqual(attendanceRate(byDay, 'a'), { attended: 1, days: 2, ratio: 0.5 });
});

test('rate: late days count as attended', () => {
  const byDay = { d1: { a: 'late' }, d2: { a: 'present' } };
  assert.equal(attendanceRate(byDay, 'a').attended, 2);
});

test('rate: somebody never marked has attended none of the days taken', () => {
  const byDay = { d1: { b: 'present' }, d2: { b: 'present' } };
  assert.deepEqual(attendanceRate(byDay, 'a'), { attended: 0, days: 2, ratio: 0 });
});

test('rate: nothing recorded yet reports nothing rather than zero', () => {
  // Zero would read as "attended none", which is a different claim.
  assert.equal(attendanceRate({}, 'a'), null);
  assert.equal(attendanceRate({ d1: {} }, 'a'), null);
  assert.equal(attendanceRate(undefined, 'a'), null);
});
