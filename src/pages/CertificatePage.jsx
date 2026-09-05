import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCertificate } from '../lib/certdb.js';
import CertificateDocument from '../components/CertificateDocument.jsx';
import CertificateStage from '../components/CertificateStage.jsx';
import { verifyUrlFor } from '../lib/certlinks.js';
import { IconAlert, IconArrow, IconCheckCircle } from '../components/site/Icons.jsx';

/**
 * The certificate itself, at a public address. Anyone the holder sends the
 * link to can see it and print it; nobody needs an account.
 */
export default function CertificatePage() {
  const { certificateId } = useParams();
  const [cert, setCert] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    getCertificate(certificateId)
      .then((c) => {
        if (!live) return;
        if (!c) setLoadError('No certificate exists with that ID.');
        else setCert(c);
      })
      .catch((e) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [certificateId]);

  if (loading) {
    return (
      <section className="tight"><div className="wrap"><p>Loading…</p></div></section>
    );
  }

  if (loadError) {
    return (
      <section className="tight">
        <div className="wrap">
          <div className="verdict bad">
            <span className="vico"><IconAlert /></span>
            <div><h3>Not found</h3><p>{loadError}</p></div>
          </div>
          <div style={{ marginTop: 22 }}>
            <Link className="btn" to="/verify">Check another certificate <IconArrow /></Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="tight" style={{ paddingBottom: 0 }}>
        <div className="wrap no-print">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <span className="eyebrow" style={{ marginBottom: 10 }}>
                Certificate of {cert.typeLabel || 'Award'}
              </span>
              <h1 style={{ fontSize: 'clamp(24px,3.2vw,34px)' }}>{cert.recipientName}</h1>
              <p style={{ marginTop: 8, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 14 }}>
                {cert.certificateId}
              </p>
            </div>
            <span style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn ghost" to={`/verify/${cert.certificateId}`}>Verify this</Link>
              <button className="btn" type="button" onClick={() => window.print()}>
                Print / Save as PDF
              </button>
            </div>
          </div>

          {cert.revoked ? (
            <div className="verdict bad" style={{ marginTop: 24 }}>
              <span className="vico"><IconAlert /></span>
              <div>
                <h3>This certificate has been withdrawn</h3>
                <p>{cert.revokedReason || 'It should no longer be relied upon.'}</p>
              </div>
            </div>
          ) : (
            <div className="verdict good" style={{ marginTop: 24 }}>
              <span className="vico"><IconCheckCircle /></span>
              <div>
                <h3>Genuine</h3>
                <p>This certificate is recorded in our register and is valid.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <CertificateStage>
        <CertificateDocument cert={cert} verifyUrl={verifyUrlFor(cert.certificateId)} />
      </CertificateStage>
    </>
  );
}
