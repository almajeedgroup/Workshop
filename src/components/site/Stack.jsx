import { useId, useRef, useState } from 'react';

/**
 * A column of panels where one is open at a time.
 *
 * This is a disclosure set, not a tab set, and the difference matters for
 * what it announces: each lip is a button that owns the region under it,
 * says whether that region is expanded, and points at it by id. A screen
 * reader then reads "Artificial intelligence, hands on, collapsed, button"
 * — which is the truth — rather than "tab 1 of 3", which would promise
 * arrow-key navigation this pattern does not have.
 *
 * `start` is which index is open on arrival. Something has to be: a stack
 * of three closed lips looks like a list that failed to load, and the
 * first panel's content is the page's first real paragraph.
 *
 * Passing `start={-1}` opens nothing, for a FAQ where every question is
 * equal.
 */
export default function Stack({ items, start = 0 }) {
  const [open, setOpen] = useState(start);
  const uid = useId();
  const lips = useRef([]);

  /* Up and down walk the lips. Not required for a disclosure set, but the
     panels here are long enough that finding the next lip means scrolling
     past a screen of prose, and the arrow keys are free. */
  const onKey = (e, i) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + items.length) % items.length;
    lips.current[next]?.focus();
  };

  return (
    <div className="stack">
      {items.map((it, i) => {
        const on = i === open;
        const pid = `${uid}-p${i}`;
        const bid = `${uid}-b${i}`;
        return (
          <section className={`pan${on ? ' on' : ''}`} key={it.key ?? i}>
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                className="lip"
                id={bid}
                ref={(el) => { lips.current[i] = el; }}
                aria-expanded={on}
                aria-controls={pid}
                onClick={() => setOpen(on ? -1 : i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="n" aria-hidden="true">{it.n ?? String(i + 1).padStart(2, '0')}</span>
                <span className="t">
                  <b>{it.title}</b>
                  {it.sub ? <small>{it.sub}</small> : null}
                </span>
                <Chev />
              </button>
            </h3>

            {/* The region stays in the tree whether it is open or not. Its
                height is animated to zero, and `hidden` would fight that —
                so it is `inert` instead when closed, which takes it out of
                the tab order and off the accessibility tree without
                touching layout. */}
            <div className="body" id={pid} role="region" aria-labelledby={bid} inert={on ? undefined : ''}>
              <div className="in"><div className="pad">{it.body}</div></div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Chev() {
  return (
    <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
