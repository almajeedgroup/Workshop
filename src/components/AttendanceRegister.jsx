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
 */
export default function AttendanceRegister({
  rows, marks, onMark, onMarkAll, busyId, saving,
}) {
  const people = attendanceRows(rows);
  const summary = attendanceSummary(people, marks);

  if (people.length === 0) {
    return <div className="empty">No registrations yet, so there is nobody to mark.</div>;
  }

  return (
    <>
      <div className="tiles att-tiles">
        <div className="tile" data-tone="jade">
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

      <div className="btn-row no-print" style={{ marginBottom: 12 }}>
        <button className="primary" disabled={saving} onClick={() => onMarkAll('present')}>
          {saving ? 'Saving…' : 'Mark everyone present'}
        </button>
        <button disabled={saving || summary.total === summary.unmarked} onClick={() => onMarkAll('')}>
          Clear the day
        </button>
        <span className="hint" style={{ marginLeft: 4 }}>
          Then correct the few. Tap a name to cycle present → late → absent.
        </span>
      </div>

      <div className="reg">
        {people.map((r, i) => {
          const mark = attendanceMark(marks[r.id]);
          return (
            <button
              type="button"
              className="reg-row"
              key={r.id}
              data-tone={mark.tone}
              disabled={busyId === r.id}
              aria-label={`${r.name} — ${mark.label}. Tap to change.`}
              onClick={() => onMark(r, nextMark(marks[r.id]))}
            >
              <span className="reg-n">{i + 1}</span>
              <span className="reg-who">
                <b>{r.name}</b>
                <small>{r.ticketId || 'no ticket number'}{r.area ? ` · ${r.area}` : ''}</small>
              </span>
              <span className="reg-mark">{busyId === r.id ? '…' : mark.label}</span>
            </button>
          );
        })}
      </div>

      <div className="hint" style={{ marginTop: 10 }}>
        {ATTENDANCE_MARKS.filter((m) => m.key).map((m) => m.label).join(' · ')} — or leave
        somebody unmarked if you did not get to them.
      </div>
    </>
  );
}
