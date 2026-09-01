/**
 * SINGLE SOURCE OF TRUTH for the whole app.
 *
 * The parser, the edit form, the table columns, the Excel/CSV exports, the
 * ticket and the receipt are all generated from the arrays below. To change
 * what is stored, edit ONLY this file.
 *
 * Field shape:
 *   key      - Firestore field name (camelCase, never change once data exists)
 *   label    - what humans see
 *   type     - 'text' | 'longtext' | 'date' | 'number' | 'enum' | 'list' | 'tel' | 'email'
 *   options  - for type 'enum'
 *   required - blocks save when empty
 *   inTable  - show as a column in the list view
 *   aliases  - LOWERCASE label variants the text parser will recognise.
 */

/* ------------------------------------------------------------------ *
 * Organisation identity — appears on tickets, receipts and print-outs
 * ------------------------------------------------------------------ */

export const ISSUER = {
  /** Whose receipt this is. */
  name: 'Islamic Information Centre',
  unit: 'Beyond Guidance',
  unitLine: 'Beyond Guidance, a unit of Islamic Information Centre',
  phones: ['+91 98452 89298', '+91 63646 30740'],
  /** Shown in the app masthead — who built/operates the system. */
  /**
   * The school that built and runs this system, and is named as an associate
   * on everything it produces.
   *
   * THE canonical spelling. It was written three different ways across the
   * code — with a comma after "Research", with "&" and with "and" — which on
   * a certificate and the ticket for the same course is the kind of thing
   * people notice. Every document now takes it from here.
   */
  operator: 'Al-Majeed School of Research Methodology and Innovation',
  /** The public site. Used in the footer, on certificates and in share links. */
  site: 'school.almajeedgroup.in',
  siteUrl: 'https://school.almajeedgroup.in',
  email: 'almajeed.work@gmail.com',
  city: 'Bengaluru, Karnataka',
  /**
   * UPI ID that registration fees are paid to, e.g. 'name@okhdfcbank'.
   * Shown as a scannable QR on the public registration form, with the fee
   * already filled in. A workshop can override it with its own Payment UPI
   * field. Leave blank and the form asks students to call instead.
   */
  upiId: '',
  upiName: 'Islamic Information Centre',
  /**
   * A payment QR supplied by the bank — a BharatQR or merchant standee — used
   * for every workshop that does not set its own.
   *
   * Normally you leave this empty and upload the QR on the workshop screen,
   * which stores it on the record: no file to copy, no deploy to run. Set it
   * only to ship a QR with the site itself, as a path to a file in `public/`
   * (e.g. `/payment-qr.png`).
   *
   * Either way an image beats `upiId`, because a merchant QR carries card
   * rails a plain UPI link cannot. It carries no amount, though, so the form
   * asks the payer to type the fee in.
   */
  paymentQrImage: '',
};

export const ORG_NAME = ISSUER.operator;
export const CURRENCY = '₹';

/**
 * Permanent owner account. This address is always treated as an administrator,
 * so the very first sign-in works without anyone having to hand-create an
 * /admins document first. Every other administrator is added by creating
 * /admins/{uid} in Firestore.
 *
 * KEEP IN SYNC with the same address in `firestore.rules` — the rules file
 * cannot import from JavaScript, so the value is written in both places.
 * Changing it here alone changes nothing on the server.
 */
export const BOOTSTRAP_ADMIN_EMAIL = 'almajeed.work@gmail.com';

/* ------------------------------------------------------------------ *
 * Workshop
 * ------------------------------------------------------------------ */

/**
 * ID card colourways and crests, by key.
 *
 * The definitions themselves live in `lib/idcards.js` — the colours, the
 * crest files and how a card is laid out. Only the keys are needed here, and
 * importing the module would make schema.js depend on something that depends
 * on it.
 */
