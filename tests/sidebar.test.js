import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampWidth, storedWidth, rememberWidth, widthForKey,
  MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH, NUDGE, WIDTH_KEY,
} from '../src/lib/sidebar.js';

/** A localStorage that behaves, and one that refuses. */
const fakeStore = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    map,
  };
};
const refusingStore = {
  getItem() { throw new Error('storage disabled'); },
  setItem() { throw new Error('storage disabled'); },
};

/* ---------------- the clamp is the whole safety of a drag ---------------- */

test('a width is never narrower than the narrowest usable one', () => {
  // A sidebar dragged to nothing is a navigation you cannot get back: the
  // control that widens it is inside the thing that vanished.
  assert.equal(clampWidth(0), MIN_WIDTH);
  assert.equal(clampWidth(-500), MIN_WIDTH);
  assert.equal(clampWidth(MIN_WIDTH - 1), MIN_WIDTH);
});

test('and never wide enough to become the page', () => {
  assert.equal(clampWidth(9999), MAX_WIDTH);
  assert.equal(clampWidth(MAX_WIDTH + 1), MAX_WIDTH);
});

test('a width in range is kept, rounded to a whole pixel', () => {
  assert.equal(clampWidth(240), 240);
  assert.equal(clampWidth(240.6), 241);
});

test('nonsense comes back as the default, not as zero', () => {
  for (const junk of ['', '   ', 'wide', null, undefined, NaN, Infinity, {}]) {
    assert.equal(clampWidth(junk), DEFAULT_WIDTH, String(junk));
  }
});

test('a real zero is a drag to the far left, and stops at the minimum', () => {
  // Distinct from the case above: 0 is a width somebody asked for, and null
  // is no width at all. Treating them the same shrinks the sidebar for
  // anybody whose stored value never got written.
  assert.equal(clampWidth(0), MIN_WIDTH);
  assert.equal(clampWidth('0'), MIN_WIDTH);
});

/* ---------------- remembering it ---------------- */

test('nothing stored means the default', () => {
  assert.equal(storedWidth(fakeStore()), DEFAULT_WIDTH);
});

test('a stored width comes back', () => {
  assert.equal(storedWidth(fakeStore({ [WIDTH_KEY]: '300' })), 300);
});

test('a stored width somebody edited is still clamped on the way in', () => {
  assert.equal(storedWidth(fakeStore({ [WIDTH_KEY]: '5' })), MIN_WIDTH);
  assert.equal(storedWidth(fakeStore({ [WIDTH_KEY]: 'wide' })), DEFAULT_WIDTH);
});

test('storage that refuses is not an error, just a default', () => {
  // Private browsing, or site data blocked. A sidebar width is not worth
  // taking the whole app down for.
  assert.equal(storedWidth(refusingStore), DEFAULT_WIDTH);
  assert.doesNotThrow(() => rememberWidth(refusingStore, 300));
  assert.equal(storedWidth(undefined), DEFAULT_WIDTH);
});

test('what is written back is the clamped width, not the raw one', () => {
  const store = fakeStore();
  rememberWidth(store, 9999);
  assert.equal(store.map.get(WIDTH_KEY), String(MAX_WIDTH));
});

/* ---------------- from the keyboard ---------------- */

test('left narrows and right widens — the way the arrow points', () => {
  assert.equal(widthForKey('ArrowLeft', 208), 208 - NUDGE);
  assert.equal(widthForKey('ArrowRight', 208), 208 + NUDGE);
});

test('the arrows cannot push it past either end', () => {
  assert.equal(widthForKey('ArrowLeft', MIN_WIDTH), MIN_WIDTH);
  assert.equal(widthForKey('ArrowRight', MAX_WIDTH), MAX_WIDTH);
});

test('Home is the way back from a width somebody regretted', () => {
  assert.equal(widthForKey('Home', 400), DEFAULT_WIDTH);
  assert.equal(widthForKey('End', 200), MAX_WIDTH);
});

test('any other key does nothing at all', () => {
  // Returning a width here would swallow Tab, Enter and every shortcut.
  for (const key of ['Tab', 'Enter', 'a', 'ArrowUp', 'Escape']) {
    assert.equal(widthForKey(key, 208), null, key);
  }
});
