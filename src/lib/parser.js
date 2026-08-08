/**
 * Rule-based text -> structured record parser.
 *
 * No AI, no network. Everything here is deterministic pattern matching driven
 * by the alias lists in schema.js. If something isn't picked up correctly, the
 * fix is almost always "add the label variant to `aliases`".
 *
 * Handles:
 *   Label: value                     any alias, with or without WhatsApp *bold*
 *   Label - value                    dash separator
 *   Label value                      no separator ("held on 03/09/2025")
 *   emoji-prefixed poster lines      📅 date, ⏰ time, 📍 venue, 💰 fee …
 *   multi-line values                continuation lines are appended
 *   registration blocks              repeated "*Name:* …" WhatsApp replies
 *   registration tables              tab / pipe / comma / wide-space separated
 *   several records in one paste     separated by --- or a repeated Title:
 */

import {
  WORKSHOP_FIELDS,
  REGISTRATION_FIELDS,
  REGISTRATION_POSITIONAL_ORDER,
  workshopFieldByKey,
  registrationFieldByKey,
  emptyWorkshop,
  emptyRegistration,
  PAYMENT_STATUSES,
} from './schema.js';

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** "No. of Participants" -> "no of participants" */
export function normalizeKey(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Emoji, pictographs, variation selectors and ZWJ sequences. */
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}\u{2600}-\u{27BF}]/gu;

function cleanText(s) {
  return String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+$/gm, '');
}

