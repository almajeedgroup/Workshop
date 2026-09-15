/**
 * Putting phone numbers already in the database into one shape.
 *
 * Everything saved from now on goes through `formatPhone` in the sanitisers,
 * so it lands as `+91 98452 89298`. Records written before that are whatever
 * somebody typed: `9845289298`, `09845289298`, `+919845289298`, `98452 89298`.
 * Duplicate detection compares numbers, and the office dials them, so two
 * spellings of one number is a real problem rather than an untidy one.
 *
 * This module works out the change. It touches no database, so the rule that
 * decides whether a record is rewritten can be tested on its own — which
 * matters more than usual here, because the thing being tested is a one-way
 * edit of live data.
 *
 * TWO PROPERTIES IT HAS TO HAVE, and both are tested:
 *
 *   Nothing unrecognised is touched. `formatPhone` hands back exactly what it
 *   was given unless it recognised a ten-digit Indian number, so a landline,
 *   an extension, a foreign number or a note written in the field survives
 *   untouched. A migration that "tidies" those would destroy information.
 *
 *   A patch is produced ONLY when something really changes. That makes a
 *   second run write nothing, and it makes the dry run's count honest — the
 *   number it reports is the number of documents that will be written.
 */

import { formatPhone } from './parser.js';
import { WORKSHOP_FIELDS, REGISTRATION_FIELDS } from './schema.js';

/**
 * The fields of a schema that hold phone numbers.
 *
 * Read from the schema rather than listed here, so a phone field added later
 * is migrated without anyone remembering this file exists. A list is only a
 * list of numbers if it says so — resource persons and coordinators are lists
 * too, and must not be run through a phone formatter.
 */
export function phoneFields(fields) {
  return fields.filter(
    (f) => f.type === 'tel' || (f.phones && (f.type === 'list' || f.type === 'multi'))
  );
}

/**
 * What would change in one record, or null if nothing would.
 *
 * Returns a patch rather than a whole record: merged into the document, it
 * cannot disturb a field it does not mention.
 */
export function phonePatch(record, fields) {
  const patch = {};
  for (const f of phoneFields(fields)) {
    if (f.type === 'list' || f.type === 'multi') {
      const current = record?.[f.key];
      // Absent is not the same as empty. Writing [] over a missing field would
      // add data the record never had.
      if (!Array.isArray(current)) continue;
      const next = current.map((n) => formatPhone(n));
      if (next.some((v, i) => v !== current[i])) patch[f.key] = next;
    } else {
      const current = record?.[f.key];
      if (current === undefined || current === null || current === '') continue;
      const next = formatPhone(current);
      if (next !== current) patch[f.key] = next;
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * What the patched fields hold right now.
 *
 * The preview has to show what a number is as well as what it becomes —
 * "Becomes +91 98452 89298" on its own asks the reader to trust that the
 * thing being replaced was worth replacing.
 */
export function before(record, patch) {
  const out = {};
  for (const key of Object.keys(patch || {})) {
    const v = record?.[key];
    out[key] = Array.isArray(v) ? v.join('; ') : (v ?? '');
  }
  return out;
}

/** The one phone field on a registration request. Requests are not schema-driven. */
export const REQUEST_PHONE_FIELDS = [{ key: 'whatsapp', type: 'tel' }];


/* The collections these records live in. Named here rather than in the
   runner so the write set can be checked without a database. */
const WORKSHOPS = 'workshops';
const REGISTRATIONS = 'registrations';
const REQUESTS = 'registrationRequests';
const PUBLIC_WORKSHOPS = 'publicWorkshops';

/**
 * The writes a scan implies, as flat `{ ref, patch }` pairs.
 *
 * A workshop's enquiry numbers appear twice — on the workshop and on its
 * public mirror, which is what the registration page shows. Fixing one and
 * not the other would leave the poster and the office disagreeing, so both
 * are written together, but only where a mirror already exists.
 *
 * Separate from `applyPhones` so the shape of the write set can be checked
 * without a database.
 */
export function writesFor(scan) {
  const out = [];
  for (const w of scan.workshops || []) {
    out.push({ path: [WORKSHOPS, w.id], patch: w.patch });
    if (w.mirrored && 'contactNumbers' in w.patch) {
      out.push({ path: [PUBLIC_WORKSHOPS, w.id], patch: { contactNumbers: w.patch.contactNumbers } });
    }
  }
  for (const r of scan.registrations || []) {
    out.push({ path: [WORKSHOPS, r.workshopId, REGISTRATIONS, r.id], patch: r.patch });
  }
  for (const q of scan.requests || []) {
    out.push({ path: [REQUESTS, q.id], patch: q.patch });
  }
  return out;
}

/**
 * The label a field is known by on screen.
 *
 * The preview lists which field of which record is changing, and `whatsapp`
 * or `emergencyContact` is the key a programmer chose, not the words on the
 * form the number was typed into. Falls back to the key for anything the
 * schema does not name.
 */
export function fieldLabel(key) {
  const found = [...WORKSHOP_FIELDS, ...REGISTRATION_FIELDS].find((f) => f.key === key);
  return found ? found.label : key;
}

/** How a finished scan reads in one line. */
export function summarise(scan) {
  const n = (a) => (a ? a.length : 0);
  const total = n(scan?.workshops) + n(scan?.registrations) + n(scan?.requests);
  if (!total) return 'Every phone number is already in +91 form. Nothing to change.';
  const parts = [];
  if (n(scan.workshops)) parts.push(`${n(scan.workshops)} workshop${n(scan.workshops) === 1 ? '' : 's'}`);
  if (n(scan.registrations)) parts.push(`${n(scan.registrations)} registration${n(scan.registrations) === 1 ? '' : 's'}`);
  if (n(scan.requests)) parts.push(`${n(scan.requests)} request${n(scan.requests) === 1 ? '' : 's'}`);
  return `${total} record${total === 1 ? '' : 's'} to rewrite — ${parts.join(', ')}.`;
}
