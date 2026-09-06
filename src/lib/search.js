/**
 * Finding one person, from anywhere.
 *
 * The rest of the app is organised by workshop, which is right: a course is
 * the thing that gets run, printed and paid for. But the question that comes
 * over the phone is never organised that way. It is "Adifaah says she
 * registered", or "who is AIHOW26-014", or a WhatsApp number with no name
 * attached — and answering it meant opening courses one at a time until she
 * turned up.
 *
 * So this flattens everything already in memory into one list and ranks it.
 * NO NEW QUERIES: the Console and the board have both already fetched every
 * workshop with its registrations, and searching what is on the screen is
 * free.
 *
 * ── On ranking ───────────────────────────────────────────────────────────
 * A ticket ID typed in full is not a guess — it is somebody reading off a
 * ticket, and it should be the first result every time. A name typed in full
 * is nearly as certain. Everything after that is progressively more of a
 * hunch, down to "these words appear somewhere in the record", which is
 * still worth showing but must not outrank the certainties.
 */

import { normalizePhone } from './parser.js';
import { workshopFee, isFreeWorkshop } from './schema.js';

/** Lowercase, unaccented, single-spaced. What two spellings have in common. */
export function norm(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Just the digits, so a number matches however it was punctuated. */
function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function joined(...parts) {
  return norm(parts.flat().filter(Boolean).join(' '));
}

/* ------------------------------------------------------------------ *
 * Building the list
 * ------------------------------------------------------------------ */

/**
 * One searchable entry.
 *
 * `name` and `code` are the two fields worth an exact match; `hay` is
 * everything else, which is what makes "any other" searchable — an area, a
 * course, a payment reference, a note somebody typed months ago.
 */
function entry({ kind, id, label, subtitle, name, code, hay, phones = [], data }) {
  return {
    kind,
    id,
    label,
    subtitle,
    name: norm(name),
    code: norm(code),
    hay: joined(hay),
    digits: phones.map((p) => normalizePhone(p)).filter(Boolean).join(' '),
    ...data,
  };
}

export function personEntries(bundles = []) {
  const out = [];
  for (const { workshop, registrations = [] } of bundles) {
    for (const reg of registrations) {
      out.push(entry({
        kind: 'person',
        id: `p:${workshop.id}:${reg.id}`,
        label: reg.name || '(no name)',
        subtitle: [reg.ticketId, workshop.title].filter(Boolean).join(' · '),
        name: reg.name,
        code: reg.ticketId,
        phones: [reg.whatsapp, reg.emergencyContact],
        hay: [
          reg.name, reg.ticketId, reg.whatsapp, reg.emergencyContact, reg.email,
          reg.area, reg.courseName, reg.qualification, reg.dob, reg.notes,
          reg.paymentRef, reg.paymentMode, reg.paymentStatus, reg.idRole,
          workshop.title, workshop.code,
        ],
        data: { workshop, reg },
      }));
    }
  }
  return out;
}

export function requestEntries(requests = [], bundles = []) {
  const byId = new Map(bundles.map((b) => [b.workshop.id, b.workshop]));
  return requests.map((req) => {
    const workshop = byId.get(req.workshopId) || null;
    return entry({
      kind: 'request',
      id: `q:${req.id}`,
      label: req.name || '(no name)',
      subtitle: [req.ref, workshop?.title || 'unknown workshop'].filter(Boolean).join(' · '),
      name: req.name,
      code: req.ref,
      phones: [req.whatsapp],
      hay: [
        req.name, req.ref, req.whatsapp, req.email, req.area, req.courseName,
        req.qualification, req.dob, req.notes, req.paymentRef, workshop?.title,
      ],
      data: { workshop, request: req },
    });
  });
}

export function workshopEntries(bundles = []) {
  return bundles.map(({ workshop, registrations = [] }) => entry({
    kind: 'workshop',
    id: `w:${workshop.id}`,
    label: workshop.title || '(untitled)',
    subtitle: [workshop.code, workshop.venue, `${registrations.length} registered`]
      .filter(Boolean).join(' · '),
    name: workshop.title,
    code: workshop.code,
    phones: workshop.contactNumbers || [],
    hay: [
      workshop.title, workshop.code, workshop.ticketPrefix, workshop.venue,
      workshop.presentedBy, workshop.collaborators, workshop.audience,
      workshop.topics, workshop.mode, workshop.resourcePersons,
      workshop.coordinators, workshop.contactNumbers, workshop.startDate,
    ],
    data: { workshop, registrations },
  }));
}

/** Everything on screen, in one list. */
export function buildIndex(bundles = [], requests = []) {
  return [
    ...personEntries(bundles),
    ...requestEntries(requests, bundles),
    ...workshopEntries(bundles),
  ];
}

/* ------------------------------------------------------------------ *
 * Searching
 * ------------------------------------------------------------------ */

/** Shortest query worth running. One letter matches half the register. */
export const MIN_QUERY = 2;

/** Enough digits to mean a phone number rather than a date or a fee. */
const MIN_PHONE_DIGITS = 5;

function escapeRegExp(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * How well one entry answers one query. Higher is better; 0 is no match.
 *
 * The order is the order of certainty, not of convenience. A full ticket ID
 * is somebody reading off a ticket; a scattering of words that all happen to
 * appear somewhere in a record is a hunch. Both are worth showing, and they
 * must never appear in the wrong order.
 */
export function score(entry, query) {
  const q = norm(query);
  if (q.length < MIN_QUERY) return 0;
  // Two forms of the same query, because the two sides write numbers
  // differently: stored numbers carry the country code, and somebody typing
  // `09339214522` from a call log carries a trunk zero instead. Matching only
  // the raw digits missed exactly the number that had just rung.
  const qDigits = digits(query);
  const qPhone = normalizePhone(query);
  const phoneish = qDigits.length >= MIN_PHONE_DIGITS
    && (entry.digits.includes(qDigits) || (qPhone && entry.digits.includes(qPhone)));

  if (entry.code && entry.code === q) return 100;
  if (entry.name && entry.name === q) return 92;
  if (entry.code && entry.code.startsWith(q)) return 85;
  if (phoneish) return 80;
  if (entry.name.startsWith(q)) return 72;
  // A word starting with the query: "khatun" finds "Sabnam Khatun", which
  // matters because half the office searches by second name.
  if (new RegExp(`\\b${escapeRegExp(q)}`).test(entry.name)) return 64;
  if (entry.name.includes(q)) return 48;
  if (entry.hay.includes(q)) return 32;

  // Last resort: every word appears somewhere, in any order and any field.
  // This is what answers "bangalore bba" — two facts, no name at all.
  const terms = q.split(' ').filter(Boolean);
  if (terms.length > 1 && terms.every((t) => entry.hay.includes(t))) return 16;
  return 0;
}

/** People before requests before workshops, when nothing else separates them. */
const KIND_ORDER = { person: 0, request: 1, workshop: 2 };

/**
 * The best matches, in order, and how many there were in total.
 *
 * Limited, and the total is reported rather than dropped: a search that
 * quietly shows ten of forty looks like an answer when it is a sample.
 */
export function search(index = [], query = '', limit = 12) {
  const q = norm(query);
  if (q.length < MIN_QUERY) return { rows: [], total: 0, short: true };

  const hits = [];
  for (const item of index) {
    const s = score(item, q);
    if (s > 0) hits.push({ item, score: s });
  }
  hits.sort((a, b) =>
    b.score - a.score
    || KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind]
    || a.item.label.localeCompare(b.item.label));

  return { rows: hits.slice(0, limit).map((h) => h.item), total: hits.length, short: false };
}

/* ------------------------------------------------------------------ *
 * What the overlay shows
 * ------------------------------------------------------------------ */

/** The facts about a workshop worth reading without opening it. */
export function workshopFacts({ workshop, registrations = [] }) {
  const paid = registrations.filter((r) => r.paymentStatus === 'Paid').length;
  const out = [
    ['Mode', workshop.mode || '—'],
    ['Registered', String(registrations.length)],
  ];
  if (workshop.seatLimit) {
    const left = Number(workshop.seatLimit) - registrations.length;
    out.push(['Seats', left < 0 ? `${-left} over ${workshop.seatLimit}` : `${left} left of ${workshop.seatLimit}`]);
  }
  if (isFreeWorkshop(workshop)) out.push(['Fee', 'Free']);
  else {
    out.push(['Fee', String(workshopFee(workshop))]);
    out.push(['Paid', `${paid} of ${registrations.length}`]);
  }
  if (workshop.venue) out.push(['Venue', workshop.venue]);
  if (workshop.presentedBy) out.push(['Presented by', workshop.presentedBy]);
  return out;
}

/** The fields somebody actually typed into a self-registration. */
export function requestFacts(request = {}) {
  return [
    ['Reference', request.ref],
    ['Status', request.status === 'new' ? 'Waiting' : request.status],
    ['Name', request.name],
    ['WhatsApp', request.whatsapp],
    ['Email', request.email],
    ['Date of birth', request.dob],
    ['Qualification', request.qualification],
    ['Course', request.courseName],
    ['Area', request.area],
    ['Payment', [request.paymentMode, request.paymentRef].filter(Boolean).join(' · ')],
    ['Notes', request.notes],
  ].filter(([, v]) => v);
}
