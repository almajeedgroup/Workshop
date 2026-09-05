import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CERTIFICATE_TYPES } from '../../lib/certificates.js';
import { IconQr, IconShield, IconCheck, IconArrow, IconAward, IconCheckCircle } from '../../components/site/Icons.jsx';

const BLURB = {
  completion: 'Awarded on finishing a programme in full, having done the work it asked for.',
  participation: 'Awarded for taking part — recognising the time and interest brought to every session.',
  excellence: 'Awarded where the work went well beyond what the programme required.',
  appreciation: 'Presented to those whose contribution made a programme possible.',
};

export default function CertificatesPage() {
  const nav = useNavigate();
  const [id, setId] = useState('');

  const verify = (e) => {
    e.preventDefault();
    const v = id.trim().toUpperCase();
    nav(v ? `/verify/${encodeURIComponent(v)}` : '/verify');
  };

  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div className="hero-grid">
            <div data-reveal>
              <span className="eyebrow">Certificates</span>
              <h1 className="display" style={{ fontSize: 'clamp(32px,5vw,56px)' }}>
                Proof that<br /><span className="accent">stands up.</span>
              </h1>
              <div className="tri" style={{ marginTop: 22 }}><i /><i /><i /></div>
              <p className="lede" style={{ marginTop: 22 }}>
                Anyone can print a certificate. Ours carries a unique ID and a QR code tied to a
                register — so whoever is checking never has to take anybody's word for it.
              </p>
            </div>

            <div className="vcard" data-reveal>
              <div className="ico green" style={{ marginBottom: 16 }}><IconQr /></div>
              <h3>Check one now</h3>
              <p>The ID is printed at the bottom left of the certificate.</p>
              <form onSubmit={verify}>
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. AIHOW26-COM-001"
                  aria-label="Certificate ID"
                />
                <button className="btn" type="submit">Verify <IconArrow /></button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* the four awards */}
      <section id="awards">
        <div className="wrap">
          <div className="shead" data-reveal>
            <span className="eyebrow">The awards</span>
            <h2>Four kinds of certificate</h2>
            <p className="lede">
              One design, four things it can say. Which one you receive depends on what you did.
            </p>
          </div>

          <div className="grid g4">
            {CERTIFICATE_TYPES.map((t, i) => (
              <article className="card" key={t.key} data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="ico"><IconAward /></div>
                <h3>{t.label}</h3>
                <p>{BLURB[t.key]}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* how verification works */}
      <section id="how" className="band-dark">
        <div className="wrap">
          <div className="shead" data-reveal>
            <span className="eyebrow">How it works</span>
            <h2>Verification, in three steps</h2>
            <p className="lede" style={{ color: '#A9B4C9' }}>
              No account, no fee, no waiting on us to reply to an email.
            </p>
          </div>

          <div className="steps grid g3" data-reveal>
            {[
              { t: 'Find the ID', d: 'Every certificate carries an ID at the bottom left, like AIHOW26-COM-001, and a QR code beside it.' },
              { t: 'Enter or scan it', d: 'Type the ID into the verification page, or point a phone camera at the QR code, which opens the same page.' },
              { t: 'Read the answer', d: 'The page says plainly whether it is genuine, withdrawn, or was never issued — and shows what the award was for.' },
            ].map((s, i) => (
              <div className="step" key={s.t}>
                <span className="num">{i + 1}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p style={{ fontSize: 14.5, marginTop: 6 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid g2" style={{ marginTop: 'calc(var(--gap) * 1.6)' }}>
            <div className="card" data-reveal>
              <div className="ico"><IconCheckCircle /></div>
              <h3>What verification shows</h3>
              <ul className="ticks">
                {['The name it was awarded to', 'Which award, and for which programme',
                  'The dates of the programme and when it was issued',
                  'Anything else the same person has been awarded'].map((t) => (
                  <li key={t} style={{ color: '#A9B4C9' }}>
                    <IconCheck width="16" height="16" style={{ color: '#4ED17F' }} />{t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card" data-reveal>
              <div className="ico"><IconShield /></div>
              <h3>What it never shows</h3>
              <p style={{ marginBottom: 14 }}>
                A certificate is public by design. What sits behind it is not.
              </p>
              <ul className="ticks">
                {['No phone number', 'No date of birth', 'No email or postal address',
                  'No way to search the register by name'].map((t) => (
                  <li key={t} style={{ color: '#A9B4C9' }}>
                    <IconCheck width="16" height="16" style={{ color: '#4ED17F' }} />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* withdrawn */}
      <section className="band-soft">
        <div className="wrap">
          <div className="grid g2" style={{ alignItems: 'center' }}>
            <div data-reveal>
              <span className="eyebrow">Honesty</span>
              <h2>Withdrawn certificates say so</h2>
              <p className="lede" style={{ marginTop: 16 }}>
                If a certificate is ever withdrawn, its record is not deleted. It stays
                readable and is plainly marked as withdrawn — because a copy already in
                circulation should check as <em>withdrawn</em>, not as <em>not found</em>.
              </p>
              <p style={{ marginTop: 16, fontSize: 15.5 }}>
                A missing record looks like a mistake. A marked one tells the truth.
              </p>
            </div>
            <div className="card" data-reveal style={{ borderColor: 'rgba(221,73,1,.25)', background: 'var(--saffron-wash)' }}>
              <h3 style={{ color: 'var(--saffron-2)' }}>Three possible answers</h3>
              <ul className="ticks" style={{ marginTop: 16 }}>
                <li><IconCheck width="16" height="16" /><strong>Genuine</strong> — issued by us and still valid.</li>
                <li><IconCheck width="16" height="16" /><strong>Withdrawn</strong> — was issued, since revoked, and should not be relied on.</li>
                <li><IconCheck width="16" height="16" /><strong>Not found</strong> — no certificate with that ID was ever issued.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="tight">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <h2>Verify a certificate</h2>
            <p>Takes a few seconds. Nothing to install, nothing to sign up for.</p>
            <div className="actions">
              <Link className="btn light" to="/verify">Open the checker <IconArrow /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
