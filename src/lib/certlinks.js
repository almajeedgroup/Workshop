/** Where a certificate's QR code and printed address point. */
export function siteOrigin() {
  if (typeof window !== 'undefined' && window.location) return window.location.origin;
  return '';
}

export function verifyUrlFor(certificateId) {
  const id = String(certificateId || '').trim();
  return id ? `${siteOrigin()}/verify/${encodeURIComponent(id)}` : '';
}

export function certificateUrlFor(certificateId) {
  const id = String(certificateId || '').trim();
  return id ? `${siteOrigin()}/c/${encodeURIComponent(id)}` : '';
}
