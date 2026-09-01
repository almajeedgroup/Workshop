/**
 * Participant ID cards.
 *
 * One card design, several colourways, and a choice of which organisations'
 * crests appear. Both are settled when the course is established, so every
 * card printed for that course matches without anyone deciding again.
 *
 * The card is CR80 portrait — 54mm x 85.6mm, the size of a bank card turned
 * on its end, which is what every lanyard holder on sale is cut for. Front
 * carries the person, back carries the course.
 *
 * Everything the card shows is resolved through `cardFace()`, so the printed
 * sheet, the single-card page and the organiser's editor cannot drift apart.
 */

import { ISSUER, isFreeWorkshop, BLOOD_GROUPS } from './schema.js';
import { formatDate, formatDateRange } from './tickets.js';

/* ------------------------------------------------------------------ *
 * Colourways
 * ------------------------------------------------------------------ */

/**
 * Each theme is a band colour, the ink that stays legible on it, and a wash
 * for the body. `band` is what the eye reads across a room, so the themes are
 * pulled apart in hue rather than shade — two cards must be distinguishable
 * on a corridor noticeboard, not just side by side.
 *
 * Every `band`/`onBand` pair clears 4.5:1, so the name on the card is legible
 * to someone who does not see colour the way you do.
 */
export const ID_CARD_THEMES = [
  {
    key: 'saffron', label: 'Saffron',
    band: '#B4430A', onBand: '#FFFFFF', wash: '#FFF6EE', accent: '#8A3208', ink: '#2A1508',
  },
  {
    key: 'emerald', label: 'Emerald',
    band: '#0A6B37', onBand: '#FFFFFF', wash: '#EEF9F1', accent: '#07502A', ink: '#082415',
  },
  {
    key: 'indigo', label: 'Indigo',
    band: '#26357A', onBand: '#FFFFFF', wash: '#F0F2FB', accent: '#1A2557', ink: '#101632',
  },
  {
    key: 'maroon', label: 'Maroon',
    band: '#7A1B32', onBand: '#FFFFFF', wash: '#FCF0F2', accent: '#5A1224', ink: '#2E0C15',
  },
  {
    key: 'teal', label: 'Teal',
    band: '#0B5A66', onBand: '#FFFFFF', wash: '#EDF7F8', accent: '#08424B', ink: '#07242A',
  },
  {
    key: 'slate', label: 'Slate',
    band: '#2E3440', onBand: '#FFFFFF', wash: '#F3F4F6', accent: '#1E222B', ink: '#15181F',
  },
];

export const DEFAULT_ID_CARD_THEME = 'indigo';

export const idCardThemeByKey = Object.fromEntries(ID_CARD_THEMES.map((t) => [t.key, t]));

/** The chosen colourway, or the default if the key is unknown or unset. */
export function cardTheme(workshop) {
  return idCardThemeByKey[workshop?.idCardTheme] || idCardThemeByKey[DEFAULT_ID_CARD_THEME];
}

/* ------------------------------------------------------------------ *
 * Crests
 * ------------------------------------------------------------------ */

/**
 * The four organisations whose crests a card may carry. `key` is what is
 * stored on the workshop; the file and the name live here so renaming an
 * organisation never invalidates saved data.
 */
export const ID_CARD_CRESTS = [
  { key: 'almajeed', label: 'Al-Majeed School', src: '/crests/al-majeed.png', alt: 'Al-Majeed School of Research, Methodology and Innovation' },
  { key: 'kabir', label: 'Kabir IND PU College', src: '/crests/kabir-college.png', alt: 'Kabir IND PU College for Women' },
  { key: 'iic', label: 'Islamic Information Centre', src: '/crests/islamic-information-centre.png', alt: 'Islamic Information Centre' },
  { key: 'beyond', label: 'Beyond Guidance', src: '/crests/beyond-guidance.png', alt: 'Beyond Guidance' },
];

export const idCardCrestByKey = Object.fromEntries(ID_CARD_CRESTS.map((c) => [c.key, c]));

/** Which organisations are named on the card, as options for the picker. */
export const ID_CARD_CREST_OPTIONS = ID_CARD_CRESTS.map((c) => ({ value: c.key, label: c.label }));

