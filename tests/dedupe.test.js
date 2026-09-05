/**
 * Duplicate-detection tests.
 *
 * Registrations arrive as pasted WhatsApp replies, so overlapping batches are
 * routine. The cost of a missed duplicate is a second ticket and a seat that
 * nobody is sitting in; the cost of a false positive is a registration quietly
 * dropped — so the matcher only speaks up on evidence it can defend.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { matchKeys, splitDuplicates, describeDuplicate } from '../src/lib/dedupe.js';

test('the same phone number, written differently, is the same person', () => {
  const existing = [{ name: 'Ayesha Siddiqua', whatsapp: '9845289298', ticketId: 'X-001' }];
  const { unique, duplicates } = splitDuplicates(
    [{ name: 'Ayesha S', whatsapp: '+91 98452 89298' }],
    existing
  );
  assert.equal(unique.length, 0);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].reason, 'same WhatsApp number');
});

test('email matches ignore case', () => {
  const { duplicates } = splitDuplicates(
    [{ name: 'A', email: 'Ayesha@Example.com' }],
    [{ name: 'Ayesha', email: 'ayesha@example.com' }]
  );
  assert.equal(duplicates[0].reason, 'same email');
});

test('name and date of birth together identify someone with no phone', () => {
  const { duplicates } = splitDuplicates(
    [{ name: 'Ayesha  Siddiqua', dob: '2010-03-12' }],
    [{ name: 'ayesha siddiqua', dob: '2010-03-12' }]
  );
  assert.equal(duplicates[0].reason, 'same name and date of birth');
});

test('a repeat inside one batch is caught without any existing records', () => {
  const rows = [
    { name: 'Ayesha', whatsapp: '9845289298' },
    { name: 'Faizan', whatsapp: '6364630740' },
    { name: 'Ayesha', whatsapp: '9845289298' },
  ];
  const { unique, duplicates } = splitDuplicates(rows);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 1);
});

test('a name alone is never enough to call something a duplicate', () => {
  // Two different students really can both be called Mohammed.
  const { unique, duplicates } = splitDuplicates(
    [{ name: 'Mohammed' }],
    [{ name: 'Mohammed' }]
  );
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 0);
});

test('a short or missing phone number is not treated as an identity', () => {
  assert.deepEqual(matchKeys({ name: 'Ayesha', whatsapp: '12345' }), []);
  assert.deepEqual(matchKeys({ name: 'Ayesha' }), []);
});

test('different people pass through untouched', () => {
  const { unique, duplicates } = splitDuplicates(
    [{ name: 'Faizan', whatsapp: '6364630740' }],
    [{ name: 'Ayesha', whatsapp: '9845289298' }]
  );
  assert.equal(unique.length, 1);
  assert.equal(duplicates.length, 0);
});

test('the explanation names who the row collided with', () => {
  const { duplicates } = splitDuplicates(
    [{ name: 'Ayesha S', whatsapp: '9845289298' }],
    [{ name: 'Ayesha Siddiqua', whatsapp: '9845289298', ticketId: 'AIHOW26-004' }]
  );
  const text = describeDuplicate(duplicates[0]);
  assert.match(text, /Ayesha S/);
  assert.match(text, /same WhatsApp number/);
  assert.match(text, /AIHOW26-004/);
});

/* ------------------------------------------------------------------ *
 * Reported: a student could not be accepted from the QR queue.
 *
 * She shared an email address with a sibling already registered, which is
 * ordinary in a family. Detection was right; refusing on it was not.
 * ------------------------------------------------------------------ */

test('a shared family email is reported — and reported is all it is', () => {
  const registered = [{
    name: 'Amrin Khanum', email: 'amrinkhanum793@gmail.com',
    whatsapp: '9880011223', ticketId: 'AIHOW26-004',
  }];
  const incoming = [{
    name: 'Adifaah Shaikh', email: 'amrinkhanum793@gmail.com',
    whatsapp: '7975588058', qualification: '1st PUC', area: 'RT Nagar',
  }];

  const { unique, duplicates } = splitDuplicates(incoming, registered);

  assert.equal(duplicates.length, 1, 'the shared email is spotted');
  assert.equal(duplicates[0].reason, 'same email');
  assert.equal(unique.length, 0);

  // The point: it hands back the row and who it matched, for the operator to
  // judge. It does not drop her, and nothing here can refuse a save.
  assert.equal(duplicates[0].row.name, 'Adifaah Shaikh');
  assert.equal(duplicates[0].against.name, 'Amrin Khanum');
  assert.match(describeDuplicate(duplicates[0]), /Adifaah Shaikh/);
  assert.match(describeDuplicate(duplicates[0]), /same email as Amrin Khanum, ticket AIHOW26-004/);
});

test('two siblings on one phone are each reported, never discarded', () => {
  const incoming = [
    { name: 'Adifaah Shaikh', whatsapp: '7975588058' },
    { name: 'Amrin Khanum', whatsapp: '7975588058' },
  ];
  const { unique, duplicates } = splitDuplicates(incoming, []);
  assert.equal(unique.length + duplicates.length, incoming.length,
    'every row comes back somewhere — detection loses nobody');
});
