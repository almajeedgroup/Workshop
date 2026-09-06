/**
 * The live side of a class: notes, transcript and handouts.
 *
 *   workshops/{id}/classNotes/{day}       one page the presenter types on
 *   workshops/{id}/classTranscript/{day}  the day's lines, in one document
 *   workshops/{id}/classHandouts/{id}     a link, or a small PDF
 *
 * ALL THREE ARE READ BY STUDENTS, who have no account. The rules allow that
 * only while the class is open — the same switch that publishes the room —
 * so closing a class closes its notes too, and a course that never met
 * online exposes nothing.
 *
 * The transcript is ONE DOCUMENT PER DAY rather than one per line. A class
 * produces a line every few seconds; a document each would be thousands of
 * writes and thousands of reads for anybody following along. It is flushed
 * on a timer instead, so a dropped connection costs seconds of speech rather
 * than the hour.
 */

import {
  collection, doc, addDoc, deleteDoc, getDoc, getDocs, onSnapshot, setDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { handoutRecord } from './classroom.js';

const WORKSHOPS = 'workshops';
export const NOTES = 'classNotes';
export const TRANSCRIPT = 'classTranscript';
export const HANDOUTS = 'classHandouts';

const notesRef = (id, day) => doc(db, WORKSHOPS, id, NOTES, day);
const transcriptRef = (id, day) => doc(db, WORKSHOPS, id, TRANSCRIPT, day);
const handoutsRef = (id) => collection(db, WORKSHOPS, id, HANDOUTS);

/* ------------------------------------------------------------------ *
 * Notes
 * ------------------------------------------------------------------ */

export async function getNotes(workshopId, day) {
  if (!workshopId || !day) return '';
  const snap = await getDoc(notesRef(workshopId, day));
  return snap.exists() ? String(snap.data().text || '') : '';
}

export async function saveNotes(workshopId, day, text) {
  await setDoc(
    notesRef(workshopId, day),
    { text: String(text ?? '').slice(0, 100000), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Live. Calls back whenever the presenter types, for everybody watching. */
export function watchNotes(workshopId, day, onChange, onError = null) {
  if (!workshopId || !day) return () => {};
  return onSnapshot(
    notesRef(workshopId, day),
    (snap) => onChange(snap.exists() ? String(snap.data().text || '') : ''),
    (e) => onError?.(e)
  );
}

/* ------------------------------------------------------------------ *
 * Transcript
 * ------------------------------------------------------------------ */

export async function getTranscript(workshopId, day) {
  if (!workshopId || !day) return [];
  const snap = await getDoc(transcriptRef(workshopId, day));
  return snap.exists() ? (snap.data().lines || []) : [];
}

/** The whole day's lines, replaced. The caller owns the capping. */
export async function saveTranscript(workshopId, day, lines) {
  await setDoc(
    transcriptRef(workshopId, day),
    { lines, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export function watchTranscript(workshopId, day, onChange, onError = null) {
  if (!workshopId || !day) return () => {};
  return onSnapshot(
    transcriptRef(workshopId, day),
    (snap) => onChange(snap.exists() ? (snap.data().lines || []) : []),
    (e) => onError?.(e)
  );
}

export async function clearTranscript(workshopId, day) {
  await setDoc(transcriptRef(workshopId, day), { lines: [], updatedAt: serverTimestamp() });
}

/* ------------------------------------------------------------------ *
 * Handouts
 * ------------------------------------------------------------------ */

export async function addHandout(workshopId, handout) {
  const ref = await addDoc(handoutsRef(workshopId), {
    ...handoutRecord(handout),
    addedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listHandouts(workshopId) {
  if (!workshopId) return [];
  const snap = await getDocs(query(handoutsRef(workshopId), orderBy('addedAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Live, so a handout appears for the class the moment it is added.
 *
 * Ordered by the server's own clock rather than the presenter's, which can be
 * minutes out and would file a new handout in the middle of the list.
 */
export function watchHandouts(workshopId, onChange, onError = null) {
  if (!workshopId) return () => {};
  return onSnapshot(
    query(handoutsRef(workshopId), orderBy('addedAt', 'desc')),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => onError?.(e)
  );
}

export async function removeHandout(workshopId, handoutId) {
  await deleteDoc(doc(db, WORKSHOPS, workshopId, HANDOUTS, handoutId));
}
