// Shrinking a chosen photo on the device before upload, with the browser's own tools (no library).
// A portrait is shown small, so 512 pixels on the longest side is plenty and keeps uploads quick and storage small.

export const PORTRAIT_SIZE = 512;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** The width and height that fit within `max` on the longest side, never enlarging. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class PhotoError extends Error {}

/** How a picture is made smaller: the type it's sent as, and whether one that already fits is sent untouched. */
export interface ShrinkOptions {
  /** PNG keeps a picture's lines and see-through parts exactly; JPEG (the default) keeps photos small. */
  as?: 'image/jpeg' | 'image/png';
  /** A picture already within `max` that a browser shows as it is (JPEG, PNG, WebP, GIF) is sent as it came. */
  keepWhenFits?: boolean;
}

/** The types every browser shows as they are, so a picture of one that fits needn't be redrawn. */
const SHOWN_AS_IS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** A JPEG (or `options.as`) no larger than `max` pixels on its longest side. Throws PhotoError with a plain message. */
export async function shrinkImage(file: Blob, max = PORTRAIT_SIZE, options: ShrinkOptions = {}): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new PhotoError("That isn't a picture. Choose a photo or image file.");
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError('That picture is too large. Choose one under 25 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoError("Couldn't read that picture. Try a JPEG or PNG.");
  }
  const size = fitWithin(bitmap.width, bitmap.height, max);
  if (options.keepWhenFits && size.width === bitmap.width && size.height === bitmap.height && SHOWN_AS_IS.includes(file.type)) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new PhotoError("Couldn't prepare that picture on this device.");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.as ?? 'image/jpeg', 0.85));
  if (!blob) throw new PhotoError("Couldn't prepare that picture on this device.");
  return blob;
}

/**
 * A map (dec-7 5m-2; 07 §9; mc-32: never altered beyond the smaller copy) is kept to 2400 pixels on its longest side:
 * room to zoom in on a tablet, and quick to send. A PNG stays a PNG (its lines and see-through parts kept exactly); a
 * map that already fits goes as it came.
 */
export const MAP_SIZE = 2400;

/** The words when a map's file is over the limit (mockup december/11, frame 2c). */
export const MAP_TOO_LARGE = 'That picture is too large for a map. Nothing was added.';

/** A map's copy for the campaign, ready to send. Throws PhotoError with a plain message. */
export async function shrinkMap(file: Blob): Promise<Blob> {
  if (file.type.startsWith('image/') && file.size > MAX_INPUT_BYTES) throw new PhotoError(MAP_TOO_LARGE);
  return shrinkImage(file, MAP_SIZE, { as: file.type === 'image/png' ? 'image/png' : 'image/jpeg', keepWhenFits: true });
}
