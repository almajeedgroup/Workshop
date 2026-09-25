/**
 * Students: who they are, and which courses they may open.
 *
 *   workshops/{id}/tickets/{ticketId}    every ticket this course issued
 *   workshops/{id}/claims/{ticketId}     who claimed it — the lock
 *   workshops/{id}/members/{uid}         who may read this course's library
 *   students/{uid}/courses/{id}          the student's own list of courses
 *
 * ── WHY FOUR COLLECTIONS FOR ONE IDEA ────────────────────────────────────
 *
 * Because Firestore rules cannot run a query. They can ask whether a
 * document exists at an exact path, and nothing else. So every question the
 * rules must answer has to BE a path:
 *
 *   "was this ticket ever issued?"      → tickets/{ticketId}
 *   "has anybody already claimed it?"   → claims/{ticketId}
 *   "may this account read the shelf?"  → members/{uid}
 *
 * The fourth is not a rule at all. It is the student's own list, because
 * "which courses am I in" is a query no rule can express either, and a
 * collection-group search would need an index and a rule of its own for a
 * handful of documents.
 *
 * ── WHAT A CLAIM PROVES, AND WHAT IT DOES NOT ────────────────────────────
 *
 * It proves a real, Google-verified account now holds a ticket that this
 * course really issued, and that NOBODY ELSE holds it — the claim is
 * create-only, so the first one wins and the second is refused. It does not
 * prove the account belongs to the person the ticket was printed for.
 * Ticket numbers run in sequence, so somebody who has one can guess another.
 *
 * Without a server that is as far as it goes, and it is meaningfully
 * further than nothing: the theft costs an identifiable account, it is
 * exclusive so the real student notices when their ticket is taken, and it
 * is revocable. The office sees a name and an email beside every claim.
 */

import {
  collection, doc, deleteDoc, getDoc, getDocs, setDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { ticketKey } from './attendance.js';

const WORKSHOPS = 'workshops';
const STUDENTS = 'students';
export const TICKETS = 'tickets';
export const CLAIMS = 'claims';
export const MEMBERS = 'members';
export const COURSES = 'courses';

/**
 * The document ID a ticket becomes.
 *
 * The SAME normalisation the attendance register uses, deliberately
 * imported rather than repeated: a student who typed `aihow26 014` to get
 * into the class and `AIHOW26-014` to claim their library must end up in
 * both places, and two functions that agree today will not agree forever.
 */
export const ticketDocId = (ticketId) => ticketKey(ticketId);

/* ------------------------------------------------------------------ *
 * The index — administrator side
 * ------------------------------------------------------------------ */

/**
 * Publish which tickets a course issued, so the rules can check a claim.
 *
 * NOTHING PERSONAL GOES IN. The document is its ID and a timestamp; the name
 * and number that the ticket belongs to stay in `registrations`, which is
 * administrator-only and stays that way. A reader who somehow got this
 * collection would learn the ticket numbers of a course, which run in
 * sequence and are therefore already guessable.
 *
 * Idempotent, so running it twice is free and running it after adding ten
 * people adds ten documents.
 */
export async function syncTicketIndex(workshopId, registrations = []) {
  if (!workshopId) return { added: 0, total: 0 };

  const wanted = new Set();
  for (const r of registrations) {
    const id = ticketDocId(r?.ticketId);
    if (id) wanted.add(id);
  }

  const existing = new Set((await getDocs(ticketsRef(workshopId))).docs.map((d) => d.id));
  const missing = [...wanted].filter((id) => !existing.has(id));

  for (let i = 0; i < missing.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of missing.slice(i, i + 450)) {
      batch.set(doc(ticketsRef(workshopId), id), { at: serverTimestamp() });
    }
    await batch.commit();
  }
  return { added: missing.length, total: wanted.size };
}

const ticketsRef = (workshopId) => collection(db, WORKSHOPS, workshopId, TICKETS);
const claimsRef = (workshopId) => collection(db, WORKSHOPS, workshopId, CLAIMS);
const membersRef = (workshopId) => collection(db, WORKSHOPS, workshopId, MEMBERS);

/** Whether a course has published its tickets yet. Administrator only. */
export async function ticketIndexSize(workshopId) {
  if (!workshopId) return 0;
  return (await getDocs(ticketsRef(workshopId))).size;
}

