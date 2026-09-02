/**
 * The console's figures.
 *
 * The app could answer "how is THIS workshop doing" on the workshop screen,
 * and nothing else. There was no way to ask "what needs me today" without
 * opening every course in turn — which is exactly the question somebody
 * running four courses at once opens the app to ask.
 *
 * Everything here is pure: given the workshops, their registrations and the
 * waiting requests, it returns what the screen shows. No Firestore, so the
 * arithmetic can be tested without one.
 */

import { amountCollected, paymentCounts, seatPressure } from './stats.js';
import { isFreeWorkshop } from './schema.js';

/** Registrations still owing money. Free courses have none to owe. */
export function unpaidCount(workshop, registrations) {
  if (isFreeWorkshop(workshop)) return 0;
  return registrations.filter((r) => {
    const s = r.paymentStatus || 'Pending';
    return s !== 'Paid' && s !== 'Waived';
  }).length;
}

/**
 * The headline numbers, in the order they are shown — which is the order the
 * palette runs, so each card keeps its colour as the set grows.
 */
export function headlineFigures(bundles, requests = []) {
  const registrations = bundles.flatMap((b) => b.registrations);
  const collected = bundles.reduce(
    (sum, b) => sum + amountCollected(b.workshop, b.registrations), 0,
  );
  const owing = bundles.reduce(
    (sum, b) => sum + unpaidCount(b.workshop, b.registrations), 0,
  );

  return [
    { key: 'workshops', label: 'Workshops', value: bundles.length },
    { key: 'registered', label: 'Registered', value: registrations.length },
    { key: 'collected', label: 'Collected', value: collected, money: true },
    { key: 'waiting', label: 'Requests waiting', value: requests.length },
    { key: 'owing', label: 'Awaiting payment', value: owing },
  ];
}

/**
 * What needs doing, most pressing first.
 *
 * Only workshops with something actually outstanding appear. A course that
 * is full, paid up and has nothing waiting is not news, and listing it would
 * bury the three that are.
 *
 * `weight` orders the list: a request nobody has looked at is more urgent
 * than a fee nobody has chased, and both are more urgent than a course
 * filling up.
 *
 * `tone` is the colour the reason is shown in, and it is deliberately NOT
 * derived from `kind`: a seat warning takes the colour of the bar beside it,
 * so the two never disagree about how full a course is.
 */
export function needsAttention(bundles, requests = []) {
  const waitingBy = new Map();
  for (const r of requests) {
    waitingBy.set(r.workshopId, (waitingBy.get(r.workshopId) || 0) + 1);
  }

  const rows = [];
  for (const { workshop, registrations } of bundles) {
    const reasons = [];

    const waiting = waitingBy.get(workshop.id) || 0;
    if (waiting) {
      reasons.push({
        kind: 'requests', tone: 'blue', weight: 300 + waiting,
        text: `${waiting} registration request${waiting === 1 ? '' : 's'} waiting`,
      });
    }

    const owing = unpaidCount(workshop, registrations);
    if (owing) {
      reasons.push({
        kind: 'unpaid', tone: 'tangerine', weight: 200 + owing,
        text: `${owing} ${owing === 1 ? 'person has' : 'people have'} not paid`,
      });
    }

    const seats = seatPressure(workshop, registrations.length);
    if (seats && seats.level === 'over') {
      reasons.push({
        kind: 'over', tone: 'red', weight: 250,
        text: `${-seats.left} over the seat limit of ${seats.limit}`,
      });
    } else if (seats && (seats.level === 'full' || seats.level === 'nearly')) {
      // The chip takes the colour of the bar beside it. A green "nearly
      // full" next to an amber bar is two answers to the same question.
      reasons.push({
        kind: 'seats', tone: seats.level === 'full' ? 'blue' : 'tangerine', weight: 100,
        text: seats.left === 0
          ? `Full — ${seats.limit} of ${seats.limit} seats taken`
          : `Nearly full — ${seats.left} seat${seats.left === 1 ? '' : 's'} left`,
      });
    }

    if (reasons.length) {
      reasons.sort((a, b) => b.weight - a.weight);
      rows.push({
        workshop,
        registrations: registrations.length,
        seats,
        reasons,
        weight: reasons[0].weight,
      });
    }
  }

  rows.sort((a, b) => b.weight - a.weight
    || String(a.workshop.title || '').localeCompare(String(b.workshop.title || '')));
  return rows;
}

/**
 * Courses by date, soonest first, ignoring those already finished.
 *
 * `today` is passed in rather than read from the clock, so the ordering can
 * be tested and does not change under the test suite at midnight.
 */
export function upcoming(bundles, today = new Date().toISOString().slice(0, 10), limit = 5) {
  return bundles
    .filter((b) => {
      const end = b.workshop.endDate || b.workshop.startDate;
      return end && end >= today;
    })
    .sort((a, b) => String(a.workshop.startDate || a.workshop.endDate || '')
      .localeCompare(String(b.workshop.startDate || b.workshop.endDate || '')))
    .slice(0, limit)
    .map((b) => ({
      workshop: b.workshop,
      registrations: b.registrations.length,
      seats: seatPressure(b.workshop, b.registrations.length),
      payments: paymentCounts(b.registrations),
    }));
}
