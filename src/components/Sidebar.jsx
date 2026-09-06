import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { ISSUER } from '../lib/schema.js';
import {
  clampWidth, storedWidth, rememberWidth, widthForKey,
  MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH,
} from '../lib/sidebar.js';
import { listPendingRequests } from '../lib/publicdb.js';

const LINKS = [
  { to: '/console', label: 'Console', end: false },
  { to: '/records', label: 'Records', end: true },
  { to: '/people', label: 'Students', end: false },
  { to: '/import', label: 'Import text', end: false },
  { to: '/new', label: 'Add manually', end: false },
];

/**
 * The admin navigation, down the left.
 *
 * It replaced a top masthead, which put the nav, the organisation, the signed
 * in address and the sign-out button on one line and left the content
 * whatever was over — on a board of grouped workshops, width is the thing
 * being spent.
 *
 * The count beside Console is the number of registration requests nobody has
 * looked at. It is the one number worth carrying in the furniture: everything
 * else can wait until a screen is opened, but a student who registered and
 * heard nothing cannot.
 */
export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [waiting, setWaiting] = useState(null);
  const [width, setWidth] = useState(() => storedWidth(globalThis.localStorage));

  // Applied as a custom property rather than an inline style, so the drawer's
  // own width on a narrow screen still wins — an inline style would beat the
  // media query and leave a 400px drawer over a 390px phone.
  useEffect(() => {
    document.documentElement.style.setProperty('--side-w', `${width}px`);
  }, [width]);

  const commit = useCallback((next) => {
    const w = clampWidth(next);
    setWidth(w);
    rememberWidth(globalThis.localStorage, w);
  }, []);

  /**
   * Dragging the right edge.
   *
   * Pointer events rather than mouse events, so it works from a trackpad, a
   * pen and a touchscreen with one code path. The pointer is captured, which
   * is what keeps the drag alive when it runs off the edge of the sidebar or
   * over an iframe — without it, a fast drag simply stops.
   */
  const onGripDown = (e) => {
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture?.(e.pointerId);
    document.body.classList.add('side-resizing');

    const move = (ev) => setWidth(clampWidth(ev.clientX));
    const up = (ev) => {
      grip.releasePointerCapture?.(ev.pointerId);
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      document.body.classList.remove('side-resizing');
      commit(ev.clientX);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  };

  const onGripKey = (e) => {
    const next = widthForKey(e.key, width);
    if (next === null) return;
    e.preventDefault();
    commit(next);
  };

  // Navigating closes the drawer. Without this it stays over the page the
  // link just opened, which on a phone hides the whole thing.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let live = true;
    listPendingRequests()
      .then((r) => live && setWaiting(r.length))
      .catch(() => { /* a badge is not worth an error message */ });
    return () => { live = false; };
  }, [isAdmin, pathname]);

  return (
    <>
      <button
        type="button"
        className="side-open no-print"
        aria-expanded={open}
        aria-controls="sidenav"
        onClick={() => setOpen((v) => !v)}
      >
        ☰ Menu
      </button>

      {/* Clicking away closes it — the usual way out of a drawer. */}
      {open && <div className="side-scrim no-print" onClick={() => setOpen(false)} aria-hidden="true" />}

      <nav id="sidenav" className={`side no-print${open ? ' open' : ''}`} aria-label="Sections">
        <Link to="/" className="side-brand">
          WORKSHOPS
          <small>{ISSUER.unitLine}</small>
        </Link>

        {isAdmin && (
          <ul className="side-nav">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className="side-link">
                  <span>{l.label}</span>
                  {l.to === '/console' && waiting > 0 && (
                    <b className="side-badge" title={`${waiting} registration requests waiting`}>
                      {waiting}
                    </b>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        {!isAdmin && (
          <ul className="side-nav">
            <li><NavLink to="/verify" className="side-link"><span>Verify a certificate</span></NavLink></li>
          </ul>
        )}

        <span className="spacer" />

        {/* Not rendered on the narrow-screen drawer — CSS hides it there —
            but harmless to keep in the tree either way. */}
        <div
          className="side-grip"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the sidebar"
          aria-valuenow={width}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          tabIndex={0}
          onPointerDown={onGripDown}
          onKeyDown={onGripKey}
          onDoubleClick={() => commit(DEFAULT_WIDTH)}
          title="Drag to resize · double-click to reset"
        />

        {user && (
          <div className="side-foot">
            <div className="who">{user.email}</div>
            <button className="small" onClick={logout}>Sign out</button>
          </div>
        )}
      </nav>
    </>
  );
}
