import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FORMATS, LIBRARY_KINDS, MAX_FILE_BYTES, MAX_TEXT, libraryFormat,
  extensionOf, formatOfFile, formatOfLink, formatBytes,
  libraryRecord, libraryTitle, libraryFilePath,
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
