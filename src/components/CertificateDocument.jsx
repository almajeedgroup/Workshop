import { ISSUER } from '../lib/schema.js';
import QrCode from './QrCode.jsx';
import {
  certificateContent, certificateDesign, CRESTS, SIGNATORIES,
} from '../lib/certificates.js';

/** The Ashoka Chakra: 24 spokes, drawn rather than pasted. */
function Chakra({ colour = '#0E2044' }) {
  const spokes = [];
  for (let i = 0; i < 24; i++) {
    const a = (i * 15 * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    spokes.push(
      <line
        key={`s${i}`}
        x1={100 + 13 * sin} y1={100 - 13 * cos}
        x2={100 + 85 * sin} y2={100 - 85 * cos}
        stroke={colour} strokeWidth="2.6" strokeLinecap="round"
      />
    );
    const b = ((i * 15 + 7.5) * Math.PI) / 180;
    spokes.push(
      <circle key={`c${i}`} cx={100 + 78 * Math.sin(b)} cy={100 - 78 * Math.cos(b)} r="3.4" fill={colour} />
    );
  }
  return (
    <svg className="chakra" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="95" fill="none" stroke={colour} strokeWidth="4" />
      <circle cx="100" cy="100" r="86" fill="none" stroke={colour} strokeWidth="1.6" />
      {spokes}
      <circle cx="100" cy="100" r="13" fill={colour} />
    </svg>
  );
}

/**
 * Stands where a handwritten signature would, in the manner of a digitally
 * signed Aadhaar document: nobody signed this sheet by hand, and it is not
 * pretending they did. What vouches for it is the register — the ID and QR at
 * the foot of the certificate.
 */
function VerifiedMark() {
  return (
    <div className="mark">
      <svg className="tick" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#0D5436" />
        <path
          d="M6.8 12.5 L10.3 16 L17.2 8.7"
          fill="none" stroke="#FFFFFF" strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      <span>Verified</span>
    </div>
  );
}

const WAVE = 'M0,0 L88,0 C66,52 100,104 74,156 C52,208 96,258 70,310 C48,362 92,412 66,464 C44,516 90,566 64,618 C44,670 88,716 62,762 C52,782 70,790 60,800 L0,800 Z';
const WAVE_INNER = 'M0,0 L62,0 C44,52 74,104 50,156 C32,208 68,258 46,310 C28,362 66,412 42,464 C26,516 64,566 40,618 C24,670 62,716 38,762 C30,782 46,790 38,800 L0,800 Z';

function Edge({ side, colour }) {
  const body = (
    <>
      <path fill={colour} d={WAVE} />
      <path fill="#FFFFFF" opacity=".24" d={WAVE_INNER} />
    </>
  );
  return (
    <svg className={`edge ${side}`} viewBox="0 0 100 800" preserveAspectRatio="none" aria-hidden="true">
      {side === 'r' ? <g transform="translate(100,0) scale(-1,1)">{body}</g> : body}
    </svg>
  );
}

/** The crest strip and the issuing line — identical on every design. */
function Head() {
  return (
    <>
      <div className="crests">
        {CRESTS.map((c, i) => (
          <div key={c.src} style={{ display: 'contents' }}>
            {i > 0 && <i />}
            <img src={c.src} alt={c.alt} />
          </div>
        ))}
      </div>

      <div className="org">
        <b>{ISSUER.unit}</b> &nbsp;·&nbsp; A Unit of {ISSUER.name}
        <small>In association with {ISSUER.operator}</small>
      </div>
    </>
  );
}

/** The signatures and the ID-and-QR foot — identical on every design. */
function Foot({ cert, verifyUrl, host }) {
  return (
    <>
      <div className="signs">
        {SIGNATORIES.map((s) => (
          <div className="sig" key={s.name}>
            <VerifiedMark />
            <div className="line" />
            <b>{s.name}</b>
            <span>{s.role}<br />{s.org}</span>
          </div>
        ))}
      </div>

      <div className="cfoot">
        <div className="cid">
          <b>Certificate ID</b>
          <span className="id">{cert.certificateId}</span>
        </div>

        <div className="verify">
          <QrCode className="qr" value={verifyUrl} title="Certificate verification QR code" />
          <div className="t">
            <b>Verify this certificate</b>
            {verifyUrl ? <a href={verifyUrl}>{host}</a> : <span>{host}</span>}
          </div>
        </div>
      </div>
    </>
  );
}

/** Tricolour edges, the chakra behind, a three-bar divider. */
function ClassicSheet({ cert, content, verifyUrl, host }) {
  return (
    <div className={`sheet${cert.revoked ? ' revoked' : ''}`}>
      <Edge side="l" colour="#F17304" />
      <Edge side="r" colour="#0A7A2C" />
      <Chakra />

      <div className="inner">
        <Head />

        <h1>{content.title}</h1>
        <div className="tri"><i /><i /><i /></div>

        <div className="lead">{content.lead}</div>
        <div className="name">{cert.recipientName}</div>
        <div className="crule" />

        <div className="cbody">
          {content.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <p className="cheer">{content.cheer}</p>
        </div>

        <Foot cert={cert} verifyUrl={verifyUrl} host={host} />
      </div>
    </div>
  );
}

/**
 * A red double keyline, a diamond divider, and a panel of facts.
 *
 * The facts come off the certificate record rather than the workshop,
 * because a certificate has to keep saying what it said when it was issued
 * even after the workshop is edited or deleted. Each line is dropped when
 * the course did not record it, rather than printed with a blank beside it.
 */
function ParliamentSheet({ cert, content, verifyUrl, host }) {
  const facts = [
    ['Workshop Code', cert.workshopCode],
    ['Duration', cert.duration],
    ['Time', cert.time],
  ].filter(([, v]) => v);

  return (
    <div className={`sheet parliament${cert.revoked ? ' revoked' : ''}`}>
      <div className="frame" />
      <Chakra colour="#14181C" />

      <div className="inner">
        <Head />

        <h1>{content.title}</h1>
        <div className="redrule"><u /><i /><u /></div>

        <div className="lead">{content.lead}</div>
        <div className="name">{cert.recipientName}</div>
        <div className="crule" />

        <div className="cbody">
          {content.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {cert.topics && <p className="skills">{cert.topics}</p>}
        </div>

        {(facts.length > 0 || cert.venue) && (
          <div className="facts">
            {facts.length > 0 && (
              <div className="row1">
                {facts.map(([label, value], i) => (
                  <div key={label} style={{ display: 'contents' }}>
                    {i > 0 && <i />}
                    <span><b>{label}</b>{value}</span>
                  </div>
                ))}
              </div>
            )}
            {cert.venue && <div className="venue"><b>Venue</b>{cert.venue}</div>}
          </div>
        )}

        <Foot cert={cert} verifyUrl={verifyUrl} host={host} />
      </div>
    </div>
  );
}

/**
 * The printable certificate.
 *
 * `cert` is a stored certificate record. `verifyUrl` is where the QR code and
 * the printed address point — the page that confirms this exact ID.
 *
 * Which sheet is drawn comes off the record, not the workshop: a certificate
 * already in somebody's hands must keep looking like itself when the course
 * is edited afterwards.
 */
export default function CertificateDocument({ cert, verifyUrl = '' }) {
  const content = certificateContent(cert);
  const host = verifyUrl.replace(/^https?:\/\//, '').split('/')[0] || '';
  const Sheet = certificateDesign(cert).key === 'parliament' ? ParliamentSheet : ClassicSheet;

  return <Sheet cert={cert} content={content} verifyUrl={verifyUrl} host={host} />;
}
