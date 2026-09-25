/* Stand-in for src/lib/librarydb.js. See ./publicdb.js for why.
 *
 * Held in memory so an add or a remove in the admin panel comes back on the
 * next read — a stub that returns a frozen list can show a shelf but cannot
 * show one being built, which is the half that needs looking at. */
export * from '../../src/lib/librarydb.js';

import { libraryRecord } from '../../src/lib/library.js';

let items = [
  { id: 'l1', ...libraryRecord({ title: 'Day one — what a model is', kind: 'recording', source: 'link', url: 'https://drive.google.com/file/d/abc/view', day: '2026-02-09' }) },
  { id: 'l2', ...libraryRecord({ title: 'Day one slides', kind: 'notes', source: 'file', path: 'workshops/AIHOW26/library/a.pptx', fileName: 'Day-one.pptx', bytes: 8_412_000, day: '2026-02-09' }) },
  { id: 'l3', ...libraryRecord({ title: 'Prompt sheet', kind: 'notes', source: 'file', path: 'workshops/AIHOW26/library/b.pdf', fileName: 'prompts.pdf', bytes: 214_000, day: '2026-02-09' }) },
  { id: 'l4', ...libraryRecord({ title: 'Day two — building a chatbot', kind: 'recording', source: 'file', path: 'workshops/AIHOW26/library/c.mp4', fileName: 'day-two.mp4', bytes: 486_000_000, day: '2026-02-10' }) },
  { id: 'l5', ...libraryRecord({ title: 'Exercises', kind: 'notes', source: 'link', url: 'https://docs.google.com/spreadsheets/d/xyz/edit', day: '2026-02-10' }) },
  { id: 'l6', ...libraryRecord({ title: 'Course pack', kind: 'notes', source: 'link', url: 'https://docs.google.com/document/d/pack/edit', day: '' }) },
];

let n = items.length;

export async function listLibrary(workshopId) {
  return workshopId === 'AIHOW26' ? items : [];
}
export async function libraryFileUrl(item) {
  return `https://example.invalid/${encodeURIComponent(item.path)}`;
}
export async function addLibraryLink(workshopId, item) {
  n += 1;
  const id = `l${n}`;
  items = [...items, { id, ...libraryRecord({ ...item, source: 'link' }) }];
  return id;
}
export async function uploadLibraryFile(workshopId, file, item = {}, onProgress = null) {
  for (const p of [0.2, 0.55, 0.9, 1]) { onProgress?.(p); await new Promise((f) => setTimeout(f, 90)); }
  n += 1;
  const id = `l${n}`;
  items = [...items, { id, ...libraryRecord({ ...item, source: 'file', path: `workshops/${workshopId}/library/${file.name}`, fileName: file.name, bytes: file.size }) }];
  return id;
}
export async function removeLibraryItem(workshopId, item) {
  items = items.filter((i) => i.id !== item.id);
}
