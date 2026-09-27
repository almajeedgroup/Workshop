import { Link } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { CRESTS, SIGNATORIES } from '../../lib/certificates.js';
import { BRAND_NAME } from '../../lib/brand.js';
import { IconCheck, IconArrow, IconPin, IconUsers } from '../../components/site/Icons.jsx';

export default function AboutPage() {
  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <span className="ann flat"><b>About</b> {ISSUER.city}</span>

            <h1 className="display-lead">
              Understanding shows up<br />in what you can <em>make</em>
            </h1>

            <p className="lede">
              {ISSUER.operator} teaches research method, artificial intelligence and
              innovation practice — working with {ISSUER.association} and partner
              institutions across {ISSUER.city}.
            </p>

            <div className="acts">
              <Link className="btn" to="/programmes">See the programmes <IconArrow /></Link>
              <Link className="btn ghost" to="/contact">Get in touch</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- what we believe ---------------- */}
      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="head left" data-reveal>
            <h2>What we <em>believe</em></h2>
          </div>

          <div className="bento mt-7">
            <div className="bt wide" data-reveal>
              <p className="t-xl" style={{ lineHeight: 1.7, fontWeight: 300 }}>
                A student who can recite how a language model works, and a student who has
                built something with one, do not know the same thing. We teach for the
                second kind of knowing.
              </p>
            </div>
            <div className="bt lime" data-reveal>
              <span className="bt-fig">Capped</span>
              <span className="tile-note">seats, so the room stays a workshop and nobody sits at the back</span>
              <span className="tile-foot"><span className="logo">In person</span></span>
            </div>

            <div className="bt stone" data-reveal>
              <span className="bt-fig">Backwards</span>
              <span className="tile-note">
                from an outcome the participant can show somebody — not forwards from a syllabus
              </span>
              <span className="tile-foot"><span className="logo">Every programme</span></span>
            </div>
            <div className="bt wide" data-reveal>
              <p className="t-xl" style={{ lineHeight: 1.7, fontWeight: 300 }}>
                It shapes the certificate too. A document that cannot be checked is a
                decoration. Ours carries an ID and a QR code linked to a register, so it
                keeps meaning something long after the programme ends.
              </p>
              <span className="tile-foot">
                <Link className="btn ghost sm" to="/certificates">How the certificates work <IconArrow /></Link>
              </span>
            </div>
          </div>

          <div className="panel mt-7" data-reveal>
            <h3>How we work</h3>
            <ul className="ticks" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))' }}>
              {[
                'Taught in person, in classrooms rather than webinars',
                'Seats capped so nobody sits at the back',
                'Built around a finished piece of work, not a syllabus',
                'Run with partner colleges and institutions',
                'Certified with a public, checkable record',
              ].map((t) => <li key={t}><IconCheck width="16" height="16" />{t}</li>)}
            </ul>
            <div className="panel-foot">
              <span><IconPin width="17" height="17" />{ISSUER.city}</span>
              <span><IconUsers width="17" height="17" />School and college students, and graduates</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- who we work with ---------------- */}
      <section className="band light" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Run <em>with</em> these institutions</h2>
            <p>Their names appear on every certificate we issue.</p>
          </div>
          <div className="logogrid mt-7" data-reveal>
            {CRESTS.map((c) => (
              <div className="cell" key={c.src}>
                <img src={c.src} alt={c.alt} style={{ height: 64, width: 'auto' }} />
                <small>{c.alt}</small>
              </div>
            ))}
            <div className="cell feature">
              <span className="name">{BRAND_NAME}</span>
              <small>The system all of it runs on</small>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- signatories ---------------- */}
      <section className="band dark" data-tone="dark">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Who <em>signs</em> our certificates</h2>
            <p>
              Every certificate carries these three offices, each marked verified against the
              register rather than signed by hand.
            </p>
          </div>
          <div className="bento mt-7">
            {SIGNATORIES.map((s, i) => (
              <div className="bt" key={s.name} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="kick">{s.role}</span>
                <h3 className="mt-2">{s.name}</h3>
                <span className="tile-note">{s.org}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- closing ---------------- */}
      <section className="band paper tight" data-tone="light">
        <div className="wrap">
          <div className="cta-panel" data-reveal>
            <h2>Come and<br /><span className="bloom">build something</span></h2>
            <p className="t-lg" style={{ maxWidth: '44ch', margin: 'var(--sp-5) auto 0', color: 'var(--ink)' }}>
              Our programmes are open to school and college students, and to graduates.
            </p>
            <div className="acts">
              <Link className="btn light" to="/programmes">See the programmes <IconArrow /></Link>
              <Link className="btn ghost" to="/contact">Get in touch</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
