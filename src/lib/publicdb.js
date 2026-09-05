/**
 * The public side of registration.
 *
 * Two collections, both reachable without an account, both deliberately narrow:
 *
 *   publicWorkshops/{workshopId}   public get   · admin write
 *   registrationRequests/{id}      public CREATE only · admin read/write
 *
 * WHY A MIRROR. The workshop document carries internal notes and counters that
 * the public has no business reading, and Firestore rules are all-or-nothing
 * per document — you cannot expose half of one. So the registration page reads
 * a mirror built from a whitelist: what a poster would say, and nothing else.
 *
 * WHY REQUESTS ARE NOT REGISTRATIONS. Anyone can submit this form. A submission
 * is an application, held in its own collection, which nobody can read back —
 * not even the person who sent it. An administrator reviews it and accepts it,
 * and only then does it become a registration with a ticket. That keeps the
 * register clean and keeps ticket issuing manual, which is how it was asked for.
 */

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { ISSUER, isFreeWorkshop, workshopFee, associationLine } from './schema.js';

const PUBLIC_WORKSHOPS = 'publicWorkshops';
const REQUESTS = 'registrationRequests';

/* ------------------------------------------------------------------ *
 * The public mirror
 * ------------------------------------------------------------------ */

/** Whitelist. Only these fields are ever exposed publicly. */
export function publicWorkshopRecord(workshop) {
  const str = (v) => (v === undefined || v === null ? '' : String(v));
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    title: str(workshop.title),
    code: str(workshop.code),
    startDate: str(workshop.startDate),
    endDate: str(workshop.endDate),
    time: str(workshop.time),
    durationHours: num(workshop.durationHours),
    mode: str(workshop.mode),
    venue: str(workshop.venue),
    presentedBy: str(workshop.presentedBy),
    // Resolved here rather than on the page: the public site must credit the
    // school on a workshop whose collaborators were never filled in.
    collaborators: associationLine(workshop),
    audience: str(workshop.audience),
    topics: str(workshop.topics),
    seatLimit: num(workshop.seatLimit),
    feeType: isFreeWorkshop(workshop) ? 'Free' : 'Paid',
    feeAmount: workshopFee(workshop),
    contactNumbers: Array.isArray(workshop.contactNumbers) ? workshop.contactNumbers.filter(Boolean) : [],
    paymentUpi: str(workshop.paymentUpi) || ISSUER.upiId || '',
    paymentQrUrl: str(workshop.paymentQrUrl) || ISSUER.paymentQrImage || '',
    registrationOpen: str(workshop.registrationOpen) === 'Open',
  };
}

/** Called whenever a workshop is written, so the two never drift apart. */
export async function syncPublicWorkshop(workshopId, workshop) {
  await setDoc(
    doc(db, PUBLIC_WORKSHOPS, workshopId),
    { ...publicWorkshopRecord(workshop), updatedAt: serverTimestamp() },
    { merge: false }
  );
}

export async function removePublicWorkshop(workshopId) {
  try {
    await deleteDoc(doc(db, PUBLIC_WORKSHOPS, workshopId));
  } catch {
    /* The mirror going stale must not block deleting the workshop itself. */
  }
}

/**
 * Publish, or withdraw, the registration page for a workshop — in one action.
 *
 * Writes the mirror and flips the workshop's own flag together. Before this,
 * a workshop created earlier had no mirror at all, so its registration link
 * read "not valid", and turning registration on meant finding a dropdown on
 * the edit screen. Neither is something anybody should have to know.
 */
export async function setRegistrationOpen(workshopId, workshop, open) {
  const registrationOpen = open ? 'Open' : 'Closed';
  await setDoc(doc(db, 'workshops', workshopId), { registrationOpen }, { merge: true });
  await syncPublicWorkshop(workshopId, { ...workshop, registrationOpen });
  return registrationOpen;
}

