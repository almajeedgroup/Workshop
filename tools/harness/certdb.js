/* Stand-in for src/lib/certdb.js. See ./publicdb.js for why. */
export * from '../../src/lib/certdb.js';
export async function getCertificate(id) {
  /* The real record's shape — see certificateRecord() in src/lib/certdb.js.
     A stub with its own field names tests the stub, not the page. */
  return {
    certificateId: id || 'AIHOW26-COM-001',
    type: 'completion',
    typeLabel: 'Completion',
    design: 'parliament',
    recipientName: 'Fathima Zoha',
    workshopId: 'AIHOW26',
    workshopTitle: 'Artificial Intelligence, hands on',
    workshopDates: '9 – 14 February 2026',
    venue: 'Kabir IND PU College for Women',
    presentedBy: 'Mr. Sulaimaan',
    workshopCode: 'AIHOW26',
    duration: '6 days',
    time: '10:00 – 16:00',
    topics: 'Prompt engineering, chatbot design, HTML/CSS/JS essentials',
    ticketId: 'AIHOW26-001',
    holderKey: 'h1',
    issuedOn: '2026-02-14',
    issuer: {
      operator: 'Al-Majeed School of Research Methodology and Innovation',
      association: 'Islamic Information Centre · Beyond Guidance',
    },
    /* ?revoked in the harness URL flips this, to see the withdrawn path. */
    revoked: new URLSearchParams(location.search).has('revoked'),
    revokedReason: 'Issued against the wrong programme.',
  };
}

export async function getHolder() {
  /* A holder record, not a list: VerifyPage reads `holder.entries`. */
  return {
    id: 'h1',
    name: 'Fathima Zoha',
    entries: [
      { certificateId: 'AIHOW26-COM-001', typeLabel: 'Completion',
        workshopTitle: 'Artificial Intelligence, hands on', issuedOn: '2026-02-14' },
      { certificateId: 'RESM25-PAR-008', typeLabel: 'Participation',
        workshopTitle: 'Research methodology', issuedOn: '2025-03-09' },
    ],
  };
}
export async function listWorkshopCertificates() { return []; }
export async function listAllCertificates() { return []; }
export async function allocateCertificateIds() { return []; }
export async function issueCertificates() { return []; }
export async function setCertificateRevoked() {}
