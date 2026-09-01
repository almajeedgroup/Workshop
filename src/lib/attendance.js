/**
 * Attendance sheets.
 *
 * The one document in this system that exists to be written ON. Everything
 * else is printed to be kept; this is printed so a room full of people can
 * sign it, and the presenter can sign underneath to say they were there.
 *
 * That single fact settles most of the design: rows must be tall enough for a
 * pen, the signature boxes must be wide enough for a real signature, and the
 * heading has to repeat on every page — an unsigned second page with no names
 * on it is worthless.
 */

import { formatDate } from './tickets.js';
import { ISSUER } from './schema.js';

/**
 * How many days can be signature columns before they get too narrow to sign
 * in. Past this the sheet takes one day at a time instead.
 *
 * Six columns across A4 leaves about 22mm each, which is a signature. Ten
 * would leave 13mm, which is an initial at best.
 */
export const MAX_DAY_COLUMNS = 6;

/** A runaway range must not generate a thousand columns. */
const MAX_DAYS = 60;

function parseISO(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? ''));
  if (!m) return null;
  // Built in UTC on purpose: a local-time Date shifts the day either side of
  // midnight depending on where the machine is, and an attendance sheet dated
  // one day out is worse than one with no dates at all.
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Every day the course runs, as ISO dates.
 *
 * A course with only a start date is one day. A course with the dates the
 * wrong way round is read as the range between them rather than refused —
 * somebody typed them in the wrong boxes, and an empty sheet helps nobody.
 */
export function courseDays(workshop) {
  let start = parseISO(workshop?.startDate);
  let end = parseISO(workshop?.endDate);
  if (!start && !end) return [];
  if (!start) start = end;
  if (!end) end = start;
  if (end < start) [start, end] = [end, start];

  const days = [];
  for (let d = start; d <= end && days.length < MAX_DAYS; d = new Date(d.getTime() + 86400000)) {
    days.push(toISO(d));
  }
  return days;
}

/**
 * The signature columns for a sheet.
 *
 * `day` picks one date; anything else means the whole course. A course too
 * long to fit as columns falls back to a single undated column, because a
 * column nobody can sign in is not a column.
 */
export function signatureColumns(workshop, day = '') {
  const days = courseDays(workshop);

  if (day && days.includes(day)) {
    return [{ key: day, label: formatDate(day) }];
  }
  if (days.length === 0) {
    return [{ key: 'signature', label: 'Signature' }];
  }
  if (days.length === 1) {
    return [{ key: days[0], label: `Signature — ${formatDate(days[0])}` }];
  }
  if (days.length > MAX_DAY_COLUMNS) {
    return [{ key: 'signature', label: 'Signature' }];
  }
  return days.map((d) => ({ key: d, label: formatDate(d) }));
}

/**
 * True when the course runs over more days than fit as columns, so the sheet
 * has to be printed one day at a time. The page says so rather than silently
 * dropping the dates.
 */
export function needsPerDaySheets(workshop) {
  return courseDays(workshop).length > MAX_DAY_COLUMNS;
}

/**
 * The people on the sheet, in the order they will be called.
 *
 * By ticket number where there is one, so the sheet matches the register and
 * the tickets already issued; by name for anyone still without one. Sorting
 * by name alone would reshuffle the sheet every time somebody new joined.
 */
export function attendanceRows(registrations) {
  const list = [...(registrations || [])];
  list.sort((a, b) => {
    const at = String(a.ticketId || '');
    const bt = String(b.ticketId || '');
    if (at && bt) return at.localeCompare(bt, undefined, { numeric: true });
    if (at) return -1;
    if (bt) return 1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return list;
}

/**
 * Who signs the foot of the sheet.
 *
 * The presenter is named from the workshop where one is recorded, so the
 * printed sheet does not ask a room to take somebody's word for who taught
 * them. The coordinator line is left blank to be signed by whoever ran the
 * session on the day.
 */
export function sheetSignatories(workshop) {
  const presenter = String(workshop?.resourcePersons?.[0] || workshop?.presentedBy || '').trim();
  return [
    { role: 'Presenter / Resource Person', name: presenter },
    { role: 'Coordinator', name: String(workshop?.coordinators?.[0] || '').trim() },
    { role: `For ${ISSUER.unit || ISSUER.name}`, name: '' },
  ];
}
