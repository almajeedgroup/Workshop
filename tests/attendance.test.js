import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseDays, signatureColumns, needsPerDaySheets, attendanceRows,
  sheetSignatories, MAX_DAY_COLUMNS,
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
