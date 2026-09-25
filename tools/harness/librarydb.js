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
  /* The third source: notes typed during the class, carried onto the shelf
     when it closed. Kept multi-line on purpose — the numbering is the only
     structure they have, and normal wrapping would collapse it. */
  { id: 'notes-2026-02-09', ...libraryRecord({
    title: 'Class notes — 9 Feb 2026', kind: 'notes', source: 'text', day: '2026-02-09',
    text: ['What a model actually is — a function with learned numbers in it, nothing more.',
      '',
      'Three things to try before the break:',
      '  1. Ask for the same thing twice and read both answers side by side.',
      '  2. Give it a worked example and watch the shape of the answer change.',
      '  3. Ask it for its sources, then check one.'].join('\n'),
  }) },
];

let n = items.length;

export async function listLibrary(workshopId) {
  if (workshopId === 'AIHOW26') return items;
  // The open course has a shelf of its own, or "open to everyone" would
  // lead to an empty page and prove nothing.
  if (workshopId === 'INNO25') return items.slice(0, 2);
  return [];
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

/* One course open to everybody, so both faces of the dashboard can be seen:
   the student who holds tickets, and the one who holds none. */
let openCourses = [
  { id: 'INNO25', title: 'Innovation practice', startDate: '2025-11-10', endDate: '2025-11-15' },
];
export async function listOpenLibraries() { return openCourses; }
export async function setLibraryAccess(workshopId, workshop, open) {
  openCourses = open
    ? [...openCourses.filter((c) => c.id !== workshopId),
      { id: workshopId, title: workshop.title, startDate: workshop.startDate, endDate: workshop.endDate }]
    : openCourses.filter((c) => c.id !== workshopId);
  return { ...workshop, libraryAccess: open ? 'Open' : 'Ticket' };
}
