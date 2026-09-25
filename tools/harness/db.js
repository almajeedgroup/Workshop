/* Stand-in for src/lib/db.js. See ./publicdb.js for why, and for the
   reason this re-exports the real module first. */
export * from '../../src/lib/db.js';
const REGS = (n, prefix) => Array.from({ length: n }, (_, i) => ({
  id: `r${i}`,
  ticketId: `${prefix}-${String(i + 1).padStart(3, '0')}`,
  name: ['Fathima Zoha', 'Laiba Naaz', 'Abdul Rahman Sharief', 'Aisha Siddiqua',
    'Mohammed Ayaan', 'Zoha Fatima', 'Sana Kausar', 'Ibrahim Khan',
    'Ayesha Noor', 'Yusuf Ahmed', 'Hiba Rahman', 'Omar Farooq'][i % 12],
  whatsapp: `+91 9${(845289298 + i * 137) % 1000000000}`,
  qualification: ['II PUC', 'I PUC', 'B.Sc', 'X Std'][i % 4],
  area: ['Shivajinagar', 'Frazer Town', 'Jayanagar', 'Whitefield'][i % 4],
  paid: i % 3 !== 0,
  attendMode: ['Offline', 'Online', ''][i % 3],
  present: i % 4 !== 0,
}));

const WORKSHOPS = [
  { id: 'AIHOW26', title: 'Artificial Intelligence, hands on', startDate: '2026-02-09',
    endDate: '2026-02-14', time: '10:00 – 16:00', venue: 'Kabir IND PU College for Women',
    audience: 'School and college students', collaborators: 'Islamic Information Centre',
    presentedBy: 'Mr. Sulaimaan', registrationOpen: true, feeType: 'Paid', feeAmount: 500,
    seats: 40, mode: 'Hybrid', classOpen: true, meetingRoom: 'workshop-demo-room' },
  { id: 'RESM26', title: 'Research methodology', startDate: '2026-03-02', endDate: '2026-03-07',
    time: '09:30 – 15:30', venue: 'Al-Majeed Campus', audience: 'Graduates',
    registrationOpen: true, feeType: 'Free', seats: 30, mode: 'Offline' },
  { id: 'INNO25', title: 'Innovation practice', startDate: '2025-11-10', endDate: '2025-11-15',
    time: '10:00 – 16:00', venue: 'Kabir IND PU College for Women',
    registrationOpen: false, feeType: 'Paid', feeAmount: 350, seats: 25, mode: 'Offline' },
];

const BY_ID = Object.fromEntries(WORKSHOPS.map((w) => [w.id, w]));
const COUNTS = { AIHOW26: 12, RESM26: 7, INNO25: 25 };

export async function isListedAdmin() { return true; }
export async function registerOwner() { return true; }
export async function listWorkshops() { return WORKSHOPS; }
export async function getWorkshop(id) { return BY_ID[id] || null; }
export async function getRegistrations(id) { return REGS(COUNTS[id] ?? 6, id); }
export async function getRegistration(id, regId) {
  return (await getRegistrations(id)).find((r) => r.id === regId) || null;
}
export async function allocateTicketIds() { return []; }
export async function createWorkshop() { return 'NEW26'; }
export async function updateWorkshop() {}
export async function addRegistrations() {}
export async function updateRegistration() {}
export async function deleteRegistration() {}
export async function syncRegistrations() {}
export async function deleteWorkshop() {}
/* Overridden rather than inherited: the real one calls the real module's
   own getRegistrations, and a module-local binding is not swapped by a
   re-export. Shape matters — boardGroups reads `{ workshop, registrations }`,
   not a spread workshop. */
export async function withRegistrations(list) {
  return Promise.all(list.map(async (w) => ({ workshop: w, registrations: await getRegistrations(w.id) })));
}
export async function listAllWithRegistrations() { return withRegistrations(WORKSHOPS); }
