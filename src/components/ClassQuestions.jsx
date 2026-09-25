import { useState } from 'react';
import { askQuestion, markAnswered, removeQuestion, clearAnswered } from '../lib/classroomdb.js';
import { checkQuestion, isDuplicate, openCount, QUESTION_MAX } from '../lib/questions.js';

/**
 * The hand nobody can see.
 *
 * A presenter teaching into a video grid cannot read thirty faces. In a room
 * somebody puts a hand up; online the same person types into a chat that
 * scrolls away, or says nothing and leaves not understanding.
 *
 * One component, two audiences, like everything else on the board — the
 * student gets a box and the presenter gets the queue, and neither can be
 * looking at a different list from the other.
 */
export default function ClassQuestions({
  workshopId, questions, host = false, displayName = '', onError, onNotice,
}) {
  return host
    ? <Queue workshopId={workshopId} questions={questions} onError={onError} onNotice={onNotice} />
    : <Ask workshopId={workshopId} questions={questions} displayName={displayName} onError={onError} />;
}

/* ------------------------------------------------------------------ *
 * The student
 * ------------------------------------------------------------------ */

function Ask({ workshopId, questions, displayName, onError }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const problem = text.trim() ? checkQuestion(text) : '';
  const left = QUESTION_MAX - text.trim().length;

  const send = async (e) => {
    e.preventDefault();
    const why = checkQuestion(text);
    if (why) { onError?.(why); return; }
    // A double-tap on a phone, or an impatient second press, must not put the
    // same sentence in the queue twice.
    if (isDuplicate(questions, displayName, text)) {
      onError?.('You have already asked that — it is still in the queue.');
      return;
    }
    setSending(true);
    onError?.('');
    try {
      await askQuestion(workshopId, { name: displayName, text });
      setText('');
      setSent(true);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setSending(false);
    }
  };

  const mine = questions.filter((q) => q.name === displayName);

  return (
    <div className="qa">
      <form onSubmit={send}>
        <label className="field">
          <div className="lab">Ask the presenter</div>
          <textarea
            rows={3}
            value={text}
            maxLength={QUESTION_MAX}
            placeholder="Type your question — it goes straight to the presenter's screen."
            onChange={(e) => { setText(e.target.value); setSent(false); }}
          />
        </label>
        <div className="qa-send">
          <button type="submit" className="primary" disabled={sending || Boolean(problem) || !text.trim()}>
            {sending ? 'Sending…' : 'Ask'}
          </button>
          <span className={`count${left < 40 ? ' tight' : ''}`}>{left} left</span>
          {sent && <span className="count ok">Asked — the presenter can see it.</span>}
        </div>
      </form>

      {/* Everybody sees the queue, so the same question is not asked five
          times, and so somebody waiting can see they have not been forgotten. */}
      {questions.length > 0 && (
        <>
          <div className="qa-head">
            <h3>{openCount(questions)} waiting</h3>
          </div>
          <ul className="qa-list">
            {questions.map((q) => (
              <li key={q.id} className={q.state === 'answered' ? 'is-done' : undefined}>
                <div className="qa-text">{q.text}</div>
                <div className="qa-by">
                  {mine.includes(q) ? 'You' : q.name}
                  {q.state === 'answered' && ' · answered'}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The presenter
 * ------------------------------------------------------------------ */

function Queue({ workshopId, questions, onError, onNotice }) {
  const [busy, setBusy] = useState('');

  const act = async (id, fn, after) => {
    setBusy(id);
    onError?.('');
    try {
      await fn();
      if (after) onNotice?.(after);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy('');
    }
  };

  const waiting = openCount(questions);
  const done = questions.length - waiting;

  if (!questions.length) {
    return (
      <p className="hint">
        Nothing asked yet. Students can type a question from their own screen
        while the class is open, and it lands here.
      </p>
    );
  }

  return (
    <div className="qa">
      <div className="qa-head">
        <h3>{waiting ? `${waiting} waiting` : 'All answered'}</h3>
        <span className="spacer" />
        {done > 0 && (
          <button
            type="button"
            onClick={() => act('clear', () => clearAnswered(workshopId), `${done} cleared.`)}
            disabled={busy === 'clear'}
          >
            Clear {done} answered
          </button>
        )}
      </div>

      <ul className="qa-list host">
        {questions.map((q) => (
          <li key={q.id} className={q.state === 'answered' ? 'is-done' : undefined}>
            <div className="qa-text">{q.text}</div>
            <div className="qa-by">{q.name}</div>
            <div className="qa-acts">
              {/* Answered is a STATE, not a deletion: the class sees that it
                  was dealt with, and the record survives the session. */}
              <button
                type="button"
                className={q.state === 'answered' ? undefined : 'primary'}
                disabled={busy === q.id}
                onClick={() => act(q.id, () => markAnswered(workshopId, q.id, q.state !== 'answered'))}
              >
                {q.state === 'answered' ? 'Reopen' : 'Answered'}
              </button>
              {/* For what should not have been asked, not for what was. */}
              <button
                type="button"
                className="danger"
                disabled={busy === q.id}
                onClick={() => act(q.id, () => removeQuestion(workshopId, q.id))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
