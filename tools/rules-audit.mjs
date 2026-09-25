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
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
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
const AUTH_HOST = process.env.AUTH_EMULATOR || '127.0.0.1:9099';
const [host, port] = HOST.split(':');
const REST = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const probe = await fetch(`http://${HOST}/`).catch(() => null);
if (!probe) {
  console.error(`NO EMULATOR on ${HOST}. Start one with:`);
  console.error('  node node_modules/firebase-tools/lib/bin/firebase.js '
    + `emulators:start --only firestore --project ${PROJECT}`);
  process.exit(2);
}

/* PUSH THE RULES IN, EVERY RUN.
 *
 * The emulator does watch firestore.rules and reload it — an earlier version
 * of this comment claimed the opposite, and it was wrong. Pushing is still
 * what this does, for two better reasons than the one that was made up:
 *
 *   1. It pins the exact bytes under test. A watcher reload is asynchronous
 *      and the audit would otherwise be racing it — passing or failing
 *      depending on which won, which is how a sabotage check quietly stops
 *      checking anything.
 *   2. It lets RULES_FILE point somewhere else, so a sabotage can be tried
 *      against a COPY. Editing the real file to test it is what killed the
 *      emulator: the watcher read a half-written file, failed to parse it,
 *      and took the Auth emulator down with it mid-run.
 *
 * The run fails loudly if the push does not land. */
const RULES_FILE = process.env.RULES_FILE
  ? new URL(process.env.RULES_FILE, `file://${process.cwd()}/`)
  : new URL('../firestore.rules', import.meta.url);
const rules = await readFile(RULES_FILE, 'utf8');
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

/* ── IDENTITIES ──────────────────────────────────────────────────────────
 *
 * The student rules turn on WHO is asking, so an audit with no identities
 * can only ever test the stranger — and the stranger was never the risk.
 * The risk is the account anybody can create. These are real accounts in
 * the Auth emulator, signed in through the same SDK the app uses, so the
 * token the rules see is a token the rules would really see. */
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });

const WHO = {};
async function account(label, email) {
  const password = 'emulator-only-password';
  try {
    const c = await createUserWithEmailAndPassword(auth, email, password);
    WHO[label] = { uid: c.user.uid, email };
  } catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e;
    const c = await signInWithEmailAndPassword(auth, email, password);
    WHO[label] = { uid: c.user.uid, email };
  }
  return WHO[label];
}
/** Become somebody, or nobody. Every check below says which. */
async function as(label) {
  if (!label) return signOut(auth);
  const password = 'emulator-only-password';
  await signInWithEmailAndPassword(auth, WHO[label].email, password);
  return WHO[label];
}

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

/* ================================================================== *
 * The course library, and who may open it
 * ================================================================== */

console.log('\nlibrary, tickets, claims and members — a student signing in\n');

await wipe();
await seed('publicWorkshops/OPEN26', { classOpen: { booleanValue: true } });

const ADMIN = await account('admin', 'admin@example.test');
const ANA = await account('ana', 'ana@example.test');
const BEN = await account('ben', 'ben@example.test');

// The allow-list, which is the only thing that makes an administrator one.
await seed(`admins/${ADMIN.uid}`, { email: { stringValue: ADMIN.email } });
// Two tickets this course really issued, and one it did not.
await seed('workshops/OPEN26/tickets/OPEN26014', { at: { timestampValue: '2026-02-01T00:00:00Z' } });
await seed('workshops/OPEN26/tickets/OPEN26015', { at: { timestampValue: '2026-02-01T00:00:00Z' } });
await seed('workshops/OPEN26/library/item1', {
  title: { stringValue: 'Day one' }, kind: { stringValue: 'recording' },
  source: { stringValue: 'link' }, url: { stringValue: 'https://drive.example/a' },
  path: { stringValue: '' }, format: { stringValue: 'link' },
  bytes: { integerValue: '0' }, day: { stringValue: '2026-02-09' },
});

const claimDoc = (w, t) => doc(db, 'workshops', w, 'claims', t);
const memberDoc = (w, uid) => doc(db, 'workshops', w, 'members', uid);
const libraryCol = (w) => collection(db, 'workshops', w, 'library');
const myCourse = (uid, w) => doc(db, 'students', uid, 'courses', w);

/* ---- the shelf is shut to everyone who has not claimed ----------- */

