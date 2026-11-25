// A pack's bundle (B14, p2p-27): the app reads the .zip itself, with no library. (A .zip another tool made, and the
// checker's own unpacking, are tried in scripts/pack-bundle.test.mjs.)
import { describe, expect, it } from 'vitest';
import { makeZip } from '../../testing/makeZip.ts';
import { isZip, readBundle, readZip } from './packBundle.ts';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const pack = JSON.stringify({ format: 'tabletop-pack', meta: { name: 'Saltwick Island' } });
/** Where the .zip's list of files starts. */
const listAt = (zip: Uint8Array) => new DataView(zip.buffer).getUint32(zip.length - 22 + 16, true);

describe('reading a .zip', () => {
  // Purpose: a deflated file and a stored one both come back byte for byte, through the platform's own unpacking.
  it('gives each file its bytes, deflated or stored, and leaves folders out', async () => {
    const long = 'The Drowned Harbour. '.repeat(400);
    for (const store of [false, true]) {
      const files = readZip(await makeZip({ 'saltwick/': '', 'saltwick/pack.json': pack, 'saltwick/notes.txt': long }, { store }));
      expect(files.map((file) => file.name)).toEqual(['saltwick/pack.json', 'saltwick/notes.txt']);
      expect(text(await files[0]!.read())).toBe(pack);
      expect(text(await files[1]!.read())).toBe(long);
      expect(files[1]!.size).toBe(long.length);
    }
  });

  // Purpose: a .zip is known by how it starts, not by its name (a file from a phone may carry any name).
  it('knows a .zip by its first bytes', async () => {
    expect(isZip(await makeZip({ 'a.json': pack }))).toBe(true);
    expect(isZip(await makeZip({}))).toBe(true);
    expect(isZip(new TextEncoder().encode(pack))).toBe(false);
    expect(isZip(new Uint8Array())).toBe(false);
  });

  // Purpose: a file cut short or scrambled says so in plain words and never throws anything else.
  it('refuses a damaged file in plain words', async () => {
    const zip = await makeZip({ 'pack.json': pack });
    expect(() => readZip(zip.subarray(0, zip.length - 30))).toThrow(/looks damaged/);
    expect(() => readZip(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).toThrow(/looks damaged/);
    // The file's own bytes scrambled: the list reads, the file doesn't.
    const scrambled = await makeZip({ 'pack.json': 'Reeds. '.repeat(200) });
    scrambled.fill(0xff, 40, 60);
    await expect(readZip(scrambled)[0]!.read()).rejects.toThrow(/looks damaged/);
  });

  // Purpose: a file that says it is small and unpacks to far more is stopped (a "zip bomb" can't fill the device).
  it('stops a file that unpacks to more than it says', async () => {
    const zip = await makeZip({ 'big.txt': 'x'.repeat(200_000) });
    // The size the list gives for the file, set to 10 bytes.
    new DataView(zip.buffer).setUint32(listAt(zip) + 24, 10, true);
    await expect(readZip(zip)[0]!.read()).rejects.toThrow(/looks damaged/);
  });

  // Purpose: a locked .zip is refused with what to do, not read as nonsense.
  it('refuses a file locked with a password', async () => {
    const zip = await makeZip({ 'pack.json': pack });
    zip[listAt(zip) + 8]! |= 1;
    await expect(readZip(zip)[0]!.read()).rejects.toThrow(/password/);
  });
});

describe('reading a bundle', () => {
  // Purpose: the pack file is found at the top or inside the one folder a zipped folder makes, and a picture is found
  // by the path the pack names it with, whatever the case or the slashes.
  it('finds the pack file and its pictures by the paths the pack names', async () => {
    for (const folder of ['', 'saltwick-island/']) {
      const read = await readBundle(
        await makeZip({ [`${folder}saltwick-island.pack.json`]: pack, [`${folder}images/Map-Harbour.png`]: 'harbour', [`${folder}README.md`]: 'Notes.', '__MACOSX/._x.json': 'junk', [`${folder}.DS_Store`]: 'junk' }),
      );
      if (!read.ok) throw new Error(read.message);
      expect(read.bundle.fileName).toBe('saltwick-island.pack.json');
      expect(read.bundle.text).toBe(pack);
      expect(text(await read.bundle.picture('images/map-harbour.png')!())).toBe('harbour');
      expect(text(await read.bundle.picture('.\\images\\Map-Harbour.png')!())).toBe('harbour');
      expect(read.bundle.picture('images/map-beach.png')).toBeNull();
    }
  });

  // Purpose: a Markdown pack bundles too, when no .json is there.
  it('takes a .md pack when the bundle has no .json', async () => {
    const read = await readBundle(await makeZip({ 'fen-gear.md': '# Fen Gear', 'maps/fen.webp': 'fen' }));
    expect(read).toMatchObject({ ok: true, bundle: { fileName: 'fen-gear.md', text: '# Fen Gear' } });
  });

  // Purpose: a .zip that isn't a pack's bundle says what is wrong, in plain words.
  it('says so when there is no pack file, or more than one', async () => {
    expect(await readBundle(await makeZip({ 'images/a.png': 'a' }))).toEqual({ ok: false, message: 'That .zip holds no pack file (a .json or .md file). Nothing was read.' });
    expect(await readBundle(await makeZip({ 'a.json': pack, 'b.json': pack }))).toEqual({ ok: false, message: 'That .zip holds more than one pack file (a.json, b.json). Put one pack in a bundle.' });
    const cut = await makeZip({ 'a.json': pack });
    expect(await readBundle(cut.subarray(0, 20))).toMatchObject({ ok: false, message: expect.stringMatching(/looks damaged/) });
  });
});
