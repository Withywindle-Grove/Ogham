// An adventure's hooks (pf-7, pf-7a) and the adventureHook link (pf-5a), dec-12 pieces A and B. Invented text only.
import { describe, expect, it } from 'vitest';
import { hookEntries, readAdventureHooks, readStoredHook } from './adventureHooks.ts';
import { packFile } from './exportPack.ts';
import { LINK_KINDS, linksIn, plainLinks } from './linkMarks.ts';
import { PACK_PARTS, PLAYER_FACING, playerFacingEntry, readPackJson } from './packFile.ts';

/** An invented adventure pack with two hooks: one given by a person, one posted at a place. */
const adventure = () => ({
  format: 'tabletop-pack',
  formatVersion: 3,
  meta: { id: 'eel-weirs', name: 'The eel weirs', kind: 'adventure', code: 'ew' },
  npcs: [{ id: 'ew-marda', name: 'Marda the weir-keeper', role: 'eel-wife', locationId: 'ew-sluice' }],
  locations: [{ id: 'ew-sluice', name: 'The Sluice House', key: '4' }],
  tables: [{ id: 'ew-quay-rumours', name: 'Quay rumours', die: 'd6', rows: [{ min: 1, max: 6, result: 'Eels in the well' }] }],
  adventureHooks: [
    { id: 'ew-lost-lantern', name: 'The lost lantern', text: 'A Lantern Warden never came back from the weirs.', pays: 'A boat of your own', giverNpcId: 'ew-marda' },
    { id: 'ew-bog-bounty', name: 'Bounty on the Bog lurker', text: 'Nailed to the quay post: a bounty, in a shaky hand.', pays: 'Ten silver a head' },
  ],
});

