/**
 * What a class leaves behind: notes, a transcript, and handouts.
 *
 * A live class is the one thing this system produces that vanishes when it
 * ends. Somebody who missed it, or who was there and is trying to revise, has
 * nothing — no slide, no line of what was said, no sheet to read again.
 *
 * Three things fix that, and all three are written while the class is
 * running so nobody has to remember afterwards:
 *
 *   notes       one shared page the presenter types on, read live by the class
 *   transcript  what the presenter's microphone heard, line by line
 *   handouts    a link, or a small PDF, that appears for everyone at once
 *
 * ── WHAT THIS CANNOT DO, said plainly ────────────────────────────────────
 *
 * There is no server here. Firebase Hosting serves files and Firestore holds
 * documents; nothing runs in between. So:
 *
 *   - the transcript is what the PRESENTER'S OWN microphone hears, taken by
 *     the browser's speech recogniser. It does not hear the students. A
 *     lecture transcribes well; a discussion does not.
 *   - a recording is made in the presenter's browser and saved to their
 *     computer. There is nowhere to upload an hour of video to.
 *   - a handout PDF has to fit in a Firestore document, which is 1 MiB for
 *     the whole record. Anything bigger is shared as a link instead.
 *
 * Each of those is stated on screen where it matters, rather than discovered.
 */

/* ------------------------------------------------------------------ *
 * The transcript
 * ------------------------------------------------------------------ */

/**
 * How much transcript one day may hold.
 *
 * Firestore's ceiling is 1 MiB per document and the whole day's lines live in
 * one, so this is deliberately well under it: an hour of continuous speech is
 * roughly 9,000 words, and 200,000 characters is several hours of it.
 */
export const MAX_TRANSCRIPT_CHARS = 200000;

/** One line, trimmed and stamped. Returns null for anything not worth storing. */
export function transcriptLine(text, at = new Date()) {
  const said = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!said) return null;
  return { t: at instanceof Date ? at.toISOString() : String(at), s: said.slice(0, 2000) };
}

/**
 * Add a line, dropping the oldest if the day has run long.
 *
 * Dropping from the FRONT rather than refusing to add: a class that has been
 * running for three hours should still be recording what is being said now,
 * and the end of a lecture is the part people revise from. The caller is told
 * how many were dropped so it can say so.
 */
export function appendLine(lines = [], line, maxChars = MAX_TRANSCRIPT_CHARS) {
  if (!line) return { lines, dropped: 0 };
  const next = [...lines, line];
  let size = next.reduce((n, l) => n + (l.s?.length || 0), 0);
  let dropped = 0;
  while (next.length > 1 && size > maxChars) {
    size -= next[0].s?.length || 0;
    next.shift();
    dropped += 1;
  }
  return { lines: next, dropped };
}

/** The transcript as something a person can read or paste into a document. */
export function transcriptText(lines = [], { times = true } = {}) {
  return lines
    .map((l) => {
      if (!times || !l.t) return l.s;
      const at = new Date(l.t);
      if (Number.isNaN(at.getTime())) return l.s;
      const hh = String(at.getHours()).padStart(2, '0');
      const mm = String(at.getMinutes()).padStart(2, '0');
      return `[${hh}:${mm}] ${l.s}`;
    })
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * Handouts
 * ------------------------------------------------------------------ */

/**
 * The biggest PDF that can be stored.
 *
 * A Firestore document is 1 MiB in total, and base64 costs a third more than
 * the bytes it carries, so 600 KB of PDF becomes about 800 KB of string. The
 * rest of the ceiling is left for the title and the overhead.
 */
export const MAX_HANDOUT_BYTES = 600 * 1024;

/** Types worth accepting. A handout is something to read, not to run. */
export const HANDOUT_TYPES = ['application/pdf'];

export function humanBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Whether a chosen file can be shared, and why not when it cannot.
 *
 * The message names the actual size and the actual limit, and says what to do
 * instead. "File too large" tells somebody with a class waiting nothing they
 * can act on.
 */
export function checkHandoutFile(file) {
  if (!file) return { ok: false, error: 'No file chosen.' };
  const type = String(file.type || '').toLowerCase();
  if (!HANDOUT_TYPES.includes(type)) {
    return { ok: false, error: 'Only PDF files can be shared this way. For anything else, share a link.' };
  }
  if (file.size > MAX_HANDOUT_BYTES) {
    return {
      ok: false,
      error: `That PDF is ${humanBytes(file.size)}. The limit here is ${humanBytes(MAX_HANDOUT_BYTES)} `
        + '— there is no file store behind this app, so a handout has to fit in the database record. '
        + 'Put it on Drive or the school site and share the link instead.',
    };
  }
  return { ok: true };
}

/** Only somewhere a browser will actually go. No `javascript:` in a class. */
export function checkHandoutLink(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return { ok: false, error: 'Paste a link first.' };
  // Parsed as typed FIRST, so `javascript:` is recognised and refused for
  // what it is. Prefixing https:// before looking would turn it into a
  // nonsense hostname and report the wrong reason for the right refusal.
  let parsed = null;
  try { parsed = new URL(raw); } catch { /* probably just missing a scheme */ }
  if (parsed && parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: `Only http and https links can be shared, not ${parsed.protocol}` };
  }
  if (!parsed) {
    try { parsed = new URL(`https://${raw}`); } catch {
      return { ok: false, error: 'That does not look like a link.' };
    }
  }
  if (!parsed.hostname.includes('.')) {
    return { ok: false, error: 'That does not look like a link.' };
  }
  return { ok: true, url: parsed.href };
}

/** A title worth showing, falling back to the file's own name. */
export function handoutTitle(title, fallback = '') {
  const given = String(title ?? '').trim();
  if (given) return given.slice(0, 120);
  const name = String(fallback ?? '').trim().replace(/\.pdf$/i, '');
  return (name || 'Handout').slice(0, 120);
}

/** The record stored for one handout. */
export function handoutRecord({ title, kind, url = '', data = '', bytes = 0, fileName = '' }) {
  return {
    title: handoutTitle(title, fileName),
    kind: kind === 'file' ? 'file' : 'link',
    url: kind === 'file' ? '' : String(url || ''),
    data: kind === 'file' ? String(data || '') : '',
    bytes: Number(bytes) || 0,
  };
}

/* ------------------------------------------------------------------ *
 * Recording
 * ------------------------------------------------------------------ */

/**
 * The container to record in, best first.
 *
 * Asked of the browser rather than assumed: Chrome records WebM and Safari
 * does not, and a recording that fails at the moment it is needed is worse
 * than one in a format somebody has to convert.
 */
export const RECORDING_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

export function pickRecordingType(supported = () => false) {
  return RECORDING_TYPES.find((t) => supported(t)) || '';
}

/** `Advanced-Robotics-2026-09-06.webm` — sorts by date and says what it is. */
export function recordingName(workshop, at = new Date(), mimeType = '') {
  const title = String(workshop?.title || 'class')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'class';
  const day = at instanceof Date && !Number.isNaN(at.getTime())
    ? at.toISOString().slice(0, 10)
    : String(at).slice(0, 10);
  const ext = String(mimeType).includes('mp4') ? 'mp4' : 'webm';
  return `${title}-${day}.${ext}`;
}

/** How long a recording has been running, as `1:04:22`. */
export function elapsed(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
