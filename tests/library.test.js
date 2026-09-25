import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FORMATS, LIBRARY_KINDS, MAX_FILE_BYTES, MAX_TEXT, libraryFormat,
  extensionOf, formatOfFile, formatOfLink, formatBytes,
  libraryRecord, libraryTitle, libraryFilePath, tidyShareLink,
  sortLibrary, libraryByDay, libraryCounts,
} from '../src/lib/library.js';

/* ---- extensions -------------------------------------------------- */

test('an extension is read off the end, lower-cased', () => {
  assert.equal(extensionOf('Session 2.PPTX'), 'pptx');
  assert.equal(extensionOf('notes.tar.gz'), 'gz');
});

test('a query string is not an extension', () => {
  // Storage download URLs carry ?alt=media&token=… after the name.
  assert.equal(extensionOf('/a/b/slides.pdf?alt=media&token=abc'), 'pdf');
  assert.equal(extensionOf('/a/b/slides.pdf#page=2'), 'pdf');
});

test('a name with no extension, or a trailing dot, has none', () => {
  assert.equal(extensionOf('README'), '');
  assert.equal(extensionOf('trailing.'), '');
  assert.equal(extensionOf(''), '');
  assert.equal(extensionOf(null), '');
});

/* ---- what a file is ---------------------------------------------- */

test('the usual course files are recognised by name', () => {
  assert.equal(formatOfFile('day-one.mp4'), 'video');
  assert.equal(formatOfFile('deck.pptx'), 'ppt');
  assert.equal(formatOfFile('deck.ppt'), 'ppt');
  assert.equal(formatOfFile('handout.pdf'), 'pdf');
  assert.equal(formatOfFile('brief.docx'), 'doc');
  assert.equal(formatOfFile('marks.xlsx'), 'xls');
  assert.equal(formatOfFile('marks.csv'), 'xls');
});

test('the NAME beats the declared type, because the browser often lies', () => {
  // An unregistered .pptx arrives as application/octet-stream, which says
  // nothing. The extension is what the person who named it meant.
  assert.equal(formatOfFile('deck.pptx', 'application/octet-stream'), 'ppt');
});

