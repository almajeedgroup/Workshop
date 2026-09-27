import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CERTIFICATE_TYPES } from '../../lib/certificates.js';
import { IconShield, IconCheck, IconArrow, IconCheckCircle } from '../../components/site/Icons.jsx';

const BLURB = {
  completion: 'Awarded on finishing a programme in full, having done the work it asked for.',
  participation: 'Awarded for taking part — recognising the time and interest brought to every session.',
  excellence: 'Awarded where the work went well beyond what the programme required.',
  appreciation: 'Presented to those whose contribution made a programme possible.',
};

/** The three letters that go into an ID, so the poster shows a real one. */
const CODE = {
  completion: 'COM', participation: 'PAR', excellence: 'EXC', appreciation: 'APP',
};

const THUMB = ['lime', 'soft', 'stone', 'ink'];

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
      {/* ---------------- hero ---------------- */}
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <span className="ann flat"><b>Certificates</b> Checked by anyone, in seconds</span>

            <h1 className="display-lead">
              Proof that<br /><em>stands up</em>
            </h1>

            <p className="lede">
              Anyone can print a certificate. Ours carries a unique ID and a QR code tied to a
              register — so whoever is checking never has to take anybody&rsquo;s word for it.
            </p>

            <div className="capture">
              <form onSubmit={verify}>
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="Certificate ID, e.g. AIHOW26-COM-001"
                  aria-label="Certificate ID"
                />
                <button className="btn cta" type="submit">Verify <IconArrow /></button>
              </form>
              <div className="trust-strip">
                <span>The ID is printed at the bottom left of the certificate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- the four awards ---------------- */}
      <section className="band paper" id="awards" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Four kinds of <em>certificate</em></h2>
            <p>One design, four things it can say. Which one you receive depends on what you did.</p>
          </div>

          <div className="posters mt-7">
            {CERTIFICATE_TYPES.map((t, i) => (
              <article className="pc" key={t.key} data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <div className={`thumb ${THUMB[i % THUMB.length]}`}>
                  <span className="kick">{CODE[t.key] || '—'}</span>
                  <span className="big">{t.label}</span>
                </div>
                <div className="cap">
                  <b>{t.title}</b>
                  <p>{BLURB[t.key]}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- how verification works ---------------- */}
      <section className="band dark" id="how" data-tone="dark">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Verification, in <em>three</em> steps</h2>
            <p>No account, no fee, no waiting on us to reply to an email.</p>
          </div>

          <div className="grid g3 mt-7" data-reveal>
            {[
              { t: 'Find the ID', d: 'Every certificate carries an ID at the bottom left, like AIHOW26-COM-001, and a QR code beside it.' },
              { t: 'Enter or scan it', d: 'Type the ID into the verification page, or point a phone camera at the QR code, which opens the same page.' },
              { t: 'Read the answer', d: 'The page says plainly whether it is genuine, withdrawn, or was never issued — and shows what the award was for.' },
            ].map((s, i) => (
              <div className="steps" key={s.t}>
                <div className="step">
                  <span className="num">{i + 1}</span>
                  <div>
                    <h3>{s.t}</h3>
                    <p className="t-base mt-1">{s.d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bento mt-8">
            <div className="bt half" data-reveal>
              <div className="ico mb-4"><IconCheckCircle /></div>
              <h3>What verification shows</h3>
              <ul className="ticks">
                {['The name it was awarded to', 'Which award, and for which programme',
                  'The dates of the programme and when it was issued',
                  'Anything else the same person has been awarded'].map((t) => (
                  <li key={t}><IconCheck width="16" height="16" />{t}</li>
                ))}
              </ul>
            </div>

            <div className="bt half" data-reveal>
              <div className="ico mb-4"><IconShield /></div>
              <h3>What it never shows</h3>
              <p className="t-base mt-2">A certificate is public by design. What sits behind it is not.</p>
              <ul className="ticks">
                {['No phone number', 'No date of birth', 'No email or postal address',
                  'No way to search the register by name'].map((t) => (
                  <li key={t}><IconCheck width="16" height="16" />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- withdrawn ---------------- */}
      <section className="band light" data-tone="light">
        <div className="wrap">
          <div className="head left" data-reveal>
            <h2>Withdrawn certificates <em>say so</em></h2>
            <p>
              A missing record looks like a mistake. A marked one tells the truth.
            </p>
          </div>

          <div className="bento mt-7">
            <div className="bt wide" data-reveal>
              <p className="t-lg" style={{ lineHeight: 1.78 }}>
                If a certificate is ever withdrawn, its record is not deleted. It stays
                readable and is plainly marked as withdrawn — because a copy already in
                circulation should check as <em>withdrawn</em>, not as <em>not found</em>.
              </p>
              <span className="tile-foot">
                <Link className="btn ghost sm" to="/verify">Try the checker <IconArrow /></Link>
              </span>
            </div>

            <div className="bt stone" data-reveal>
              <h3>Three possible answers</h3>
              <ul className="ticks">
                <li><IconCheck width="16" height="16" /><strong>Genuine</strong> — issued by us and still valid.</li>
                <li><IconCheck width="16" height="16" /><strong>Withdrawn</strong> — since revoked, not to be relied on.</li>
                <li><IconCheck width="16" height="16" /><strong>Not found</strong> — never issued with that ID.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- closing ---------------- */}
      <section className="band paper tight" data-tone="light">
        <div className="wrap">
          <div className="cta-panel" data-reveal>
            <h2>Check a<br /><span className="bloom">certificate</span></h2>
            <div className="capture">
              <form onSubmit={verify}>
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. AIHOW26-COM-001"
                  aria-label="Certificate ID"
                />
                <button className="btn cta" type="submit">Verify <IconArrow /></button>
              </form>
              <div className="trust-strip">
                <IconShield width="15" height="15" />
                <span>No phone numbers or dates of birth are ever shown</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