/**
 * The crests to print, in the order the organiser arranged them.
 *
 * Order is the organiser's to set, not the catalogue's. Which crest leads is
 * a statement about who is hosting — a course run by the college with the
 * centre supporting it should not be forced to print them the other way
 * round.
 *
 * Unknown keys are dropped rather than left as gaps, and a key repeated by a
 * bad edit is printed once. A workshop saved before this field existed has
 * nothing set: it gets all four in catalogue order, which is what the
 * certificate already prints, rather than a blank strip.
 */
export function cardCrests(workshop) {
  const chosen = workshop?.idCardCrests;
  if (!Array.isArray(chosen) || chosen.length === 0) return ID_CARD_CRESTS;
  const seen = new Set();
  const kept = [];
  for (const key of chosen) {
    const crest = idCardCrestByKey[key];
    if (crest && !seen.has(key)) { seen.add(key); kept.push(crest); }
  }
  return kept.length ? kept : ID_CARD_CRESTS;
}

/* ------------------------------------------------------------------ *
 * What each face shows
 * ------------------------------------------------------------------ */

export const DEFAULT_CARD_LABEL = 'PARTICIPANT';

export { BLOOD_GROUPS };

function clean(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/**
 * Everything printed on both faces, resolved from the workshop, the
 * registration and the organisation.
 *
 * The organiser's per-person overrides win over the course-wide setting,
 * which wins over the organisation default. That order is what makes a card
 * editable without making every card a special case: change nothing and a
 * course of forty prints identically; change one person's role and only
 * theirs differs.
 */
export function cardFace(workshop, reg) {
  const w = workshop || {};
  const r = reg || {};
  const free = isFreeWorkshop(w);

  return {
    theme: cardTheme(w),
    crests: cardCrests(w),

    // --- front: the person -----------------------------------------
    org: clean(w.presentedBy) || ISSUER.unitLine || ISSUER.name,
    label: clean(r.idRole) || clean(w.idCardLabel) || DEFAULT_CARD_LABEL,
    name: clean(r.name) || '—',
    ticketId: clean(r.ticketId),
    photo: clean(r.photo),
    rows: [
      ['Qualification', clean(r.qualification)],
      ['Course', clean(r.courseName)],
      ['Area', clean(r.area)],
      ['Date of Birth', formatDate(r.dob)],
      ['Blood Group', clean(r.bloodGroup)],
    ].filter(([, v]) => v),

    // --- back: the course ------------------------------------------
    title: clean(w.title) || 'Workshop',
    backRows: [
      ['Dates', formatDateRange(w)],
      ['Time', clean(w.time)],
      ['Venue', clean(w.venue)],
      ['Mode', clean(w.mode)],
      ['Fee', free ? 'Free' : (Number(w.feeAmount) ? `₹${Number(w.feeAmount)}` : '')],
      ['In association with', clean(w.collaborators)],
    ].filter(([, v]) => v),

    validUntil: clean(r.idValidUntil) || clean(w.endDate) || clean(w.startDate),
    emergency: clean(r.emergencyContact),
    note: clean(w.idCardNote),
    phones: ISSUER.phones,
    site: ISSUER.site,
  };
}

/**
 * Cards per printed A4 sheet.
 *
 * Three by three at 54mm x 85.6mm with 4mm gutters comes to 170mm x 265mm,
 * which leaves 20mm side and 16mm head margins on A4 portrait — inside what
 * every office printer can reach. Four rows would need 342mm and does not
 * fit on the page at all.
 *
 * Fronts and backs print on separate sheets in the SAME grid position, not
 * duplexed. Card stock at this scale goes into a laminating pouch as two
 * pieces anyway, and two sheets in identical order cannot be collated wrong
 * — whereas a manual duplex flip silently pairs each back with the card from
 * the opposite column.
 */
export const CARDS_PER_SHEET = 9;

/**
 * Split a list of people into sheet-sized pages.
 *
 * Anything that is not a positive count falls back to a full sheet. Clamping
 * to 1 instead — which is what `Math.max(1, …)` did — turned a bad argument
 * into forty single-card pages rather than a visible error.
 */
export function paginateCards(list, perSheet = CARDS_PER_SHEET) {
  const asked = Number(perSheet);
  const size = Number.isFinite(asked) && asked >= 1 ? Math.floor(asked) : CARDS_PER_SHEET;
  const pages = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages;
}
