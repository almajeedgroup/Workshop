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

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */

/**
 * One group per workshop: the people under it, and the figures that let the
 * group be judged without opening it.
 *
 * The header has to carry enough that a collapsed group is still worth
 * looking at — a count, how full, how much is paid, and why it needs
 * attention. Otherwise a collapsed board is a list of titles, and an
 * expanded one is four hundred rows.
 *
 * `tone` is the colour of the group's rail. It comes from the same reasons
 * the console shows, so a workshop that is red there is red here.
 */
/**
 * Has the course finished?
 *
 * Its LAST day, not its first — a three-day course is still running on day
 * two — and the last day itself counts, so a course does not read as
 * completed while people are still in the room.
 *
 * A course with no dates recorded is never called finished: nothing is known
 * about when it ran, and guessing would put a Completed badge on something
 * that may not have started.
 */
export function isFinished(workshop, today = new Date().toISOString().slice(0, 10)) {
  const end = workshop?.endDate || workshop?.startDate || '';
  return Boolean(end) && end < today;
}

export function boardGroups(bundles, requests = [], today = new Date().toISOString().slice(0, 10)) {
  const attentionBy = new Map(
    needsAttention(bundles, requests).map((row) => [row.workshop.id, row]),
  );

  return bundles.map(({ workshop, registrations }) => {
    const attention = attentionBy.get(workshop.id);
    const finished = isFinished(workshop, today);

    return {
      workshop,
      rows: registrations,
      reasons: attention ? attention.reasons : [],
      // A settled course is grey, not blue. Blue is already "a request is
      // waiting" — giving a finished, paid-up course the same rail makes the
      // two indistinguishable at exactly the glance the board is for.
      tone: attention ? attention.reasons[0].tone : (finished ? 'quiet' : 'jade'),
      finished,
      seats: seatPressure(workshop, registrations.length),
      payments: paymentCounts(registrations),
      collected: amountCollected(workshop, registrations),
      free: isFreeWorkshop(workshop),
      owing: unpaidCount(workshop, registrations),
    };
  });
}

/**
 * The summary strip under a group, as label/value pairs.
 *
 * Money is left out entirely on a free course rather than shown as zero —
 * a zero invites the question of what went wrong with the takings.
 */
export function groupSummary(group) {
  const out = [
    ['Registered', String(group.rows.length)],
  ];
  if (group.seats) {
    out.push(['Seats', group.seats.left < 0
      ? `${-group.seats.left} over ${group.seats.limit}`
      : `${group.seats.left} left of ${group.seats.limit}`]);
  }
  if (group.free) {
    out.push(['Fee', 'Free']);
  } else {
    out.push(['Paid', `${group.payments.paid} of ${group.payments.total}`]);
    out.push(['Collected', String(group.collected)]);
    if (group.owing) out.push(['Owing', String(group.owing)]);
  }
  return out;
}

/**
 * Whether the board still needs its data.
 *
 * A function rather than a condition written inline, because the inline one
 * was wrong in a way that reads as correct: it guarded on the fetched array
 * itself, and an empty array is TRUTHY. The board fetched on mount — before
 * the workshops had arrived, so with nothing to fetch for — stored `[]`, and
 * then skipped every later attempt because `[]` looked like "already have
 * it". The board rendered permanently empty.
 *
 *   `ready`  the workshops have loaded, so there is something to fetch for
 *   `loaded` this fetch has actually completed — tracked on its own, never
 *            inferred from whether the result happens to be empty
 */
export function shouldFetchBoard({ view, ready, loaded }) {
  return view === 'board' && Boolean(ready) && !loaded;
}
