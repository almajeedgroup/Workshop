/**
 * Duplicate detection for registrations.
 *
 * The team collects replies on WhatsApp and pastes them in batches, so the
 * same candidate very easily arrives twice — a resent reply, or two pasted
 * batches that overlap. Each duplicate would otherwise become a second
 * registration, with a second ticket ID, consuming a second seat.
 *
 * Nothing here blocks a save. It reports, and the operator decides — two
 * cousins really can share a phone.
 */

import { normalizePhone } from './parser.js';

/**
 * Identities this row would collide on, strongest first. A row with no phone,
 * no email and no date of birth has nothing reliable to match on, so it is
 * never reported as a duplicate.
 */
export function matchKeys(reg) {
  const keys = [];

  const phone = normalizePhone(reg.whatsapp);
  if (phone.length >= 10) keys.push(`tel:${phone}`);

  const email = String(reg.email || '').trim().toLowerCase();
  if (email.includes('@')) keys.push(`mail:${email}`);

  const name = String(reg.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const dob = String(reg.dob || '').trim();
  if (name && dob) keys.push(`dob:${name}|${dob}`);

  return keys;
}

const REASONS = {
  tel: 'same WhatsApp number',
  mail: 'same email',
  dob: 'same name and date of birth',
};

/**
 * Split `incoming` into rows that are new and rows that match something
 * already registered — either in `existing`, or earlier within `incoming`
 * itself, so a batch that repeats a candidate is caught on its own.
 *
 * Returns { unique, duplicates: [{ row, against, reason }] }, where `against`
 * is the record already holding that identity.
 */
export function splitDuplicates(incoming, existing = []) {
  const seen = new Map();
  for (const row of existing) {
    for (const key of matchKeys(row)) if (!seen.has(key)) seen.set(key, row);
  }

  const unique = [];
  const duplicates = [];

  for (const row of incoming) {
    const keys = matchKeys(row);
    const hit = keys.find((k) => seen.has(k));
    if (hit) {
      duplicates.push({ row, against: seen.get(hit), reason: REASONS[hit.split(':')[0]] });
    } else {
      for (const key of keys) seen.set(key, row);
      unique.push(row);
    }
  }

  return { unique, duplicates };
}

/** "Ayesha Siddiqua (same WhatsApp number as Ayesha S., ticket AIHOW26-004)" */
export function describeDuplicate({ row, against, reason }) {
  const name = String(row.name || '(unnamed)').trim();
  const otherName = String(against.name || '').trim();
  const ticket = String(against.ticketId || '').trim();
  const who = [otherName, ticket && `ticket ${ticket}`].filter(Boolean).join(', ');
  return who ? `${name} — ${reason} as ${who}` : `${name} — ${reason} as an earlier row`;
}
