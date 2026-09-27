/**
 * How one student is attending: online, or in the room.
 *
 * A course already says how IT runs — Offline, Online or Hybrid. That was
 * enough while every course was one or the other. A hybrid course is not:
 * twenty people are in the hall and six are on a video link, and the office
 * needs to know which is which before it prints an attendance sheet, orders
 * lunch, or wonders why a name never signed anything.
 *
 * ── THE COURSE DECIDES WHETHER THERE IS A CHOICE ─────────────────────────
 *
 * On an Offline course everybody is in the room. On an Online course nobody
 * is. Asking either of them to pick is offering a choice that does not exist,
 * and the only thing it can produce is a wrong answer — somebody ticking
 * "Online" on a course that has no link. So the question is asked on HYBRID
 * courses and nowhere else, and on the other two the course's own mode is the
 * answer for every student.
 *
 * That also means a stored value is never trusted over the course. Flip a
 * hybrid course to Offline and everyone is in the room from that moment,
 * whatever they picked while it was hybrid — and flipping it back restores
 * what they said, because nothing was erased to make the first change.
 *
 * ── UNSET IS NOT A DEFAULT ───────────────────────────────────────────────
 *
 * On a hybrid course a student who has not said reads as unset, not as one of
 * the two. Guessing "Offline" would put a name on an attendance sheet that
 * nobody can sign, and guessing "Online" would leave a chair empty. The same
 * rule the attendance marks follow: a blank is a blank, and it is visible.
 *
 * Nothing here touches a database. It is a reading of two records.
 */

import { ATTEND_MODES } from './schema.js';

export { ATTEND_MODES };

/** Plain English, for a screen or a printed line. */
const LABELS = { Offline: 'In person', Online: 'Online' };

export function attendModeLabel(mode) {
  return LABELS[mode] || '';
}

/** Is this a course where the student has something to choose? */
export function workshopAsksMode(workshop) {
  return String(workshop?.mode ?? '').trim().toLowerCase() === 'hybrid';
}

/**
 * How this student is attending this course.
 *
 * '' means genuinely unknown — only possible on a hybrid course where nobody
 * has said yet. Callers must show that as unset rather than pick one.
 */
export function attendMode(workshop, reg) {
  const course = String(workshop?.mode ?? '').trim();
  if (!workshopAsksMode(workshop)) {
    // The course settles it. Anything else stored is from when it was hybrid.
    return ATTEND_MODES.find((m) => m.toLowerCase() === course.toLowerCase()) || '';
  }
  const own = String(reg?.attendMode ?? '').trim();
  return ATTEND_MODES.find((m) => m.toLowerCase() === own.toLowerCase()) || '';
}

/** Only ever store one of the two, or nothing. */
export function normalizeAttendMode(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return ATTEND_MODES.find((m) => m.toLowerCase() === v) || '';
}

/**
 * How the room splits. `unset` is reported rather than folded into either,
 * because "six have not said" is the number somebody has to act on.
 */
export function attendModeCounts(workshop, registrations = []) {
  const out = { Offline: 0, Online: 0, unset: 0, total: 0, asks: workshopAsksMode(workshop) };
  for (const reg of registrations) {
    out.total += 1;
    const mode = attendMode(workshop, reg);
    if (mode) out[mode] += 1;
    else out.unset += 1;
  }
  return out;
}

/** "18 in person · 6 online · 2 not said", or '' when there is nothing to say. */
export function attendModeSummary(workshop, registrations = []) {
  const c = attendModeCounts(workshop, registrations);
  if (!c.total) return '';
  // A course that is wholly one or the other has already said so in its own
  // Mode field; repeating it as a split is noise.
  if (!c.asks) return '';
  const parts = [];
  if (c.Offline) parts.push(`${c.Offline} in person`);
  if (c.Online) parts.push(`${c.Online} online`);
  if (c.unset) parts.push(`${c.unset} not said`);
  return parts.join(' · ');
}
