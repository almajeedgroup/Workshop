/**
 * Ticket identity tests.
 *
 * A ticket ID is the one thing a candidate is asked to bring with them, so
 * the rules that matter are: it is minted once, it never changes afterwards,
 * and no two people are ever handed the same one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ticketPrefixFor, formatTicketId, compareTicketIds,
  formatDate, formatDateRange, ticketMessage, paymentReminderMessage,
  whatsappLink, mailtoLink, telLink,
} from '../src/lib/tickets.js';

/* ------------------------------------------------------------------ *
 * Prefixes
 * ------------------------------------------------------------------ */

test('prefix: an explicit prefix wins, cleaned and capped at 10 characters', () => {
  assert.equal(ticketPrefixFor({ ticketPrefix: 'iic-ai26' }), 'IIC-AI26');
  assert.equal(ticketPrefixFor({ ticketPrefix: 'a very long prefix indeed' }).length, 10);
});

test('prefix: falls back to the workshop code, then to initials plus the year', () => {
  assert.equal(ticketPrefixFor({ code: 'iic/ai/26' }), 'IICAI26');
  assert.equal(
    ticketPrefixFor({ title: 'AI Hands-On Workshop', startDate: '2026-08-15' }),
    'AHOW26'
  );
});

test('prefix: a workshop with nothing to go on still gets one', () => {
  assert.equal(ticketPrefixFor({}), 'WS');
});

/* ------------------------------------------------------------------ *
 * Numbering and order
 * ------------------------------------------------------------------ */

test('ids: numbered from 001 within the workshop', () => {
  assert.equal(formatTicketId('AIHOW26', 1), 'AIHOW26-001');
  assert.equal(formatTicketId('AIHOW26', 42), 'AIHOW26-042');
  assert.equal(formatTicketId('AIHOW26', 1000), 'AIHOW26-1000');
});

test('order: the register reads in issue order past 999', () => {
  // A plain string sort files -1000 ahead of -999.
  const ids = ['AIHOW26-1000', 'AIHOW26-002', 'AIHOW26-999', 'AIHOW26-001'];
  assert.deepEqual(
    [...ids].sort(compareTicketIds),
    ['AIHOW26-001', 'AIHOW26-002', 'AIHOW26-999', 'AIHOW26-1000']
  );
});

test('order: rows with no ticket yet go last', () => {
  assert.deepEqual(
    ['', 'AIHOW26-002', '', 'AIHOW26-001'].sort(compareTicketIds),
    ['AIHOW26-001', 'AIHOW26-002', '', '']
  );
});

test('order: different prefixes group together', () => {
  assert.deepEqual(
    ['B-002', 'A-010', 'B-001', 'A-002'].sort(compareTicketIds),
    ['A-002', 'A-010', 'B-001', 'B-002']
  );
});

/* ------------------------------------------------------------------ *
 * Dates on the ticket
 * ------------------------------------------------------------------ */

test('dates print readably', () => {
  assert.equal(formatDate('2026-08-15'), '15 Aug 2026');
  assert.equal(formatDate(''), '');
  assert.equal(formatDateRange({ startDate: '2026-08-15', endDate: '2026-08-22' }), '15 Aug 2026 – 22 Aug 2026');
  assert.equal(formatDateRange({ startDate: '2026-08-15', endDate: '2026-08-15' }), '15 Aug 2026');
});

/* ------------------------------------------------------------------ *
 * The message that goes out
 * ------------------------------------------------------------------ */

const WORKSHOP = {
  title: 'AI Hands-On Workshop',
  startDate: '2026-08-15',
  venue: 'Kabir Independent PU College',
  feeAmount: 149,
};

test('ticket message carries the ID, the name and the payment state', () => {
  const msg = ticketMessage(WORKSHOP, {
    name: 'Ayesha Siddiqua', ticketId: 'AIHOW26-001', paymentStatus: 'Paid', amountPaid: 149,
  });
  assert.match(msg, /AIHOW26-001/);
  assert.match(msg, /Ayesha Siddiqua/);
  assert.match(msg, /received with thanks/);
});

test('an unpaid ticket says the amount is payable', () => {
  const msg = ticketMessage(WORKSHOP, { name: 'Ayesha', ticketId: 'X-001', paymentStatus: 'Pending' });
  assert.match(msg, /payable/);
  assert.doesNotMatch(msg, /received with thanks/);
});

test('the reminder names the amount still due', () => {
  const msg = paymentReminderMessage(WORKSHOP, { name: 'Ayesha', ticketId: 'X-001' });
  assert.match(msg, /149/);
  assert.match(msg, /Ayesha/);
});

/* ------------------------------------------------------------------ *
 * Links
 * ------------------------------------------------------------------ */

test('links: WhatsApp and tel use the normalised number', () => {
  assert.equal(whatsappLink('9845289298', 'hi'), 'https://wa.me/919845289298?text=hi');
  assert.equal(telLink('9845289298'), 'tel:+919845289298');
  assert.equal(whatsappLink('', 'hi'), '');
});

test('links: mailto encodes the subject and body', () => {
  const link = mailtoLink('a@b.com', 'Your Ticket', 'line one\nline two');
  assert.match(link, /^mailto:/);
  assert.match(link, /subject=Your%20Ticket/);
  assert.match(link, /line%20one%0Aline%20two/);
});
