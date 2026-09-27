/* Stand-in for src/lib/attendancedb.js. See ./publicdb.js for why. */
export * from '../../src/lib/attendancedb.js';

const DATES = ['2026-02-09', '2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14'];

/* Real mark keys, deliberately. An earlier version of this stub returned
   'P' and 'A', which attendanceMark() does not recognise — so every row
   rendered unmarked and the audit measured a state the app never shows. */
const KEYS = ['present', 'present', 'late', '', 'absent'];
const marksFor = (date) => Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`r${i}`, KEYS[(i + DATES.indexOf(date)) % KEYS.length]])
    .filter(([, k]) => k),
);

/* Sign-ins, keyed by TICKET as the real collection is — including one that
   matches nobody (a typo) and one on a row the office marked absent, which
   is the contradiction the register has to show rather than resolve. */
const joinsFor = (date) => {
  const i = DATES.indexOf(date);
  if (i < 0 || i > 2) return {};
  return {
    'AIHOW26-004': Date.now(), // r3 — the office never reached them
    'AIHOW26-005': Date.now(), // r4 — the office marked them absent
    'AIHOW26-002': Date.now(), // r1 — the office marked them present too
    'AIHOW26-999': Date.now(), // nobody
  };
};

export async function getDayMarks(workshopId, date) { return marksFor(date); }
export async function getAllMarks() {
  return Object.fromEntries(DATES.map((d) => [d, marksFor(d)]));
}
export async function getDayJoins(workshopId, date) { return joinsFor(date); }
export async function getAllJoins(workshopId, dates = []) {
  return Object.fromEntries(dates.map((d) => [d, joinsFor(d)]).filter(([, j]) => Object.keys(j).length));
}
export async function recordSelfJoin() { return true; }
export async function setMark() {}
export async function setMarks() {}
export async function removeMarks() {}
