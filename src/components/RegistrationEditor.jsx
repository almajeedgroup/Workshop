import { REGISTRATION_FIELDS, emptyRegistration } from '../lib/schema.js';

/**
 * Editable registration grid — used on the import review screen and when
 * editing a workshop. Columns come from REGISTRATION_FIELDS, so adding a
 * field to the schema adds a column here automatically.
 */
export default function RegistrationEditor({ rows, onChange }) {
  const setCell = (i, key, v) => {
    const next = rows.slice();
    next[i] = { ...next[i], [key]: v };
    onChange(next);
  };

  const addRow = () => onChange([...rows, emptyRegistration()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="num" style={{ width: 40 }}>#</th>
              {REGISTRATION_FIELDS.map((f) => <th key={f.key}>{f.label}</th>)}
              <th className="no-print" style={{ width: 38 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || r._key || i}>
                <td className="num">{i + 1}</td>
                {REGISTRATION_FIELDS.map((f) => (
                  <td key={f.key}>
                    {f.type === 'enum' ? (
                      <select
                        value={r[f.key] ?? ''}
                        aria-label={`${f.label}, row ${i + 1}`}
                        onChange={(e) => setCell(i, f.key, e.target.value)}
                      >
                        <option value="">—</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                        value={r[f.key] ?? ''}
                        readOnly={f.key === 'ticketId' && Boolean(r[f.key])}
                        aria-label={`${f.label}, row ${i + 1}`}
                        onChange={(e) => setCell(i, f.key, e.target.value)}
                        style={f.key === 'ticketId' ? { fontFamily: 'var(--mono)' } : undefined}
                      />
                    )}
                  </td>
                ))}
                <td className="no-print">
                  <button type="button" className="small" title="Remove" onClick={() => removeRow(i)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={REGISTRATION_FIELDS.length + 2} style={{ color: 'var(--muted)' }}>
                  No registrations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="btn-row no-print" style={{ marginTop: 10 }}>
        <button type="button" onClick={addRow}>+ Add row</button>
        <span className="count">
          {rows.length} registration{rows.length === 1 ? '' : 's'}
        </span>
        <span className="hint">Ticket IDs are allocated automatically when you save.</span>
      </div>
    </>
  );
}
