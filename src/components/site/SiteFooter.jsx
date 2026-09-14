import { Link } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { brandLockup } from '../../lib/brand.js';
import Wordmark from '../Wordmark.jsx';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="cols">
          <div>
            <div className="brand">
              <img src="/crests/al-majeed.png" alt="" />
              <Wordmark lockup tone="invert" className="t-2xl"  />
            </div>
            <p className="about">
              Research methodology, artificial intelligence and innovation practice —
              taught hands-on in {ISSUER.city}, and certified with a record anyone can check.
            </p>
            <div className="tri mt-5"><i /><i /><i /></div>
          </div>

          <div>
            <h4>Explore</h4>
            <Link to="/">Home</Link>
            <Link to="/programmes">Programmes</Link>
            <Link to="/features">Features</Link>
            <Link to="/certificates">Certificates</Link>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
          </div>

          <div>
            <h4>Certificates</h4>
            <Link to="/verify">Verify a certificate</Link>
            <Link to="/certificates#awards">The four awards</Link>
            <Link to="/certificates#how">How verification works</Link>
          </div>

          <div>
            <h4>Get in touch</h4>
            {ISSUER.phones.map((p) => (
              <a key={p} href={`tel:${p.replace(/\s/g, '')}`}>{p}</a>
            ))}
            <a href={`mailto:${ISSUER.email}`}>{ISSUER.email}</a>
            <a href={ISSUER.siteUrl}>{ISSUER.site}</a>
            <p className="about t-sm" style={{ marginTop: 12 }}>{ISSUER.city}</p>
          </div>
        </div>

        <div className="base">
          {/* `unitLine` already begins "by Al-Majeed…", so pairing it with
              `operator` printed the school's name twice in one sentence. */}
          <span>© {year} {brandLockup()}. In association with {ISSUER.association}.</span>
          <span>
            <Link to="/verify">Verify</Link>
            {' · '}
            <Link to="/login">Administrator sign-in</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
