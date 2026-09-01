import { cardFace } from '../lib/idcards.js';
import { formatDate } from '../lib/tickets.js';

/**
 * One face of a participant ID card, at real card size.
 *
 * Both faces are driven by `cardFace()`, so the printed sheet and the preview
 * on the organiser's screen cannot disagree about what a card says.
 */

function themeVars(theme) {
  return {
    '--band': theme.band,
    '--on-band': theme.onBand,
    '--wash': theme.wash,
    '--accent': theme.accent,
    '--ink': theme.ink,
  };
}

function Rows({ rows }) {
  if (!rows.length) return null;
  return (
    <dl className="idc-rows">
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'contents' }}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The person. */
export function IdCardFront({ face }) {
  return (
    <div className="idc" style={themeVars(face.theme)}>
      <div className="idc-band">
        <div className="idc-crests">
          {face.crests.map((c) => <img key={c.key} src={c.src} alt={c.alt} />)}
        </div>
        <div className="idc-org">{face.org}</div>
      </div>

      <div className="idc-role">{face.label}</div>

      <div className="idc-main">
        <div className="idc-photo">
          {face.photo ? <img src={face.photo} alt="" /> : <span>Photo</span>}
        </div>
        <div className="idc-name">{face.name}</div>
        <div className="idc-rule" />
        <Rows rows={face.rows} />
      </div>

      <div className="idc-foot">
        <span>ID No.</span>
        <b>{face.ticketId || '—'}</b>
      </div>
    </div>
  );
}

/** The course. */
export function IdCardBack({ face }) {
  const sub = [
    face.validUntil ? ['Valid until', formatDate(face.validUntil)] : null,
    face.emergency ? ['In emergency', face.emergency] : null,
  ].filter(Boolean);

  return (
    <div className="idc back" style={themeVars(face.theme)}>
      <div className="idc-band">
        <div className="idc-org" style={{ marginTop: 0, letterSpacing: '.18em' }}>Programme Details</div>
      </div>

      <div className="idc-main">
        <div className="idc-title">{face.title}</div>
        <Rows rows={face.backRows} />
        {sub.length > 0 && (
          <div className="idc-sub">
            <Rows rows={sub} />
          </div>
        )}
        <div className="idc-note">
          {face.note || `If found, please return to ${face.site}.`}
        </div>
      </div>

      <div className="idc-foot">
        <b>{face.phones.join('  ·  ')}</b>
        <span>{face.ticketId}</span>
      </div>
    </div>
  );
}

/** Both faces, side by side — how the organiser checks a card before printing. */
export default function IdCard({ workshop, reg }) {
  const face = cardFace(workshop, reg);
  return (
    <div className="idc-scope idc-pair">
      <IdCardFront face={face} />
      <IdCardBack face={face} />
    </div>
  );
}
