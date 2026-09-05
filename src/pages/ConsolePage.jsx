import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllWithRegistrations } from '../lib/db.js';
import { listPendingRequests } from '../lib/publicdb.js';
import { headlineFigures, needsAttention, upcoming } from '../lib/overview.js';
import { formatDateRange } from '../lib/tickets.js';
import { CURRENCY, isFreeWorkshop } from '../lib/schema.js';
import SeatBar from '../components/SeatBar.jsx';
import PhoneFixPanel from '../components/PhoneFixPanel.jsx';

/** Which colour each figure carries. Meaning, not position. */
const TONE = {
  workshops: 'blue',
  registered: 'jade',
  collected: 'jade',
  waiting: 'blue',
  owing: 'tangerine',
};

/** Where pressing a figure takes you. A number you cannot act on is trivia. */
const GOES_TO = {
  workshops: '/records',
  registered: '/records',
  collected: '/records',
};

/**
 * What needs doing today.
 *
 * The workshop screen could always answer "how is this course going". Nothing
 * could answer "which course needs me", short of opening all of them — which
 * is the question somebody running four at once actually opens the app to
 * ask.
 *
 * Only what is outstanding is listed. A course that is full, paid up and has
 * nothing waiting is not news, and listing it would bury the three that are.
 */
export default function ConsolePage() {
  const [bundles, setBundles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([listAllWithRegistrations(), listPendingRequests()])
      .then(([b, r]) => {
        if (!live) return;
        setBundles(b);
        setRequests(r);
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  if (loading) return <main><p className="count">Loading…</p></main>;

  const figures = headlineFigures(bundles, requests);
  const todo = needsAttention(bundles, requests);
  const soon = upcoming(bundles);

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Console</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {todo.length ? `${todo.length} workshop${todo.length === 1 ? '' : 's'} need attention` : 'Nothing outstanding'}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to="/records">Records</Link>
          <Link className="btn primary" to="/new">+ New workshop</Link>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}

      <div className="tiles">
        {figures.map((f) => {
          const body = (
            <>
              <span className="n">{f.money ? `${CURRENCY}${f.value}` : f.value}</span>
              <span className="l">{f.label}</span>
            </>
          );
          return (
            <div className="tile" key={f.key} data-tone={TONE[f.key]}>
              {GOES_TO[f.key] ? <Link to={GOES_TO[f.key]}>{body}</Link> : body}
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h2>Needs attention</h2>
        {todo.length === 0 ? (
          <div className="empty">
            {bundles.length
              ? 'Nothing waiting, nothing unpaid, nothing over its seat limit.'
              : 'No workshops yet. Add one to get started.'}
          </div>
        ) : (
          <div className="todo">
            {todo.map(({ workshop, registrations, reasons }) => (
              <div className="todo-row" key={workshop.id} data-tone={reasons[0].tone}>
                <div className="btn-row" style={{ alignItems: 'baseline' }}>
                  <Link to={`/w/${workshop.id}`} style={{ fontWeight: 700, fontSize: 15 }}>
                    {workshop.title || 'Untitled workshop'}
                  </Link>
                  <span className="count">
                    {formatDateRange(workshop) || 'no dates'} · {registrations} registered
                    {isFreeWorkshop(workshop) ? ' · free' : ''}
                  </span>
                  <span className="spacer" style={{ flex: 1 }} />
                  <SeatBar workshop={workshop} count={registrations} />
                </div>
                <div className="why">
                  {reasons.map((r) => (
                    <span className="r" key={r.kind} data-tone={r.tone}>{r.text}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {soon.length > 0 && (
        <div className="panel">
          <h2>Coming up</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Workshop</th><th>Dates</th><th>Registered</th>
                  <th>Seats</th><th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {soon.map(({ workshop, registrations, payments }) => (
                  <tr key={workshop.id}>
                    <td><Link to={`/w/${workshop.id}`}>{workshop.title || 'Untitled'}</Link></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateRange(workshop) || '—'}</td>
                    <td className="num">{registrations}</td>
                    <td><SeatBar workshop={workshop} count={registrations} /></td>
                    <td className="num">
                      {isFreeWorkshop(workshop) ? '—' : `${payments.paid} / ${payments.total}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PhoneFixPanel />
    </main>
  );
}
