/**
 * Turning a picture the user chose on their own machine into something that
 * can live in a Firestore document.
 *
 * The payment QR used to be a file you had to name, copy into `public/`,
 * commit and deploy. That is four steps too many for changing a QR code, and
 * it meant the QR could only be changed by whoever had the repository. Here
 * it is picked in the browser, shrunk, and stored on the workshop itself.
 *
 * Firestore documents are capped at 1 MiB, and a data URL costs about a third
 * more than the bytes it carries, so the image is downscaled until it fits
 * well inside that. A QR code survives this: it is a grid of squares, and
 * 480px is far more than a phone camera needs.
 */

/** Longest edge, in pixels, we keep. Generous for a QR, small as a file. */
export const MAX_IMAGE_PX = 480;

/**
 * Ceiling for the stored data URL. Firestore's limit is 1 MiB for the WHOLE
 * document, and the workshop carries other fields, so this leaves room.
 */
export const MAX_IMAGE_BYTES = 320 * 1024;

/** What a data URL actually costs to store, in bytes. */
export function dataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  return dataUrl.length;
}

/**
 * Scale (w, h) down so the longest edge is at most `max`, keeping the aspect
 * ratio. Never scales up — a QR that is already small stays as it is, because
 * enlarging it would only add blur and bytes.
 */
export function fitDimensions(w, h, max = MAX_IMAGE_PX) {
  const width = Math.max(0, Math.round(w) || 0);
  const height = Math.max(0, Math.round(h) || 0);
  if (!width || !height) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** True for the image types a browser can reliably draw to a canvas. */
export function isSupportedImage(type) {
  return /^image\/(png|jpeg|jpg|webp|gif|bmp)$/i.test(String(type || ''));
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('That file is not an image the browser can open.'));
    img.onload = () => resolve(img);
    img.src = src;
  });
}

/**
 * Read a picked file and return a PNG data URL, downscaled to fit.
 *
 * PNG, not JPEG: a QR code is hard black on hard white, and JPEG's ringing
 * around those edges is exactly the kind of noise that makes a scanner give
 * up. PNG keeps the squares square.
 *
 * Throws with a message meant to be shown to the person who picked the file.
 */
export async function readImageAsDataUrl(file, { maxPx = MAX_IMAGE_PX, maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (!file) throw new Error('No file was chosen.');
  if (!isSupportedImage(file.type)) {
    throw new Error('Choose a PNG, JPEG or WebP image.');
  }

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, maxPx);
  if (!width || !height) throw new Error('That image has no size the browser can read.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // A QR with a transparent background turns into black-on-black wherever the
  // page is dark, so lay it on white first.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const out = canvas.toDataURL('image/png');
  if (dataUrlBytes(out) > maxBytes) {
    throw new Error(
      'That image is too large to store even after shrinking. Crop it to just the QR square and try again.',
    );
  }
  return out;
}
