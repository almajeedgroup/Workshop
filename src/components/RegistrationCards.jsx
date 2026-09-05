import { Link } from 'react-router-dom';
import { formatDate } from '../lib/tickets.js';

/**
 * The registrations as faces rather than rows.
 *
 * This is the view you want at the door: somebody hands you a card, and you
 * check the photograph and the ticket number against the register. A table
 * of names cannot be checked against a face, and the print sheets are for
 * making cards, not for reading one.
 *
 * A person with no photograph still appears — leaving them out would make the
 * gallery an incomplete register, which is the one thing it must not be.
 */
export default function RegistrationCards({ workshop, rows, photos }) {
  if (rows.length === 0) {
    return <div className="empty">No registrations yet.</div>;
  }

  return (
    <div className="cards">
      {rows.map((r) => {
        const photo = photos[r.id] || '';
        return (
          <article className="card-p" key={r.id}>
            <div className="card-photo">
              {photo
                ? <img src={photo} alt="" />
                : <span>No photo</span>}
            </div>

            <div className="card-body">
              <div className="card-name">{r.name}</div>
              <div className="card-tid">{r.ticketId || 'no ticket number'}</div>

              <dl className="card-kv">
                {r.qualification && (<><dt>Qualification</dt><dd>{r.qualification}</dd></>)}
                {r.area && (<><dt>Area</dt><dd>{r.area}</dd></>)}
                {r.dob && (<><dt>Date of Birth</dt><dd>{formatDate(r.dob)}</dd></>)}
                {r.bloodGroup && (<><dt>Blood Group</dt><dd>{r.bloodGroup}</dd></>)}
                {r.whatsapp && (<><dt>WhatsApp</dt><dd>{r.whatsapp}</dd></>)}
              </dl>

              <div className="card-foot no-print">
                <span className="pill" data-status={r.paymentStatus || 'Pending'}>
                  {r.paymentStatus || 'Pending'}
                </span>
                <span className="spacer" />
                <Link className="chip" to={`/w/${workshop.id}/card/${r.id}`}>Card</Link>
                <Link className="chip" to={`/w/${workshop.id}/t/${r.id}`}>Ticket</Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