test('an unknown name falls back to the declared type', () => {
  assert.equal(formatOfFile('recording', 'video/mp4'), 'video');
  assert.equal(formatOfFile('sheet', 'application/vnd.ms-excel'), 'xls');
  assert.equal(
    formatOfFile('d', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    'ppt',
  );
});

test('something nobody can identify is a link, not a guess', () => {
  assert.equal(formatOfFile('mystery', ''), 'link');
  assert.equal(formatOfFile('mystery', 'application/octet-stream'), 'link');
});

/* ---- what a link points at --------------------------------------- */

test("Google's own apps say what they are in the path", () => {
  assert.equal(formatOfLink('https://docs.google.com/presentation/d/abc/edit'), 'ppt');
  assert.equal(formatOfLink('https://docs.google.com/document/d/abc/edit'), 'doc');
  assert.equal(formatOfLink('https://docs.google.com/spreadsheets/d/abc/edit'), 'xls');
});

test('a Drive file link stays a link, because Drive will not say', () => {
  // Guessing here would be worse than not guessing: a slide deck labelled
  // Video sends somebody looking for a recording that is not there.
  assert.equal(formatOfLink('https://drive.google.com/file/d/abc/view'), 'link');
});

test('a video host is a video', () => {
  assert.equal(formatOfLink('https://www.youtube.com/watch?v=abc'), 'video');
  assert.equal(formatOfLink('https://youtu.be/abc'), 'video');
  assert.equal(formatOfLink('https://vimeo.com/123'), 'video');
});

test('a link ending in a known extension is taken at its word', () => {
  assert.equal(formatOfLink('https://example.org/files/day-1.mp4'), 'video');
  assert.equal(formatOfLink('https://example.org/files/notes.pdf?x=1'), 'pdf');
});

test('nonsense is a link rather than a throw', () => {
  assert.equal(formatOfLink('not a url'), 'link');
  assert.equal(formatOfLink(''), 'link');
  assert.equal(formatOfLink(null), 'link');
});

/* ---- tidying a shared link --------------------------------------- */

test('an editing link becomes a reading link', () => {
  // Pasted out of the address bar of an open document. A student with
  // view-only access following /edit gets the editor in a degraded state or
  // a permission wall, depending on the file.
  assert.equal(tidyShareLink('https://docs.google.com/presentation/d/ABC/edit#slide=id.p'),
    'https://docs.google.com/presentation/d/ABC/preview');
  assert.equal(tidyShareLink('https://docs.google.com/document/d/XYZ/edit?usp=sharing'),
    'https://docs.google.com/document/d/XYZ/preview');
  assert.equal(tidyShareLink('https://docs.google.com/spreadsheets/d/S1/edit#gid=0'),
    'https://docs.google.com/spreadsheets/d/S1/preview');
});

test("Drive's own tracking and the office's scroll position are dropped", () => {
  assert.equal(tidyShareLink('https://drive.google.com/file/d/F1/view?usp=drive_link'),
    'https://drive.google.com/file/d/F1/view');
});

test('the old open?id= share format is turned into one that opens', () => {
  assert.equal(tidyShareLink('https://drive.google.com/open?id=F2'),
    'https://drive.google.com/file/d/F2/view');
});

test('a link that is not Google is left completely alone', () => {
  // Rewriting somebody else's URLs on a guess is how a working link becomes
  // a broken one.
  for (const u of [
    'https://www.youtube.com/watch?v=abc',
    'https://example.org/a.pdf?x=1#page=2',
    'https://onedrive.live.com/edit?id=1',
  ]) assert.equal(tidyShareLink(u), u, u);
});

test('nonsense comes back as it went in, not as a throw', () => {
  assert.equal(tidyShareLink('not a url'), 'not a url');
  assert.equal(tidyShareLink(''), '');
  assert.equal(tidyShareLink(null), '');
  assert.equal(tidyShareLink('javascript:alert(1)'), 'javascript:alert(1)');
});

test('every stored link is tidied, whatever path it arrived by', () => {
  // In the record builder rather than the form, so the handouts carried over
  // when a class closes get it too.
  const r = libraryRecord({
    title: 'Slides', kind: 'notes', source: 'link',
    url: 'https://docs.google.com/presentation/d/ABC/edit?usp=sharing',
  });
  assert.equal(r.url, 'https://docs.google.com/presentation/d/ABC/preview');
});

test('tidying does not change what format a link is read as', () => {
  const r = libraryRecord({ title: 'x', kind: 'notes', source: 'link',
    url: 'https://docs.google.com/spreadsheets/d/S1/edit' });
  assert.equal(r.format, 'xls');
});

/* ---- sizes ------------------------------------------------------- */

test('a size is rounded to something a person can act on', () => {
  assert.equal(formatBytes(900), '900 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(120 * 1024 * 1024), '120 MB');
  assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024), '2.5 GB');
});

test('an unknown size says nothing rather than claiming to be nothing', () => {
  for (const v of [0, -1, NaN, null, undefined, 'big']) assert.equal(formatBytes(v), '');
});

/* ---- being refused the admin area -------------------------------- */

test('the refusal branches on WHICH account, because only one is a fault', () => {
  // A browser holds one signed-in account at a time, so signing in as a
  // student signs you in here too. Telling that person to hand-create a
  // Firestore document is alarming, irrelevant, and sends them into the
  // console to fix a session.
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const block = app.slice(app.indexOf('function Protected'));
  assert.match(block, /const owner = \(user\.email \|\| ''\)\.toLowerCase\(\) === BOOTSTRAP_ADMIN_EMAIL/);
  assert.match(block, /This is not an administrator account/);
  assert.match(block, /The owner account could not add itself/);
  // The student is sent somewhere useful rather than left on a dead end.
  assert.match(block, /one signed-in account at a time/);
  assert.match(block, /to="\/study">Your courses/);
  // And the Firestore instructions are shown ONLY to the owner.
  const studentHalf = block.slice(block.indexOf(') : ('));
  assert.doesNotMatch(studentHalf.slice(0, studentHalf.indexOf('</>')), /admins<\/code> collection/);
});

test('the address is the same in the app and in the rules', () => {
  // The refusal screen names this as a thing to check, so it is worth
  // checking automatically instead.
  const schema = readFileSync(new URL('../src/lib/schema.js', import.meta.url), 'utf8');
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const inApp = schema.match(/BOOTSTRAP_ADMIN_EMAIL = '([^']+)'/)[1].toLowerCase();
  assert.ok(rules.includes(`== '${inApp}'`),
    `firestore.rules does not bootstrap ${inApp}; the owner could never sign in`);
});

