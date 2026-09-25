import { useState } from 'react';
import { listAllCertificates, scanIssuerStamps, applyIssuerStamps } from '../lib/certdb.js';
import { LEGACY_ISSUER, issuerLines } from '../lib/issuer.js';

/**
 * Recording who issued the certificates that were issued before anybody
 * thought to record it.
 *
 * A certificate used to name its issuer by reading a constant at the moment
 * somebody opened it. That is invisible until the name changes, and then
 * every certificate ever awarded quietly claims to come from an organisation
 * that did not exist when it was awarded — including the ones an employer is
 * checking.
 *
 * This writes the old wording onto them, permanently, so they go on saying
 * what they said.
 *
 * CHECK BEFORE CHANGE, like the phone-number migration: the first press reads
 * and reports, the second writes. Running it twice is harmless — a
 * certificate that already says who issued it is left alone.
 *
 * It is also SAFE TO RUN LATE. The wording it writes is frozen in
 * `LEGACY_ISSUER` rather than read from the live constant, so running it
 * after a rebrand still stamps the truth.
 */
export default function IssuerStampPanel() {
  const [scan, setScan] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const check = async () => {
    setBusy('check'); setError(''); setDone('');
    try {
      setScan(scanIssuerStamps(await listAllCertificates()));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const apply = async () => {
    setBusy('apply'); setError('');
    try {
      const n = await applyIssuerStamps(scan.missing);
      setDone(`Recorded. ${n} certificate${n === 1 ? '' : 's'} now say who issued them.`);
      setScan(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const lines = issuerLines(LEGACY_ISSUER);

  return (
    <div className="panel no-print">
      <h2>Certificate issuers</h2>
      <p className="count">
        A certificate should say who awarded it. Ones issued before this was
        recorded name whoever this school is called when somebody opens them —
        so a rebrand would rewrite every certificate already in someone’s
        hands, including the ones being verified by an employer.
      </p>
      <p className="count">
        This writes the original wording onto them:
      </p>
      <p className="joinlink">
        <code>{lines.lead}</code>
        <code>{lines.association}</code>
      </p>

      {error && <div className="notice warn">{error}</div>}
      {done && <div className="notice">{done}</div>}

      <div className="btn-row">
        <button type="button" onClick={check} disabled={Boolean(busy)}>
          {busy === 'check' ? 'Checking…' : 'Check'}
        </button>
        {scan && scan.missing.length > 0 && (
          <button type="button" className="primary" onClick={apply} disabled={Boolean(busy)}>
            {busy === 'apply'
              ? 'Recording…'
              : `Record on ${scan.missing.length} certificate${scan.missing.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {scan && (
        <p className="count">
          {scan.total === 0
            ? 'No certificates have been issued yet.'
            : scan.missing.length === 0
              ? `All ${scan.total} certificates already say who issued them.`
              : `${scan.missing.length} of ${scan.total} do not say who issued them.`
                + (scan.stamped
                  ? ` The other ${scan.stamped} ${scan.stamped === 1 ? 'already does' : 'already do'}, and ${scan.stamped === 1 ? 'is' : 'are'} left alone.`
                  : '')}
        </p>
      )}

      {scan && scan.missing.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Certificate</th><th>Awarded to</th><th>Course</th><th>Issued</th></tr>
            </thead>
            <tbody>
              {scan.missing.slice(0, 12).map((c) => (
                <tr key={c.id || c.certificateId}>
                  <td className="mono">{c.certificateId}</td>
                  <td>{c.recipientName}</td>
                  <td>{c.workshopTitle}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.issuedOn || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scan.missing.length > 12 && (
            <p className="hint">and {scan.missing.length - 12} more.</p>
          )}
        </div>
      )}

      <p className="hint">
        Safe to run at any time, and safe to run twice. The wording above is
        fixed in the code rather than read from today’s settings, so it stamps
        the same thing whenever it runs.
      </p>
    </div>
  );
}