/** Strip WhatsApp formatting markers (*bold*, _italic_, ~strike~). */
function stripMarkup(s) {
  return String(s ?? '').replace(/[*_~`]/g, '').trim();
}

/** Strip "1." / "1)" / "(1)" / "- " / "• " from the front of a line. */
function stripBullet(line) {
  return line.replace(/^\s*(?:[-*•▪◦·]|\(?\d{1,3}\)?[.)])\s+/, '');
}

/** Leading emoji act as field hints, so capture then remove them. */
function leadingEmoji(line) {
  const m = line.trim().match(/^((?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{2BFF}\u{FE0F}\u{200D}]+))/u);
  return m ? m[1] : '';
}

function stripEmoji(s) {
  return String(s ?? '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** Digits-only phone with an Indian country code, suitable for wa.me links. */
export function normalizePhone(v, defaultCC = '91') {
  let d = String(v ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length > 10 && d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = defaultCC + d;
  return d;
}

/* ------------------------------------------------------------------ *
 * Alias indexes
 * ------------------------------------------------------------------ */

function buildAliasIndex(fields) {
  const map = new Map();
  for (const f of fields) {
    map.set(normalizeKey(f.label), f.key);
    for (const a of f.aliases || []) map.set(normalizeKey(a), f.key);
  }
  return map;
}

const WORKSHOP_ALIAS = buildAliasIndex(WORKSHOP_FIELDS);
const REG_ALIAS = buildAliasIndex(REGISTRATION_FIELDS);

/** Labels that introduce a registration *table* rather than a scalar value. */
const REG_SECTION = new Set(
  [
    'registrations', 'registration', 'registered', 'registrants',
    'participants', 'participant', 'participant list', 'participants list',
    'list of participants', 'name of participants', 'names of participants',
    'candidates', 'candidate list', 'students', 'student list',
    'attendees', 'attendee list', 'list of attendees', 'delegates',
    'attendance sheet', 'attendance list',
  ].map(normalizeKey)
);

/**
 * Emoji -> field, for pasting a promotional poster straight in.
 * Only consulted when the line carries no recognisable text label.
 */
const EMOJI_HINTS = [
  [/[\u{1F4C5}\u{1F5D3}\u{1F4C6}]/u, 'startDate'],   // 📅 🗓 📆
  [/[\u{23F0}\u{1F550}-\u{1F567}\u{23F1}]/u, 'time'], // ⏰ 🕐-🕧
  [/[\u{1F4CD}\u{1F3E2}\u{1F3EB}]/u, 'venue'],        // 📍 🏢 🏫
  [/[\u{1F4B0}\u{1F4B5}\u{1F4B8}\u{1F4B3}]/u, 'feeAmount'], // 💰 💵 💸 💳
  [/[\u{1F393}\u{1F469}\u{1F468}]/u, 'audience'],     // 🎓 👩‍🎓 👨‍🎓
  [/[\u{1F4DE}\u{1F4F1}\u{260E}]/u, 'contactNumbers'],// 📞 📱 ☎
  [/[\u{1F680}]/u, 'title'],                          // 🚀
  [/[\u{1F4A1}\u{1F3AF}]/u, 'topics'],                // 💡 🎯
  [/[\u{26A0}\u{1F525}]/u, 'seatLimit'],              // ⚠ 🔥
];

function emojiHint(emoji) {
  if (!emoji) return null;
  for (const [re, key] of EMOJI_HINTS) if (re.test(emoji)) return key;
  return null;
}

/* ------------------------------------------------------------------ *
 * Date parsing
 * ------------------------------------------------------------------ */

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function iso(y, m, d) {
  if (!y || !m || !d) return '';
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  if (y < 100) y += y < 50 ? 2000 : 1900;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Find every date-looking token in a string, in order of appearance. */
function findDates(str) {
  const found = [];
  const push = (index, value) => { if (value) found.push({ index, value }); };
  let m;

  const isoRe = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  while ((m = isoRe.exec(str))) push(m.index, iso(+m[1], +m[2], +m[3]));

  // 12/05/2025, 12-05-25, 12.05.2025 — day-first (Indian convention)
  const numRe = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g;
  while ((m = numRe.exec(str))) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) { [d, mo] = [mo, d]; } // was month-first
    push(m.index, iso(+m[3], mo, d));
  }

  // 12 May 2025 / 12th of May, 2025
  const dmyRe = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?\s*(\d{4})?\b/g;
  while ((m = dmyRe.exec(str))) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) push(m.index, iso(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[1]));
  }

  // May 12, 2025
  const mdyRe = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/g;
  while ((m = mdyRe.exec(str))) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) push(m.index, iso(m[3] ? +m[3] : new Date().getFullYear(), mo, +m[2]));
  }

  const seen = new Set();
  return found
    .sort((a, b) => a.index - b.index)
    .map((x) => x.value)
    .filter((v) => v && !seen.has(v) && seen.add(v));
}

/** Parse a date string that may express a single date or a range. */
export function parseDateRange(raw) {
  const str = stripEmoji(String(raw ?? '')).trim();
  if (!str) return { start: '', end: '' };

  // "15th – 22nd August 2026" — one month and year shared by both days
  const shared = str.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|—|to|and|&)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s*(\d{4})?/i
  );
  if (shared) {
    const mo = MONTHS[shared[3].toLowerCase()];
    if (mo) {
      const y = shared[4] ? +shared[4] : new Date().getFullYear();
      return { start: iso(y, mo, +shared[1]), end: iso(y, mo, +shared[2]) };
    }
  }

  const dates = findDates(str);
  if (dates.length === 0) return { start: '', end: '' };
  if (dates.length === 1) return { start: dates[0], end: '' };
  return { start: dates[0], end: dates[dates.length - 1] };
}

/* ------------------------------------------------------------------ *
 * Value coercion
 * ------------------------------------------------------------------ */

function toNumber(v) {
  const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : '';
}

function toMode(v) {
  const s = String(v ?? '').toLowerCase();
  if (/hybrid|blended|both/.test(s)) return 'Hybrid';
  if (/online|virtual|zoom|google meet|gmeet|teams|webinar/.test(s)) return 'Online';
  if (/offline|physical|in person|in-person|onsite|on site|campus|direct/.test(s)) return 'Offline';
  return '';
}

function toPaymentStatus(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (/^(paid|done|yes|y|complete|completed|received|success|1)$/.test(s)) return 'Paid';
  if (/^(pending|not done|no|n|unpaid|due|0)$/.test(s)) return 'Pending';
  if (/waive/.test(s)) return 'Waived';
  if (/refund/.test(s)) return 'Refunded';
  const hit = PAYMENT_STATUSES.find((p) => p.toLowerCase() === s);
  return hit || '';
}

function toList(v) {
  const s = String(v ?? '').trim();
  if (!s) return [];
  let parts;
  if (s.includes('\n')) parts = s.split('\n');
  else if (s.includes(';')) parts = s.split(';');
  else parts = s.split(/,| and | & /i);
  return parts.map((p) => stripBullet(stripEmoji(p)).trim()).filter(Boolean);
}

function coerce(field, rawValue) {
  switch (field.type) {
    case 'number': return toNumber(rawValue);
    case 'enum':
      if (field.key === 'mode') return toMode(rawValue);
      if (field.key === 'paymentStatus') return toPaymentStatus(rawValue);
      return String(rawValue ?? '').trim();
    case 'list': return toList(rawValue);
    case 'date': return parseDateRange(rawValue).start;
    case 'tel': return String(rawValue ?? '').replace(/[^\d+\s-]/g, '').trim();
    case 'email': {
      const m = String(rawValue ?? '').match(EMAIL_RE);
      return m ? m[0] : String(rawValue ?? '').trim();
    }
    default: return stripEmoji(String(rawValue ?? '')).trim();
  }
}

/* ------------------------------------------------------------------ *
 * Key/value line matching
 * ------------------------------------------------------------------ */

const EMAIL_RE = /[^\s,;|<>()]+@[^\s,;|<>()]+\.[a-z]{2,}/i;
const PHONE_RE = /^[+(]?\d[\d\s\-().]{6,}$/;
/** A cell that is nothing but a date — used to spot DoB in headerless rows. */
const DOB_RE =
  /^(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})$/;

const KV_COLON = /^\s*(?:[-*•▪]\s*)?(?:\(?\d{1,3}\)?[.)]\s*)?([^:\n]{2,60}?)\s*:\s*(.*)$/;
const KV_DASH = /^\s*(?:[-*•▪]\s*)?(?:\(?\d{1,3}\)?[.)]\s*)?([A-Za-z][A-Za-z0-9 ./&()#]{1,50}?)\s+[-–—]\s+(.*)$/;

function matchKeyValue(line) {
  const bare = stripEmoji(line);
  let m = bare.match(KV_COLON);
  if (m) return { rawKey: stripMarkup(m[1]), value: stripMarkup(m[2]) };
  m = bare.match(KV_DASH);
  if (m) return { rawKey: stripMarkup(m[1]), value: stripMarkup(m[2]) };
  return null;
}

/**
 * Recognise a label written WITHOUT a separator — "held on 03/09/2025",
 * "timings 10:00 AM - 1:00 PM". Tries the longest leading phrase first.
 * Also rescues lines whose value contains a colon, where KV_COLON
 * mis-splits ("timings 10:00 AM" -> key "timings 10").
 */
function matchAliasPrefix(line, aliasMap) {
  const words = stripBullet(stripMarkup(stripEmoji(line))).split(/\s+/).filter(Boolean);
  const max = Math.min(5, words.length - 1);
  for (let k = max; k >= 1; k--) {
    const key = aliasMap.get(normalizeKey(words.slice(0, k).join(' ')));
    if (!key) continue;
    const rest = words.slice(k).join(' ').replace(/^[:\-–—,]+\s*/, '').trim();
    if (rest) return { key, value: rest };
  }
  return null;
}

/** Typed fields never span multiple lines, so they close the continuation. */
function isTypedField(field) {
  return field && ['date', 'number', 'enum', 'tel', 'email'].includes(field.type);
}

/** Fields that accumulate across several lines rather than being overwritten. */
function isAppendable(field) {
  return field && (field.type === 'longtext' || field.type === 'list');
}

/* ------------------------------------------------------------------ *
 * Registration parsing
 * ------------------------------------------------------------------ */

function detectDelimiter(lines) {
  const sample = lines.slice(0, 12);
  if (sample.some((l) => l.includes('\t'))) return '\t';
  if (sample.some((l) => l.includes('|'))) return '|';
  const commaLines = sample.filter((l) => (l.match(/,/g) || []).length >= 1).length;
  if (commaLines >= Math.max(1, Math.ceil(sample.length * 0.6))) return ',';
  if (sample.some((l) => /\S {2,}\S/.test(l))) return 'spaces';
  return null;
}

/**
 * Split on `delim`, honouring "quoted, cells" so a genuine CSV export pastes
 * cleanly. Doubled quotes inside a quoted cell mean one literal quote.
 */
function splitQuoted(line, delim) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') cur += c;
      else if (line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function splitRow(line, delim) {
  if (delim === 'spaces') return line.split(/\s{2,}/);
  if (delim === null) return [line];
  if (delim === ',' || line.includes('"')) return splitQuoted(line, delim);
  return line.split(delim);
}

function headerMap(cells) {
  const map = {};
  let hits = 0;
  cells.forEach((cell, i) => {
    const key = REG_ALIAS.get(normalizeKey(stripMarkup(cell)));
    if (key && !(key in map)) { map[key] = i; hits++; }
  });
  return hits >= 2 ? map : null;
}

/* ------------------------------------------------------------------ *
 * Column alignment
 *
 * An unquoted comma inside a value ("Jayanagar, Bengaluru") splits one cell
 * into two and shifts every later column left — which used to push the phone
 * number into a field that then discarded it. When a row has more cells than
 * the header has columns, work out which cells were split apart by checking
 * each typed column (phone / email / date / number) against what it is
 * actually holding, and rejoin the surplus into the text column it came from.
 * ------------------------------------------------------------------ */

const NUMBER_CELL_RE = /^[^\d]{0,3}[\d,]+(?:\.\d+)?[^\d]{0,3}$/;

/** Does this cell plausibly hold a value of this field type? */
function matchesType(type, cell) {
  const s = String(cell ?? '').trim();
  if (!s) return false;
  switch (type) {
    case 'email': return EMAIL_RE.test(s);
    case 'tel': return PHONE_RE.test(s) && s.replace(/\D/g, '').length >= 7;
    case 'date': return DOB_RE.test(s);
    case 'number': return NUMBER_CELL_RE.test(s);
    case 'enum': return true;
    default: return true;
  }
}

/** As above, but an empty cell is acceptable anywhere. */
function cellLooksLike(type, cell) {
  return String(cell ?? '').trim() === '' || matchesType(type, cell);
}

/**
 * How reluctant we are to believe a column swallowed a comma. Addresses and
 * free-text notes routinely contain one; names and qualifications rarely do.
 */
function mergeCost(field) {
  if (!field || !field.key) return 4;
  if (field.key === 'area' || field.key === 'notes') return 1;
  if (field.key === 'courseName' || field.key === 'qualification') return 3;
  return 6;
}

/** The field sitting at each column position, `null` where the header wasn't recognised. */
function columnsFor(map, width) {
  const columns = new Array(width).fill(null);
  for (const [key, idx] of Object.entries(map)) {
    if (idx < width) columns[idx] = registrationFieldByKey[key] || null;
  }
  return columns;
}

/**
 * Fit `cells` (too many) onto `columns` by letting text columns absorb the
 * surplus, while typed columns must still end up holding something of their
 * own type. Returns one value per column, or null when no such fit exists.
 */
function alignCells(cells, columns) {
  const width = columns.length;
  if (cells.length <= width) return null;

  const memo = new Map();

  const best = (ci, coli) => {
    if (coli === width) return ci === cells.length ? { cost: 0, rightness: 0, take: [] } : null;
    const memoKey = ci * (width + 1) + coli;
    if (memo.has(memoKey)) return memo.get(memoKey);

    const field = columns[coli];
    const typed = field && isTypedField(field);
    // Every later column still needs at least one cell of its own.
    const maxTake = cells.length - ci - (width - coli - 1);
    const limit = typed ? Math.min(1, maxTake) : maxTake;

    let chosen = null;
    for (let take = 1; take <= limit; take++) {
      const joined = cells.slice(ci, ci + take).join(', ').trim();
      if (typed && !cellLooksLike(field.type, joined)) continue;
      const sub = best(ci + take, coli + 1);
      if (!sub) continue;
      const cost = sub.cost + (take - 1) * mergeCost(field);
      // Tie-break towards the later column: "Area, City" is far more common
      // than a comma in the first column of a row.
      const rightness = sub.rightness + (take - 1) * coli;
      if (!chosen || cost < chosen.cost || (cost === chosen.cost && rightness > chosen.rightness)) {
        chosen = { cost, rightness, take: [take, ...sub.take] };
      }
    }

    memo.set(memoKey, chosen);
    return chosen;
  };

  const fit = best(0, 0);
  if (!fit) return null;

  const merged = [];
  let i = 0;
  for (const take of fit.take) {
    merged.push(cells.slice(i, i + take).join(', ').trim());
    i += take;
  }
  return merged;
}

/** Columns whose value is recognisable on sight, and so recoverable. */
const RESCUABLE = [['whatsapp', 'tel'], ['email', 'email'], ['dob', 'date']];

/**
 * Last line of defence: if a mapped column ended up holding something that
 * cannot possibly be a phone number / email / date, but an unclaimed cell in
 * the row plainly is one, take it. Better a value in the right field than a
 * value silently thrown away by `coerce`.
 */
function rescueTypedCells(reg, cells, map) {
  const claimed = new Set(Object.values(reg).map((v) => String(v ?? '').trim()).filter(Boolean));
  for (const [key, type] of RESCUABLE) {
    if (!(key in map)) continue;
    const current = String(reg[key] ?? '').trim();
    if (current && matchesType(type, current)) continue;
    const hit = cells.find((c) => c && c !== current && !claimed.has(c) && matchesType(type, c));
    if (hit) { reg[key] = hit; claimed.add(hit); }
  }
}

function finishRegistration(reg) {
  const out = emptyRegistration();
  for (const f of REGISTRATION_FIELDS) {
    if (reg[f.key] !== undefined && reg[f.key] !== '') out[f.key] = coerce(f, reg[f.key]);
  }
  if (!out.paymentStatus) out.paymentStatus = 'Pending';
  return out;
}

/**
 * "Block" format — the WhatsApp reply shape, one labelled line per field,
 * repeated per candidate:
 *     *Name:* Ayesha
 *     *DoB:* 12/03/2008
 *     …
 */
function parseRegistrationBlocks(lines) {
  const out = [];
  let cur = null;

  const flush = () => {
    if (cur && String(cur.name ?? '').trim()) out.push(finishRegistration(cur));
    cur = null;
  };

  for (const line of lines) {
    const kv = matchKeyValue(line);
    if (!kv) continue;
    const key = REG_ALIAS.get(normalizeKey(kv.rawKey));
    if (!key) continue;

    // A second "Name:" means the next candidate has started.
    if (key === 'name') {
      if (cur && String(cur.name ?? '').trim()) flush();
      if (!cur) cur = {};
    }
    if (!cur) cur = {};
    if (kv.value) cur[key] = kv.value;
  }
  flush();
  return out;
}

/** Does this text look like labelled blocks rather than a table? */
function looksLikeBlocks(lines) {
  let labelled = 0;
  const keys = new Set();
  for (const line of lines) {
    const kv = matchKeyValue(line);
    if (!kv) continue;
    const key = REG_ALIAS.get(normalizeKey(kv.rawKey));
    if (key) { labelled++; keys.add(key); }
  }
  return labelled >= 2 && keys.size >= 2;
}

/**
 * Turn a block of text into registration objects. Accepts either the
 * labelled-block shape or a table (with or without a header row).
 */
export function parseRegistrations(text) {
  const lines = cleanText(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^[-=_*]{3,}$/.test(l));

  if (lines.length === 0) return [];

  if (looksLikeBlocks(lines)) return parseRegistrationBlocks(lines);

  // ---- table mode ----
  const delim = detectDelimiter(lines);
  const rows = lines.map((l) =>
    splitRow(stripBullet(stripMarkup(l)), delim).map((c) => c.trim())
  );

  const numericFirst = rows.filter((r) => r.length > 1 && /^\d{1,3}$/.test(r[0])).length;
  const hasSerialCol =
    rows.length > 1
      // A serial column is numeric on every row but the header.
      ? numericFirst >= rows.length - 1
      // A lone row has no pattern to compare against, so require a serial
      // number followed by something that clearly is not one.
      : rows[0].length >= 3 && /^\d{1,3}$/.test(rows[0][0]) && !/^\d/.test(rows[0][1] || '');

  let body = hasSerialCol ? rows.map((r) => r.slice(1)) : rows;

  const map = headerMap(body[0] || []);
  const columns = map ? columnsFor(map, body[0].length) : null;
  if (map) body = body.slice(1);

  const out = [];
  for (const rawCells of body) {
    const nonEmpty = rawCells.filter((c) => c !== '');
    if (nonEmpty.length === 0) continue;

    const reg = {};
    if (map) {
      const cells =
        rawCells.length > columns.length ? alignCells(rawCells, columns) || rawCells : rawCells;
      for (const [key, idx] of Object.entries(map)) reg[key] = cells[idx] ?? '';
      rescueTypedCells(reg, rawCells, map);
    } else {
      const rest = [];
      for (const cell of nonEmpty) {
        if (!reg.email && EMAIL_RE.test(cell)) { reg.email = cell.match(EMAIL_RE)[0]; continue; }
        // A cell that is *entirely* a date is the DoB, wherever it sits.
        if (!reg.dob && DOB_RE.test(cell)) { reg.dob = cell; continue; }
        if (!reg.whatsapp && PHONE_RE.test(cell) && cell.replace(/\D/g, '').length >= 7) {
          reg.whatsapp = cell; continue;
        }
        rest.push(cell);
      }
      rest.forEach((cell, i) => {
        const key = REGISTRATION_POSITIONAL_ORDER[i];
        if (key) reg[key] = cell;
      });
    }

    if (!String(reg.name ?? '').trim()) continue;
    out.push(finishRegistration(reg));
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Splitting a paste into multiple workshop records
 * ------------------------------------------------------------------ */

const SEPARATOR_RE = /^\s*(?:[-=_~]{3,}|#{2,}.*)\s*$/;

function splitRecords(text) {
  const lines = text.split('\n');

  if (lines.some((l) => SEPARATOR_RE.test(l))) {
    const blocks = [];
    let cur = [];
    for (const line of lines) {
      if (SEPARATOR_RE.test(line)) { blocks.push(cur); cur = []; }
      else cur.push(line);
    }
    blocks.push(cur);
    return blocks.map((b) => b.join('\n')).filter((b) => b.trim());
  }

  const titleIdx = [];
  lines.forEach((line, i) => {
    const kv = matchKeyValue(line);
    if (kv && WORKSHOP_ALIAS.get(normalizeKey(kv.rawKey)) === 'title') titleIdx.push(i);
  });

  if (titleIdx.length > 1) {
    const blocks = [];
    for (let i = 0; i < titleIdx.length; i++) {
      const from = titleIdx[i];
      const to = i + 1 < titleIdx.length ? titleIdx[i + 1] : lines.length;
      blocks.push(lines.slice(from, to).join('\n'));
    }
    return blocks.filter((b) => b.trim());
  }

  return text.trim() ? [text] : [];
}

/* ------------------------------------------------------------------ *
 * Single workshop record
 * ------------------------------------------------------------------ */

function parseRecord(block) {
  const raw = {};
  const extras = {};
  const warnings = [];
  let registrationsText = '';

  const lines = block.split('\n');
  let currentKey = null;
  let inRegistrations = false;

  const addRaw = (key, value) => {
    const field = workshopFieldByKey[key];
    if (raw[key] && isAppendable(field)) raw[key] += '\n' + value;
    else if (raw[key] === undefined) raw[key] = value;
    else raw[key] += '\n' + value;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (!inRegistrations) currentKey = null;
      else registrationsText += '\n';
      continue;
    }

    const kv = matchKeyValue(line);
    const nk = kv ? normalizeKey(kv.rawKey) : null;
    const mappedKey = nk ? WORKSHOP_ALIAS.get(nk) : undefined;
    const isSection = nk ? REG_SECTION.has(nk) : false;

    // --- inside a registration table ------------------------------
    if (inRegistrations) {
      const isRegLabel = nk ? REG_ALIAS.has(nk) : false;
      if (mappedKey && !isSection && !isRegLabel) {
        inRegistrations = false;
      } else {
        registrationsText += line + '\n';
        continue;
      }
    }

    // --- registration section header ------------------------------
    if (isSection) {
      const v = kv.value.trim();
      if (/^\d+$/.test(v)) { addRaw('seatLimit', v); currentKey = null; continue; }
      inRegistrations = true;
      currentKey = null;
      if (v) registrationsText += v + '\n';
      continue;
    }

    // --- known field ----------------------------------------------
    if (mappedKey) {
      addRaw(mappedKey, kv.value);
      currentKey = isTypedField(workshopFieldByKey[mappedKey]) ? null : mappedKey;
      continue;
    }

    // --- label without a separator, or a value containing a colon ---
    const pm = matchAliasPrefix(line, WORKSHOP_ALIAS);
    if (pm && raw[pm.key] === undefined) {
      const field = workshopFieldByKey[pm.key];
      let accept;
      if (isTypedField(field)) {
        const c = coerce(field, pm.value);
        accept = c !== '' && c !== null && c !== undefined;
      } else {
        accept = currentKey === null;
      }
      if (accept) {
        addRaw(pm.key, pm.value);
        currentKey = isTypedField(field) ? null : pm.key;
        continue;
      }
    }

    // --- emoji-prefixed poster line -------------------------------
    const hint = emojiHint(leadingEmoji(line));
    if (hint) {
      const field = workshopFieldByKey[hint];
      const value = stripBullet(stripMarkup(stripEmoji(line)));
      if (value && (raw[hint] === undefined || isAppendable(field))) {
        const ok = isTypedField(field) ? coerce(field, value) !== '' : true;
        if (ok) {
          addRaw(hint, value);
          currentKey = isAppendable(field) ? hint : null;
          continue;
        }
      }
    }

    // --- unknown "Label: value" ------------------------------------
    if (kv) {
      const words = kv.rawKey.trim().split(/\s+/).length;
      if (words <= 5 && kv.value.trim()) {
        extras[kv.rawKey.trim()] = kv.value.trim();
        currentKey = null;
        continue;
      }
    }

    // --- continuation of the previous field ------------------------
    const plain = stripBullet(stripMarkup(stripEmoji(trimmed)));
    if (!plain) continue;

    if (currentKey) {
      addRaw(currentKey, plain);
    } else if (!raw.title) {
      raw.title = plain;
      currentKey = 'title';
    } else {
      addRaw('outcome', plain);
      currentKey = 'outcome';
    }
  }

  // ---- coerce into the typed workshop object ---------------------
  const workshop = emptyWorkshop();
  for (const f of WORKSHOP_FIELDS) {
    if (raw[f.key] !== undefined) workshop[f.key] = coerce(f, raw[f.key]);
  }

  if (raw.startDate) {
    const { start, end } = parseDateRange(raw.startDate);
    if (start) workshop.startDate = start;
    if (end && !workshop.endDate) workshop.endDate = end;
  }
  if (raw.endDate) {
    const { start } = parseDateRange(raw.endDate);
    if (start) workshop.endDate = start;
  }

  const registrations = registrationsText.trim()
    ? parseRegistrations(registrationsText)
    : [];

  // ---- warnings ---------------------------------------------------
  for (const f of WORKSHOP_FIELDS) {
    if (f.required && !workshop[f.key]) warnings.push(`Missing required field: ${f.label}`);
  }
  if (raw.startDate && !workshop.startDate) {
    warnings.push(`Could not read a date from "${String(raw.startDate).slice(0, 40)}"`);
  }
  if (raw.mode && !workshop.mode) {
    warnings.push(`Unrecognised mode "${String(raw.mode).slice(0, 30)}" — set it manually`);
  }
  if (workshop.seatLimit && registrations.length > Number(workshop.seatLimit)) {
    warnings.push(`${registrations.length} registrations exceed the seat limit of ${workshop.seatLimit}`);
  }
  for (const label of Object.keys(extras)) {
    warnings.push(`Unrecognised label "${label}" — add it to aliases in schema.js to capture it`);
  }

  return { workshop, registrations, extras, warnings };
}

/* ------------------------------------------------------------------ *
 * Public entry points
 * ------------------------------------------------------------------ */

export function parseText(text) {
  const cleaned = cleanText(text);
  if (!cleaned.trim()) return [];
  return splitRecords(cleaned).map(parseRecord);
}

/** The registration form the team circulates on WhatsApp. */
export const SAMPLE_REGISTRATION_TEXT = `*Name:* Ayesha Siddiqua
*DoB:* 12/03/2010
*Qualification:* Class 10
*Course Name:* AI Hands-On Workshop
*WhatsApp #:* 9845289298
*Area:* Jayanagar, Bengaluru
*Email ID:* ayesha@example.com

*Name:* Mohammed Faizan
*DoB:* 05/07/2009
*Qualification:* Class 11
*Course Name:* AI Hands-On Workshop
*WhatsApp #:* 63646 30740
*Area:* Shivajinagar
*Email ID:* faizan@example.com
`;

/** The promotional poster — pasted straight in, emoji and all. */
export const SAMPLE_WORKSHOP_TEXT = `🚀 AI HANDS-ON WORKSHOP
🎯 Get Expertise in Artificial Intelligence

Presented by: Beyond Guidance, a unit of Islamic Information Centre
In association with: Kabir Independent PU College for Women and Al-Majeed School of Research Methodology & Innovation

👩‍🎓 For Students of Classes 8–12
📅 15th – 22nd August 2026
⏰ 5:00 PM – 8:00 PM
📍 Kabir Independent PU College for Women, Bengaluru
💰 Registration Fee: ₹149/-

💡 Hands-on Learning
💡 Innovate Your Ideas
💡 Build Real Projects
💡 Certificate of Completion

⚠️ ONLY THE FIRST 30 STUDENTS WILL BE ALLOWED!

📱 +91 98452 89298
📱 +91 63646 30740
`;
