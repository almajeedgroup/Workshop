/**
 * Excel / CSV generation. All client-side — nothing is uploaded.
 *
 * Sheets:
 *   Workshops      one row per workshop (all schema fields)
 *   Registrations  one row per candidate, with the workshop joined on so the
 *                  sheet stands on its own
 *
 * The file format itself lives in ./xlsx.js.
 */

import { downloadXlsx, downloadCsv } from './xlsx.js';
import { amountCollected, paymentCounts } from './stats.js';
import {
  WORKSHOP_FIELDS, REGISTRATION_FIELDS, CURRENCY,
  registrationFieldByKey, isFreeWorkshop,
} from './schema.js';
import { formatDate } from './tickets.js';
import { attendanceRows } from './attendance.js';

function cell(field, value) {
  if (field.type === 'list' || field.type === 'multi') return Array.isArray(value) ? value.join('; ') : (value ?? '');
  if (field.type === 'number') return value === null || value === undefined || value === '' ? '' : Number(value);
  // An uploaded image is a data URL far longer than a spreadsheet cell can
  // hold, and unreadable if it fitted. Record that one is set instead.
  if (field.type === 'image') {
    if (!value) return '';
    return String(value).startsWith('data:') ? 'Uploaded' : String(value);
  }
  return value ?? '';
}

export function workshopRow(w) {
  const row = {};
  for (const f of WORKSHOP_FIELDS) row[f.label] = cell(f, w[f.key]);
  row['Registrations'] = w.registrationCount ?? '';
  return row;
}

export function registrationRows(workshop, registrations) {
  return registrations.map((r, i) => {
    const row = {
      'S.No': i + 1,
      'Workshop': workshop.title || '',
      'Workshop Code': workshop.code || '',
      'Start Date': workshop.startDate || '',
    };
    for (const f of REGISTRATION_FIELDS) row[f.label] = cell(f, r[f.key]);
    return row;
  });
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function safeName(s) {
  return String(s || 'workshop').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60).trim();
}

/* ------------------------------------------------------------------ *
 * The student list
 * ------------------------------------------------------------------ *
 *
 * One row per student, and only the columns that say something.
 *
 * The Registrations sheet exists to be complete: it carries every field in
 * the schema and repeats the workshop on every row, so it stands on its own
 * when several workshops are exported together. That is the right shape for
 * an archive and the wrong shape for a list somebody is going to read, where
 * four identical columns and eleven empty ones are just in the way.
 *
 * So this sheet drops three kinds of column:
 *
 *   - the workshop repeated on every row. It is in the file name and the
 *     sheet name instead. Putting it in a title row above the header would
 *     be worse than leaving it out — it breaks sorting and filtering in
 *     every spreadsheet program there is.
 *   - payment, on a free course, where there is nothing to record.
 *   - anything blank for every single student. A course that never collected
 *     blood groups has no business printing a Blood Group column.
 */

/** In the order they belong on a list of people. */
const STUDENT_COLUMNS = [
  'ticketId', 'name', 'dob', 'qualification', 'courseName',
  'whatsapp', 'area', 'email',
];

/** Added only when the course charges. */
const PAYMENT_COLUMNS = ['paymentStatus', 'amountPaid', 'paymentMode', 'paymentRef'];

/** Added only where somebody actually has one. */
const EXTRA_COLUMNS = ['bloodGroup', 'emergencyContact', 'notes'];

function studentValue(key, reg) {
  const field = registrationFieldByKey[key];
  if (!field) return '';
  // Dates read as a person reads them, matching the ticket and the ID card.
  if (field.type === 'date') return formatDate(reg[key]);
  return cell(field, reg[key]);
}

/**
 * The rows, and the columns that earned their place.
 *
 * Ordered by ticket number the same way the attendance sheet is, so the two
 * can be read side by side without hunting.
 */
