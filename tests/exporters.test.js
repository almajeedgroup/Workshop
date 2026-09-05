/**
 * Tests for what goes INTO a sheet — which columns, in what order, for whom.
 * The file format itself is covered by xlsx.test.js.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { studentListRows } from '../src/lib/exporters.js';
import { CURRENCY } from '../src/lib/schema.js';

/* ---- the student list: one row per person, only columns that say
   something ---- */

const PAID = { feeType: 'Paid', feeAmount: 149, title: 'W' };
const FREE = { feeType: 'Free', title: 'W' };

const PEOPLE = [
  {
    ticketId: 'IIC-010', name: 'Zainab Begum', dob: '2004-12-21',
    qualification: 'Graduation', courseName: 'BBA in Aviation',
    whatsapp: '9339214522', area: 'Marathahalli', email: 'z@example.com',
    paymentStatus: 'Paid', amountPaid: 149, paymentMode: '', paymentRef: '',
    bloodGroup: '', emergencyContact: '', notes: '',
  },
  {
    ticketId: 'IIC-002', name: 'Aisha Fathima', dob: '',
    qualification: 'II PUC', courseName: '',
    whatsapp: '9000000000', area: '', email: '',
    paymentStatus: 'Pending', amountPaid: '', paymentMode: '', paymentRef: '',
    bloodGroup: '', emergencyContact: '', notes: '',
  },
];

const cols = (rows) => Object.keys(rows[0]);

test('students: one row each, numbered from one', () => {
  const rows = studentListRows(PAID, PEOPLE);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r['S.No']), [1, 2]);
});

test('students: ordered by ticket number, not by the order given', () => {
  const rows = studentListRows(PAID, PEOPLE);
  assert.deepEqual(rows.map((r) => r['Ticket ID']), ['IIC-002', 'IIC-010']);
});

test('students: the workshop is not repeated down every row', () => {
  for (const c of cols(studentListRows(PAID, PEOPLE))) {
    assert.ok(!/workshop/i.test(c), `"${c}" does not belong on a list of people`);
  }
});

test('students: a column nobody filled in is left out', () => {
  const got = cols(studentListRows(PAID, PEOPLE));
  for (const c of ['Blood Group', 'Emergency Contact', 'Notes', 'Payment Mode', 'Payment Ref.']) {
    assert.ok(!got.includes(c), `${c} is empty for everyone and should be dropped`);
  }
});

test('students: a column somebody filled in is kept', () => {
  const withBlood = [{ ...PEOPLE[0], bloodGroup: 'O+' }, PEOPLE[1]];
  assert.ok(cols(studentListRows(PAID, withBlood)).includes('Blood Group'));
});

test('students: a free course carries no payment columns at all', () => {
  const got = cols(studentListRows(FREE, PEOPLE));
  for (const c of got) {
    assert.ok(!/payment|amount/i.test(c), `"${c}" is meaningless on a free course`);
  }
});

test('students: a paid course keeps payment where it was recorded', () => {
  const got = cols(studentListRows(PAID, PEOPLE));
  assert.ok(got.includes('Payment'));
  assert.ok(got.includes(`Amount Paid (${CURRENCY})`));
});

test('students: dates read as a person reads them', () => {
  const rows = studentListRows(PAID, PEOPLE);
  assert.equal(rows.find((r) => r['Ticket ID'] === 'IIC-010').DoB, '21 Dec 2004');
});

test('students: the name column survives even when every name is blank', () => {
  const nameless = [{ ticketId: 'A-1', name: '' }, { ticketId: 'A-2', name: '' }];
  assert.ok(cols(studentListRows(FREE, nameless)).includes('Name'));
});

test('students: every row has the same columns, so the header matches', () => {
  const rows = studentListRows(PAID, PEOPLE);
  const first = JSON.stringify(cols(rows));
  for (const r of rows) assert.equal(JSON.stringify(Object.keys(r)), first);
});

test('students: phone numbers stay text, not turned into numbers', () => {
  const rows = studentListRows(PAID, PEOPLE);
  for (const r of rows) assert.equal(typeof r['WhatsApp #'], 'string');
});

test('students: nobody registered gives no rows rather than an error', () => {
  assert.deepEqual(studentListRows(PAID, []), []);
});
