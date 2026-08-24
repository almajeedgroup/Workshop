import { Link } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { CRESTS } from '../../lib/certificates.js';
import { SIGNATORIES } from '../../lib/certificates.js';
import { IconCheck, IconArrow, IconPin, IconUsers, IconBulb } from '../../components/site/Icons.jsx';

export default function AboutPage() {
  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div style={{ maxWidth: 760 }} data-reveal>
            <span className="eyebrow">About</span>
            <h1 className="display" style={{ fontSize: 'clamp(32px,5vw,56px)' }}>
              Who we are
            </h1>
            <div className="tri" style={{ marginTop: 22 }}><i /><i /><i /></div>
            <p className="lede" style={{ marginTop: 22 }}>
              Al-Majeed School of Research Methodology &amp; Innovation teaches research method,
              artificial intelligence and innovation practice — working with{' '}
              {ISSUER.unitLine} and partner institutions across {ISSUER.city}.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="grid g2" style={{ alignItems: 'start' }}>
            <div data-reveal>
              <span className="eyebrow">What we believe</span>
              <h2>Understanding shows up in what you can make</h2>
              <p style={{ marginTop: 18, fontSize: 16, lineHeight: 1.8 }}>
                A student who can recite how a language model works, and a student who has built
                something with one, do not know the same thing. We teach for the second kind of
                knowing.
              </p>
              <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.8 }}>
                That shapes everything: seats are capped so the room stays a workshop; sessions
                run in person; and every programme is built backwards from an outcome the
                participant can show somebody.
              </p>
              <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.8 }}>
                It shapes the certificate too. A document that cannot be checked is a decoration.
                Ours carries an ID and a QR code linked to a register, so it keeps meaning
                something long after the programme ends.
              </p>
            </div>

            <div className="card" data-reveal>
              <div className="ico"><IconBulb /></div>
              <h3>How we work</h3>
              <ul className="ticks">
                {[
                  'Taught in person, in classrooms rather than webinars',
                  'Seats capped so nobody sits at the back',
                  'Built around a finished piece of work, not a syllabus',
                  'Run with partner colleges and institutions',
                  'Certified with a public, checkable record',
                ].map((t) => <li key={t}><IconCheck width="16" height="16" />{t}</li>)}
              </ul>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--hair)', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 11 }}>
                  <IconPin width="18" height="18" style={{ color: 'var(--ink-faint)', flex: 'none', marginTop: 2 }} />
                  <span style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>{ISSUER.city}</span>
                </div>
                <div style={{ display: 'flex', gap: 11 }}>
                  <IconUsers width="18" height="18" style={{ color: 'var(--ink-faint)', flex: 'none', marginTop: 2 }} />
                  <span style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>School and college students, and graduates</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="band-soft">
        <div className="wrap">
          <div className="shead center" data-reveal>
            <span className="eyebrow">Together with</span>
            <h2>Who we work with</h2>
            <p className="lede">
              Programmes are run in association with these institutions, whose names appear on
              every certificate we issue.
            </p>
          </div>
          <div className="grid g4" data-reveal>
            {CRESTS.map((c) => (
              <div className="card" key={c.src} style={{ textAlign: 'center' }}>
                <img
                  src={c.src}
                  alt={c.alt}
                  style={{ height: 76, width: 'auto', margin: '0 auto 16px', display: 'block' }}
                />
                <h3 style={{ fontSize: 15 }}>{c.alt}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band-dark">
        <div className="wrap">
          <div className="shead" data-reveal>
            <span className="eyebrow">Signatories</span>
            <h2>Who signs our certificates</h2>
            <p className="lede" style={{ color: '#A9B4C9' }}>
              Every certificate carries these three offices, each marked verified against the
              register rather than signed by hand.
            </p>
          </div>
          <div className="grid g3">
            {SIGNATORIES.map((s, i) => (
              <div className="card" key={s.name} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <h3>{s.name}</h3>
                <p style={{ marginTop: 8, fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', color: '#FFA24D', fontWeight: 600 }}>
                  {s.role}
                </p>
                <p style={{ marginTop: 6 }}>{s.org}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <h2>Come and build something</h2>
            <p>Our programmes are open to school and college students, and to graduates.</p>
            <div className="actions">
              <Link className="btn light" to="/programmes">See the programmes <IconArrow /></Link>
              <Link className="btn ghost" to="/contact" style={{ color: '#fff', boxShadow: 'inset 0 0 0 1.6px rgba(255,255,255,.45)' }}>
                Get in touch
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
