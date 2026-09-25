import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';


/**
 * Wraps every public page: header, footer, scroll restoration, and motion.
 *
 * Motion is opt-in per element via `data-reveal` and is driven by
 * src/lib/motion.js. It is skipped entirely when the visitor has asked for
 * reduced motion — in which case everything is simply shown, rather than
 * shown differently.
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
   * Motion. Everything that moves lives in src/lib/motion.js; this starts it
   * for the page that is now rendered and stops it when that page goes. The
   * cleanup matters: a ScrollTrigger left behind after a route change keeps
   * measuring a page that no longer exists.
   *
   * GSAP is 48KB gzipped and only the public site uses it, so motion.js is
   * fetched on demand rather than bundled into the app everybody loads. The
   * admin tool never asks for it.
   *
   * That import is asynchronous, and the browser will happily paint the
   * finished page before it resolves — one frame of everything visible, then
   * it all disappears to animate in. So the starting state is set here,
   * synchronously in a LAYOUT effect, by adding a class; the CSS hides
   * [data-reveal] under it, and GSAP animates from there.
   *
   * The reduced-motion check has to happen before the class goes on, or a
   * visitor who asked for no motion gets a hidden page for as long as the
   * fetch takes.
   */
  useLayoutEffect(() => {
    const root = document.querySelector('.site');
    if (!root) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    root.classList.add('motion');
    let stop = null;
    let cancelled = false;

    import('../../lib/motion.js').then(({ startMotion }) => {
      if (cancelled) return;
      stop = startMotion(root);
    }).catch((err) => {
      // The page is worth more than the animation: if the chunk fails to load
      // or throws, drop the class and everything is simply visible.
      //
      // It is reported, not swallowed. A silent catch here hid a TDZ error in
      // motion.js for long enough to look like "the animation just does not
      // run", with a clean console and a 200 on the chunk.
      root.classList.remove('motion');
      console.error('motion failed to start', err);
    });

    return () => {
      cancelled = true;
      if (stop) stop();
      root.classList.remove('motion');
    };
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
