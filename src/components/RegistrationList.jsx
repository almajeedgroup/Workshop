import { Link } from 'react-router-dom';
import { PAYMENT_STATUSES } from '../lib/schema.js';
import {
  telLink, whatsappLink, mailtoLink, ticketMessage, ticketMessagePlain,
  ticketSubject, paymentReminderMessage, formatDate,
} from '../lib/tickets.js';

/**
 * Operational view of a workshop's registrations: contact each candidate
 * directly, flip payment status inline, and open or send their ticket.
 */
export default function RegistrationList({
  workshop, rows, onPaymentChange, busyId,
}) {
  if (rows.length === 0) {
    return <div className="empty">No registrations yet.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="num" style={{ width: 40 }}>#</th>
            <th>Ticket ID</th>
            <th>Name</th>
            <th>DoB</th>
            <th>Qualification</th>
            <th>Area</th>
            <th>Contact</th>
            <th>Payment</th>
            <th className="no-print">Ticket</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const msg = ticketMessage(workshop, r);
            const plain = ticketMessagePlain(workshop, r);
            const reminder = paymentReminderMessage(workshop, r);
            const unpaid = r.paymentStatus !== 'Paid' && r.paymentStatus !== 'Waived';

            return (
              <tr key={r.id}>
                <td className="num">{i + 1}</td>
                <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{r.ticketId || '—'}</td>
                <td>{r.name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.dob) || '—'}</td>
                <td>{r.qualification || '—'}</td>
                <td>{r.area || '—'}</td>

                <td>
                  <div className="actions">
                    {r.whatsapp && (
                      <>
                        <a className="chip" href={telLink(r.whatsapp)} title={`Call ${r.whatsapp}`}>Call</a>
                        <a
                          className="chip"
                          href={whatsappLink(r.whatsapp, unpaid ? reminder : msg)}
                          target="_blank"
                          rel="noreferrer"
                          title="Open WhatsApp"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                    {r.email && (
                      <a
                        className="chip"
                        href={mailtoLink(r.email, ticketSubject(workshop, r), plain)}
                        title={`Email ${r.email}`}
                      >
                        Email
                      </a>
                    )}
                    {!r.whatsapp && !r.email && <span className="count">—</span>}
                  </div>
                  <div className="count" style={{ marginTop: 3 }}>
                    {r.whatsapp}{r.whatsapp && r.email ? ' · ' : ''}{r.email}
                  </div>
                </td>

                <td>
                  <select
                    value={r.paymentStatus || 'Pending'}
                    disabled={busyId === r.id}
                    aria-label={`Payment status for ${r.name}`}
                    onChange={(e) => onPaymentChange(r, e.target.value)}
                  >
                    {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>

                <td className="no-print">
                  <Link className="chip" to={`/w/${workshop.id}/t/${r.id}`}>Open</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
