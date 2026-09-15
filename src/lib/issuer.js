/**
 * Who issued a certificate — recorded on it, not looked up afterwards.
 *
 * A certificate names the body that awarded it, and until now the sheet read
 * that name live from `ISSUER` every time somebody opened it. That is fine
 * for as long as the name never changes, and wrong the moment it does: on
 * the day this school rebrands, every certificate ever issued silently starts
 * claiming to come from an organisation that did not exist when it was
 * awarded. An employer checking a 2025 certificate would see a 2026 name.
 *
 * So the issuer is STAMPED onto the record when the certificate is issued,
 * and the sheet prefers what is stamped. A record made before this existed
 * has no stamp and falls back to the live constant, which is what the
 * backfill is for.
 *
 * ── Why the old wording is frozen in code ────────────────────────────────
 *
 * The obvious backfill reads `ISSUER` and writes it onto every certificate
 * that lacks a stamp. That is correct only if it is run BEFORE the rebrand,
 * and silently destroys the thing it was built to protect if it is run
 * after — stamping the new name onto old certificates, permanently, with no
 * way back.
 *
 * `LEGACY_ISSUER` removes the ordering trap. It is the exact wording every
 * certificate carried up to the rebrand, written down once, so the backfill
 * stamps the truth whenever it is run.
 */

import { ISSUER } from './schema.js';

/**
 * The issuer as it was printed on every certificate up to the 2026 rebrand.
 *
 * DO NOT EDIT. This is not configuration — it is a record of what is already
 * on paper in other people's hands. Changing it does not change those; it
 * only makes this app describe them wrongly.
 */
export const LEGACY_ISSUER = Object.freeze({
  name: 'Islamic Information Centre',
  unit: 'Beyond Guidance',
  operator: 'Al-Majeed School of Research Methodology and Innovation',
});

/**
 * The fields an issuer stamp carries. An allow-list, not a copy of ISSUER.
 *
 * `unitLine` and `association` joined the list at the rebrand. A stamp made
 * before them simply has neither, which is why every field is filled with an
 * empty string rather than left out: a legacy record goes on printing
 * exactly what it printed, and the two new lines are not invented for it.
 */
export const STAMP_FIELDS = ['name', 'unit', 'unitLine', 'operator', 'association'];

/** The stamp to write onto a record issued now. */
export function issuerStamp(source = ISSUER) {
  const out = {};
  for (const key of STAMP_FIELDS) out[key] = String(source?.[key] ?? '');
  return out;
}

/** Whether a record already says who issued it. */
export function hasIssuerStamp(cert) {
  const stamp = cert?.issuer;
  return Boolean(stamp && typeof stamp === 'object' && String(stamp.name || '').trim());
}

/**
 * Who to print on this certificate.
 *
 * The stamp if there is one, the live constant if not. Never a mixture: a
 * half-stamped record showing last year's school beside this year's unit
 * would be worse than either.
 */
export function certificateIssuer(cert, fallback = ISSUER) {
  return hasIssuerStamp(cert) ? issuerStamp(cert.issuer) : issuerStamp(fallback);
}

/**
 * The two lines the sheet prints, built here rather than in the component.
 *
 * `association` is optional and only appears once there is something to say:
 * an empty line reading "In association with" is worse than no line.
 */
export function issuerLines(issuer) {
  const name = String(issuer?.name || '').trim();
  const unit = String(issuer?.unit || '').trim();
  const unitLine = String(issuer?.unitLine || '').trim();
  const operator = String(issuer?.operator || '').trim();
  const association = String(issuer?.association || '').trim();

  // Two shapes, because two eras. A record from before the rebrand has a
  // unit and no by-line, and prints the way it always did; one from after
  // leads with the brand and carries the school underneath. Neither is
  // rewritten into the other.
  const lead = unit && name ? `${unit} · A Unit of ${name}` : (unit || name);
  // A legacy record has no `association` field and named the school on this
  // line. Preferring `association` and falling back to `operator` keeps that
  // line exactly as it was printed — dropping it would have quietly rewritten
  // the certificates this whole mechanism exists to leave alone.
  const withList = association || operator;

  return {
    lead,
    by: unitLine,
    association: withList ? `In association with ${withList}` : '',
  };
}
