/* Stand-in for src/lib/classroomdb.js. See ./publicdb.js for why.
 *
 * Without this the class page renders only up to the door: the moment
 * somebody joins, the notes, transcript, handouts and question queue all
 * open live Firestore listeners, which throw here and take the view with
 * them. The whole point of the harness is to see the screen a student sees
 * AFTER they are in, so these return fabricated records and keep them in
 * memory — writes made in the harness come back from the watchers, so the
 * ask-a-question path can actually be walked.
 */
export * from '../../src/lib/classroomdb.js';

import { handoutRecord } from '../../src/lib/classroom.js';
import { questionRecord, sortQueue } from '../../src/lib/questions.js';

const NOTES = [
  'What a model actually is — a function with learned numbers in it, nothing more.',
  '',
  'Three things to try before the break:',
  '  1. Ask for the same thing twice and read both answers side by side.',
  '  2. Give it a worked example and watch the shape of the answer change.',
  '  3. Ask it for its sources, then check one.',
].join('\n');

const TRANSCRIPT = [
  { at: '10:04', text: 'Good morning. Before anything opens, one question.' },
  { at: '10:05', text: 'Who here has already used one of these to write something?' },
  { at: '10:06', text: 'Right — most of the room. So we are not starting at nothing.' },
];

let handouts = [
  { id: 'h1', ...handoutRecord({ title: 'Day one slides', kind: 'link', url: 'https://example.org/slides' }), addedAt: null },
  { id: 'h2', ...handoutRecord({ title: 'Prompt sheet.pdf', kind: 'file', data: '', bytes: 84213 }), addedAt: null },
];
let questions = [
  { id: 'q1', ...questionRecord({ name: 'Laiba Naaz', text: 'Does it remember what I told it yesterday?' }) },
  { id: 'q2', ...questionRecord({ name: 'Someone', text: 'How do I know when it is making something up?' }), state: 'answered' },
];

/* A watcher is a subscription, so a stub that only fires once is a stub that
   cannot show a write arriving. These keep their callers and call them all. */
const watchers = { handouts: new Set(), questions: new Set() };
const push = (k, v) => { for (const fn of watchers[k]) fn(v); };
const subscribe = (k, fn, value) => {
  watchers[k].add(fn);
  fn(value());
  return () => watchers[k].delete(fn);
};

export async function getNotes() { return NOTES; }
export async function saveNotes() {}
export function watchNotes(workshopId, day, onChange) { onChange(NOTES); return () => {}; }

export async function getTranscript() { return TRANSCRIPT; }
export async function saveTranscript() {}
export function watchTranscript(workshopId, day, onChange) { onChange(TRANSCRIPT); return () => {}; }
export async function clearTranscript() {}

export async function addHandout(workshopId, handout) {
  const id = `h${handouts.length + 1}`;
  handouts = [{ id, ...handoutRecord(handout), addedAt: null }, ...handouts];
  push('handouts', handouts);
  return id;
}
export async function listHandouts() { return handouts; }
export function watchHandouts(workshopId, onChange) {
  return subscribe('handouts', onChange, () => handouts);
}
export async function removeHandout(workshopId, handoutId) {
  handouts = handouts.filter((h) => h.id !== handoutId);
  push('handouts', handouts);
}

export async function askQuestion(workshopId, { name, text }) {
  const id = `q${questions.length + 1}`;
  questions = [...questions, { id, ...questionRecord({ name, text }) }];
  push('questions', sortQueue(questions));
  return id;
}
export function watchQuestions(workshopId, onChange) {
  return subscribe('questions', onChange, () => sortQueue(questions));
}
export async function markAnswered(workshopId, questionId, answered = true) {
  questions = questions.map((q) => (q.id === questionId ? { ...q, state: answered ? 'answered' : 'open' } : q));
  push('questions', sortQueue(questions));
}
export async function removeQuestion(workshopId, questionId) {
  questions = questions.filter((q) => q.id !== questionId);
  push('questions', sortQueue(questions));
}
export async function clearAnswered() {
  questions = questions.filter((q) => q.state !== 'answered');
  push('questions', sortQueue(questions));
}
