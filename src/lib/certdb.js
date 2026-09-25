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
import { issuerStamp, hasIssuerStamp, LEGACY_ISSUER } from './issuer.js';
import { matchKeys } from './dedupe.js';
import { ticketPrefixFor } from './tickets.js';
/* The SAME normalisation the register and the library claim use. A student
   who typed `aihow26 014` in one place and `AIHOW26-014` in another must
   land on the same document every time. */
import { ticketKey as ticketDocId } from './attendance.js';
import {
  certificateTypeCode, formatCertificateId, highestCertificateSeq,
  compareCertificateIds, certificateTypeByKey, certificateDesignByKey,
  DEFAULT_CERTIFICATE_DESIGN,
} from './certificates.js';

const CERTIFICATES = 'certificates';
const HOLDERS = 'holders';
const HOLDER_INDEX = 'holderIndex';
/**
 * How a student finds their own certificate.
 *
 *   workshops/{workshopId}/awards/{ticketId}
 *     { certificateId, type, typeLabel, issuedOn, holderKey }
 *
 * A certificate is readable by its ID and always has been — that is what
 * makes an employer able to check one. The problem this solves is different:
 * a student does not KNOW their ID. It is printed on a certificate they may
 * never have been handed, and `certificates` cannot be queried by anybody but
 * the office.
 *
 * So the pointer is keyed by the one thing the student does know: their
 * ticket. The rule then lets exactly one account read it — the one whose
 * membership names that ticket. Not every member of the course; the holder.
 *
 * It carries `holderKey` as well, which is the student's whole history
 * across courses in one further read. That document is already public to
 * anyone holding the key, and the person it belongs to is the one person
 * who should have it.
 *
 * NOTHING PERSONAL IS ADDED HERE that is not already on the certificate this
 * points at.
 */
const AWARDS = 'awards';
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
/**
 * The duration as a certificate should state it.
 *
 * `durationHours` is hours per day. On a single-day course that is simply
 * the length; across several days it is a daily figure, and printing it bare
 * beside a date range claims the whole course took three hours.
 */
export function durationLine(workshop, dates = '') {
  const hours = Number(workshop?.durationHours) || 0;
  const span = str(dates) || '';
  const multiDay = Boolean(workshop?.endDate && workshop.endDate !== workshop.startDate);
  if (!hours) return span;
  const h = `${hours} hour${hours === 1 ? '' : 's'}${multiDay ? ' a day' : ''}`;
  return span ? `${h} · ${span}` : h;
}

export function certificateRecord({
  certificateId, type, design, recipientName, workshopId, workshopTitle,
  workshopDates, venue, presentedBy, workshopCode, duration, time, topics,
  ticketId, holderKey, issuedOn, issuer = issuerStamp(),
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
    // WHO AWARDED THIS, recorded rather than looked up later. Read live from
    // a constant, every certificate ever issued would silently take on the
    // next name this school trades under — an employer checking a 2025
    // certificate would be shown a 2026 organisation.
    issuer: issuerStamp(issuer),
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
      // "3 hours · 7 Sep – 12 Sep" reads as a six-day course that lasted
      // three hours. Hours are per day whenever the course spans more than
      // one, so the line has to say so.
      duration: durationLine(workshop, dates),
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

    // Where the student looks it up, keyed by the one thing they know.
    if (rec.ticketId) {
      ops.push({
        ref: doc(db, WORKSHOPS, rec.workshopId, AWARDS, ticketDocId(rec.ticketId)),
        data: {
          certificateId: rec.certificateId,
          type: rec.type,
          typeLabel: rec.typeLabel,
          issuedOn: rec.issuedOn,
          holderKey: rec.holderKey,
          updatedAt: serverTimestamp(),
        },
        merge: true,
      });
    }

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

/* ------------------------------------------------------------------ *
 * Backfilling the issuer onto certificates issued before it was stamped
 * ------------------------------------------------------------------ */

/**
 * Every certificate, for the one screen that has to look at all of them.
 *
 * Admin-only by the rules, and read nowhere else: the public verifies one
 * certificate at a time by its exact ID, which is what keeps the set of them
 * from being walked.
 */
export async function listAllCertificates() {
  const snap = await getDocs(collection(db, CERTIFICATES));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Which certificates do not yet say who issued them.
 *
 * Reads nothing and writes nothing — the caller shows this before anything
 * is changed, the same way the phone-number migration does.
 */
export function scanIssuerStamps(certificates = []) {
  const missing = certificates.filter((c) => !hasIssuerStamp(c));
  return { missing, total: certificates.length, stamped: certificates.length - missing.length };
}

/**
 * Write the legacy issuer onto every certificate that lacks one.
 *
 * LEGACY_ISSUER, not the current constant. Reading the live one would be
 * correct only if this were run before the rebrand and would quietly destroy
 * what it exists to protect if it were run after — so the ordering trap is
 * removed rather than documented.
 */
export async function applyIssuerStamps(missing = []) {
  const stamp = issuerStamp(LEGACY_ISSUER);
  for (let i = 0; i < missing.length; i += 400) {
    const batch = writeBatch(db);
    for (const cert of missing.slice(i, i + 400)) {
      batch.set(doc(db, CERTIFICATES, cert.id ?? cert.certificateId), { issuer: stamp }, { merge: true });
    }
    await batch.commit();
  }
  return missing.length;
}

/* ------------------------------------------------------------------ *
 * What a student can look up
 * ------------------------------------------------------------------ */

/**
 * This ticket's certificate, if one was ever issued for it.
 *
 * Read by the student themselves. Returns null rather than throwing when
 * there is none, which is the ordinary case for a course still running —
 * and when the rules refuse, which is what a course whose awards have not
 * been published yet looks like from here.
 */
export async function getAward(workshopId, ticketId) {
  const ticket = ticketDocId(ticketId);
  if (!workshopId || !ticket) return null;
  const snap = await getDoc(doc(db, WORKSHOPS, workshopId, AWARDS, ticket)).catch(() => null);
  return snap?.exists() ? { ticketId: ticket, ...snap.data() } : null;
}

/**
 * Publish this course's certificates so its students can find them.
 *
 * Certificates issued before this index existed have no pointer, and neither
 * does one issued while it was failing. Rebuilding from the certificates
 * themselves is cheap and idempotent, so the office can simply run it — the
 * same shape as publishing the ticket list, and for the same reason.
 */
export async function syncAwardIndex(workshopId) {
  if (!workshopId) return { published: 0, withoutTicket: 0 };
  const certs = await listWorkshopCertificates(workshopId);

  let published = 0;
  let withoutTicket = 0;
  const ops = [];

  for (const c of certs) {
    const ticket = ticketDocId(c.ticketId);
    // A certificate issued to somebody with no ticket number cannot be
    // found this way. It is still valid and still verifiable by its ID;
    // it simply has no student-side door, and the office is told how many.
    if (!ticket) { withoutTicket += 1; continue; }
    ops.push({
      ref: doc(db, WORKSHOPS, workshopId, AWARDS, ticket),
      data: {
        certificateId: c.certificateId || c.id,
        type: str(c.type),
        typeLabel: str(c.typeLabel),
        issuedOn: str(c.issuedOn),
        holderKey: str(c.holderKey),
        updatedAt: serverTimestamp(),
      },
    });
    published += 1;
  }

  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH)) batch.set(op.ref, op.data, { merge: true });
    await batch.commit();
  }
  return { published, withoutTicket };
}
