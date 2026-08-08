/**
 * Firestore access layer.
 *
 *   workshops/{workshopId}
 *       …schema fields…, lastTicketSeq
 *       registrations/{registrationId}
 *   admins/{uid}                      (allow-list, managed from the Console)
 */

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp, writeBatch, limit, runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  WORKSHOP_FIELDS, REGISTRATION_FIELDS, emptyWorkshop,
} from './schema.js';
import { ticketPrefixFor, formatTicketId } from './tickets.js';

const WORKSHOPS = 'workshops';
const REGISTRATIONS = 'registrations';

/* ------------------------------------------------------------------ *
 * Sanitising — Firestore rejects `undefined`
 * ------------------------------------------------------------------ */

function sanitizeWorkshop(w) {
  const out = {};
  for (const f of WORKSHOP_FIELDS) {
    const v = w[f.key];
    if (f.type === 'list') out[f.key] = Array.isArray(v) ? v.filter(Boolean) : [];
    else if (f.type === 'number') out[f.key] = v === '' || v === null || v === undefined ? null : Number(v);
    else out[f.key] = v === undefined || v === null ? '' : String(v);
  }
  out.searchText = [
    out.title, out.code, out.venue, out.presentedBy, out.collaborators,
    out.audience, out.topics, ...(out.resourcePersons || []), ...(out.coordinators || []),
  ].join(' ').toLowerCase();
  return out;
}

function sanitizeRegistration(p) {
  const out = {};
  for (const f of REGISTRATION_FIELDS) {
    const v = p[f.key];
    if (f.type === 'number') out[f.key] = v === '' || v === null || v === undefined ? null : Number(v);
    else out[f.key] = v === undefined || v === null ? '' : String(v).trim();
  }
  out.nameLower = out.name.toLowerCase();
  out.searchText = [out.name, out.email, out.whatsapp, out.area, out.ticketId]
    .join(' ').toLowerCase();
  return out;
}

/* ------------------------------------------------------------------ *
 * Administrators
 * ------------------------------------------------------------------ */

/**
 * Make sure the signed-in owner has a record in the `admins` collection.
 *
 * The owner already has access via the bootstrap e-mail check in
 * firestore.rules, so this changes no permissions — it just puts them in the
 * list, which is otherwise empty until someone hand-creates a document in the
 * Console. Only the owner can write their own record; the rules reject
 * everyone else.
 *
 * Never throws: failing to write the record must not block sign-in.
 */