export function studentListRows(workshop, registrations) {
  const people = attendanceRows(registrations);
  const candidates = [
    ...STUDENT_COLUMNS,
    ...(isFreeWorkshop(workshop) ? [] : PAYMENT_COLUMNS),
    ...EXTRA_COLUMNS,
  ];

  // A column survives only if somebody has something in it. Name stays
  // whatever happens — a list of people with no name column is not a list.
  const keep = candidates.filter((key) => key === 'name'
    || people.some((r) => {
      const v = studentValue(key, r);
      return v !== '' && v !== null && v !== undefined;
    }));

  return people.map((r, i) => {
    const row = { 'S.No': i + 1 };
    for (const key of keep) {
      row[registrationFieldByKey[key].label] = studentValue(key, r);
    }
    return row;
  });
}

/**
 * Download the student list.
 *
 * Excel, because it is what this gets opened in, and because CSV cannot say
 * "this is text" — a WhatsApp number in a CSV column is liable to be shown
 * as 9.33921e+09 by the time anyone reads it.
 */
export function exportStudentListXlsx(workshop, registrations) {
  const rows = studentListRows(workshop, registrations);
  const name = safeName(workshop.code || workshop.title);
  downloadXlsx(
    [{ name: 'Students', rows }],
    `${name}-students-${stamp()}.xlsx`,
  );
}

/* ------------------------------------------------------------------ */

export function exportAllXlsx(bundles) {
  const sheets = [
    {
      name: 'Workshops',
      rows: bundles.map((b) =>
        workshopRow({ ...b.workshop, registrationCount: b.registrations.length })
      ),
    },
  ];

  const all = bundles.flatMap((b) => registrationRows(b.workshop, b.registrations));
  if (all.length) {
    all.forEach((r, i) => { r['S.No'] = i + 1; });
    sheets.push({ name: 'Registrations', rows: all });
  }

  downloadXlsx(sheets, `Workshops-${stamp()}.xlsx`);
}

/** One workshop: details sheet + its registration sheet + a payment summary. */
export function exportWorkshopXlsx(workshop, registrations) {
  const details = WORKSHOP_FIELDS.map((f) => ({ Field: f.label, Value: cell(f, workshop[f.key]) }));
  details.push({ Field: 'Total Registrations', Value: registrations.length });

  const sheets = [{ name: 'Details', rows: details }];

  const rows = registrationRows(workshop, registrations);
  if (rows.length) {
    const counts = paymentCounts(registrations);
    sheets.push({ name: 'Registrations', rows });
    sheets.push({
      name: 'Payment Summary',
      rows: [
        { Item: 'Total registrations', Value: counts.total },
        { Item: 'Paid', Value: counts.paid },
        { Item: 'Pending', Value: counts.pending },
        { Item: 'Waived', Value: counts.waived },
        { Item: 'Refunded', Value: counts.refunded },
        { Item: `Amount collected (${CURRENCY})`, Value: amountCollected(workshop, registrations) },
        { Item: 'Seat limit', Value: workshop.seatLimit ?? '' },
        {
          Item: 'Seats remaining',
          Value: workshop.seatLimit ? Math.max(0, workshop.seatLimit - registrations.length) : '',
        },
      ],
    });
  }

  downloadXlsx(sheets, `${safeName(workshop.code || workshop.title)}-${stamp()}.xlsx`);
}

export function exportRegistrationsXlsx(workshop, registrations) {
  downloadXlsx(
    [{ name: 'Registrations', rows: registrationRows(workshop, registrations) }],
    `${safeName(workshop.title)}-registrations-${stamp()}.xlsx`
  );
}

export function exportWorkshopsCsv(bundles) {
  downloadCsv(
    bundles.map((b) => workshopRow({ ...b.workshop, registrationCount: b.registrations.length })),
    `Workshops-${stamp()}.csv`
  );
}

export function exportRegistrationsCsv(workshop, registrations) {
  downloadCsv(
    registrationRows(workshop, registrations),
    `${safeName(workshop.title)}-registrations-${stamp()}.csv`
  );
}
