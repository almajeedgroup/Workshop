import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWorkshop, getRegistrations } from '../lib/db.js';
import { issueCertificates, listWorkshopCertificates, setCertificateRevoked } from '../lib/certdb.js';
import { CERTIFICATE_TYPES, DEFAULT_CERTIFICATE_TYPE, certificateTypeByKey } from '../lib/certificates.js';
import { formatDateRange, formatDate } from '../lib/tickets.js';
import { certificateUrlFor } from '../lib/certlinks.js';
import CertificateDocument from '../components/CertificateDocument.jsx';
import CertificateStage from '../components/CertificateStage.jsx';
import { verifyUrlFor } from '../lib/certlinks.js';

/**
 * Awarding certificates for one workshop.
 *
 * Everyone registered is listed; tick who earned this award and issue. A
 * candidate who already holds that award is shown as such and cannot be given
 * a second one by accident.
 */
export default function CertificateAllotPage() {
  const { id } = useParams();

  const [workshop, setWorkshop] = useState(null);
  const [regs, setRegs] = useState([]);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [type, setType] = useState(DEFAULT_CERTIFICATE_TYPE);
  const [picked, setPicked] = useState(() => new Set());
  const [issuing, setIssuing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [preview, setPreview] = useState(null);

  const reload = async () => {
    const [w, r, c] = await Promise.all([
      getWorkshop(id), getRegistrations(id), listWorkshopCertificates(id),
    ]);
    setWorkshop(w); setRegs(r); setCerts(c);
  };

  useEffect(() => {
    let live = true;
    Promise.all([getWorkshop(id), getRegistrations(id), listWorkshopCertificates(id)])
      .then(([w, r, c]) => { if (live) { setWorkshop(w); setRegs(r); setCerts(c); } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id]);

  /** Who already holds the award currently selected. */
  const heldByTicket = useMemo(() => {
    const map = new Map();
    for (const c of certs) {
      if (c.type !== type || c.revoked) continue;
      map.set(c.ticketId || c.recipientName, c);
    }
    return map;
  }, [certs, type]);

  const eligible = useMemo(
    () => regs.filter((r) => !heldByTicket.has(r.ticketId || r.name)),
    [regs, heldByTicket]
  );

  const toggle = (key) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const keyOf = (r) => r.id;
  const selectAll = () => setPicked(new Set(eligible.map(keyOf)));
  const selectPaid = () => setPicked(new Set(eligible.filter((r) => r.paymentStatus === 'Paid').map(keyOf)));
  const clearAll = () => setPicked(new Set());

  const issue = async () => {
    const chosen = regs.filter((r) => picked.has(keyOf(r)));
    if (!chosen.length) return;
    setIssuing(true);
    setError('');
    setNotice('');
    try {
      const result = await issueCertificates(
        { ...workshop, workshopDates: formatDateRange(workshop) },
        chosen,
        type
      );
      await reload();
      setPicked(new Set());
      setNotice(
        `Issued ${result.issued.length} ${certificateTypeByKey[type].label} certificate` +
        `${result.issued.length === 1 ? '' : 's'}` +
        (result.skipped.length ? `. Skipped ${result.skipped.length} who already held one.` : '.')
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (cert, revoked) => {
    setBusyId(cert.certificateId);
    setError('');
    try {
      await setCertificateRevoked(cert.certificateId, revoked, revoked ? 'Withdrawn by the issuing office' : '');
      await reload();
      setNotice(revoked ? `${cert.certificateId} withdrawn.` : `${cert.certificateId} reinstated.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  const copyLink = async (cert) => {
    try {
      await navigator.clipboard.writeText(certificateUrlFor(cert.certificateId));
      setNotice(`Link to ${cert.certificateId} copied.`);
    } catch {
      setError('Could not copy — the link is ' + certificateUrlFor(cert.certificateId));
    }
  };

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (!workshop) {
    return <main><div className="empty">Workshop not found. <Link to="/records">Back to records</Link></div></main>;
  }

  const ofType = certs.filter((c) => c.type === type);

  if (preview) {
    return (
      <main>
        <div className="page-head no-print">
          <h1>{preview.length} certificate{preview.length === 1 ? '' : 's'}</h1>
          <span className="spacer" />
          <div className="btn-row">
            <button onClick={() => setPreview(null)}>Back</button>
            <button className="primary" onClick={() => window.print()}>Print all</button>
          </div>
        </div>
        <CertificateStage>
          {preview.map((c) => (
            <CertificateDocument key={c.certificateId} cert={c} verifyUrl={verifyUrlFor(c.certificateId)} />
          ))}
        </CertificateStage>
      </main>
    );
  }

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Certificates</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {workshop.title} · {formatDateRange(workshop)}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={`/w/${id}`}>← Workshop</Link>
        </div>
      </div>

      {error && <div className="notice warn">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div className="panel">
        <h2>Which award</h2>
        <div className="btn-row" style={{ marginTop: 10 }}>
          {CERTIFICATE_TYPES.map((t) => (
            <button
              key={t.key}
              className={t.key === type ? 'primary' : undefined}
              onClick={() => { setType(t.key); setPicked(new Set()); }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          {certificateTypeByKey[type].title} — {certs.filter((c) => c.type === type && !c.revoked).length} issued
          so far for this workshop.
        </div>
      </div>

      <div className="panel">
        <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
          <h2>Award to</h2>
          <span className="count">{picked.size} of {eligible.length} selected</span>
          <span className="spacer" />
          <div className="btn-row no-print">
            <button onClick={selectAll} disabled={!eligible.length}>Select all</button>
            <button onClick={selectPaid} disabled={!eligible.length}>Only those who paid</button>
            <button onClick={clearAll} disabled={!picked.size}>Clear</button>
          </div>
        </div>

        {regs.length === 0 ? (
          <div className="empty">Nobody is registered for this workshop yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }} />
                  <th>Ticket</th>
                  <th>Name</th>
                  <th>Payment</th>
                  <th>{certificateTypeByKey[type].label} certificate</th>
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => {
                  const held = heldByTicket.get(r.ticketId || r.name);
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          style={{ width: 'auto' }}
                          checked={picked.has(keyOf(r))}
                          disabled={Boolean(held)}
                          aria-label={`Award to ${r.name}`}
                          onChange={() => toggle(keyOf(r))}
                        />
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{r.ticketId || '—'}</td>
                      <td>{r.name}</td>
                      <td>{r.paymentStatus || 'Pending'}</td>
                      <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                        {held
                          ? <Link to={`/c/${held.certificateId}`}>{held.certificateId}</Link>
                          : <span className="count">not yet</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={issue} disabled={!picked.size || issuing}>
            {issuing ? 'Issuing…' : `Issue ${picked.size} ${certificateTypeByKey[type].label} certificate${picked.size === 1 ? '' : 's'}`}
          </button>
          <span className="hint">Each gets its own ID and a QR code that verifies it.</span>
        </div>
      </div>

      <div className="panel">
        <div className="page-head" style={{ border: 0, paddingBottom: 0, marginBottom: 12 }}>
          <h2>Issued</h2>
          <span className="count">{ofType.length} {certificateTypeByKey[type].label}</span>
          <span className="spacer" />
          <div className="btn-row no-print">
            <button
              onClick={() => setPreview(ofType.filter((c) => !c.revoked))}
              disabled={!ofType.some((c) => !c.revoked)}
            >
              Preview / print all
            </button>
          </div>
        </div>

        {ofType.length === 0 ? (
          <div className="empty">None issued yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Certificate ID</th>
                  <th>Name</th>
                  <th>Issued</th>
                  <th className="no-print">Links</th>
                  <th className="no-print">Status</th>
                </tr>
              </thead>
              <tbody>
                {ofType.map((c) => (
                  <tr key={c.certificateId}>
                    <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{c.certificateId}</td>
                    <td>{c.recipientName}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(c.issuedOn) || c.issuedOn}</td>
                    <td className="no-print">
                      <div className="actions">
                        <Link className="chip" to={`/c/${c.certificateId}`}>Open</Link>
                        <Link className="chip" to={`/verify/${c.certificateId}`}>Verify</Link>
                        <button className="chip" type="button" onClick={() => copyLink(c)}>Copy link</button>
                      </div>
                    </td>
                    <td className="no-print">
                      {c.revoked ? (
                        <button className="small" disabled={busyId === c.certificateId} onClick={() => revoke(c, false)}>
                          {busyId === c.certificateId ? '…' : 'Reinstate'}
                        </button>
                      ) : (
                        <button className="small danger" disabled={busyId === c.certificateId} onClick={() => revoke(c, true)}>
                          {busyId === c.certificateId ? '…' : 'Withdraw'}
                        </button>
                      )}
                    </td>
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
