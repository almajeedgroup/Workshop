import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUESTION_MAX, checkQuestion, questionRecord, sortQueue, openCount, isDuplicate,
} from '../src/lib/questions.js';

const at = (iso) => iso;

/* ---------------- what counts as a question ---------------- */

test('a question has to be one', () => {
  assert.match(checkQuestion(''), /Type your question/);
  assert.match(checkQuestion('   '), /Type your question/);
  assert.match(checkQuestion('?'), /too short/);
  assert.equal(checkQuestion('How does the lobby work?'), '');
  assert.match(checkQuestion('x'.repeat(QUESTION_MAX + 1)), /limited to 300/);
  // Exactly at the limit is fine — an off-by-one here rejects a question
  // somebody has just spent a minute typing.
  assert.equal(checkQuestion('x'.repeat(QUESTION_MAX)), '');
});

test('the length is measured on the trimmed text, the same as it is stored', () => {
  const padded = `   ${'x'.repeat(QUESTION_MAX)}   `;
  assert.equal(checkQuestion(padded), '');
  assert.equal(questionRecord({ name: 'A', text: padded }).text.length, QUESTION_MAX);
});

/* ---------------- what is stored ---------------- */

test('a question carries a name and nothing else about the person', () => {
  // The queue is readable by the whole class while the class is open, and a
  // class is not a contact list.
  const q = questionRecord({ name: 'Fathima Zohra', text: 'Can you repeat that?' });
  assert.deepEqual(Object.keys(q).sort(), ['askedAt', 'hp', 'name', 'state', 'text']);
  assert.equal(q.state, 'open');
  assert.equal(q.hp, '');
});

test('an unnamed asker is still somebody', () => {
  assert.equal(questionRecord({ name: '', text: 'hello?' }).name, 'Someone');
  assert.equal(questionRecord({ name: '   ', text: 'hello?' }).name, 'Someone');
});

test('a long name is cut rather than refused', () => {
  const q = questionRecord({ name: 'z'.repeat(400), text: 'hi there' });
  assert.equal(q.name.length, 80);
});

/* ---------------- the order the queue is worked in ---------------- */

test('open questions come first, oldest first', () => {
  // A queue that reorders itself under the presenter's cursor is how the
  // wrong question gets answered.
  const queue = [
    { id: 'c', state: 'open', askedAt: at('2026-04-06T10:05:00.000Z') },
    { id: 'a', state: 'open', askedAt: at('2026-04-06T10:01:00.000Z') },
    { id: 'b', state: 'open', askedAt: at('2026-04-06T10:03:00.000Z') },
  ];
  assert.deepEqual(sortQueue(queue).map((q) => q.id), ['a', 'b', 'c']);
});

test('answered ones fall to the bottom, newest first', () => {
  const queue = [
    { id: 'done-old', state: 'answered', askedAt: at('2026-04-06T09:00:00.000Z') },
    { id: 'open', state: 'open', askedAt: at('2026-04-06T10:00:00.000Z') },
    { id: 'done-new', state: 'answered', askedAt: at('2026-04-06T09:30:00.000Z') },
  ];
  // The only reason to look at an answered one is to check what was just
  // dealt with, so the most recent is the useful one.
  assert.deepEqual(sortQueue(queue).map((q) => q.id), ['open', 'done-new', 'done-old']);
});

test('a question with no state is waiting, not answered', () => {
  // A record written before `state` existed, or one that lost the field, must
  // never silently drop out of the queue.
  const queue = [{ id: 'x' }, { id: 'y', state: 'answered' }];
  assert.deepEqual(sortQueue(queue).map((q) => q.id), ['x', 'y']);
  assert.equal(openCount(queue), 1);
});

test('sorting an empty or absent queue is not an error', () => {
  assert.deepEqual(sortQueue(), []);
  assert.deepEqual(sortQueue([]), []);
  assert.equal(openCount(), 0);
});

/* ---------------- the double tap ---------------- */

test('the same person asking the same thing twice is caught', () => {
  const queue = [{ name: 'Zoha', text: 'Can you repeat that?', state: 'open' }];
  assert.equal(isDuplicate(queue, 'Zoha', 'Can you repeat that?'), true);
  // Case and spacing are not a different question.
  assert.equal(isDuplicate(queue, 'zoha', '  can you REPEAT that?  '), true);
  // Somebody else asking the same thing is not a duplicate.
  assert.equal(isDuplicate(queue, 'Laiba', 'Can you repeat that?'), false);
  // A different question from the same person is not either.
  assert.equal(isDuplicate(queue, 'Zoha', 'And the slides?'), false);
});

test('asking again after it was answered badly is allowed', () => {
  const queue = [{ name: 'Zoha', text: 'Can you repeat that?', state: 'answered' }];
  assert.equal(isDuplicate(queue, 'Zoha', 'Can you repeat that?'), false);
});

/* ---------------- the part a stranger writes ---------------- */

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const block = rules.slice(rules.indexOf('match /classQuestions/'),
  rules.indexOf('match /classHandouts/'));

test('a question can only be posted while the class is OPEN', () => {
  // The same switch that publishes the room. Closing a class takes the queue
  // with it, and a course that never met online can never be posted to.
  assert.match(block, /allow create: if classIsOpen\(workshopId\)/);
});

test('only the presenter may say something has been answered', () => {
  // Without this a student could mark their own awkward question answered,
  // or clear the whole queue.
  assert.match(block, /allow update: if isAdmin\(\)/);
  assert.match(block, /allow delete: if isAdmin\(\)/);
  assert.match(block, /request\.resource\.data\.state == 'open'/);
});

test('the shape is frozen and the text is capped', () => {
  assert.match(block, /hasOnly\(\['name', 'text', 'state', 'hp', 'askedAt', 'at'\]\)/);
  assert.match(block, /sized\(request\.resource\.data\.text, 300\)/);
  assert.match(block, /request\.resource\.data\.text\.size\(\) > 0/);
  assert.match(block, /sized\(request\.resource\.data\.name, 80\)/);
  // The cap in the rules and the cap in the code have to be the same number.
  assert.equal(QUESTION_MAX, 300);
});

test('the queue is readable by the class, and only while the class is open', () => {
  assert.match(block, /allow read: if isAdmin\(\) \|\| classIsOpen\(workshopId\)/);
});

test('the honeypot is enforced, not just sent', () => {
  assert.match(block, /request\.resource\.data\.hp == ''/);
});
