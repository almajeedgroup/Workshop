import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  embeddableUrl, viewerKind, libraryProgress, nextUp,
} from '../src/lib/library.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const link = (url) => ({ id: 'x', source: 'link', url, format: 'link' });

/* ---- what can be shown in the page ------------------------------- */

test('Google /preview addresses are the ones that frame', () => {
  // tidyShareLink produces these precisely so a recording can play beside
  // its own course contents instead of throwing the student into a tab.
  assert.equal(embeddableUrl(link('https://drive.google.com/file/d/F1/preview')),
    'https://drive.google.com/file/d/F1/preview');
  assert.equal(embeddableUrl(link('https://docs.google.com/presentation/d/A/preview')),
    'https://docs.google.com/presentation/d/A/preview');
});

test('a Drive /view link is framed through its /preview form', () => {
  assert.equal(embeddableUrl(link('https://drive.google.com/file/d/F1/view')),
    'https://drive.google.com/file/d/F1/preview');
});

test('YouTube is framed without the tracking cookie', () => {
  // A student watching a class recording has not asked to be followed
  // around the web for it.
  assert.equal(embeddableUrl(link('https://www.youtube.com/watch?v=abc')),
    'https://www.youtube-nocookie.com/embed/abc');
  assert.equal(embeddableUrl(link('https://youtu.be/xyz')),
    'https://www.youtube-nocookie.com/embed/xyz');
});

test('anything else is NOT framed, and that is the safe answer', () => {
  // Most servers refuse to be framed and there is no way to ask from a
  // browser — the refusal arrives as a blank box with the reason in a
  // console nobody is reading. A frame that shows nothing is worse than a
  // link that works.
  for (const u of [
    'https://example.org/a.pdf',
    'https://onedrive.live.com/x',
    'https://vimeo.com/123',
    'not a url',
    '',
  ]) assert.equal(embeddableUrl(link(u)), '', u);
});

test('a stored file is never framed — it is ours and we know what it is', () => {
  assert.equal(embeddableUrl({ source: 'file', path: 'p', format: 'video' }), '');
});

test('each kind is shown the way it should be', () => {
  assert.equal(viewerKind({ source: 'text' }), 'text');
  assert.equal(viewerKind({ source: 'file', format: 'video' }), 'video');
  assert.equal(viewerKind({ source: 'file', format: 'audio' }), 'audio');
  assert.equal(viewerKind({ source: 'file', format: 'pdf' }), 'frame');
  // A .pptx cannot be shown in a browser. Pretending otherwise gives a
  // blank rectangle; it is fetched instead.
  assert.equal(viewerKind({ source: 'file', format: 'ppt' }), 'download');
  assert.equal(viewerKind(link('https://drive.google.com/file/d/F/preview')), 'frame');
  assert.equal(viewerKind(link('https://example.org/a.pdf')), 'away');
  assert.equal(viewerKind(null), 'none');
});

/* ---- how far through ---------------------------------------------- */

const SHELF = [
  { id: 'a', kind: 'recording', day: '2026-02-09', title: 'A' },
  { id: 'b', kind: 'notes', day: '2026-02-09', title: 'B' },
  { id: 'c', kind: 'recording', day: '2026-02-10', title: 'C' },
];

test('progress counts against the shelf as it stands now', () => {
  assert.deepEqual(libraryProgress(SHELF, { a: true }),
    { total: 3, done: 1, left: 2, percent: 33, complete: false });
});

test('a course that gains an item makes the bar go backwards, correctly', () => {
  // There IS more to watch than there was. A bar frozen at its old total
  // would say finished while something sits unwatched.
  const before = libraryProgress(SHELF.slice(0, 2), { a: true, b: true });
  assert.equal(before.complete, true);
  const after = libraryProgress(SHELF, { a: true, b: true });
  assert.equal(after.complete, false);
  assert.equal(after.left, 1);
});

test('a tick for an item since removed is ignored, not counted', () => {
  // Counting it would leave somebody permanently past 100%.
  const p = libraryProgress(SHELF, { a: true, deleted: true });
  assert.equal(p.done, 1);
  assert.ok(p.percent <= 100);
});

