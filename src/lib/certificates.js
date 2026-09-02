/**
 * Certificate definitions.
 *
 * One certificate design, four kinds of award. Everything that differs
 * between them — the heading, the wording, the closing line — lives here, so
 * adding a fifth kind is an entry in CERTIFICATE_TYPES and nothing else.
 *
 * Placeholders in the text are filled from the certificate record:
 *   {name} {workshop} {dates} {venue} {presenter}
 */

import { ISSUER } from './schema.js';

export const CERTIFICATE_TYPES = [
  {
    key: 'completion',
    label: 'Completion',
    title: 'Certificate of Completion',
    lead: 'This certificate is proudly presented to',
    paragraphs: [
      'for successfully completing the {workshop} held {dates}, demonstrating active participation, creativity, and practical learning throughout the programme.',
      'During the workshop the participant gained hands-on experience across every session, applying what was taught to work of their own. Their dedication, innovation and successful completion of the programme are sincerely appreciated.',
    ],
    cheer: 'Congratulations on successfully completing the {workshop}!',
  },
  {
    key: 'participation',
    label: 'Participation',
    title: 'Certificate of Participation',
    lead: 'This certificate is presented to',
    paragraphs: [
      'in recognition of their participation in the {workshop} held {dates}, and of the interest and effort they brought to every session.',
      'Their presence and contribution added to the learning of everyone taking part, and are gratefully acknowledged.',
    ],
    cheer: 'Thank you for being part of the {workshop}.',
  },
  {
    key: 'excellence',
    label: 'Excellence',
    title: 'Certificate of Excellence',
    lead: 'This certificate is proudly awarded to',
    paragraphs: [
      'in recognition of outstanding achievement in the {workshop} held {dates}, where their work stood well above what the programme asked of them.',
      'The originality, rigour and craft evident in their work marked them out among their peers. This distinction is awarded with admiration and with every confidence in what they will go on to build.',
    ],
    cheer: 'Awarded for excellence in the {workshop}.',
  },
  {
    key: 'appreciation',
    label: 'Appreciation',
    title: 'Certificate of Appreciation',
    lead: 'This certificate is presented with gratitude to',
    paragraphs: [
      'in sincere appreciation of their valuable contribution to the {workshop} held {dates}.',
      'Their generosity with time, expertise and encouragement made the programme possible and left it better than they found it. That contribution is recorded here with thanks.',
    ],
    cheer: 'With sincere thanks from {issuer}.',
  },
];

export const certificateTypeByKey = Object.fromEntries(
  CERTIFICATE_TYPES.map((t) => [t.key, t])
);

export const DEFAULT_CERTIFICATE_TYPE = 'completion';

/* ------------------------------------------------------------------ *
 * Designs
 * ------------------------------------------------------------------ *
 *
 * A design is HOW a certificate looks; a type is WHAT it says. They are kept
 * apart on purpose — a Youth Parliament course can award completion,
 * participation, excellence and appreciation, all on the parliament sheet,
 * without four more entries in CERTIFICATE_TYPES.
 *
 * The design is chosen on the workshop, so every certificate for one course
 * matches, and it is STORED on each certificate as it is issued. That second
 * part matters: the public verification page must show the sheet that was
 * actually awarded, not whatever the workshop was changed to afterwards.
 */
export const CERTIFICATE_DESIGNS = [
  {
    key: 'classic',
    label: 'Classic — tricolour',
    note: 'Saffron and green edges, the chakra behind. The general-purpose sheet.',
  },
  {
    key: 'parliament',
    label: 'Parliament — red',
    note: 'A red double keyline and a facts panel. Made for the Youth Parliament, '
      + 'and suited to any course with a code, a duration and a list of topics.',
  },
];

export const DEFAULT_CERTIFICATE_DESIGN = 'classic';

export const certificateDesignByKey = Object.fromEntries(
  CERTIFICATE_DESIGNS.map((d) => [d.key, d])
);

