/**
 * Participant photographs, stored apart from the registration.
 *
 * A photo is 20-60KB even after shrinking. Registrations are read as a whole
 * list every time the workshop screen opens, so keeping photos on those
 * documents would mean a course of forty pulling two megabytes down before
 * the table appeared. They live in their own collection instead, read one at
 * a time on the ID card screen and in a single batch only when a sheet of
 * cards is being printed.
 *
 * A photo is also the most personal thing this database holds. Its own
 * collection means the rules can be stricter than the registration's: admins
 * only, no public read of any kind, and no path from a certificate or a
 * ticket to a face.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';

/** Sub-collection name. Exported so db.js can clear it with its workshop. */
export const PHOTOS = 'registrationPhotos';

/** Photos are keyed by the registration they belong to. */
function photoRef(workshopId, regId) {
  return doc(db, 'workshops', workshopId, PHOTOS, regId);
}

/** One person's photo as a data URL, or '' when they have none. */
export async function getPhoto(workshopId, regId) {
  if (!workshopId || !regId) return '';
  const snap = await getDoc(photoRef(workshopId, regId));
  return snap.exists() ? String(snap.data().photo || '') : '';
}

/**
 * Every photo for a workshop, as a map of registration ID to data URL.
 * Read once when a sheet of cards is printed, rather than per card.
 */
export async function getPhotos(workshopId) {
  if (!workshopId) return {};
  const snap = await getDocs(collection(db, 'workshops', workshopId, PHOTOS));
  const out = {};
  snap.forEach((d) => { out[d.id] = String(d.data().photo || ''); });
  return out;
}

/** Store a photo, or remove it when given nothing. */
export async function setPhoto(workshopId, regId, dataUrl) {
  if (!workshopId || !regId) return;
  if (!dataUrl) {
    await removePhoto(workshopId, regId);
    return;
  }
  await setDoc(photoRef(workshopId, regId), { photo: String(dataUrl) });
}

export async function removePhoto(workshopId, regId) {
  if (!workshopId || !regId) return;
  try {
    await deleteDoc(photoRef(workshopId, regId));
  } catch {
    /* A photo left behind must not block deleting the person's record. */
  }
}
