/**
 * Online classes, held in a Jitsi Meet room.
 *
 * Jitsi is open source and its public server is free, which is the whole
 * reason it is here: an online course should not cost a room licence per
 * month. The room is embedded in this app rather than linked out to, so a
 * student stays on the school's own page and the presenter keeps the
 * register open beside the class.
 *
 * NOTHING HERE TOUCHES A BROWSER OR A DATABASE. It decides what the room is
 * called, who is in it, and how the embedded meeting is configured — all of
 * which is worth testing, and none of which needs a video call to test.
 *
 * ── On room names ────────────────────────────────────────────────────────
 * A Jitsi room has no guest list. Anyone who knows its name can walk in, and
 * a room called `physics-class` on a public server WILL be walked into by
 * strangers — it is the standard way this goes wrong. So the name is minted,
 * never typed: a readable prefix so the presenter can tell one from another,
 * and eighty bits of randomness so nobody arrives at it by guessing. The
 * lobby (see `MODERATOR_ACTIONS`) is the second lock, and the one that still
 * works after a link has been forwarded.
 */

import { ISSUER } from './schema.js';

/**
 * The alphabet room names are minted from.
 *
 * No `l`, `o`, `0` or `1`: these get read down a phone and written on
 * whiteboards, and those four are the ones people get wrong.
 */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** How many random characters. 32^16 is about 80 bits. */
const RANDOM_LENGTH = 16;

/** Anything shorter than this was typed by a person and is a guessable room. */
export const MIN_SAFE_ROOM_LENGTH = 24;

/** Lowercase letters, digits and single hyphens. Anything else breaks the URL. */
export function slugify(value, max = 24) {
  const words = String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean);

  // Truncating mid-word gives `beyond-guida`, which looks like a typo in a
  // link somebody is about to read out. Whole words only, and if the very
  // first word is already too long it is cut — one long word beats none.
  const out = [];
  for (const word of words) {
    const next = out.length ? `${out.join('-')}-${word}` : word;
    if (next.length > max) break;
    out.push(word);
  }
  return out.length ? out.join('-') : words[0]?.slice(0, max) || '';
}

