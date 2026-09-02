/**
 * Registration totals, shared by the workshop screen and the exports so both
 * report the same numbers.
 */

import { workshopFee } from './schema.js';

/**
 * What was actually taken.
 *
 * A registration that records an explicit zero — a concession, a correction —
 * counts as zero. Only a blank amount falls back to the workshop's fee, on the
 * assumption that whoever marked it Paid took the standard amount. Treating a
 * recorded zero as "missing" quietly overstated the money collected.
 */
export function amountCollected(workshop, registrations) {
  const fee = workshopFee(workshop);
  return registrations
    .filter((r) => r.paymentStatus === 'Paid')
    .reduce((sum, r) => {
      const blank = r.amountPaid === '' || r.amountPaid === null || r.amountPaid === undefined;
      return sum + (blank ? fee : Number(r.amountPaid) || 0);
    }, 0);
}

export function paymentCounts(registrations) {
  const count = (status) => registrations.filter((r) => (r.paymentStatus || 'Pending') === status).length;
  return {
    total: registrations.length,
    paid: count('Paid'),
    pending: count('Pending'),
    waived: count('Waived'),
    refunded: count('Refunded'),
  };
}

/**
 * Seats left, or null when the workshop has no limit. Negative means the
 * limit has been passed.
 */
export function seatsLeft(workshop, registrationCount) {
  if (!workshop?.seatLimit) return null;
  return Number(workshop.seatLimit) - registrationCount;
}

/**
 * How full a workshop is, for showing as a bar rather than a number.
 *
 * The app already knew when a limit had been PASSED, and said so — after the
 * fact. What it never showed was a course filling up, which is the only point
 * at which anybody can do something about it.
 *
 * `level` is what the bar is coloured by:
 *   open    under three quarters
 *   nearly  three quarters or more, still under the limit
 *   full    exactly at the limit
 *   over    past it
 */
export function seatPressure(workshop, registrationCount) {
  const limit = Number(workshop?.seatLimit) || 0;
  const taken = Math.max(0, Number(registrationCount) || 0);
  if (!limit) return null;

  const left = limit - taken;
  const ratio = taken / limit;
  let level = 'open';
  if (left < 0) level = 'over';
  else if (left === 0) level = 'full';
  else if (ratio >= 0.75) level = 'nearly';

  return {
    limit,
    taken,
    left,
    ratio,
    // The bar never draws past its own track, however far over the limit a
    // course has gone — a 200%-wide bar tells you nothing the label does not.
    filled: Math.min(1, ratio),
    level,
  };
}
