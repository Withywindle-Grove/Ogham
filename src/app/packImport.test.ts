// Choosing a pack file: the one helper the Rules library, Setting rules and New campaign share (health item 5).
import type { ChangeEvent } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LibraryPack } from '../modules/library/library.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { makeZip } from '../testing/makeZip.ts';
import { importedWords, matchPicked, missingWords, readChosenPack, savePackPictures, updatePreview } from './packImport.ts';

/** A file input's change, as the browser gives it (value is what the input shows as picked). */
function chosen(files: File[]) {
  const target = { files, value: 'C:\\fakepath\\picked' };
  return { event: { target } as unknown as ChangeEvent<HTMLInputElement>, target };
}

const fenGear = JSON.stringify({ format: 'tabletop-pack', meta: { name: 'Fen Gear' }, items: [{ id: 'rope', name: 'Rope' }, { id: 'reed-lamp', name: 'Reed lamp' }] });

describe('reading a chosen pack file', () => {
  it('nothing picked: nothing to read, and the input is cleared', async () => {
    const { event, target } = chosen([]);
    expect(await readChosenPack(event)).toBeNull();
    expect(target.value).toBe('');
  });

  it('a good file gives its pack, and the input is cleared so the same file can be picked again', async () => {
    const { event, target } = chosen([new File([fenGear], 'fen-gear.json')]);
    const read = await readChosenPack(event);
    expect(read).toMatchObject({ ok: true, pack: { meta: { name: 'Fen Gear' } } });
    expect(read?.ok && read.pack.entries.map((e) => e.name)).toEqual(['Rope', 'Reed lamp']);
    expect(target.value).toBe('');
  });

  it('a broken file gives a message in plain words, not an error', async () => {
    const read = await readChosenPack(chosen([new File(['{ not json'], 'fen-gear.json')]).event);
    expect(read?.ok).toBe(false);
    expect(read?.ok === false && read.message.length).toBeGreaterThan(0);
  });
});

describe('the preview of an update', () => {
  let world: FakeWorld;
  let gm: string;
  const target = (): LibraryPack => ({
    id: 'pack-fen',
    ownerUserId: gm,
    name: 'Fen Gear',
    version: '1',
    kind: 'setting',
    formatVersion: 2,
    source: '',
    importedAt: '2026-10-18T12:00:00Z',
    counts: { item: 1 },
    extraMeta: {},
    description: '',
    requires: [],
    words: {},
    usedBy: [],
  });

  beforeEach(() => {
    world = createFakeDb();
    gm = world.addPerson('priya@lantern.example', 'Priya');
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Gear', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: 'entry-lantern', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'lantern', name: 'Lantern', data: { id: 'lantern', name: 'Lantern' } });
    world.signInAs(gm);
  });

  it('compares the file with what the library has now', async () => {
    const read = await readChosenPack(chosen([new File([fenGear], 'fen-gear.json')]).event);
    if (!read?.ok) throw new Error('the file should read');
    const made = await updatePreview(world.db, target(), read.pack);
    if (!made.ok) throw new Error(made.message);
    expect(made.preview.mode).toBe('update');
    if (made.preview.mode !== 'update') return;
    expect(made.preview.diff.added.map((e) => e.name)).toEqual(['Rope', 'Reed lamp']);
    expect(made.preview.diff.removed.map((e) => e.name)).toEqual(['Lantern']);
  });

  it("says so in plain words when the library can't be read", async () => {
    const read = await readChosenPack(chosen([new File([fenGear], 'fen-gear.json')]).event);
    if (!read?.ok) throw new Error('the file should read');
    // The connection drops while the library is read.
    const failing = { ...world.db, from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: 'offline' } }) }) }) }) }) };
    expect(await updatePreview(failing as unknown as typeof world.db, target(), read.pack)).toEqual({ ok: false, message: "Couldn't load what's in your library now. Try again." });
  });
});

