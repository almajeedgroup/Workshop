import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { ISSUER } from '../lib/schema.js';
import { listPendingRequests } from '../lib/publicdb.js';

const LINKS = [
  { to: '/console', label: 'Console', end: false },
  { to: '/records', label: 'Records', end: true },
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
