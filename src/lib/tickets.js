/**
 * Ticket IDs, share links and the text of the ticket / receipt.
 *
 * A ticket is identified by `<PREFIX>-<NNN>` where the prefix comes from the
 * workshop (explicit `ticketPrefix`, else derived from its code or title) and
 * the number is allocated sequentially per workshop — see allocateTicketIds()
 * in db.js, which does it inside a transaction so two people importing at the
 * same time can never be given the same number.
 */

import { ISSUER, CURRENCY } from './schema.js';
import { normalizePhone } from './parser.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-08-15' -> '15 Aug 2026' */
export function formatDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  return `${Number(m[3])} ${MONTHS_SHORT[Number(m[2]) - 1]} ${m[1]}`;
}

/** '15 Aug 2026' or '15 Aug 2026 – 22 Aug 2026' */
export function formatDateRange(workshop) {
  const a = formatDate(workshop.startDate);
  const b = formatDate(workshop.endDate);
  if (a && b && b !== a) return `${a} – ${b}`;
  return a || b || '';
}

/**
 * Uppercase, alphanumeric, ≤10 chars — safe inside an ID.
 *
 * This is only ever consulted to MINT a prefix. Once a workshop has one it is
 * stored on the workshop document and reused verbatim (see db.js), because a
 * prefix derived from the title would otherwise change the moment anyone
 * edited the title — leaving one event with two different ticket series.
 */
export function ticketPrefixFor(workshop) {
  const explicit = String(workshop.ticketPrefix || '').trim();
  if (explicit) return explicit.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10);

  const fromCode = String(workshop.code || '').trim();
  if (fromCode) return fromCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

  // Initials of the title + the year: "AI Hands-On Workshop" 2026 -> AHOW26
  const initials = String(workshop.title || '')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
  const yr = String(workshop.startDate || '').slice(2, 4);
  return `${initials || 'WS'}${yr}`;
}

export function formatTicketId(prefix, seq) {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

/**
 * Register order for ticket IDs.
 *
 * IDs are padded to three digits, so a plain string sort puts `-1000` before
 * `-999`. Sorting on the trailing number keeps the register in issue order
 * without changing a single stored ID. Rows with no ticket yet go last.
 */
export function compareTicketIds(a, b) {
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  if (!x || !y) return x ? -1 : y ? 1 : 0;

  const nx = x.match(/^(.*?)-(\d+)$/);
  const ny = y.match(/^(.*?)-(\d+)$/);
  if (!nx || !ny) return x < y ? -1 : x > y ? 1 : 0;

  if (nx[1] !== ny[1]) return nx[1] < ny[1] ? -1 : 1;
  return Number(nx[2]) - Number(ny[2]);
}

/* ------------------------------------------------------------------ *
 * Link builders
 * ------------------------------------------------------------------ */

export function telLink(phone) {
  const d = normalizePhone(phone);
  return d ? `tel:+${d}` : '';
}

/** Opens WhatsApp (app or web) with the message pre-filled. */
export function whatsappLink(phone, text) {
  const d = normalizePhone(phone);
  if (!d) return '';
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function mailtoLink(email, subject, body) {
  if (!email) return '';
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ------------------------------------------------------------------ *
 * Ticket / receipt text
 * ------------------------------------------------------------------ */

export function ticketSubject(workshop, reg) {
  return `Your Ticket ${reg.ticketId || ''} — ${workshop.title}`.replace(/\s+/g, ' ').trim();
}

/**
 * The message sent over WhatsApp or email. Uses WhatsApp's *bold* markers,
 * which render as bold in WhatsApp and read fine as plain text in email.
 */
export function ticketMessage(workshop, reg, { ticketUrl = '' } = {}) {
  const paid = reg.paymentStatus === 'Paid';
  const amount = reg.amountPaid || workshop.feeAmount || '';
  const lines = [];

  lines.push(`*${ISSUER.name.toUpperCase()}*`);
  if (ISSUER.unitLine) lines.push(ISSUER.unitLine);
  lines.push('');
  lines.push('*ENTRY TICKET*');
  lines.push(`*Ticket ID:* ${reg.ticketId || '(not yet allocated)'}`);
  lines.push('');
  lines.push(`*Name:* ${reg.name}`);
  if (reg.qualification) lines.push(`*Qualification:* ${reg.qualification}`);
  lines.push('');
  lines.push(`*Workshop:* ${workshop.title}`);
  if (workshop.presentedBy) lines.push(`*Presented by:* ${workshop.presentedBy}`);
  if (workshop.collaborators) lines.push(`*In association with:* ${workshop.collaborators}`);
  const dates = formatDateRange(workshop);
  if (dates) lines.push(`*Date:* ${dates}`);
  if (workshop.time) lines.push(`*Time:* ${workshop.time}`);
  if (workshop.venue) lines.push(`*Venue:* ${workshop.venue}`);
  lines.push('');

  lines.push('*PAYMENT RECEIPT*');
  lines.push(`*Status:* ${reg.paymentStatus || 'Pending'}`);
  if (amount !== '' && amount !== null) {
    lines.push(`*Amount:* ${CURRENCY}${amount}${paid ? ' (received with thanks)' : ' (payable)'}`);
  }
  if (reg.paymentMode) lines.push(`*Mode:* ${reg.paymentMode}`);
  if (reg.paymentRef) lines.push(`*Reference:* ${reg.paymentRef}`);
  lines.push('');

  if (ticketUrl) {
    lines.push(`*View / print your ticket:* ${ticketUrl}`);
    lines.push('');
  }

  lines.push('Please carry this ticket (printed or on your phone) for entry.');
  if (ISSUER.phones.length) lines.push(`Enquiries: ${ISSUER.phones.join(' / ')}`);

  return lines.join('\n');
}

/** Same content with the *markers* removed — for plain email bodies. */
export function ticketMessagePlain(workshop, reg, opts) {
  return ticketMessage(workshop, reg, opts).replace(/\*/g, '');
}

/** Reminder text for someone who hasn't paid yet. */
export function paymentReminderMessage(workshop, reg) {
  const amount = workshop.feeAmount || '';
  return [
    `Assalamu 'alaykum ${reg.name},`,
    '',
    `This is a reminder that your registration fee for *${workshop.title}* is still pending.`,
    amount !== '' ? `*Amount due:* ${CURRENCY}${amount}` : '',
    reg.ticketId ? `*Ticket ID:* ${reg.ticketId}` : '',
    '',
    'Kindly complete the payment to confirm your seat.',
    ISSUER.phones.length ? `Enquiries: ${ISSUER.phones.join(' / ')}` : '',
    '',
    `— ${ISSUER.unitLine || ISSUER.name}`,
  ].filter(Boolean).join('\n');
}