test('a refused bootstrap says why in the console, since the screen can only guess', () => {
  const db = readFileSync(new URL('../src/lib/db.js', import.meta.url), 'utf8');
  const fn = db.slice(db.indexOf('export async function registerOwner'));
  assert.match(fn, /console\.warn\('Owner could not add itself/);
});

/* ---- a library opened to everybody ------------------------------- */

test('opening a library is PER COURSE, not one switch for the app', () => {
  // A single switch would mean opening an outreach course also gives away
  // the recordings of a paid one.
  const db = readFileSync(new URL('../src/lib/librarydb.js', import.meta.url), 'utf8');
  assert.match(db, /export async function setLibraryAccess\(workshopId, workshop, open\)/);
  assert.match(db, /libraryAccess: open \? 'Open' : 'Ticket'/);
});

test('the rules read the MIRROR, because they cannot see the workshop', () => {
  const pub = readFileSync(new URL('../src/lib/publicdb.js', import.meta.url), 'utf8');
  assert.match(pub, /libraryOpen: str\(workshop\.libraryAccess\) === 'Open'/);
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /function libraryIsOpen\(workshopId\)/);
  assert.match(rules, /\.data\.get\('libraryOpen', false\) == true/);
});

test('an open library still needs an ACCOUNT, not merely a URL', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /\|\| \(request\.auth != null && libraryIsOpen\(workshopId\)\)/);
});

test('the index that lists open courses grants nothing', () => {
  // Access is decided by libraryOpen on the mirror. A stale entry in the
  // index names a course whose shelf still refuses to open.
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const block = rules.slice(rules.indexOf('match /publicIndex/'));
  assert.match(block, /allow get: if true;/);
  assert.match(block, /allow list, write: if isAdmin\(\);/);
});

test('the page decides on the same field the rules do', () => {
  // A page that decided for itself would eventually show a shelf the
  // database then refused to fill.
  const page = readFileSync(new URL('../src/pages/site/StudyCoursePage.jsx', import.meta.url), 'utf8');
  assert.match(page, /ws\?\.libraryOpen === true/);
  assert.match(page, /if \(!member && !anyone\) \{ setState\('denied'\); return; \}/);
});