/** Public. What the registration page shows. */
export async function getPublicWorkshop(workshopId) {
  if (!workshopId) return null;
  const snap = await getDoc(doc(db, PUBLIC_WORKSHOPS, workshopId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

/** A short human-quotable reference, e.g. REQ-7K3M9Q. */
export function newRequestRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint8Array(6);
  (globalThis.crypto || {}).getRandomValues?.(bytes);
  for (let i = 0; i < 6; i++) {
    out += alphabet[(bytes[i] || Math.floor(Math.random() * 256)) % alphabet.length];
  }
  return `REQ-${out}`;
}

const REQUEST_FIELDS = [
  'name', 'dob', 'qualification', 'courseName', 'whatsapp', 'area', 'email',
  'paymentMode', 'paymentRef', 'notes',
];

/**
 * Submit a registration. Public, unauthenticated.
 *
 * The shape here has to match the rules exactly — they whitelist the keys,
 * because this is the one place in the app where a stranger can write.
 */
export async function submitRegistrationRequest(workshopId, form) {
  const str = (v) => String(v ?? '').trim().slice(0, 200);
  const data = { workshopId: String(workshopId) };
  for (const key of REQUEST_FIELDS) data[key] = str(form[key]);

  data.ref = newRequestRef();
  data.status = 'new';
  data.hp = '';                       // honeypot: bots fill it, people cannot see it
  data.createdAt = serverTimestamp();

  const written = await addDoc(collection(db, REQUESTS), data);
  return { id: written.id, ref: data.ref };
}

/* ------------------------------------------------------------------ *
 * Admin side
 * ------------------------------------------------------------------ */

/** Admin. Everything submitted for one workshop, newest first. */
export async function listRequests(workshopId) {
  const snap = await getDocs(query(collection(db, REQUESTS), where('workshopId', '==', workshopId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/**
 * Every request still waiting, across every workshop.
 *
 * The workshop screen answers "what is waiting for THIS course". Nobody
 * could ask "what is waiting at all" without opening each one in turn,
 * which is the question the console exists to answer.
 *
 * Requests are one flat collection with a workshopId on each, so this is a
 * single query rather than one per workshop.
 */
export async function listPendingRequests() {
  const snap = await getDocs(query(collection(db, REQUESTS), where('status', '==', 'new')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/**
 * Record a decision. `extra` carries the ticket number issued on acceptance,
 * so the receipt sent afterwards can quote it.
 */
export async function setRequestStatus(requestId, status, extra = {}) {
  await setDoc(
    doc(db, REQUESTS, requestId),
    { status, ...extra, decidedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * The patch that undoes a decision.
 *
 * Rejecting has never destroyed anything — the request keeps every field the
 * student typed and only its status changes. So restoring is putting the
 * status back and clearing what the decision added: the ticket number an
 * acceptance recorded, and the time it was decided. Everything else is still
 * there and is left alone.
 *
 * Separate from the write so it can be tested without a database.
 */
export function restorePatch() {
  return { status: 'new', ticketId: '', decidedAt: null };
}

/**
 * Put a handled request back in the queue.
 *
 * A rejection is a decision, not a deletion, and decisions get made in
 * haste — somebody is rejected for a duplicate that turns out to be their
 * sibling, or the office changes its mind. This returns them to the pending
 * list with everything they typed intact, to be accepted or rejected again.
 */
export async function restoreRequest(requestId) {
  await setDoc(doc(db, REQUESTS, requestId), restorePatch(), { merge: true });
}

/**
 * Delete a request outright.
 *
 * The ONE irreversible thing on this screen: unlike rejecting, this really
 * does destroy what the student typed. The panel asks before calling it.
 */
export async function deleteRequest(requestId) {
  await deleteDoc(doc(db, REQUESTS, requestId));
}

/** The fields of a request that become a registration when it is accepted. */
export function requestToRegistration(request) {
  const out = { paymentStatus: 'Pending' };
  for (const key of REQUEST_FIELDS) out[key] = request[key] || '';
  out.notes = [request.notes, request.ref ? `Self-registered ${request.ref}` : '']
    .filter(Boolean).join(' · ');
  return out;
}

/* ------------------------------------------------------------------ *
 * Payment
 * ------------------------------------------------------------------ */

/**
 * A UPI intent link. Scanned as a QR or tapped on a phone, it opens the payer's
 * UPI app with the payee and amount already filled in.
 */
export function upiLink({ upiId, name, amount, note }) {
  const vpa = String(upiId || '').trim();
  if (!vpa) return '';
  const params = new URLSearchParams({ pa: vpa, pn: name || ISSUER.upiName || ISSUER.name, cu: 'INR' });
  if (amount) params.set('am', String(amount));
  if (note) params.set('tn', String(note).slice(0, 50));
  return `upi://pay?${params.toString()}`;
}
