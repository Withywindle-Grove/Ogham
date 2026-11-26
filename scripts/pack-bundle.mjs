// A pack's bundle in `npm run pack:check` (B14, p2p-27): one .zip that holds the pack file and its pictures. The
// checker reads it with the app's own reader (src/modules/library/packBundle.ts), unpacking with Node's zlib where the
// app uses the browser's own; no library either way. It names each map whose picture the bundle doesn't hold: the app
// imports the pack all the same and the GM adds that picture by hand.
import { inflateRawSync } from 'node:zlib';
import { isZip, readBundle } from '../src/modules/library/packBundle.ts';
import { readPackMaps } from '../src/modules/library/packMaps.ts';

/**
 * The pack file to check from a file's bytes: the file itself, or the pack file inside a bundle, with the bundle's
 * pictures (`picture`, null for a plain file). A bundle the app can't read comes back as its message.
 */
export async function readPackOrBundle(name, bytes) {
  if (!isZip(bytes)) return { ok: true, name, text: Buffer.from(bytes).toString('utf8'), picture: null };
  const read = await readBundle(bytes, (data, size) => inflateRawSync(data, { maxOutputLength: size }));
  return read.ok ? { ok: true, name: read.bundle.fileName, text: read.bundle.text, picture: read.bundle.picture } : read;
}

/** How many of the pack's maps have their picture in the bundle, and each missing one by its path and its map. */
export function bundlePictures(file, picture) {
  const { maps } = readPackMaps(file);
  const missing = maps.filter((map) => !picture(map.file));
  return { maps: maps.length, found: maps.length - missing.length, missing: missing.map((map) => `${map.file} (the map "${map.title}")`) };
}
