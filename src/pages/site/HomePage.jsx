import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { BRAND_NAME } from '../../lib/brand.js';
import { FEATURES, featurePath } from '../../lib/features.js';
import { CRESTS } from '../../lib/certificates.js';
import FeatureIcon from '../../components/site/FeatureIcon.jsx';
import { IconArrow, IconCheck, IconQr, IconShield } from '../../components/site/Icons.jsx';

/**
 * The home page.
 *
 * Built as a sequence of full-bleed bands that alternate warm off-white and
 * near-black with hard edges. Every band declares `data-tone`, which is not
 * decoration: the floating nav reads it to decide whether to be a light pill
 * or a dark one as it passes over.
 *
 * The content is the school's own — nothing here is invented to fill a
 * layout. Where a pattern wanted a number, it got one this app can actually
 * produce.
 */

/* Signals for the marquee: the things the system notices, in its own words. */
const SIGNALS = [
  'A registration request is waiting', 'Seat limit reached on AIHOW26',
  'Fathima has not said how she is attending', 'Three questions waiting in the class',
  'Certificate AIHOW26-COM-001 verified', 'Zoha is on her third course',
  'Six fees still outstanding', 'The class has been running 42 minutes',
  'An attendance sheet is ready to print', 'Laiba asked a question',
  'A duplicate application was caught', 'Eleven ID cards ready for the printer',
];

const SAYINGS = [
  { name: 'Dr. Zoheb Javeed Khan', role: 'President, Islamic Information Centre',
    text: 'A certificate somebody can check in seconds, from a QR code, without ringing the office. That changed what our certificates are worth.' },
  { name: 'Ms. Sayeeda Arshiya', role: 'Principal, Kabir IND PU College for Women',
    text: 'The register, the ID cards and the attendance sheet all come out of the same place. We used to keep three lists and reconcile them.' },
  { name: 'Mohammed Khan', role: 'Coordinator',
    text: 'Bringing last term’s students onto the next course used to be an afternoon of typing. It is one press now, and nobody arrives marked paid for a fee we never collected.' },
  { name: 'Mr. Sulaimaan', role: 'Founder',
    text: 'I can see who is in the room and who is waiting to ask something, on one bar, while I am talking. That is the whole job.' },
  { name: 'Aisha Siddiqua', role: 'Office',
    text: 'Someone rings and says they registered. I type the name and they are on the screen — whichever of the four courses it was.' },
  { name: 'Abdul Rahman Sharief', role: 'Participant',
    text: 'My certificate has an ID on it. I put it on my application and the college checked it themselves.' },
];

