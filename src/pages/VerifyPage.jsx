import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCertificate, getHolder } from '../lib/certdb.js';
import { formatDate } from '../lib/tickets.js';
import { ISSUER } from '../lib/schema.js';

/**
 * Public verification.
 *
 * Someone is holding a certificate and wants to know whether it is real. They
 * type the ID; this answers plainly, and shows what else that person has been
 * awarded — which is the difference between "this document is genuine" and
 * "this is who this person is with us".
 *
 * Everything shown comes from the certificate record, which by design holds no
 * contact details.
 */
export default function VerifyPage() {
  const { certificateId } = useParams();
  const nav = useNavigate();

  const [entry, setEntry] = useState(certificateId || '');
  const [checking, setChecking] = useState(Boolean(certificateId));
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!certificateId) { setResult(null); setHistory([]); setChecking(false); return undefined; }
    let live = true;
    setChecking(true);
    setError('');
    setEntry(certificateId);

    getCertificate(certificateId)
      .then(async (cert) => {
        if (!live) return;
        setResult(cert ? { found: true, cert } : { found: false });
        if (cert?.holderKey) {
          const holder = await getHolder(cert.holderKey);
          if (live) {
            const entries = (holder?.entries || [])
              .slice()
              .sort((a, b) => String(b.issuedOn || '').localeCompare(String(a.issuedOn || '')));
            setHistory(entries);
          }
        } else setHistory([]);
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setChecking(false));

    return () => { live = false; };
  }, [certificateId]);

  const submit = (e) => {
    e.preventDefault();
    const id = entry.trim().toUpperCase();
    if (id) nav(`/verify/${encodeURIComponent(id)}`);
  };

  const cert = result?.cert;

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Verify a certificate</h1>
          <div className="count" style={{ marginTop: 4 }}>{ISSUER.unitLine}</div>
        </div>
      </div>

      <form onSubmit={submit} className="toolbar" style={{ marginBottom: 18 }}>
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="Certificate ID, e.g. AIHOW26-COM-001"
          aria-label="Certificate ID"
          style={{ minWidth: 280, fontFamily: 'var(--mono)' }}
        />
        <button className="primary" type="submit" disabled={!entry.trim() || checking}>
          {checking ? 'Checking…' : 'Verify'}
        </button>
      </form>

      {error && <div className="notice warn">{error}</div>}

      {result && !result.found && (
        <div className="panel">
          <h2>Not found</h2>
          <p style={{ marginTop: 8 }}>
            No certificate was issued with the ID <code>{certificateId}</code>.
          </p>
          <p className="hint" style={{ marginTop: 8 }}>
            Check the ID against the printed certificate — it is at the bottom left. If it
            still does not match, the certificate did not come from us.
          </p>
        </div>
      )}

      {cert && (
        <>
          <div className={`notice${cert.revoked ? ' warn' : ''}`}>
            {cert.revoked ? (
              <>
                <strong>Withdrawn.</strong> This certificate was issued but has since been
                withdrawn{cert.revokedReason ? `: ${cert.revokedReason}` : '.'} It should not be
                relied upon.
              </>
            ) : (
              <>
                <strong>Genuine.</strong> This certificate was issued by {ISSUER.name} and is
                valid.
              </>
            )}
          </div>

          <div className="panel">
            <h2>{cert.typeLabel || 'Certificate'}</h2>
            <dl className="kv">
              <dt>Awarded to</dt><dd>{cert.recipientName}</dd>
              <dt>Certificate ID</dt><dd style={{ fontFamily: 'var(--mono)' }}>{cert.certificateId}</dd>
              <dt>Award</dt><dd>{cert.typeLabel}</dd>
              <dt>Workshop</dt><dd>{cert.workshopTitle}</dd>
              {cert.workshopDates && <><dt>Held</dt><dd>{cert.workshopDates}</dd></>}
              {cert.venue && <><dt>Venue</dt><dd>{cert.venue}</dd></>}
              {cert.presentedBy && <><dt>Presented by</dt><dd>{cert.presentedBy}</dd></>}
              <dt>Issued on</dt><dd>{formatDate(cert.issuedOn) || cert.issuedOn}</dd>
            </dl>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <Link className="btn" to={`/c/${cert.certificateId}`}>View the certificate</Link>
            </div>
          </div>

          <div className="panel">
            <h2>Record with us</h2>
            {history.length <= 1 ? (
              <p className="hint">This is the only certificate we have issued to this person.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Certificate ID</th>
                      <th>Award</th>
                      <th>Workshop</th>
                      <th>Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.certificateId}>
                        <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                          {h.certificateId === cert.certificateId
                            ? <strong>{h.certificateId}</strong>
                            : <Link to={`/verify/${h.certificateId}`}>{h.certificateId}</Link>}
                        </td>
                        <td>{h.typeLabel || h.type}</td>
                        <td>{h.workshopTitle}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(h.issuedOn) || h.issuedOn}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint" style={{ marginTop: 10 }}>
              Contact details are never shown here. To confirm anything further, write to{' '}
              {ISSUER.phones.join(' or ')}.
            </p>
          </div>
        </>
      )}

      {!result && !checking && (
        <div className="panel">
          <h2>What this checks</h2>
          <p style={{ marginTop: 8 }}>
            Every certificate we issue carries an ID at the bottom left, and a QR code beside
            it. Enter the ID — or scan the code — and this page will tell you whether it is
            genuine, who it was awarded to, and for what.
          </p>
          <p className="hint" style={{ marginTop: 10 }}>
            No phone numbers, addresses or dates of birth are shown on this page.
          </p>
        </div>
      )}
    </main>
  );
}
