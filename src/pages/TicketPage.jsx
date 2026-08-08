import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWorkshop, getRegistration } from '../lib/db.js';
import TicketDocument from '../components/TicketDocument.jsx';
import {
  ticketMessage, ticketMessagePlain, ticketSubject,
  whatsappLink, mailtoLink, telLink,
} from '../lib/tickets.js';

export default function TicketPage() {
  const { id, regId } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [reg, setReg] = useState(null);
  // Two kinds of failure, kept apart: one means there is no ticket to show,
  // the other is a passing problem with an action. A failed copy must not
  // take the ticket off the screen.
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistration(id, regId)])
      .then(([w, r]) => {
        if (!live) return;
        if (!w || !r) { setLoadError('Ticket not found.'); return; }
        setWorkshop(w);
        setReg(r);
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id, regId]);

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (loadError) {
    return (
      <main>
        <div className="notice warn">{loadError}</div>
        <Link className="btn" to={`/w/${id}`}>← Back to the workshop</Link>
      </main>
    );
  }

  const message = ticketMessage(workshop, reg);
  const plain = ticketMessagePlain(workshop, reg);

  const copy = async () => {
    setActionError('');
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Could not copy — select the preview text below and copy it manually.');
    }
  };

  return (
    <main>
      <div className="page-head no-print">
        <div>
          <h1>Ticket {reg.ticketId}</h1>
          <div className="count" style={{ marginTop: 4 }}>{reg.name} · {workshop.title}</div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={`/w/${id}`}>← Workshop</Link>
          <button onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      <TicketDocument workshop={workshop} reg={reg} />

      <div className="panel no-print" style={{ marginTop: 18 }}>
        <h2>Send this ticket</h2>
        {actionError && <div className="notice warn">{actionError}</div>}
        <div className="btn-row" style={{ marginBottom: 12 }}>
          {reg.whatsapp && (
            <>
              <a className="btn" href={whatsappLink(reg.whatsapp, message)} target="_blank" rel="noreferrer">
                Send on WhatsApp
              </a>
              <a className="btn" href={telLink(reg.whatsapp)}>Call {reg.whatsapp}</a>
            </>
          )}
          {reg.email && (
            <a className="btn" href={mailtoLink(reg.email, ticketSubject(workshop, reg), plain)}>
              Send by email
            </a>
          )}
          <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy ticket text'}</button>
        </div>

        <div className="hint" style={{ marginBottom: 8 }}>
          WhatsApp and email open with the message already written — review it, then send.
          To attach the ticket as a PDF, use <strong>Print / Save as PDF</strong> above and
          attach the saved file.
        </div>

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Preview message text
          </summary>
          <pre className="msg-preview">{message}</pre>
        </details>
      </div>
    </main>
  );
}
