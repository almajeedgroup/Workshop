import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FEATURES, FEATURE_GROUPS, FEATURE_SLUGS,
  featureBySlug, featuresInGroup, groupOf, featureNeighbours, featurePath,
} from '../src/lib/features.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const app = read('src/App.jsx');
const hub = read('src/pages/site/FeaturesPage.jsx');
const detail = read('src/pages/site/FeaturePage.jsx');
const header = read('src/components/site/SiteHeader.jsx');
const footer = read('src/components/site/SiteFooter.jsx');
const resolver = read('src/components/site/FeatureIcon.jsx');
const icons = read('src/components/site/Icons.jsx');

/* ---------------- the catalogue itself ---------------- */

test('every feature is fully written', () => {
  // A half-filled entry renders a page with an empty middle. Catch it here
  // rather than on the site.
  for (const f of FEATURES) {
    assert.match(f.slug, /^[a-z][a-z0-9-]*$/, `${f.name} has an unusable slug`);
    assert.ok(f.name && f.tagline && f.lede, `${f.slug} is missing its wording`);
    assert.ok(f.sections?.length >= 2, `${f.slug} needs at least two sections`);
    assert.ok(f.points?.length >= 3, `${f.slug} needs at least three points`);
    for (const s of f.sections) {
      assert.ok(s.h && s.p, `${f.slug} has a section with no heading or no body`);
      assert.ok(s.p.length > 80, `${f.slug} — "${s.h}" is a stub`);
    }
  }
});

test('slugs are unique', () => {
  assert.equal(new Set(FEATURE_SLUGS).size, FEATURE_SLUGS.length);
});

test('every feature sits in a declared group, and no group is empty', () => {
  const keys = new Set(FEATURE_GROUPS.map((g) => g.key));
  for (const f of FEATURES) {
    assert.ok(keys.has(f.group), `${f.slug} is in unknown group "${f.group}"`);
    assert.ok(groupOf(f), `${f.slug} cannot resolve its group`);
  }
  // An empty group renders a heading with nothing under it.
  for (const g of FEATURE_GROUPS) {
    assert.ok(featuresInGroup(g.key).length > 0, `group "${g.key}" has no features`);
  }
});

test('the groups cover the catalogue in order', () => {
  const ordered = FEATURE_GROUPS.flatMap((g) => featuresInGroup(g.key).map((f) => f.slug));
  assert.deepEqual([...ordered].sort(), [...FEATURE_SLUGS].sort());
});

/* ---------------- lookup ---------------- */

test('lookup survives a shouted or padded URL', () => {
  assert.equal(featureBySlug('ATTENDANCE')?.slug, 'attendance');
  assert.equal(featureBySlug('  attendance '), FEATURES.find((f) => f.slug === 'attendance'));
  assert.equal(featureBySlug('nonesuch'), undefined);
  assert.equal(featureBySlug(null), undefined);
  assert.equal(featureBySlug(undefined), undefined);
});

test('the ends of the catalogue have no neighbour past them', () => {
  const first = featureNeighbours(FEATURE_SLUGS[0]);
  assert.equal(first.prev, null);
  assert.equal(first.next.slug, FEATURE_SLUGS[1]);

  const last = featureNeighbours(FEATURE_SLUGS.at(-1));
  assert.equal(last.next, null);
  assert.equal(last.prev.slug, FEATURE_SLUGS.at(-2));

  // An unknown slug must not wrap round to the first feature.
  assert.deepEqual(featureNeighbours('nonesuch'), { prev: null, next: null });
});

test('the path is built one way', () => {
  assert.equal(featurePath('attendance'), '/features/attendance');
  assert.equal(featurePath(FEATURES[0]), `/features/${FEATURES[0].slug}`);
});

/* ---------------- every feature has a page ---------------- */

test('the routes carry the features hub and a page per feature', () => {
  // This is the promise the landing site makes: every feature is listed.
  // The route is generated from the slug, so one parameterised route serves
  // them all — what has to hold is that the route exists and that the hub
  // and the detail page are both wired in.
  assert.match(app, /\['\/features', <FeaturesPage \/>\]/);
  assert.match(app, /\['\/features\/:slug', <FeaturePage \/>\]/);
  assert.match(app, /import FeaturesPage from '\.\/pages\/site\/FeaturesPage\.jsx'/);
  assert.match(app, /import FeaturePage from '\.\/pages\/site\/FeaturePage\.jsx'/);
});

test('the hub renders the whole catalogue, not a hand-written subset', () => {
  // If somebody replaces the generated grid with hard-coded cards, a feature
  // added later stops appearing and nothing else notices.
  assert.match(hub, /FEATURE_GROUPS\.map/);
  assert.match(hub, /featuresInGroup\(group\.key\)/);
  assert.match(hub, /featurePath\(f\)/);
  assert.ok(!/\/features\/[a-z-]+["'`]/.test(hub), 'the hub hard-codes a feature URL');
});

test('the detail page is generated from the catalogue', () => {
  assert.match(detail, /featureBySlug\(slug\)/);
  assert.match(detail, /feature\.sections\.map/);
  assert.match(detail, /feature\.points\.map/);
  assert.match(detail, /feature\.limits/);
  // An unknown slug must land somewhere useful rather than crash.
  assert.match(detail, /Navigate to="\/features" replace/);
});

test('every declared page title pattern matches its feature page', () => {
  // App.jsx names the browser tab from the path. A feature page that fell
  // through would be titled with the brand alone.
  const patterns = [...app.matchAll(/\[(\/\^[^,]+?\/), '([^']*)'\]/g)];
  assert.ok(patterns.length > 5, 'could not read the title table out of App.jsx');
  const titleFor = (path) => {
    for (const [, src, label] of patterns) {
      const body = src.slice(1, src.lastIndexOf('/'));
      if (new RegExp(body).test(path)) return label;
    }
    return null;
  };
  assert.equal(titleFor('/features'), 'Features');
  for (const f of FEATURES) {
    assert.equal(titleFor(featurePath(f)), 'Feature', `${f.slug} has no tab name`);
  }
});

/* ---------------- reachable without knowing the URL ---------------- */

test('the hub is linked from the site chrome', () => {
  assert.match(header, /to: '\/features'/);
  assert.match(footer, /to="\/features"/);
});

/* ---------------- icons ---------------- */

test('every icon a feature names actually exists', () => {
  for (const f of FEATURES) {
    assert.ok(f.icon, `${f.slug} names no icon`);
    assert.match(resolver, new RegExp(`\\b${f.icon}:\\s*Icon`), `${f.slug} names unknown icon "${f.icon}"`);
  }
  // And each mapped component is really exported by the icon set.
  for (const [, component] of resolver.matchAll(/^\s+\w+:\s*(Icon\w+),/gm)) {
    assert.match(icons, new RegExp(`export const ${component} =`), `${component} is not an icon`);
  }
});

/* ---------------- the honest half ---------------- */

test('the features that have a hard limit still say so', () => {
  // These four are the ones with a wall a reader will otherwise hit
  // themselves: no server, no payment gateway, no upload.
  for (const slug of ['tickets', 'online-classes', 'class-record', 'printing']) {
    const f = featureBySlug(slug);
    assert.ok(f.limits?.length, `${slug} has stopped stating what it cannot do`);
  }
});

test('a feature with an outward link points inside the site', () => {
  for (const f of FEATURES) {
    if (!f.link) continue;
    assert.ok(f.link.to.startsWith('/'), `${f.slug} links off-site`);
    assert.ok(f.link.label, `${f.slug} has a link with no label`);
  }
});
