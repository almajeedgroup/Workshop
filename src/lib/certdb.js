/**
 * Certificates: issuing, verification and holder history.
 *
 * PRIVACY, deliberately:
 * A certificate document is readable by ANYONE who has its ID — that is the
 * whole point of verification. So a certificate carries only what a verifier
 * legitimately needs: the holder's name, what was awarded, for which workshop
 * and when. It carries NO phone number, NO date of birth, NO email, NO
 * address. Those live on the registration, which stays behind the admin
 * allow-list. `certificateRecord()` below is a whitelist, not a filter, so a
 * field added to registrations cannot leak here by accident.
 *
 *   certificates/{certificateId}   public get  · admin list/write
 *   holders/{holderKey}            public get  · admin write   (the history)
 *   holderIndex/{identity}         admin only  (phone/email -> holderKey)
 *
 * `holderKey` is a random unguessable ID, not derived from anything. The map
 * from a person's phone or email to their holderKey lives in holderIndex,
 * which the public cannot read — so the public history is reachable only by
 * someone who already holds a valid certificate ID.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, query, where,
  serverTimestamp, writeBatch, runTransaction, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { matchKeys } from './dedupe.js';
import { ticketPrefixFor } from './tickets.js';
import {
  certificateTypeCode, formatCertificateId, highestCertificateSeq,
  compareCertificateIds, certificateTypeByKey, certificateDesignByKey,
  DEFAULT_CERTIFICATE_DESIGN,
} from './certificates.js';

const CERTIFICATES = 'certificates';
const HOLDERS = 'holders';
const HOLDER_INDEX = 'holderIndex';
const WORKSHOPS = 'workshops';
const BATCH = 400;

/* ------------------------------------------------------------------ *
 * What a certificate is allowed to contain
 * ------------------------------------------------------------------ */

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

/**
 * Build the public certificate record. A whitelist: only these fields are
 * ever written, whatever the caller passes in.
 */
