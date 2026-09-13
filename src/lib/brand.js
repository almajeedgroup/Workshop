/**
 * The brand: WORKSHOP, by Al-Majeed School of Research Methodology and
 * Innovation.
 *
 * The mark is the word WORKSHOP with its second O drawn as a centred dot,
 * WORK in near-black and SH•P in lime. It is set as REAL TEXT rather than an
 * image, so it stays selectable, scales without blurring, prints, and reads
 * as "Workshop" to anybody using a screen reader.
 *
 * THE WORD IS SPLIT HERE, ONCE. A mark assembled by hand in five places is a
 * mark that ends up spelled four ways — this file is the only thing that
 * knows WORK and SH_P go together, and a test joins them back up to prove
 * they still spell the name.
 *
 * ── On the lime ──────────────────────────────────────────────────────────
 * #32CD32 is 2.12 to one against white, so it is a WORDMARK and a FILL, and
 * never body text. A logotype is exempt from the contrast floor — WCAG says
 * so explicitly — which is why the mark may use it and a paragraph may not.
 *
 * It is a LIGHT colour, which decides everything built on it: nothing white
 * can sit on lime, and near-black on it is 9.35 to one. That is why the
 * public site's primary button is lime carrying ink — the button is drawn
 * the same way the mark is. When lime has to be READ rather than filled,
 * site.css takes it down to --lime-ink at 6.4 to one.
 *
 * The admin tool keeps its own five colours. Its jade (#00CA72) already
 * means "the action that moves work forward" and every attendance mark,
 * console tile and status pill is keyed to that name in data rather than in
 * CSS, so swapping it is a rename across the app and not a palette change.
 */

import { ISSUER } from './schema.js';

/** Near-black, the same ink the rest of the app writes in. */
export const BRAND_INK = '#0A0A0A';

/** Classic lime green. 2.12:1 on white; 9.35:1 with near-black on top. */
export const BRAND_LIME = '#32CD32';

/**
 * The word, in the three pieces the mark is drawn from.
 *
 * `head` is the dark half. `tail` is the lime half, split either side of the
 * dot that stands in for its O.
 */
export const WORDMARK = { head: 'WORK', tail: ['SH', 'P'], dot: 'O' };

/** The name as a plain string, for a title, an email subject, a file name. */
export const BRAND_NAME = `${WORDMARK.head}${WORDMARK.tail[0]}${WORDMARK.dot}${WORDMARK.tail[1]}`;

/** How it is said out loud, and read out by a screen reader. */
export const BRAND_SPOKEN = 'Workshop';

/**
 * The full lockup.
 *
 * Takes the operator from `ISSUER` rather than repeating it, because that
 * constant exists precisely to stop the school's name being written three
 * different ways across the code.
 */
export function brandLockup(operator = ISSUER.operator) {
  return `${BRAND_NAME} by ${operator}`;
}

/** Just the second line of the lockup. */
export function brandBy(operator = ISSUER.operator) {
  return `by ${operator}`;
}

/**
 * What goes in the browser tab.
 *
 * The page first, the brand second: somebody with nine tabs open is looking
 * for "Attendance", and nine tabs all beginning WORKSHOP tell them nothing.
 */
export function brandTitle(page = '') {
  const label = String(page ?? '').trim();
  return label ? `${label} · ${BRAND_NAME}` : BRAND_NAME;
}

/**
 * How far the dot sits above the baseline, as a fraction of the font size.
 *
 * MEASURED, NOT GUESSED — and the guess was wrong. Anton's capital O was
 * assumed to sit 0.352em above the baseline; rendered and measured against a
 * real O it is 0.422em, which put the first dot four and a half pixels low at
 * 64px. Low enough to look like a full stop that had slipped rather than a
 * letter.
 *
 * The dot is 0.30em across, so its own centre already starts 0.15em up and
 * has to rise the difference. The figure lives here rather than in the
 * stylesheet so a test can hold it against a rendered O instead of trusting
 * it.
 */
export const DOT_DIAMETER_EM = 0.30;
export const CAP_CENTRE_EM = 0.422;
export const DOT_RISE_EM = +(CAP_CENTRE_EM - DOT_DIAMETER_EM / 2).toFixed(3);

/** The tones the mark may be drawn in. Anything else is a typo. */
export const WORDMARK_TONES = ['brand', 'mono', 'invert'];

export function wordmarkTone(tone) {
  return WORDMARK_TONES.includes(tone) ? tone : 'brand';
}
