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
  collection, doc, addDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase.js';
import { libraryRecord, libraryFilePath, MAX_FILE_BYTES, formatOfFile } from './library.js';

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
