import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The recipient's name, shrunk until it fits on one line.
 *
 * A certificate is a fixed sheet, and the name is the one thing on it whose
 * length nobody controls. At a fixed size a long one wrapped to three lines,
 * pushed the signatures through the frame, and took the certificate ID and
 * the QR code off the bottom of the page entirely — so the sheet lost the
 * two things that make it verifiable.
 *
 * It is MEASURED rather than estimated. Width does not follow character
 * count in a script face: "SYED RAYYAN HASANI" sets 170mm wide where "Syed
 * Rayyan Hasani" sets 129mm — the same eighteen characters. A weighted guess
 * was 12% out on ordinary names, which is the difference between fitting and
 * not.
 */
export default function FittedName({ text, className = 'name', max = 44, min = 14 }) {
  const ref = useRef(null);
  const [size, setSize] = useState(max);

  const inner = useRef(null);

  useLayoutEffect(() => {
    const box = ref.current;
    const span = inner.current;
    if (!box || !span) return undefined;
    let live = true;

    const fit = () => {
      if (!live || !box || !span) return;
      // The box centres its text with flexbox, where scrollWidth does not
      // report the overflow. Measuring the span against the box's content
      // width is unambiguous either way.
      const room = box.clientWidth - 2;   // a hair, so a just-fitting name is not clipped
      let pt = max;
      box.style.fontSize = `${pt}pt`;
      // Half a point at a time: a whole point leaves a visible step between
      // two names of nearly the same length.
      while (pt > min && span.getBoundingClientRect().width > room) {
        pt -= 0.5;
        box.style.fontSize = `${pt}pt`;
      }
      setSize(pt);
    };

    fit();
    // The script face arrives after first paint. Measuring before it lands
    // measures the fallback, which is a different width entirely.
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});
    return () => { live = false; };
  }, [text, max, min]);

  return (
    <div ref={ref} className={className} style={{ fontSize: `${size}pt` }}>
      <span ref={inner}>{text}</span>
    </div>
  );
}
