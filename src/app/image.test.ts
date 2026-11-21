import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitWithin, MAP_SIZE, MAP_TOO_LARGE, PhotoError, shrinkImage, shrinkMap } from './image.ts';

describe('shrinking a photo', () => {
  it('fits the longest side within the limit, keeping the shape', () => {
    expect(fitWithin(4032, 3024, 512)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(3024, 4032, 512)).toEqual({ width: 384, height: 512 });
  });

  it('never makes a small picture bigger', () => {
    expect(fitWithin(300, 200, 512)).toEqual({ width: 300, height: 200 });
  });

  it('refuses a file that is not a picture, in plain words', async () => {
    await expect(shrinkImage(new Blob(['notes'], { type: 'text/plain' }))).rejects.toBeInstanceOf(PhotoError);
  });
});

describe("a map's copy (dec-7 5m-2)", () => {
  afterEach(() => vi.unstubAllGlobals());
  /** A stand-in for the browser's picture reader: a picture of this size. */
  const pictureOf = (width: number, height: number) => vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close: () => undefined })));

  // Purpose: a map over the size limit is refused in the approved words, and nothing is read.
  it('refuses a map over the limit in plain words', async () => {
    const huge = new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'image/png' });
    await expect(shrinkMap(huge)).rejects.toThrow(MAP_TOO_LARGE);
  });

  // Purpose: a file that isn't a picture is refused in today's words for a place's picture.
  it('refuses a file that is not a picture', async () => {
    await expect(shrinkMap(new Blob(['notes'], { type: 'text/plain' }))).rejects.toThrow("That isn't a picture. Choose a photo or image file.");
  });

  // Purpose: mc-32: a map already within 2400 px on its longest side is sent exactly as it came, never redrawn.
  it('sends a map that already fits as it came', async () => {
    pictureOf(MAP_SIZE, 1600);
    const file = new Blob(['a chart'], { type: 'image/png' });
    expect(await shrinkMap(file)).toBe(file);
  });

  // Purpose: the longest side is held to 2400 px, keeping the shape.
  it('fits a large map within 2400 px', () => {
    expect(fitWithin(6000, 4000, MAP_SIZE)).toEqual({ width: 2400, height: 1600 });
  });
});
