import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listAllWithRegistrations } from '../lib/db.js';
import { getAllMarks } from '../lib/attendancedb.js';
import { listWorkshopCertificates } from '../lib/certdb.js';
import {
  groupPeople, findPerson, attendanceAcross, profileFacts, paidAcross,
  courseCount, RETURNING_AT,
} from '../lib/people.js';
import { formatDateRange } from '../lib/tickets.js';
import { ISSUER, CURRENCY, isFreeWorkshop } from '../lib/schema.js';

/**
 * One student, everything they have done.
 *
 * The rest of the app answers "who is on this course". This answers "what
 * has this person done with us" — which is the question asked when a
 * returning student calls, when a reference is wanted, or when somebody says
 * they were awarded something and nobody can find it.
 *
 * It prints, because that is what gets asked for.
 */
export default function PersonPage() {
  const { id } = useParams();
  const [bundles, setBundles] = useState([]);
  const [marks, setMarks] = useState({});
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    listAllWithRegistrations()
      .then(async (b) => {
        if (!live) return;
        setBundles(b);
        const found = findPerson(groupPeople(b), id);
        if (!found) return;
        // Only this person's courses, not every course in the school.
        const ids = found.courses.map(({ workshop }) => workshop.id);
        const [dayMarks, awarded] = await Promise.all([
          Promise.all(ids.map(async (w) => [w, await getAllMarks(w)])),
          Promise.all(ids.map((w) => listWorkshopCertificates(w))),
        ]);
        if (!live) return;
        setMarks(Object.fromEntries(dayMarks));
        setCerts(awarded.flat());
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id]);

  const person = useMemo(() => findPerson(groupPeople(bundles), id), [bundles, id]);
  const tally = useMemo(
    () => (person ? attendanceAcross(person, marks) : null), [person, marks]
  );

  if (loading) return <main><p className="count">Loading…</p></main>;

  if (!person) {
    return (
      <main>
        <div className="notice warn">
          {error || 'No student with that profile. They may have been removed, or the '
            + 'details that identified them may have changed.'}
        </div>
        <Link className="btn" to="/people">← Students</Link>
      </main>
    );
  }

  const money = paidAcross(person);
  const mine = new Set(person.courses.map(({ reg }) => reg.ticketId).filter(Boolean));
  const awarded = certs.filter((c) => mine.has(c.ticketId));

  return (
    <main>
      <div className="print-only print-head">
        <h1>{person.name}</h1>
        <div className="org">{ISSUER.name} — {ISSUER.unitLine}</div>
        <div className="rule" />
      </div>

      <div className="page-head no-print">
        <div>
          <h1>{person.name}</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {courseCount(person)} course{courseCount(person) === 1 ? '' : 's'}
            {courseCount(person) >= RETURNING_AT && <span className="badge done">Returning</span>}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to="/people">← Students</Link>
          <button onClick={() => window.print()}>Print / PDF</button>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}

      {!person.identified && (
        <div className="notice warn no-print">
          This registration carries no phone number, email or date of birth, so
          nothing can be matched to it. If this person has been on other
          courses, those records cannot be recognised as theirs.
        </div>
      )}

      <div className="panel">
        <h2>Details</h2>
        <dl className="kv">
          {/* dt and dd must be DIRECT children — `.kv` is a two-column grid. */}
          {profileFacts(person, tally).map(([k, v]) => (
            <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>
          ))}
        </dl>
      </div>

      <div className="panel">
        <h2>Courses</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Course</th><th>Dates</th><th>Ticket</th>
                <th>Attendance</th><th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {tally.perCourse.map(({ workshop, reg, rate }) => (
                <tr key={`${workshop.id}:${reg.id}`}>
                  <td><Link to={`/w/${workshop.id}`}>{workshop.title || '(untitled)'}</Link></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDateRange(workshop) || '—'}</td>
                  <td className="mono">
                    <Link to={`/w/${workshop.id}/t/${reg.id}`}>{reg.ticketId || '—'}</Link>
                  </td>
                  <td>
                    {rate
                      ? `${rate.attended} of ${rate.days} day${rate.days === 1 ? '' : 's'}`
                      : <span className="hint">no register taken</span>}
                  </td>
                  <td>
                    {isFreeWorkshop(workshop)
                      ? 'Free'
                      : `${reg.paymentStatus || 'Pending'}${reg.amountPaid ? ` · ${CURRENCY}${reg.amountPaid}` : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          {money.total > 0 && `${CURRENCY}${money.total} received in total. `}
          {money.owing > 0
            ? `${money.owing} course${money.owing === 1 ? '' : 's'} still unpaid.`
            : 'Nothing outstanding.'}
        </p>
      </div>

      <div className="panel">
        <h2>Certificates</h2>
        {awarded.length === 0 ? (
          <div className="empty">Nothing awarded yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Certificate</th><th>Award</th><th>Course</th><th>Issued</th></tr>
              </thead>
              <tbody>
                {awarded.map((c) => (
                  <tr key={c.certificateId}>
                    <td className="mono">
                      <Link to={`/c/${c.certificateId}`}>{c.certificateId}</Link>
                      {c.revoked && <span className="badge">Revoked</span>}
                    </td>
                    <td>{c.typeLabel || c.type}</td>
                    <td>{c.workshopTitle}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.issuedOn || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
