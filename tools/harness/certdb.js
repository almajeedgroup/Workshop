/* Stand-in for src/lib/certdb.js. See ./publicdb.js for why. */
export * from '../../src/lib/certdb.js';
export async function getCertificate(id) {
  return {
    certificateId: id || 'AIHOW26-COM-001',
    name: 'Fathima Zoha',
    type: 'completion',
    design: 'parliament',
    workshopTitle: 'Artificial Intelligence, hands on',
    workshopId: 'AIHOW26',
    dates: '9 – 14 February 2026',
    venue: 'Kabir IND PU College for Women',
    presenter: 'Mr. Sulaimaan',
    issuedOn: '2026-02-14',
    revoked: false,
    holderKey: 'h1',
  };
}
export async function getHolder() { return []; }
export async function listWorkshopCertificates() { return []; }
export async function listAllCertificates() { return []; }
export async function allocateCertificateIds() { return []; }
export async function issueCertificates() { return []; }
export async function setCertificateRevoked() {}
