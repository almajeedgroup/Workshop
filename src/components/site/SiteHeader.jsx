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
   * Two things, from one scroll handler: whether the bar has collapsed
   * into its floating capsule, and which tone of band is under it.
   *
   * WHY ELEMENT-UNDER-A-POINT AND NOT AN OBSERVER. A floating capsule has
   * to know what is behind it AT ITS OWN POSITION, not which section is
   * most visible. An IntersectionObserver answers the second question,
   * and on a page of full-height bands the answer is right for most of a
   * scroll and wrong at exactly the moment an edge passes under the
   * capsule — which is the moment it matters.
   *
   * So each band declares `data-tone` and this reads the one whose box
   * spans the capsule's centre line. A loop over a handful of elements on
   * a rAF, not a hit test on every node.
   */
  const [stuck, setStuck] = useState(false);
  const [tone, setTone] = useState('light');

  useEffect(() => {
    const read = () => {
      setStuck(window.scrollY > 12);

      const mid = 46;                       // roughly the capsule's centre
      let found = 'light';
      for (const band of document.querySelectorAll('.site [data-tone]')) {
        const r = band.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) found = band.dataset.tone;
      }
      setTone(found);
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; read(); });
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pathname]);

  return (
    <header className={`hdr${stuck ? ' stuck' : ''} over-${tone}`}>
      <div className="wrap">
        <div className="bar">
          {/* WORKSHOP is the brand here, and the wordmark is the whole of
              it — no crest beside it and no by-line under it. The school
              is named in the footer, where a lockup has room to introduce
              itself; a navigation bar is not an introduction. */}
          <Link to="/" className="mark" aria-label={`${brandLockup()} — home`}>
            {/* Inverted inside a dark capsule: the mark's WORK is ink and
                would disappear into it. */}
            <Wordmark className="txt" tone={stuck && tone === 'dark' ? 'invert' : 'brand'} />
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
            {/* The STUDENT door, not the administrator one. There is exactly
                one "sign in" a visitor of this site could want, and it is
                this: there are hundreds of students and three
                administrators, whose door stays in the footer where it has
                always been. */}
            <Link className="btn sm ghost" to="/study">Your courses</Link>
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
            <Link className="btn ghost" to="/study">Your courses</Link>
            <Link className="btn" to="/verify">Verify a certificate</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
