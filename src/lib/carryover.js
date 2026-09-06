/**
 * Bringing a previous course's students onto the next one.
 *
 * The same twenty people come back term after term, and until now enrolling
 * them again meant finding the old course, reading twenty names off it, and
 * typing them into the new one — an afternoon of work that produces exactly
 * the register that already existed.
 *
 * WHAT COMES ACROSS IS THE PERSON, NOT THE ENROLMENT. Their name, how to
 * reach them, what they study — those are facts about somebody and do not
 * change between courses. Their ticket number, what they paid, whether they
 * paid, the notes somebody wrote about them last term and their attendance
 * are facts about a course they have finished, and carrying those forward
 * would open the new course with twenty people already marked Paid for a fee
 * nobody has collected.
 *
 * Nothing here writes anything. It decides who comes and what they arrive
 * with, so both can be shown before the button is pressed and tested without
 * a database.
 */

import { matchKeys } from './dedupe.js';

/**
 * The fields that belong to the person rather than to the course.
 *
 * Read as an allow-list on purpose. A deny-list would carry every field
 * added later by default, which is how a payment reference from last term
 * ends up on a new receipt.
 */
export const CARRIED_FIELDS = [
  'name', 'dob', 'qualification', 'courseName', 'whatsapp', 'email', 'area',
  'idRole', 'bloodGroup', 'emergencyContact',
];

/**
 * The fields deliberately left behind, and why. Not used by the code — it is
 * here so the next person to add a field knows which list to think about.
 *
 *   ticketId       a number issued by the OLD course
 *   paymentStatus  a new course is a new fee
 *   amountPaid     ditto
 *   paymentMode    ditto
 *   paymentRef     ditto
 *   notes          written about a course that has finished
 *   idValidUntil   dated for the old course
 */

/** One registration, rewritten as a new one on another course. */
export function carriedRegistration(reg, source, { note = true } = {}) {
  const out = { paymentStatus: 'Pending' };
  for (const key of CARRIED_FIELDS) {
    const v = reg?.[key];
    if (v !== undefined && v !== null && v !== '') out[key] = v;
  }
  // Where they came from, in the one field meant for it. Six months later
  // this is the only thing that says why somebody appeared on a register
  // nobody remembers adding them to.
  if (note && source?.title) {
    out.notes = `Brought forward from ${source.title}`.slice(0, 300);
  }
  return out;
}

/**
 * Who would come across, and who is already here.
 *
 * Matched with the same `matchKeys` the duplicate check and the student
 * profiles use — phone, then email, then name with date of birth. A
 * registration with none of those has nothing to match on, so it is brought
 * across rather than silently skipped: the office can delete a duplicate,
 * but cannot add somebody they were never told about.
 *
 * Somebody appearing twice on the source course arrives once.
 */
export function carryPlan(sourceRegs = [], targetRegs = []) {
  const here = new Set();
  for (const reg of targetRegs) for (const key of matchKeys(reg)) here.add(key);

  const bring = [];
  const already = [];
  const seen = new Set();

  for (const reg of sourceRegs) {
    const keys = matchKeys(reg);
    if (keys.some((k) => here.has(k))) { already.push(reg); continue; }
    if (keys.length && keys.some((k) => seen.has(k))) { already.push(reg); continue; }
    keys.forEach((k) => seen.add(k));
    bring.push(reg);
  }
  return { bring, already };
}

/** The rows to write, ready for `addRegistrations`. */
export function carryRows(plan, source, options) {
  return plan.bring.map((reg) => carriedRegistration(reg, source, options));
}

/**
 * What the button should say before it is pressed.
 *
 * The count is the point. "Bring students" is a leap of faith; "Bring 18
 * students" is a decision, and "all 20 are already here" saves the press
 * altogether.
 */
export function describePlan(plan, seatsLeft = null) {
  const n = plan.bring.length;
  const dup = plan.already.length;
  if (n === 0 && dup === 0) return 'That course has no registrations to bring.';
  if (n === 0) return `Everybody on that course — all ${dup} — is already registered here.`;

  const parts = [`${n} student${n === 1 ? '' : 's'} would be added`];
  if (dup) parts.push(`${dup} already here`);
  if (seatsLeft !== null && n > seatsLeft) {
    parts.push(seatsLeft <= 0
      ? 'this course is already full'
      : `only ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left`);
  }
  return `${parts.join(' · ')}.`;
}

/**
 * The courses worth offering as a source, newest first.
 *
 * Never this one — bringing a course's students onto itself would duplicate
 * every one of them — and never a course with nobody on it.
 */
export function carrySources(bundles = [], targetId) {
  return bundles
    .filter(({ workshop, registrations }) => workshop.id !== targetId && registrations.length > 0)
    .sort((a, b) =>
      String(b.workshop.startDate || '').localeCompare(String(a.workshop.startDate || ''))
      || String(a.workshop.title || '').localeCompare(String(b.workshop.title || '')));
}
