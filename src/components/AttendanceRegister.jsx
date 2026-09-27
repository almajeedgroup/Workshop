import { ATTENDANCE_MARKS, attendanceMark, nextMark, attendanceSummary } from '../lib/attendance.js';
import { attendanceRows } from '../lib/attendance.js';

/**
 * Taking the register for one day.
 *
 * Built for somebody standing at a door with a phone: one tap cycles a
 * person through present, late, absent and back to unmarked, so the common
 * case is a single tap and nothing opens.
 *
 * Unmarked is shown as its own state, never as absent. A register that
 * cannot tell "nobody reached them" from "they did not come" turns an
 * unfinished job into an accusation.
 *
 * The register has two authors. `marks` is what it SHOWS — the office's
 * marks with anybody who opened the class link on their own ticket filled
 * into the rows nobody reached. `officeMarks` is only what a person put
 * there, and `joined` is who let themselves in.
 *
 * Both are needed, and for more than a label. A mark whose author you cannot
 * name is a mark you cannot defend; and "clear the day" must be able to say
 * there is nothing of the office's left to clear, rather than sitting there
 * enabled and doing nothing to rows it has no power over.
 */
export default function AttendanceRegister({
  rows, marks, onMark, onMarkAll, busyId, saving, joined, officeMarks,
}) {
  const people = attendanceRows(rows);
  const summary = attendanceSummary(people, marks);
  const selfJoined = joined || new Set();
  const byHand = officeMarks || marks;
  // Whether there is anything a person put here. Clearing cannot unmake a
  // sign-in — that happened — so with none of these the button is spent.
  const anyByHand = people.some((r) => byHand[r.id]);

  if (people.length === 0) {
    return <div className="empty">No registrations yet, so there is nobody to mark.</div>;
  }

  return (
    <>
      <div className="tiles att-tiles">
        <div className="tile" data-tone="lime">
          <span className="n">{summary.attended}</span>
          <span className="l">Attended</span>
        </div>
        <div className="tile" data-tone="tangerine">
          <span className="n">{summary.late}</span>
          <span className="l">of them late</span>
        </div>
        <div className="tile" data-tone="red">
          <span className="n">{summary.absent}</span>
          <span className="l">Absent</span>
        </div>
        <div className="tile" data-tone="blue">
          <span className="n">{summary.unmarked}</span>
          <span className="l">Not yet marked</span>
        </div>
      </div>

      <div className="btn-row no-print mb-3">
        <button className="primary" disabled={saving} onClick={() => onMarkAll('present')}>
          {saving ? 'Saving…' : 'Mark everyone present'}
        </button>
        <button disabled={saving || !anyByHand} onClick={() => onMarkAll('')}>
          Clear the day
        </button>
        <span className="hint" style={{ marginLeft: 4 }}>
          Then correct the few. Tap a name to cycle present → late → absent.
        </span>
      </div>

      <div className="reg">
        {people.map((r, i) => {
          const mark = attendanceMark(marks[r.id]);
          const self = selfJoined.has(r.id);
          const hand = byHand[r.id];
          const clash = self && hand === 'absent';
          // What the tag has to say. A row the office never touched is the
          // only one where the sign-in IS the mark; where the office also
          // marked, the sign-in is corroboration, except when it contradicts.
          const tag = !self ? ''
            : clash ? 'Opened the class link — marked absent here'
              : hand ? 'Also signed in with their ticket'
                : 'Signed in with their ticket';
          return (
            <button
              type="button"
              className="reg-row"
              key={r.id}
              data-tone={mark.tone}
              data-self={self ? (clash ? 'clash' : 'yes') : undefined}
              disabled={busyId === r.id}
              aria-label={
                `${r.name} — ${mark.label}.`
                + (tag ? ` ${tag}.` : '')
                + ' Tap to change.'
              }
              onClick={() => onMark(r, nextMark(marks[r.id]))}
            >
              <span className="reg-n">{i + 1}</span>
              <span className="reg-who">
                <b>{r.name}</b>
                <small>{r.ticketId || 'no ticket number'}{r.area ? ` · ${r.area}` : ''}</small>
                {tag ? <em className="reg-self">{tag}</em> : null}
              </span>
              <span className="reg-mark">{busyId === r.id ? '…' : mark.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hint mt-3">
        {ATTENDANCE_MARKS.filter((m) => m.key).map((m) => m.label).join(' · ')} — or leave
        somebody unmarked if you did not get to them.
        {selfJoined.size > 0 ? (
          <>
            {' '}
            <b>{selfJoined.size}</b>
            {selfJoined.size === 1 ? ' person has ' : ' people have '}
            signed in with their own ticket. Those rows filled themselves in;
            anything you mark here overrules them, and clearing the day leaves
            them present because the sign-in still happened.
          </>
        ) : null}
      </div>
    </>
  );
}
