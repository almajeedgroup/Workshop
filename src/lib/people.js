/**
 * The same student, seen across every course.
 *
 * Registrations belong to workshops: somebody who comes to three courses is
 * three documents with three ticket IDs, and nothing in the system said they
 * were one person. So the office could not answer the question every school
 * eventually asks — who keeps coming back? — and a returning student got the
 * same blank welcome as a stranger.
 *
 * IDENTITY IS THE SAME ONE THE DUPLICATE CHECK USES. `matchKeys` in
 * dedupe.js already decides when two registrations are the same person:
 * phone, then email, then name with date of birth. Inventing a second answer
 * here would mean the app could think two records were a duplicate on one
 * screen and two different people on another. A name alone is deliberately
 * NOT an identity — there are two Mohammed Khans.
 *
 * Nothing here touches a database. The Console and the board have already
 * fetched every workshop with its registrations; this is a regrouping of
 * what is on the screen.
 */

import { matchKeys } from './dedupe.js';
import { attendanceRate } from './attendance.js';
import { isFreeWorkshop } from './schema.js';

/** How many courses make somebody a returning student. */
export const RETURNING_AT = 2;

/* ------------------------------------------------------------------ *
 * Who is who
 * ------------------------------------------------------------------ */

/**
 * A short, stable id for a person, for use in a URL.
 *
 * NOT the identity key itself. That key is a phone number or an email
 * address, and a profile page whose address carries a student's phone leaks
 * it into browser history, screenshots and anything the link is pasted into.
 * This is a digest of it: stable, so a profile keeps the same address, and
 * meaningless on its own.
 *
 * It is not a secret and is not doing security work — the page is behind the
 * administrator login, which is. It just keeps the number out of the URL bar.
 */
