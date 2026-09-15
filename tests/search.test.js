import test from 'node:test';
import assert from 'node:assert/strict';
import {
  norm, buildIndex, personEntries, requestEntries, workshopEntries,
  score, search, workshopFacts, requestFacts, MIN_QUERY,
} from '../src/lib/search.js';

const BUNDLES = [
  {
    workshop: {
      id: 'w1', title: 'Hands-on Workshop on Artificial Intelligence', code: 'AIHOW26',
      venue: 'Kabir IND PU College', mode: 'Offline', seatLimit: 40, feeType: 'Paid',
      feeAmount: 149, presentedBy: 'Beyond Guidance', startDate: '2026-09-03',
      contactNumbers: ['+91 98452 89298'],
    },
    registrations: [
      { id: 'r1', name: 'Adifaah Shaikh', ticketId: 'AIHOW26-001', whatsapp: '+91 9339214522',
        area: 'Marathahalli', courseName: 'BBA in Aviation', paymentStatus: 'Paid' },
      { id: 'r2', name: 'Sabnam Khatun', ticketId: 'AIHOW26-002', whatsapp: '+91 9339214523',
        area: 'Bangalore', paymentStatus: 'Pending' },
    ],
  },
  {
    workshop: { id: 'w2', title: 'Introduction to Robotics', code: 'ROBO26', mode: 'Online', feeType: 'Free' },
    registrations: [
      { id: 'r3', name: 'Mohammed Khan', ticketId: 'ROBO26-001', whatsapp: '+91 9000000001' },
    ],
  },
];

const REQUESTS = [
  { id: 'q1', workshopId: 'w1', name: 'Walk In', ref: 'REQ-7K3M9Q',
    whatsapp: '+91 9876543210', status: 'new', area: 'Whitefield' },
];

const INDEX = buildIndex(BUNDLES, REQUESTS);
const find = (q) => search(INDEX, q);
const labels = (q) => find(q).rows.map((r) => `${r.kind}:${r.label}`);

/* ---------------- building the list ---------------- */

test('everything on screen becomes searchable, once each', () => {
  assert.equal(personEntries(BUNDLES).length, 3);
  assert.equal(requestEntries(REQUESTS, BUNDLES).length, 1);
  assert.equal(workshopEntries(BUNDLES).length, 2);
  assert.equal(INDEX.length, 6);
});

test('a person carries their course, so the result says which one', () => {
  const adifaah = personEntries(BUNDLES)[0];
  assert.match(adifaah.subtitle, /AIHOW26-001/);
  assert.match(adifaah.subtitle, /Artificial Intelligence/);
});

test('a request whose workshop is not on screen still lists', () => {
  const [row] = requestEntries([{ id: 'q9', workshopId: 'gone', name: 'Orphan', ref: 'REQ-X' }], BUNDLES);
  assert.match(row.subtitle, /unknown workshop/);
});

test('nothing in, nothing out', () => {
  assert.deepEqual(buildIndex(), []);
  assert.deepEqual(buildIndex([], []), []);
});

/* ---------------- what people actually type ---------------- */

test('a ticket ID read off a ticket is the first result', () => {
  assert.deepEqual(labels('AIHOW26-002'), ['person:Sabnam Khatun']);
});

test('a name finds the person', () => {
  assert.deepEqual(labels('adifaah'), ['person:Adifaah Shaikh']);
});

test('a second name finds them too — half the office searches that way', () => {
  assert.deepEqual(labels('khatun'), ['person:Sabnam Khatun']);
});

test('a phone number matches however either side punctuated it', () => {
  for (const typed of ['9339214522', '+91 9339214522', '+919339214522', '09339214522']) {
    assert.deepEqual(labels(typed), ['person:Adifaah Shaikh'], typed);
  }
});

test('an area, a course, a payment status — any field, not just the name', () => {
  assert.deepEqual(labels('marathahalli'), ['person:Adifaah Shaikh']);
  assert.deepEqual(labels('aviation'), ['person:Adifaah Shaikh']);
  assert.ok(labels('whitefield').includes('request:Walk In'));
});

test('two facts and no name at all still finds somebody', () => {
  assert.deepEqual(labels('marathahalli bba'), ['person:Adifaah Shaikh']);
});

test('a request is found by its reference', () => {
  assert.deepEqual(labels('req-7k3m9q'), ['request:Walk In']);
});

test('a course is found by title, code or venue', () => {
  assert.ok(labels('robotics').includes('workshop:Introduction to Robotics'));
  assert.ok(labels('robo26').some((l) => l.startsWith('workshop:')));
  assert.ok(labels('kabir').some((l) => l.includes('Artificial Intelligence')));
});

