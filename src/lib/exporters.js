/**
 * Excel / CSV generation. All client-side via SheetJS — nothing is uploaded.
 *
 * Sheets:
 *   Workshops      one row per workshop (all schema fields)
 *   Registrations  one row per candidate, with the workshop joined on so the
 *                  sheet stands on its own
 */

import * as XLSX from 'xlsx';
import { WORKSHOP_FIELDS, REGISTRATION_FIELDS, CURRENCY } from './schema.js';

function cell(field, value) {
  if (field.type === 'list') return Array.isArray(value) ? value.join('; ') : (value ?? '');
  if (field.type === 'number') return value === null || value === undefined || value === '' ? '' : Number(value);
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

/** Rough auto-fit so columns aren't 8 characters wide. */
function fit(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((k) => {
    const widest = rows.reduce((max, r) => Math.max(max, String(r[k] ?? '').length), k.length);
    return { wch: Math.min(Math.max(widest + 2, 10), 55) };
  });
}

function sheetFrom(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = fit(rows);
  if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function safeName(s) {
  return String(s || 'workshop').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60).trim();
}

function safeSheetName(s) {
  return String(s || 'Sheet').replace(/[\\/:*?[\]]/g, '-').slice(0, 31) || 'Sheet';
}

/* ------------------------------------------------------------------ */

export function exportAllXlsx(bundles) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(bundles.map((b) => workshopRow({ ...b.workshop, registrationCount: b.registrations.length }))),
    'Workshops'
  );

  const all = bundles.flatMap((b) => registrationRows(b.workshop, b.registrations));
  if (all.length) {
    all.forEach((r, i) => { r['S.No'] = i + 1; });
    XLSX.utils.book_append_sheet(wb, sheetFrom(all), 'Registrations');
  }

  XLSX.writeFile(wb, `Workshops-${stamp()}.xlsx`);
}

/** One workshop: details sheet + its registration sheet + a payment summary. */
export function exportWorkshopXlsx(workshop, registrations) {
  const wb = XLSX.utils.book_new();

  const details = WORKSHOP_FIELDS.map((f) => ({ Field: f.label, Value: cell(f, workshop[f.key]) }));
  details.push({ Field: 'Total Registrations', Value: registrations.length });
  XLSX.utils.book_append_sheet(wb, sheetFrom(details), 'Details');

  const rows = registrationRows(workshop, registrations);
  if (rows.length) {
    XLSX.utils.book_append_sheet(wb, sheetFrom(rows), safeSheetName('Registrations'));

    const paid = registrations.filter((r) => r.paymentStatus === 'Paid');
    const collected = paid.reduce(
      (s, r) => s + (Number(r.amountPaid) || Number(workshop.feeAmount) || 0), 0
    );
    const summary = [
      { Item: 'Total registrations', Value: registrations.length },
      { Item: 'Paid', Value: paid.length },
      { Item: 'Pending', Value: registrations.filter((r) => r.paymentStatus === 'Pending').length },
      { Item: 'Waived', Value: registrations.filter((r) => r.paymentStatus === 'Waived').length },
      { Item: 'Refunded', Value: registrations.filter((r) => r.paymentStatus === 'Refunded').length },
      { Item: `Amount collected (${CURRENCY})`, Value: collected },
      { Item: 'Seat limit', Value: workshop.seatLimit ?? '' },
      { Item: 'Seats remaining', Value: workshop.seatLimit ? Math.max(0, workshop.seatLimit - registrations.length) : '' },
    ];
    XLSX.utils.book_append_sheet(wb, sheetFrom(summary), 'Payment Summary');
  }

  XLSX.writeFile(wb, `${safeName(workshop.code || workshop.title)}-${stamp()}.xlsx`);
}

export function exportRegistrationsXlsx(workshop, registrations) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom(registrationRows(workshop, registrations)), 'Registrations');
  XLSX.writeFile(wb, `${safeName(workshop.title)}-registrations-${stamp()}.xlsx`);
}

export function exportCsv(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportWorkshopsCsv(bundles) {
  exportCsv(
    bundles.map((b) => workshopRow({ ...b.workshop, registrationCount: b.registrations.length })),
    `Workshops-${stamp()}.csv`
  );
}

export function exportRegistrationsCsv(workshop, registrations) {
  exportCsv(
    registrationRows(workshop, registrations),
    `${safeName(workshop.title)}-registrations-${stamp()}.csv`
  );
}
