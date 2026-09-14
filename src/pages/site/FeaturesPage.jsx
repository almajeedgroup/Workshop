import { Link } from 'react-router-dom';
import { FEATURE_GROUPS, FEATURES, featurePath, featuresInGroup } from '../../lib/features.js';
import { BRAND_NAME } from '../../lib/brand.js';
import { ISSUER } from '../../lib/schema.js';
import FeatureIcon from '../../components/site/FeatureIcon.jsx';
import { IconArrow, IconShield, IconCheck } from '../../components/site/Icons.jsx';

/**
 * Everything the system does, on one page, grouped the way a course runs.
 *
 * Generated from the catalogue rather than written out, so a feature cannot
 * be shipped and left off this list.
 */
export default function FeaturesPage() {
  return (
    <>
      <section className="hero tight">
        <div className="wrap">
          <div style={{ maxWidth: 760 }} data-reveal>
            <span className="eyebrow">What {BRAND_NAME} does</span>
            <h1 className="display t-display-lg" >
              Every feature,<br /><span className="accent">start to certificate.</span>
            </h1>
            <div className="tri mt-6"><i /><i /><i /></div>
            <p className="lede mt-6">
              {BRAND_NAME} is the system {ISSUER.operator} runs its
              programmes on — registration through to a certificate anyone can check. Here is
              all of it, in the order a course meets it.
            </p>
          </div>

          <div className="stats" style={{ marginTop: 'var(--gap)' }} data-reveal>
            {[
              { n: String(FEATURES.length), l: 'Features, documented' },
              { n: '4', l: 'Kinds of award' },
              { n: 'QR', l: 'On every certificate' },
              { n: '0', l: 'Accounts needed to verify' },
            ].map((s) => (
              <div className="s" key={s.l}>
                <span className="n">{s.n}</span>
                <span className="l">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {FEATURE_GROUPS.map((group, gi) => {
        const list = featuresInGroup(group.key);
        if (!list.length) return null;
        return (
          <section key={group.key} className={gi % 2 ? 'band-soft' : ''} id={group.key}>
            <div className="wrap">
              <div className="shead" data-reveal>
                <span className="eyebrow">{`0${gi + 1}`.slice(-2)} — {group.label}</span>
                <h2>{group.blurb}</h2>
              </div>

              <div className="grid g3">
                {list.map((f, i) => (
                  <article className="card feature" key={f.slug} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                    <div className="ico"><FeatureIcon name={f.icon} /></div>
                    <h3>{f.name}</h3>
                    <p>{f.tagline}</p>
                    <ul className="ticks mt-4">
                      {f.points.slice(0, 3).map((p) => (
                        <li key={p} className="t-base" >
                          <IconCheck width="15" height="15" />{p}
                        </li>
                      ))}
                    </ul>
                    <div className="go">
                      <Link className="btn ghost sm" to={featurePath(f)}>
                        {f.name} in detail <IconArrow />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <section className="band-dark">
        <div className="wrap">
          <div className="grid g2" style={{ alignItems: 'center' }}>
            <div data-reveal>
              <span className="eyebrow">Built the way it is for a reason</span>
              <h2>No server, and that is the point</h2>
              <p className="lede" style={{ color: 'var(--on-dark-soft)', marginTop: 16 }}>
                There is nothing between your browser and the database. Spreadsheets are built
                on your machine, recordings are saved to it, and every printed document is
                rendered by the same page you were looking at. Less to run, less to pay for,
                and far less that can quietly go wrong.
              </p>
              <ul className="ticks mt-6">
                {[
                  'Registration data never leaves the school’s own database',
                  'Verification shows no contact details to anyone',
                  'Exports are downloaded, never uploaded',
                  'Every award records the body that issued it',
                ].map((t) => (
                  <li key={t} style={{ color: 'var(--on-dark-soft)' }}>
                    <IconCheck width="16" height="16" style={{ color: 'var(--lime)' }} />{t}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal>
              <div className="card">
                <div className="ico green"><IconShield /></div>
                <h3>Check a certificate</h3>
                <p>
                  The part of this that is for everybody, not just the office. Free, instant,
                  and it needs no account at all.
                </p>
                <div className="mt-5">
                  <Link className="btn" to="/verify">Verify a certificate <IconArrow /></Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
