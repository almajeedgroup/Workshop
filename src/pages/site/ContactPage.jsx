import { Link } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { brandLockup } from '../../lib/brand.js';
import { IconPhone, IconMail, IconPin, IconQr, IconArrow } from '../../components/site/Icons.jsx';

export default function ContactPage() {
  const tel = (p) => `tel:${p.replace(/\s/g, '')}`;

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <span className="ann flat"><b>Contact</b> {ISSUER.city}</span>

            <h1 className="display-lead">
              Get in <em>touch</em>
            </h1>

            <p className="lede">
              For programme dates, registration, or anything about a certificate — a phone
              call is usually quickest.
            </p>

            <div className="acts">
              <a className="btn" href={tel(ISSUER.phones[0])}>Call {ISSUER.phones[0]} <IconArrow /></a>
              <a className="btn ghost" href={`mailto:${ISSUER.email}`}>Email us</a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- the three ways ---------------- */}
      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Three ways to <em>reach</em> us</h2>
          </div>

          <div className="bento mt-7">
            <div className="bt lime" data-reveal>
              <span className="kick" style={{ color: 'var(--ink)' }}>Call or WhatsApp</span>
              <div className="bigline">
                {ISSUER.phones.map((p) => (
                  <a key={p} href={tel(p)}><IconPhone width="16" height="16" />{p}</a>
                ))}
              </div>
              <span className="tile-foot"><span className="tile-note">Enquiries and registration, during the day.</span></span>
            </div>

            <div className="bt soft" data-reveal style={{ transitionDelay: '70ms' }}>
              <span className="kick" style={{ color: 'var(--ink)' }}>Email</span>
              <div className="bigline">
                <a href={`mailto:${ISSUER.email}`}>
                  <IconMail width="16" height="16" />{ISSUER.email}
                </a>
              </div>
              <span className="tile-foot"><span className="tile-note">For anything that needs a written record.</span></span>
            </div>

            <div className="bt stone" data-reveal style={{ transitionDelay: '140ms' }}>
              <span className="kick" style={{ color: 'var(--ink)' }}>Where we are</span>
              <div className="bigline">
                <span><IconPin width="16" height="16" />{ISSUER.city}</span>
              </div>
              <span className="tile-foot">
                <span className="tile-note">
                  Programmes run at partner campuses — Kabir IND PU College for Women, and others.
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- you do not need us ---------------- */}
      <section className="band dark" data-tone="dark">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Checking a certificate? You do <em>not</em> need us</h2>
            <p>
              Verification is instant and public. Enter the ID from the certificate, or scan
              its QR code — there is no need to write in and wait for a reply.
            </p>
          </div>

          <div className="bento mt-7">
            <div className="bt lime" data-reveal>
              <span className="bt-fig"><IconQr width="40" height="40" /></span>
              <span className="tile-note">
                Every certificate carries a QR code. Point a phone camera at it and the
                verification page opens on that exact certificate.
              </span>
              <span className="tile-foot">
                <Link className="btn ghost sm" to="/verify">Verify a certificate <IconArrow /></Link>
              </span>
            </div>
            <div className="bt wide" data-reveal>
              <span className="bt-fig">Free</span>
              <span className="tile-note">
                No account, no fee, and nothing to install. The page says plainly whether a
                certificate is genuine, withdrawn, or was never issued.
              </span>
              <span className="tile-foot">
                <Link className="btn ghost sm" to="/certificates">How it works <IconArrow /></Link>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- closing ---------------- */}
      <section className="band paper tight" data-tone="light">
        <div className="wrap">
          <div className="cta-panel one-line" data-reveal>
            <h2><span className="bloom">{ISSUER.site}</span></h2>
            <p className="t-lg" style={{ margin: 'var(--sp-5) auto 0', color: 'var(--ink)' }}>
              {brandLockup()} · {ISSUER.association}
            </p>
            <div className="acts">
              <a className="btn light" href={tel(ISSUER.phones[0])}>Call {ISSUER.phones[0]}</a>
              <a className="btn ghost" href={`mailto:${ISSUER.email}`}>Email us</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
