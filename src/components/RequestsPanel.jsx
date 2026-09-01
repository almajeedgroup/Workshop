import { useState } from 'react';
import { normalizePhone } from '../lib/parser.js';
import { formatDateRange } from '../lib/tickets.js';
import { ISSUER, CURRENCY, isFreeWorkshop, workshopFee } from '../lib/schema.js';
import QrCode from './QrCode.jsx';

/** The receipt an accepted registrant is sent, on WhatsApp. */
export function receiptMessage(workshop, request, ticketId) {
  return [
    `*${ISSUER.name.toUpperCase()}*`, ISSUER.unitLine, '',
    '*REGISTRATION CONFIRMED*',
    request.ref ? `*Reference:* ${request.ref}` : '',
    ticketId ? `*Ticket ID:* ${ticketId}` : '',
    `*Name:* ${request.name}`, '',
    `*Workshop:* ${workshop.title}`,
    formatDateRange(workshop) ? `*Date:* ${formatDateRange(workshop)}` : '',
    workshop.time ? `*Time:* ${workshop.time}` : '',
    workshop.venue ? `*Venue:* ${workshop.venue}` : '',
    isFreeWorkshop(workshop) ? '*Fee:* Free' : (workshopFee(workshop) ? `*Fee:* ${CURRENCY}${workshopFee(workshop)}` : ''),
    request.paymentRef ? `*Payment reference:* ${request.paymentRef}` : '',
    '', 'Please carry your ticket (printed or on your phone) for entry.',
    `Enquiries: ${ISSUER.phones.join(' / ')}`,
  ].filter(Boolean).join('\n');
}

/**
 * Registrations that arrived from the public form.
 *
 * Nothing here happens on its own: a request becomes a registration — and gets
 * its ticket number — only when somebody presses Accept. Payment is marked by
 * hand afterwards, on the list below.
 */
export default function RequestsPanel({
  workshop, requests, registerLink, onAccept, onReject, onDelete, onToggleOpen,
  busyId, toggling,
}) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const pending = requests.filter((r) => r.status === 'new');
  const handled = requests.filter((r) => r.status !== 'new');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(registerLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the link is on screen anyway */ }
  };

  const open = workshop.registrationOpen === 'Open';
  // What the payment block on the form will actually be able to show. If
  // neither is set the form falls back to "we will send you the details",
  // which looks to everyone like a QR that failed to load.
  const hasQrImage = !!(workshop.paymentQrUrl || ISSUER.paymentQrImage);
  const hasUpi = !!(workshop.paymentUpi || ISSUER.upiId);
  const feePayable = !isFreeWorkshop(workshop) && workshopFee(workshop) > 0;

  return (
    <div className="panel">
      <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
        <h2>Self-registration</h2>
        <span className="count">
          {pending.length} waiting{handled.length ? ` · ${handled.length} handled` : ''}
        </span>
        <span className="spacer" />
        <div className="btn-row no-print">
          <button onClick={() => setShowQr((v) => !v)}>
            {showQr ? 'Hide QR' : 'Show QR for the poster'}
          </button>
          <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
        </div>
      </div>

      <div className={`notice${open ? '' : ' warn'}`}>
        <div className="btn-row" style={{ alignItems: 'center' }}>
          <span style={{ flex: 1, minWidth: 220 }}>
            {open ? (
              <>The registration page is <strong>live</strong>. Anyone with the QR or the
              link can register.</>
            ) : (
              <>The registration page is <strong>not live</strong>. The link will not work
              until you publish it.</>
            )}
          </span>
          <button
            className={open ? undefined : 'primary'}
            disabled={toggling}
            onClick={() => onToggleOpen(!open)}
          >
            {toggling ? 'Saving…' : open ? 'Close registration' : 'Publish the registration page'}
          </button>
        </div>
      </div>

      {feePayable && !hasQrImage && !hasUpi && (
        <div className="notice warn">
          There is <strong>no payment QR</strong> on the registration form, so it asks
          students to telephone instead. Add one on <strong>Edit</strong>: upload the QR
          from your bank under <strong>Payment QR Image</strong>, or type a{' '}
          <strong>Payment UPI</strong> ID and the QR is generated with the{' '}
          {CURRENCY}{workshopFee(workshop)} already filled in.
        </div>
      )}

      {showQr && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ border: 'var(--hair)', padding: 14, background: '#fff' }}>
            <QrCode value={registerLink} title="Registration QR code" style={{ width: 190, height: 190, display: 'block' }} />
          </div>
          <div>
            <p className="hint" style={{ marginTop: 0 }}>
              Print this on the poster. Scanning it opens the registration form for this
              workshop, with the details already filled in.
            </p>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 12, marginTop: 8, wordBreak: 'break-all' }}>
              {registerLink}
            </p>
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="empty">
          {open ? 'No registrations waiting.' : 'Registration is closed.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th><th>Name</th><th>Contact</th>
                <th>Qualification</th><th>Payment ref.</th>
                <th className="no-print">Decision</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{r.ref || '—'}</td>
                  <td>
                    {r.name}
                    {r.area && <div className="count">{r.area}</div>}
                  </td>
                  <td>
                    <div className="count">{r.whatsapp}</div>
                    {r.email && <div className="count">{r.email}</div>}
                  </td>
                  <td>
                    {r.qualification || '—'}
                    {r.courseName && <div className="count">{r.courseName}</div>}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.paymentRef || '—'}</td>
                  <td className="no-print">
                    <div className="actions">
                      <button
                        className="small primary"
                        disabled={busyId === r.id}
                        onClick={() => onAccept(r)}
                      >
                        {busyId === r.id ? '…' : 'Accept'}
                      </button>
                      <button className="small" disabled={busyId === r.id} onClick={() => onReject(r)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="hint" style={{ marginTop: 10 }}>
        Accepting adds the person to the registration list below and issues their ticket
        number. Payment stays <strong>Pending</strong> until you mark it on that list.
      </div>

      {handled.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {handled.length} already handled
          </summary>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr><th>Reference</th><th>Name</th><th>Status</th><th className="no-print" /></tr>
              </thead>
              <tbody>
                {handled.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{r.ref || '—'}</td>
                    <td>{r.name}</td>
                    <td>
                      {r.status}
                      {r.whatsapp && r.status === 'accepted' && (
                        <a
                          className="chip"
                          style={{ marginLeft: 8 }}
                          href={`https://wa.me/${normalizePhone(r.whatsapp)}?text=${encodeURIComponent(receiptMessage(workshop, r, r.ticketId))}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Send receipt
                        </a>
                      )}
                    </td>
                    <td className="no-print">
                      <button className="small" disabled={busyId === r.id} onClick={() => onDelete(r)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
