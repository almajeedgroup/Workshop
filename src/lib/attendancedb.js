/**
 * The attendance register.
 *
 * ONE DOCUMENT PER DAY, holding a map of registration ID to mark:
 *
 *   workshops/{workshopId}/attendance/{YYYY-MM-DD}
 *     { marks: { <registrationId>: 'present' | 'late' | 'absent' } }
 *
 * The obvious alternative is a document per person per day, and it is much
 * worse: a course of forty over six days becomes 240 documents to write and
 * 240 to read back, against six either way. Taking a register is the one task
 * here done standing up with a phone, so it is the one that must not be slow.
 *
 * A map is safe at this size — forty short keys is nothing against
 * Firestore's 1 MiB per document, and a course would need thousands of
 * registrants to come close.
 *
 * Marks are written one field at a time with `updateDoc` on a nested path, so
 * two people taking the register on different phones do not overwrite each
 * other's work. Writing the whole map back would mean the second save undoing
 * the first.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteField, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';

export const ATTENDANCE = 'attendance';

/**
 * Where a student's own "I am here" goes.
 *
 *   workshops/{workshopId}/attendance/{YYYY-MM-DD}/joins/{ticketId}
 *     { at: <server timestamp> }
 *
 * ── WHY A SUBCOLLECTION AND NOT ANOTHER MAP ──────────────────────────────
 * The office's marks are a map keyed by REGISTRATION id. A student does not
 * know their registration id — it is a Firestore auto-id — and cannot look
 * one up, because registrations are administrator-only and always will be.
 * What they have is the ticket number printed on their ticket.
 *
 * So the student's entry is keyed by TICKET, in a place of its own. That is
 * not a workaround; it is what makes the write safe to allow. A document
 * whose id IS the ticket can be secured by a create-only rule on the path:
 * one document per ticket per day, no update, no delete, and no way to
 * reach the office's marks or anybody else's entry. A shared map could not
 * be constrained like that.
 *
 * The register resolves ticket to registration when it reads, because the
 * office has both. An explicit mark always wins over a join — they live in
 * different places, so the office can never be overwritten by a student.
 */
export const JOINS = 'joins';

function joinsRef(workshopId, date) {
  return collection(db, 'workshops', workshopId, ATTENDANCE, date, JOINS);
}

function dayRef(workshopId, date) {
  return doc(db, 'workshops', workshopId, ATTENDANCE, date);
}

/** One day's marks, as a map of registration ID to mark. */
export async function getDayMarks(workshopId, date) {
  if (!workshopId || !date) return {};
  const snap = await getDoc(dayRef(workshopId, date));
  return snap.exists() ? (snap.data().marks || {}) : {};
}

/**
 * Every day recorded for a workshop, as a map of date to that day's marks.
 * Read once when the register or a report is opened.
 */
export async function getAllMarks(workshopId) {
  if (!workshopId) return {};
  const snap = await getDocs(collection(db, 'workshops', workshopId, ATTENDANCE));
  const out = {};
  snap.forEach((d) => { out[d.id] = d.data().marks || {}; });
  return out;
}

/**
 * Set one person's mark for one day.
 *
 * An empty mark REMOVES the field rather than storing an empty string —
 * unmarked has to be genuinely absent from the map, or "nobody got to them"
 * becomes indistinguishable from a mark that happens to be blank.
 */
export async function setMark(workshopId, date, registrationId, mark) {
  const ref = dayRef(workshopId, date);
  const value = mark ? String(mark) : deleteField();
  try {
    await updateDoc(ref, { [`marks.${registrationId}`]: value });
  } catch {
    // The day has no document yet. `updateDoc` refuses to create one, so the
    // first mark of the day creates it — and only the first pays for this.
    await setDoc(ref, { marks: mark ? { [registrationId]: String(mark) } : {} }, { merge: true });
  }
}

/**
 * Mark several people at once — "everyone present", then correct the few.
 *
 * One write for the lot. Forty separate writes to the same document would be
 * forty round trips and would rate-limit against Firestore's one-write-per-
 * second-per-document guidance.
 */
export async function setMarks(workshopId, date, marks = {}) {
  const clean = {};
  for (const [id, mark] of Object.entries(marks)) {
    if (mark) clean[id] = String(mark);
  }
  await setDoc(dayRef(workshopId, date), { marks: clean }, { merge: false });
}

/**
 * Drop one person's marks from every day.
 *
 * Their registration is gone, so a mark keyed to it is a row about nobody.
 * It carries no personal detail — an ID and the word "present" — so this is
 * tidiness rather than a leak, and it must never block the deletion that
 * prompted it.
 */
export async function removeMarks(workshopId, registrationId) {
  if (!workshopId || !registrationId) return;
  try {
    const snap = await getDocs(collection(db, 'workshops', workshopId, ATTENDANCE));
    await Promise.all(snap.docs
      .filter((d) => (d.data().marks || {})[registrationId] !== undefined)
      .map((d) => updateDoc(d.ref, { [`marks.${registrationId}`]: deleteField() })));
  } catch {
    /* A stale mark must not stop somebody being removed from the course. */
  }
}


/**
 * A student says they are here, from the class link.
 *
 * Create-only by rule, so joining twice is not an error and a second call
 * cannot change the first — it simply fails and there is nothing to do
 * about it, which is why the failure is swallowed. Being in the class
 * matters more than recording that you are, so this never blocks the join.
 */
export async function recordSelfJoin(workshopId, date, ticketId) {
  const ticket = String(ticketId || '').trim().toUpperCase();
  if (!workshopId || !date || !ticket) return false;
  try {
    await setDoc(doc(joinsRef(workshopId, date), ticket), { at: serverTimestamp() });
    return true;
  } catch {
    // Already joined today, or the class closed between opening the page
    // and pressing the button. Neither is worth a message.
    return false;
  }
}

/** Who let themselves in on one day, as a map of ticket ID to when. */
export async function getDayJoins(workshopId, date) {
  if (!workshopId || !date) return {};
  const snap = await getDocs(joinsRef(workshopId, date));
  const out = {};
  snap.forEach((d) => { out[d.id] = d.data().at?.toMillis?.() ?? null; });
  return out;
}

/**
 * Every day's joins, as a map of date to that day's tickets.
 *
 * One read per day rather than a collection group: a course runs for days,
 * not months, and a collection group query would need its own index and its
 * own rule for a handful of documents.
 */
export async function getAllJoins(workshopId, dates = []) {
  if (!workshopId || !dates.length) return {};
  const pairs = await Promise.all(
    dates.map(async (d) => [d, await getDayJoins(workshopId, d)]),
  );
  return Object.fromEntries(pairs);
}
