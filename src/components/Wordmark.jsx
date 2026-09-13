import {
  WORDMARK, BRAND_SPOKEN, brandBy, wordmarkTone,
} from '../lib/brand.js';

/**
 * WORKSH•P.
 *
 * Real text, not an image: it stays selectable, scales to any size without
 * blurring, prints as type rather than a picture, and reads as "Workshop"
 * rather than as three fragments.
 *
 * The dot that stands in for the second O is an empty span, hidden from
 * assistive technology — the accessible name comes from the label on the
 * whole mark, so a screen reader says the word once and does not try to
 * pronounce a circle.
 *
 *   tone="brand"   WORK in ink, SH•P in lime          (the default)
 *   tone="mono"    all of it in whatever colour it inherits
 *   tone="invert"  for dark grounds: WORK in paper, SH•P in lime
 *
 * `lockup` adds the second line — by Al-Majeed School of Research
 * Methodology and Innovation — which is how the mark appears anywhere it is
 * introducing itself rather than just labelling a page.
 */
export default function Wordmark({
  tone = 'brand',
  lockup = false,
  as: Tag = 'span',
  className = '',
  ...rest
}) {
  const mark = (
    <span className={`wm wm-${wordmarkTone(tone)}`} role="img" aria-label={BRAND_SPOKEN}>
      <span className="wm-head">{WORDMARK.head}</span>
      <span className="wm-tail">
        {WORDMARK.tail[0]}
        <span className="wm-dot" aria-hidden="true" />
        {WORDMARK.tail[1]}
      </span>
    </span>
  );

  if (!lockup) {
    return <Tag className={`wm-wrap ${className}`.trim()} {...rest}>{mark}</Tag>;
  }

  return (
    <Tag className={`wm-wrap wm-lockup ${className}`.trim()} {...rest}>
      {mark}
      <span className="wm-by">{brandBy()}</span>
    </Tag>
  );
}
