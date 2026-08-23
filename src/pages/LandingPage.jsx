import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ISSUER } from '../lib/schema.js';
import { CERTIFICATE_TYPES, CRESTS } from '../lib/certificates.js';

/**
 * The public face of the school.
 *
 * Deliberately not the admin tool: no sign-in wall, nothing loaded from
 * Firestore, so it renders instantly and works even if the database is
 * unreachable. The one interactive thing on it is certificate verification,
 * which is what most visitors arrive to do.
 *
 * The copy below is a starting point — edit it freely; nothing else depends
 * on it.
 */
export default function LandingPage() {
  const nav = useNavigate();
  const [certId, setCertId] = useState('');

  const verify = (e) => {
    e.preventDefault();
    const id = certId.trim().toUpperCase();
    nav(id ? `/verify/${encodeURIComponent(id)}` : '/verify');
  };

  return (
    <div className="landing">
      <section className="lhero">
        <div className="lcrests">
          {CRESTS.map((c) => <img key={c.src} src={c.src} alt={c.alt} />)}
        </div>

        <div className="lkicker">{ISSUER.unitLine}</div>
        <h1>Al-Majeed School of<br />Research Methodology<br />&amp; Innovation</h1>
        <div className="ltri"><i /><i /><i /></div>

        <p className="llede">
          Hands-on programmes in research methodology, artificial intelligence and applied
          technology — taught in Bengaluru, built around work students actually make, and
          certified with a record anyone can check.
        </p>

        <div className="lcta">
          <a className="lbtn" href="#verify">Verify a certificate</a>
          <a className="lbtn ghost" href="#programmes">What we run</a>
        </div>
      </section>

      <section id="programmes">
        <h2>What we run</h2>
        <p className="lsub">
          Short, intensive, practical. Every programme ends with something the participant
          built themselves rather than a set of notes.
        </p>

        <div className="lgrid">
          <div className="lcard">
            <span className="lnum">01</span>
            <h3>Artificial Intelligence, hands on</h3>
            <p>
              AI concepts, prompt engineering, chatbot design and the web technologies
              around them — building working assistants for real domains rather than
              studying them in the abstract.
            </p>
          </div>
          <div className="lcard">
            <span className="lnum">02</span>
            <h3>Research methodology</h3>
            <p>
              How to frame a question, gather evidence that answers it, and write it up so
              somebody else can check your reasoning. The habits that outlast any one tool.
            </p>
          </div>
          <div className="lcard">
            <span className="lnum">03</span>
            <h3>Innovation practice</h3>
            <p>
              Turning an idea into something that exists — scoping, prototyping, and the
              unglamorous work of finishing. Run in association with partner institutions.
            </p>
          </div>
        </div>
      </section>

      <section className="lband" style={{ maxWidth: 'none' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <h2>Certificates that can be checked</h2>
          <p className="lsub lmuted" style={{ color: '#aab3c4' }}>
            Every certificate we award carries its own ID and a QR code. Anyone — a college,
            an employer, a parent — can confirm it in seconds, without an account and without
            contacting us.
          </p>

          <div className="lgrid">
            {CERTIFICATE_TYPES.map((t) => (
              <div className="lcard" key={t.key}>
                <h3>{t.title}</h3>
                <p>
                  {t.key === 'completion' && 'Awarded on finishing a programme in full, having done the work it asked for.'}
                  {t.key === 'participation' && 'Awarded for taking part — recognising the time and interest brought to every session.'}
                  {t.key === 'excellence' && 'Awarded where the work went well beyond what the programme required.'}
                  {t.key === 'appreciation' && 'Presented to those whose contribution made a programme possible.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="verify">
        <div className="lverify">
          <h2>Verify a certificate</h2>
          <p>
            Enter the ID printed at the bottom left of the certificate, or scan the QR code
            beside it.
          </p>
          <form onSubmit={verify}>
            <input
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              placeholder="e.g. AIHOW26-COM-001"
              aria-label="Certificate ID"
            />
            <button className="lbtn" type="submit">Check it</button>
          </form>
        </div>
      </section>

      <section className="lfoot">
        <div className="lorg">{ISSUER.operator}</div>
        <div>{ISSUER.unitLine}</div>
        <div>
          {ISSUER.phones.map((p, i) => (
            <span key={p}>
              {i > 0 && ' · '}
              <a href={`tel:${p.replace(/\s/g, '')}`}>{p}</a>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Link to="/verify">Verify a certificate</Link>
          {' · '}
          <Link to="/login">Administrator sign-in</Link>
        </div>
      </section>
    </div>
  );
}
