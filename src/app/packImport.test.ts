// Choosing a pack file: the one helper the Rules library, Setting rules and New campaign share (health item 5).
import type { ChangeEvent } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LibraryPack } from '../modules/library/library.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { readChosenPack, updatePreview } from './packImport.ts';

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
