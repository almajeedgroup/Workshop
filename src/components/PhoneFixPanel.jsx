import { useState } from 'react';
import { scanPhones, applyPhones } from '../lib/phonefixdb.js';
import { summarise, fieldLabel } from '../lib/phonefix.js';

/**
 * The one-off tidy-up of phone numbers saved before they were normalised.
 *
 * IT CHECKS BEFORE IT CHANGES. Pressing Check writes nothing: it reads every
 * record and lists exactly which ones it would rewrite, and what to. Only
 * then does an Apply button appear. A migration that edits live data on its
 * first press is one nobody can safely try.
 *
 * Running it again is harmless — the second pass finds nothing, because a
 * number already in +91 form produces no patch.
 */
export default function PhoneFixPanel() {
  const [scan, setScan] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const rows = scan
    ? [
      ...scan.workshops.map((w) => ({
        key: `w:${w.id}`, what: 'Workshop', who: w.title, patch: w.patch, before: w.before,
      })),
      ...scan.registrations.map((r) => ({
        key: `r:${r.id}`, what: 'Registration', who: r.name, patch: r.patch, before: r.before,
      })),
      ...scan.requests.map((q) => ({
        key: `q:${q.id}`, what: 'Request', who: q.name, patch: q.patch, before: q.before,
      })),
    ]
    : [];

  const check = async () => {
    setBusy('check'); setError(''); setDone('');
    try {
      setScan(await scanPhones());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const apply = async () => {
    setBusy('apply'); setError('');
    try {
      const n = await applyPhones(scan);
      setDone(`Rewritten. ${n} document${n === 1 ? '' : 's'} updated.`);
      setScan(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="panel no-print">
      <h2>Phone numbers</h2>
      <p className="count">
        Numbers are saved as <code>+91 98452 89298</code>. Anything stored before
        that is however it was typed. This finds those and puts them in one shape.
        Anything it cannot confidently read as an Indian number — a foreign
        number, or a note written in the field — is left exactly as it is.
      </p>

      {error && <div className="notice warn">{error}</div>}
      {done && <div className="notice">{done}</div>}

      <div className="btn-row">
        <button type="button" onClick={check} disabled={Boolean(busy)}>
          {busy === 'check' ? 'Checking…' : 'Check'}
        </button>
        {rows.length > 0 && (
          <button type="button" className="primary" onClick={apply} disabled={Boolean(busy)}>
            {busy === 'apply'
              ? 'Rewriting…'
              : `Rewrite ${rows.length} record${rows.length === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {scan && <p className="count">{summarise(scan)}</p>}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Record</th><th>Name</th><th>Field</th><th>Now</th><th>Becomes</th></tr>
            </thead>
            <tbody>
              {rows.flatMap((row) =>
                Object.entries(row.patch).map(([field, next]) => (
                  <tr key={`${row.key}:${field}`}>
                    <td>{row.what}</td>
                    <td>{row.who}</td>
                    <td>{fieldLabel(field)}</td>
                    <td className="was">{row.before?.[field] || '—'}</td>
                    <td>{Array.isArray(next) ? next.join('; ') : next}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
