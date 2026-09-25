/**
 * The course library, in the database and in the bucket.
 *
 *   workshops/{id}/library/{itemId}   the shelf: one record per item
 *   workshops/{id}/library/{file}     the bucket, for items that are files
 *
 * The two share a name and nothing else. A record always exists; the object
 * exists only for `source: 'file'`, and the record points at it by path.
 *
 * ── THE RECORD IS THE TRUTH ──────────────────────────────────────────────
 *
 * An upload writes the object FIRST and the record second, so a failure
 * halfway leaves an object nobody references — wasted bytes, invisible to
 * everyone, cleanable later. The other order would leave a record pointing
 * at nothing, which is a broken item in a student's list and a support
 * question. Given a choice between leaking a file and showing a lie, this
 * leaks the file.
 *
 * Deleting goes the other way for the same reason: record first, then the
 * object.
 */

import {
  collection, doc, addDoc, deleteDoc, getDoc, getDocs, setDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase.js';
import { libraryRecord, libraryFilePath, MAX_FILE_BYTES, formatOfFile } from './library.js';
import { getNotes, listHandouts } from './classroomdb.js';
import { syncPublicWorkshop } from './publicdb.js';
import { formatDate } from './tickets.js';

const WORKSHOPS = 'workshops';
export const LIBRARY = 'library';

const libraryRef = (workshopId) => collection(db, WORKSHOPS, workshopId, LIBRARY);

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * Everything on one course's shelf.
 *
 * Ordered by the server's clock here and re-ordered by day on the way out —
 * see `sortLibrary`. The query order exists only so that two items added in
 * the same second come back in a stable order rather than an arbitrary one.
 */
export async function listLibrary(workshopId) {
  if (!workshopId) return [];
  const snap = await getDocs(query(libraryRef(workshopId), orderBy('addedAt', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * A URL the browser can actually open, for an item that is a file.
 *
 * Storage download URLs are not guessable and not permanent, so they are
 * fetched per item at the moment somebody wants one rather than stored in
 * the record. Storing one would freeze a token into the database and hand
 * every reader a link that outlives their membership.
 */
export async function libraryFileUrl(item) {
  if (!item?.path || !storage) return '';
  return getDownloadURL(storageRef(storage, item.path));
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/** A link somebody else hosts: Drive, OneDrive, anything https. */
export async function addLibraryLink(workshopId, item) {
  const record = libraryRecord({ ...item, source: 'link' });
  if (!record.url) throw new Error('A link item needs a link.');
  const written = await addDoc(libraryRef(workshopId), {
    ...record,
    addedAt: serverTimestamp(),
  });
  return written.id;
}

/**
 * A file, into this project's bucket.
 *
 * Resumable rather than a single put: a recording is hundreds of megabytes
 * over whatever connection the office has, and a plain upload that fails at
 * 90% starts again from nothing. `onProgress` is given a 0–1 fraction so the
 * panel can show it moving — an upload with no feedback gets cancelled by
 * somebody who assumes it has hung.
 */
export async function uploadLibraryFile(workshopId, file, item = {}, onProgress = null) {
  if (!storage) throw new Error('No file store is configured for this project.');
  if (!file) throw new Error('No file was chosen.');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`That file is larger than the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit.`);
  }

  const path = libraryFilePath(workshopId, file.name);
  const task = uploadBytesResumable(storageRef(storage, path), file, {
    contentType: file.type || 'application/octet-stream',
  });

  await new Promise((resolve, reject) => {
    task.on('state_changed',
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      resolve);
  });

  const record = libraryRecord({
    ...item,
    source: 'file',
    path,
    fileName: file.name,
    bytes: file.size,
    format: item.format || formatOfFile(file.name, file.type),
  });

  try {
    const written = await addDoc(libraryRef(workshopId), {
      ...record,
      addedAt: serverTimestamp(),
    });
    return written.id;
  } catch (e) {
    // The object is up but nothing references it. Take it back out rather
    // than leave a paid-for orphan, and report the original failure.
    await deleteObject(storageRef(storage, path)).catch(() => {});
    throw e;
  }
}

/**
 * Take one item off the shelf.
 *
 * The record goes first: the moment it is gone the item is gone from every
 * student's list, whatever happens next. If the object then fails to delete
 * the cost is storage, not a broken link.
 */
export async function removeLibraryItem(workshopId, item) {
  if (!workshopId || !item?.id) return;
  await deleteDoc(doc(db, WORKSHOPS, workshopId, LIBRARY, item.id));
  if (item.source === 'file' && item.path && storage) {
    await deleteObject(storageRef(storage, item.path)).catch(() => {
      /* Already gone, or never arrived. The shelf is what students see. */
    });
  }
}

/* ------------------------------------------------------------------ *
 * Who a library is for
 * ------------------------------------------------------------------ */

export const OPEN_INDEX = 'publicIndex';
export const OPEN_INDEX_DOC = 'openLibraries';

/**
 * Open a course's library to anybody with an account, or shut it again.
 *
 * PER COURSE, DELIBERATELY. A single switch for the whole app would mean
 * opening an outreach course also gives away the recordings of a paid one,
 * and that is not a decision anybody should make by accident.
 *
 * Two writes, because two readers need to know:
 *
 *   the MIRROR — `publicWorkshops/{id}.libraryOpen` — is what the rules
 *   read. It is what actually grants or refuses the read.
 *
 *   the INDEX — one public document listing the open courses — is how a
 *   student who never registered FINDS them. Nothing lists workshops
 *   publicly otherwise: the mirror is readable one document at a time, by
 *   ID, and listing it would expose every course including unannounced
 *   ones. So the index holds only what has been deliberately opened.
 *
 * The index is a convenience and grants nothing. A course removed from the
 * mirror's `libraryOpen` is shut even if a stale index still names it.
 */
export async function setLibraryAccess(workshopId, workshop, open) {
  const next = { ...workshop, libraryAccess: open ? 'Open' : 'Ticket' };

  await setDoc(
    doc(db, WORKSHOPS, workshopId),
    { libraryAccess: next.libraryAccess, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await syncPublicWorkshop(workshopId, next);
  await refreshOpenIndex(workshopId, next, open);
  return next;
}

/** Add this course to the public list of open libraries, or take it off. */
async function refreshOpenIndex(workshopId, workshop, open) {
  const ref = doc(db, OPEN_INDEX, OPEN_INDEX_DOC);
  const snap = await getDoc(ref).catch(() => null);
  const current = Array.isArray(snap?.data()?.courses) ? snap.data().courses : [];

  const without = current.filter((c) => c.id !== workshopId);
  const courses = open
    ? [...without, {
      id: workshopId,
      title: String(workshop.title || workshopId).slice(0, 200),
      startDate: String(workshop.startDate || ''),
      endDate: String(workshop.endDate || ''),
    }]
    : without;

  await setDoc(ref, { courses, updatedAt: serverTimestamp() });
}

/** The courses whose libraries anybody with an account may open. */
export async function listOpenLibraries() {
  const snap = await getDoc(doc(db, OPEN_INDEX, OPEN_INDEX_DOC)).catch(() => null);
  const courses = snap?.exists() ? snap.data().courses : [];
  return Array.isArray(courses) ? courses : [];
}

/* ------------------------------------------------------------------ *
 * Keeping what the class produced
 * ------------------------------------------------------------------ */

/**
 * Carry a class's own notes and handouts onto the shelf.
 *
 * Run when a class closes. Everything under a live class is readable only
 * while `classOpen` is true — that is right for a room nobody was given a
 * copy of, and wrong for the notes a student was reading ten minutes ago.
 * Closing the class should not take those away from the people who were in
 * it; it should stop strangers reading them.
 *
 * IDEMPOTENT BY CONSTRUCTION. The IDs are derived from what is being
 * carried, not generated, so closing a class twice — or closing, reopening
 * and closing again, which is a normal afternoon — writes the same
 * documents again instead of a second copy of everything.
 *
 * A title the office later edits IS overwritten by a re-run. That is the
 * cost of the deterministic ID, and it is the better way round: a duplicate
 * shelf is a support call, an overwritten title is a retype.
 */
export async function keepClassMaterial(workshopId, days = []) {
  if (!workshopId) return { notes: 0, handouts: 0 };
  let notes = 0;

  for (const day of days) {
    const text = await getNotes(workshopId, day).catch(() => '');
    if (!String(text || '').trim()) continue;      // an empty day is not a note

    await setDoc(doc(libraryRef(workshopId), `notes-${day}`), {
      ...libraryRecord({
        title: `Class notes — ${formatDate(day)}`,
        kind: 'notes',
        source: 'text',
        text,
        day,
      }),
      addedAt: serverTimestamp(),
    });
    notes += 1;
  }

  /* Handouts carry across as they are — a link stays a link.
   *
   * A handout uploaded BEFORE this app had a bucket is base64 inside its own
   * Firestore document: it has `data`, not a `path`, and there is nothing
   * for a library item to point at. Carrying one would put a row on the
   * shelf that opens nothing, which is worse than not carrying it, so those
   * are counted and reported rather than written. The office can re-upload
   * them through the library panel, where they become real objects. */
  const handouts = await listHandouts(workshopId).catch(() => []);
  let carried = 0;
  let stuck = 0;

  for (const h of handouts) {
    const isFile = h.kind === 'file';
    if (isFile && !h.path) { stuck += 1; continue; }

    await setDoc(doc(libraryRef(workshopId), `handout-${h.id}`), {
      ...libraryRecord({
        title: h.title,
        kind: 'notes',
        source: isFile ? 'file' : 'link',
        url: h.url,
        path: h.path || '',
        bytes: h.bytes,
        fileName: h.title,
      }),
      addedAt: serverTimestamp(),
    });
    carried += 1;
  }

  return { notes, handouts: carried, stuck };
}