describe("an adventure's hooks are read (pf-7, pf-7a)", () => {
  // Purpose: each hook is read whole and typed, in the file's order; a hook with no giver reads as given by no one.
  it('reads each hook with its id, name, text, pays and giver', () => {
    expect(readAdventureHooks(adventure())).toEqual({
      hooks: [
        { id: 'ew-lost-lantern', name: 'The lost lantern', text: 'A Lantern Warden never came back from the weirs.', pays: 'A boat of your own', giverNpcId: 'ew-marda' },
        { id: 'ew-bog-bounty', name: 'Bounty on the Bog lurker', text: 'Nailed to the quay post: a bounty, in a shaky hand.', pays: 'Ten silver a head', giverNpcId: null },
      ],
      notes: [],
    });
  });

  // Purpose: a pack without adventure hooks reads as none, with nothing to say; odd input never throws.
  it('reads no hooks from a pack without them, or from anything that is not a pack', () => {
    const without: Record<string, unknown> = adventure();
    delete without.adventureHooks;
    expect(readAdventureHooks(without)).toEqual({ hooks: [], notes: [] });
    for (const odd of [null, undefined, 3, 'text', []]) expect(readAdventureHooks(odd)).toEqual({ hooks: [], notes: [] });
  });

  // Purpose: the format's rule hooks (`hooks`) are never read as an adventure's hooks: the two names stay apart.
  it('never reads the rule hooks as adventure hooks', () => {
    const rest: Record<string, unknown> = adventure();
    delete rest.adventureHooks;
    expect(readAdventureHooks({ ...rest, hooks: [{ id: 'ew-lost-lantern', name: 'The lost lantern', text: 'x', pays: 'y' }] }).hooks).toEqual([]);
  });

  // Purpose: an entry the app can't use is left out and said; missing words read as empty and are said.
  it('leaves out an entry it cannot use, reads missing words as empty, and says each', () => {
    const pack = { ...adventure(), adventureHooks: ['a hook', { name: 'No id' }, { id: 'Bad Id' }, { id: 'ew-same', name: 'One', text: 't', pays: 'p' }, { id: 'ew-same', name: 'Two', text: 't', pays: 'p' }, { id: 'ew-bare', giverNpcId: 7 }] };
    const read = readAdventureHooks(pack);
    expect(read.hooks).toEqual([
      { id: 'ew-same', name: 'One', text: 't', pays: 'p', giverNpcId: null },
      { id: 'ew-bare', name: 'ew-bare', text: '', pays: '', giverNpcId: null },
    ]);
    expect(read.notes).toEqual([
      "adventureHooks: entry 1 isn't a hook; skipped.",
      'adventureHooks: entry 2 has no id; skipped.',
      'adventureHooks: "Bad Id" isn\'t a valid id (lowercase letters, digits and dashes); skipped.',
      'adventureHooks: entry 5 repeats "ew-same"; skipped (the first is kept).',
      'adventureHooks: "ew-bare" has no name; the GM sees its id.',
      'adventureHooks: "ew-bare" has no text (the hook in the book\'s own words); it reads as empty.',
      'adventureHooks: "ew-bare" has no pays (what it pays, in words); it reads as empty.',
      'adventureHooks: "ew-bare": giverNpcId should be an npc\'s id; it reads as no giver.',
    ]);
  });

  // Purpose: a third copy of an id is said as itself (its entry's number), not as "the second" (#690's review).
  it('says which entry repeated an id, for a third copy too', () => {
    const same = { id: 'ew-same', name: 'One', text: 't', pays: 'p' };
    const read = readAdventureHooks({ ...adventure(), adventureHooks: [same, same, same] });
    expect(read.hooks).toHaveLength(1);
    expect(read.notes).toEqual(['adventureHooks: entry 2 repeats "ew-same"; skipped (the first is kept).', 'adventureHooks: entry 3 repeats "ew-same"; skipped (the first is kept).']);
  });

  // Purpose: a name, text or pays that is there but isn't text is said as "isn't words", not as missing (#690's review).
  it("says a name, text or pays that isn't words as such", () => {
    const read = readAdventureHooks({ ...adventure(), adventureHooks: [{ id: 'ew-odd', name: 7, text: ['a'], pays: { silver: 10 } }] });
    expect(read.hooks).toEqual([{ id: 'ew-odd', name: 'ew-odd', text: '', pays: '', giverNpcId: null }]);
    expect(read.notes).toEqual([
      'adventureHooks: "ew-odd": name isn\'t words; the GM sees its id.',
      'adventureHooks: "ew-odd": text isn\'t words; it reads as empty.',
      'adventureHooks: "ew-odd": pays isn\'t words; it reads as empty.',
    ]);
  });

  // Purpose: adventureHooks that isn't a list is said once and reads as no hooks.
  it('says so when adventureHooks is not a list', () => {
    expect(readAdventureHooks({ ...adventure(), adventureHooks: { id: 'ew-x' } })).toEqual({
      hooks: [],
      notes: ['adventureHooks: should be a list of hooks, each { id, name, text, pays, giverNpcId? }; none was read.'],
    });
  });
});

