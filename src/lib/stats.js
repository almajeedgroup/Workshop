/**
 * Registration totals, shared by the workshop screen and the exports so both
 * report the same numbers.
 */

/**
 * What was actually taken.
 *
 * A registration that records an explicit zero — a concession, a correction —
 * counts as zero. Only a blank amount falls back to the workshop's fee, on the
 * assumption that whoever marked it Paid took the standard amount. Treating a
 * recorded zero as "missing" quietly overstated the money collected.
 */
export function amountCollected(workshop, registrations) {
  const fee = Number(workshop?.feeAmount) || 0;
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
