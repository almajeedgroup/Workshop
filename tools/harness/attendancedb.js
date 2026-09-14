/* Stand-in for src/lib/attendancedb.js. See ./publicdb.js for why. */
export * from '../../src/lib/attendancedb.js';

const DATES = ['2026-02-09', '2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14'];
const marksFor = (date) => Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`r${i}`, (i + DATES.indexOf(date)) % 5 === 0 ? 'A' : 'P']),
);

export async function getDayMarks(workshopId, date) { return marksFor(date); }
export async function getAllMarks() {
  return Object.fromEntries(DATES.map((d) => [d, marksFor(d)]));
}
export async function setMark() {}
export async function setMarks() {}
export async function removeMarks() {}
