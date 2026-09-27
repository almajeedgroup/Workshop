import test from 'node:test';
import assert from 'node:assert/strict';
import {
  phoneFields, phonePatch, before, summarise, writesFor, fieldLabel, REQUEST_PHONE_FIELDS,
} from '../src/lib/phonefix.js';
import { WORKSHOP_FIELDS, REGISTRATION_FIELDS } from '../src/lib/schema.js';

/* ---------------- which fields count as phones ---------------- */

test('phone fields are read from the schema, not listed by hand', () => {
  const keys = phoneFields(REGISTRATION_FIELDS).map((f) => f.key);
  assert.ok(keys.includes('whatsapp'));
  assert.ok(keys.includes('emergencyContact'));
  assert.ok(!keys.includes('name'));
  assert.ok(!keys.includes('email'));
});

test('a list is only migrated if it says it holds numbers', () => {
  const keys = phoneFields(WORKSHOP_FIELDS).map((f) => f.key);
  assert.deepEqual(keys, ['contactNumbers']);
  // Resource persons and coordinators are lists too. Running names through a
  // phone formatter is the failure this guards.
  const listKeys = WORKSHOP_FIELDS.filter((f) => f.type === 'list').map((f) => f.key);
  assert.ok(listKeys.length > 1, 'there are other lists to get wrong');
});

/* ---------------- what changes ---------------- */

test('a bare ten-digit number gains the country code', () => {
  assert.deepEqual(
    phonePatch({ whatsapp: '9845289298' }, REGISTRATION_FIELDS),
    { whatsapp: '+91 9845289298' }
  );
});

test('the shapes people actually type all land on the same value', () => {
  const forms = ['9845289298', '09845289298', '+919845289298', '98452 89298', '+91 9845289298 '];
  const got = forms.map((v) => phonePatch({ whatsapp: v }, REGISTRATION_FIELDS)?.whatsapp || v);
  assert.equal(new Set(got).size, 1, `expected one shape, got ${JSON.stringify(got)}`);
});

test('both phone fields on a registration are migrated together', () => {
  assert.deepEqual(
    phonePatch({ whatsapp: '9845289298', emergencyContact: '06364630740' }, REGISTRATION_FIELDS),
    { whatsapp: '+91 9845289298', emergencyContact: '+91 6364630740' }
  );
});

test('an enquiry list is rewritten entry by entry', () => {
  assert.deepEqual(
    phonePatch({ contactNumbers: ['9845289298', '+91 6364630740'] }, WORKSHOP_FIELDS),
    { contactNumbers: ['+91 9845289298', '+91 6364630740'] }
  );
});

/* ---------------- what must NOT change ---------------- */

test('a number already in shape produces no patch, so a second run writes nothing', () => {
  assert.equal(phonePatch({ whatsapp: '+91 9845289298' }, REGISTRATION_FIELDS), null);
});

test('the migration is idempotent', () => {
  let rec = { whatsapp: '9845289298', emergencyContact: '9845289299' };
  const first = phonePatch(rec, REGISTRATION_FIELDS);
  rec = { ...rec, ...first };
  assert.equal(phonePatch(rec, REGISTRATION_FIELDS), null);
});

test('anything it cannot confidently read is left exactly alone', () => {
  for (const v of ['+1 415 555 0132', 'ask at the desk', '1234', '+971 50 123 4567', 'call the office']) {
    assert.equal(
      phonePatch({ whatsapp: v }, REGISTRATION_FIELDS), null,
      `${v} should have been left alone`
    );
  }
});

test('an Indian landline is migrated too, and correctly', () => {
  // +91 80 2345 6789 — country code, then Bangalore's area code with the
  // trunk 0 dropped, which is what the 0 is for. Not a mobile, but a real
  // number the office may hold, and this is its international form.
  assert.deepEqual(
    phonePatch({ whatsapp: '080 2345 6789' }, REGISTRATION_FIELDS),
    { whatsapp: '+91 8023456789' }
  );
});

test('an empty or missing field is not filled in', () => {
  assert.equal(phonePatch({ whatsapp: '' }, REGISTRATION_FIELDS), null);
  assert.equal(phonePatch({}, REGISTRATION_FIELDS), null);
});