export const ID_CARD_THEME_KEYS = ['saffron', 'emerald', 'indigo', 'maroon', 'teal', 'slate'];
export const ID_CARD_THEME_LABELS = {
  saffron: 'Saffron', emerald: 'Emerald', indigo: 'Indigo',
  maroon: 'Maroon', teal: 'Teal', slate: 'Slate',
};
export const ID_CARD_CREST_KEYS = ['almajeed', 'kabir', 'iic', 'beyond'];
export const ID_CARD_CREST_LABELS = {
  almajeed: 'Al-Majeed School',
  kabir: 'Kabir IND PU College',
  iic: 'Islamic Information Centre',
  beyond: 'Beyond Guidance',
};
/** Thumbnails for the picker, so an order is arranged by sight not by name. */
export const ID_CARD_CREST_IMAGES = {
  almajeed: '/crests/al-majeed.png',
  kabir: '/crests/kabir-college.png',
  iic: '/crests/islamic-information-centre.png',
  beyond: '/crests/beyond-guidance.png',
};

/** Blood groups a card may carry. Free text gets typed six different ways. */
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * Whether a course charges. Chosen when the course is established, because
 * it decides what the public form asks for and what the organiser has to
 * chase afterwards.
 */
export const FEE_TYPES = ['Free', 'Paid'];

/**
 * Who the course is run in association with, for print.
 *
 * Al-Majeed School is named on everything this system produces, whether or
 * not anyone typed it into the workshop, and it comes last so a partner
 * named for a particular course leads.
 *
 * If somebody HAS typed it into the collaborators — which they will, and
 * spelled some other way — it is not repeated. Matching ignores case,
 * punctuation, and "&" against "and", because those are exactly the
 * differences a person types without thinking.
 */
