/**
 * The course library: what a student can still open after the class is over.
 *
 * Everything else a class produces is live and then gone — the room closes,
 * the notes and the transcript close with it, and that is deliberate for
 * something nobody has been given a copy of. The library is the opposite: a
 * deliberate, permanent shelf, put there by the office and readable by the
 * people who took the course.
 *
 * ── TWO KINDS, AND WHY THE DISTINCTION IS NOT COSMETIC ───────────────────
 *
 *   recording   what happened in the room — a video or an audio file
 *   notes       what was handed out — slides, a PDF, a sheet, a document
 *
 * A student looking for "the class I missed on Tuesday" and a student
 * looking for "the slide about prompt structure" are doing different things,
 * and a single undifferentiated list serves neither. Everything else here —
 * the format, the icon, the size — is presentation. This one is navigation.
 *
 * ── THREE SOURCES ────────────────────────────────────────────────────────
 *
 *   link    a URL somebody else hosts: Drive, OneDrive, anything https
 *   file    an object in this project's bucket, uploaded here
 *   text    the words themselves, in the record
 *
 * Links cost nothing and break silently when somebody moves the folder.
 * Files cost storage and cannot be revoked out from under the course.
 *
 * `text` exists for the notes a presenter types during a class. Those are
 * neither: making a file of them would need the bucket and give a student a
 * download where they wanted a page, and a link would point back at a class
 * that has closed. They are short, they are already in the database, and the
 * honest thing is to keep them where they are.
 */

/* ------------------------------------------------------------------ *
 * Formats
 * ------------------------------------------------------------------ */

/**
 * What an item IS, as far as a reader is concerned.
 *
 * Not the MIME type and not the extension: those are how a computer tells
 * two spreadsheets apart, and a student only needs to know it is a
 * spreadsheet. `.ppt` and `.pptx` are one thing here, as are `.doc` and
 * `.docx`, and every video container is `video`.
 */
export const FORMATS = [
  { key: 'video', label: 'Video', icon: '▶' },
  { key: 'text', label: 'Written notes', icon: '¶' },
  { key: 'audio', label: 'Audio', icon: '♪' },
  { key: 'pdf', label: 'PDF', icon: 'PDF' },
  { key: 'ppt', label: 'Slides', icon: 'PPT' },
  { key: 'doc', label: 'Document', icon: 'DOC' },
  { key: 'xls', label: 'Spreadsheet', icon: 'XLS' },
  { key: 'image', label: 'Image', icon: '▣' },
  { key: 'link', label: 'Link', icon: '↗' },
];

const FORMAT_BY_KEY = Object.fromEntries(FORMATS.map((f) => [f.key, f]));

/** The format a key stands for, falling back to a plain link. */
export function libraryFormat(key) {
  return FORMAT_BY_KEY[key] || FORMAT_BY_KEY.link;
}

const BY_EXTENSION = {
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', avi: 'video', m4v: 'video',
  mp3: 'audio', m4a: 'audio', wav: 'audio', aac: 'audio', ogg: 'audio',
  pdf: 'pdf',
  ppt: 'ppt', pptx: 'ppt', pps: 'ppt', ppsx: 'ppt', odp: 'ppt', key: 'ppt',
  doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc', txt: 'doc', md: 'doc',
  xls: 'xls', xlsx: 'xls', ods: 'xls', csv: 'xls',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', heic: 'image',
};

