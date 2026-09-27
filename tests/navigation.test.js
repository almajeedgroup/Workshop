/**
 * The sidebar and the router have to agree.
 *
 * A nav link to a route that does not exist lands on the catch-all and
 * silently redirects home — which looks like the app ignoring a click, and
 * is exactly the kind of thing nobody notices until a user reports it.
 *
 * Read from the source rather than imported: these are React modules and the
 * point is the two lists, not the rendering.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');

/** Every `path="…"` declared on a Route. */
const routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

/** Every `to: '…'` in the sidebar's link table. */
const navLinks = [...sidebar.matchAll(/\{\s*to:\s*'([^']+)'/g)].map((m) => m[1]);

test('the router declares the routes the app is built around', () => {
  for (const path of ['/console', '/records', '/import', '/new', '/login', '/w/:id']) {
    assert.ok(routes.includes(path), `no route declared for ${path}`);
  }
});

test('every sidebar link points at a declared route', () => {
  assert.ok(navLinks.length >= 4, 'the sidebar should carry the admin sections');
  for (const to of navLinks) {
    assert.ok(routes.includes(to), `the sidebar links to ${to}, which has no route`);
  }
});

test('every admin route is reachable from the admin-area test', () => {
  // App.jsx decides which shell to render from this regex. A route it does
  // not match renders inside the PUBLIC site instead — no sidebar, and the
  // Protected wrapper never runs.
  const m = app.match(/isAdminArea = (\/\^[^;]+)\.test\(pathname\)/);
  assert.ok(m, 'the admin-area test should be findable');
  // eslint-disable-next-line no-eval
  const re = eval(m[1]);

  const adminRoutes = routes.filter((p) => p !== '*' && !p.startsWith('/c/') && !p.startsWith('/verify')
    && !['/', '/programmes', '/certificates', '/about', '/contact'].includes(p)
    && !p.startsWith('/register'));

  for (const path of adminRoutes) {
    const concrete = path.replace(/:[^/]+/g, 'x');
    assert.ok(re.test(concrete), `${path} would render outside the admin shell`);
  }
});

test('no public route is caught by the admin-area test', () => {
  const m = app.match(/isAdminArea = (\/\^[^;]+)\.test\(pathname\)/);
  // eslint-disable-next-line no-eval
  const re = eval(m[1]);
  for (const path of ['/', '/programmes', '/certificates', '/about', '/contact',
    '/verify', '/verify/ABC-COM-001', '/c/ABC-COM-001', '/register/w1']) {
    assert.ok(!re.test(path), `${path} would render inside the admin shell`);
  }
});

/* ------------------------------------------------------------------ *
 * Every screen names its own tab
 * ------------------------------------------------------------------ */

/**
 * A route with no title shows the brand alone. Nine tabs all reading
 * WORKSHOP is the state this exists to prevent, and a route added later
 * falls into it silently.
 */
const titlePatterns = [...app.matchAll(/\[\s*(\/\^[^,]+?\/)\s*,\s*'([^']*)'\s*\]/g)]
  .map(([, pattern, label]) => ({ source: pattern, label }));

test('the title table is read, not empty', () => {
  assert.ok(titlePatterns.length >= 15, `found ${titlePatterns.length} title patterns`);
});

test('every route the app declares has a name for its tab', () => {
  // Route params are filled with something a pattern can match.
  const sample = (path) => path.replace(/:[^/]+/g, 'x').replace(/\/\*$/, '');
  const missing = [];
  for (const path of routes) {
    if (path === '*') continue;
    const url = sample(path);
    const hit = titlePatterns.find((t) => new RegExp(t.source.slice(1, -1)).test(url));
    if (!hit || !hit.label) {
      // `/` is the site home and deliberately carries the brand alone.
      if (url === '/') continue;
      missing.push(path);
    }
  }
  assert.deepEqual(missing, [], `these routes would show the brand and nothing else: ${missing.join(', ')}`);
});

test('the tab says the page before it says the brand', () => {
  assert.match(app, /\$\{label\}\s*·\s*\$\{BRAND_NAME\}|brandTitle/);
});