export default function HomePage() {
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
      <section className="band hero" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <Link className="ann" to="/features/online-classes">
              <b>New</b> Online classes, with a question queue <IconArrow />
            </Link>

            <h1 className="display-lead">
              Learn it by building it:<br />taught, <em>then</em> certified
            </h1>

            <p className="lede">
              {BRAND_NAME} is how {ISSUER.operator} runs its programmes — from the
              registration link on a poster to a certificate anyone can check.
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
                <span className="stars" aria-hidden="true">★★★★★</span>
                <span>Free, instant, and no account needed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- what it runs ---------------- */}
      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>One system to run <em>every</em> part of a course</h2>
            <p>Ten things, and all of them written up.</p>
          </div>

          <ul className="fstrip mt-7">
            {FEATURES.map((f, i) => (
              <li key={f.slug} data-reveal style={{ transitionDelay: `${Math.min(i, 6) * 45}ms` }}>
                <Link to={featurePath(f)}>
                  <span className="fi"><FeatureIcon name={f.icon} width="19" height="19" /></span>
                  <span>
                    <strong>{f.name}</strong>
                    <em>{f.tagline}</em>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-7" data-reveal>
            <Link className="btn ghost" to="/features">Every feature in detail <IconArrow /></Link>
          </div>
        </div>
      </section>

      {/* ---------------- results ---------------- */}
      <section className="band light" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>What it actually <em>produces</em></h2>
            <p>Not features. The things a course leaves behind.</p>
          </div>

          <div className="bento mt-7">
            {/* Every row sums to twelve. A row that stops at eight reads as a
                gap somebody forgot to fill rather than as a rhythm. */}
            <div className="bt lime" data-reveal>
              <span className="bt-fig">4</span>
              <span className="tile-note">kinds of award, one design</span>
              <span className="tile-foot"><span className="logo">Certificates</span></span>
            </div>
            <div className="bt soft" data-reveal>
              <span className="bt-fig">QR</span>
              <span className="tile-note">on every certificate, checked without an account</span>
              <span className="tile-foot"><span className="logo">Verification</span></span>
            </div>
            <div className="bt stone" data-reveal>
              <span className="bt-fig">54<span className="t-2xl">mm</span></span>
              <span className="tile-note">ID cards, cut to the size every lanyard is made for</span>
              <span className="tile-foot"><span className="logo">ID cards</span></span>
            </div>

            <div className="bt half" data-reveal>
              <blockquote>
                A certificate somebody can check in seconds, from a QR code, without
                ringing the office. That changed what our certificates are worth.
              </blockquote>
              <span className="tile-foot">
                <span className="tile-by">
                  <span>
                    <b>Dr. Zoheb Javeed Khan</b>
                    <small>President, Islamic Information Centre</small>
                  </span>
                </span>
              </span>
            </div>
            <div className="bt half" data-reveal>
              <blockquote>
                The register, the ID cards and the attendance sheet all come out of the
                same place. We used to keep three lists and reconcile them.
              </blockquote>
              <span className="tile-foot">
                <span className="tile-by">
                  <span>
                    <b>Ms. Sayeeda Arshiya</b>
                    <small>Principal, Kabir IND PU College for Women</small>
                  </span>
                </span>
              </span>
            </div>

            <div className="bt ink" data-reveal>
              <span className="bt-fig">0</span>
              <span className="tile-note">servers between your browser and the register</span>
              <span className="tile-foot"><span className="logo">By design</span></span>
            </div>
            <div className="bt wide" data-reveal>
              <blockquote>
                Bringing last term&rsquo;s students onto the next course used to be an
                afternoon of typing. It is one press now, and nobody arrives marked paid
                for a fee we never collected.
              </blockquote>
              <span className="tile-foot">
                <span className="tile-by">
                  <span>
                    <b>Mohammed Khan</b>
                    <small>Coordinator</small>
                  </span>
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- signals ---------------- */}
      <section className="band dark tight" data-tone="dark">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Nothing quietly goes missing</h2>
          </div>
        </div>
        <div className="marquee mt-7" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className={`row${row === 1 ? ' back' : ''}`}>
              {[...SIGNALS.slice(row * 4), ...SIGNALS.slice(0, row * 4),
                ...SIGNALS.slice(row * 4), ...SIGNALS.slice(0, row * 4)].map((s, i) => (
                <span className="sig-chip" key={`${row}-${i}`}><i />{s}</span>
              ))}
            </div>
          ))}
        </div>
        <div className="wrap mt-8">
          <div className="pull" data-reveal>
            <q>
              I can see who is in the room and who is waiting to ask something, on one
              bar, while I am talking. That is the whole job.
            </q>
            <DrawnRule />
            <span className="by">
              <span className="tile-by">
                <span>
                  <b>Mr. Sulaimaan</b>
                  <small>Founder</small>
                </span>
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ---------------- in association with ---------------- */}
      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Run <em>with</em> these institutions</h2>
          </div>
          <div className="logogrid mt-7" data-reveal>
            {CRESTS.slice(0, 3).map((c) => (
              <div className="cell" key={c.src}>
                <img src={c.src} alt={c.alt} style={{ height: 52, width: 'auto' }} />
                <small>Named on every document</small>
              </div>
            ))}
            <div className="cell feature">
              <span className="name">{ISSUER.city}</span>
              <Link className="btn ghost sm" to="/about">About us <IconArrow /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- testimonials ---------------- */}
      <section className="band dark" data-tone="dark">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Some of what people <em>say</em></h2>
          </div>
          <div className="masonry mt-7">
            {SAYINGS.map((s) => (
              <figure className="say" key={s.name}>
                <span className="tile-by">
                  <span>
                    <b>{s.name}</b>
                    <small>{s.role}</small>
                  </span>
                </span>
                <p>{s.text}</p>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- how it runs ---------------- */}
      <section className="band light" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>From an enquiry to a <em>certificate</em></h2>
          </div>
          <div className="grid g4 mt-7">
            {[
              { t: 'Register', d: 'Share the course link. People enter their own details, and an organiser accepts them.' },
              { t: 'Get a ticket', d: 'A sequential ID, a printable ticket, and a place on the register.' },
              { t: 'Attend and build', d: 'In the hall or on the link — the sheet and the class both know which.' },
              { t: 'Take the certificate', d: 'With an ID and a QR anyone can check, for as long as it matters.' },
            ].map((s, i) => (
              <div key={s.t} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="steps"><div className="step">
                  <span className="num">{i + 1}</span>
                  <div>
                    <h3>{s.t}</h3>
                    <p className="t-base">{s.d}</p>
                  </div>
                </div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- the closing panel ---------------- */}
      <section className="band paper tight" data-tone="light">
        <div className="wrap">
          <div className="cta-panel" data-reveal>
            <h2>
              Check a<br /><span className="bloom">certificate</span>
            </h2>
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

/**
 * The hand-drawn underline under a pull quote.
 *
 * Inline SVG rather than an image: it takes the colour it is given, scales to
 * whatever the quote is, and costs no request. Drawn slightly off-level,
 * because a perfectly straight "hand-drawn" line is neither.
 */
function DrawnRule() {
  return (
    <svg className="q-rule" viewBox="0 0 600 12" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M2 8C88 3 190 2 300 4c96 2 190 5 298 2"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}
