/**
 * Totals shown on the workshop screen and in the payment summary. Money that
 * is reported wrong is worse than money not reported at all, so the awkward
 * cases — a recorded zero, a waived place, a missing fee — are pinned here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { amountCollected, paymentCounts, seatsLeft } from '../src/lib/stats.js';

const WORKSHOP = { feeAmount: 149, seatLimit: 30 };

test('a blank amount falls back to the workshop fee', () => {
  assert.equal(
    amountCollected(WORKSHOP, [
      { paymentStatus: 'Paid', amountPaid: '' },
      { paymentStatus: 'Paid', amountPaid: null },
    ]),
    298
  );
});

test('a recorded zero counts as zero, not as the full fee', () => {
  // Regression: `Number(amountPaid) || fee` read a legitimate 0 as missing
  // and silently added the standard fee, overstating what was collected.
  assert.equal(amountCollected(WORKSHOP, [{ paymentStatus: 'Paid', amountPaid: 0 }]), 0);
  assert.equal(
    amountCollected(WORKSHOP, [
      { paymentStatus: 'Paid', amountPaid: 0 },
      { paymentStatus: 'Paid', amountPaid: 149 },
    ]),
    149
  );
});

test('a part payment is counted as what was paid', () => {
  assert.equal(amountCollected(WORKSHOP, [{ paymentStatus: 'Paid', amountPaid: 100 }]), 100);
});

test('only Paid registrations count towards the total', () => {
  assert.equal(
    amountCollected(WORKSHOP, [
      { paymentStatus: 'Pending' },
      { paymentStatus: 'Waived' },
      { paymentStatus: 'Refunded', amountPaid: 149 },
    ]),
    0
  );
});

test('a free workshop collects nothing', () => {
  assert.equal(amountCollected({}, [{ paymentStatus: 'Paid', amountPaid: '' }]), 0);
});

test('counts cover every status, defaulting a blank one to Pending', () => {
  const counts = paymentCounts([
    { paymentStatus: 'Paid' },
    { paymentStatus: 'Paid' },
    { paymentStatus: 'Waived' },
    { paymentStatus: 'Refunded' },
    { paymentStatus: '' },
    {},
  ]);
  assert.deepEqual(counts, { total: 6, paid: 2, pending: 2, waived: 1, refunded: 1 });
});

test('seats: remaining, exactly full, and over', () => {
  assert.equal(seatsLeft(WORKSHOP, 28), 2);
  assert.equal(seatsLeft(WORKSHOP, 30), 0);
  assert.equal(seatsLeft(WORKSHOP, 33), -3);
});

test('seats: a workshop with no limit reports none', () => {
  assert.equal(seatsLeft({}, 10), null);
  assert.equal(seatsLeft({ seatLimit: '' }, 10), null);
});
