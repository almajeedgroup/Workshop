/**
 * The rules, tested by running them.
 *
 * Everything else in tests/ reads the rules file as text, which proves the
 * words are there and nothing about what they do. This starts the Firestore
 * emulator with firestore.rules loaded, points the app's OWN Firebase SDK at
 * it UNAUTHENTICATED — exactly the client a student has — and tries the
 * writes that matter, including the ones that must be refused.
 *
 *   npm run emulator      # in one terminal — needs Java
 *   npm run rules-audit   # in another
 *
 * It is a separate script rather than a test because it needs the emulator,
 * which needs Java and a download on first run; `npm test` must stay
 * zero-dependency and offline. RUN THIS WHENEVER THE RULES CHANGE, and
 * before deploying them.
 */

import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, collection, serverTimestamp, setLogLevel,
} from 'firebase/firestore';

/* A refusal is the expected result of most of this file, and the SDK logs
   every one of them at error level. Left on, the real output — which of the
   refusals did NOT happen — scrolls off the top. */
setLogLevel('silent');

const PROJECT = process.env.RULES_PROJECT || 'demo-workshop';
const HOST = process.env.FIRESTORE_EMULATOR || '127.0.0.1:8080';
const [host, port] = HOST.split(':');
const REST = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const probe = await fetch(`http://${HOST}/`).catch(() => null);
if (!probe) {
  console.error(`NO EMULATOR on ${HOST}. Start one with:`);
  console.error('  node node_modules/firebase-tools/lib/bin/firebase.js '
    + `emulators:start --only firestore --project ${PROJECT}`);
  process.exit(2);
}

/* LOAD THE RULES OFF DISK, EVERY RUN.
 *
 * The emulator does not reload firestore.rules when it changes — it holds
 * whatever it was started with. A run against a long-lived emulator would
 * therefore grade an edit that was never loaded, and report a clean sheet
 * for rules nobody has tested. (The same trap as a stale preview server
 * answering a contrast audit, and it cost an afternoon once already.) So
 * the file is pushed in before anything is tried, and the run fails loudly
 * if it cannot be. */
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const loaded = await fetch(
  `http://${HOST}/emulator/v1/projects/${PROJECT}:securityRules`,
  {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
  },
);
if (!loaded.ok) {
  console.error(`could not load firestore.rules into the emulator: ${loaded.status}`);
  console.error(await loaded.text());
  process.exit(2);
}

/* Seeding goes through the emulator's owner REST endpoint, which bypasses
   rules. Seeding through the SDK would need the rules to allow the very
   writes under test, which is the snake eating its tail. */
async function seed(path, fields) {
  const r = await fetch(`${REST}/${path.split('/').slice(0, -1).join('/')}`
    + `?documentId=${encodeURIComponent(path.split('/').pop())}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok && r.status !== 409) throw new Error(`seed ${path}: ${r.status} ${await r.text()}`);
}
async function wipe() {
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' });
}

const app = initializeApp({ projectId: PROJECT, apiKey: 'emulator' }, 'rules-audit');
const db = getFirestore(app);
connectFirestoreEmulator(db, host, Number(port));

let pass = 0;
const failures = [];
const show = (ok, what) => {
  if (ok) { pass += 1; console.log(`  ok    ${what}`); }
  else { failures.push(what); console.log(`  FAIL  ${what}`); }
};
/** The write must go through. */
async function allowed(what, fn) {
  try { await fn(); show(true, what); }
  catch (e) { show(false, `${what} — REFUSED: ${e.code || e.message}`); }
}
/** The write must be refused. A rule that permits this is the bug. */
async function refused(what, fn) {
  try { await fn(); show(false, `${what} — WENT THROUGH, and must not have`); }
  catch (e) {
    const denied = String(e.code || e.message).includes('permission-denied');
    show(denied, denied ? what : `${what} — failed, but not by the rules: ${e.code || e.message}`);
  }
}

const DAY = '2026-02-09';
const joinDoc = (w, day, ticket) => doc(db, 'workshops', w, 'attendance', day, 'joins', ticket);

/* ---------------------------------------------------------------- */
console.log('\nattendance/{day}/joins/{ticketId} — a student signing themselves in\n');

await wipe();
await seed('publicWorkshops/OPEN26', { classOpen: { booleanValue: true } });
await seed('publicWorkshops/SHUT26', { classOpen: { booleanValue: false } });

await allowed('an open class takes a sign-in from a stranger',
  () => setDoc(joinDoc('OPEN26', DAY, 'OPEN26-014'), { at: serverTimestamp() }));

await refused('a closed class takes none',
  () => setDoc(joinDoc('SHUT26', DAY, 'SHUT26-014'), { at: serverTimestamp() }));

await refused('a workshop with no public record takes none',
  () => setDoc(joinDoc('GHOST26', DAY, 'GHOST26-014'), { at: serverTimestamp() }));

/* The point of create-only: a student cannot rewrite their own entry, so a
   sign-in cannot be back-dated or moved to another day's document. */
await refused('the same ticket cannot be written twice',
  () => setDoc(joinDoc('OPEN26', DAY, 'OPEN26-014'), { at: serverTimestamp() }));
await refused('and cannot be updated',
  () => updateDoc(joinDoc('OPEN26', DAY, 'OPEN26-014'), { at: serverTimestamp() }));
await refused('and cannot be deleted',
  () => deleteDoc(joinDoc('OPEN26', DAY, 'OPEN26-014')));

/* The document holds one field and the server sets it. A client that could
   choose `at` could claim it arrived on time; one that could add fields
   could store anything it liked in somebody else's database. */
await refused('a client cannot choose the time',
  () => setDoc(joinDoc('OPEN26', DAY, 'OPEN26-020'), { at: new Date('2020-01-01') }));
await refused('a client cannot add a field',
  () => setDoc(joinDoc('OPEN26', DAY, 'OPEN26-021'), { at: serverTimestamp(), name: 'anyone' }));
await refused('a client cannot write an empty document',
  () => setDoc(joinDoc('OPEN26', DAY, 'OPEN26-022'), {}));

await refused('a day that is not a date is refused',
  () => setDoc(joinDoc('OPEN26', 'whenever', 'OPEN26-023'), { at: serverTimestamp() }));
await refused('a ticket too short to be one is refused',
  () => setDoc(joinDoc('OPEN26', DAY, 'AB'), { at: serverTimestamp() }));

/* THE REGISTER STAYS SHUT. This is what the whole shape exists to protect:
   a student can say they are here without being able to see who else is. */
await refused('a stranger cannot read the sign-ins back',
  () => getDocs(collection(db, 'workshops', 'OPEN26', 'attendance', DAY, 'joins')));
await refused('a stranger cannot read one sign-in',
  () => getDoc(joinDoc('OPEN26', DAY, 'OPEN26-014')));
await refused("a stranger cannot read the office's marks",
  () => getDoc(doc(db, 'workshops', 'OPEN26', 'attendance', DAY)));
await refused('a stranger cannot write the office\'s marks',
  () => setDoc(doc(db, 'workshops', 'OPEN26', 'attendance', DAY), { marks: { r0: 'present' } }));
await refused('a stranger cannot read the register',
  () => getDocs(collection(db, 'workshops', 'OPEN26', 'registrations')));

/* ---------------------------------------------------------------- */
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\n' + failures.map((f) => `  · ${f}`).join('\n'));
}
await deleteApp(app);
process.exit(failures.length ? 1 : 0);