// A pack arrives with its pictures in one bundled file (B14, p2p-27; mockup december/24, IM1 and IM1b). Invented pack.
const saltwick = JSON.stringify({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { id: 'saltwick-island', name: 'Saltwick Island', kind: 'adventure' },
  locations: [
    { id: 'drowned-harbour', name: 'The Drowned Harbour' },
    { id: 'shingle-beach', name: 'The Shingle Beach' },
    { id: 'the-cove', name: 'The Cove' },
  ],
  images: [
    { id: 'map-harbour', file: 'images/map-harbour.png', type: 'map', title: 'The Drowned Harbour', alt: 'A harbour, half under water.', locationIds: ['drowned-harbour'] },
    { id: 'map-beach', file: 'images/map-beach.png', type: 'map', title: 'The Shingle Beach', alt: 'A long beach of grey stones.', locationIds: ['shingle-beach', 'the-cove'] },
  ],
});
const bundleOf = async (files: Record<string, string>) => new File([(await makeZip(files)) as BlobPart], 'saltwick-island.zip');
const asItCame = async (file: Blob) => file;

describe('a pack that arrives with its pictures in one bundled file (B14)', () => {
  let world: FakeWorld;
  let gm: string;
  let sam: string;

  beforeEach(() => {
    world = createFakeDb();
    gm = world.addPerson('priya@lantern.example', 'Priya');
    sam = world.addPerson('sam@lantern.example', 'Sam');
    world.tables.packs.push({ id: 'pack-salt', owner_user_id: gm, campaign_id: null, name: 'Saltwick Island', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-22T12:00:00Z' });
    world.signInAs(gm);
  });

  // Purpose: a .zip is read by the app itself: the pack file inside gives the pack, as a plain pack file would.
  it('a bundle gives its pack, read from the pack file inside, and the bundle with its name', async () => {
    const read = await readChosenPack(chosen([await bundleOf({ 'saltwick-island/saltwick-island.pack.json': saltwick, 'saltwick-island/images/map-harbour.png': 'harbour' })]).event);
    if (!read?.ok) throw new Error('the bundle should read');
    expect(read.pack.meta.name).toBe('Saltwick Island');
    expect(read.pack.entries.filter((e) => e.kind === 'map').map((e) => e.name)).toEqual(['The Drowned Harbour', 'The Shingle Beach']);
    expect(read.bundle?.name).toBe('saltwick-island.zip');
    expect(read.bundle?.picture('images/map-harbour.png')).not.toBeNull();
    expect(read.bundle?.picture('images/map-beach.png')).toBeNull();
  });

  // Purpose: a plain pack file has no bundle (it imports as before), and a .zip that is no bundle says why.
  it('a plain file has no bundle; a .zip with no pack file says so in plain words', async () => {
    const plain = await readChosenPack(chosen([new File([saltwick], 'saltwick-island.pack.json')]).event);
    expect(plain?.ok && plain.bundle).toBeUndefined();
    const empty = await readChosenPack(chosen([await bundleOf({ 'images/map-harbour.png': 'harbour' })]).event);
    expect(empty).toEqual({ ok: false, message: 'That .zip holds no pack file (a .json or .md file). Nothing was read.' });
  });

  // Purpose: once the pack is saved, each picture found is kept with the pack; a missing one is named and nothing is
  // refused for it.
  it('keeps each picture found with the pack and names the missing one', async () => {
    const read = await readChosenPack(chosen([await bundleOf({ 'saltwick-island.pack.json': saltwick, 'images/map-harbour.png': 'harbour' })]).event);
    if (!read?.ok || !read.bundle) throw new Error('the bundle should read');
    const pictures = await savePackPictures(world.db, { id: gm, roles: {} }, { id: 'pack-salt', ownerUserId: gm }, read.pack, read.bundle, asItCame);
    expect(pictures.found.map((m) => m.title)).toEqual(['The Drowned Harbour']);
    expect(pictures.missing.map((m) => m.file)).toEqual(['images/map-beach.png']);
    const kept = world.files.get('pack-files/pack-salt/map-harbour');
    expect(kept?.type).toBe('image/png');
    expect(await kept?.text()).toBe('harbour');
    expect([...world.files.keys()]).toEqual(['pack-files/pack-salt/map-harbour']);
  });

  // Purpose: only the pack's owner keeps a picture with it: someone else's attempt stores nothing.
  it("someone who doesn't own the pack keeps nothing with it", async () => {
    const read = await readChosenPack(chosen([await bundleOf({ 'saltwick-island.pack.json': saltwick, 'images/map-harbour.png': 'harbour' })]).event);
    if (!read?.ok || !read.bundle) throw new Error('the bundle should read');
    world.signInAs(sam);
    const pictures = await savePackPictures(world.db, { id: sam, roles: {} }, { id: 'pack-salt', ownerUserId: gm }, read.pack, read.bundle, asItCame);
    expect(pictures.found).toEqual([]);
    expect(world.files.size).toBe(0);
  });

  // Purpose: a picture the device can't read as a picture is named as missing, and the others are still kept.
  it('a picture that cannot be read is named as missing', async () => {
    const read = await readChosenPack(chosen([await bundleOf({ 'saltwick-island.pack.json': saltwick, 'images/map-harbour.png': 'harbour', 'images/map-beach.png': 'not a picture' })]).event);
    if (!read?.ok || !read.bundle) throw new Error('the bundle should read');
    const shrink = async (file: Blob) => {
      if ((await file.text()) === 'not a picture') throw new Error('unreadable');
      return file;
    };
    const pictures = await savePackPictures(world.db, { id: gm, roles: {} }, { id: 'pack-salt', ownerUserId: gm }, read.pack, read.bundle, shrink);
    expect(pictures.found.map((m) => m.id)).toEqual(['map-harbour']);
    expect(pictures.missing.map((m) => m.id)).toEqual(['map-beach']);
  });

  // Purpose: the words are the approved ones (IM1's toast; IM1b's one consequence), for one and for several.
  it('says what was imported and what a missing picture costs, in the approved words', async () => {
    expect(importedWords('Saltwick Island', 2)).toBe('Saltwick Island imported, with 2 maps.');
    expect(importedWords('Saltwick Island', 1)).toBe('Saltwick Island imported, with 1 map.');
    expect(importedWords('Saltwick Island', 2, true)).toBe('Saltwick Island updated, with 2 maps.');
    const read = await readChosenPack(chosen([new File([saltwick], 'saltwick-island.pack.json')]).event);
    if (!read?.ok) throw new Error('the file should read');
    const map = (locationIds: string[]) => ({ id: 'map-beach', file: 'images/map-beach.png', title: 'The beach chart', alt: '', locationIds, source: '' });
    expect(missingWords(map(['shingle-beach']), read.pack)).toBe('The Shingle Beach has no map until this picture is added.');
    expect(missingWords(map(['shingle-beach', 'the-cove']), read.pack)).toBe('The Shingle Beach and The Cove have no map until this picture is added.');
    expect(missingWords(map([]), read.pack)).toBe('The beach chart has no picture until this one is added.');
    // A map of many places names the first three and counts the rest.
    const many = { entries: Array.from({ length: 12 }, (_, i) => ({ kind: 'location' as const, packEntryId: `room-${i + 1}`, name: `Room ${i + 1}`, data: {} })) };
    expect(missingWords(map(many.entries.map((e) => e.packEntryId)), many)).toBe('Room 1, Room 2, Room 3 and 9 more have no map until this picture is added.');
  });

  // Purpose: "Add it…" with one picture missing takes the file picked whatever its name; with several, each file goes
  // to the map that names it, and a file no map names is left out.
  it('matches the files picked to the missing pictures', () => {
    const beach = { id: 'map-beach', file: 'images/map-beach.png', title: 'The Shingle Beach', alt: '', locationIds: [], source: '' };
    const cove = { id: 'map-cove', file: 'images/Map-Cove.png', title: 'The Cove', alt: '', locationIds: [], source: '' };
    expect(matchPicked([beach], [{ name: 'IMG_0042.jpeg' }])).toEqual([{ map: beach, file: { name: 'IMG_0042.jpeg' } }]);
    expect(matchPicked([beach, cove], [{ name: 'map-cove.PNG' }, { name: 'holiday.png' }])).toEqual([{ map: cove, file: { name: 'map-cove.PNG' } }]);
    expect(matchPicked([beach, cove], [{ name: 'holiday.png' }])).toEqual([]);
  });
});
