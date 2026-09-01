/**
 * Al-Majeed School is named on everything this system produces. These pin
 * the one place that decides how, because the alternative — every document
 * doing it itself — is how three different spellings got into the code.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { associationLine, ISSUER } from '../src/lib/schema.js';
import { ticketMessage } from '../src/lib/tickets.js';
import { cardFace } from '../src/lib/idcards.js';
import { SIGNATORIES, CRESTS } from '../src/lib/certificates.js';

const HOUSE = ISSUER.operator;

test('the school is credited when nobody filled in a collaborator', () => {
  assert.equal(associationLine({}), HOUSE);
  assert.equal(associationLine({ collaborators: '' }), HOUSE);
  assert.equal(associationLine({ collaborators: '   ' }), HOUSE);
  assert.equal(associationLine(null), HOUSE);
});

test('a partner named for the course leads, the school follows', () => {
  assert.equal(
    associationLine({ collaborators: 'Kabir IND PU College for Women' }),
    `Kabir IND PU College for Women · ${HOUSE}`,
  );
});

test('the school is not repeated when it was typed in already', () => {
  assert.equal(associationLine({ collaborators: HOUSE }), HOUSE);
});

test('a different spelling of the school still counts as the school', () => {
  // The three that were actually in this codebase, plus what a poster says.
  for (const variant of [
    'Al-Majeed School of Research, Methodology & Innovation',
    'Al-Majeed School of Research, Methodology and Innovation',
    'Al-Majeed School of Research Methodology & Innovation',
    'al majeed school of research methodology and innovation',
    'AL-MAJEED SCHOOL OF RESEARCH METHODOLOGY AND INNOVATION',
  ]) {
    assert.equal(
      associationLine({ collaborators: variant }), variant,
      `"${variant}" should be recognised as the school and not doubled`,
    );
  }
});

test('the school is not doubled when it is one of several collaborators', () => {
  const both = 'Kabir Independent PU College for Women and Al-Majeed School of Research Methodology & Innovation';
  assert.equal(associationLine({ collaborators: both }), both);
});

test('a partner whose name merely resembles it is still joined', () => {
  const other = 'Al-Majeed Trust';
  assert.equal(associationLine({ collaborators: other }), `${other} · ${HOUSE}`);
});

/* ---- and it actually reaches the documents ----------------------- */

test('the ticket message credits the school even with no collaborators', () => {
  const msg = ticketMessage({ title: 'W' }, { name: 'A', ticketId: 'T-1' });
  assert.ok(msg.includes(`*In association with:* ${HOUSE}`), msg);
});

test('the ID card back credits the school', () => {
  const back = cardFace({ title: 'W' }, {}).backRows;
  const row = back.find(([k]) => k === 'In association with');
  assert.ok(row, 'the card should carry an association row');
  assert.equal(row[1], HOUSE);
});

/* ---- one spelling everywhere ------------------------------------- */

test('the certificate takes the school name from the same place', () => {
  assert.ok(SIGNATORIES.some((sig) => sig.org === HOUSE));
  assert.ok(CRESTS.some((c) => c.alt === HOUSE));
});

test('the canonical name is the one without a stray comma', () => {
  assert.ok(!/Research,/.test(HOUSE), HOUSE);
  assert.ok(!/&/.test(HOUSE), HOUSE);
  assert.match(HOUSE, /^Al-Majeed School of Research Methodology and Innovation$/);
});
