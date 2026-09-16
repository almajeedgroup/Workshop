/* Stand-in for src/lib/publicdb.js, aliased in by ./vite.config.js.

   The admin and the two public task pages cannot render without a live
   Firestore, and there is none here — so the real components are mounted
   against fabricated records instead.

   It re-exports the real module first and overrides only the calls that
   would go to the network. A stub that lists the exports by hand goes
   stale the day somebody adds one, and fails as "does not provide an
   export named ..." on a screen that has nothing to do with the change. */
export * from '../../src/lib/publicdb.js';

const WORKSHOP = {
  id: 'AIHOW26',
  title: 'Artificial Intelligence, hands on',
  startDate: '2026-02-09',
  endDate: '2026-02-14',
  time: '10:00 – 16:00',
  venue: 'Kabir IND PU College for Women',
  audience: 'School and college students',
  collaborators: 'Islamic Information Centre',
  presentedBy: 'Mr. Sulaimaan',
  registrationOpen: true,
  feeType: 'Paid',
  feeAmount: 500,
  mode: 'Hybrid',
  classOpen: true,
  meetingRoom: 'workshop-demo-room',
  meetingUrl: 'https://meet.jit.si/workshop-demo-room',
};
export async function getPublicWorkshop() { return WORKSHOP; }
export async function submitRegistrationRequest(id, form) {
  return { ref: 'AIHOW26-R-014', name: form.name || 'Fathima Zoha' };
}
export function upiLink({ name, amount, note }) {
  return `upi://pay?pa=demo@upi&pn=${encodeURIComponent(name)}&am=${amount}&tn=${encodeURIComponent(note || '')}`;
}

export async function listPendingRequests() {
  return [
    { id: 'q1', workshopId: 'AIHOW26', name: 'Nida Parveen', whatsapp: '+91 98861 22330',
      qualification: 'II PUC', area: 'Frazer Town', attendMode: 'Online', at: Date.now() - 6e6 },
    { id: 'q2', workshopId: 'AIHOW26', name: 'Imran Pasha', whatsapp: '+91 99012 77415',
      qualification: 'B.Com', area: 'Shivajinagar', attendMode: 'Offline', at: Date.now() - 2e7 },
  ];
}
export async function acceptRequest() {}
export async function rejectRequest() {}