test('an empty shelf is 0%, not a division by zero', () => {
  assert.deepEqual(libraryProgress([], {}),
    { total: 0, done: 0, left: 0, percent: 0, complete: false });
});

/* ---- where was I -------------------------------------------------- */

test('continue returns to the thing left half-done, not the one after it', () => {
  const next = nextUp(SHELF, { done: {}, last: 'b' });
  assert.equal(next.id, 'b');
});

test('once that one is ticked off, continue moves on', () => {
  const next = nextUp(SHELF, { done: { b: true }, last: 'b' });
  assert.equal(next.id, 'a', 'the first unfinished thing, in course order');
});

test('with nothing opened yet it starts at the beginning', () => {
  assert.equal(nextUp(SHELF, { done: {}, last: '' }).id, 'a');
});

test('a finished course has nothing to continue', () => {
  assert.equal(nextUp(SHELF, { done: { a: true, b: true, c: true }, last: 'c' }), null);
});

test('a remembered item that has since been removed is not chased', () => {
  const next = nextUp(SHELF, { done: {}, last: 'gone' });
  assert.equal(next.id, 'a');
});

/* ---- the page ------------------------------------------------------ */

test('the course page reads progress SEPARATELY from the shelf', () => {
  // Bundling them meant a student whose place could not be read was told
  // they were not on the course — far worse, and untrue.
  const page = read('../src/pages/site/StudyCoursePage.jsx');
  assert.match(page, /getProgress\(user\.uid, workshopId\)\.catch\(\(\) => \(\{ done: \{\}, last: '' \}\)\)/);
  assert.match(page, /its failure is not a refusal/);
});

test('opening something is remembered, and the tick is the student\'s own', () => {
  const page = read('../src/pages/site/StudyCoursePage.jsx');
  assert.match(page, /markOpened\(user\.uid, workshopId, item\.id\)/);
  assert.match(page, /setDone\(user\.uid, workshopId, item\.id, value\)/);
  // Nothing measures whether a recording was really watched, and a bar
  // that claimed to would be lying.
  assert.match(page, /Nothing measures whether a\s+recording was really watched/);
});

test('opening out stays available on every item, framed or not', () => {
  const page = read('../src/pages/site/StudyCoursePage.jsx');
  assert.match(page, /Open in a new tab/);
});

test('the frames are allowed by the CSP, and only as frames', () => {
  const cfg = JSON.parse(read('../firebase.json'));
  const csp = cfg.hosting.headers
    .flatMap((h) => h.headers)
    .find((k) => k.key === 'Content-Security-Policy').value;
  const frame = csp.match(/frame-src[^;]*/)[0];
  for (const host of ['drive.google.com', 'docs.google.com', 'www.youtube-nocookie.com']) {
    assert.ok(frame.includes(host), `${host} must be framable`);
  }
  // What happens inside a frame is that origin's business. None of them
  // belong in script-src, where they would be running code on our page.
  const script = csp.match(/script-src[^;]*/)[0];
  for (const host of ['drive.google.com', 'youtube-nocookie.com']) {
    assert.ok(!script.includes(host), `${host} must not be in script-src`);
  }
});

test('the dashboard answers "where was I" before it lists anything', () => {
  const page = read('../src/pages/site/StudyPage.jsx');
  assert.match(page, /Carry on where you left off/);
  // Sorted by WHEN, across courses: the question has one answer.
  assert.match(page, /\.sort\(\(a, b\) => b\.at - a\.at\)/);
});

test('progress is the student\'s alone — the office cannot read it', () => {
  const rules = read('../firestore.rules');
  const block = rules.slice(rules.indexOf('match /students/{uid}/progress/'));
  const own = block.slice(0, block.indexOf('match /students/{uid}/courses'));
  assert.doesNotMatch(own, /isAdmin\(\)/,
    'progress is a reading habit, not attendance; nothing in the app needs it');
  assert.match(own, /allow read, delete: if mine\(\);/);
});
