import { Link } from 'react-router-dom';
import { groupSummary } from '../lib/overview.js';
import { formatDateRange } from '../lib/tickets.js';
import { CURRENCY } from '../lib/schema.js';
import SeatBar from './SeatBar.jsx';

/**
 * One workshop as a board group: a coloured rail, a header you can judge the
 * course by without opening it, its people underneath, and a summary strip.
 *
 * The header carries the figures deliberately. A collapsed group has to be
 * worth looking at on its own — otherwise a collapsed board is a list of
 * titles and an expanded one is four hundred rows.
 */
export default function BoardGroup({ group, open, onToggle }) {
  const { workshop, rows, reasons, tone, finished, seats } = group;
  const summary = groupSummary(group);

  return (
    <section className="grp" data-tone={tone} data-finished={finished || undefined}>
      <header className="grp-head">
        <button
          type="button"
          className="grp-toggle"
          aria-expanded={open}
          onClick={onToggle}
          title={open ? 'Collapse' : 'Expand'}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="vh">{open ? 'Collapse' : 'Expand'} {workshop.title || 'untitled'}</span>
        </button>

        <div className="grp-name">
          <Link to={`/w/${workshop.id}`}>{workshop.title || '(untitled)'}</Link>
          <div className="count">
            {formatDateRange(workshop) || 'no dates'}
            {workshop.venue ? ` · ${workshop.venue}` : ''}
          </div>
        </div>

        <span className="spacer" />

        <div className="grp-figs">
          {summary.map(([label, value]) => (
            <span className="fig" key={label}>
              <b>{label}</b>
              {label === 'Collected' ? `${CURRENCY}${value}` : value}
            </span>
          ))}
        </div>

        {seats && <SeatBar workshop={workshop} count={rows.length} showLabel={false} />}
      </header>

      {reasons.length > 0 && (
        <div className="why grp-why">
          {reasons.map((r) => (
            <span className="r" key={r.kind} data-tone={r.tone}>{r.text}</span>
          ))}
        </div>
      )}

      {open && (
        rows.length === 0 ? (
          <div className="grp-empty">
            Nobody registered yet. <Link to={`/w/${workshop.id}`}>Add registrations</Link>.
          </div>
        ) : (
          <div className="table-wrap grp-rows">
            <table>
              <thead>
                <tr>
                  <th className="num" style={{ width: 40 }}>#</th>
                  <th>Ticket ID</th>
                  <th>Name</th>
                  <th>Qualification</th>
                  <th>Contact</th>
                  <th>Payment</th>
                  <th className="no-print">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td className="num">{i + 1}</td>
                    <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{r.ticketId || '—'}</td>
                    <td>
                      {r.name}
                      {r.area && <div className="count">{r.area}</div>}
                    </td>
                    <td>{r.qualification || '—'}</td>
                    <td className="count">{r.whatsapp || r.email || '—'}</td>
                    <td>
                      {/* Read-only here: the board is for seeing across every
                          course at once. Changing a status belongs on the
                          workshop screen, beside the person's other details. */}
                      <span className="pill" data-status={r.paymentStatus || 'Pending'}>
                        {r.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="no-print">
                      <Link className="chip" to={`/w/${workshop.id}/t/${r.id}`}>Ticket</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
