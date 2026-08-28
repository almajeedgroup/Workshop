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
  operator: 'Al-Majeed School of Research Methodology & Innovation',
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
    key: 'feeAmount',
    label: `Registration Fee (${CURRENCY})`,
    type: 'number',
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
    aliases: ['upi', 'upi id', 'payment upi', 'vpa', 'pay to'],
    hint: 'Fees are collected here. Leave blank to use the organisation default.',
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
  for (const f of fields) out[f.key] = f.type === 'list' ? [] : '';
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
