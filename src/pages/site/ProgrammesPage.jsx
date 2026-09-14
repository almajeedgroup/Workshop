import { Link } from 'react-router-dom';
import { ISSUER } from '../../lib/schema.js';
import { BRAND_NAME } from '../../lib/brand.js';
import Stack from '../../components/site/Stack.jsx';
import { IconCheck, IconArrow, IconPin, IconUsers, IconAward } from '../../components/site/Icons.jsx';

const PROGRAMMES = [
  {
    id: 'ai',
    n: '01',
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

/**
 * What we teach.
 *
 * Three programmes is too few for a grid and too much for one page of
 * prose — laid out flat, the third one is a screen and a half below the
 * fold and nobody reads it. So they are a stack: all three titles visible
 * at once, one of them open.
 */
export default function ProgrammesPage() {
  const items = PROGRAMMES.map((p) => ({
    key: p.id,
    n: p.n,
    title: p.title,
    sub: p.lede,
    body: (
      <>
        <div>
          {p.body.map((b, k) => <p key={k}>{b}</p>)}
          <div className="keep">
            <b>You leave with</b>
            <span>{p.outcome}</span>
          </div>
        </div>
        <div>
          <h4 className="t-sm" style={{ letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            What it covers
          </h4>
          <ul className="ticks">
            {p.covers.map((c) => <li key={c}><IconCheck width="16" height="16" />{c}</li>)}
          </ul>
        </div>
      </>
    ),
  }));

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <span className="ann flat"><b>Programmes</b> Three, taught in person</span>

            <h1 className="display-lead">
              Six days, and you leave<br />with <em>something you built</em>
            </h1>

            <p className="lede">
              Short and intensive, held with partner institutions across {ISSUER.city}.
              Every programme ends with your own work and a certificate anyone can check.
            </p>

            <div className="acts">
              <Link className="btn" to="/contact">Ask about the next intake <IconArrow /></Link>
              <Link className="btn ghost" to="/certificates">About the certificates</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- the three ---------------- */}
      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>What we <em>teach</em></h2>
            <p>Open one to see what its days are made of.</p>
          </div>
          <div className="mt-7" data-reveal><Stack items={items} /></div>
        </div>
      </section>

      {/* ---------------- what they share ---------------- */}
      <section className="band light" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>The same shape, <em>whichever</em> one you take</h2>
          </div>
          <div className="bento mt-7">
            <div className="bt lime" data-reveal>
              <span className="bt-fig">6</span>
              <span className="tile-note">days, taught in person at a partner campus</span>
              <span className="tile-foot"><span className="logo">Length</span></span>
            </div>
            <div className="bt soft" data-reveal>
              <span className="bt-fig">1</span>
              <span className="tile-note">thing you made, presented on the final day</span>
              <span className="tile-foot"><span className="logo">Outcome</span></span>
            </div>
            <div className="bt stone" data-reveal>
              <span className="bt-fig">QR</span>
              <span className="tile-note">on the certificate, so it can be checked by anyone</span>
              <span className="tile-foot"><span className="logo">Award</span></span>
            </div>

            <div className="bt wide" data-reveal>
              <span className="bt-fig">In the room</span>
              <span className="tile-note">
                Seats are limited and taught in person. {BRAND_NAME} keeps the register, the
                attendance sheet and the ID cards, so the office is not running three lists
                against each other while a course is on.
              </span>
              <span className="tile-foot">
                <span className="tile-by"><span><b>{ISSUER.city}</b><small>At partner campuses</small></span></span>
              </span>
            </div>
            <div className="bt ink" data-reveal>
              <span className="bt-fig">4</span>
              <span className="tile-note">kinds of award: completion, merit, participation, appreciation</span>
              <span className="tile-foot"><span className="logo">Certificates</span></span>
            </div>
          </div>

          <ul className="ticks mt-7" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', display: 'grid' }} data-reveal>
            <li><IconUsers width="16" height="16" />Limited seats, in order of registration</li>
            <li><IconPin width="16" height="16" />{ISSUER.city}, at partner campuses</li>
            <li><IconAward width="16" height="16" />A certificate with an ID that can be verified</li>
          </ul>
        </div>
      </section>

      {/* ---------------- closing ---------------- */}
      <section className="band paper tight" data-tone="light">
        <div className="wrap">
          <div className="cta-panel" data-reveal>
            <h2>Join the<br /><span className="bloom">next intake</span></h2>
            <p className="t-lg" style={{ maxWidth: '46ch', margin: 'var(--sp-5) auto 0', color: 'var(--ink)' }}>
              Dates are announced before each programme and seats fill in order of
              registration. Tell us which one you want and we will say what is coming up.
            </p>
            <div className="acts">
              <Link className="btn light" to="/contact">Contact us <IconArrow /></Link>
              <Link className="btn ghost" to="/features">See how a course runs</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
