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

/* ------------------------------------------------------------------ *
 * Marks
 * ------------------------------------------------------------------ */

/**
 * What a person can be marked as on a given day.
 *
 * Unmarked is a real state, not a missing one: it means nobody has been down
 * the list yet, and it must be distinguishable from "marked absent". A
 * register that cannot tell those apart is worse than no register — it turns
 * an unfinished job into an accusation.
 *
 * The tone is the palette colour the mark is shown in, matching the payment
 * pills: lime for good, tangerine for a caveat, red for a problem.
 */
export const ATTENDANCE_MARKS = [
  { key: '', label: 'Unmarked', short: '—', tone: 'none' },
  { key: 'present', label: 'Present', short: 'P', tone: 'lime' },
  { key: 'late', label: 'Late', short: 'L', tone: 'tangerine' },
  { key: 'absent', label: 'Absent', short: 'A', tone: 'red' },
];

export const attendanceMarkByKey = Object.fromEntries(
  ATTENDANCE_MARKS.map((m) => [m.key, m])
);

/** The mark a key stands for, falling back to unmarked. */
export function attendanceMark(key) {
  return attendanceMarkByKey[key || ''] || attendanceMarkByKey[''];
}

/**
 * The next mark when somebody taps.
 *
 * Cycling beats a menu at a door: the common case is one tap for present, and
 * a second and third get you to late or absent without opening anything.
 * It wraps back to unmarked so a mistake can be undone by tapping on.
 */
export function nextMark(current) {
  const keys = ATTENDANCE_MARKS.map((m) => m.key);
  // A value the app does not recognise is DISPLAYED as unmarked, so it has
  // to cycle from there too. Reading its own index would send it back to
  // unmarked — where it already appears to be — and the tap would look like
  // it had done nothing.
  const at = Math.max(0, keys.indexOf(attendanceMark(current).key));
  return keys[(at + 1) % keys.length];
}

/**
 * Which of the register let themselves in, as a set of registration IDs.
 *
 * The student's entry is keyed by the ticket they typed; the register is
 * keyed by registration ID. This is the join between them, and the office
 * is the only side that holds both.
 *
 * Matched case-insensitively and without spaces, because the ticket is
 * copied off a printed slip by somebody on a phone — `aihow26 001` and
 * `AIHOW26-001` are the same person, and refusing the first would mean a
 * student sitting in the class recorded as absent.
 *
 * EXPORTED, because the library claims a ticket too. A student who typed
 * `aihow26 014` to get into the class and `AIHOW26-014` to claim their
 * recordings must land in the same place both times, and two functions that
 * agree today will not agree forever.
 */
export const ticketKey = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function joinedRegistrationIds(joins = {}, rows = []) {
  const byTicket = new Map();
  for (const t of Object.keys(joins)) byTicket.set(ticketKey(t), true);

  const out = new Set();
  for (const r of rows) {
    if (r?.ticketId && byTicket.has(ticketKey(r.ticketId))) out.add(r.id);
  }
  return out;
}

/**
 * The day's marks with self-joins folded in.
 *
 * THE OFFICE ALWAYS WINS. A join fills an UNMARKED row only; it never
 * overwrites a mark somebody made. If the register says absent, absent is
 * what it stays — the student having opened the link is not an argument
 * against the person who was in the room.
 *
 * Returning a plain marks map means every reader downstream — the totals,
 * the rate, the printed sheet — keeps working without knowing any of this
 * happened.
 */
export function withSelfJoins(marks = {}, joins = {}, rows = []) {
  const joined = joinedRegistrationIds(joins, rows);
  if (joined.size === 0) return marks;

  const out = { ...marks };
  for (const id of joined) if (!out[id]) out[id] = 'present';
  return out;
}

/**
 * The day's totals.
 *
 * `rows` is who is expected — the register — so somebody nobody has reached
 * yet is counted as unmarked rather than quietly dropped. Marks left behind
 * for people since removed from the course are ignored.
 */
export function attendanceSummary(rows = [], marks = {}) {
  const out = { total: rows.length, present: 0, late: 0, absent: 0, unmarked: 0 };
  for (const r of rows) {
    const key = marks[r.id] || '';
    if (key === 'present') out.present += 1;
    else if (key === 'late') out.late += 1;
    else if (key === 'absent') out.absent += 1;
    else out.unmarked += 1;
  }
  // Late is attendance. Somebody who arrived twenty minutes in was there.
  out.attended = out.present + out.late;
  return out;
}

/**
 * How much of the course one person attended, across the days recorded.
 *
 * `byDay` is a map of date to that day's marks. Only days that have been
 * REGISTERED count towards the denominator: a course of six days with two
 * taken is two days' attendance, not a third of the course, and reporting it
 * as a third would understate everybody until the last day was marked.
 */
export function attendanceRate(byDay = {}, registrationId) {
  const days = Object.keys(byDay).filter((d) => Object.keys(byDay[d] || {}).length > 0);
  if (days.length === 0) return null;

  let attended = 0;
  for (const d of days) {
    const key = byDay[d]?.[registrationId] || '';
    if (key === 'present' || key === 'late') attended += 1;
  }
  return { attended, days: days.length, ratio: attended / days.length };
}

/**
 * How many days can be signature columns before they get too narrow to sign
 * in. Past this the sheet takes one day at a time instead.
 *
 * Six columns across A4 leaves about 22mm each, which is a signature. Ten
 * would leave 13mm, which is an initial at best.
 */
export const MAX_DAY_COLUMNS = 6;

/**
 * How many signature columns can be on the sheet before a mobile number
 * stops fitting as a column of its own.
 *
 * Measured on a rendered A4 sheet rather than guessed. The table is 186mm
 * across; the row number takes 9mm and the ticket ID 26mm, so 151mm is left
 * for the name, the number and the signatures. A number needs 26mm, and a
 * name needs about 34mm before it starts wrapping mid-word.
 *
 *   4 columns  151 - 26 - (4 x 22) = 37mm of name. Fits.
 *   5 columns  151 - 26 - (5 x 22) = 15mm of name. Does not.
 *
 * Past four, the number moves into the name cell instead of squeezing the
 * one thing every row must be able to show. It is on the sheet either way —
 * only the shape changes.
 */
export const MAX_COLUMNS_WITH_PHONE = 4;

/** Has the signing taken so much width that the number needs to move? */
export function phoneFitsAColumn(columns = []) {
  return columns.length <= MAX_COLUMNS_WITH_PHONE;
}

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
