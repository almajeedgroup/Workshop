/**
 * How wide the sidebar is.
 *
 * Small enough to live in one file, but not small enough to leave untested:
 * the clamp is the whole safety of a drag, and a width that can reach zero
 * is a navigation somebody cannot get back.
 */

/** Narrow enough to be out of the way, wide enough to still read a label. */
export const MIN_WIDTH = 168;

/** Past this it stops being furniture and starts being the page. */
export const MAX_WIDTH = 420;

/** What it is without anybody touching it. Matches the CSS default. */
export const DEFAULT_WIDTH = 208;

/** How far one arrow key moves it. */
export const NUDGE = 16;

export const WIDTH_KEY = 'side.width';

/**
 * A width that is definitely usable.
 *
 * Anything unreadable — a dragged pointer off the side of the screen, a
 * stored value from a browser somebody edited, NaN — comes back as the
 * default rather than as zero. There is no undo for a sidebar you cannot
 * see well enough to find the control that widens it.
 */
export function clampWidth(value) {
  // Absent is not zero. `Number(null)` and `Number('')` are both 0, which
  // would snap a missing value to the NARROWEST sidebar rather than the
  // usual one — a stored width that never got written would silently shrink
  // the navigation on the next visit.
  if (value === null || value === undefined) return DEFAULT_WIDTH;
  if (typeof value === 'string' && value.trim() === '') return DEFAULT_WIDTH;

  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

/** The remembered width, or the default. */
export function storedWidth(storage) {
  try {
    const raw = storage?.getItem(WIDTH_KEY);
    return raw === null || raw === undefined ? DEFAULT_WIDTH : clampWidth(raw);
  } catch {
    // Private browsing, or storage refused. The default is fine.
    return DEFAULT_WIDTH;
  }
}

export function rememberWidth(storage, width) {
  try { storage?.setItem(WIDTH_KEY, String(clampWidth(width))); } catch { /* not worth failing over */ }
}

/**
 * Where a key press moves it.
 *
 * Left narrows and right widens, which is what the arrow points at. Home
 * puts it back — the way out of a width somebody dragged and regretted,
 * without having to find the exact pixel again.
 */
export function widthForKey(key, current) {
  if (key === 'ArrowLeft') return clampWidth(current - NUDGE);
  if (key === 'ArrowRight') return clampWidth(current + NUDGE);
  if (key === 'Home') return DEFAULT_WIDTH;
  if (key === 'End') return MAX_WIDTH;
  return null;
}
