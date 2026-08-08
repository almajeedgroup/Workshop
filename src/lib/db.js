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
import { ticketPrefixFor, formatTicketId, compareTicketIds } from './tickets.js';

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

/** Is this account on the allow-list? That is the whole of authorisation. */
export async function isListedAdmin(uid) {
  if (!uid) return false;
  try {
    return (await getDoc(doc(db, 'admins', uid))).exists();
  } catch {
    return false;
  }
}

/**
 * Put the signed-in owner on the allow-list.
 *
 * The rules let the permanent owner address create its own /admins record and
 * nothing else, so this is how the very first sign-in gets access without
 * anyone hand-creating a document in the Console. Everyone else is added from
 * the Console.
 *
 * Access now genuinely depends on this succeeding — the rules consult the
 * allow-list and nothing else — so the caller is told whether it worked
 * rather than the failure being swallowed.
 */
export async function registerOwner(user) {
  if (!user) return false;
  try {
    await setDoc(doc(db, 'admins', user.uid), {
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
  const snap = await getDocs(collection(db, WORKSHOPS, workshopId, REGISTRATIONS));
  // Sorted here rather than by Firestore: `orderBy('ticketId')` is a string
  // sort, which files PREFIX-1000 ahead of PREFIX-999, and drops any row that
  // has no ticket ID at all.
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => compareTicketIds(a.ticketId, b.ticketId));
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
 *
 * Two guarantees, both of which the register depends on:
 *   - the prefix is whatever the workshop was first given, never re-derived,
 *     so an edit to the title cannot change the series mid-event;
 *   - `lastTicketSeq` only ever climbs. Deleting a registration does not hand
 *     its number to the next candidate, so an issued ticket stays unique to
 *     the person who was issued it.
 */
export async function allocateTicketIds(workshopId, count) {
  if (count <= 0) return [];
  const ref = doc(db, WORKSHOPS, workshopId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Workshop no longer exists.');
    const data = snap.data();
    const start = Number(data.lastTicketSeq || 0);

    const stored = String(data.ticketPrefix || '').trim();
    const prefix = stored || ticketPrefixFor(data);

    const patch = { lastTicketSeq: start + count, updatedAt: serverTimestamp() };
    // Pin it now, so documents written before this behaviour existed keep the
    // prefix they have already been issuing.
    if (!stored) patch.ticketPrefix = prefix;
    tx.update(ref, patch);

    const ids = [];
    for (let i = 1; i <= count; i++) ids.push(formatTicketId(prefix, start + i));
    return ids;
  });
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export async function createWorkshop(workshop, registrations = []) {
  const data = sanitizeWorkshop(workshop);
  // Mint the ticket prefix once, here, and store it. Leaving it blank would
  // mean re-deriving it from the title at every allocation, so renaming the
  // workshop later would start a second ticket series inside one event.
  if (!data.ticketPrefix) data.ticketPrefix = ticketPrefixFor(data);

  const ref = await addDoc(collection(db, WORKSHOPS), {
    ...data,
    lastTicketSeq: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (registrations.length) await addRegistrations(ref.id, registrations);
  return ref.id;
}

export async function updateWorkshop(id, workshop) {
  const ref = doc(db, WORKSHOPS, id);
  const data = sanitizeWorkshop(workshop);

  if (!data.ticketPrefix) {
    // The prefix was cleared in the form. Restore the one this workshop has
    // been issuing rather than deriving a fresh one — tickets already in
    // people's hands have to keep matching the ones issued next.
    const snap = await getDoc(ref);
    const stored = snap.exists() ? String(snap.data().ticketPrefix || '').trim() : '';
    data.ticketPrefix = stored || ticketPrefixFor(data);
  }

  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
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
 * Make the stored registration list match `registrations`.
 *
 * Rows carrying an `id` are updated, new rows are added (and get a ticket ID),
 * and rows the editor removed are deleted.
 *
 * `baseIds` is the set of registration IDs the editor actually loaded. Only
 * those may be deleted — anything that appeared in Firestore afterwards was
 * added by somebody else while this screen was open, and is left alone. This
 * screen is a full-list rewrite, so without that fence one administrator
 * saving an edit would wipe out registrations another had just entered.
 *
 * Returns { deleted, added, updated, keptFromOthers } so the caller can say
 * what happened.
 */
export async function syncRegistrations(workshopId, registrations, baseIds = null) {
  const col = collection(db, WORKSHOPS, workshopId, REGISTRATIONS);
  const existing = await getDocs(col);
  const keep = new Set(registrations.map((r) => r.id).filter(Boolean));
  // No baseline supplied (a caller that never loaded the list) — delete
  // nothing rather than guess.
  const deletable = baseIds ? new Set(baseIds) : new Set();

  const needing = registrations.filter((r) => !String(r.ticketId || '').trim()).length;
  const fresh = await allocateTicketIds(workshopId, needing);
  let n = 0;

  const ops = [];
  let keptFromOthers = 0;
  for (const d of existing.docs) {
    if (keep.has(d.id)) continue;
    if (deletable.has(d.id)) ops.push({ type: 'delete', ref: d.ref });
    else keptFromOthers++;
  }

  let added = 0;
  for (const r of registrations) {
    const withId = String(r.ticketId || '').trim() ? r : { ...r, ticketId: fresh[n++] };
    if (!r.id) added++;
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

  return {
    deleted: ops.filter((o) => o.type === 'delete').length,
    added,
    updated: registrations.length - added,
    keptFromOthers,
  };
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

/**
 * Pair each of the given workshops with its registrations.
 *
 * Takes the workshops the caller actually wants rather than reading every one
 * and filtering afterwards — exporting a single filtered workshop used to read
 * the whole database. Fetched in small parallel batches: a sequential loop was
 * needlessly slow, and an unbounded one would open a connection per workshop.
 */
export async function withRegistrations(workshops, batchSize = 8) {
  const out = [];
  for (let i = 0; i < workshops.length; i += batchSize) {
    const batch = await Promise.all(
      workshops.slice(i, i + batchSize).map(async (w) => ({
        workshop: w,
        registrations: await getRegistrations(w.id),
      }))
    );
    out.push(...batch);
  }
  return out;
}

/** Every workshop with its registrations — the unfiltered export. */
export async function listAllWithRegistrations() {
  return withRegistrations(await listWorkshops());
}

/* Note on ticket-number gaps: if a batch write fails after
 * allocateTicketIds() has already advanced `lastTicketSeq`, those numbers are
 * spent and the register will show a gap. That is deliberate. The alternative
 * — winding the counter back — risks handing a number to a second person
 * after the first has been sent their ticket, and a gap is far easier to
 * explain than a duplicate. */
