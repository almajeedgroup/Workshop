import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllWithRegistrations } from '../lib/db.js';
import { getAllMarks } from '../lib/attendancedb.js';
import {
  groupPeople, returningPeople, attendanceAcross, courseCount, RETURNING_AT,
} from '../lib/people.js';
import { ISSUER } from '../lib/schema.js';

/**
 * Who keeps coming back.
 *
 * A registration belongs to a workshop, so somebody on three courses was
 * three unrelated records and the school had no way to see it. This is the
 * one screen that reads across courses instead of down one.
 *
 * REGISTERED AND ATTENDED ARE DIFFERENT QUESTIONS and the difference is
 * real here: a register is not taken on every course, so counting only
 * marked attendance hides most returning students, while counting only
 * registrations includes somebody who signed up twice and came once. Both
 * are askable; neither is presented as the other.
 */
export default function PeoplePage() {
  const [bundles, setBundles] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [basis, setBasis] = useState('registered');
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    listAllWithRegistrations()
      .then(async (b) => {
        if (!live) return;
        setBundles(b);
        // One read per course, and only on this screen. Nothing else needs
        // every register at once.
        const entries = await Promise.all(
          b.map(async ({ workshop }) => [workshop.id, await getAllMarks(workshop.id)])
        );
        if (live) setMarks(Object.fromEntries(entries));
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const people = useMemo(() => groupPeople(bundles), [bundles]);
  const returning = useMemo(
    () => returningPeople(people, { basis, marksByWorkshop: marks }),
    [people, basis, marks]
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return returning;
    return returning.filter((p) =>
      `${p.name} ${p.whatsapp} ${p.email} ${p.area}`.toLowerCase().includes(needle));
  }, [returning, q]);

  if (loading) return <main><p className="count">Loading everybody…</p></main>;

  return (
    <main>
      <div className="print-only print-head">
        <h1>Returning Students</h1>
        <div className="org">{ISSUER.name} — {ISSUER.unitLine}</div>
        <div className="rule" />
      </div>

      <div className="page-head no-print">
        <div>
          <h1>Students</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {shown.length} on {RETURNING_AT} or more courses, of {people.length} people
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to="/console">← Console</Link>
          <button onClick={() => window.print()} disabled={!shown.length}>Print</button>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}

      <div className="toolbar no-print">
        <div className="btn-row" role="group" aria-label="Counted by">
          <button
            className={basis === 'registered' ? 'primary' : undefined}
            aria-pressed={basis === 'registered'}
            onClick={() => setBasis('registered')}
          >
            Registered on {RETURNING_AT}+
          </button>
          <button
            className={basis === 'attended' ? 'primary' : undefined}
            aria-pressed={basis === 'attended'}
            onClick={() => setBasis('attended')}
          >
            Attended {RETURNING_AT}+
          </button>
        </div>
        <input
          placeholder="Filter by name, number, area…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 260 }}
        />
        {q && <button onClick={() => setQ('')}>Clear</button>}
      </div>

      <p className="hint no-print" style={{ marginBottom: 12 }}>
        {basis === 'registered'
          ? `Everybody registered on ${RETURNING_AT} or more courses. Registering is not the same as turning up.`
          : `Everybody marked present on ${RETURNING_AT} or more courses. A course whose register was never taken cannot count either way, so this list is shorter than the truth.`}
      </p>

      {shown.length === 0 ? (
        <div className="empty">
          {q.trim()
            ? `No student on ${RETURNING_AT} or more courses matches “${q.trim()}”.`
            : people.length === 0
              ? 'No registrations yet.'
              : basis === 'attended'
                ? 'Nobody has been marked present on two courses yet. Take a register on the attendance screen and they will appear here.'
                : 'Nobody has been on two courses yet.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num" style={{ width: 44 }}>#</th>
                <th>Name</th>
                <th className="num">Courses</th>
                <th className="num">Attended</th>
                <th>Most recent</th>
                <th>Contact</th>
                <th className="no-print">Profile</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => {
                const tally = p.tally || attendanceAcross(p, marks);
                const latest = p.courses[0]?.workshop;
                return (
                  <tr key={p.id}>
                    <td className="num">{i + 1}</td>
                    <td><Link to={`/people/${p.id}`}>{p.name}</Link></td>
                    <td className="num">{courseCount(p)}</td>
                    <td className="num">
                      {tally.recorded
                        ? `${tally.attended} of ${tally.recorded}`
                        : <span className="hint">no register</span>}
                    </td>
                    <td>{latest?.title || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.whatsapp || p.email || '—'}</td>
                    <td className="no-print">
                      <Link className="btn small" to={`/people/${p.id}`}>Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
