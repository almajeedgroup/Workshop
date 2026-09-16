import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { brandLockup } from '../../lib/brand.js';
import { FEATURE_GROUPS, featurePath, featuresInGroup } from '../../lib/features.js';
import Wordmark from '../Wordmark.jsx';
import NavMenu from './NavMenu.jsx';
import FeatureIcon from './FeatureIcon.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/programmes', label: 'Programmes' },
  { to: '/features', label: 'Features', menu: true },
  { to: '/certificates', label: 'Certificates' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

/* The three programmes, for the Programmes panel. Titles only — the page
   itself carries what each one covers. */
const PROGRAMMES = [
  { to: '/programmes#ai', n: '01', name: 'Artificial Intelligence, hands on',
    sub: 'Six days building working AI assistants.' },
  { to: '/programmes#research', n: '02', name: 'Research methodology',
    sub: 'Ask well, gather honestly, write clearly.' },
  { to: '/programmes#innovation', n: '03', name: 'Innovation practice',
    sub: 'The part where something actually gets finished.' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  /**
   * One question: has the page moved?
   *
   * The bar stays put and stays itself — same width, same place, same two
   * buttons. All this decides is whether it has a GROUND under it. At the
   * top of a page it sits on the hero and needs none; once content is
   * passing beneath it, it needs to be opaque or the words run together.
   *
   * It is not the old capsule. That was a second, differently-shaped bar
   * that floated over the page and covered things up, which is what was
   * wrong with it. There is one bar, and it gains a background.
   */
  const [grounded, setGrounded] = useState(false);
  useEffect(() => {
    const read = () => setGrounded(window.scrollY > 8);
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; read(); });
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return (
    <header className={`hdr${grounded ? ' grounded' : ''}`}>
      <div className="wrap">
        <div className="bar">
          {/* WORKSHOP is the brand here, and the wordmark is the whole of
              it — no crest beside it and no by-line under it. The school
              is named in the footer, where a lockup has room to introduce
              itself; a navigation bar is not an introduction. */}
          <Link to="/" className="mark" aria-label={`${brandLockup()} — home`}>
            <Wordmark className="txt" />
          </Link>

          <nav className="nav" aria-label="Main">
            {LINKS.map((l) => {
              if (l.label === 'Features') {
                return (
                  <NavMenu key={l.to} label={l.label} to={l.to}>
                    {() => (
                      <div className="mega">
                        {FEATURE_GROUPS.map((g) => (
                          <div className="col" key={g.key}>
                            <h3>{g.label}</h3>
                            {featuresInGroup(g.key).map((f) => (
                              <Link key={f.slug} to={featurePath(f)}>
                                <span className="fi"><FeatureIcon name={f.icon} width="17" height="17" /></span>
                                <span>
                                  <strong>{f.name}</strong>
                                  <em>{f.tagline}</em>
                                </span>
                              </Link>
                            ))}
                          </div>
                        ))}
                        <div className="menu-foot">
                          <Link to="/features">Every feature, on one page</Link>
                          <Link to="/verify">Verify a certificate</Link>
                        </div>
                      </div>
                    )}
                  </NavMenu>
                );
              }
              if (l.label === 'Programmes') {
                return (
                  <NavMenu key={l.to} label={l.label} to={l.to}>
                    {() => (
                      <div className="mega one">
                        <div className="col">
                          <h3>What we teach</h3>
                          {PROGRAMMES.map((p) => (
                            <Link key={p.to} to={p.to}>
                              <span className="fi num">{p.n}</span>
                              <span>
                                <strong>{p.name}</strong>
                                <em>{p.sub}</em>
                              </span>
                            </Link>
                          ))}
                        </div>
                        <div className="menu-foot">
                          <Link to="/programmes">All three, in detail</Link>
                          <Link to="/contact">Ask about the next intake</Link>
                        </div>
                      </div>
                    )}
                  </NavMenu>
                );
              }
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => (isActive ? 'on' : undefined)}
                >
                  {l.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="nav-acts">
            <Link className="btn sm ghost" to="/login">Sign in</Link>
            <Link className="btn sm cta" to="/verify">Verify a certificate</Link>
          </div>

          <button
            type="button"
            className="burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="site-drawer"
            onClick={() => setOpen((o) => !o)}
          >
            <i />
          </button>
        </div>

        <div id="site-drawer" className={`drawer${open ? ' open' : ''}`}>
          <nav aria-label="Mobile">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? 'on' : undefined)}
              >
                {l.label}
              </NavLink>
            ))}
            <Link className="btn" to="/verify">Verify a certificate</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
