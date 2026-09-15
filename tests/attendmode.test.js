import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ATTEND_MODES, attendMode, attendModeLabel, attendModeCounts,
  attendModeSummary, normalizeAttendMode, workshopAsksMode,
} from '../src/lib/attendmode.js';
import { REGISTRATION_FIELDS, WORKSHOP_FIELDS } from '../src/lib/schema.js';

const hybrid = { mode: 'Hybrid' };
const offline = { mode: 'Offline' };
const online = { mode: 'Online' };

/* ---------------- which courses ask ---------------- */

test('only a hybrid course has anything to ask', () => {
  assert.equal(workshopAsksMode(hybrid), true);
  assert.equal(workshopAsksMode(offline), false);
  assert.equal(workshopAsksMode(online), false);
  assert.equal(workshopAsksMode({}), false);
  assert.equal(workshopAsksMode(null), false);
  // However it was typed or pasted in.
  assert.equal(workshopAsksMode({ mode: '  hybrid ' }), true);
  assert.equal(workshopAsksMode({ mode: 'HYBRID' }), true);
});

test('the two modes a student can be are the two the workshop offers, minus hybrid', () => {
  const courseModes = WORKSHOP_FIELDS.find((f) => f.key === 'mode').options;
  assert.deepEqual(courseModes, ['Offline', 'Online', 'Hybrid']);
  assert.deepEqual(ATTEND_MODES, ['Offline', 'Online']);
  // A student cannot be "Hybrid" — they are in the room or on the link.
  assert.ok(!ATTEND_MODES.includes('Hybrid'));
});

/* ---------------- the course outranks the record ---------------- */

test('on a course that is wholly one way, the course is the answer', () => {
  assert.equal(attendMode(offline, {}), 'Offline');
  assert.equal(attendMode(online, {}), 'Online');
});

test('a stored answer is ignored once the course stops offering the choice', () => {
  // Somebody picked Online while the course was hybrid; it is offline now, so
  // they are in the room. Nothing was erased to make that true.
  const student = { attendMode: 'Online' };
  assert.equal(attendMode(offline, student), 'Offline');
  // And flipping it back restores what they said.
  assert.equal(attendMode(hybrid, student), 'Online');
});

/* ---------------- unset is not a default ---------------- */

test('a hybrid student who has not said reads as unset, not as one of the two', () => {
  // Guessing Offline puts a name on a sheet nobody can sign; guessing Online
  // leaves a chair empty. Neither is better than saying so.
  assert.equal(attendMode(hybrid, {}), '');
  assert.equal(attendMode(hybrid, { attendMode: '' }), '');
  assert.equal(attendMode(hybrid, { attendMode: '   ' }), '');
  assert.equal(attendMode(hybrid, null), '');
});

test('junk stored in the field does not become an answer', () => {
  assert.equal(attendMode(hybrid, { attendMode: 'maybe' }), '');
  assert.equal(attendMode(hybrid, { attendMode: 'Hybrid' }), '');
  assert.equal(normalizeAttendMode('maybe'), '');
  assert.equal(normalizeAttendMode(null), '');
  assert.equal(normalizeAttendMode(undefined), '');
  // But a real answer survives whatever case or spacing it arrives in.
  assert.equal(normalizeAttendMode(' online '), 'Online');
  assert.equal(normalizeAttendMode('OFFLINE'), 'Offline');
});

/* ---------------- counting ---------------- */

test('the split counts the unanswered rather than folding them into either', () => {
  const regs = [
    { attendMode: 'Offline' }, { attendMode: 'Offline' },
    { attendMode: 'Online' }, {}, { attendMode: 'nonsense' },
  ];
  const c = attendModeCounts(hybrid, regs);
  assert.equal(c.Offline, 2);
  assert.equal(c.Online, 1);
  assert.equal(c.unset, 2);
  assert.equal(c.total, 5);
  assert.equal(c.Offline + c.Online + c.unset, c.total);
});

test('on a single-mode course everybody counts, and nobody is unset', () => {
  const c = attendModeCounts(online, [{}, {}, { attendMode: 'Offline' }]);
  assert.equal(c.Online, 3);
  assert.equal(c.Offline, 0);
  assert.equal(c.unset, 0);
});

test('the summary says nothing where there is nothing to say', () => {
  // A course that is wholly one way has already said so in its Mode field;
  // repeating it as a split is the same fact taking more room.
  assert.equal(attendModeSummary(offline, [{}, {}]), '');
  assert.equal(attendModeSummary(hybrid, []), '');
  assert.equal(
    attendModeSummary(hybrid, [{ attendMode: 'Offline' }, { attendMode: 'Online' }, {}]),
    '1 in person · 1 online · 1 not said'
  );
});

test('labels are English, and an unset one is empty rather than a word', () => {
  assert.equal(attendModeLabel('Offline'), 'In person');
  assert.equal(attendModeLabel('Online'), 'Online');
  assert.equal(attendModeLabel(''), '');
  assert.equal(attendModeLabel('nonsense'), '');
});

/* ---------------- the field exists where it has to ---------------- */

test('the registration schema carries the field, so the editor and exports get it', () => {
  const field = REGISTRATION_FIELDS.find((f) => f.key === 'attendMode');
  assert.ok(field, 'attendMode is not a registration field');
  assert.equal(field.type, 'enum');
  assert.deepEqual(field.options, ATTEND_MODES);
  assert.ok(field.inTable, 'it should appear in the table like payment does');
});

/* ---------------- the part a stranger writes ---------------- */

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const publicdb = readFileSync(new URL('../src/lib/publicdb.js', import.meta.url), 'utf8');

test('the rules allow the field through, or every hybrid submission is refused', () => {
  // `hasOnly(requestFields())` means a key the rules have not heard of does
  // not get ignored — it fails the whole write, and the student sees an error
  // with nothing to do about it.
  const list = rules.match(/function requestFields\(\)\s*\{\s*return \[([\s\S]*?)\];/);
  assert.ok(list, 'could not read requestFields() out of the rules');
  assert.match(list[1], /'attendMode'/);
});

test('the rules check the VALUE, because this is the one place a stranger writes', () => {
  // Everything else on a request is merely measured for length. An enum that
  // is only length-checked accepts any 200 characters somebody cares to post.
  assert.match(rules, /d\.get\('attendMode', ''\) in \['', 'Offline', 'Online'\]/);
});

test('empty is allowed, because most courses never ask', () => {
  assert.match(rules, /in \['',/, 'an Offline or Online course sends no value at all');
});

test('the form sends the field, and normalises it before it goes', () => {
  assert.match(publicdb, /'attendMode',/);
  assert.match(publicdb, /data\.attendMode = normalizeAttendMode\(data\.attendMode\)/);
});

/* ---------------- what does not carry forward ---------------- */

test('how somebody attended last term is not carried to the next course', () => {
  // It is a fact about a course's delivery, not about a person — and the next
  // course may not offer a choice at all.
  const carryover = readFileSync(new URL('../src/lib/carryover.js', import.meta.url), 'utf8');
  const carried = carryover.match(/export const CARRIED_FIELDS = \[([\s\S]*?)\];/);
  assert.ok(carried);
  assert.ok(!carried[1].includes('attendMode'), 'attendMode is being carried forward');
  assert.match(carryover, /attendMode\s+how they attended a DIFFERENT course/);
});
