import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCertificate } from '../lib/certdb.js';
import CertificateDocument from '../components/CertificateDocument.jsx';
import CertificateStage from '../components/CertificateStage.jsx';
import { verifyUrlFor } from '../lib/certlinks.js';

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

  if (loading) return <main><p className="count">Loading…</p></main>;
  if (loadError) {
    return (
      <main>
        <div className="notice warn">{loadError}</div>
        <Link className="btn" to="/verify">Check another certificate</Link>
      </main>
    );
  }

  return (
    <main>
      <div className="page-head no-print">
        <div>
          <h1>{cert.typeLabel || 'Certificate'}</h1>
          <div className="count" style={{ marginTop: 4 }}>
            {cert.recipientName} · {cert.certificateId}
          </div>
        </div>
        <span className="spacer" />
        <div className="btn-row">
          <Link className="btn" to={`/verify/${cert.certificateId}`}>Verify</Link>
          <button onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      {cert.revoked && (
        <div className="notice warn no-print">
          <strong>This certificate has been withdrawn.</strong>{' '}
          {cert.revokedReason || 'It should no longer be relied upon.'}
        </div>
      )}

      <CertificateStage>
        <CertificateDocument cert={cert} verifyUrl={verifyUrlFor(cert.certificateId)} />
      </CertificateStage>
    </main>
  );
}
