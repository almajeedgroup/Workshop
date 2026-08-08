/**
 * Parser tests.
 *
 * The parser is heuristic, and its failures are silent — a shifted column
 * doesn't throw, it just quietly files a phone number in the wrong place and
 * loses it. Every case here is a shape the team has actually pasted, or a
 * regression that once got through.
 *
 * Run with: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseText,
  parseRegistrations,
  parseDateRange,
  normalizePhone,
  normalizeKey,
  SAMPLE_WORKSHOP_TEXT,
  SAMPLE_REGISTRATION_TEXT,
} from '../src/lib/parser.js';

/* ------------------------------------------------------------------ *
 * The promotional poster
 * ------------------------------------------------------------------ */

test('poster: reads every field off the promotional message', () => {
  const [{ workshop, warnings }] = parseText(SAMPLE_WORKSHOP_TEXT);

  assert.equal(workshop.title, 'AI HANDS-ON WORKSHOP');
  assert.equal(workshop.startDate, '2026-08-15');
  assert.equal(workshop.endDate, '2026-08-22');
  assert.equal(workshop.time, '5:00 PM – 8:00 PM');
  assert.equal(workshop.venue, 'Kabir Independent PU College for Women, Bengaluru');
  assert.equal(workshop.presentedBy, 'Beyond Guidance, a unit of Islamic Information Centre');
  assert.equal(workshop.audience, 'Classes 8–12');
  assert.equal(workshop.seatLimit, 30);
  assert.equal(workshop.feeAmount, 149);
  assert.deepEqual(workshop.contactNumbers, ['+91 98452 89298', '+91 63646 30740']);
  assert.match(workshop.topics, /Hands-on Learning/);
  assert.deepEqual(warnings, []);
});

test('poster: a workshop with registrations under a heading', () => {
  const [record] = parseText(
    `${SAMPLE_WORKSHOP_TEXT}\nRegistrations:\n${SAMPLE_REGISTRATION_TEXT}`
  );
  assert.equal(record.registrations.length, 2);
  assert.equal(record.registrations[0].name, 'Ayesha Siddiqua');
  assert.equal(record.registrations[0].dob, '2010-03-12');
  assert.equal(record.registrations[1].name, 'Mohammed Faizan');
});

test('several workshops separated by a rule', () => {
  const records = parseText('Title: Alpha\nVenue: Hall A\n---\nTitle: Beta\nVenue: Hall B');
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((r) => r.workshop.title), ['Alpha', 'Beta']);
});

test('missing required fields are reported, not silently accepted', () => {
  const [{ warnings }] = parseText('Venue: Hall A\nTime: 5pm');
  assert.ok(warnings.some((w) => /Workshop Title/.test(w)));
});

/* ------------------------------------------------------------------ *
 * WhatsApp reply blocks
 * ------------------------------------------------------------------ */

test('blocks: one record per *Name:* line', () => {
  const rows = parseRegistrations(SAMPLE_REGISTRATION_TEXT);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].whatsapp, '9845289298');
  assert.equal(rows[0].email, 'ayesha@example.com');
  assert.equal(rows[0].area, 'Jayanagar, Bengaluru');
  assert.equal(rows[0].paymentStatus, 'Pending');
});

test('blocks: a reply with no name is discarded rather than half-saved', () => {
  assert.deepEqual(parseRegistrations('*DoB:* 12/03/2010\n*WhatsApp #:* 9845289298'), []);
});

/* ------------------------------------------------------------------ *
 * Pasted tables — column alignment
 * ------------------------------------------------------------------ */

test('table: straightforward header row', () => {
  const [row] = parseRegistrations(
    'Name\tQualification\tArea\tWhatsApp\nAyesha Siddiqua\tClass 10\tJayanagar\t9845289298'
  );
  assert.equal(row.name, 'Ayesha Siddiqua');
  assert.equal(row.qualification, 'Class 10');
  assert.equal(row.area, 'Jayanagar');
  assert.equal(row.whatsapp, '9845289298');
});

test('table: an unquoted comma inside a value must not eat the phone number', () => {
  // Regression: "Jayanagar, Bengaluru" split into two cells, shifting the
  // phone into the column after WhatsApp, where coerce() then discarded it.
  const [row] = parseRegistrations(
    'Name, Qualification, Area, WhatsApp\nAyesha Siddiqua, Class 10, Jayanagar, Bengaluru, 9845289298'
  );
  assert.equal(row.name, 'Ayesha Siddiqua');
  assert.equal(row.qualification, 'Class 10');
  assert.equal(row.area, 'Jayanagar, Bengaluru');
  assert.equal(row.whatsapp, '9845289298');
});

