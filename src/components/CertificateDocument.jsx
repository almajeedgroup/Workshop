import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { ISSUER } from '../lib/schema.js';
import { certificateContent, CRESTS, SIGNATORIES } from '../lib/certificates.js';

/** The Ashoka Chakra: 24 spokes, drawn rather than pasted. */
function Chakra() {
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
        stroke="#0E2044" strokeWidth="2.6" strokeLinecap="round"
      />
    );
    const b = ((i * 15 + 7.5) * Math.PI) / 180;
    spokes.push(
      <circle key={`c${i}`} cx={100 + 78 * Math.sin(b)} cy={100 - 78 * Math.cos(b)} r="3.4" fill="#0E2044" />
    );
  }
  return (
    <svg className="chakra" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="95" fill="none" stroke="#0E2044" strokeWidth="4" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="#0E2044" strokeWidth="1.6" />
      {spokes}
      <circle cx="100" cy="100" r="13" fill="#0E2044" />
    </svg>
  );
}

/**
 * The verified mark beside each signatory, in the manner of an Aadhaar card:
 * this signature belongs to the office named beneath it, and the certificate
 * it sits on can be checked against the register by ID or QR.
 */
function VerifiedTick() {
  return (
    <svg className="tick" viewBox="0 0 24 24" role="img" aria-label="Verified signatory">
      <circle cx="12" cy="12" r="11" fill="#0D5436" />
      <path
        d="M6.8 12.5 L10.3 16 L17.2 8.7"
        fill="none" stroke="#FFFFFF" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
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

/** A real QR of the verification URL, so scanning it checks this certificate. */
function VerifyQr({ url }) {
  const rects = useMemo(() => {
    if (!url) return null;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const n = qr.getModuleCount();
      const out = [];
      // Merge runs of dark modules along each row — far fewer nodes than one
      // rect per module, which matters when printing thirty of these.
      for (let row = 0; row < n; row++) {
        let start = -1;
        for (let col = 0; col <= n; col++) {
          const dark = col < n && qr.isDark(row, col);
          if (dark && start === -1) start = col;
          if (!dark && start !== -1) {
            out.push(<rect key={`${row}-${start}`} x={start} y={row} width={col - start} height="1" />);
            start = -1;
          }
        }
      }
      return { n, out };
    } catch {
      return null;
    }
  }, [url]);

  if (!rects) return null;
  return (
    <svg
      className="qr"
      role="img"
      aria-label="Certificate verification QR code"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${rects.n} ${rects.n}`}
      shapeRendering="crispEdges"
    >
      {rects.out}
    </svg>
  );
}

/**
 * The printable certificate.
 *
 * `cert` is a stored certificate record. `verifyUrl` is where the QR code and
 * the printed address point — the page that confirms this exact ID.
 */
export default function CertificateDocument({ cert, verifyUrl = '' }) {
  const content = certificateContent(cert);
  const host = verifyUrl.replace(/^https?:\/\//, '').split('/')[0] || '';

  return (
    <div className={`sheet${cert.revoked ? ' revoked' : ''}`}>
      <Edge side="l" colour="#F17304" />
      <Edge side="r" colour="#0A7A2C" />
      <Chakra />

      <div className="inner">
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

        <h1>{content.title}</h1>
        <div className="tri"><i /><i /><i /></div>

        <div className="lead">{content.lead}</div>
        <div className="name">{cert.recipientName}</div>
        <div className="crule" />

        <div className="cbody">
          {content.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <p className="cheer">{content.cheer}</p>
        </div>

        <div className="signs">
          {SIGNATORIES.map((s) => (
            <div className="sig" key={s.name}>
              <div className="line" />
              <b>{s.name}<VerifiedTick /></b>
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
            <VerifyQr url={verifyUrl} />
            <div className="t">
              <b>Verify this certificate</b>
              {verifyUrl ? <a href={verifyUrl}>{host}</a> : <span>{host}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
