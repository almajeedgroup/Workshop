import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWorkshop, getRegistrations } from '../lib/db.js';
import { courseDays, needsPerDaySheets, MAX_DAY_COLUMNS } from '../lib/attendance.js';
import { formatDate } from '../lib/tickets.js';
import AttendanceSheet from '../components/AttendanceSheet.jsx';
import AttendanceRegister from '../components/AttendanceRegister.jsx';
import { getAllMarks, getAllJoins, setMark, setMarks } from '../lib/attendancedb.js';
import { attendanceRows, withSelfJoins, joinedRegistrationIds } from '../lib/attendance.js';
import '../attendance.css';

/**
 * The attendance register, ready to print and sign.
 *
 * A course of a few days gets one sheet with a signature column per day. A
 * longer one gets a sheet per day, because six columns is already as narrow
 * as a signature box can usefully be.
 */
export default function AttendancePage() {
  const { id } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Two kinds of failure, kept apart. One means there is no register to
  // show; the other is a mark that did not save. A failed mark must not take
  // the register off the screen mid-session.
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [day, setDay] = useState('');
  const [mode, setMode] = useState('take');
  const [byDay, setByDay] = useState({});
  const [joinsByDay, setJoinsByDay] = useState({});
  const [busyId, setBusyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [withMarks, setWithMarks] = useState(true);
  // On by default: the sheet was asked for with numbers on it. The switch
  // exists because a sheet that goes round a room hands every student the
  // whole class's phone list, and that is not always wanted.
  const [withPhones, setWithPhones] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistrations(id), getAllMarks(id)])
      .then(async ([w, r, m]) => {
        if (!live) return;
        if (!w) { setLoadError('That workshop does not exist.'); return; }
        setWorkshop(w);
        setRegs(r);
        setByDay(m);
        /* Who let themselves into the class, per day. Fetched after the
           marks rather than beside them because the days to ask for come
           from the workshop, which has only just arrived. */
        const joinDays = new Set([...courseDays(w), ...Object.keys(m)]);
        const j = await getAllJoins(id, [...joinDays]);
        if (live) setJoinsByDay(j);
        // Taking a register is always for ONE day, so it opens on today when
        // the course is running and on its first day otherwise. A sheet may
        // still cover the whole course.
        const days = courseDays(w);
        const today = new Date().toISOString().slice(0, 10);
        setDay(days.includes(today) ? today : (needsPerDaySheets(w) ? days[0] || '' : ''));
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id]);

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (loadError) {
    return (
      <main>
        <div className="notice warn">{loadError}</div>
        <Link className="btn" to={`/w/${id}`}>← Back to the workshop</Link>
      </main>
    );
  }

  const days = courseDays(workshop);
  const perDay = needsPerDaySheets(workshop);
  // Taking a register needs a specific day. A course with no dates recorded
  // still gets one, filed under the day it was actually taken.
  const takingDay = day || days[0] || new Date().toISOString().slice(0, 10);
  /* What the register shows: the office's marks, with anybody who let
     themselves in filled into the rows nobody has reached. An explicit
     mark is never overwritten — see withSelfJoins. */
  const joinedToday = joinedRegistrationIds(joinsByDay[takingDay] || {}, regs);
  const marks = withSelfJoins(byDay[takingDay] || {}, joinsByDay[takingDay] || {}, regs);

  /* The same fold across every day, for the record that gets filed. A sheet
     printed as "the register that was taken" has to show who attended,
     whether the office marked them or they let themselves in. */
  const byDayMerged = Object.fromEntries(
    [...new Set([...Object.keys(byDay), ...Object.keys(joinsByDay)])]
      .map((d) => [d, withSelfJoins(byDay[d] || {}, joinsByDay[d] || {}, regs)]),
  );

  const mark = async (reg, next) => {
    setBusyId(reg.id);
    setError('');
    // Shown immediately and reconciled after: at a door, a tap that waits on
    // the network before it changes colour gets tapped again.
    setByDay((prev) => {
      const dayMarks = { ...(prev[takingDay] || {}) };
      if (next) dayMarks[reg.id] = next; else delete dayMarks[reg.id];
      return { ...prev, [takingDay]: dayMarks };
    });
    try {
      await setMark(id, takingDay, reg.id, next);
    } catch (e) {
      setError(`${reg.name}'s mark was not saved — ${e.message}`);
      const fresh = await getAllMarks(id).catch(() => null);
      if (fresh) setByDay(fresh);
    } finally {
      setBusyId('');
    }
  };

  const markAll = async (value) => {
    setSaving(true);
    setError('');
    const next = {};
    if (value) for (const r of attendanceRows(regs)) next[r.id] = value;
    setByDay((prev) => ({ ...prev, [takingDay]: next }));
    try {
      await setMarks(id, takingDay, next);
    } catch (e) {
      setError(e.message);
      const fresh = await getAllMarks(id).catch(() => null);
      if (fresh) setByDay(fresh);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <div className="page-head no-print">
        <div>
          <h1>Attendance</h1>
          <div className="count mt-1">
            {regs.length} registered · {workshop.title}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <button
            className={mode === 'take' ? 'primary' : undefined}
            aria-pressed={mode === 'take'}
            onClick={() => setMode('take')}
          >
            Take the register
          </button>
          <button
            className={mode === 'print' ? 'primary' : undefined}
            aria-pressed={mode === 'print'}
            onClick={() => setMode('print')}
          >
            Print a sheet
          </button>
          <Link className="btn" to={`/w/${id}`}>← Workshop</Link>
          {mode === 'print' && <button onClick={() => window.print()}>Print / Save as PDF</button>}
        </div>
      </div>

      {error && <div className="notice warn no-print">{error}</div>}

      {mode === 'take' && (
        <>
          <div className="panel no-print">
            <h2>Which day</h2>
            <p className="hint mt-0">
              A register belongs to one day. {days.length > 1
                ? 'Marks are saved as you tap, per day.'
                : 'This course runs on one day.'}
            </p>
            <div className="field" style={{ maxWidth: 320, marginBottom: 0 }}>
              <div className="lab"><label htmlFor="take-day">Register for</label></div>
              <select id="take-day" value={takingDay} onChange={(e) => setDay(e.target.value)}>
                {(days.length ? days : [takingDay]).map((d) => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
            </div>
          </div>

          <AttendanceRegister
            rows={regs}
            marks={marks}
            officeMarks={byDay[takingDay] || {}}
            joined={joinedToday}
            onMark={mark}
            onMarkAll={markAll}
            busyId={busyId}
            saving={saving}
          />
        </>
      )}

      {mode === 'print' && days.length > 1 && (
        <div className="panel no-print">
          <h2>Which sheet</h2>
          {perDay ? (
            <p className="hint mt-0">
              This course runs {days.length} days — more than the {MAX_DAY_COLUMNS} that fit
              as columns wide enough to sign in. Print one sheet per day.
            </p>
          ) : (
            <p className="hint mt-0">
              One sheet covers the whole course, with a column per day. Choose a single day
              instead if you would rather each day were signed on its own sheet.
            </p>
          )}
          <div className="field" style={{ maxWidth: 320, marginBottom: 0 }}>
            <div className="lab"><label htmlFor="att-day">Sheet for</label></div>
            <select id="att-day" value={day} onChange={(e) => setDay(e.target.value)}>
              {!perDay && <option value="">The whole course — a column per day</option>}
              {days.map((d) => (
                <option key={d} value={d}>{formatDate(d)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {mode === 'print' && (
      <div className="panel no-print">
        <h2>Before you print</h2>
        <ul className="t-base" style={{ margin: '8px 0 0 18px', lineHeight: 1.75 }}>
          <li>
            Rows are 11mm tall so they can actually be signed in, and the heading
            repeats on every page.
          </li>
          <li>Set scale to <strong>100%</strong>, not "fit to page".</li>
          <li>
            The presenter and coordinator names come from the workshop. Blank lines are
            left for whoever signs on the day.
          </li>
        </ul>

        <label className="check mt-3">
          <input
            type="checkbox"
            checked={withPhones}
            onChange={(e) => setWithPhones(e.target.checked)}
          />
          <span>
            Print mobile numbers — so whoever holds the sheet can chase an absence
            without going back to a screen. Leave it off for a sheet that will be
            passed around the room.
          </span>
        </label>

        {Object.keys(byDayMerged).length > 0 && (
          <label className="check mt-3">
            <input
              type="checkbox"
              checked={withMarks}
              onChange={(e) => setWithMarks(e.target.checked)}
            />
            <span>
              Print the register that was taken, as a record to file — rather than empty
              boxes to sign
            </span>
          </label>
        )}
      </div>
      )}

      {mode === 'print' && (
        <AttendanceSheet
          workshop={workshop}
          registrations={regs}
          phones={withPhones}
          day={day}
          byDay={withMarks && Object.keys(byDayMerged).length > 0 ? byDayMerged : null}
        />
      )}
    </main>
  );
}
