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
      <section className="band light tight" data-tone="light">
        <div className="wrap"><p>Loading…</p></div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="band light tight" data-tone="light">
        <div className="wrap">
          <div className="verdict bad">
            <span className="vico"><IconAlert /></span>
            <div><h3>Not found</h3><p>{loadError}</p></div>
          </div>
          <div className="mt-6">
            <Link className="btn" to="/verify">Check another certificate <IconArrow /></Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* `no-print` on the SECTION, not just the panel inside it.
          A section with a hidden child is still a box with padding, and
          that box starts the first printed page — which takes the
          document's default portrait @page. The certificate's own named
          landscape page then had nowhere to apply, and an A4 landscape
          sheet came out of the printer on portrait paper. Nothing may
          precede the sheet. */}
      <section className="band light tight no-print" data-tone="light" style={{ paddingBottom: 0 }}>
        <div className="wrap">
          <div className="cert-head">
            <div>
              <span className="ann flat">
                <b>Certificate</b> of {cert.typeLabel || 'Award'}
              </span>
              <h1 className="display-lead sm">{cert.recipientName}</h1>
              <p className="t-base mono-id">{cert.certificateId}</p>
            </div>
            <span style={{ flex: 1 }} />
            <div className="acts" style={{ marginTop: 0 }}>
              <Link className="btn ghost" to={`/verify/${cert.certificateId}`}>Verify this</Link>
              <button className="btn" type="button" onClick={() => window.print()}>
                Print / Save as PDF
              </button>
            </div>
          </div>

          {cert.revoked ? (
            <div className="verdict bad mt-6">
              <span className="vico"><IconAlert /></span>
              <div>
                <h3>This certificate has been withdrawn</h3>
                <p>{cert.revokedReason || 'It should no longer be relied upon.'}</p>
              </div>
            </div>
          ) : (
            <div className="verdict good mt-6">
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
