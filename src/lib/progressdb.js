/**
 * What a student has watched.
 *
 *   students/{uid}/progress/{workshopId}
 *     { done: { <itemId>: true }, last: <itemId>, at: <server time> }
 *
 * ── WHOSE RECORD THIS IS ─────────────────────────────────────────────────
 *
 * The student's, and nobody else's. It sits under `students/{uid}` beside
 * their own list of courses rather than under the workshop, because that is
 * what makes the rule one line: you may read and write your own, full stop.
 * Under the workshop it would need a rule that lets a member write one
 * document of a collection the whole cohort shares, and every bug in that
 * rule is somebody editing somebody else's record.
 *
 * It is deliberately NOT readable by the office. Progress is not attendance
 * — attendance is a register somebody takes, and this is a reading habit.
 * Nothing in the app needs it, so nothing in the app can see it.
 *
 * ── A MAP, NOT A DOCUMENT PER ITEM ───────────────────────────────────────
 *
 * One document per course, holding a map. A shelf is a handful of items and
 * a course is a handful of days; a document each would be a read per row to
 * draw one progress bar. The same reasoning as the attendance register, and
 * the same cap applies — a map this small cannot approach Firestore's
 * ceiling.
 */

import { doc, getDoc, getDocs, collection, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

const STUDENTS = 'students';
export const PROGRESS = 'progress';

const progressRef = (uid, workshopId) => doc(db, STUDENTS, uid, PROGRESS, workshopId);

/** What this student has done on one course. Never throws; absent is empty. */
export async function getProgress(uid, workshopId) {
  if (!uid || !workshopId) return { done: {}, last: '' };
  const snap = await getDoc(progressRef(uid, workshopId)).catch(() => null);
  if (!snap?.exists()) return { done: {}, last: '' };
  const data = snap.data();
  return {
    done: data.done && typeof data.done === 'object' ? data.done : {},
    last: String(data.last || ''),
  };
}

/** Every course this student has progress on, as a map of id to progress. */
export async function getAllProgress(uid) {
  if (!uid) return {};
  const snap = await getDocs(collection(db, STUDENTS, uid, PROGRESS)).catch(() => null);
  const out = {};
  snap?.forEach((d) => {
    const data = d.data();
    out[d.id] = {
      done: data.done && typeof data.done === 'object' ? data.done : {},
      last: String(data.last || ''),
      at: data.at?.toMillis?.() ?? 0,
    };
  });
  return out;
}

/**
 * Remember that this item was opened.
 *
 * Merged, not written whole: two tabs open on the same course would
 * otherwise have the second one erase the first one's ticks. `last` is what
 * "continue where you left off" reads, and it is set on OPENING rather than
 * on finishing — somebody who stopped halfway through a recording wants to
 * come back to that one, not to the next.
 */
export async function markOpened(uid, workshopId, itemId) {
  if (!uid || !workshopId || !itemId) return;
  await setDoc(
    progressRef(uid, workshopId),
    { last: itemId, at: serverTimestamp() },
    { merge: true },
  ).catch(() => {
    /* Progress is a convenience. Losing a tick must never stop somebody
       watching the thing they came for. */
  });
}

/** Tick an item off, or un-tick it. */
export async function setDone(uid, workshopId, itemId, done = true) {
  if (!uid || !workshopId || !itemId) return;
  await setDoc(
    progressRef(uid, workshopId),
    { done: { [itemId]: done ? true : deleteField() }, at: serverTimestamp() },
    { merge: true },
  ).catch(() => {});
}
