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

import { matchKeys, splitDuplicates } from './dedupe.js';

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
 * Who comes across, and who needs a second look.
 *
 * REPORTS, IT DOES NOT DECIDE. The first version of this quietly withheld
 * anybody who matched somebody already registered, which sounds safe and is
 * not: this office types a shared contact — an office number, a parent's
 * phone, one email between siblings — into the records of students who have
 * none of their own. Four different people can carry one number, and they
 * were all dropped from the list with a message saying they were already
 * registered, which was untrue and impossible to argue with.
 *
 * So a match now UNTICKS a row and says what it matched, instead of removing
 * it. `dedupe.js` has always worked this way for pasted registrations — "it
 * reports, and the operator decides — two cousins really can share a phone" —
 * and there was no reason for this screen to be the exception.
 *
 * Returns:
 *   bring    — matched nothing. Ticked by default.
 *   already  — matched something, with what and who. Shown, unticked.
 *              `here` distinguishes "is on this course" from "is listed
 *              twice on that one", which are different problems and were
 *              being reported with the same misleading sentence.
 */
export function carryPlan(sourceRegs = [], targetRegs = []) {
  const { unique, duplicates } = splitDuplicates(sourceRegs, targetRegs);
  const onThisCourse = new Set(targetRegs);
  return {
    bring: unique,
    already: duplicates.map(({ row, against, reason }) => ({
      reg: row,
      against,
      reason,
      here: onThisCourse.has(against),
    })),
  };
}

/**
 * Every row the panel offers, in order: the clear ones, then the ones with a
 * question against them.
 *
 * One list rather than two, because a name somebody is looking for has to be
 * findable whichever bucket it landed in.
 */
export function offered(plan) {
  return [
    ...(plan?.bring || []).map((reg) => ({ reg, match: null })),
    ...(plan?.already || []).map((m) => ({ reg: m.reg, match: m })),
  ];
}

/** Why a row is unticked, in words. */
export function describeMatch(match) {
  if (!match) return '';
  const other = String(match.against?.name || '').trim();
  const where = match.here ? 'already on this course' : 'listed earlier on that course';
  return other ? `${match.reason} as ${other} — ${where}` : `${match.reason} — ${where}`;
}

/**
 * The rows to write, ready for `addRegistrations`.
 *
 * Takes the registrations chosen rather than the whole plan, so there is one
 * obvious place the selection is applied and no way to write the full list
 * by passing the wrong thing.
 */
export function carryRows(chosen = [], source, options) {
  return chosen.map((reg) => carriedRegistration(reg, source, options));
}

/* ------------------------------------------------------------------ *
 * Choosing which of them come
 * ------------------------------------------------------------------ */

/**
 * Everybody who could come, ticked.
 *
 * Ticked rather than empty, because bringing a whole course forward is the
 * common case and the reason the button exists. Untick the two who are not
 * continuing; do not tick eighteen who are.
 */
export function pickAll(plan) {
  return new Set((plan?.bring || []).map((r) => r.id));
}

/** Everybody the panel offers, matches included. For "select all". */
export function pickEveryone(plan) {
  return new Set(offered(plan).map(({ reg }) => reg.id));
}

/** Ticking or unticking one. Returns a new set — nothing is mutated. */
export function togglePick(picked, id) {
  const next = new Set(picked);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * The ones actually chosen, in the order they appear.
 *
 * Filtered from `plan.bring` rather than read out of the set, so a stale id —
 * left behind when the source course was changed — cannot conjure a student
 * who is not on the list any more.
 */
export function chosenFrom(plan, picked) {
  const want = picked instanceof Set ? picked : new Set(picked || []);
  return offered(plan).filter(({ reg }) => want.has(reg.id)).map(({ reg }) => reg);
}

/** Narrow a long list to what somebody is looking for. */
export function filterOffered(plan, query) {
  const rows = offered(plan);
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(({ reg }) =>
    `${reg.name} ${reg.whatsapp || ''} ${reg.email || ''} ${reg.area || ''} ${reg.ticketId || ''}`
      .toLowerCase().includes(q));
}

/**
 * What the panel says under the row.
 *
 * The count is the point. "Bring students" is a leap of faith; "Bring 18
 * students" is a decision, and "all 20 are already here" saves the press
 * altogether. Once some are unticked it has to say so too, or the button's
 * number and the list on screen disagree with no explanation.
 */
export function describePlan(plan, seatsLeft = null, picked = null) {
  const rows = offered(plan);
  const total = rows.length;
  if (total === 0) return 'That course has no registrations to bring.';

  const want = picked
    ? (picked instanceof Set ? picked : new Set(picked))
    : new Set((plan?.bring || []).map((r) => r.id));
  const n = rows.filter(({ reg }) => want.has(reg.id)).length;

  // Only the flagged rows STILL UNTICKED are worth mentioning. Saying "4
  // match somebody already registered" while all four are ticked contradicts
  // the list underneath it.
  const held = rows.filter(({ reg, match }) => match && !want.has(reg.id)).length;

  const parts = [];
  if (n === 0) parts.push('Nobody chosen yet');
  else if (n === total) parts.push(`all ${n} would be added`);
  else parts.push(`${n} of ${total} chosen`);

  if (held) {
    parts.push(`${held} left unticked — ${held === 1 ? 'it matches' : 'they match'} somebody already registered`);
  }
  if (n > 0 && seatsLeft !== null && n > seatsLeft) {
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
