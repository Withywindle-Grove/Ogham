// The real-pack loader's choice of files, with invented paths and packs (no game content).
import { describe, expect, it } from 'vitest';
import { newestPerPack, packIdOf, versionOf } from './realPacks.ts';

const pack = (id: string | null) => JSON.stringify({ meta: id === null ? { name: 'Unnamed' } : { id } });

describe('newestPerPack', () => {
  it('reads the version from both the old and the new candidate names', () => {
    expect(versionOf('/x/packs/bog/build/candidate-0.6.1.pack.json')).toEqual([0, 6, 1]);
    expect(versionOf('/x/packs/bog-lurkers/build/bog-lurkers-candidate-0.10.2.pack.json')).toEqual([0, 10, 2]);
  });

  it('picks the newest candidate of each pack, whatever its folder and file are called, old and new names mixed', () => {
    const candidates = {
      '/x/packs/old-folder/build/candidate-0.3.1.pack.json': pack('lantern-wardens'),
      '/x/packs/old-folder/build/candidate-0.3.2.pack.json': pack('lantern-wardens'),
      '/x/packs/lantern-wardens/build/lantern-wardens-candidate-0.3.10.pack.json': pack('lantern-wardens'),
      '/x/packs/bog-lurkers/build/bog-lurkers-candidate-0.6.2.pack.json': pack('bog-lurkers'),
    };
    expect(newestPerPack(candidates).map(({ id, path }) => [id, path])).toEqual([
      ['bog-lurkers', '/x/packs/bog-lurkers/build/bog-lurkers-candidate-0.6.2.pack.json'],
      ['lantern-wardens', '/x/packs/lantern-wardens/build/lantern-wardens-candidate-0.3.10.pack.json'],
    ]);
  });

  it('keeps a conversion candidate in the same build folder as its own pack, apart from the setting', () => {
    const candidates = {
      '/x/packs/bog-lurkers/build/bog-lurkers-candidate-0.6.2.pack.json': pack('bog-lurkers'),
      '/x/packs/bog-lurkers/build/conv-bog-lurkers-to-lantern-wardens-candidate-0.1.0.pack.json': pack('conv-bog-lurkers-to-lantern-wardens'),
    };
    expect(newestPerPack(candidates).map(({ id }) => id)).toEqual(['bog-lurkers', 'conv-bog-lurkers-to-lantern-wardens']);
  });

  it('uses a live pack file only when that pack has no candidate, and lists everything in meta.id order', () => {
    const candidates = { '/x/packs/zz-folder/build/candidate-0.6.2.pack.json': pack('bog-lurkers') };
    const files = {
      '/x/packs/zz-folder/bog-lurkers-0.5.8.pack.json': pack('bog-lurkers'),
      '/x/packs/aa-folder/mire-towns-0.2.pack.json': pack('mire-towns'),
      '/x/packs/zz-folder/add-on.pack.json': pack(null),
    };
    expect(newestPerPack(candidates, files).map(({ id, path }) => [id, path])).toEqual([
      ['/x/packs/zz-folder/add-on.pack.json', '/x/packs/zz-folder/add-on.pack.json'],
      ['bog-lurkers', '/x/packs/zz-folder/build/candidate-0.6.2.pack.json'],
      ['mire-towns', '/x/packs/aa-folder/mire-towns-0.2.pack.json'],
    ]);
  });

  it('treats a file that does not read as its own pack, by path', () => {
    expect(packIdOf('/x/packs/a/b.pack.json', '{ not json')).toBe('/x/packs/a/b.pack.json');
  });
});
