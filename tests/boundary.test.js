import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The admin sheet must not reach the public site.
 *
 * styles.css styles bare elements — `button`, `input`, `table`, `a`. Both
 * sheets load on every page, and a bare element selector is (0,0,1): there
 * is nothing for a `.site` component rule to beat, because the component
 * rule never mentions the element at all. `.fstrip a` sets a colour and
 * says nothing about `text-decoration`, so the admin's underline wins by
 * default rather than by cascade.
 *
 * That has shipped four times: a blue hover on every link, uppercase
 * headings, every full-bleed band inset by 32px, and uppercase text inside
 * every button. Each was found by eye, weeks apart, and each time the
 * lesson was the same one.
 *
 * So this test reads both sheets. Every bare-element selector styles.css
 * declares must have a `.site <element>` reset in site.css. Adding a new
 * one to the admin without a reset fails here, at the moment it is added,
 * rather than on a page nobody was looking at.
 */

const admin = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const site = readFileSync(new URL('../src/site.css', import.meta.url), 'utf8');

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Elements that are allowed to be styled globally: they have no public twin. */
const GLOBAL = new Set(['html', 'body', '*', ':root']);

/** Element names named by a bare compound selector, anywhere in a sheet. */
function bareElements(css) {
  const found = new Set();
  for (const m of strip(css).matchAll(/([^{}]+)\{/g)) {
    const block = m[1].trim();
    if (!block || block.startsWith('@')) continue;
    for (let sel of block.split(',')) {
      sel = sel.trim();
      if (!sel || /[.#[]/.test(sel) || sel.startsWith(':')) continue;
      // The rightmost compound is what the rule paints.
      const last = sel.split(/[\s>+~]+/).filter(Boolean).pop() || '';
      const name = last.split(/[:[]/)[0].toLowerCase();
      if (name && !GLOBAL.has(name)) found.add(name);
    }
  }
  return found;
}

/** Exactly `.site <element>`, optionally with one pseudo-class: a reset. */
const RESET_SELECTOR = /^\.site\s+([a-z][a-z0-9]*)(:[a-z-]+(\([^)]*\))?)?$/;

/** Element names that site.css resets under `.site`. */
function resetElements(css) {
  const found = new Set();
  for (const m of strip(css).matchAll(/([^{}]+)\{/g)) {
    const block = m[1].trim();
    if (!block || block.startsWith('@')) continue;
    for (let sel of block.split(',')) {
      sel = sel.trim();
      // exactly `.site <element>` and nothing else — a reset, not a component
      const hit = RESET_SELECTOR.exec(sel);
      if (hit) found.add(hit[1].toLowerCase());
    }
  }
  return found;
}

test('boundary: every element the admin sheet styles bare is reset under .site', () => {
  const leaking = bareElements(admin);
  const reset = resetElements(site);
  const missing = [...leaking].filter((el) => !reset.has(el)).sort();
  assert.deepEqual(
    missing, [],
    'styles.css styles these bare elements with no `.site <element>` reset in site.css:\n  '
    + `${missing.join(', ')}\n`
    + 'Add one to the boundary block in site.css, or scope the admin rule to .app.',
  );
});

test('boundary: the resets are defaults, not overrides', () => {
  // A reset carrying !important would beat the public components it exists
  // to protect, which is the opposite of the point. Read the rule bodies
  // rather than a slice of the file: comments are stripped before this
  // runs, so slicing on a comment marker silently matched the whole rest
  // of the sheet and reported whatever !important it found in there.
  const loud = [];
  for (const m of strip(site).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const isReset = m[1].split(',').every((sel) => RESET_SELECTOR.test(sel.trim()));
    if (isReset && /!important/.test(m[2])) loud.push(m[1].trim());
  }
  assert.deepEqual(
    loud, [],
    'these boundary resets use !important; they set defaults for bare elements '
    + 'and public component rules have to be able to win',
  );
});

test('boundary: page rhythm is scoped to the bands, not to every section', () => {
  // `.site section{padding-block}` put 104px inside every panel of an
  // accordion whose panels happen to be sections.
  const bare = /\.site section\s*\{/.test(strip(site));
  assert.equal(bare, false, 'use `.site main > section` so nested sections are not padded');
});
