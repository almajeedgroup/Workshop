import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';

/**
 * Wraps every public page: header, footer, scroll restoration, and the
 * reveal-on-scroll effect.
 *
 * The reveal is opt-in per element via `data-reveal`, and is skipped entirely
 * when the visitor has asked for reduced motion — in which case everything is
 * simply shown, rather than shown differently.
 */
export default function PublicShell({ children }) {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  /**
   * Reveal on scroll.
   *
   * A sweep rather than an IntersectionObserver, deliberately: an observer
   * only reports what is intersecting *now*, so jumping down the page — an
   * anchor link, a flick-scroll on a phone — leaves everything in between
   * permanently invisible. This reveals anything at or above the fold on every
   * scroll, so nothing can be skipped.
   *
   * The `anim` class is what makes [data-reveal] hidden in the first place, and
   * it is added here, by script. If the script never runs, the page is simply
   * visible.
   */
  useEffect(() => {
    const root = document.querySelector('.site');
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!root || !nodes.length) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((n) => n.classList.add('in'));
      return undefined;
    }

    root.classList.add('anim');
    let waiting = nodes;
    let queued = false;

    const sweep = () => {
      queued = false;
      const limit = window.innerHeight * 0.92;
      waiting = waiting.filter((n) => {
        if (n.getBoundingClientRect().top >= limit) return true;
        n.classList.add('in');
        return false;
      });
      if (!waiting.length) detach();
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(sweep);
    };
    const detach = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    sweep();

    return () => { detach(); root.classList.remove('anim'); };
  }, [pathname]);

  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
