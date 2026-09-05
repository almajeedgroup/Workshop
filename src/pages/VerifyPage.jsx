import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCertificate, getHolder } from '../lib/certdb.js';
import { formatDate } from '../lib/tickets.js';
import { ISSUER } from '../lib/schema.js';
import {
  IconCheckCircle, IconAlert, IconShield, IconArrow, IconQr,
} from '../components/site/Icons.jsx';

/**
 * Public verification.
 *
 * Somebody is holding a certificate and wants to know whether it is real.
 * This answers plainly — genuine, withdrawn, or never issued — then shows what
 * else that person has been awarded.
 *
 * Everything shown comes from the certificate record, which by design holds no
 * contact details at all.
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
            setHistory((holder?.entries || []).slice()
              .sort((a, b) => String(b.issuedOn || '').localeCompare(String(a.issuedOn || ''))));
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
  const genuine = cert && !cert.revoked;

  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div style={{ maxWidth: 720 }} data-reveal>
            <span className="eyebrow">Certificate verification</span>
            <h1 className="display" style={{ fontSize: 'clamp(30px,4.4vw,48px)' }}>
              Check a certificate
            </h1>
            <div className="tri" style={{ marginTop: 20 }}><i /><i /><i /></div>
            <p className="lede" style={{ marginTop: 20 }}>
              Enter the ID printed at the bottom left of the certificate, or scan the QR code
              beside it.
            </p>

            <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>
              <input
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="e.g. AIHOW26-COM-001"
                aria-label="Certificate ID"
                style={{
                  font: 'inherit', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
                  fontSize: 16, padding: '14px 18px', borderRadius: 12,
                  border: '1.6px solid var(--hair-2)', background: '#fff',
                  minWidth: 280, flex: '1 1 280px', textTransform: 'uppercase',
                }}
              />
              <button className="btn" type="submit" disabled={!entry.trim() || checking}>
                {checking ? 'Checking…' : 'Verify'} <IconArrow />
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className={result || error ? '' : 'band-soft'} style={{ paddingTop: result || error ? 0 : undefined }}>
        <div className="wrap">
          {error && (
            <div className="verdict bad" style={{ marginBottom: 24 }}>
              <span className="vico"><IconAlert /></span>
              <div><h3>Could not check right now</h3><p>{error}</p></div>
            </div>
          )}

          {result && !result.found && (
            <>
              <div className="verdict bad">
                <span className="vico"><IconAlert /></span>
                <div>
                  <h3>Not found</h3>
                  <p>
                    No certificate was issued with the ID{' '}
                    <strong style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>{certificateId}</strong>.
                  </p>
                </div>
              </div>
              <p style={{ marginTop: 20, maxWidth: '60ch' }}>
                Check the ID against the printed certificate — it is at the bottom left. If it
                still does not match, the certificate did not come from us.
              </p>
            </>
          )}

          {cert && (
            <>
              <div className={`verdict ${genuine ? 'good' : 'bad'}`} data-reveal>
                <span className="vico">{genuine ? <IconCheckCircle /> : <IconAlert />}</span>
                <div>
                  <h3>{genuine ? 'Genuine certificate' : 'Withdrawn'}</h3>
                  <p>
                    {genuine
                      ? `Issued by ${ISSUER.name} and valid.`
                      : `This certificate was issued but has since been withdrawn${cert.revokedReason ? `: ${cert.revokedReason}` : '.'} It should not be relied upon.`}
                  </p>
                </div>
              </div>

              <div className="grid g2" style={{ marginTop: 'var(--gap)', alignItems: 'start' }}>
                <div data-reveal>
                  <h2 style={{ fontSize: 'clamp(20px,2.4vw,26px)', marginBottom: 18 }}>
                    {cert.typeLabel || 'Certificate'}
                  </h2>
                  <dl className="dl">
                    <dt>Awarded to</dt><dd>{cert.recipientName}</dd>
                    <dt>Certificate ID</dt><dd className="mono">{cert.certificateId}</dd>
                    <dt>Award</dt><dd>{cert.typeLabel}</dd>
                    <dt>Programme</dt><dd>{cert.workshopTitle}</dd>
                    {cert.workshopDates && <><dt>Held</dt><dd>{cert.workshopDates}</dd></>}
                    {cert.venue && <><dt>Venue</dt><dd>{cert.venue}</dd></>}
                    {cert.presentedBy && <><dt>Presented by</dt><dd>{cert.presentedBy}</dd></>}
                    <dt>Issued on</dt><dd>{formatDate(cert.issuedOn) || cert.issuedOn}</dd>
                  </dl>
                  <div style={{ marginTop: 22 }}>
                    <Link className="btn ghost" to={`/c/${cert.certificateId}`}>
                      View the certificate <IconArrow />
                    </Link>
                  </div>
                </div>

                <div className="card" data-reveal>
                  <h3>Record with us</h3>
                  {history.length <= 1 ? (
                    <p style={{ marginTop: 10 }}>
                      This is the only certificate we have issued to this person.
                    </p>
                  ) : (
                    <div className="scroll-x" style={{ marginTop: 14 }}>
                      <table className="htable">
                        <thead>
                          <tr><th>Certificate</th><th>Award</th><th>Programme</th><th>Issued</th></tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={h.certificateId}>
                              <td className="mono">
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
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--hair)' }}>
                    <IconShield width="16" height="16" style={{ color: 'var(--ink-faint)', flex: 'none', marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: 'var(--ink-faint)', lineHeight: 1.6 }}>
                      Contact details are never shown here. To confirm anything further, call{' '}
                      {ISSUER.phones.join(' or ')}.
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {!result && !checking && !error && (
            <div className="grid g3">
              {[
                { icon: <IconQr />, t: 'Scan or type', d: 'Point a phone camera at the QR code on the certificate, or type the ID into the box above.' },
                { icon: <IconCheckCircle />, t: 'Get a plain answer', d: 'Genuine, withdrawn, or never issued — along with the award, the programme and the date.' },
                { icon: <IconShield />, t: 'Nothing private shown', d: 'No phone numbers, dates of birth or addresses appear on this page, and the register cannot be searched by name.' },
              ].map((c, i) => (
                <div className="card" key={c.t} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                  <div className="ico green">{c.icon}</div>
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