test('a missing list is not turned into an empty one', () => {
  const patch = phonePatch({ title: 'A workshop' }, WORKSHOP_FIELDS);
  assert.equal(patch, null);
});

test('a list already in shape is not rewritten', () => {
  assert.equal(
    phonePatch({ contactNumbers: ['+91 9845289298', 'ring the office'] }, WORKSHOP_FIELDS),
    null
  );
});

test('a mixed list is rewritten but keeps what it could not read', () => {
  assert.deepEqual(
    phonePatch({ contactNumbers: ['9845289298', 'ring the office'] }, WORKSHOP_FIELDS),
    { contactNumbers: ['+91 9845289298', 'ring the office'] }
  );
});

/* ---------------- requests ---------------- */

test('a request carries one phone field and it is migrated', () => {
  assert.deepEqual(
    phonePatch({ whatsapp: '9339214522', name: 'Sabnam Khatun' }, REQUEST_PHONE_FIELDS),
    { whatsapp: '+91 9339214522' }
  );
});

/* ---------------- the preview ---------------- */

test('before() reports what each patched field holds now', () => {
  const rec = { whatsapp: '9845289298', name: 'Someone' };
  assert.deepEqual(before(rec, { whatsapp: '+91 9845289298' }), { whatsapp: '9845289298' });
});

test('before() renders a list as one readable cell', () => {
  const rec = { contactNumbers: ['9845289298', '6364630740'] };
  assert.deepEqual(
    before(rec, { contactNumbers: [] }),
    { contactNumbers: '9845289298; 6364630740' }
  );
});

test('summarise says there is nothing to do when there is nothing to do', () => {
  const s = summarise({ workshops: [], registrations: [], requests: [] });
  assert.match(s, /already in \+91 form/);
});

test('summarise counts each kind and totals them', () => {
  const s = summarise({ workshops: [1], registrations: [1, 2], requests: [] });
  assert.match(s, /^3 records to rewrite/);
  assert.match(s, /1 workshop, 2 registrations/);
  assert.ok(!s.includes('request'), 'a kind with nothing in it is not listed');
});

test('summarise gets its singulars right', () => {
  assert.match(summarise({ workshops: [], registrations: [1], requests: [] }),
    /^1 record to rewrite — 1 registration\./);
});

/* ---------------- the write set ---------------- */

test('a workshop is written, and its public mirror with it', () => {
  const writes = writesFor({
    workshops: [{ id: 'w1', mirrored: true, patch: { contactNumbers: ['+91 9845289298'] } }],
  });
  assert.deepEqual(writes, [
    { path: ['workshops', 'w1'], patch: { contactNumbers: ['+91 9845289298'] } },
    { path: ['publicWorkshops', 'w1'], patch: { contactNumbers: ['+91 9845289298'] } },
  ]);
});

test('an unpublished workshop gets no mirror write', () => {
  // Merging into a mirror that does not exist would CREATE one holding
  // nothing but a phone number.
  const writes = writesFor({
    workshops: [{ id: 'w1', mirrored: false, patch: { contactNumbers: ['+91 9845289298'] } }],
  });
  assert.deepEqual(writes.map((w) => w.path[0]), ['workshops']);
});

test('a registration is written under its workshop', () => {
  const writes = writesFor({
    registrations: [{ workshopId: 'w1', id: 'r1', patch: { whatsapp: '+91 9845289298' } }],
  });
  assert.deepEqual(writes[0].path, ['workshops', 'w1', 'registrations', 'r1']);
});

test('a request is written in its own collection', () => {
  const writes = writesFor({ requests: [{ id: 'q1', patch: { whatsapp: '+91 9845289298' } }] });
  assert.deepEqual(writes[0].path, ['registrationRequests', 'q1']);
});

test('an empty scan asks for no writes at all', () => {
  assert.deepEqual(writesFor({ workshops: [], registrations: [], requests: [] }), []);
  assert.deepEqual(writesFor({}), []);
});

test('the preview names fields the way the forms do', () => {
  assert.equal(fieldLabel('whatsapp'), 'WhatsApp #');
  assert.equal(fieldLabel('emergencyContact'), 'Emergency Contact');
  assert.equal(fieldLabel('contactNumbers'), 'Enquiry Numbers');
  assert.equal(fieldLabel('somethingElse'), 'somethingElse');
});
