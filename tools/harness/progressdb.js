/* Stand-in for src/lib/progressdb.js. See ./publicdb.js for why.
 *
 * Held in memory, because progress is the half of this page that only shows
 * itself when it CHANGES: a stub returning a frozen map can draw a bar but
 * cannot show one move, and moving is the whole feature. */
export * from '../../src/lib/progressdb.js';

const store = {
  AIHOW26: { done: { l1: true }, last: 'l2' },
};

export async function getProgress(uid, workshopId) {
  return store[workshopId] || { done: {}, last: '' };
}
export async function getAllProgress() {
  return Object.fromEntries(Object.entries(store).map(([k, v]) => [k, { ...v, at: Date.now() }]));
}
export async function markOpened(uid, workshopId, itemId) {
  store[workshopId] = { ...(store[workshopId] || { done: {} }), last: itemId };
}
export async function setDone(uid, workshopId, itemId, done = true) {
  const at = store[workshopId] || { done: {}, last: '' };
  const next = { ...at.done };
  if (done) next[itemId] = true; else delete next[itemId];
  store[workshopId] = { ...at, done: next };
}
