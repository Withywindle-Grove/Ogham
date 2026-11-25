// A pack's bundle (p2p-27, ruled 2026-11-18; plan scene-point-to-point B14): one .zip that holds the pack file and its
// pictures. The app reads the .zip itself, with no library (hard rule 9; 09, 2026-11-18): the file list here, and each
// file's bytes through the browser's own DecompressionStream (the pack checker passes Node's zlib instead).
//
// Pure, shared by the app's importer (app/packImport.ts) and the pack checker. Never trusts the file: every place it
// reads is checked, a file that unpacks to more than it says is stopped, and a locked or very large one is refused in
// plain words.

/** Unpacks one file's bytes (deflate, no header); `size` is what the .zip says they come to. */
export type Inflate = (data: Uint8Array, size: number) => Promise<Uint8Array> | Uint8Array;

/** One file inside a .zip: its path, its size unpacked, and its bytes when asked for. */
export interface ZipEntry {
  name: string;
  size: number;
  read: () => Promise<Uint8Array>;
}

/** A .zip the app can't read; its message is plain words for the person. */
export class ZipError extends Error {}

const DAMAGED = "That .zip couldn't be read: it looks damaged. Make it again and try once more.";
const TOO_LARGE = "That .zip is too large for the app to read. Keep each picture under 50 MB.";
const LOCKED = "That .zip is locked with a password. Make it again without one.";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Whether these bytes start as a .zip does. */
export const isZip = (bytes: Uint8Array): boolean => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5) && bytes[3] === bytes[2] + 1;

/** The browser's own unpacking. It stops at the size the .zip gave: a file that says small and unpacks huge is refused. */
async function browserInflate(data: Uint8Array, size: number): Promise<Uint8Array> {
  const out = new Uint8Array(size);
  let at = 0;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out.subarray(0, at);
    if (at + value.length > size) {
      void reader.cancel();
      throw new ZipError(DAMAGED);
    }
    out.set(value, at);
    at += value.length;
  }
}

/** The files in a .zip (folders left out), in the file's order. Throws ZipError in plain words. */
export function readZip(bytes: Uint8Array, inflate: Inflate = browserInflate): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // A read past the end of the file is a damaged .zip, whatever threw.
  const damaged = <T>(read: () => T): T => {
    try {
      return read();
    } catch (problem) {
      throw problem instanceof ZipError ? problem : new ZipError(DAMAGED);
    }
  };
  return damaged(() => {
    // The list of files is at the end: its record is found from the back (a comment of up to 65,535 bytes may follow it).
    let end = bytes.length - 22;
    const stop = Math.max(0, end - 0xffff);
    while (end >= stop && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < stop) throw new ZipError(DAMAGED);
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    if (count === 0xffff || at === 0xffffffff) throw new ZipError(TOO_LARGE);
    const entries: ZipEntry[] = [];
    for (let i = 0; i < count; i++) {
      if (view.getUint32(at, true) !== 0x02014b50) throw new ZipError(DAMAGED);
      const locked = (view.getUint16(at + 8, true) & 1) === 1;
      const method = view.getUint16(at + 10, true);
      const packed = view.getUint32(at + 20, true);
      const size = view.getUint32(at + 24, true);
      const nameLength = view.getUint16(at + 28, true);
      const local = view.getUint32(at + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)).replaceAll('\\', '/');
      at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
      if (name.endsWith('/')) continue;
      entries.push({
        name,
        size,
        read: async () => {
          if (locked) throw new ZipError(LOCKED);
          if (size > MAX_FILE_BYTES || packed === 0xffffffff) throw new ZipError(TOO_LARGE);
          // Stored as it is (0) or deflated (8): the two every tool that makes a .zip writes.
          if (method !== 0 && method !== 8) throw new ZipError(DAMAGED);
          const data = damaged(() => {
            if (view.getUint32(local, true) !== 0x04034b50) throw new ZipError(DAMAGED);
            const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
            if (start + packed > bytes.length) throw new ZipError(DAMAGED);
            return bytes.subarray(start, start + packed);
          });
          let out: Uint8Array;
          try {
            out = method === 0 ? data : await inflate(data, size);
          } catch {
            throw new ZipError(DAMAGED);
          }
          if (out.length !== size) throw new ZipError(DAMAGED);
          return out;
        },
      });
    }
    return entries;
  });
}

/** A bundle as read: the pack file inside it, and its pictures by the path the pack names them with. */
export interface PackBundle {
  /** The pack file's own name ("saltwick-island.pack.json"). */
  fileName: string;
  text: string;
  /** The picture the pack names by this path, beside the pack file ("images/map-beach.png"); null when the bundle has none. */
  picture: (file: string) => ZipEntry['read'] | null;
}

/** A path as the bundle and the pack may each write it: "./Images\Map.PNG" is "images/map.png". */
const samePath = (path: string) => path.replaceAll('\\', '/').replace(/^(\.\/)+/, '').toLowerCase();

/**
 * Reads a bundle: the pack file is the .json nearest the top (a .md when there is no .json; notes beside a .json are
 * left alone), and every other file under its folder is a picture, named by its path from there. Hidden files and a
 * Mac's "__MACOSX" folder are left out. A problem comes back as a message in plain words.
 */
export async function readBundle(bytes: Uint8Array, inflate?: Inflate): Promise<{ ok: true; bundle: PackBundle } | { ok: false; message: string }> {
  try {
    const files = readZip(bytes, inflate).filter((file) => !file.name.split('/').some((part) => part.startsWith('.') || part === '__MACOSX'));
    const depth = (file: ZipEntry) => file.name.split('/').length;
    const nearest = (ending: RegExp) => {
      const found = files.filter((file) => ending.test(file.name));
      const top = Math.min(...found.map(depth));
      return found.filter((file) => depth(file) === top);
    };
    const json = nearest(/\.json$/i);
    const packs = json.length > 0 ? json : nearest(/\.md$/i);
    if (packs.length === 0) return { ok: false, message: 'That .zip holds no pack file (a .json or .md file). Nothing was read.' };
    if (packs.length > 1) return { ok: false, message: `That .zip holds more than one pack file (${packs.map((file) => file.name).join(', ')}). Put one pack in a bundle.` };
    const pack = packs[0]!;
    const folder = pack.name.slice(0, pack.name.lastIndexOf('/') + 1);
    const pictures = new Map(files.filter((file) => file !== pack && file.name.startsWith(folder)).map((file) => [samePath(file.name.slice(folder.length)), file.read]));
    return {
      ok: true,
      bundle: { fileName: pack.name.slice(folder.length), text: new TextDecoder().decode(await pack.read()), picture: (file) => pictures.get(samePath(file)) ?? null },
    };
  } catch (problem) {
    if (problem instanceof ZipError) return { ok: false, message: problem.message };
    throw problem;
  }
}
