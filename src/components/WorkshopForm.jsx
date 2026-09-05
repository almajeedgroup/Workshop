import { visibleWorkshopFields } from '../lib/schema.js';
import ImageField from './ImageField.jsx';
import OrderedChoice from './OrderedChoice.jsx';

/**
 * Renders one input per schema field. Because it loops over the schema,
 * adding a field to schema.js makes it appear here automatically.
 *
 * Fields carrying a `showWhen` appear only when it holds for the workshop
 * being edited — a free course has no fee to set and no QR to pay into, and
 * showing those boxes anyway is how a stale amount survives the switch.
 */
export default function WorkshopForm({ value, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });

  return (
    <div className="grid2">
      {visibleWorkshopFields(value).map((f) => {
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
                {f.options.map((o) => (
                  <option key={o} value={o}>{f.optionLabels?.[o] ?? o}</option>
                ))}
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

            {f.type === 'multi' && (
              <OrderedChoice
                value={v}
                options={f.options}
                labels={f.optionLabels}
                previews={f.optionPreviews}
                onChange={(nv) => set(f.key, nv)}
              />
            )}

            {f.type === 'image' && (
              <ImageField id={id} value={v ?? ''} onChange={(nv) => set(f.key, nv)} hint={f.hint} />
            )}

            {f.type === 'text' && (
              <input id={id} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            )}

            {/* ImageField renders its own hint, next to its preview. */}
            {f.hint && f.type !== 'image' && <div className="hint">{f.hint}</div>}
          </div>
        );
      })}
    </div>
  );
}
