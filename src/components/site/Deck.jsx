import { useId, useRef, useState } from 'react';

/**
 * A strip of tabs over one stage.
 *
 * Real tabs, so real tab semantics: the strip is ONE tab stop and the
 * arrow keys move between the options inside it. The alternative — five
 * tabbable buttons — makes a keyboard user press Tab four times to reach
 * the fifth option and four more to get past the strip, on every page
 * visit, which is the thing the roving tabindex exists to prevent.
 *
 * Only the selected panel is rendered. These panels hold links, and a
 * hidden panel full of links is a tab order full of destinations nobody
 * can see.
 */
export default function Deck({ tabs, children, label = 'Sections' }) {
  const [at, setAt] = useState(0);
  const uid = useId();
  const btns = useRef([]);

  const go = (i) => {
    const n = (i + tabs.length) % tabs.length;
    setAt(n);
    btns.current[n]?.focus();
  };

  const onKey = (e) => {
    const map = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    go(map[e.key]);
  };

  return (
    <div className="deck">
      <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button
            type="button"
            key={t.key}
            id={`${uid}-t${i}`}
            ref={(el) => { btns.current[i] = el; }}
            role="tab"
            aria-selected={i === at}
            aria-controls={`${uid}-s${i}`}
            tabIndex={i === at ? 0 : -1}
            onClick={() => setAt(i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="stage" role="tabpanel" id={`${uid}-s${at}`} aria-labelledby={`${uid}-t${at}`} tabIndex={-1}>
        {children(tabs[at], at)}
      </div>
    </div>
  );
}
