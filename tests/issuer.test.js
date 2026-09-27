import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_ISSUER, STAMP_FIELDS, issuerStamp, hasIssuerStamp,
  certificateIssuer, issuerLines,
} from '../src/lib/issuer.js';
import { ISSUER } from '../src/lib/schema.js';

/** The issuer as every certificate carried it up to the rebrand. */
const OLD = {
  name: 'Islamic Information Centre', unit: 'Beyond Guidance', unitLine: '',
  operator: 'Al-Majeed School of Research Methodology and Innovation', association: '',
};
/** And as it is now. */
const NEW = {
  name: 'WORKSHOP', unit: '',
  unitLine: 'by Al-Majeed School of Research Methodology and Innovation',
  operator: 'Al-Majeed School of Research Methodology and Innovation',
  association: 'Islamic Information Centre · Beyond Guidance',
};

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
  assert.deepEqual(issuerStamp(null),
    { name: '', unit: '', unitLine: '', operator: '', association: '' });
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

test('a stamp made before the rebrand prints EXACTLY what it printed then', () => {
  // Two fields were added to the stamp at the rebrand. A record that predates
  // them must not gain a by-line it never had, nor lose the association line
  // it did have — which it briefly did, when the new field took priority and
  // the old fallback was dropped.
  const before = issuerLines(certificateIssuer({ issuer: { name: OLD.name, unit: OLD.unit, operator: OLD.operator } }, NEW));
  assert.equal(before.lead, 'Beyond Guidance · A Unit of Islamic Information Centre');
  assert.equal(before.by, '', 'no by-line existed on those sheets');
  assert.equal(before.association, 'In association with Al-Majeed School of Research Methodology and Innovation');
});

test('a certificate issued now leads with the brand and names who it is run with', () => {
  const now = issuerLines(certificateIssuer({ issuer: NEW }));
  assert.equal(now.lead, 'WORKSHOP');
  assert.equal(now.by, 'by Al-Majeed School of Research Methodology and Innovation');
  assert.equal(now.association, 'In association with Islamic Information Centre · Beyond Guidance');
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
  // Only the three fields that existed then. The two added at the rebrand
  // are absent by design, and issuerStamp fills them with empty strings.
  assert.deepEqual({ ...LEGACY_ISSUER }, {
    name: OLD.name, unit: OLD.unit, operator: OLD.operator,
  });
  assert.deepEqual(issuerStamp(LEGACY_ISSUER), OLD);
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

test('the printed lines are built from the record', () => {
  assert.deepEqual(issuerLines(OLD), {
    lead: 'Beyond Guidance · A Unit of Islamic Information Centre',
    by: '',
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
