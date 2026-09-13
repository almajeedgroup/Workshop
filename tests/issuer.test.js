import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_ISSUER, STAMP_FIELDS, issuerStamp, hasIssuerStamp,
  certificateIssuer, issuerLines,
} from '../src/lib/issuer.js';
import { ISSUER } from '../src/lib/schema.js';

const OLD = { name: 'Islamic Information Centre', unit: 'Beyond Guidance', operator: 'Al-Majeed School of Research Methodology and Innovation' };
const NEW = { name: 'WORKSHOP', unit: 'Beyond Guidance', operator: 'Al-Majeed School of Research Methodology and Innovation' };

/* ---------------- the stamp ---------------- */

test('a stamp carries only the three fields a certificate prints', () => {
  const stamp = issuerStamp({ ...OLD, email: 'x@y.z', phones: ['1'], upiId: 'a@b' });
  assert.deepEqual(Object.keys(stamp).sort(), [...STAMP_FIELDS].sort());
  assert.ok(!('email' in stamp), 'an allow-list, not a copy of ISSUER');
});

test('a missing field becomes an empty string, never undefined', () => {
  // Firestore refuses undefined, and a half-written stamp is worse than none.
  const stamp = issuerStamp({ name: 'Only a name' });
  assert.equal(stamp.unit, '');
  assert.equal(stamp.operator, '');
  assert.deepEqual(issuerStamp(null), { name: '', unit: '', operator: '' });
});

test('a record with no stamp is recognised as having none', () => {
  assert.equal(hasIssuerStamp({}), false);
  assert.equal(hasIssuerStamp({ issuer: null }), false);
  assert.equal(hasIssuerStamp({ issuer: {} }), false);
  assert.equal(hasIssuerStamp({ issuer: { name: '   ' } }), false, 'blank is not a stamp');
  assert.equal(hasIssuerStamp({ issuer: 'Islamic Information Centre' }), false, 'a string is not a stamp');
  assert.equal(hasIssuerStamp({ issuer: OLD }), true);
});

/* ---------------- the whole point ---------------- */

test('a stamped certificate keeps its own issuer however the school is renamed', () => {
  // This is the failure the stamp exists to prevent: an employer checking a
  // 2025 award being shown a 2026 organisation.
  const cert = { certificateId: 'IIC-YP25-P-004', issuer: OLD };
  assert.deepEqual(certificateIssuer(cert, NEW), OLD);
  assert.equal(certificateIssuer(cert, NEW).name, 'Islamic Information Centre');
});

test('an unstamped certificate falls back to the live constant', () => {
  assert.deepEqual(certificateIssuer({}, NEW), issuerStamp(NEW));
  assert.equal(certificateIssuer({}).name, ISSUER.name, 'and by default to the real one');
});

test('it is the stamp or the fallback, never a mixture', () => {
  // A sheet showing last year's school beside this year's unit would be
  // worse than either.
  const half = { issuer: { name: 'Old Body' } };
  const got = certificateIssuer(half, NEW);
  assert.equal(got.name, 'Old Body');
  assert.equal(got.unit, '', 'not NEW.unit');
  assert.equal(got.operator, '', 'not NEW.operator');
});

/* ---------------- the frozen wording ---------------- */

test('the legacy issuer is what every certificate carried until the rebrand', () => {
  assert.deepEqual({ ...LEGACY_ISSUER }, OLD);
});

test('it cannot be edited at runtime', () => {
  // It is not configuration. It is a record of what is on paper in other
  // people's hands, and changing it only makes this app describe them wrongly.
  assert.ok(Object.isFrozen(LEGACY_ISSUER));
  assert.throws(() => { 'use strict'; LEGACY_ISSUER.name = 'Something else'; });
});

test('the backfill does not depend on being run before the rebrand', () => {
  // Reading the live constant would be correct only if run first, and would
  // destroy what it protects if run after. Frozen wording removes the trap.
  const afterTheRebrand = issuerStamp(LEGACY_ISSUER);
  assert.equal(afterTheRebrand.name, 'Islamic Information Centre');
  assert.notEqual(afterTheRebrand.name, NEW.name);
});

/* ---------------- what the sheet prints ---------------- */

test('the two printed lines are built from the record', () => {
  assert.deepEqual(issuerLines(OLD), {
    lead: 'Beyond Guidance · A Unit of Islamic Information Centre',
    association: 'In association with Al-Majeed School of Research Methodology and Innovation',
  });
});

test('an empty association line is left off rather than printed empty', () => {
  // "In association with" followed by nothing is worse than no line.
  assert.equal(issuerLines({ name: 'A body', unit: 'A unit' }).association, '');
  assert.equal(issuerLines({}).lead, '');
  assert.equal(issuerLines(null).association, '');
});

test('a unit on its own, or a body on its own, still reads', () => {
  assert.equal(issuerLines({ unit: 'Beyond Guidance' }).lead, 'Beyond Guidance');
  assert.equal(issuerLines({ name: 'Islamic Information Centre' }).lead, 'Islamic Information Centre');
});
