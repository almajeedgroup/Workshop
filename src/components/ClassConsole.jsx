import { useEffect, useState } from 'react';
import { elapsed } from '../lib/classroom.js';

/**
 * The bar across the top of a live class.
 *
 * A presenter running a class is not reading the screen — they are talking.
 * So the four things they might need mid-sentence are on one line, in one
 * place, and none of them needs a click to read:
 *
 *   whether it is live, how long it has been, who is in, who is waiting.
 *
 * ── THE CLOCK ────────────────────────────────────────────────────────────
 *
 * Ticks once a second and only while the class is open. An interval left
 * running on a closed class is a re-render a second for nothing, all day.
 *
 * It counts from when the class was OPENED, not from the first person
 * joining: the presenter opens the room and then waits, and "we have been
 * going 40 minutes" is what decides whether to break, not "somebody has been
 * here 40 minutes".
 *
 * A class opened before this field existed has no `classOpenedAt` at all, so
 * the clock is simply absent rather than counting from 1970.
 */
export default function ClassConsole({
  live, openedAt, inRoom, waiting, embedded, recording, children,
}) {
  const since = useClock(live ? openedAt : '');

  return (
    <div className={`console${live ? ' is-live' : ''}`}>
      <span className={`on-air${live ? '' : ' off'}`}>
        <i aria-hidden="true" />
        {live ? 'On air' : 'Off air'}
      </span>

      {live && since && (
        <span className="console-stat" title="Since the class was opened">
          <b>{since}</b><small>running</small>
        </span>
      )}

      {live && embedded && (
        <span className="console-stat">
          <b>{inRoom}</b><small>in the room</small>
        </span>
      )}

      {live && (
        <span className={`console-stat${waiting ? ' wants' : ''}`}>
          <b>{waiting}</b><small>{waiting === 1 ? 'question' : 'questions'}</small>
        </span>
      )}

      {recording && (
        <span className="console-rec">
          <i aria-hidden="true" />Recording
        </span>
      )}

      <span className="spacer" />
      {children}
    </div>
  );
}

/**
 * Seconds since an ISO instant, as a clock, updating in place.
 *
 * Recomputed from the timestamp on every tick rather than incremented: a
 * counter that adds one per interval drifts, and drifts badly on a laptop
 * that was asleep for the lunch break.
 */
function useClock(openedAt) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!openedAt) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [openedAt]);

  if (!openedAt) return '';
  const started = Date.parse(openedAt);
  if (Number.isNaN(started)) return '';
  return elapsed(Math.max(0, now - started));
}
