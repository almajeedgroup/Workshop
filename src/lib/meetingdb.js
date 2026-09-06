/**
 * Opening and closing an online class.
 *
 * Two documents move together every time: the workshop, which is what the
 * office sees, and its public mirror, which is what a student's join link
 * reads. The room name reaches the mirror ONLY while the class is open —
 * that is what makes closing a class actually close it, rather than merely
 * hiding a button on a page anyone can skip past.
 *
 * The decisions live in `meeting.js`, which needs no database. This is the
 * part that writes.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { mintRoomName } from './meeting.js';
import { syncPublicWorkshop } from './publicdb.js';

const WORKSHOPS = 'workshops';

/**
 * Make sure the workshop has a room, minting one the first time.
 *
 * Minted here rather than when the workshop is created, so a course that
 * never meets online never gets one, and so the name is not sitting in the
 * record for months before anybody uses it.
 *
 * Returns the room name; writes only if there was not one already.
 */
export async function ensureRoom(workshopId, workshop) {
  const existing = String(workshop?.meetingRoom || '').trim();
  if (existing) return existing;
  const room = mintRoomName(workshop);
  await setDoc(doc(db, WORKSHOPS, workshopId), { meetingRoom: room }, { merge: true });
  return room;
}

/**
 * Open or close the class, in one action.
 *
 * Opening mints the room if there is not one, flips the flag, and republishes
 * the mirror so the join link starts working — the same shape as publishing
 * a registration page, and for the same reason: nobody should have to know
 * that two documents are involved.
 *
 * Returns the workshop as it now stands, so the caller can render from it
 * without a re-read.
 */
export async function setClassOpen(workshopId, workshop, open) {
  const room = open ? await ensureRoom(workshopId, workshop) : (workshop?.meetingRoom || '');
  const next = { ...workshop, meetingRoom: room, classOpen: open ? 'Open' : 'Closed' };
  await setDoc(
    doc(db, WORKSHOPS, workshopId),
    { meetingRoom: room, classOpen: next.classOpen, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await syncPublicWorkshop(workshopId, next);
  return next;
}

/**
 * Move the class to a new room.
 *
 * The only way to shut somebody out of a Jitsi room is to stop using it, so
 * this exists for the day a link is forwarded somewhere it should not have
 * been. Every link already sent stops working, which is the point, and the
 * caller warns about that before calling.
 */
export async function replaceRoom(workshopId, workshop) {
  const room = mintRoomName(workshop);
  const next = { ...workshop, meetingRoom: room };
  await setDoc(
    doc(db, WORKSHOPS, workshopId),
    { meetingRoom: room, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await syncPublicWorkshop(workshopId, next);
  return next;
}

/** The workshop as stored, for a screen that was handed only an ID. */
export async function getWorkshopForClass(workshopId) {
  const snap = await getDoc(doc(db, WORKSHOPS, workshopId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
