import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { courseDirectoryEntry, belongsInDirectory } from '../src/lib/publicdb.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const COURSE = {
  title: 'Artificial Intelligence, hands on',
  code: 'AIHOW26',
  startDate: '2026-02-09',
  endDate: '2026-02-14',
  mode: 'Hybrid',
  venue: 'Kabir IND PU College for Women',
  registrationOpen: 'Open',
  classOpen: 'Open',
  meetingRoom: 'room-1',
  libraryAccess: 'Open',
};

/* ---- what gets listed --------------------------------------------- */

test('a course with a title and a start date is listed', () => {
  assert.equal(belongsInDirectory(COURSE), true);
});

test('a draft somebody is still typing is not', () => {
  // Every workshop gets a public mirror the moment it is saved, so without
  // this line the directory would publish half-finished drafts with their
  // working titles the instant somebody pressed save.
  assert.equal(belongsInDirectory({ title: 'Untitled', startDate: '' }), false);
  assert.equal(belongsInDirectory({ title: '', startDate: '2026-02-09' }), false);
  assert.equal(belongsInDirectory({}), false);
  assert.equal(belongsInDirectory(null), false);
});

/* ---- what the entry carries --------------------------------------- */

test('the entry is a whitelist, and carries only poster facts', () => {
  const e = courseDirectoryEntry('AIHOW26', {
    ...COURSE,
    // None of these belong on a page anybody can read.
    feeAmount: 500, contactNumbers: ['+91 1'], paymentUpi: 'x@bank',
    meetingRoom: 'secret-room', lastTicketSeq: 12, outcome: 'internal notes',
  });
  assert.deepEqual(Object.keys(e).sort(), [
    'classOpen', 'code', 'endDate', 'id', 'libraryOpen',
    'mode', 'registrationOpen', 'startDate', 'title', 'venue',
  ]);
});

test('the ID is the thing a student has to type, and it is carried', () => {
  assert.equal(courseDirectoryEntry('AIHOW26', COURSE).id, 'AIHOW26');
});

test('what a reader can DO with it comes across as booleans', () => {
  const open = courseDirectoryEntry('W', COURSE);
  assert.equal(open.registrationOpen, true);
  assert.equal(open.classOpen, true);
  assert.equal(open.libraryOpen, true);

  const shut = courseDirectoryEntry('W', {
    ...COURSE, registrationOpen: 'Closed', classOpen: 'Closed', libraryAccess: 'Ticket',
  });
  assert.equal(shut.registrationOpen, false);
  assert.equal(shut.classOpen, false);
  assert.equal(shut.libraryOpen, false);
});

test('a missing field becomes an empty string, never "undefined"', () => {
  const e = courseDirectoryEntry('W', { title: 'T', startDate: '2026-01-01' });
  for (const k of ['code', 'endDate', 'mode', 'venue']) {
    assert.equal(e[k], '', k);
  }
});

/* ---- keeping it in step -------------------------------------------- */

test('the directory is written wherever the mirror is', () => {
  // The mirror is rewritten on every workshop save; the directory has to
  // ride with it or the two drift.
  const db = read('../src/lib/publicdb.js');
  const sync = db.slice(db.indexOf('export async function syncPublicWorkshop'));
  assert.match(sync.slice(0, 500), /updateCourseDirectory\(workshopId, workshop\)/);
  const remove = db.slice(db.indexOf('export async function removePublicWorkshop'));
  assert.match(remove.slice(0, 400), /updateCourseDirectory\(workshopId, \{\}\)/);
});

test('a directory failure never takes a workshop save down with it', () => {
  // It is a convenience. Losing an entry costs a lookup; losing the save
  // costs the office their work.
  const db = read('../src/lib/publicdb.js');
  const fn = db.slice(db.indexOf('export async function updateCourseDirectory'));
  assert.match(fn.slice(0, 900), /\} catch \{/);
});

test('it is one document, not a listable collection', () => {
  // Opening publicWorkshops to `list` would publish every draft. The
  // directory is a single document under the publicIndex rule that already
  // exists: public get, admin write.
  const db = read('../src/lib/publicdb.js');
  assert.match(db, /const PUBLIC_INDEX = 'publicIndex';/);
  const rules = read('../firestore.rules');
  const idx = rules.slice(rules.indexOf('match /publicIndex/'));
  assert.match(idx.slice(0, 200), /allow get: if true;/);
  assert.match(idx.slice(0, 200), /allow list, write: if isAdmin\(\);/);
  // And the mirror itself stays unlistable.
  const mirror = rules.slice(rules.indexOf('match /publicWorkshops/'));
  assert.match(mirror.slice(0, 200), /allow list: if isAdmin\(\);/);
});

/* ---- the page ------------------------------------------------------ */

test('the CODE is what the page is built around', () => {
  // A student knows what their course was called. What they cannot
  // remember is AIHOW26.
  const page = read('../src/pages/site/CoursesPage.jsx');
  assert.match(page, /cdir-code-id/);
  assert.match(page, /onClick=\{\(\) => copy\(c\.id\)\}/);
  assert.match(page, /Tap to copy/);
});

test('a refused clipboard says nothing, because nothing broke for the reader', () => {
  const page = read('../src/pages/site/CoursesPage.jsx');
  assert.match(page, /they can select it/);
});

test('the page offers the door that course actually has', () => {
  const page = read('../src/pages/site/CoursesPage.jsx');
  assert.match(page, /c\.registrationOpen && \(/);
  assert.match(page, /c\.classOpen && \(/);
  assert.match(page, /c\.libraryOpen && !c\.classOpen && !c\.registrationOpen/);
});

test('it is reachable from the one form that needs a course code', () => {
  // Without this a student who has lost their ticket has nowhere to go.
  const study = read('../src/pages/site/StudyPage.jsx');
  assert.match(study, /to="\/courses">Find your course code/);
  const footer = read('../src/components/site/SiteFooter.jsx');
  assert.match(footer, /to="\/courses"/);
  const app = read('../src/App.jsx');
  assert.match(app, /\['\/courses', <CoursesPage \/>\]/);
});

test('an empty directory still tells somebody what to do', () => {
  const page = read('../src/pages/site/CoursesPage.jsx');
  assert.match(page, /No course has been published yet/);
  assert.match(page, /ring the office/);
});

test('the office can rebuild it, and is told what was left out', () => {
  const db = read('../src/lib/publicdb.js');
  assert.match(db, /export async function rebuildCourseDirectory\(\)/);
  assert.match(db, /return \{ listed: courses\.length, skipped \};/);
  const list = read('../src/pages/ListPage.jsx');
  assert.match(list, /rebuildCourseDirectory\(\)/);
  assert.match(list, /left out for having no title or start date/);
});
