import { useEffect, useRef, useState } from 'react';

/** An A4 landscape sheet is 1123px wide. Scale it down to fit the screen. */
const SHEET_PX = (297 / 25.4) * 96;

/**
 * Shows certificate sheets at whatever size the screen allows, and at full
 * size when printing — the scaling is a screen affordance only, so a phone
 * can show the whole certificate rather than a corner of it.
 */
export default function CertificateStage({ children }) {
  const box = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / SHEET_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="cert-scope">
      <div ref={box} className="cert-stage">
        <div
          className="cert-fit"
          style={{ transform: `scale(${scale})`, height: scale < 1 ? `${210 * scale}mm` : undefined }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
