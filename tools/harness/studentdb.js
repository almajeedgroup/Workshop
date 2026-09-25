/* Stand-in for src/lib/studentdb.js. See ./publicdb.js for why. */
export * from '../../src/lib/studentdb.js';

/* A student who has taken two courses, one of which has no public mirror —
   the case where the dashboard has an ID and no title, and must still be
   readable rather than showing a blank card. */
/* `?who=new` is the OUTER student: a real account holding no ticket at all,
   which is the whole case this exists for and the one that used to show an
   empty page with a form asking for a ticket they do not have. */
const NOBODY = new URLSearchParams(window.location.search).get('who') === 'new';
let courses = NOBODY ? [] : [
  { workshopId: 'AIHOW26', ticketId: 'AIHOW26014' },
  { workshopId: 'RESM26', ticketId: 'RESM26007' },
];

export async function listMyCourses() { return courses; }
export async function getMembership(workshopId) {
  const held = courses.find((c) => c.workshopId === workshopId);
  return held ? { uid: 'harness-student', ticketId: held.ticketId } : null;
}
export async function claimTicket(workshopId, ticketId) {
  if (!/^AIHOW26|^RESM26|^INNO25/i.test(String(workshopId))) {
    const e = new Error('no such ticket'); e.code = 'permission-denied'; throw e;
  }
  courses = [...courses, { workshopId, ticketId: String(ticketId).toUpperCase() }];
  return ticketId;
}
export async function listMembers() {
  return [
    { uid: 'u1', ticketId: 'AIHOW26014', name: 'Fathima Zoha', email: 'fathima@example.com' },
    { uid: 'u2', ticketId: 'AIHOW26002', name: 'Laiba Naaz', email: 'laiba@example.com' },
  ];
}
export async function revokeMember() {}
export async function syncTicketIndex(workshopId, registrations = []) {
  return { added: registrations.length, total: registrations.length };
}
export async function ticketIndexSize() { return 12; }
