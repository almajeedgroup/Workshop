import { Link, Navigate, useParams } from 'react-router-dom';
import {
  FEATURES, featureBySlug, featureNeighbours, featurePath, featuresInGroup, groupOf,
} from '../../lib/features.js';
import FeatureIcon from '../../components/site/FeatureIcon.jsx';
import { IconArrow, IconCheck, IconAlert } from '../../components/site/Icons.jsx';

/**
 * One feature, in full.
 *
 * Every one of these pages is this component with different data. Writing ten
 * near-identical pages by hand would guarantee that by the third edit they
 * stopped agreeing with each other.
 *
 * An unknown slug goes back to the hub rather than showing an error page —
 * a mistyped or out-of-date link should land somewhere useful.
 */
export default function FeaturePage() {
  const { slug } = useParams();
  const feature = featureBySlug(slug);
  if (!feature) return <Navigate to="/features" replace />;

  const group = groupOf(feature);
  const { prev, next } = featureNeighbours(feature.slug);
  // The rest of this stage of a course. Somebody reading about attendance is
  // usually about to wonder what else happens while the course runs, and
  // sending them back to the hub to find out is a wasted trip.
  const siblings = group ? featuresInGroup(group.key).filter((f) => f.slug !== feature.slug) : [];

  return (
    <>
      <section className="band hero quiet tight" data-tone="light">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/features">All features</Link>
            <span aria-hidden="true">/</span>
            <span>{feature.name}</span>
          </nav>

          <div className="hero-grid mt-7">
            <div data-reveal>
              <span className="ann flat">
                <b>Feature</b>
                {group ? group.label : 'Across everything'}
              </span>
              <h1 className="display-lead sm">{feature.name}</h1>
              <p className="lede mt-5">{feature.lede}</p>
              {feature.link && (
                <div className="actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
                  <Link className="btn" to={feature.link.to}>{feature.link.label} <IconArrow /></Link>
                </div>
              )}
            </div>

            <div className="panel soft" data-reveal>
              <div className="ico green mb-4">
                <FeatureIcon name={feature.icon} />
              </div>
              <h3>What you get</h3>
              <ul className="ticks mt-4">
                {feature.points.map((p) => (
                  <li key={p} className="t-base" ><IconCheck width="15" height="15" />{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="band paper" data-tone="light">
        <div className="wrap">
          <div className="fdoc">
            <div>
              <div className="prose">
                {feature.sections.map((s, i) => (
                  <div key={s.h} data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                    <h2>{s.h}</h2>
                    <p>{s.p}</p>
                  </div>
                ))}
              </div>

              {feature.limits?.length > 0 && (
                <div className="caveat" data-reveal>
                  <span className="cico"><IconAlert /></span>
                  <div>
                    <h3>What it does not do</h3>
                    <ul>
                      {feature.limits.map((l) => <li key={l}>{l}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <aside className="frail" aria-label={group ? `More in ${group.label}` : 'More features'}>
              <div className="frail-in">
                {siblings.length > 0 && (
                  <>
                    <h2>{group.label}</h2>
                    <ul>
                      {siblings.map((f) => (
                        <li key={f.slug}>
                          <Link to={featurePath(f)}>
                            <span className="fi"><FeatureIcon name={f.icon} width="18" height="18" /></span>
                            <span>
                              <strong>{f.name}</strong>
                              <em>{f.tagline}</em>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <Link className="btn ghost sm" to="/features" style={{ marginTop: siblings.length ? 22 : 0 }}>
                  All {FEATURES.length} features <IconArrow />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="band light tight" data-tone="light">
        <div className="wrap">
          <div className="pager">
            {prev ? (
              <Link className="pg" to={featurePath(prev)}>
                <span className="dir">Previous</span>
                <span className="t">{prev.name}</span>
              </Link>
            ) : <span />}
            <Link className="btn ghost sm" to="/features">
              All {FEATURES.length} features
            </Link>
            {next ? (
              <Link className="pg next" to={featurePath(next)}>
                <span className="dir">Next</span>
                <span className="t">{next.name} <IconArrow /></span>
              </Link>
            ) : <span />}
          </div>
        </div>
      </section>
    </>
  );
}
