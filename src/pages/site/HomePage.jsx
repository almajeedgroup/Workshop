import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { BRAND_NAME } from '../../lib/brand.js';
import { FEATURES, featurePath } from '../../lib/features.js';
import FeatureIcon from '../../components/site/FeatureIcon.jsx';
import { CRESTS } from '../../lib/certificates.js';
import {
  IconSpark, IconBook, IconBulb, IconShield, IconQr, IconCheck,
  IconArrow, IconUsers, IconAward,
} from '../../components/site/Icons.jsx';

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
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div data-reveal>
              <span className="eyebrow">{ISSUER.unitLine}</span>
              <h1 className="display">
                Learn it by<br /><span className="accent">building it.</span>
              </h1>
              <div className="tri mt-6"><i /><i /><i /></div>
              <p className="lede">
                {ISSUER.operator} runs short, intensive
                programmes in artificial intelligence, research method and innovation practice —
                where you leave with something you made, and a certificate anyone can check.
              </p>
              <div className="actions">
                <Link className="btn" to="/programmes">See the programmes <IconArrow /></Link>
                <Link className="btn ghost" to="/certificates">About our certificates</Link>
              </div>

              <div className="trust">
                <span className="t-xs" style={{ letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: 600 }}>
                  In association with
                </span>
                {CRESTS.slice(0, 3).map((c) => <img key={c.src} src={c.src} alt={c.alt} />)}
              </div>
            </div>

            <div className="vcard" data-reveal>
              <div className="ico green mb-4"><IconQr /></div>
              <h3>Check a certificate</h3>
              <p>
                Holding one of our certificates? Enter the ID printed at the bottom left, or
                scan the QR code beside it.
              </p>
              <form onSubmit={verify}>
                <input
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. AIHOW26-COM-001"
                  aria-label="Certificate ID"
                />
                <button className="btn" type="submit">Verify now <IconArrow /></button>
              </form>
              <div className="note">
                <IconShield width="15" height="15" />
                <span>
                  Free, instant, and no account needed. No phone numbers or dates of birth
                  are ever shown.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- what we do ---------------- */}
      <section>
        <div className="wrap">
          <div className="shead" data-reveal>
            <span className="eyebrow">What we do</span>
            <h2>Teaching that ends in something real</h2>
            <p className="lede">
              Every programme is built backwards from an outcome: a working project, a written
              study, a prototype that runs. Notes are the by-product, not the point.
            </p>
          </div>

          <div className="grid g3">
            {[
              { icon: <IconSpark />, t: 'Hands on from hour one',
                d: 'Sessions are workshops, not lectures. You build alongside the trainer and leave each day with something further along than when you arrived.' },
              { icon: <IconUsers />, t: 'Small, taught in person',
                d: 'Seats are capped so nobody sits at the back. Held with partner institutions across Bengaluru, in classrooms rather than webinars.' },
              { icon: <IconAward />, t: 'Certified and checkable',
                d: 'Every certificate carries an ID and a QR code. A college or employer can confirm it in seconds, without contacting us at all.' },
            ].map((c, i) => (
              <article className="card" key={c.t} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="ico">{c.icon}</div>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- programmes ---------------- */}
      <section className="band-soft">
        <div className="wrap">
          <div className="shead" data-reveal>
            <span className="eyebrow">Programmes</span>
            <h2>Three things we teach</h2>
            <p className="lede">
              Run as short intensives — typically six days — with the whole group working
              towards the same finished piece.
            </p>
          </div>

          <div className="grid g3">
            {[
              { n: '01', icon: <IconSpark />, t: 'Artificial Intelligence, hands on',
                d: 'AI concepts, prompt engineering, chatbot design and the web technologies around them. Participants build working assistants for real domains.',
                pts: ['Prompt engineering', 'Chatbot design', 'Web fundamentals', 'A finished project'] },
              { n: '02', icon: <IconBook />, t: 'Research methodology',
                d: 'How to frame a question, gather evidence that answers it, and write it up so somebody else can follow the reasoning and check it.',
                pts: ['Framing a question', 'Method and evidence', 'Citation and integrity', 'Writing it up'] },
              { n: '03', icon: <IconBulb />, t: 'Innovation practice',
                d: 'Turning an idea into something that exists — scoping, prototyping, and the unglamorous work of actually finishing.',
                pts: ['Scoping an idea', 'Rapid prototyping', 'Testing with users', 'Shipping it'] },
            ].map((c, i) => (
              <article className="card" key={c.n} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="idx">{c.n}</span>
                <div className="ico">{c.icon}</div>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
                <ul className="ticks">
                  {c.pts.map((p) => (
                    <li key={p}><IconCheck width="16" height="16" />{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div style={{ marginTop: 'var(--gap)' }} data-reveal>
            <Link className="btn ghost" to="/programmes">Full programme details <IconArrow /></Link>
          </div>
        </div>
      </section>

      {/* ---------------- certification ---------------- */}
      <section className="band-dark">
        <div className="wrap">
          <div className="grid g2" style={{ alignItems: 'center' }}>
            <div data-reveal>
              <span className="eyebrow">Certification</span>
              <h2>A certificate that proves itself</h2>
              <p className="lede" style={{ color: 'var(--on-dark-soft)', marginTop: 16 }}>
                Anyone can print a certificate. Ours carries a unique ID and a QR code linked to
                a register — so the person checking it never has to take your word, or ours.
              </p>
              <ul className="ticks mt-6">
                {[
                  'Verified in seconds by ID or QR, with no account',
                  'Shows the award, the programme and the date issued',
                  'Withdrawn certificates say so plainly, rather than vanishing',
                  'Contact details are never shown to whoever is checking',
                ].map((t) => (
                  <li key={t} style={{ color: 'var(--on-dark-soft)' }}>
                    <IconCheck width="16" height="16" style={{ color: 'var(--lime)' }} />{t}
                  </li>
                ))}
              </ul>
              <div className="actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
                <Link className="btn" to="/verify">Verify a certificate <IconArrow /></Link>
                <Link className="btn ghost" to="/certificates">
                  How it works
                </Link>
              </div>
            </div>

            <div data-reveal>
              <div className="stats two">
                {[
                  { n: '4', l: 'Kinds of award' },
                  { n: 'QR', l: 'On every certificate' },
                  { n: '0', l: 'Accounts needed to check' },
                  { n: '24/7', l: 'Verification available' },
                ].map((s) => (
                  <div className="s" key={s.l}>
                    <span className="n">{s.n}</span>
                    <span className="l">{s.l}</span>
                  </div>
                ))}
              </div>
              <p className="t-sm" style={{ marginTop: 18, color: 'var(--on-dark-faint)' }}>
                Completion · Participation · Excellence · Appreciation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- how it runs ---------------- */}
      <section>
        <div className="wrap">
          <div className="shead center" data-reveal>
            <span className="eyebrow">How a programme runs</span>
            <h2>From enquiry to certificate</h2>
          </div>

          <div className="grid g4">
            {[
              { t: 'Register', d: 'Send your details on WhatsApp to the number on the poster. Seats are limited and go in order.' },
              { t: 'Get your ticket', d: 'You receive a ticket with its own ID — bring it, printed or on your phone, on the first day.' },
              { t: 'Attend and build', d: 'Six days of sessions, working towards a project of your own rather than a set of notes.' },
              { t: 'Take the certificate', d: 'Awarded on completion, with an ID and QR anyone can verify for as long as it matters.' },
            ].map((s, i) => (
              <div key={s.t} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="steps"><div className="step">
                  <span className="num">{i + 1}</span>
                  <div>
                    <h3>{s.t}</h3>
                    <p className="t-base" >{s.d}</p>
                  </div>
                </div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- what it runs on ---------------- */}
      <section className="band-soft">
        <div className="wrap">
          <div className="shead" data-reveal>
            <span className="eyebrow">The system behind it</span>
            <h2>{BRAND_NAME}, end to end</h2>
            <p className="lede">
              Registration, tickets, online classes, attendance, ID cards, certificates and a
              public register anyone can check — one system, built for how these programmes
              actually run. Every part of it is written up.
            </p>
          </div>

          {/* Generated from the catalogue, so a feature shipped later cannot
              quietly go unmentioned on the page that promises all of them. */}
          <ul className="fstrip">
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

          <div style={{ marginTop: 'var(--gap)' }} data-reveal>
            <Link className="btn ghost" to="/features">Every feature in detail <IconArrow /></Link>
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="tight">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <h2>Interested in the next workshop?</h2>
            <p>
              Programmes are announced ahead of each intake and seats are limited. Call or
              write, and we will tell you what is coming up.
            </p>
            <div className="actions">
              <a className="btn light" href={`tel:${ISSUER.phones[0].replace(/\s/g, '')}`}>
                Call {ISSUER.phones[0]}
              </a>
              <Link className="btn ghost" to="/contact">
                All ways to reach us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
