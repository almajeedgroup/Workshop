import { useEffect, useId, useRef, useState } from 'react';

/**
 * A navigation item that opens a panel under the bar.
 *
 * ── WHY IT IS A BUTTON AND NOT A LINK ────────────────────────────────────
 * The thing you click does not navigate; it reveals. A link that does not
 * go anywhere is announced as a link, offered to a screen reader as a
 * destination, and opened in a new tab by anyone who middle-clicks it. The
 * panel holds the real links, and the button's own destination is offered
 * inside it as the first row.
 *
 * ── HOVER IS AN EXTRA, NEVER THE MECHANISM ───────────────────────────────
 * It opens on hover because on a wide screen that is what people expect,
 * and on click because hover does not exist on a touchscreen and is not
 * available to a keyboard at all. Both paths set the same state.
 *
 * The close-on-leave is delayed. The panel hangs below the bar with a gap
 * between them, and a pointer travelling from the word to the row it wants
 * crosses that gap — closing on the first `mouseleave` shuts the menu
 * under the pointer halfway to its target.
 */
export default function NavMenu({ label, to, children, onNavigate }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const timer = useRef(0);
  const id = useId();

  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const hide = (delay = 140) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // Escape closes and returns focus to the button; a click anywhere else
  // closes without stealing it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      wrap.current?.querySelector('button')?.focus();
    };
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div
      className={`has-menu${open ? ' open' : ''}`}
      ref={wrap}
      onMouseEnter={show}
      onMouseLeave={() => hide()}
      /* Tabbing out of the last row must close it. `focusout` fires before
         focus lands, so the new target is read from relatedTarget. */
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget)) setOpen(false); }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="menu" id={id} hidden={!open}>
        <div className="menu-in" onClick={() => { setOpen(false); onNavigate?.(); }}>
          {children({ to, close: () => setOpen(false) })}
        </div>
      </div>
    </div>
  );
}