const BY_MIME = [
  [/^video\//, 'video'],
  [/^audio\//, 'audio'],
  [/^image\//, 'image'],
  [/pdf/, 'pdf'],
  [/presentation|powerpoint/, 'ppt'],
  [/wordprocessing|msword/, 'doc'],
  [/spreadsheet|excel|csv/, 'xls'],
  [/^text\//, 'doc'],
];

/**
 * The extension of a file name, lower-cased, without the dot.
 *
 * Reads the LAST PATH SEGMENT only, and insists the result look like an
 * extension. Both of those are load-bearing, not tidiness: this feeds
 * `libraryFilePath`, so a name like `../../etc/pass wd?.pdf` whose last dot
 * falls inside `../..` yields `./etc/pass wd` — slashes and all — and lands
 * a student's upload path in another course's folder, which storage.rules
 * grants by exactly that path segment. Found by a test, not by reading.
 */
export function extensionOf(name) {
  const clean = String(name || '').trim().split(/[?#]/)[0];
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  // `dot <= 0` rather than `< 0`: a name that is nothing but an extension,
  // like `.pdf`, has no stem and no extension either.
  if (dot <= 0 || dot === base.length - 1) return '';
  const ext = base.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

/**
 * What format a file is, from its name and its declared type.
 *
 * The NAME is asked first. A browser's idea of a file's MIME type comes from
 * the operating system's registry and is routinely wrong or empty — an
 * unregistered .pptx arrives as `application/octet-stream`, which says
 * nothing — whereas the extension is what the person who named it meant.
 */
export function formatOfFile(fileName, mimeType = '') {
  const ext = extensionOf(fileName);
  if (BY_EXTENSION[ext]) return BY_EXTENSION[ext];

  const mime = String(mimeType || '').toLowerCase();
  for (const [pattern, key] of BY_MIME) if (pattern.test(mime)) return key;
  return 'link';
}

/**
 * What format a LINK points at, which is usually unknowable.
 *
 * A Drive link carries no extension and Drive will not say what is behind it
 * without an API call and a token. So this answers honestly: a Drive video
 * link says video because Drive puts that in the path, a link ending in a
 * known extension is taken at its word, and everything else is a link. A
 * wrong guess would be worse than no guess — a slide deck labelled Video
 * sends somebody looking for a recording that is not there.
 */
export function formatOfLink(url) {
  const raw = String(url || '').trim();
  if (!raw) return 'link';

  let parsed = null;
  try { parsed = new URL(raw); } catch { return 'link'; }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // Google's own apps say what they are in the path, and those are the links
  // this will actually be given.
  if (host.endsWith('google.com') || host.endsWith('googleusercontent.com')) {
    if (path.startsWith('/presentation')) return 'ppt';
    if (path.startsWith('/document')) return 'doc';
    if (path.startsWith('/spreadsheets')) return 'xls';
    // /file/d/… is anything at all, so it stays a link.
  }
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'video';
  if (host.endsWith('vimeo.com')) return 'video';

  const ext = extensionOf(path);
  return BY_EXTENSION[ext] || 'link';
}

/* ------------------------------------------------------------------ *
 * Tidying a shared link
 * ------------------------------------------------------------------ */

/**
 * The link as a STUDENT should receive it.
 *
 * A link pasted out of the address bar is the link the office was using,
 * which is not the same thing. Two problems, both of which land on the
 * student rather than on the person who pasted it:
 *
 *   1. `/edit` — copied from an open Doc, Sheet or Slides. A reader with
 *      view-only access following it gets the editor in a degraded state,
 *      or a permission wall, depending on the file. `/preview` is the
 *      read-only view and is what a handout wants.
 *   2. `?usp=drive_link`, `?usp=sharing` — Drive's own tracking, and
 *      `#slide=id.p` or `#gid=0`, which pins the reader to whatever the
 *      office happened to be looking at.
 *
 * What it does NOT do is fix sharing. Nothing in a browser can tell whether
 * a Drive file is readable by the class — that needs the office to set
 * "Anyone with the link" — so this tidies the address and the panel says
 * the rest out loud.
 *
 * Anything that is not a Google link comes back with only its whitespace
 * removed. Rewriting somebody else's URLs on a guess is how a working link
 * becomes a broken one.
 */
export function tidyShareLink(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  let u = null;
  try { u = new URL(raw); } catch { return raw; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return raw;

  const host = u.hostname.toLowerCase();
  const isGoogle = host.endsWith('google.com') || host.endsWith('googleusercontent.com');
  if (!isGoogle) return raw;

  // `drive.google.com/open?id=FILEID` — the old share format, still handed
  // out by some clients, and it 302s rather than opening anything.
  if (u.pathname === '/open' && u.searchParams.get('id')) {
    return `https://drive.google.com/file/d/${u.searchParams.get('id')}/view`;
  }

  // The editing URL of a Doc, Sheet or Slides becomes its reading URL.
  const editor = u.pathname.match(
    /^\/(document|presentation|spreadsheets)\/d\/([^/]+)/,
  );
  if (editor) {
    return `https://docs.google.com/${editor[1]}/d/${editor[2]}/preview`;
  }

  const file = u.pathname.match(/^\/file\/d\/([^/]+)/);
  if (file) return `https://drive.google.com/file/d/${file[1]}/view`;

  // A Google link this does not recognise keeps its path and loses only the
  // tracking, because guessing further would be guessing.
  u.searchParams.delete('usp');
  u.hash = '';
  return u.toString();
}

/* ------------------------------------------------------------------ *
 * Size
 * ------------------------------------------------------------------ */

/** The most a single file may be, matching the cap in storage.rules. */
export const MAX_FILE_BYTES = 512 * 1024 * 1024;

/**
 * A size a person can act on.
 *
 * Rounded to one decimal above a megabyte and to none below, because
 * "1.0 KB" is noise and "847.3 MB" is a decision about whether to use mobile
 * data. Zero and nonsense come back empty rather than as "0 B", since an
 * unknown size should say nothing rather than claim to be nothing.
 */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) {
    const mb = n / (1024 * 1024);
    return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  }
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/* ------------------------------------------------------------------ *
 * The record
 * ------------------------------------------------------------------ */

export const LIBRARY_KINDS = [
  { key: 'recording', label: 'Recording', plural: 'Recordings' },
  { key: 'notes', label: 'Notes', plural: 'Notes and handouts' },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One shelf item, built from whatever the form gave.
 *
 * Built by whitelist, like every other record that crosses a trust boundary
 * in this app: the form's state object carries React keys and half-finished
 * fields, and a spread would store them and then have to defend them in the
 * rules. What comes out is exactly the shape firestore.rules names, and
 * nothing else can get through.
 */
export const MAX_TEXT = 100000;

export function libraryRecord({
  title, kind, source, url = '', path = '', text = '', format = '',
  bytes = 0, day = '', fileName = '',
}) {
  const kept = source === 'file' ? 'file' : source === 'text' ? 'text' : 'link';
  const chosen = String(format || '').trim()
    || (kept === 'file' ? formatOfFile(fileName, '')
      : kept === 'text' ? 'text'
        : formatOfLink(url));

  return {
    title: libraryTitle(title, fileName),
    kind: kind === 'recording' ? 'recording' : 'notes',
    source: kept,
    // Only one of these three carries anything. All three keys are always
    // present, with the unused ones empty, so the rules can name a fixed
    // field list rather than branching on the source.
    // Tidied here rather than at the form, so EVERY path gets it: the
    // panel, and the handouts carried over when a class closes.
    url: kept === 'link' ? tidyShareLink(url) : '',
    path: kept === 'file' ? String(path || '') : '',
    text: kept === 'text' ? String(text || '').slice(0, MAX_TEXT) : '',
    format: FORMAT_BY_KEY[chosen] ? chosen : 'link',
    bytes: kept === 'file' ? Math.max(0, Math.round(Number(bytes) || 0)) : 0,
    day: DAY.test(String(day || '')) ? String(day) : '',
  };
}

/** A title worth showing, falling back to the file's own name. */
export function libraryTitle(title, fallback = '') {
  const given = String(title ?? '').trim();
  if (given) return given.slice(0, 200);

  const name = String(fallback ?? '').trim();
  const ext = extensionOf(name);
  const stem = ext ? name.slice(0, -(ext.length + 1)) : name;
  // Uploaded files are routinely called `Session 2 - final (1).pptx`, and the
  // separators are how the person typed a title before there was a box for
  // one. Read them as spaces rather than printing the file system.
  const tidy = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (tidy || 'Untitled').slice(0, 200);
}

/**
 * The object path an uploaded file is stored at.
 *
 * Namespaced by workshop because storage.rules grants access per course by
 * reading that segment of the path — a file in the wrong folder would be
 * shown to the wrong course. The name is made here rather than taken from
 * the upload: two people uploading `notes.pdf` must not be one file, and a
 * name that came from a file system has no business in a URL.
 */
export function libraryFilePath(workshopId, fileName, at = new Date(), rand = Math.random) {
  const ext = extensionOf(fileName);
  const stamp = at.toISOString().replace(/[:.]/g, '-');
  const tag = Math.floor(rand() * 1e6).toString(36).padStart(4, '0');
  return `workshops/${workshopId}/library/${stamp}-${tag}${ext ? `.${ext}` : ''}`;
}

/* ------------------------------------------------------------------ *
 * Reading the shelf
 * ------------------------------------------------------------------ */

/**
 * The shelf in the order it should be read.
 *
 * By day, EARLIEST FIRST, because a course is a sequence and somebody
 * catching up starts at the beginning. Undated items go last: they are the
 * ones that belong to the course rather than to a session, and a reader
 * looking for Tuesday should not have to scroll past them.
 *
 * Within a day, recordings before notes — the recording is what was missed,
 * the notes are what supports it.
 */
export function sortLibrary(items = []) {
  const rank = (i) => (i.kind === 'recording' ? 0 : 1);
  return [...items].sort((a, b) => {
    if (!a.day !== !b.day) return a.day ? -1 : 1;
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

/**
 * The shelf split into the days it covers.
 *
 * Returns `[{ day, items }]` with undated items gathered under `day: ''`, so
 * a page can render one heading per session without grouping logic of its
 * own. An empty shelf is an empty list, not a list with one empty day.
 */
export function libraryByDay(items = []) {
  const out = [];
  const index = new Map();
  for (const item of sortLibrary(items)) {
    const key = item.day || '';
    if (!index.has(key)) {
      index.set(key, { day: key, items: [] });
      out.push(index.get(key));
    }
    index.get(key).items.push(item);
  }
  return out;
}

/** How many of each kind are on the shelf, for a one-line summary. */
export function libraryCounts(items = []) {
  const out = { recording: 0, notes: 0, total: items.length };
  for (const i of items) {
    if (i.kind === 'recording') out.recording += 1; else out.notes += 1;
  }
  return out;
}