test('accents and capitals do not matter on either side', () => {
  const idx = buildIndex([{ workshop: { id: 'w', title: 'T' }, registrations: [{ id: 'r', name: 'Ádifaah Shaikh' }] }]);
  for (const q of ['adifaah', 'ÁDIFAAH', 'Ádifaah shaikh']) {
    assert.equal(search(idx, q).total, 1, q);
  }
});

/* ---------------- the order results come back in ---------------- */

test('certainty ranks above coincidence', () => {
  const person = personEntries(BUNDLES)[0];
  const exactTicket = score(person, 'aihow26-001');
  const exactName = score(person, 'adifaah shaikh');
  const insideName = score(person, 'shaikh');
  const somewhere = score(person, 'marathahalli');
  assert.ok(exactTicket > exactName, 'a full ticket ID is somebody reading off a ticket');
  assert.ok(exactName > insideName);
  assert.ok(insideName > somewhere);
});

test('a course code typed in full opens with the course, then its people', () => {
  // "aihow26" is the course's code EXACTLY, and the prefix of every ticket
  // on it. The exact match leads; the tickets follow underneath.
  const rows = find('aihow26').rows;
  assert.equal(rows[0].kind, 'workshop');
  assert.ok(rows.slice(1).every((r) => r.kind === 'person'));
});

test('but a full ticket ID goes straight to the person, not the course', () => {
  assert.deepEqual(labels('aihow26-001'), ['person:Adifaah Shaikh']);
});

test('people lead when the match is equally good for both', () => {
  // Nothing here is an exact anything — it is a word inside two names.
  const idx = buildIndex([{
    workshop: { id: 'w', title: 'Robotics for Beginners' },
    registrations: [{ id: 'r', name: 'Robotics Fan', ticketId: 'T-1' }],
  }]);
  assert.equal(search(idx, 'robotics').rows[0].kind, 'person');
});

test('a match on nothing is not a match', () => {
  assert.equal(find('zzzznothere').total, 0);
  assert.deepEqual(find('zzzznothere').rows, []);
});

test('one letter is not a search', () => {
  // It would match half the register and rank none of it.
  assert.equal(find('a').short, true);
  assert.deepEqual(find('a').rows, []);
  assert.equal(find('').short, true);
  assert.equal('ad'.length, MIN_QUERY);
});

test('a short number is not treated as a phone', () => {
  // 149 is the fee, and 2026 is a year. Neither is somebody's number.
  const person = personEntries(BUNDLES)[0];
  assert.ok(score(person, '149') < 80);
});

/* ---------------- reporting how much was found ---------------- */

test('the total is reported, not quietly trimmed', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    id: `r${i}`, name: `Person Number ${i}`, ticketId: `T-${i}`,
  }));
  const idx = buildIndex([{ workshop: { id: 'w', title: 'Course' }, registrations: many }]);
  const res = search(idx, 'person number', 12);
  assert.equal(res.rows.length, 12);
  assert.equal(res.total, 30, 'showing 12 of 30 as if it were all of them is a lie');
});

/* ---------------- what the overlay shows ---------------- */

test('a course reads without opening it', () => {
  const facts = Object.fromEntries(workshopFacts(BUNDLES[0]));
  assert.equal(facts.Registered, '2');
  assert.equal(facts.Seats, '38 left of 40');
  assert.equal(facts.Paid, '1 of 2');
  assert.equal(facts.Venue, 'Kabir IND PU College');
});

test('an over-full course says so rather than showing a negative', () => {
  const facts = Object.fromEntries(workshopFacts({
    workshop: { seatLimit: 2, feeType: 'Free' },
    registrations: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  }));
  assert.equal(facts.Seats, '1 over 2');
});

test('a free course shows no fee and no payment tally', () => {
  const facts = Object.fromEntries(workshopFacts(BUNDLES[1]));
  assert.equal(facts.Fee, 'Free');
  assert.ok(!('Paid' in facts));
});

test('a request shows only the fields somebody filled in', () => {
  const facts = requestFacts(REQUESTS[0]);
  const keys = facts.map(([k]) => k);
  assert.ok(keys.includes('Reference') && keys.includes('WhatsApp'));
  assert.ok(!keys.includes('Email'), 'an empty field is not a fact');
  assert.deepEqual(facts.find(([k]) => k === 'Status'), ['Status', 'Waiting']);
});

test('norm is the same normalisation on both sides of a comparison', () => {
  assert.equal(norm('  Ádifaah   SHAIKH '), 'adifaah shaikh');
  assert.equal(norm(null), '');
});
