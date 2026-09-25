import { Link } from 'react-router-dom';
import { FEATURE_GROUPS, FEATURES, featurePath, featuresInGroup } from '../../lib/features.js';
import { BRAND_NAME } from '../../lib/brand.js';
import { ISSUER } from '../../lib/schema.js';
import FeatureIcon from '../../components/site/FeatureIcon.jsx';
import Deck from '../../components/site/Deck.jsx';
import { IconArrow, IconShield, IconCheck } from '../../components/site/Icons.jsx';

/** One ground per group, so the deck changes colour as you move along it. */
const POSTER_TONE = ['lime', 'soft', 'stone', 'ink'];

/**
 * Everything the system does, on one page, grouped the way a course runs.
 *
 * Generated from the catalogue rather than written out, so a feature cannot
 * be shipped and left off this list.
 *
 * Ten features stacked into four sections made a page four screens long
 * that nobody reached the end of. As a deck they are one screen: the four
 * phases of a course are the tabs, and the phase you pick fills the stage.
 */
export default function FeaturesPage() {
  const tabs = FEATURE_GROUPS
    .map((g, i) => ({ ...g, key: g.key, label: g.label, tone: POSTER_TONE[i % POSTER_TONE.length], n: i + 1 }))
    .filter((g) => featuresInGroup(g.key).length);

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <div className="hero-mid" data-reveal>
            <span className="ann flat">
              <b>{FEATURES.length} features</b> Every one of them documented
            </span>

            <h1 className="display-lead">
              Everything a course needs,<br /><em>start</em> to certificate
            </h1>

            <p className="lede">
              {BRAND_NAME} is the system {ISSUER.operator} runs its programmes on.
              Here is all of it, in the order a course meets it.
            </p>

            <div className="acts">
              <Link className="btn" to="/verify">Verify a certificate <IconArrow /></Link>
              <Link className="btn ghost" to="/programmes">See the programmes</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- the deck ---------------- */}
      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>The arc of a <em>course</em></h2>
            <p>Four phases. Pick one to see what runs in it.</p>
          </div>

          <div className="mt-7" data-reveal>
            <Deck tabs={tabs} label="Phases of a course">
              {(g) => (
                <>
                  <div className={`poster ${g.tone}`}>
                    <span className="n">{`0${g.n}`.slice(-2)}</span>
                    <h3>{g.blurb}</h3>
                    <p>{featuresInGroup(g.key).length} features in this phase</p>
                    <div className="go">
                      <Link className={`btn sm ${g.tone === 'ink' ? 'light' : 'ghost'}`} to={featurePath(featuresInGroup(g.key)[0])}>
                        Start reading <IconArrow />
                      </Link>
                    </div>
                  </div>

                  <div className="rows">
                    {featuresInGroup(g.key).map((f) => (
                      <Link key={f.slug} to={featurePath(f)}>
                        <span className="fi"><FeatureIcon name={f.icon} width="19" height="19" /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <strong>{f.name}</strong>
                          <small>{f.tagline}</small>
                        </span>
                        <IconArrow width="17" height="17" className="chev" />
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </Deck>
          </div>

          <div className="mt-7" style={{ textAlign: 'center' }} data-reveal>
            <Link className="btn ghost" to={featurePath(FEATURES[0])}>Read every feature in order <IconArrow /></Link>
          </div>
        </div>
      </section>

      {/* ---------------- the whole catalogue ---------------- */}
      <section className="band light" data-tone="light">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>Or take the <em>whole</em> list</h2>
            <p>Ten features, each with a page of its own — including what it will not do.</p>
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
        </div>
      </section>

      {/* ---------------- why there is no server ---------------- */}
      <section className="band dark" data-tone="dark">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2>No server, and that is <em>the point</em></h2>
            <p>
              There is nothing between the browser and the database. Less to run, less to
              pay for, and far less that can quietly go wrong.
            </p>
          </div>

          <div className="bento mt-7">
            <div className="bt ink" data-reveal>
              <span className="bt-fig">0</span>
              <span className="tile-note">servers between your browser and the register</span>
              <span className="tile-foot"><span className="logo">By design</span></span>
            </div>
            <div className="bt half" data-reveal>
              <ul className="ticks" style={{ marginTop: 0 }}>
                {[
                  'Registration data never leaves the school’s own database',
                  'Verification shows no contact details to anyone',
                  'Exports are downloaded, never uploaded',
                  'Every award records the body that issued it',
                ].map((t) => (
                  <li key={t}><IconCheck width="16" height="16" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="bt lime" data-reveal>
              <span className="bt-fig"><IconShield width="40" height="40" /></span>
              <span className="tile-note">
                Checking a certificate is the part of this that is for everybody, not just
                the office. Free, instant, no account.
              </span>
              <span className="tile-foot">
                <Link className="btn sm ghost" to="/verify">Verify <IconArrow /></Link>
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
