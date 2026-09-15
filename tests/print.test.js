import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the one CSS mistake in this app that cannot be seen on screen.
 *
 * `@page` is DOCUMENT-LEVEL. It cannot be scoped to a component, and every
 * stylesheet here ends up in one bundle, so a second bare `@page { size: … }`
 * anywhere silently decides the orientation of every printed page in the
 * app — whichever stylesheet happens to land last wins. That is how the
 * certificate's landscape started printing attendance sheets sideways, and
 * nothing on screen showed it.
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

test('there is exactly ONE unnamed @page in the whole app', () => {
  const found = Object.entries(css).flatMap(([file, text]) =>
    bare(text).map((rule) => `${file}: ${rule}`));
  assert.deepEqual(found.length, 1,
    `A second unnamed @page decides the orientation of every printed page in the app.\n${found.join('\n')}`);
});

test('and it is portrait, because nearly everything printed here is', () => {
  const [only] = bare(all);
  assert.match(only, /size:\s*A4 portrait/);
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