describe("a hook's text reaches no player before it is sent (hard rule 5)", () => {
  // Purpose: importing an adventure pack keeps each hook as a library entry of kind adventureHook (dec-12 piece B), in
  // the book's order, with its giver's words found from the pack's npcs and places; the reader's notes are the
  // import's warnings, and the part is no longer called unknown.
  it('keeps each hook on import as an adventureHook entry, with its giver and its place in the book', () => {
    const read = readPackJson(JSON.stringify(adventure()));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const hooks = read.pack.entries.filter((e) => e.kind === 'adventureHook');
    expect(hooks).toEqual([
      {
        kind: 'adventureHook',
        packEntryId: 'ew-lost-lantern',
        name: 'The lost lantern',
        data: { text: 'A Lantern Warden never came back from the weirs.', pays: 'A boat of your own', giverNpcId: 'ew-marda', giver: { name: 'Marda the weir-keeper', role: 'eel-wife', place: '4 The Sluice House' }, order: 0 },
      },
      { kind: 'adventureHook', packEntryId: 'ew-bog-bounty', name: 'Bounty on the Bog lurker', data: { text: 'Nailed to the quay post: a bounty, in a shaky hand.', pays: 'Ten silver a head', giver: null, order: 1 } },
    ]);
    expect(read.pack.counts.adventureHook).toBe(2);
    expect(read.pack.warnings.some((w) => w.startsWith('"adventureHooks" isn\'t a part'))).toBe(false);
    const odd = readPackJson(JSON.stringify({ ...adventure(), adventureHooks: [...adventure().adventureHooks, { id: 'ew-bare' }] }));
    expect(odd.ok && odd.pack.warnings).toContain('adventureHooks: "ew-bare" has no text (the hook in the book\'s own words); it reads as empty.');
  });

  // Purpose: the kind a hook is kept as (B's real kind, adventureHook) is not one players may read, so the database
  // keeps every hook from them until it is sent (#690's review: the test points at the stored kind, not at a name).
  it('keeps hooks as a kind players may not read', () => {
    expect(PACK_PARTS.adventureHooks).toBe('adventureHook');
    expect(PLAYER_FACING).not.toContain(PACK_PARTS.adventureHooks);
    const stored = hookEntries(adventure()).entries[0]!;
    expect(playerFacingEntry(stored.kind, stored.data)).toBe(false);
  });

  // Purpose: a stored hook reads back whole on the GM's device; odd data reads as empty words and no giver, and a
  // hook stored without its place in the book reads as last.
  it('reads a stored hook back, and odd data without throwing', () => {
    const [first] = hookEntries(adventure()).entries;
    expect(readStoredHook(first!)).toEqual({
      id: 'ew-lost-lantern',
      name: 'The lost lantern',
      text: 'A Lantern Warden never came back from the weirs.',
      pays: 'A boat of your own',
      giverNpcId: 'ew-marda',
      giver: { name: 'Marda the weir-keeper', role: 'eel-wife', place: '4 The Sluice House' },
      order: 0,
    });
    expect(readStoredHook({ packEntryId: 'ew-x', name: '', data: { giver: { role: 'no name' }, order: -1 } })).toEqual({ id: 'ew-x', name: 'ew-x', text: '', pays: '', giverNpcId: null, giver: null, order: Number.MAX_SAFE_INTEGER });
  });

  // Purpose: a hook whose giver names no npc, or an npc with no place, keeps what can be said and no more.
  it("keeps a giver's name without a place, and no giver for an npc the pack doesn't have", () => {
    const pack = { ...adventure(), npcs: [{ id: 'ew-marda', name: 'Marda the weir-keeper' }] };
    expect(hookEntries(pack).entries[0]!.data.giver).toEqual({ name: 'Marda the weir-keeper', role: '', place: '' });
    expect(hookEntries({ ...adventure(), npcs: [] }).entries[0]!.data.giver).toBeNull();
  });

  // Purpose: exporting an adventure writes its hooks back as the book had them: the importer's giver and order stay out.
  it("exports hooks without the importer's giver and order", () => {
    const { file } = packFile({ name: 'The eel weirs', version: '1', kind: 'adventure' }, hookEntries(adventure()).entries);
    expect(file.adventureHooks).toEqual([
      { text: 'A Lantern Warden never came back from the weirs.', pays: 'A boat of your own', giverNpcId: 'ew-marda', id: 'ew-lost-lantern', name: 'The lost lantern' },
      { text: 'Nailed to the quay post: a bounty, in a shaky hand.', pays: 'Ten silver a head', id: 'ew-bog-bounty', name: 'Bounty on the Bog lurker' },
    ]);
  });
});

describe('a link may name an adventure hook (pf-5a)', () => {
  // Purpose: adventureHook is one of the kinds a link may name, beside the seven of pf-5.
  it('lists adventureHook among the link kinds', () => {
    expect(LINK_KINDS).toContain('adventureHook');
    for (const kind of ['place', 'npc', 'item', 'table', 'statBlock', 'spell', 'rule']) expect(LINK_KINDS).toContain(kind);
  });

  // Purpose: a link to a hook is read whole, and shows its label as plain text (the same fallback as every link).
  it('reads a link to a hook and shows its label as plain text', () => {
    const text = 'Marda offers [[adventureHook:ew-lost-lantern|the lost lantern]]; see also [[adventureHook:ew-bog-bounty]].';
    expect(linksIn(text)).toEqual([
      { kind: 'adventureHook', packId: '', id: 'ew-lost-lantern', label: 'the lost lantern' },
      { kind: 'adventureHook', packId: '', id: 'ew-bog-bounty', label: 'ew bog bounty' },
    ]);
    expect(plainLinks(text)).toBe('Marda offers the lost lantern; see also ew bog bounty.');
  });
});