export function certificateRecord({
  certificateId, type, design, recipientName, workshopId, workshopTitle,
  workshopDates, venue, presentedBy, workshopCode, duration, time, topics,
  ticketId, holderKey, issuedOn,
}) {
  return {
    certificateId: str(certificateId),
    type: str(type),
    typeLabel: certificateTypeByKey[type]?.label || '',
    // Which sheet this was printed on. Stored, not looked up: a certificate
    // in somebody's hands must keep looking like itself after the workshop
    // is redesigned, or deleted.
    design: certificateDesignByKey[design] ? str(design) : DEFAULT_CERTIFICATE_DESIGN,
    recipientName: str(recipientName),
    workshopId: str(workshopId),
    workshopTitle: str(workshopTitle),
    workshopDates: str(workshopDates),
    venue: str(venue),
    presentedBy: str(presentedBy),
    // Facts the parliament sheet prints. Course details, not personal ones,
    // so they are safe on a publicly readable document.
    workshopCode: str(workshopCode),
    duration: str(duration),
    time: str(time),
    // One line on the sheet, so it is bounded here rather than trusted to
    // whatever was typed into the workshop's Topics box.
    topics: str(topics).slice(0, 200),
    ticketId: str(ticketId),
    holderKey: str(holderKey),
    issuedOn: str(issuedOn),
    revoked: false,
  };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** Public. Returns null when no such certificate exists. */
export async function getCertificate(certificateId) {
  const id = str(certificateId).toUpperCase();
  if (!id) return null;
  const snap = await getDoc(doc(db, CERTIFICATES, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Public. Everything this person has been awarded. */
export async function getHolder(holderKey) {
  if (!str(holderKey)) return null;
  const snap = await getDoc(doc(db, HOLDERS, holderKey));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Admin. Every certificate issued for one workshop. */
export async function listWorkshopCertificates(workshopId) {
  const snap = await getDocs(query(collection(db, CERTIFICATES), where('workshopId', '==', workshopId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => compareCertificateIds(a.certificateId, b.certificateId));
}

/* ------------------------------------------------------------------ *
 * Holder identity
 * ------------------------------------------------------------------ */

/** A registration's identity keys, safe to use as document IDs. */
function indexIds(registration) {
  return matchKeys(registration).map((k) => k.replace(/[/#?[\]*]/g, '_'));
}

/**
 * The holderKey for this person, reused if they have been awarded before.
 *
 * Looks the person up by phone, then email, then name+date of birth — the
 * same matching the duplicate check uses — so a candidate who attends two
 * workshops accumulates one history rather than two.
 */
async function resolveHolderKey(registration) {
  const ids = indexIds(registration);

  for (const id of ids) {
    const snap = await getDoc(doc(db, HOLDER_INDEX, id));
    if (snap.exists() && snap.data().holderKey) return { holderKey: snap.data().holderKey, ids };
  }

  // Nobody matching: mint a fresh unguessable key.
  return { holderKey: doc(collection(db, HOLDERS)).id, ids };
}

/* ------------------------------------------------------------------ *
 * Issuing
 * ------------------------------------------------------------------ */

/**
 * Reserve `count` certificate numbers for one workshop and type.
 *
 * The counter is per type, kept in a map on the workshop, so completion and
 * excellence certificates number independently and can never collide. Like
 * ticket numbers it only climbs, and it is pushed past any ID that arrives
 * already issued.
 */
export async function allocateCertificateIds(workshopId, typeKey, count, carriedIds = []) {
  const ref = doc(db, WORKSHOPS, workshopId);
  const code = certificateTypeCode(typeKey);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Workshop no longer exists.');
    const data = snap.data();

    const prefix = str(data.ticketPrefix) || ticketPrefixFor(data);
    const counters = data.lastCertSeq && typeof data.lastCertSeq === 'object' ? data.lastCertSeq : {};
    const stored = Number(counters[code] || 0);
    const start = Math.max(stored, highestCertificateSeq(prefix, typeKey, carriedIds));

    if (start + count !== stored) {
      tx.update(ref, { [`lastCertSeq.${code}`]: start + count, updatedAt: serverTimestamp() });
    }

    const ids = [];
    for (let i = 1; i <= count; i++) ids.push(formatCertificateId(prefix, typeKey, start + i));
    return ids;
  });
}

/**
 * Award `typeKey` certificates to these registrations.
 *
 * Skips anyone who already holds this type for this workshop, so pressing the
 * button twice does not issue two. Returns what was issued and what was
 * skipped.
 */
export async function issueCertificates(workshop, registrations, typeKey, { issuedOn } = {}) {
  if (!registrations.length) return { issued: [], skipped: [] };

  const existing = await listWorkshopCertificates(workshop.id);
  const already = new Set(
    existing.filter((c) => c.type === typeKey && !c.revoked).map((c) => c.ticketId || c.recipientName)
  );

  const todo = [];
  const skipped = [];
  for (const r of registrations) {
    if (already.has(r.ticketId || r.name)) skipped.push(r);
    else todo.push(r);
  }
  if (!todo.length) return { issued: [], skipped };

  const ids = await allocateCertificateIds(
    workshop.id, typeKey, todo.length, existing.map((c) => c.certificateId)
  );

  // Resolve each person's history key before writing, so a candidate who has
  // been awarded before keeps the same one.
  const resolved = [];
  for (const r of todo) resolved.push(await resolveHolderKey(r));

  const dates = str(workshop.workshopDates) || '';
  const issuedDate = issuedOn || new Date().toISOString().slice(0, 10);

  const records = todo.map((r, i) =>
    certificateRecord({
      certificateId: ids[i],
      type: typeKey,
      recipientName: r.name,
      design: workshop.certificateDesign,
      workshopId: workshop.id,
      workshopTitle: workshop.title,
      workshopDates: dates,
      venue: workshop.venue,
      presentedBy: workshop.presentedBy,
      workshopCode: workshop.code,
      duration: workshop.durationHours
        ? `${workshop.durationHours} hours${dates ? ` · ${dates}` : ''}`
        : dates,
      time: [workshop.time, workshop.mode].filter(Boolean).join(' · '),
      topics: workshop.topics,
      ticketId: r.ticketId,
      holderKey: resolved[i].holderKey,
      issuedOn: issuedDate,
    })
  );

  const ops = [];
  records.forEach((rec, i) => {
    ops.push({ ref: doc(db, CERTIFICATES, rec.certificateId), data: { ...rec, createdAt: serverTimestamp() }, merge: false });

    // The public history entry.
    ops.push({
      ref: doc(db, HOLDERS, rec.holderKey),
      data: {
        name: rec.recipientName,
        entries: arrayUnion({
          certificateId: rec.certificateId,
          type: rec.type,
          typeLabel: rec.typeLabel,
          workshopTitle: rec.workshopTitle,
          workshopDates: rec.workshopDates,
          issuedOn: rec.issuedOn,
        }),
        updatedAt: serverTimestamp(),
      },
      merge: true,
    });

    // The private phone/email -> holderKey map, so the next award finds them.
    for (const idxId of resolved[i].ids) {
      ops.push({
        ref: doc(db, HOLDER_INDEX, idxId),
        data: { holderKey: rec.holderKey, updatedAt: serverTimestamp() },
        merge: true,
      });
    }
  });

  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH)) batch.set(op.ref, op.data, { merge: op.merge });
    await batch.commit();
  }

  return { issued: records, skipped };
}

/**
 * Withdraw a certificate without deleting it.
 *
 * The record stays readable so an old copy in circulation can still be looked
 * up — and is plainly marked withdrawn, which a missing record would not
 * achieve.
 */
export async function setCertificateRevoked(certificateId, revoked, reason = '') {
  await setDoc(
    doc(db, CERTIFICATES, str(certificateId).toUpperCase()),
    { revoked: Boolean(revoked), revokedReason: str(reason), updatedAt: serverTimestamp() },
    { merge: true }
  );
}
