/* Stand-in for src/lib/certdb.js. See ./publicdb.js for why. */
export * from '../../src/lib/certdb.js';
export async function getCertificate() { return null; }
export async function getHolder() { return []; }
export async function listWorkshopCertificates() { return []; }
export async function listAllCertificates() { return []; }
export async function allocateCertificateIds() { return []; }
export async function issueCertificates() { return []; }
export async function setCertificateRevoked() {}
