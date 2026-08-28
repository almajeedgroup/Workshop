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
import { WORKSHOP_FIELDS, REGISTRATION_FIELDS, CURRENCY } from './schema.js';

function cell(field, value) {
  if (field.type === 'list') return Array.isArray(value) ? value.join('; ') : (value ?? '');
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
