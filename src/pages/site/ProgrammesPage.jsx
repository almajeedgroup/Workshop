import { Link } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { IconSpark, IconBook, IconBulb, IconCheck, IconArrow, IconPin, IconUsers } from '../../components/site/Icons.jsx';

const PROGRAMMES = [
  {
    id: 'ai',
    n: '01',
    icon: <IconSpark />,
    title: 'Artificial Intelligence, hands on',
    lede: 'Six days building working AI assistants — not studying them from a distance.',
    body: [
      'The programme starts with what a language model actually is and what it is not, then moves quickly into using one well. Prompt engineering is taught as a craft with rules that can be tested, rather than a bag of tricks.',
      'From there participants design and build a chatbot for a domain they choose — a study helper, a clinic receptionist, a shop assistant — learning the web technologies needed to put it in front of someone else.',
    ],
    covers: ['What a model can and cannot do', 'Prompt engineering as method', 'Chatbot design and conversation flow',
      'HTML, CSS and JavaScript essentials', 'Connecting a model to a page', 'Presenting your build on the final day'],
    outcome: 'A working AI chatbot of your own, running and demonstrable.',
  },
  {
    id: 'research',
    n: '02',
    icon: <IconBook />,
    title: 'Research methodology',
    lede: 'The habits that outlast any one tool: ask well, gather honestly, write clearly.',
    body: [
      'Most research goes wrong at the first step — a question too broad to answer or too narrow to matter. The programme spends real time there before touching any method.',
      'It then covers gathering evidence that genuinely bears on the question, the difference between a result and a claim, and writing it up so a reader can follow your reasoning and disagree with it on the merits.',
    ],
    covers: ['Framing an answerable question', 'Literature and prior work', 'Choosing a method that fits',
      'Evidence, sampling and bias', 'Citation and academic integrity', 'Structuring the written study'],
    outcome: 'A short written study of your own, properly cited.',
  },
  {
    id: 'innovation',
    n: '03',
    icon: <IconBulb />,
    title: 'Innovation practice',
    lede: 'Ideas are cheap. This is about the part where something actually gets finished.',
    body: [
      'Participants bring an idea, or find one in the first session, and take it through scoping — what it is, who it is for, what it will not do — before building anything.',
      'The rest is prototyping and testing with real people, then the unglamorous work of finishing: cutting scope, fixing what broke, and shipping something small that works over something large that does not.',
    ],
    covers: ['Scoping and saying no', 'Sketching and rapid prototyping', 'Testing with real users',
      'Iterating on what you learn', 'Presenting the work', 'Finishing and handing over'],
    outcome: 'A tested prototype and a clear account of what you learned.',
  },
];

export default function ProgrammesPage() {
  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div style={{ maxWidth: 760 }} data-reveal>
            <span className="eyebrow">Programmes</span>
            <h1 className="display" style={{ fontSize: 'clamp(32px,5vw,56px)' }}>What we teach</h1>
            <div className="tri" style={{ marginTop: 22 }}><i /><i /><i /></div>
            <p className="lede" style={{ marginTop: 22 }}>
              Short and intensive — typically six days, held in person with partner institutions.
              Every programme ends with something you made, and a certificate that can be checked.
            </p>
          </div>
        </div>
      </section>

      {PROGRAMMES.map((p, i) => (
        <section key={p.id} id={p.id} className={i % 2 ? 'band-soft' : undefined}>
          <div className="wrap">
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div data-reveal>
                <span className="idx" style={{ fontFamily: 'var(--display)', fontSize: 13, letterSpacing: '.14em', color: 'var(--saffron)' }}>
                  {p.n}
                </span>
                <div className="ico" style={{ marginTop: 14 }}>{p.icon}</div>
                <h2 style={{ marginTop: 4 }}>{p.title}</h2>
                <p className="lede" style={{ marginTop: 14 }}>{p.lede}</p>
                {p.body.map((b, k) => (
                  <p key={k} style={{ marginTop: 16, fontSize: 15.5, lineHeight: 1.75 }}>{b}</p>
                ))}
                <div className="card" style={{ marginTop: 24, background: 'var(--green-wash)', borderColor: 'rgba(10,122,44,.2)' }}>
                  <h3 style={{ fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--green-2)' }}>
                    You leave with
                  </h3>
                  <p style={{ marginTop: 8, color: 'var(--ink)', fontSize: 15.5 }}>{p.outcome}</p>
                </div>
              </div>

              <div className="card" data-reveal>
                <h3>What it covers</h3>
                <ul className="ticks">
                  {p.covers.map((c) => (
                    <li key={c}><IconCheck width="16" height="16" />{c}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 26, paddingTop: 22, borderTop: '1px solid var(--hair)', display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <IconUsers width="18" height="18" style={{ color: 'var(--ink-faint)', flex: 'none', marginTop: 2 }} />
                    <span style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>Limited seats, taught in person</span>
                  </div>
                  <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <IconPin width="18" height="18" style={{ color: 'var(--ink-faint)', flex: 'none', marginTop: 2 }} />
                    <span style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>{ISSUER.city}, at partner campuses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="tight">
        <div className="wrap">
          <div className="cta-band" data-reveal>
            <h2>Want to join the next intake?</h2>
            <p>
              Dates are announced before each programme and seats fill in order of registration.
              Get in touch and we will tell you what is coming up.
            </p>
            <div className="actions">
              <Link className="btn light" to="/contact">Contact us <IconArrow /></Link>
              <Link className="btn ghost" to="/certificates" style={{ color: '#fff', boxShadow: 'inset 0 0 0 1.6px rgba(255,255,255,.45)' }}>
                About the certificates
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