/** The design to draw, falling back rather than rendering nothing. */
export function certificateDesign(cert) {
  return certificateDesignByKey[cert?.design]
    || certificateDesignByKey[DEFAULT_CERTIFICATE_DESIGN];
}

/** The signatories printed along the foot of every certificate. */
export const SIGNATORIES = [
  { name: 'Dr. Zoheb Javeed Khan', role: 'President', org: 'Islamic Information Centre' },
  { name: 'Ms. Sayeeda Arshiya', role: 'Principal', org: 'Kabir IND PU College for Women' },
  { name: 'Mr. Sulaimaan', role: 'Trainer', org: ISSUER.operator },
];

/** The crests across the head of the certificate. */
export const CRESTS = [
  { src: '/crests/beyond-guidance.png', alt: 'Beyond Guidance' },
  { src: '/crests/islamic-information-centre.png', alt: 'Islamic Information Centre' },
  { src: '/crests/kabir-college.png', alt: 'Kabir IND PU College for Women' },
  { src: '/crests/al-majeed.png', alt: ISSUER.operator },
];

/** Substitute {placeholders}; anything unknown is left blank rather than printed raw. */
export function fillTemplate(text, values) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (_, key) => {
    const v = values[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Certificate IDs read `PREFIX-TYPE-NNN`, e.g. `AIHOW26-COM-001`.
 *
 * The workshop's ticket prefix is reused so a candidate's ticket and
 * certificate visibly belong together, and the type is carried in the ID so a
 * number issued for completion can never collide with one for excellence.
 */
export function certificateTypeCode(typeKey) {
  return String(typeKey || '').slice(0, 3).toUpperCase() || 'CER';
}

export function formatCertificateId(prefix, typeKey, seq) {
  const clean = String(prefix || 'CERT').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return `${clean}-${certificateTypeCode(typeKey)}-${String(seq).padStart(3, '0')}`;
}

/** Reverse of formatCertificateId, for sorting and for the counter's high-water mark. */
export function parseCertificateId(id) {
  const m = String(id ?? '').trim().match(/^(.*)-([A-Z]{3})-(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], typeCode: m[2], seq: Number(m[3]) };
}

/** Highest number already issued for this workshop and type. */
export function highestCertificateSeq(prefix, typeKey, ids = []) {
  const wantPrefix = String(prefix || '').toUpperCase();
  const wantCode = certificateTypeCode(typeKey);
  let highest = 0;
  for (const id of ids) {
    const parsed = parseCertificateId(id);
    if (!parsed) continue;
    if (parsed.prefix.toUpperCase() !== wantPrefix) continue;
    if (parsed.typeCode !== wantCode) continue;
    highest = Math.max(highest, parsed.seq);
  }
  return highest;
}

/** Register order: by type, then by number. */
export function compareCertificateIds(a, b) {
  const pa = parseCertificateId(a);
  const pb = parseCertificateId(b);
  if (!pa || !pb) {
    const x = String(a ?? ''); const y = String(b ?? '');
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (pa.prefix !== pb.prefix) return pa.prefix < pb.prefix ? -1 : 1;
  if (pa.typeCode !== pb.typeCode) return pa.typeCode < pb.typeCode ? -1 : 1;
  return pa.seq - pb.seq;
}

/**
 * Everything the printed certificate needs, resolved from a stored record.
 * Kept separate from the component so the same text can be reused in a share
 * message or an export without rendering anything.
 */
export function certificateContent(cert) {
  const type = certificateTypeByKey[cert.type] || certificateTypeByKey[DEFAULT_CERTIFICATE_TYPE];
  const values = {
    name: cert.recipientName || '',
    workshop: cert.workshopTitle || '',
    dates: cert.workshopDates || '',
    venue: cert.venue || '',
    presenter: cert.presentedBy || '',
    issuer: ISSUER.unitLine || ISSUER.name,
  };
  return {
    title: type.title,
    lead: type.lead,
    paragraphs: type.paragraphs.map((p) => fillTemplate(p, values)),
    cheer: fillTemplate(type.cheer, values),
    label: type.label,
  };
}
