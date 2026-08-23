/**
 * Certificate identity and wording.
 *
 * A certificate ID is what somebody types into the verification page years
 * later, so the rules that matter are: it is unique, it says which award it
 * belongs to, and two awards can never collide on one number.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CERTIFICATE_TYPES, certificateTypeByKey, fillTemplate,
  certificateTypeCode, formatCertificateId, parseCertificateId,
  highestCertificateSeq, compareCertificateIds, certificateContent,
} from '../src/lib/certificates.js';

test('all four awards are defined, each with its own wording', () => {
  assert.deepEqual(
    CERTIFICATE_TYPES.map((t) => t.key),
    ['completion', 'participation', 'excellence', 'appreciation']
  );
  const titles = new Set(CERTIFICATE_TYPES.map((t) => t.title));
  assert.equal(titles.size, 4, 'each award needs its own heading');
  for (const t of CERTIFICATE_TYPES) {
    assert.ok(t.paragraphs.length >= 1, `${t.key} has body text`);
    assert.ok(t.cheer, `${t.key} has a closing line`);
  }
});

test('every award produces a distinct ID code', () => {
  const codes = CERTIFICATE_TYPES.map((t) => certificateTypeCode(t.key));
  assert.deepEqual(codes, ['COM', 'PAR', 'EXC', 'APP']);
  assert.equal(new Set(codes).size, 4, 'codes must not collide');
});

test('IDs read prefix-award-number', () => {
  assert.equal(formatCertificateId('AIHOW26', 'completion', 1), 'AIHOW26-COM-001');
  assert.equal(formatCertificateId('IIC', 'excellence', 42), 'IIC-EXC-042');
  assert.equal(formatCertificateId('iic-ai26', 'participation', 7), 'IIC-AI26-PAR-007');
});

test('an ID reads back into its parts, even with a dash in the prefix', () => {
  assert.deepEqual(parseCertificateId('IIC-AI26-PAR-007'), { prefix: 'IIC-AI26', typeCode: 'PAR', seq: 7 });
  assert.equal(parseCertificateId('nonsense'), null);
  assert.equal(parseCertificateId(''), null);
});

test('completion and excellence number independently', () => {
  // The same workshop awarding both must not reuse a number across them.
  const issued = ['AIHOW26-COM-001', 'AIHOW26-COM-002', 'AIHOW26-EXC-001'];
  assert.equal(highestCertificateSeq('AIHOW26', 'completion', issued), 2);
  assert.equal(highestCertificateSeq('AIHOW26', 'excellence', issued), 1);
  assert.equal(highestCertificateSeq('AIHOW26', 'appreciation', issued), 0);
});

test('another workshop cannot drag this one\'s counter up', () => {
  assert.equal(highestCertificateSeq('AIHOW26', 'completion', ['RMI26-COM-090']), 0);
});

test('the register sorts by award, then by number past 999', () => {
  const ids = ['A-COM-1000', 'A-EXC-001', 'A-COM-999', 'A-COM-002'];
  assert.deepEqual(
    [...ids].sort(compareCertificateIds),
    ['A-COM-002', 'A-COM-999', 'A-COM-1000', 'A-EXC-001']
  );
});

test('placeholders are filled, and unknown ones leave no trace', () => {
  assert.equal(fillTemplate('for the {workshop} held {dates}', { workshop: 'AI Workshop', dates: 'in August' }),
    'for the AI Workshop held in August');
  assert.equal(fillTemplate('hello {nobody}', {}), 'hello ');
});

test('the wording resolves against a real record', () => {
  const content = certificateContent({
    type: 'completion',
    recipientName: 'Ayesha Siddiqua',
    workshopTitle: 'AI Workshop',
    workshopDates: '15 Aug 2026 – 22 Aug 2026',
  });
  assert.equal(content.title, 'Certificate of Completion');
  assert.match(content.paragraphs[0], /AI Workshop/);
  assert.match(content.paragraphs[0], /15 Aug 2026/);
  assert.doesNotMatch(content.paragraphs.join(' '), /\{/, 'no placeholder left unfilled');
});

test('an unknown award falls back rather than rendering blank', () => {
  const content = certificateContent({ type: 'not-a-real-type', recipientName: 'X', workshopTitle: 'Y' });
  assert.equal(content.title, certificateTypeByKey.completion.title);
});
