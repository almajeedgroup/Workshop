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
  formatPhone,
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

test('a rule used as decoration does not tear one workshop in half', () => {
  // Regression: any line of dashes split the paste, so a poster with a
  // divider in it became two half-records.
  const records = parseText('Title: Alpha\nVenue: Hall A\n-----\nTopics: more about Alpha');
  assert.equal(records.length, 1);
  assert.equal(records[0].workshop.title, 'Alpha');
  assert.match(records[0].workshop.topics, /more about Alpha/);
});

test('two posters separated by a rule are still two records', () => {
  const records = parseText(`${SAMPLE_WORKSHOP_TEXT}\n---\n${SAMPLE_WORKSHOP_TEXT}`);
  assert.equal(records.length, 2);
});

test('a decorative rule never becomes content', () => {
  const [{ workshop }] = parseText('Title: Alpha\n-----\nVenue: Hall A');
  assert.equal(workshop.title, 'Alpha');
  assert.equal(workshop.venue, 'Hall A');
  assert.doesNotMatch(JSON.stringify(workshop), /-----/);
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

test('table: an empty leading tab cell keeps the columns aligned', () => {
  // Regression: lines were trimmed before splitting, so an empty first cell
  // vanished and every later column shifted one to the left.
  const rows = parseRegistrations(
    'Qualification\tName\tArea\nClass 10\tAyesha\tJayanagar\n\tFaizan\tShivajinagar'
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[1].name, 'Faizan');
  assert.equal(rows[1].area, 'Shivajinagar');
  assert.equal(rows[1].qualification, '');
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

test('dates: a day that does not exist is refused, not stored', () => {
  // Regression: these were accepted verbatim and printed onto tickets.
  assert.equal(parseDateRange('31/04/2026').start, '');
  assert.equal(parseDateRange('29/02/2025').start, '');
  assert.equal(parseDateRange('32/01/2026').start, '');
  assert.equal(parseDateRange('February 30, 2026').start, '');
});

test('dates: real leap days are kept', () => {
  assert.equal(parseDateRange('29/02/2024').start, '2024-02-29');
  assert.equal(parseDateRange('29/02/2000').start, '2000-02-29');
});

test('dates: an unreadable date is reported rather than guessed', () => {
  const [{ warnings }] = parseText('Title: Alpha\nDate: 31/04/2026');
  assert.ok(warnings.some((w) => /Could not read a date/.test(w)));
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

/* ------------------------------------------------------------------ *
 * Phone numbers as they are stored
 *
 * "Contact numbers should get saved with +91 code and if any number has
 * +91 then no need."
 * ------------------------------------------------------------------ */

test('phone: a bare ten-digit number gains the country code', () => {
  assert.equal(formatPhone('9339214522'), '+91 9339214522');
});

test('phone: a number that already has +91 is not given another', () => {
  assert.equal(formatPhone('+91 9339214522'), '+91 9339214522');
  assert.equal(formatPhone('+919339214522'), '+91 9339214522');
  assert.equal(formatPhone('+91-9339214522'), '+91 9339214522');
});

test('phone: however it was typed, it is stored one way', () => {
  const same = [
    '9339214522', '+919339214522', '+91 9339214522', '+91 93392 14522',
    '09339214522', '919339214522', '0091 9339214522', '93392-14522',
    '(93392) 14522', '  9339214522  ', '+91 (93392) 14522',
  ];
  for (const typed of same) {
    assert.equal(formatPhone(typed), '+91 9339214522', `${typed} should store the same way`);
  }
});

test('phone: an Indian landline with its STD code works too', () => {
  assert.equal(formatPhone('080 2222 3333'), '+91 8022223333');
});

test('phone: a foreign number is left exactly as it was typed', () => {
  // +1, +44 and +971 are real numbers this office might hold, and none of
  // them are ours to rewrite.
  for (const foreign of ['+1 555 0100', '+44 20 7946 0958', '+971 50 123 4567']) {
    assert.equal(formatPhone(foreign), foreign);
  }
});

test('phone: anything it cannot confidently read is left alone', () => {
  // Mangling a number into a mobile it is not is worse than leaving it
  // untidy — so it never guesses.
  for (const odd of ['12345', 'abc', '+91', '+911234', 'ask at the desk']) {
    assert.equal(formatPhone(odd), odd);
  }
});

test('phone: nothing in gives nothing out', () => {
  assert.equal(formatPhone(''), '');
  assert.equal(formatPhone(null), '');
  assert.equal(formatPhone(undefined), '');
  assert.equal(formatPhone('   '), '');
});

test('phone: formatting twice changes nothing the second time', () => {
  for (const typed of ['9339214522', '+91 9339214522', '+44 20 7946 0958', '12345']) {
    assert.equal(formatPhone(formatPhone(typed)), formatPhone(typed), typed);
  }
});

test('phone: the stored form still makes a working WhatsApp link', () => {
  // normalizePhone strips everything but digits, so the links and the
  // duplicate check keep working against the new shape.
  assert.equal(normalizePhone(formatPhone('9339214522')), '919339214522');
  assert.equal(normalizePhone(formatPhone('+91 9339214522')), '919339214522');
  assert.equal(
    normalizePhone(formatPhone('9339214522')),
    normalizePhone('9339214522'),
    'a number stored the new way and one typed the old way still match',
  );
});