/* ------------------------------------------------------------------ *
 * Claiming — student side
 * ------------------------------------------------------------------ */

/**
 * Claim a ticket, in three writes that must happen in this order.
 *
 * NOT A BATCH, and that is the whole design. Rules evaluate a batch against
 * the state BEFORE it, so a rule on `members` saying "only if the claim
 * exists and is yours" can never be satisfied by a batch that creates both
 * at once. Written in sequence, each write is checked against a world in
 * which the previous one has landed:
 *
 *   1. claims/{ticket}  — create-only. This is the lock. If somebody else
 *                         already holds this ticket, it fails here and
 *                         nothing else happens.
 *   2. members/{uid}    — allowed only because step 1 exists and names you.
 *                         This is the document the library rule reads.
 *   3. students/{uid}/… — your own list. Not a permission; a convenience.
 *
 * A failure after step 1 leaves the ticket locked to an account that has no
 * membership. That is recoverable — running this again with the same
 * account re-runs steps 2 and 3 — and it is the safe direction to fail,
 * because the alternative is a membership nobody holds the lock for.
 */
export async function claimTicket(workshopId, ticketId, user) {
  const ticket = ticketDocId(ticketId);
  if (!workshopId) throw new Error('No course was named.');
  if (!ticket) throw new Error('Type the ticket ID printed on your ticket.');
  if (!user?.uid) throw new Error('Sign in before claiming a ticket.');

  const claim = doc(claimsRef(workshopId), ticket);
  const held = await getDoc(claim).catch(() => null);
  if (held?.exists() && held.data().uid !== user.uid) {
    throw new Error('That ticket has already been claimed by another account. '
      + 'If it is yours, tell the office and they can release it.');
  }

  if (!held?.exists()) {
    // The rules refuse this if the ticket was never issued, or if somebody
    // else got here first between the read above and this write.
    await setDoc(claim, { uid: user.uid, at: serverTimestamp() });
  }

  await setDoc(doc(membersRef(workshopId), user.uid), {
    ticketId: ticket,
    name: String(user.displayName || '').slice(0, 120),
    email: String(user.email || '').slice(0, 200),
    at: serverTimestamp(),
  });

  await setDoc(doc(db, STUDENTS, user.uid, COURSES, workshopId), {
    ticketId: ticket,
    at: serverTimestamp(),
  });

  return ticket;
}

/** The courses this account has claimed a ticket for. */
export async function listMyCourses(uid) {
  if (!uid) return [];
  const snap = await getDocs(collection(db, STUDENTS, uid, COURSES));
  return snap.docs.map((d) => ({ workshopId: d.id, ...d.data() }));
}

/**
 * Whether this account may read one course's shelf.
 *
 * Asked of the same document the rules read, so the page and the server
 * agree. A page that decided for itself would eventually show a shelf the
 * database then refused to fill.
 */
export async function getMembership(workshopId, uid) {
  if (!workshopId || !uid) return null;
  const snap = await getDoc(doc(membersRef(workshopId), uid)).catch(() => null);
  return snap?.exists() ? { uid, ...snap.data() } : null;
}

/* ------------------------------------------------------------------ *
 * Who is in — administrator side
 * ------------------------------------------------------------------ */

/** Everybody who has claimed a ticket for this course. */
export async function listMembers(workshopId) {
  if (!workshopId) return [];
  const snap = await getDocs(membersRef(workshopId));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * Take an account's access away, and free the ticket for the right person.
 *
 * All three go, and the claim matters most: leaving it would lock the real
 * student out of a ticket that is theirs, which is the exact situation this
 * exists to fix. The student's own list is cleared too, so their dashboard
 * stops offering a course it can no longer open.
 */
export async function revokeMember(workshopId, member) {
  if (!workshopId || !member?.uid) return;
  await deleteDoc(doc(membersRef(workshopId), member.uid));
  if (member.ticketId) {
    await deleteDoc(doc(claimsRef(workshopId), ticketDocId(member.ticketId))).catch(() => {});
  }
  await deleteDoc(doc(db, STUDENTS, member.uid, COURSES, workshopId)).catch(() => {});
}