/** `RANDOM_LENGTH` characters from a real random source where there is one. */
export function randomToken(length = RANDOM_LENGTH) {
  const bytes = new Uint8Array(length);
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    const byte = crypto?.getRandomValues ? bytes[i] : Math.floor(Math.random() * 256);
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

/**
 * A room name for a workshop: recognisable, then unguessable.
 *
 * The readable half is for the presenter, who may have three courses running
 * and needs to know which room they just opened. It is not a secret and is
 * not doing any of the security work.
 */
export function mintRoomName(workshop, token = randomToken()) {
  const label = slugify(workshop?.code || workshop?.title || 'class', 24);
  const org = slugify(ISSUER.unit || ISSUER.name, 16);
  return [org, label, token].filter(Boolean).join('-');
}

/**
 * Would a stranger find this room by guessing?
 *
 * Used to warn, never to block: somebody moving a class onto a room their
 * institution already uses has a reason, and this is not the place to argue
 * with them. It just says so out loud first.
 */
export function roomIsGuessable(room) {
  const name = String(room ?? '').trim();
  if (!name) return true;
  if (name.length < MIN_SAFE_ROOM_LENGTH) return true;
  // Long but made only of words is no better than short: `introduction-to-
  // robotics-workshop` is exactly what somebody would try.
  return !/[0-9]/.test(name);
}

/* ------------------------------------------------------------------ *
 * Is there a class to join?
 * ------------------------------------------------------------------ */

/**
 * A class students can be let into: online, switched on, and with a room.
 *
 * The mode is checked here and not only on the screens, because `classOpen`
 * and `meetingRoom` OUTLIVE a change of mode — the fields are hidden on an
 * in-person course, not erased. A course moved from Online to Offline after
 * a class was opened would otherwise go on publishing a live room that
 * nobody is watching, which is the worst of both.
 *
 * ASKED OF BOTH RECORDS, which do not agree on how to spell "open": the
 * workshop stores the word, because it is an enum on a form somebody fills
 * in, and the public mirror stores a boolean, because that is the shape the
 * whole mirror uses (`registrationOpen` is one too). Reading only one of
 * them is a page that silently never opens — so it reads both, once, here,
 * rather than every caller having to know which record it is holding.
 */
export function classIsLive(workshop) {
  if (!workshop || !isOnlineClass(workshop)) return false;
  const open = workshop.classOpen === true || workshop.classOpen === 'Open';
  return open && Boolean(workshop.meetingRoom);
}

/**
 * Why a student cannot get in, in words they can act on.
 *
 * "Not available" tells somebody who has been sent a link and is sitting
 * waiting for a class absolutely nothing. Each of these says which of the
 * two different situations they are in.
 */
export function classClosedReason(workshop) {
  if (!workshop) return 'This class link is not valid. Check the link you were sent.';
  if (!isOnlineClass(workshop)) {
    return 'This course is held in person, so there is no online class to join.';
  }
  if (workshop.classOpen !== 'Open') {
    return 'The class has not been opened yet. This page lets you in as soon as it is.';
  }
  return 'The class has no room set up yet. Please contact the office.';
}

/** Mirrors `isOnlineWorkshop`, but works on the public copy too. */
export function isOnlineClass(workshop) {
  return workshop?.mode === 'Online' || workshop?.mode === 'Hybrid';
}

/* ------------------------------------------------------------------ *
 * Links
 * ------------------------------------------------------------------ */

/** The page a student opens. The room name is never in it. */
export function classJoinUrl(workshopId, base = ISSUER.siteUrl) {
  if (!workshopId) return '';
  return `${String(base).replace(/\/+$/, '')}/class/${workshopId}`;
}

/**
 * The room on the Jitsi server itself.
 *
 * The fallback, for when the embedded meeting cannot load — a blocked script,
 * a corporate network, an old browser. A class that cannot start because our
 * page failed is a class that did not happen, so there is always a way
 * through that does not involve us.
 */
export function roomUrl(room, host = ISSUER.meetingHost) {
  if (!room) return '';
  return `https://${String(host).replace(/^https?:\/\//, '').replace(/\/+$/, '')}/${room}`;
}

/** The URL the embedded API script is loaded from. */
export function externalApiUrl(host = ISSUER.meetingHost) {
  return `https://${String(host).replace(/^https?:\/\//, '').replace(/\/+$/, '')}/external_api.js`;
}

/* ------------------------------------------------------------------ *
 * Embedded, or opened in its own window
 * ------------------------------------------------------------------ */

/**
 * Servers that refuse to be embedded, and what they do about it.
 *
 * meet.jit.si is free and unlimited used directly, and a five-minute demo
 * when put in an iframe: 8x8 disconnect the call and say so in a dialog. That
 * is a policy, not a bug, and no amount of configuration gets round it — so
 * the app stops depending on it rather than pretending.
 */
export const EMBED_FORBIDDEN = ['meet.jit.si', '8x8.vc'];

/** Just the hostname, however the setting was written. */
export function meetingHostname(host = ISSUER.meetingHost) {
  return String(host).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
}

/**
 * Should the meeting go inside the page?
 *
 * `auto` is the default and the honest one: embed a server that allows it,
 * launch one that does not. `always` is for a self-hosted Jitsi, where the
 * rule does not exist; `never` is for anybody who simply prefers a separate
 * window.
 */
export function canEmbedMeeting(host = ISSUER.meetingHost, mode = ISSUER.meetingEmbed) {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return !EMBED_FORBIDDEN.includes(meetingHostname(host));
}

/** Why the class opens in its own window, for the presenter who wonders. */
export function launchReason(host = ISSUER.meetingHost, mode = ISSUER.meetingEmbed) {
  if (mode === 'never') return 'The class is set to open in its own window.';
  if (!EMBED_FORBIDDEN.includes(meetingHostname(host))) return '';
  return `${meetingHostname(host)} allows a class inside another page only as a `
    + 'five-minute demo, and disconnects it after that. Opened in its own '
    + 'window the same free server has no limit, so that is what this does.';
}

/**
 * What is lost by not embedding, so nobody hunts for a feature that is off.
 *
 * Said once, plainly, rather than leaving a presenter to discover that the
 * live register stopped filling in.
 */
export function launchLimits() {
  return [
    'Who is in the room cannot be read from another window, so attendance is '
      + 'taken on the register screen rather than in one press here.',
    'The lobby is not switched on for you. Turn it on in the meeting\u2019s own '
      + 'Security options once you are in.',
  ];
}

/* ------------------------------------------------------------------ *
 * How the room is set up
 * ------------------------------------------------------------------ */

/**
 * The toolbar a presenter gets, and the shorter one a student gets.
 *
 * Screen sharing is deliberately missing from the student list. A class where
 * anybody can put their screen on the wall is a class that gets interrupted,
 * which is why every teaching platform makes it a host permission — the
 * presenter can still hand it over from the participants pane.
 */
export const HOST_TOOLBAR = [
  'microphone', 'camera', 'desktop', 'chat', 'raisehand', 'participants-pane',
  'tileview', 'select-background', 'settings', 'videoquality', 'fullscreen',
  'security', 'toggle-camera', 'mute-everyone', 'mute-video-everyone',
  'recording', 'hangup',
];

export const GUEST_TOOLBAR = [
  'microphone', 'camera', 'chat', 'raisehand', 'tileview',
  'select-background', 'settings', 'videoquality', 'fullscreen',
  'toggle-camera', 'hangup',
];

/**
 * Commands run once the presenter is actually in the room.
 *
 * The lobby is the control that still works after a link has been forwarded
 * to somebody it was not meant for: the room stops being open and starts
 * being knocked on. It is on by default because the safe setting should be
 * the one you get without knowing to ask for it.
 */
export const MODERATOR_ACTIONS = [
  ['toggleLobby', true],
];

/**
 * Everything the embedded meeting is started with.
 *
 * Kept here, out of the component, because these flags are decisions —
 * students muted on entry, no deep-link nag on a phone, no third-party
 * requests — and decisions belong somewhere they can be read and tested.
 */
export function meetingOptions({
  room, displayName = '', email = '', subject = '', moderator = false, lang = 'en',
} = {}) {
  return {
    roomName: room,
    lang,
    userInfo: { displayName: displayName || (moderator ? 'Presenter' : 'Participant'), email },
    configOverwrite: {
      // The device check before joining. Every platform has one because
      // discovering your microphone is off in front of forty people is the
      // single most common way a class starts badly.
      prejoinPageEnabled: true,
      // Students arrive quiet; the presenter arrives able to speak.
      startWithAudioMuted: !moderator,
      startWithVideoMuted: !moderator,
      // No gravatar or analytics calls out of the frame.
      disableThirdPartyRequests: true,
      // On a phone, Jitsi otherwise interrupts with "open in the app". A
      // student following a class link has one browser and no app.
      disableDeepLinking: true,
      enableWelcomePage: false,
      enableClosePage: false,
      defaultLanguage: lang,
      subject,
      toolbarButtons: moderator ? HOST_TOOLBAR : GUEST_TOOLBAR,
    },
    interfaceConfigOverwrite: {
      APP_NAME: ISSUER.unit || ISSUER.name,
      NATIVE_APP_NAME: ISSUER.name,
      PROVIDER_NAME: ISSUER.name,
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      SHOW_BRAND_WATERMARK: false,
      SHOW_POWERED_BY: false,
      MOBILE_APP_PROMO: false,
      HIDE_INVITE_MORE_HEADER: true,
      DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
      DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
      TOOLBAR_BUTTONS: moderator ? HOST_TOOLBAR : GUEST_TOOLBAR,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Who is in the room
 * ------------------------------------------------------------------ */

/** A name reduced to what two spellings of the same person have in common. */
export function nameKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Line up the people in the room against the people on the register.
 *
 * Matching is by ticket ID first — exact, and the student only has to have
 * typed it somewhere in their name — then by name. Nothing is guessed: a
 * near-miss is reported as a stranger rather than quietly credited to
 * somebody with a similar name, because the output of this feeds attendance,
 * and attendance is a record about a person.
 *
 * Returns three lists, and the last two are the interesting ones:
 *   present   — on the register and in the room
 *   strangers — in the room, not on the register
 *   missing   — on the register, not in the room
 */
export function matchRoom(participants = [], registrations = []) {
  const byTicket = new Map();
  const byName = new Map();
  for (const r of registrations) {
    const ticket = String(r.ticketId || '').trim().toLowerCase();
    if (ticket) byTicket.set(ticket, r);
    const key = nameKey(r.name);
    // A register with two people of the same name cannot be matched on name,
    // so neither of them is — they show up as strangers and the presenter
    // decides, which is better than crediting the wrong one.
    if (key) byName.set(key, byName.has(key) ? null : r);
  }

  const present = [];
  const strangers = [];
  const taken = new Set();

  for (const p of participants) {
    const display = String(p?.displayName ?? '').trim();
    const lower = display.toLowerCase();
    let found = null;
    for (const [ticket, reg] of byTicket) {
      if (ticket && lower.includes(ticket)) { found = reg; break; }
    }
    if (!found) found = byName.get(nameKey(display)) || null;

    if (found && !taken.has(found.id)) {
      taken.add(found.id);
      present.push({ participant: p, registration: found });
    } else if (!found) {
      strangers.push(p);
    }
  }

  const missing = registrations.filter((r) => !taken.has(r.id));
  return { present, strangers, missing };
}

/**
 * The attendance marks a room implies.
 *
 * Only ever marks people PRESENT. Nobody is marked absent for not being in
 * the room at the moment the presenter pressed the button — students join
 * late, connections drop, and a register that records that as absence is
 * lying about them. Absence stays a decision somebody makes on the
 * attendance screen.
 */
export function marksFromRoom(present = []) {
  const marks = {};
  for (const { registration } of present) {
    if (registration?.id) marks[registration.id] = 'present';
  }
  return marks;
}