await as(null);
await refused('a stranger cannot read the library',
  () => getDocs(libraryCol('OPEN26')));

await as('ana');
await refused('and NEITHER CAN A SIGNED-IN ACCOUNT that has claimed nothing',
  () => getDocs(libraryCol('OPEN26')));
await refused('a signed-in account cannot read the register either',
  () => getDocs(collection(db, 'workshops', 'OPEN26', 'registrations')));
await refused('nor the ticket index it would need to guess from',
  () => getDocs(collection(db, 'workshops', 'OPEN26', 'tickets')));
await refused('nor put anything on the shelf',
  () => setDoc(doc(libraryCol('OPEN26'), 'mine'), {
    title: 'x', kind: 'notes', source: 'link', url: 'https://e.org/a',
    path: '', format: 'link', bytes: 0, day: '',
  }));

/* ---- claiming ---------------------------------------------------- */

await as(null);
await refused('a stranger cannot claim a ticket at all',
  () => setDoc(claimDoc('OPEN26', 'OPEN26014'), { uid: 'nobody', at: serverTimestamp() }));

await as('ana');
await refused('a ticket the course never issued cannot be claimed',
  () => setDoc(claimDoc('OPEN26', 'OPEN26999'), { uid: WHO.ana.uid, at: serverTimestamp() }));
await refused('a claim must name the account making it, not somebody else',
  () => setDoc(claimDoc('OPEN26', 'OPEN26014'), { uid: WHO.ben.uid, at: serverTimestamp() }));
await refused('a claim cannot carry a time of the client’s choosing',
  () => setDoc(claimDoc('OPEN26', 'OPEN26014'), { uid: WHO.ana.uid, at: new Date('2020-01-01') }));
await allowed('a real ticket can be claimed by a signed-in account',
  () => setDoc(claimDoc('OPEN26', 'OPEN26014'), { uid: WHO.ana.uid, at: serverTimestamp() }));

/* ---- the membership the library rule reads ----------------------- */

await allowed('and that claim lets the same account write its membership',
  () => setDoc(memberDoc('OPEN26', WHO.ana.uid), {
    ticketId: 'OPEN26014', name: 'Ana', email: WHO.ana.email, at: serverTimestamp(),
  }));
await allowed('which opens the shelf',
  () => getDocs(libraryCol('OPEN26')));
await allowed('and lets her keep her own list of courses',
  () => setDoc(myCourse(WHO.ana.uid, 'OPEN26'), { ticketId: 'OPEN26014', at: serverTimestamp() }));

/* ---- and none of it leaks sideways ------------------------------- */

await as('ben');
await refused('THE LOCK HOLDS: a second account cannot take a claimed ticket',
  () => setDoc(claimDoc('OPEN26', 'OPEN26014'), { uid: WHO.ben.uid, at: serverTimestamp() }));
await refused('nor write a membership against somebody else’s claim',
  () => setDoc(memberDoc('OPEN26', WHO.ben.uid), {
    ticketId: 'OPEN26014', name: 'Ben', email: WHO.ben.email, at: serverTimestamp(),
  }));
await refused('nor invent a membership for a ticket nobody claimed',
  () => setDoc(memberDoc('OPEN26', WHO.ben.uid), {
    ticketId: 'OPEN26015', name: 'Ben', email: WHO.ben.email, at: serverTimestamp(),
  }));
await refused('nor write a membership INTO ANOTHER ACCOUNT',
  () => setDoc(memberDoc('OPEN26', WHO.ana.uid), {
    ticketId: 'OPEN26014', name: 'Ben', email: WHO.ben.email, at: serverTimestamp(),
  }));
await refused('nor read whose accounts are in the course',
  () => getDocs(collection(db, 'workshops', 'OPEN26', 'members')));
await refused('nor read another student’s list of courses',
  () => getDocs(collection(db, 'students', WHO.ana.uid, 'courses')));
await refused('and the shelf is still shut to him',
  () => getDocs(libraryCol('OPEN26')));

/* A row in your own list is NOT a permission. This is the check that says
   so: Ben may write his own list freely, and it opens nothing. */
await allowed('a student may write their own course list',
  () => setDoc(myCourse(WHO.ben.uid, 'OPEN26'), { ticketId: 'OPEN26015', at: serverTimestamp() }));
await refused('and forging a row in it still opens nothing',
  () => getDocs(libraryCol('OPEN26')));

/* ---- a member of one course is not a member of another ----------- */

