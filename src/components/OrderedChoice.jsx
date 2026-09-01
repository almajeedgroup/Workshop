/**
 * Pick several options AND arrange them.
 *
 * A plain tick-list stores a set, and a set has no order — so whatever it
 * fed could only ever be printed in some order the code chose. Here the
 * chosen options are a list you rearrange, and the stored array is exactly
 * what gets printed, left to right.
 *
 * Chosen items sit in a numbered row with move and remove controls; the rest
 * wait underneath. Everything is a real button, so it all works from the
 * keyboard.
 */
export default function OrderedChoice({ value, options, labels = {}, previews = {}, onChange }) {
  const chosen = Array.isArray(value) ? value.filter((k) => options.includes(k)) : [];
  const rest = options.filter((k) => !chosen.includes(k));
  const label = (k) => labels[k] ?? k;

  const move = (i, by) => {
    const to = i + by;
    if (to < 0 || to >= chosen.length) return;
    const next = [...chosen];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  return (
    <div className="pick">
      {chosen.length === 0 ? (
        <p className="pick-empty">
          Nothing chosen, so all {options.length} will be printed in the order
          they are listed here. Add them one by one to set your own order.
        </p>
      ) : (
        <ol className="pick-list">
          {chosen.map((key, i) => (
            <li key={key} className="pick-row">
              <span className="pick-n">{i + 1}</span>
              {previews[key] && <img src={previews[key]} alt="" className="pick-img" />}
              <span className="pick-label">{label(key)}</span>
              <span className="spacer" />
              <button
                type="button" className="small" disabled={i === 0}
                aria-label={`Move ${label(key)} earlier`}
                onClick={() => move(i, -1)}
              >
                ←
              </button>
              <button
                type="button" className="small" disabled={i === chosen.length - 1}
                aria-label={`Move ${label(key)} later`}
                onClick={() => move(i, 1)}
              >
                →
              </button>
              <button
                type="button" className="small"
                aria-label={`Remove ${label(key)}`}
                onClick={() => onChange(chosen.filter((k) => k !== key))}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <div className="pick-add">
          {rest.map((key) => (
            <button
              key={key} type="button" className="small"
              onClick={() => onChange([...chosen, key])}
            >
              + {label(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
