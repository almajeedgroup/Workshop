/**
 * The question queue.
 *
 * A presenter teaching into a video grid cannot see thirty faces. In a room
 * somebody puts a hand up and you deal with it; online the same person types
 * into a chat that scrolls away, or says nothing at all and leaves not
 * understanding. This is the hand.
 *
 * ── WHY THIS AND NOT THE MEETING'S OWN CHAT ──────────────────────────────
 *
 * Jitsi has a chat and a raise-hand. Both live inside the call and die with
 * it: close the room and every question asked in it is gone, along with any
 * that never got answered. A question asked here is attached to the course
 * and the day, sits beside the notes and the transcript, and is still there
 * afterwards — which is the whole reason the class record exists.
 *
 * It also works for a student who has the join page open but cannot get into
 * the room, which is exactly the person most likely to have a question.
 *
 * ── WHAT A STRANGER CAN DO WITH IT, SAID PLAINLY ─────────────────────────
 *
 * Anyone holding the join link can post, the same as anyone holding the
 * registration link can apply. The rules cap the length, the class has to be
 * open, and the presenter can remove anything. There is no server here to
 * rate-limit with, so the honest protection is that the link is unguessable
 * and the room can be closed.
 *
 * Nothing here touches a database. It decides what a question IS, and what
 * order a queue goes in, both of which are worth testing without one.
 */

/** Long enough for a real question, short enough not to be an essay. */
export const QUESTION_MAX = 300;

/** What a question can be. Answered is a state, not a deletion. */
export const QUESTION_STATES = ['open', 'answered'];

/**
 * Is this something worth putting in front of a class?
 *
 * Returns the reason it is not, or '' when it is fine — the same shape the
 * handout checks use, so the screens report them the same way.
 */
export function checkQuestion(text) {
  const body = String(text ?? '').trim();
  if (!body) return 'Type your question first.';
  if (body.length < 3) return 'That is too short to be a question.';
  if (body.length > QUESTION_MAX) {
    return `Questions are limited to ${QUESTION_MAX} characters — this one is ${body.length}.`;
  }
  return '';
}

/**
 * One question, as it is stored.
 *
 * The asker's name is kept because a presenter answering out loud needs to
 * say whose question it is. NOTHING ELSE about them is: no number, no ticket,
 * no email. The queue is readable by the whole class while the class is open,
 * and a class is not a contact list.
 */
export function questionRecord({ name, text, at = new Date() }) {
  return {
    name: String(name ?? '').trim().slice(0, 80) || 'Someone',
    text: String(text ?? '').trim().slice(0, QUESTION_MAX),
    state: 'open',
    hp: '',
    askedAt: at instanceof Date ? at.toISOString() : String(at),
  };
}

/**
 * The queue, in the order it should be worked through.
 *
 * Open questions first, oldest first — a queue that reorders itself under the
 * presenter's cursor is how the wrong question gets answered. Answered ones
 * fall to the bottom, newest first, because the only reason to look at them
 * is to check what was just dealt with.
 */
export function sortQueue(questions = []) {
  const at = (q) => String(q?.askedAt || '');
  const open = questions.filter((q) => q?.state !== 'answered')
    .sort((a, b) => at(a).localeCompare(at(b)));
  const done = questions.filter((q) => q?.state === 'answered')
    .sort((a, b) => at(b).localeCompare(at(a)));
  return [...open, ...done];
}

/** How many are still waiting — the number that goes on the tab. */
export function openCount(questions = []) {
  return questions.filter((q) => q?.state !== 'answered').length;
}

/**
 * Has this person just asked this?
 *
 * A double-tap on a phone, or an impatient second press, should not put the
 * same sentence in the queue twice. Compared on the text alone and only
 * against what is still open: asking again later, after it was answered
 * badly, is a legitimate thing to do.
 */
export function isDuplicate(questions = [], name, text) {
  const flat = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const who = flat(name);
  const what = flat(text);
  if (!what) return false;
  return questions.some((q) => q?.state !== 'answered' && flat(q.name) === who && flat(q.text) === what);
}
