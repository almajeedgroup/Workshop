import { Link } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { IconPhone, IconMail, IconPin, IconQr, IconArrow } from '../../components/site/Icons.jsx';

export default function ContactPage() {
  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div style={{ maxWidth: 720 }} data-reveal>
            <span className="eyebrow">Contact</span>
            <h1 className="display" style={{ fontSize: 'clamp(32px,5vw,56px)' }}>Get in touch</h1>
            <div className="tri" style={{ marginTop: 22 }}><i /><i /><i /></div>
            <p className="lede" style={{ marginTop: 22 }}>
              For programme dates, registration, or anything about a certificate — a phone call
              is usually quickest.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="grid g3">
            <div className="card" data-reveal>
              <div className="ico"><IconPhone /></div>
              <h3>Call or WhatsApp</h3>
              <p style={{ marginBottom: 14 }}>Enquiries and registration, during the day.</p>
              {ISSUER.phones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p.replace(/\s/g, '')}`}
                  style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', padding: '5px 0' }}
                >
                  {p}
                </a>
              ))}
            </div>

            <div className="card" data-reveal style={{ transitionDelay: '70ms' }}>
              <div className="ico"><IconMail /></div>
              <h3>Email</h3>
              <p style={{ marginBottom: 14 }}>For anything that needs a written record.</p>
              <a
                href={`mailto:${ISSUER.email}`}
                style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {ISSUER.email}
              </a>
            </div>

            <div className="card" data-reveal style={{ transitionDelay: '140ms' }}>
              <div className="ico"><IconPin /></div>
              <h3>Where we are</h3>
              <p style={{ marginBottom: 14 }}>Programmes run at partner campuses.</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{ISSUER.city}</p>
              <p style={{ marginTop: 8, fontSize: 14 }}>Kabir IND PU College for Women, and others.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="band-soft">
        <div className="wrap">
          <div className="grid g2" style={{ alignItems: 'center' }}>
            <div data-reveal>
              <span className="eyebrow">Checking a certificate?</span>
              <h2>You do not need us for that</h2>
              <p className="lede" style={{ marginTop: 16 }}>
                Verification is instant and public. Enter the ID from the certificate, or scan
                its QR code — there is no need to write in and wait for a reply.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
                <Link className="btn" to="/verify">Verify a certificate <IconArrow /></Link>
                <Link className="btn ghost" to="/certificates">How it works</Link>
              </div>
            </div>
            <div className="card" data-reveal style={{ textAlign: 'center' }}>
              <div className="ico green" style={{ margin: '0 auto 16px' }}><IconQr /></div>
              <h3>Every certificate carries a QR code</h3>
              <p style={{ marginTop: 10 }}>
                Point a phone camera at it and the verification page opens on that exact
                certificate.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <h2>{ISSUER.site}</h2>
            <p>
              {ISSUER.operator} · {ISSUER.unitLine}
            </p>
            <div className="actions">
              <a className="btn light" href={`tel:${ISSUER.phones[0].replace(/\s/g, '')}`}>
                Call {ISSUER.phones[0]}
              </a>
              <a
                className="btn ghost"
                href={`mailto:${ISSUER.email}`}
                style={{ color: '#fff', boxShadow: 'inset 0 0 0 1.6px rgba(255,255,255,.45)' }}
              >
                Email us
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
