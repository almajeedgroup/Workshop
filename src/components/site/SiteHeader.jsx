import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { brandLockup } from '../../lib/brand.js';
import Wordmark from '../Wordmark.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/programmes', label: 'Programmes' },
  { to: '/features', label: 'Features' },
  { to: '/certificates', label: 'Certificates' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [tone, setTone] = useState('light');
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  /**
   * Two things, both driven by one scroll handler: whether the bar has
   * collapsed into its floating pill, and which tone of band is underneath
   * it.
   *
   * WHY ELEMENT-UNDER-A-POINT AND NOT AN OBSERVER. A floating pill has to
   * know what is behind it AT ITS OWN POSITION, not which section happens
   * to be most visible. An IntersectionObserver answers the second
   * question, and on a page of full-height bands the answer is right for
   * most of the scroll and wrong at exactly the moment the edge passes
   * under the pill — which is the moment it matters.
   *
   * So each band declares `data-tone` and this reads the one whose box
   * spans the pill's centre line. It is a loop over a handful of elements
   * on a rAF, not a hit test on every node.
   */
  useEffect(() => {
    const read = () => {
      setStuck(window.scrollY > 12);

      const mid = 46;                       // roughly the pill's centre
      const bands = document.querySelectorAll('.site [data-tone]');
      let found = 'light';
      for (const band of bands) {
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
          {/* The mark alone, not the lockup: the by-line is 42 characters
              and put the bar 208px over its own width. It introduces the
              school in the footer, where there is room for it. */}
          <Link to="/" className="mark" aria-label={`${brandLockup()} — home`}>
            <img src="/crests/al-majeed.png" alt="" />
            <Wordmark className="txt t-2xl" />
          </Link>

          <nav className="nav" aria-label="Main">
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
