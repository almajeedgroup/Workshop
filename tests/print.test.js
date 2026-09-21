import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the one CSS mistake in this app that cannot be seen on screen.
 *
 * `@page` is DOCUMENT-LEVEL. It cannot be scoped to a component, and every
 * stylesheet here ends up in one bundle, so a bare `@page { size: … }`
 * anywhere decides the orientation of printed pages across the whole app.
 *
 * ── THE RULE CHANGED, BECAUSE THE OLD ONE WAS WRONG ────────────────────
 * This used to require exactly ONE bare `@page`, on the theory that a
 * single one was safe and only a second was dangerous. It is not safe. A
 * bare rule beat the certificate's own `@page cert-sheet`, and an A4
 * LANDSCAPE certificate printed on portrait paper with its sides cut off
 * — on screen it looked perfect. It was found by measuring the PDF, not
 * by reading the CSS, and confirmed by deleting that one rule from the
 * live page and printing again.
 *
 * So: no bare `@page` at all. Every printed document names its page, the
 * app's two roots opt into the ordinary portrait one, and a document that
 * wants different paper names its own and wins for its own box.
 *
 * tools/print-audit.mjs measures what actually comes out; this keeps the
 * shape of the CSS honest without needing a browser.
 */

const SRC = new URL('../src/', import.meta.url).pathname;
const sheets = readdirSync(SRC).filter((f) => f.endsWith('.css'));

/** Comments explain the rule; they are not the rule. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const css = Object.fromEntries(sheets.map((f) => [f, code(readFileSync(join(SRC, f), 'utf8'))]));
const all = Object.values(css).join('\n');

/** `@page` with no name — the kind that applies to the whole document. */
const bare = (text) => [...text.matchAll(/@page\s*\{[^}]*\}/g)].map((m) => m[0]);
/** `@page name { … }` — applies only where something opts in. */
const named = (text) => [...text.matchAll(/@page\s+([\w-]+)\s*\{([^}]*)\}/g)];

test('there is NO unnamed @page anywhere', () => {
  const found = Object.entries(css).flatMap(([file, text]) =>
    bare(text).map((rule) => `${file}: ${rule}`));
  assert.deepEqual(found, [],
    'A bare @page applies to every page in the document and beats the named '
    + 'ones. That is what printed the certificate — an A4 landscape sheet — '
    + 'on portrait paper. Give it a name and have the roots opt in.');
});

test('the ordinary page is named, portrait, and opted into by both roots', () => {
  const [[, name, body]] = named(css['styles.css']);
  assert.equal(name, 'doc');
  assert.match(body, /size:\s*A4 portrait/);
  // Both halves of the app: the admin shell, and the public site.
  assert.match(css['styles.css'], /\.shell[^{]*\.site[^{]*\{[^}]*page:\s*doc/,
    'both roots must claim it, or whatever they print falls back to the UA default');
});

test('the certificate — the one landscape document — uses a NAMED page', () => {
  const names = named(css['certificate.css']).map(([, name]) => name);
  assert.deepEqual(names, ['cert-sheet']);
  assert.match(named(css['certificate.css'])[0][2], /A4 landscape/);
  assert.match(css['certificate.css'], /page:\s*cert-sheet/, '.sheet must opt in');
});

test('the attendance sheet prints portrait, on a page of its own', () => {
  const [[, name, body]] = named(css['attendance.css']);
  assert.equal(name, 'att-sheet');
  assert.match(body, /A4 portrait/);
  assert.match(body, /margin:\s*0/, 'the sheet carries its own margins in millimetres');
  assert.match(css['attendance.css'], /page:\s*att-sheet/);
});

test('the card sheet prints portrait too', () => {
  const [[, name, body]] = named(css['idcard.css']);
  assert.equal(name, 'card-sheet');
  assert.match(body, /A4 portrait/);
  assert.match(css['idcard.css'], /page:\s*card-sheet/);
});

test('every named page is opted into by something', () => {
  // A named page nothing claims is a rule that silently does nothing.
  for (const [file, text] of Object.entries(css)) {
    for (const [, name] of named(text)) {
      assert.match(all, new RegExp(`page:\\s*${name}\\b`), `${file}: nothing uses @page ${name}`);
    }
  }
});

test('no page is claimed that was never declared', () => {
  for (const m of all.matchAll(/(?<!@)\bpage:\s*([\w-]+)/g)) {
    const name = m[1];
    if (name === 'auto') continue;
    assert.match(all, new RegExp(`@page\\s+${name}\\b`), `page: ${name} is declared nowhere`);
  }
});
