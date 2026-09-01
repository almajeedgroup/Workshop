import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWorkshop, getRegistrations } from '../lib/db.js';
import { courseDays, needsPerDaySheets, MAX_DAY_COLUMNS } from '../lib/attendance.js';
import { formatDate } from '../lib/tickets.js';
import AttendanceSheet from '../components/AttendanceSheet.jsx';
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
  const [error, setError] = useState('');
  const [day, setDay] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistrations(id)])
      .then(([w, r]) => {
        if (!live) return;
        if (!w) { setError('That workshop does not exist.'); return; }
        setWorkshop(w);
        setRegs(r);
        // A course too long for columns has to be printed a day at a time, so
        // start it on its first day rather than on an undated sheet.
        if (needsPerDaySheets(w)) setDay(courseDays(w)[0] || '');
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id]);

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (error) {
    return (
      <main>
        <div className="notice warn">{error}</div>
        <Link className="btn" to={`/w/${id}`}>← Back to the workshop</Link>
      </main>
    );
  }

  const days = courseDays(workshop);
  const perDay = needsPerDaySheets(workshop);

  return (
    <main>
      <div className="page-head no-print">
        <div>
          <h1>Attendance sheet</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {regs.length} registered · {workshop.title}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={`/w/${id}`}>← Workshop</Link>
          <button onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      {days.length > 1 && (
        <div className="panel no-print">
          <h2>Which sheet</h2>
          {perDay ? (
            <p className="hint" style={{ marginTop: 0 }}>
              This course runs {days.length} days — more than the {MAX_DAY_COLUMNS} that fit
              as columns wide enough to sign in. Print one sheet per day.
            </p>
          ) : (
            <p className="hint" style={{ marginTop: 0 }}>
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

      <div className="panel no-print">
        <h2>Before you print</h2>
        <ul style={{ margin: '8px 0 0 18px', fontSize: 14, lineHeight: 1.75 }}>
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
      </div>

      <AttendanceSheet workshop={workshop} registrations={regs} day={day} />
    </main>
  );
}