test('a student is not shown the same course twice', () => {
  const page = readFileSync(new URL('../src/pages/site/StudyPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /filter\(\(c\) => !claimed\.has\(c\.id\)\)/);
});

test('opening a library asks first, and closing it does not', () => {
  // Opening gives the recordings away to anybody who makes an account, and
  // closing later cannot take back what has been downloaded.
  const panel = readFileSync(new URL('../src/components/LibraryPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /openConfirm/);
  assert.match(panel, /Yes, open it to everyone/);
  assert.match(panel, /does not take back what anybody has already downloaded/);
  // Closing is one press.
  assert.match(panel, /onClick=\{\(\) => setOpen\(false\)\}/);
});

/* ---- the student's door ------------------------------------------ */

test('a popup that cannot open falls back to a redirect', () => {
  // Links to this site get sent on WhatsApp, and a WhatsApp link opens in
  // WhatsApp's own browser, where Google refuses OAuth in a popup outright.
  // A popup-only sign-in is unusable for most of this audience.
  const ctx = readFileSync(new URL('../src/AuthContext.jsx', import.meta.url), 'utf8');
  const student = ctx.slice(ctx.indexOf('loginStudentWithGoogle'));
  assert.match(student, /signInWithRedirect\(auth, provider\)/);
  assert.match(student, /'auth\/popup-blocked'/);
  assert.match(student, /'auth\/operation-not-supported-in-this-environment'/);
  // …and the other half: a redirect finishes on a LATER page load, so its
  // failure has no handler unless the result is asked for.
  assert.match(ctx, /getRedirectResult\(auth\)/);
});

test('there is a way in that does not need Google at all', () => {
  const ctx = readFileSync(new URL('../src/AuthContext.jsx', import.meta.url), 'utf8');
  assert.match(ctx, /createUserWithEmailAndPassword/);
  assert.match(ctx, /const signUpStudent/);
  assert.match(ctx, /const signInStudent/);
  // A name given at sign-up must reach the office's members list, and
  // onAuthStateChanged has already fired by then with no name on it.
  assert.match(ctx, /updateProfile\(credential\.user, \{ displayName: clean \}\)/);
  assert.match(ctx, /setUser\(snapshot\(credential\.user\)\)/);
});

test('the signed-out page offers both, and names the two acts separately', () => {
  const page = readFileSync(new URL('../src/pages/site/StudyPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /Continue with Google/);
  assert.match(page, /I have an account/);
  assert.match(page, /Create an account/);
  assert.match(page, /Email me a reset link/);
});

test('a failure says what to do, not what the code was', () => {
  const page = readFileSync(new URL('../src/pages/site/StudyPage.jsx', import.meta.url), 'utf8');
  // invalid-credential covers a wrong password AND an address with no
  // account, and Firebase will not say which — so the message names both
  // rather than guessing at the likelier.
  assert.match(page, /'auth\/invalid-credential'/);
  assert.match(page, /Create an account" if you have not made one yet/);
  // The two that are somebody else's job to fix say so.
  assert.match(page, /'auth\/operation-not-allowed'/);
  assert.match(page, /'auth\/unauthorized-domain'/);
  assert.match(page, /it is a setting at their end|one setting at their end/);
});

test('a student who lands on the administrators\' page is sent to the right one', () => {
  const login = readFileSync(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8');
  assert.match(login, /Your courses" on the main site/);
});

test('the panel says the one thing that actually breaks a Drive link', () => {
  // Sharing left on Restricted gives students a "Request access" page. No
  // browser can detect that, so the panel has to say it.
  const panel = readFileSync(new URL('../src/components/LibraryPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /Anyone with the link/);
  assert.match(panel, /Request access/);
});

test('uploads are offered only when there is somewhere to put them', () => {
  const panel = readFileSync(new URL('../src/components/LibraryPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /canStoreFiles/);
  // And a project without a bucket is told it is a plan, not a fault.
  assert.match(panel, /needs a paid plan|needs a Firebase Storage bucket/);
});

test('firebase.json does NOT deploy storage rules, because there is no bucket', () => {
  // `npm run deploy` is a FULL deploy. A storage target on a project with no
  // bucket fails the whole thing, not just that part.
  const cfg = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  assert.equal(cfg.storage, undefined);
  const rules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
  assert.match(rules, /NOT CURRENTLY DEPLOYED/, 'and the file says so, so it is not a mystery');
  assert.match(rules, /TO SWITCH UPLOADS ON/, 'with the steps to change that');
});

test('the cap matches the one the storage rules enforce', () => {
  assert.equal(MAX_FILE_BYTES, 512 * 1024 * 1024);
  const rules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
  assert.match(rules, /512 \* 1024 \* 1024/,
    'the browser must not offer to upload something the bucket will refuse');
});

/* ---- titles ------------------------------------------------------ */

test('a given title wins', () => {
  assert.equal(libraryTitle('Day one — models', 'whatever.pdf'), 'Day one — models');
});

test('a missing title is read out of the file name, not printed from it', () => {
  assert.equal(libraryTitle('', 'Session_2-final.pptx'), 'Session 2 final');
  assert.equal(libraryTitle('   ', 'day-one.mp4'), 'day one');
});

test('a file with nothing to go on is Untitled, not blank', () => {
  assert.equal(libraryTitle('', ''), 'Untitled');
});

/* ---- the record -------------------------------------------------- */

test('a link item keeps its url and stores no path or size', () => {
  const r = libraryRecord({
    title: 'Day one', kind: 'recording', source: 'link',
    url: 'https://drive.google.com/file/d/abc/view', day: '2026-02-09',
  });
  assert.deepEqual(r, {
    title: 'Day one', kind: 'recording', source: 'link',
    url: 'https://drive.google.com/file/d/abc/view', path: '', text: '',
    format: 'link', bytes: 0, day: '2026-02-09',
  });
});

test('a file item keeps its path and stores no url', () => {
  const r = libraryRecord({
    title: '', kind: 'notes', source: 'file',
    path: 'workshops/W/library/x.pptx', fileName: 'Deck.pptx', bytes: 2048.7,
  });
  assert.equal(r.url, '');
  assert.equal(r.path, 'workshops/W/library/x.pptx');
  assert.equal(r.format, 'ppt');
  assert.equal(r.title, 'Deck');
  assert.equal(r.bytes, 2049, 'bytes are a whole number');
});

/* ---- the third source: words, not a file ------------------------- */

test('typed class notes are kept as text, not made into a file', () => {
  const r = libraryRecord({
    title: 'Class notes', kind: 'notes', source: 'text',
    text: 'line one\nline two', day: '2026-02-09',
  });
  assert.equal(r.source, 'text');
  assert.equal(r.format, 'text');
  assert.equal(r.text, 'line one\nline two');
  assert.equal(r.url, '');
  assert.equal(r.path, '');
  assert.equal(r.bytes, 0);
});

test('only a text item carries text, so the other two cannot smuggle any', () => {
  // The rules cap `text` at 100000 and name a fixed field list. A link item
  // that carried text would be a second, unbounded payload nobody checks.
  assert.equal(libraryRecord({ title: 't', source: 'link', url: 'https://e.org/a', text: 'x' }).text, '');
  assert.equal(libraryRecord({ title: 't', source: 'file', path: 'p', text: 'x' }).text, '');
});

test('text is capped at what the rules allow', () => {
  const r = libraryRecord({ title: 't', source: 'text', text: 'x'.repeat(MAX_TEXT + 500) });
  assert.equal(r.text.length, MAX_TEXT);
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /sized\(request\.resource\.data\.text, 100000\)/,
    'the browser must not offer to store what the database will refuse');
  assert.equal(MAX_TEXT, 100000);
});

test('the rules know about all three sources', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /source in \['link', 'file', 'text'\]/);
  assert.match(rules, /'title', 'kind', 'source', 'url', 'path', 'text',/);
});

test('the record is a whitelist: nothing else gets through', () => {
  // The form state carries React keys and half-finished fields. A spread
  // would store them and then have to be defended in the rules.
  const r = libraryRecord({
    title: 'x', kind: 'notes', source: 'link', url: 'https://e.org/a.pdf',
    _key: 'row-1', secret: 'no', addedAt: 'spoofed', bytes: 99,
  });
  assert.deepEqual(
    Object.keys(r).sort(),
    ['bytes', 'day', 'format', 'kind', 'path', 'source', 'text', 'title', 'url'],
  );
  assert.equal(r.bytes, 0, 'a link has no size of ours to report');
});

test('an unrecognised kind, source or format falls back rather than storing junk', () => {
  const r = libraryRecord({ title: 't', kind: 'lecture', source: 'magic', format: 'hologram' });
  assert.equal(r.kind, 'notes');
  assert.equal(r.source, 'link');
  assert.equal(r.format, 'link');
});

test('a day must be a date, or it is not a day', () => {
  assert.equal(libraryRecord({ title: 't', day: '2026-02-09' }).day, '2026-02-09');
  for (const bad of ['tuesday', '9/2/2026', '2026-2-9', '']) {
    assert.equal(libraryRecord({ title: 't', day: bad }).day, '', bad);
  }
});

/* ---- where a file is stored -------------------------------------- */

test('an uploaded file is namespaced by workshop, because the rules read that', () => {
  const p = libraryFilePath('AIHOW26', 'Deck.pptx', new Date('2026-02-09T10:00:00Z'), () => 0.5);
  assert.match(p, /^workshops\/AIHOW26\/library\//);
  assert.match(p, /\.pptx$/);
});

test('two files of the same name are two files', () => {
  const a = libraryFilePath('W', 'notes.pdf', new Date('2026-02-09T10:00:00Z'), () => 0.1);
  const b = libraryFilePath('W', 'notes.pdf', new Date('2026-02-09T10:00:00Z'), () => 0.9);
  assert.notEqual(a, b);
});

test('a name from a file system does not reach the URL', () => {
  const p = libraryFilePath('W', '../../etc/pass wd?.pdf', new Date('2026-01-01T00:00:00Z'), () => 0.5);
  assert.doesNotMatch(p.slice('workshops/W/library/'.length), /[/?\s]/);
  assert.match(p, /^workshops\/W\/library\/[^/]+$/);
});

/* ---- reading the shelf ------------------------------------------- */

const SHELF = [
  { title: 'Notes two', kind: 'notes', day: '2026-02-10' },
  { title: 'Course pack', kind: 'notes', day: '' },
  { title: 'Day two', kind: 'recording', day: '2026-02-10' },
  { title: 'Day one', kind: 'recording', day: '2026-02-09' },
  { title: 'Notes one', kind: 'notes', day: '2026-02-09' },
];

test('the shelf reads earliest first, because a course is a sequence', () => {
  assert.deepEqual(sortLibrary(SHELF).map((i) => i.title),
    ['Day one', 'Notes one', 'Day two', 'Notes two', 'Course pack']);
});

test('the recording comes before its notes', () => {
  const day = sortLibrary(SHELF).filter((i) => i.day === '2026-02-09');
  assert.deepEqual(day.map((i) => i.kind), ['recording', 'notes']);
});

test('undated items go last, not first', () => {
  // They belong to the course rather than to a session; somebody looking
  // for Tuesday should not scroll past them to reach it.
  assert.equal(sortLibrary(SHELF).at(-1).title, 'Course pack');
});

test('sorting does not disturb what it was given', () => {
  const before = SHELF.map((i) => i.title);
  sortLibrary(SHELF);
  assert.deepEqual(SHELF.map((i) => i.title), before);
});

test('the shelf groups into the days it covers', () => {
  const days = libraryByDay(SHELF);
  assert.deepEqual(days.map((d) => d.day), ['2026-02-09', '2026-02-10', '']);
  assert.deepEqual(days[0].items.map((i) => i.title), ['Day one', 'Notes one']);
});

test('an empty shelf is no days, not one empty day', () => {
  assert.deepEqual(libraryByDay([]), []);
  assert.deepEqual(libraryCounts([]), { recording: 0, notes: 0, total: 0 });
});

test('the counts say what is on the shelf', () => {
  assert.deepEqual(libraryCounts(SHELF), { recording: 2, notes: 3, total: 5 });
});

/* ---- the vocabulary ---------------------------------------------- */

test('carrying a class onto the shelf is idempotent by construction', () => {
  // Closing, reopening and closing again is a normal afternoon. The IDs are
  // derived from what is carried, not generated, so a second close rewrites
  // the same documents instead of writing a second copy of everything.
  const db = readFileSync(new URL('../src/lib/librarydb.js', import.meta.url), 'utf8');
  assert.match(db, /`notes-\$\{day\}`/);
  assert.match(db, /`handout-\$\{h\.id\}`/);
  assert.doesNotMatch(db.slice(db.indexOf('keepClassMaterial')), /addDoc/,
    'a generated ID would duplicate the whole shelf on the second close');
});

test('a handout with nothing to point at is left behind, not shelved dead', () => {
  const db = readFileSync(new URL('../src/lib/librarydb.js', import.meta.url), 'utf8');
  assert.match(db, /if \(isFile && !h\.path\) \{ stuck \+= 1; continue; \}/);
  const page = readFileSync(new URL('../src/pages/ClassPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /could not be moved/, 'and the office is told which ones');
});

test('closing the class files its material, and a filing failure does not reopen it', () => {
  const page = readFileSync(new URL('../src/pages/ClassPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /keepClassMaterial\(id, \[\.\.\.days\]\)/);
  // The close happens first and the carry is wrapped: a class that failed to
  // file must not be left open.
  // Compared against the CALL, not the import, which sits at the top of the
  // file and made this pass for the wrong reason first time round.
  assert.ok(page.indexOf('setClassOpen(id, workshop, !live)') < page.indexOf('keepClassMaterial(id,'));
  assert.match(page, /try \{[\s\S]{0,400}keepClassMaterial[\s\S]{0,200}\} catch/);
});

test('every format has a label and an icon, and an unknown one is a link', () => {
  for (const f of FORMATS) {
    assert.ok(f.key && f.label && f.icon, f.key);
    assert.equal(libraryFormat(f.key).key, f.key);
  }
  assert.equal(libraryFormat('hologram').key, 'link');
  assert.equal(libraryFormat(undefined).key, 'link');
});

test('there are exactly two kinds, and they are the two a student navigates by', () => {
  assert.deepEqual(LIBRARY_KINDS.map((k) => k.key), ['recording', 'notes']);
});
