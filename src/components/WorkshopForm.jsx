import { WORKSHOP_FIELDS } from '../lib/schema.js';

/**
 * Renders one input per schema field. Because it loops over WORKSHOP_FIELDS,
 * adding a field to schema.js makes it appear here automatically.
 */
export default function WorkshopForm({ value, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });

  return (
    <div className="grid2">
      {WORKSHOP_FIELDS.map((f) => {
        const v = value[f.key];
        const id = `f-${f.key}`;
        const wide = f.type === 'longtext';

        return (
          <div
            className="field"
            key={f.key}
            style={wide ? { gridColumn: '1 / -1' } : undefined}
          >
            <div className={`lab${f.required ? ' req' : ''}`}>
              <label htmlFor={id}>{f.label}</label>
            </div>

            {f.type === 'longtext' && (
              <textarea id={id} rows={3} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            )}

            {f.type === 'enum' && (
              <select id={id} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">—</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {f.type === 'date' && (
              <input id={id} type="date" value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            )}

            {f.type === 'number' && (
              <input
                id={id}
                type="number"
                value={v === null || v === undefined ? '' : v}
                onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}

            {f.type === 'list' && (
              <>
                <input
                  id={id}
                  value={Array.isArray(v) ? v.join('; ') : (v ?? '')}
                  onChange={(e) =>
                    set(f.key, e.target.value.split(';').map((s) => s.trim()).filter(Boolean))
                  }
                />
                <div className="hint">Separate multiple entries with a semicolon.</div>
              </>
            )}

            {f.type === 'text' && (
              <input id={id} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
