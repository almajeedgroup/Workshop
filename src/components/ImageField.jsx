import { useRef, useState } from 'react';
import { readImageAsDataUrl } from '../lib/imagefile.js';

/**
 * Pick a picture from this machine and keep it on the record.
 *
 * Also accepts a path or URL typed in by hand, because the payment QR can
 * equally be a file shipped in `public/`. Whichever is set, the public page
 * reads the same field.
 */
export default function ImageField({ id, value, onChange, hint }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const stored = typeof value === 'string' ? value : '';
  const isUpload = stored.startsWith('data:');

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await readImageAsDataUrl(file));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <div className="btn-row" style={{ alignItems: 'center' }}>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Reading…' : stored ? 'Choose a different image' : 'Choose an image'}
        </button>
        {stored && (
          <button type="button" className="small" onClick={() => { onChange(''); setError(''); }}>
            Remove
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {!isUpload && (
        <input
          id={id}
          value={stored}
          placeholder="…or a path such as /payment-qr.png"
          onChange={(e) => onChange(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}

      {stored && (
        <div style={{ marginTop: 10 }}>
          <img
            src={stored}
            alt="Selected image"
            style={{
              width: 150, height: 150, objectFit: 'contain', background: '#fff',
              border: 'var(--hair, 1px solid #ddd)', borderRadius: 8, display: 'block',
            }}
          />
          <div className="hint" style={{ marginTop: 6 }}>
            {isUpload
              ? 'Stored on this workshop — no file to copy, no deploy needed.'
              : 'Read from the site’s files. It must exist there, or nothing will show.'}
          </div>
        </div>
      )}

      {error && <div className="hint" style={{ color: 'var(--bad, #a00)', marginTop: 6 }}>{error}</div>}
      {hint && <div className="hint">{hint}</div>}
    </>
  );
}
