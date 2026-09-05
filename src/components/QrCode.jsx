import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR code as inline SVG — no canvas, no image, so it stays sharp at print
 * resolution and costs nothing to render.
 *
 * Runs of dark modules are merged along each row, which turns roughly 800
 * rects into about 280. That matters when thirty certificates are on one page.
 */
export default function QrCode({ value, className, title = 'QR code', ...rest }) {
  const model = useMemo(() => {
    if (!value) return null;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(String(value));
      qr.make();
      const n = qr.getModuleCount();
      const rects = [];
      for (let row = 0; row < n; row++) {
        let start = -1;
        for (let col = 0; col <= n; col++) {
          const dark = col < n && qr.isDark(row, col);
          if (dark && start === -1) start = col;
          if (!dark && start !== -1) {
            rects.push(<rect key={`${row}-${start}`} x={start} y={row} width={col - start} height="1" />);
            start = -1;
          }
        }
      }
      return { n, rects };
    } catch {
      return null;
    }
  }, [value]);

  if (!model) return null;
  return (
    <svg
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${model.n} ${model.n}`}
      shapeRendering="crispEdges"
      {...rest}
    >
      <rect x="0" y="0" width={model.n} height={model.n} fill="#fff" />
      <g fill="currentColor">{model.rects}</g>
    </svg>
  );
}