export function associationLine(workshop) {
  const flat = (v) => String(v ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const own = String(workshop?.collaborators ?? '').trim();
  const house = ISSUER.operator;
  if (!own) return house;
  return flat(own).includes(flat(house)) ? own : `${own} · ${house}`;
}

/**
 * Is this a free course?
 *
 * Explicit `feeType` wins. Workshops created before the field existed have
 * none, so they fall back to what they charge — which is how they behaved
 * already, and keeps a paid workshop from silently becoming free.
 */
export function isFreeWorkshop(w) {
  if (!w) return false;
  if (w.feeType === 'Free') return true;
  if (w.feeType === 'Paid') return false;
  return !(Number(w.feeAmount) > 0);
}

/** What a candidate owes, as a number. Always 0 on a free course. */
export function workshopFee(w) {
  if (isFreeWorkshop(w)) return 0;
  return Number(w?.feeAmount) || 0;
}

/** The fields to show for a given workshop, honouring every `showWhen`. */
export function visibleWorkshopFields(w) {
  return WORKSHOP_FIELDS.filter((f) => typeof f.showWhen !== 'function' || f.showWhen(w));
}

export const WORKSHOP_FIELDS = [
  {
    key: 'title',
    label: 'Workshop Title',
    type: 'text',
    required: true,
    inTable: true,
    aliases: [
      'title', 'workshop title', 'workshop', 'name of the workshop', 'name of workshop',
      'programme title', 'program title', 'programme', 'program', 'topic of workshop',
      'event', 'event name', 'event title', 'subject', 'topic',
    ],
  },
  {
    key: 'code',
    label: 'Workshop Code',
    type: 'text',
    inTable: true,
    aliases: ['code', 'workshop code', 'ref', 'ref no', 'reference', 'reference no', 'id', 'workshop id'],
  },
  {
    key: 'ticketPrefix',
    label: 'Ticket ID Prefix',
    type: 'text',
    aliases: ['ticket prefix', 'ticket id prefix', 'prefix'],
    hint: 'Ticket IDs become PREFIX-001, PREFIX-002 … e.g. IIC-AI26',
  },
  {
    key: 'startDate',
    label: 'Start Date',
    type: 'date',
    inTable: true,
    aliases: ['date', 'dates', 'start date', 'from', 'from date', 'date of workshop', 'held on', 'conducted on', 'commencement', 'day'],
  },
  {
    key: 'endDate',
    label: 'End Date',
    type: 'date',
    aliases: ['end date', 'to', 'to date', 'till', 'until', 'upto', 'concluded on'],
  },
  {
    key: 'time',
    label: 'Time',
    type: 'text',
    aliases: ['time', 'timing', 'timings', 'session time', 'schedule', 'hours of session'],
  },
  {
    key: 'durationHours',
    label: 'Duration (hours)',
    type: 'number',
    aliases: ['duration', 'hours', 'no of hours', 'number of hours', 'total hours', 'duration in hours'],
  },
  {
    key: 'mode',
    label: 'Mode',
    type: 'enum',
    options: ['Offline', 'Online', 'Hybrid'],
    inTable: true,
    aliases: ['mode', 'mode of conduct', 'mode of workshop', 'platform', 'type', 'delivery mode', 'conducted through'],
  },
  {
    key: 'venue',
    label: 'Venue',
    type: 'text',
    inTable: true,
    aliases: ['venue', 'place', 'location', 'hall', 'venue of workshop', 'address'],
  },
  {
    key: 'presentedBy',
    label: 'Presented By',
    type: 'text',
    aliases: ['presented by', 'organizer', 'organiser', 'organized by', 'organised by', 'conducted by', 'host', 'department', 'dept'],
    hint: ISSUER.unitLine,
  },
  {
    key: 'collaborators',
    label: 'In Association With',
    type: 'text',
    aliases: ['collaborator', 'collaborators', 'in collaboration with', 'collaboration', 'in association with', 'association with', 'partner', 'partners', 'sponsored by'],
  },
  {
    key: 'resourcePersons',
    label: 'Resource Person(s)',
    type: 'list',
    aliases: ['resource person', 'resource persons', 'speaker', 'speakers', 'trainer', 'trainers', 'facilitator', 'facilitators', 'guest', 'chief guest', 'expert'],
  },
  {
    key: 'coordinators',
    label: 'Coordinator(s)',
    type: 'list',
    aliases: ['coordinator', 'coordinators', 'co ordinator', 'convenor', 'convener', 'organising secretary', 'organizing secretary', 'in charge', 'incharge'],
  },
  {
    key: 'audience',
    label: 'Eligibility / For Whom',
    type: 'text',
    aliases: ['audience', 'target audience', 'for whom', 'beneficiaries', 'intended for', 'eligibility', 'who can attend', 'for students of', 'for'],
  },
  {
    key: 'seatLimit',
    label: 'Seat Limit',
    type: 'number',
    inTable: true,
    aliases: ['seat limit', 'seats', 'limited seats', 'max participants', 'maximum participants', 'capacity', 'intake', 'only first'],
  },
  {
    key: 'feeType',
    label: 'Course Type',
    type: 'enum',
    options: FEE_TYPES,
    inTable: true,
    aliases: ['course type', 'fee type', 'free or paid', 'paid or free', 'type of course'],
    hint: 'Free hides the fee, the payment QR and the payment columns everywhere.',
  },
  {
    key: 'feeAmount',
    label: `Registration Fee (${CURRENCY})`,
    type: 'number',
    // Meaningless on a free course, and a stale amount left behind after
    // switching to Free is exactly how a free workshop ends up asking for
    // money on its public page.
    showWhen: (w) => !isFreeWorkshop(w),
    aliases: ['fee', 'fees', 'registration fee', 'cost', 'charges', 'amount', 'course fee'],
  },
  {
    key: 'contactNumbers',
    label: 'Enquiry Numbers',
    type: 'list',
    aliases: ['contact', 'contacts', 'contact number', 'contact numbers', 'enquiry', 'enquiries', 'phone', 'call', 'for registration'],
  },
  {
    key: 'paymentUpi',
    label: 'Payment UPI ID',
    type: 'text',
    showWhen: (w) => !isFreeWorkshop(w),
    aliases: ['upi', 'upi id', 'payment upi', 'vpa', 'pay to'],
    hint: 'Fees are collected here. Leave blank to use the organisation default.',
  },
  {
    key: 'paymentQrUrl',
    label: 'Payment QR Image',
    type: 'image',
    showWhen: (w) => !isFreeWorkshop(w),
    aliases: ['payment qr', 'qr image', 'payment qr image'],
    hint: 'The QR students scan to pay. Shown instead of the UPI QR when set. '
      + 'A bank QR carries no amount, so the form asks them to type the fee in.',
  },
  {
    key: 'registrationOpen',
    label: 'Public Registration',
    type: 'enum',
    options: ['Open', 'Closed'],
    aliases: ['registration open', 'public registration', 'registration status'],
    hint: 'Open lets students register themselves from the QR code on the poster.',
  },
  {
    key: 'idCardTheme',
    label: 'ID Card Colour',
    type: 'enum',
    options: ID_CARD_THEME_KEYS,
    optionLabels: ID_CARD_THEME_LABELS,
    aliases: ['id card colour', 'id card color', 'card colour', 'card color', 'id colour'],
    hint: 'The colourway every participant card for this course is printed in.',
  },
  {
    key: 'idCardCrests',
    label: 'ID Card Logos',
    type: 'multi',
    options: ID_CARD_CREST_KEYS,
    optionLabels: ID_CARD_CREST_LABELS,
    optionPreviews: ID_CARD_CREST_IMAGES,
    aliases: ['id card logos', 'card logos', 'logos', 'crests'],
    hint: 'Whose crests appear on the card, and in what order — left to right. '
      + 'All four, as listed, if you choose none.',
  },
  {
    key: 'idCardLabel',
    label: 'ID Card Role',
    type: 'text',
    aliases: ['id card role', 'card role', 'card label', 'id card label'],
    hint: 'Printed under the crest strip — PARTICIPANT, DELEGATE, VOLUNTEER. '
      + 'One person can be given a different role on their own card.',
  },
  {
    key: 'idCardNote',
    label: 'ID Card Note',
    type: 'longtext',
    aliases: ['id card note', 'card note', 'card instructions'],
    hint: 'A line along the foot of the back — a return address, a condition of entry.',
  },
  {
    key: 'topics',
    label: 'Topics / Highlights',
    type: 'longtext',
    aliases: ['topics', 'topics covered', 'contents', 'content', 'modules', 'sessions', 'agenda', 'syllabus', 'themes', 'highlights'],
  },
  {
    key: 'outcome',
    label: 'Outcome / Summary',
    type: 'longtext',
    aliases: ['outcome', 'outcomes', 'summary', 'report', 'brief report', 'remarks', 'conclusion', 'description', 'about', 'objective', 'objectives'],
  },
];

/* ------------------------------------------------------------------ *
 * Registration (one per registered candidate)
 * ------------------------------------------------------------------ */

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Waived', 'Refunded'];

export const REGISTRATION_FIELDS = [
  {
    key: 'name',
    label: 'Name',
    type: 'text',
    required: true,
    inTable: true,
    aliases: ['name', 'full name', 'candidate name', 'student name', 'participant', 'participant name', 'name of participant', 'name of student'],
  },
  {
    key: 'dob',
    label: 'DoB',
    type: 'date',
    inTable: true,
    aliases: ['dob', 'd o b', 'date of birth', 'birth date', 'birthday'],
  },
  {
    key: 'qualification',
    label: 'Qualification',
    type: 'text',
    inTable: true,
    aliases: ['qualification', 'qualifications', 'class', 'std', 'standard', 'grade', 'education', 'educational qualification'],
  },
  {
    key: 'courseName',
    label: 'Course Name',
    type: 'text',
    aliases: ['course name', 'course', 'stream', 'branch', 'programme', 'program', 'specialisation', 'specialization', 'subject'],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp #',
    type: 'tel',
    required: true,
    inTable: true,
    aliases: ['whatsapp', 'whatsapp no', 'whatsapp number', 'whats app', 'wa', 'mobile', 'mobile no', 'phone', 'phone no', 'contact', 'contact no', 'cell'],
  },
  {
    key: 'area',
    label: 'Area',
    type: 'text',
    inTable: true,
    aliases: ['area', 'locality', 'place', 'location', 'city', 'town', 'residence', 'address'],
  },
  {
    key: 'email',
    label: 'Email ID',
    type: 'email',
    inTable: true,
    aliases: ['email id', 'email', 'e mail', 'mail', 'email address', 'mail id'],
  },
  {
    key: 'paymentStatus',
    label: 'Payment',
    type: 'enum',
    options: PAYMENT_STATUSES,
    inTable: true,
    aliases: ['payment', 'payment status', 'paid', 'fee status', 'payment done', 'status'],
  },
  {
    key: 'amountPaid',
    label: `Amount Paid (${CURRENCY})`,
    type: 'number',
    aliases: ['amount paid', 'amount', 'paid amount', 'fee paid'],
  },
  {
    key: 'paymentMode',
    label: 'Payment Mode',
    type: 'text',
    aliases: ['payment mode', 'mode of payment', 'paid via', 'paid by', 'payment method'],
  },
  {
    key: 'paymentRef',
    label: 'Payment Ref.',
    type: 'text',
    aliases: ['payment ref', 'payment reference', 'transaction id', 'txn id', 'utr', 'reference no', 'receipt no'],
  },
  {
    key: 'ticketId',
    label: 'Ticket ID',
    type: 'text',
    inTable: true,
    aliases: ['ticket id', 'ticket no', 'ticket', 'ticket number'],
    hint: 'Allocated automatically on save — leave blank.',
  },
  {
    key: 'idRole',
    label: 'ID Card Role',
    type: 'text',
    aliases: ['id role', 'id card role', 'role', 'designation'],
    hint: 'Overrides the course-wide role on this one card.',
  },
  {
    key: 'bloodGroup',
    label: 'Blood Group',
    type: 'enum',
    options: BLOOD_GROUPS,
    aliases: ['blood group', 'blood', 'bloodgroup', 'blood type'],
  },
  {
    key: 'emergencyContact',
    label: 'Emergency Contact',
    type: 'tel',
    aliases: ['emergency contact', 'emergency', 'emergency no', 'emergency number',
              'guardian contact', 'parent contact', 'in case of emergency'],
  },
  {
    key: 'idValidUntil',
    label: 'ID Valid Until',
    type: 'date',
    aliases: ['id valid until', 'valid until', 'valid till', 'card valid until'],
    hint: 'Defaults to the last day of the course.',
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'text',
    aliases: ['notes', 'note', 'remarks', 'remark', 'comment'],
  },
];

/**
 * Column order the parser assumes when a pasted table has NO header row.
 *
 * Email, phone and date-of-birth are detected by pattern wherever they sit,
 * so they are excluded here — otherwise a row that happens to omit DoB would
 * shift every later column by one.
 */
export const REGISTRATION_POSITIONAL_ORDER = [
  'name', 'qualification', 'courseName', 'area', 'paymentStatus', 'notes',
];

/* ------------------------------------------------------------------ *
 * Lookups & blanks
 * ------------------------------------------------------------------ */

export const workshopFieldByKey = Object.fromEntries(WORKSHOP_FIELDS.map((f) => [f.key, f]));
export const registrationFieldByKey = Object.fromEntries(REGISTRATION_FIELDS.map((f) => [f.key, f]));

function blank(fields) {
  const out = {};
  for (const f of fields) out[f.key] = (f.type === 'list' || f.type === 'multi') ? [] : '';
  return out;
}

export function emptyWorkshop() {
  return blank(WORKSHOP_FIELDS);
}

let rowCounter = 0;

/**
 * A stable identity for a row that has no Firestore ID yet.
 *
 * The editing grid needs one: keyed by array index instead, deleting a row
 * makes React reuse the wrong inputs and the cursor jumps to another
 * candidate mid-typing. `_key` is not a schema field, so the sanitisers in
 * db.js — which copy only the fields declared above — never write it out.
 */
export function newRowKey() {
  rowCounter += 1;
  return `row-${Date.now().toString(36)}-${rowCounter}`;
}

export function emptyRegistration() {
  const r = blank(REGISTRATION_FIELDS);
  r.paymentStatus = 'Pending';
  r._key = newRowKey();
  return r;
}
