import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * A modal panel over the page.
 *
 * Used where opening something should not cost you your place — a ticket
 * looked at from the board is a glance, not a journey, and navigating away
 * means losing which groups were expanded and how far down you had scrolled.
 *
 * The things a dialog has to get right, all of which are easy to leave out:
 *
 *   - Escape closes it, and clicking the scrim closes it
 *   - focus moves into it when it opens and returns to whatever opened it
 *     when it closes, so the keyboard does not end up somewhere arbitrary
 *   - the page behind does not scroll while it is open
 *   - a click inside never reaches the scrim's handler
 *
 * Rendered through a portal onto <body> rather than in place. It has to sit
 * outside the shell's stacking context to be reliably above the sidebar, and
 * being a sibling of the shell is what lets printing hide the page behind and
 * print the dialog's own contents.
 */
export default function Overlay({ title, onClose, children, actions = null, wide = false }) {
  const panel = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    opener.current = document.activeElement;
    // The close button is the safe landing spot: it is always present, and
    // it means the first Tab goes forward through the panel rather than
    // starting from wherever the page happened to be.
    const first = panel.current?.querySelector('[data-autofocus]') || panel.current;
    first?.focus?.();

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Read by the print stylesheet, which hides the page behind so that
    // printing from a dialog prints what the dialog is showing.
    document.body.classList.add('overlay-open');

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      document.body.classList.remove('overlay-open');
      // Restoring focus matters most for somebody on a keyboard: without it
      // the next Tab starts from the top of the document.
      if (opener.current?.focus) opener.current.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="ov" onMouseDown={onClose}>
      <div
        className={`ov-panel${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        // Stops a click that began inside the panel from closing it — which
        // otherwise happens on any drag that ends over the scrim.
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="ov-head">
          <h2>{title}</h2>
          <span className="spacer" />
          {actions}
          <button type="button" data-autofocus onClick={onClose}>Close</button>
        </header>
        <div className="ov-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