export async function ensureAdminRecord(user) {
  if (!user) return false;
  const ref = doc(db, 'admins', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return true;
    await setDoc(ref, {
      email: user.email || '',
      name: user.displayName || user.email || '',
      role: 'owner',
      createdAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function listWorkshops() {
  const snap = await getDocs(query(collection(db, WORKSHOPS), orderBy('startDate', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getWorkshop(id) {
  const snap = await getDoc(doc(db, WORKSHOPS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...emptyWorkshop(), ...snap.data() };
}

export async function getRegistrations(workshopId) {
  const snap = await getDocs(
    query(collection(db, WORKSHOPS, workshopId, REGISTRATIONS), orderBy('ticketId'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRegistration(workshopId, regId) {
  const snap = await getDoc(doc(db, WORKSHOPS, workshopId, REGISTRATIONS, regId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/* ------------------------------------------------------------------ *
 * Ticket ID allocation
 * ------------------------------------------------------------------ */

/**
 * Reserve `count` sequential ticket numbers on the workshop document.
 *
 * Runs in a transaction, so concurrent imports cannot be handed the same
 * number. Returns the formatted IDs, e.g. ['IIC-AI26-004', 'IIC-AI26-005'].
 */
export async function allocateTicketIds(workshopId, count) {
  if (count <= 0) return [];
  const ref = doc(db, WORKSHOPS, workshopId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Workshop no longer exists.');
    const data = snap.data();
    const start = Number(data.lastTicketSeq || 0);
    const prefix = ticketPrefixFor(data);

    tx.update(ref, { lastTicketSeq: start + count, updatedAt: serverTimestamp() });

    const ids = [];
    for (let i = 1; i <= count; i++) ids.push(formatTicketId(prefix, start + i));
    return ids;
  });
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export async function createWorkshop(workshop, registrations = []) {
  const ref = await addDoc(collection(db, WORKSHOPS), {
    ...sanitizeWorkshop(workshop),
    lastTicketSeq: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (registrations.length) await addRegistrations(ref.id, registrations);
  return ref.id;
}

export async function updateWorkshop(id, workshop) {
  await setDoc(
    doc(db, WORKSHOPS, id),
    { ...sanitizeWorkshop(workshop), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Append registrations, allocating a ticket ID to any that lack one.
 * Existing registrations are untouched.
 */
export async function addRegistrations(workshopId, registrations) {
  if (!registrations.length) return [];

  const needing = registrations.filter((r) => !String(r.ticketId || '').trim()).length;
  const fresh = await allocateTicketIds(workshopId, needing);

  let n = 0;
  const withIds = registrations.map((r) =>
    String(r.ticketId || '').trim() ? r : { ...r, ticketId: fresh[n++] }
  );

  const col = collection(db, WORKSHOPS, workshopId, REGISTRATIONS);
  for (let i = 0; i < withIds.length; i += 450) {
    const batch = writeBatch(db);
    for (const r of withIds.slice(i, i + 450)) {
      batch.set(doc(col), { ...sanitizeRegistration(r), createdAt: serverTimestamp() });
    }
    await batch.commit();
  }
  return withIds;
}

/** Update one registration in place (payment status, corrections, …). */
export async function updateRegistration(workshopId, regId, patch) {
  await setDoc(
    doc(db, WORKSHOPS, workshopId, REGISTRATIONS, regId),
    { ...sanitizeRegistration(patch), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function deleteRegistration(workshopId, regId) {
  await deleteDoc(doc(db, WORKSHOPS, workshopId, REGISTRATIONS, regId));
}

/**
 * Rewrite the whole registration list to match `registrations` exactly.
 * Rows carrying an `id` are updated, new rows are added (and get a ticket
 * ID), and anything no longer present is removed.
 */
export async function syncRegistrations(workshopId, registrations) {
  const col = collection(db, WORKSHOPS, workshopId, REGISTRATIONS);
  const existing = await getDocs(col);
  const keep = new Set(registrations.map((r) => r.id).filter(Boolean));

  const needing = registrations.filter((r) => !String(r.ticketId || '').trim()).length;
  const fresh = await allocateTicketIds(workshopId, needing);
  let n = 0;

  const ops = [];
  for (const d of existing.docs) {
    if (!keep.has(d.id)) ops.push({ type: 'delete', ref: d.ref });
  }
  for (const r of registrations) {
    const withId = String(r.ticketId || '').trim() ? r : { ...r, ticketId: fresh[n++] };
    ops.push({
      type: 'set',
      ref: r.id ? doc(col, r.id) : doc(col),
      data: sanitizeRegistration(withId),
    });
  }

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 450)) {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.set(op.ref, { ...op.data, updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }
}

export async function deleteWorkshop(id) {
  // Deleting a document does NOT delete its sub-collection — do it explicitly.
  const col = collection(db, WORKSHOPS, id, REGISTRATIONS);
  let snap = await getDocs(query(col, limit(450)));
  while (!snap.empty) {
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    snap = await getDocs(query(col, limit(450)));
  }
  await deleteDoc(doc(db, WORKSHOPS, id));
}

/** Used by the "everything" export. */
export async function listAllWithRegistrations() {
  const workshops = await listWorkshops();
  const out = [];
  for (const w of workshops) {
    out.push({ workshop: w, registrations: await getRegistrations(w.id) });
  }
  return out;
}
