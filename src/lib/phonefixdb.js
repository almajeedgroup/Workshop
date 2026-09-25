/**
 * Running the phone-number migration against Firestore.
 *
 * The rule that decides what changes lives in `phonefix.js` and touches no
 * database. This file is the part that reads and writes, kept separate so the
 * decision can be tested without one.
 *
 * IT RUNS AS THE SIGNED-IN ADMINISTRATOR, from the app, over the ordinary
 * client SDK. That is deliberate. The alternative — a Node script on
 * firebase-admin — needs a service-account key downloaded, stored and looked
 * after, which is a permanent credential created for a one-off tidy-up. The
 * existing security rules already say who may rewrite these documents, and
 * this way they are the thing enforcing it rather than something bypassing it.
 *
 * SCAN AND APPLY ARE SEPARATE CALLS. Nothing is written until the person has
 * seen the count and pressed again. The scan is a plain read: it can be run
 * at any time, by anyone, without consequence.
 */

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { WORKSHOP_FIELDS, REGISTRATION_FIELDS } from './schema.js';
import { phonePatch, before, writesFor, REQUEST_PHONE_FIELDS } from './phonefix.js';

const WORKSHOPS = 'workshops';
const REGISTRATIONS = 'registrations';
const REQUESTS = 'registrationRequests';
const PUBLIC_WORKSHOPS = 'publicWorkshops';

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 400;

/**
 * Everything that would change, and nothing changed yet.
 *
 * Reads every workshop, every registration under it, and every request —
 * including handled ones, because a rejected request can be restored and its
 * number dialled, so it has to be right too.
 */
export async function scanPhones() {
  const workshops = [];
  const registrations = [];
  const requests = [];

  // Which workshops have a published mirror, in one query rather than a
  // read each. A workshop that was never published has no mirror, and
  // merging into a document that does not exist would CREATE one holding
  // nothing but a phone number — a public record of a workshop with no
  // title, no dates and no venue.
  const published = new Set((await getDocs(collection(db, PUBLIC_WORKSHOPS))).docs.map((d) => d.id));

  const wsnap = await getDocs(collection(db, WORKSHOPS));
  for (const w of wsnap.docs) {
    const workshop = { id: w.id, ...w.data() };
    const patch = phonePatch(workshop, WORKSHOP_FIELDS);
    if (patch) {
      workshops.push({
        id: w.id,
        title: workshop.title || '(untitled)',
        patch,
        before: before(workshop, patch),
        mirrored: published.has(w.id),
      });
    }

    const rsnap = await getDocs(collection(db, WORKSHOPS, w.id, REGISTRATIONS));
    for (const r of rsnap.docs) {
      const reg = { id: r.id, ...r.data() };
      const rp = phonePatch(reg, REGISTRATION_FIELDS);
      if (rp) {
        registrations.push({
          workshopId: w.id,
          id: r.id,
          name: reg.name || '(no name)',
          patch: rp,
          before: before(reg, rp),
        });
      }
    }
  }

  const qsnap = await getDocs(collection(db, REQUESTS));
  for (const q of qsnap.docs) {
    const request = { id: q.id, ...q.data() };
    const patch = phonePatch(request, REQUEST_PHONE_FIELDS);
    if (patch) {
      requests.push({
        id: q.id, name: request.name || '(no name)', patch, before: before(request, patch),
      });
    }
  }

  return { workshops, registrations, requests };
}

/**
 * Write them.
 *
 * Merged patches, so a document keeps every field this migration has no
 * opinion about — and `updatedAt` is left alone on purpose: a record's
 * modification date should say when a person last changed it, not when a
 * formatter passed over it.
 */
export async function applyPhones(scan) {
  const writes = writesFor(scan);
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + BATCH_LIMIT)) {
      batch.set(doc(db, ...w.path), w.patch, { merge: true });
    }
    await batch.commit();
  }
  return writes.length;
}
