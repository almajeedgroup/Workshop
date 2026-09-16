/**
 * The live side of a class: notes, transcript and handouts.
 *
 *   workshops/{id}/classNotes/{day}       one page the presenter types on
 *   workshops/{id}/classTranscript/{day}  the day's lines, in one document
 *   workshops/{id}/classHandouts/{id}     a link, or a small PDF
 *   workshops/{id}/classQuestions/{id}    a question from a student
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
import { questionRecord, sortQueue } from './questions.js';

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

/* ------------------------------------------------------------------ *
 * Questions
 * ------------------------------------------------------------------ *
 *
 *   workshops/{id}/classQuestions/{qid}
 *
 * The one place in a class where a STUDENT writes. Everything else here is
 * written by the presenter and read by the class; this goes the other way,
 * so it is shaped like the registration form: public create while the class
 * is open, capped, with a honeypot, and nothing personal on the record.
 *
 * One document per question rather than one per day. A class produces a
 * handful, not one every few seconds, and the presenter marks them answered
 * one at a time — which a shared document would turn into a write race
 * between the queue and itself.
 */

export const QUESTIONS = 'classQuestions';
const questionsRef = (id) => collection(db, WORKSHOPS, id, QUESTIONS);

/** Public, unauthenticated, and only while the class is open. */
export async function askQuestion(workshopId, { name, text }) {
  const record = questionRecord({ name, text });
  const written = await addDoc(questionsRef(workshopId), { ...record, at: serverTimestamp() });
  return written.id;
}

/**
 * The live queue.
 *
 * Ordered here rather than in the query: `sortQueue` puts answered ones at
 * the bottom, which is two sorts on two fields and a composite index nobody
 * needs for a list this short.
 */
export function watchQuestions(workshopId, onChange, onError = null) {
  if (!workshopId) return () => {};
  return onSnapshot(
    questionsRef(workshopId),
    (snap) => onChange(sortQueue(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (e) => onError?.(e)
  );
}

/** Presenter only. Answered is a state, so the class can see it was dealt with. */
export async function markAnswered(workshopId, questionId, answered = true) {
  await setDoc(
    doc(db, WORKSHOPS, workshopId, QUESTIONS, questionId),
    { state: answered ? 'answered' : 'open' },
    { merge: true }
  );
}

/** Presenter only. For what should not have been asked, not for what was. */
export async function removeQuestion(workshopId, questionId) {
  await deleteDoc(doc(db, WORKSHOPS, workshopId, QUESTIONS, questionId));
}

/** Clearing the queue between days, without deleting the day's record. */
export async function clearAnswered(workshopId) {
  const snap = await getDocs(questionsRef(workshopId));
  const gone = snap.docs.filter((d) => d.data().state === 'answered');
  await Promise.all(gone.map((d) => deleteDoc(d.ref)));
  return gone.length;
}