test('table: quoted CSV cells keep their commas', () => {
  const [row] = parseRegistrations(
    'Name,Area,WhatsApp\n"Siddiqua, Ayesha","Jayanagar, Bengaluru",9845289298'
  );
  assert.equal(row.name, 'Siddiqua, Ayesha');
  assert.equal(row.area, 'Jayanagar, Bengaluru');
  assert.equal(row.whatsapp, '9845289298');
});

test('table: a doubled quote inside a quoted cell is one literal quote', () => {
  const [row] = parseRegistrations('Name,Area\n"The ""Boss""",Jayanagar');
  assert.equal(row.name, 'The "Boss"');
});

test('table: two surplus commas still land the email and phone correctly', () => {
  const [row] = parseRegistrations(
    'Name, Area, WhatsApp, Email\n' +
    'Ayesha, Jayanagar, 4th Block, Bengaluru, 9845289298, ayesha@example.com'
  );
  assert.equal(row.whatsapp, '9845289298');
  assert.equal(row.email, 'ayesha@example.com');
  assert.equal(row.area, 'Jayanagar, 4th Block, Bengaluru');
});

test('table: a phone in the row is recovered even when alignment cannot resolve it', () => {
  // Header claims three columns; the row has an extra unresolvable text cell.
  const [row] = parseRegistrations(
    'Name\tArea\tWhatsApp\nAyesha\tJayanagar\tnot given\t9845289298'
  );
  assert.equal(row.whatsapp, '9845289298');
});

test('table: a serial column is stripped', () => {
  const rows = parseRegistrations(
    '1\tAyesha\tClass 10\tJayanagar\n2\tFaizan\tClass 11\tShivajinagar'
  );
  assert.deepEqual(rows.map((r) => r.name), ['Ayesha', 'Faizan']);
});

test('table: a serial column is stripped from a lone row too', () => {
  // Regression: with only one row there was no pattern to compare against, so
  // the serial number was read as the candidate's name.
  const [row] = parseRegistrations('1\tAyesha Siddiqua\tClass 10\tJayanagar');
  assert.equal(row.name, 'Ayesha Siddiqua');
  assert.equal(row.qualification, 'Class 10');
});

test('table: headerless rows find email, phone and date by shape', () => {
  const [row] = parseRegistrations(
    'Ayesha Siddiqua\tClass 10\tB.Sc\tJayanagar\t9845289298\tayesha@example.com\t12/03/2010'
  );
  assert.equal(row.name, 'Ayesha Siddiqua');
  assert.equal(row.email, 'ayesha@example.com');
  assert.equal(row.whatsapp, '9845289298');
  assert.equal(row.dob, '2010-03-12');
});

test('table: rows without a name are skipped', () => {
  const rows = parseRegistrations('Area\tName\nJayanagar\tAyesha\nShivajinagar\t');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Ayesha');
});

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

test('dates: read day-first, as written in India', () => {
  assert.deepEqual(parseDateRange('03/09/2025'), { start: '2025-09-03', end: '' });
});

test('dates: an impossible day-first reading falls back to month-first', () => {
  assert.deepEqual(parseDateRange('12/13/2025'), { start: '2025-12-13', end: '' });
});

test('dates: accepted written forms', () => {
  assert.equal(parseDateRange('2026-08-15').start, '2026-08-15');
  assert.equal(parseDateRange('May 12, 2025').start, '2025-05-12');
  assert.equal(parseDateRange('12th of May, 2025').start, '2025-05-12');
});

test('dates: a range sharing one month and year fills both ends', () => {
  assert.deepEqual(parseDateRange('15th – 22nd August 2026'), {
    start: '2026-08-15',
    end: '2026-08-22',
  });
});

test('dates: prose with no date yields nothing', () => {
  assert.deepEqual(parseDateRange('to be announced'), { start: '', end: '' });
});

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

test('phones: bare Indian numbers gain a country code', () => {
  assert.equal(normalizePhone('9845289298'), '919845289298');
  assert.equal(normalizePhone('+91 98452 89298'), '919845289298');
  assert.equal(normalizePhone('098452 89298'), '919845289298');
  assert.equal(normalizePhone('00919845289298'), '919845289298');
  assert.equal(normalizePhone(''), '');
});

test('labels normalise to a comparable form', () => {
  assert.equal(normalizeKey('No. of Participants'), 'no of participants');
  assert.equal(normalizeKey('  WhatsApp #  '), 'whatsapp');
});