export function profileId(key) {
  const s = String(key ?? '');
  if (!s) return '';
  // FNV-1a, twice over different offsets, for 64 bits without BigInt.
  const fnv = (seed) => {
    let h = seed;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return fnv(0x811c9dc5) + fnv(0x9e3779b9);
}

/**
 * Group registrations into people, across every workshop.
 *
 * Two registrations join when they share ANY identity key, and the grouping
 * is transitive on purpose: a person who gave a phone the first time and an
 * email the second, with both on a third registration, is one person, not
 * three. That is what a union-find does here, and doing it any other way
 * gives an answer that depends on the order the records were read in.
 *
 * Somebody with no phone, no email and no date of birth has nothing reliable
 * to match on. They stay on their own — the same rule the duplicate check
 * follows, and for the same reason: guessing merges two students into one
 * profile, which is worse than missing that they are the same.
 */
export function groupPeople(bundles = []) {
  const parent = new Map();
  const find = (k) => {
    let root = k;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(k) !== root) { const next = parent.get(k); parent.set(k, root); k = next; }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const ensure = (k) => { if (!parent.has(k)) parent.set(k, k); };

  // A row per registration, with the keys it can be recognised by.
  const rows = [];
  for (const { workshop, registrations = [] } of bundles) {
    for (const reg of registrations) {
      const keys = matchKeys(reg);
      rows.push({ workshop, reg, keys });
      keys.forEach(ensure);
      for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
    }
  }

  const byRoot = new Map();
  for (const row of rows) {
    // No usable identity: this registration is its own person, filed under a
    // key nothing else can ever join.
    const root = row.keys.length ? find(row.keys[0]) : `reg:${row.workshop.id}:${row.reg.id}`;
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(row);
  }

  const people = [];
  for (const [root, entries] of byRoot) {
    entries.sort((a, b) =>
      String(b.workshop.startDate || '').localeCompare(String(a.workshop.startDate || ''))
      || String(a.workshop.title || '').localeCompare(String(b.workshop.title || '')));
    people.push(person(root, entries));
  }
  people.sort((a, b) =>
    courseCount(b) - courseCount(a) || a.name.localeCompare(b.name));
  return people;
}

/** The most complete version of a detail across every registration. */
function best(entries, field) {
  for (const { reg } of entries) {
    const v = String(reg[field] ?? '').trim();
    if (v) return v;
  }
  return '';
}

function person(key, entries) {
  // The newest registration's spelling of the name leads: people correct
  // their own name over time, and the latest is the one they gave last.
  const name = best(entries, 'name') || '(no name)';
  return {
    key,
    id: profileId(key),
    name,
    whatsapp: best(entries, 'whatsapp'),
    email: best(entries, 'email'),
    dob: best(entries, 'dob'),
    area: best(entries, 'area'),
    qualification: best(entries, 'qualification'),
    courseName: best(entries, 'courseName'),
    courses: entries.map(({ workshop, reg }) => ({ workshop, reg })),
    /** Whether the identity is reliable, or this row simply had nothing to match on. */
    identified: !String(key).startsWith('reg:'),
  };
}

/* ------------------------------------------------------------------ *
 * Registered, versus actually there
 * ------------------------------------------------------------------ */

/**
 * How many of a person's courses they were actually marked present on.
 *
 * `marksByWorkshop` is a map of workshop ID to that course's register. A
 * course whose register was NEVER TAKEN cannot say whether anybody attended
 * it, so it counts towards neither side — `null`, not zero. Counting an
 * untaken register as absence would say a student skipped a course when the
 * truth is that nobody wrote anything down.
 */
export function attendanceAcross(person, marksByWorkshop = {}) {
  const perCourse = [];
  // Counted per COURSE, not per registration: a duplicate registration on
  // one course must not count as two attendances.
  const attendedAt = new Set();
  const recordedAt = new Set();

  for (const { workshop, reg } of person.courses) {
    const rate = attendanceRate(marksByWorkshop[workshop.id] || {}, reg.id);
    perCourse.push({ workshop, reg, rate });
    if (!rate) continue;
    recordedAt.add(workshop.id);
    if (rate.attended > 0) attendedAt.add(workshop.id);
  }
  return {
    attended: attendedAt.size,
    recorded: recordedAt.size,
    unrecorded: courseCount(person) - recordedAt.size,
    perCourse,
  };
}

/**
 * The students worth a profile.
 *
 * `basis` is 'registered' or 'attended', and the difference is real: this
 * office does not take a register on every course, so counting only marked
 * attendance would hide most returning students, while counting only
 * registrations would include somebody who signed up twice and came once.
 * Both questions are legitimate, so both are askable.
 */
export function returningPeople(people = [], { min = RETURNING_AT, basis = 'registered', marksByWorkshop = {} } = {}) {
  if (basis === 'attended') {
    return people
      .map((p) => ({ ...p, tally: attendanceAcross(p, marksByWorkshop) }))
      .filter((p) => p.tally.attended >= min);
  }
  return people.filter((p) => courseCount(p) >= min);
}

/**
 * How many DIFFERENT courses this person has been on.
 *
 * Not how many registrations they have. The team pastes WhatsApp replies in
 * batches and the same candidate very easily arrives twice, which is a
 * duplicate registration on one course — two tickets, one visit. Counting
 * rows instead of courses would put that person on the returning-students
 * list, which is the one list whose entire meaning is "came back".
 */
export function courseCount(person) {
  return new Set(person.courses.map(({ workshop }) => workshop.id)).size;
}

/** Find one person by the id in a URL. */
export function findPerson(people = [], id) {
  return people.find((p) => p.id === id) || null;
}

/* ------------------------------------------------------------------ *
 * Reading a profile
 * ------------------------------------------------------------------ */

/** What the profile says at the top. */
export function profileFacts(person, tally) {
  const out = [
    ['Courses', String(courseCount(person))],
  ];
  if (tally) {
    out.push(['Attended', tally.recorded
      ? `${tally.attended} of ${tally.recorded} with a register taken`
      : 'no registers taken yet']);
  }
  if (person.whatsapp) out.push(['WhatsApp', person.whatsapp]);
  if (person.email) out.push(['Email', person.email]);
  if (person.dob) out.push(['Date of birth', person.dob]);
  if (person.area) out.push(['Area', person.area]);
  if (person.qualification) out.push(['Qualification', person.qualification]);
  if (person.courseName) out.push(['Course or stream', person.courseName]);
  return out;
}

/** What a person paid, across everything they have been on. */
export function paidAcross(person) {
  let total = 0;
  let owing = 0;
  for (const { workshop, reg } of person.courses) {
    // A free course cannot be owed. Without this, somebody on one paid course
    // and two free ones was reported as owing on two of them, which is how a
    // student gets chased for money that was never asked for.
    if (isFreeWorkshop(workshop)) continue;
    const amount = Number(reg.amountPaid) || 0;
    if (reg.paymentStatus === 'Paid') total += amount;
    else if (reg.paymentStatus !== 'Waived') owing += 1;
  }
  return { total, owing };
}