await seed('workshops/OTHER26/library/item1', {
  title: { stringValue: 'Not hers' }, kind: { stringValue: 'notes' },
  source: { stringValue: 'link' }, url: { stringValue: 'https://e.org/b' },
  path: { stringValue: '' }, format: { stringValue: 'link' },
  bytes: { integerValue: '0' }, day: { stringValue: '' },
});
await as('ana');
await refused('a member of one course cannot read another course’s shelf',
  () => getDocs(libraryCol('OTHER26')));

/* ---- a student cannot let themselves out of the office's reach --- */

await refused('a member cannot delete their own membership to dodge revocation',
  () => deleteDoc(memberDoc('OPEN26', WHO.ana.uid)));
await refused('nor release the claim that locks their ticket',
  () => deleteDoc(claimDoc('OPEN26', 'OPEN26014')));
await refused('nor edit the shelf they can read',
  () => deleteDoc(doc(libraryCol('OPEN26'), 'item1')));

/* ---- and the office can do its job ------------------------------- */

await as('admin');
await allowed('the office reads who is in the course',
  () => getDocs(collection(db, 'workshops', 'OPEN26', 'members')));
await allowed('publishes the ticket index',
  () => setDoc(doc(db, 'workshops', 'OPEN26', 'tickets', 'OPEN26016'), { at: serverTimestamp() }));
await allowed('puts something on the shelf',
  () => setDoc(doc(libraryCol('OPEN26'), 'item2'), {
    title: 'Slides', kind: 'notes', source: 'file', url: '',
    path: 'workshops/OPEN26/library/x.pptx', text: '', format: 'ppt',
    bytes: 2048, day: '2026-02-09', addedAt: serverTimestamp(),
  }));
await allowed('and the class notes that were typed live',
  () => setDoc(doc(libraryCol('OPEN26'), 'notes-2026-02-09'), {
    title: 'Class notes', kind: 'notes', source: 'text', url: '', path: '',
    text: 'What a model is.', format: 'text',
    bytes: 0, day: '2026-02-09', addedAt: serverTimestamp(),
  }));
/* EVERY field is required, not merely allowed. The record builder writes all
   of them, always, so a document arriving without one did not come from this
   app — and the shape is the only thing standing between a shelf item and
   whatever a stolen session felt like storing. Found by this check: adding
   `text` to the rules refused every item written before it existed. */
await refused('but not an item missing one of the fields',
  () => setDoc(doc(libraryCol('OPEN26'), 'item6'), {
    title: 'No text key', kind: 'notes', source: 'link', url: 'https://e.org/a',
    path: '', format: 'link', bytes: 0, day: '', addedAt: serverTimestamp(),
  }));
await refused('but not a shelf item with a field nobody named',
  () => setDoc(doc(libraryCol('OPEN26'), 'item3'), {
    title: 'x', kind: 'notes', source: 'link', url: '', path: '', format: 'link',
    bytes: 0, day: '', addedAt: serverTimestamp(), owner: 'someone',
  }));
await refused('nor one whose kind is not one of the two',
  () => setDoc(doc(libraryCol('OPEN26'), 'item4'), {
    title: 'x', kind: 'lecture', source: 'link', url: '', path: '', format: 'link',
    bytes: 0, day: '', addedAt: serverTimestamp(),
  }));
await refused('nor one with no title to show',
  () => setDoc(doc(libraryCol('OPEN26'), 'item5'), {
    title: '', kind: 'notes', source: 'link', url: '', path: '', format: 'link',
    bytes: 0, day: '', addedAt: serverTimestamp(),
  }));
await allowed('and takes an account’s access away again',
  () => deleteDoc(memberDoc('OPEN26', WHO.ana.uid)));
await allowed('releasing the ticket for whoever it really belongs to',
  () => deleteDoc(claimDoc('OPEN26', 'OPEN26014')));

await as('ana');
await refused('after which the shelf is shut to her again',
  () => getDocs(libraryCol('OPEN26')));

await as(null);

/* ---------------------------------------------------------------- */
console.log(`\n${pass} passed, ${failures.length} failed`
  + (process.env.RULES_FILE ? `   [${process.env.RULES_FILE}]` : ''));
if (failures.length) {
  console.log('\n' + failures.map((f) => `  · ${f}`).join('\n'));
}
await deleteApp(app);
process.exit(failures.length ? 1 : 0);
