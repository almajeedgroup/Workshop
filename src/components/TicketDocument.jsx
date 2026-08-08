import { ISSUER, CURRENCY } from '../lib/schema.js';
import { formatDate, formatDateRange } from '../lib/tickets.js';

function Row({ label, children }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/**
 * The printable artefact: entry ticket on top, Islamic Information Centre
 * payment receipt below. Rendered on screen and reused as-is for print/PDF.
 */
export default function TicketDocument({ workshop, reg }) {
  const paid = reg.paymentStatus === 'Paid';
  const amount = reg.amountPaid ?? workshop.feeAmount ?? '';

  return (
    <div className="ticket">
      <div className="ticket-head">
        <div className="issuer">{ISSUER.name}</div>
        {ISSUER.unitLine && <div className="issuer-sub">{ISSUER.unitLine}</div>}
      </div>

      <div className="ticket-band">
        <span>Entry Ticket</span>
        <span className="ticket-id">{reg.ticketId || '—'}</span>
      </div>

      <div className="ticket-body">
        <section>
          <h3>Candidate</h3>
          <dl className="kv tight">
            <Row label="Name">{reg.name}</Row>
            <Row label="Date of Birth">{formatDate(reg.dob)}</Row>
            <Row label="Qualification">{reg.qualification}</Row>
            <Row label="Course">{reg.courseName}</Row>
            <Row label="Area">{reg.area}</Row>
            <Row label="WhatsApp">{reg.whatsapp}</Row>
            <Row label="Email">{reg.email}</Row>
          </dl>
        </section>

        <section>
          <h3>Workshop</h3>
          <dl className="kv tight">
            <Row label="Title">{workshop.title}</Row>
            <Row label="Presented by">{workshop.presentedBy}</Row>
            <Row label="In association with">{workshop.collaborators}</Row>
            <Row label="Date">{formatDateRange(workshop)}</Row>
            <Row label="Time">{workshop.time}</Row>
            <Row label="Venue">{workshop.venue}</Row>
            <Row label="Eligibility">{workshop.audience}</Row>
          </dl>
        </section>

        <section>
          <h3>Payment Receipt</h3>
          <dl className="kv tight">
            <Row label="Status"><strong>{reg.paymentStatus || 'Pending'}</strong></Row>
            <Row label="Amount">
              {amount === '' || amount === null
                ? ''
                : `${CURRENCY}${amount}${paid ? ' — received with thanks' : ' — payable'}`}
            </Row>
            <Row label="Mode">{reg.paymentMode}</Row>
            <Row label="Reference">{reg.paymentRef}</Row>
            <Row label="Receipt No.">{reg.ticketId}</Row>
          </dl>
          {!paid && (
            <p className="ticket-note">
              This ticket is provisional until the registration fee is received.
            </p>
          )}
        </section>
      </div>

      <div className="ticket-foot">
        <div>Please carry this ticket (printed or on your phone) for entry.</div>
        {ISSUER.phones.length > 0 && <div>Enquiries: {ISSUER.phones.join('  /  ')}</div>}
      </div>
    </div>
  );
}
