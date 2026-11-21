// npm run pack:check on an adventure's hooks (pf-7, pf-7a) and links to them (pf-5a), dec-12 pieces A and B. Notes
// only: the exit code stays. Invented packs only.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adventureHookNotes } from './pack-adventure-hooks.mjs';
import { formatNotes } from './pack-format.mjs';
import { readPackJson } from '../src/modules/library/packFile.ts';

/** An invented adventure pack written the way pf-7a and pf-5a say: no notes. */
const good = () => ({
  format: 'tabletop-pack',
  formatVersion: 3,
  meta: { id: 'eel-weirs', name: 'The eel weirs', kind: 'adventure', code: 'ew' },
  tables: [{ id: 'ew-quay-rumours', name: 'Quay rumours', die: 'd6', rows: [{ min: 1, max: 6, result: 'Eels in the well' }] }],
  npcs: [{ id: 'ew-marda', name: 'Marda the weir-keeper', gm: { notes: 'Offers [[adventureHook:ew-lost-lantern|the lost lantern]].' } }],
  adventureHooks: [
    { id: 'ew-lost-lantern', name: 'The lost lantern', text: 'A Lantern Warden never came back from the weirs.', pays: 'A boat of your own', giverNpcId: 'ew-marda' },
    { id: 'ew-bog-bounty', name: 'Bounty on the Bog lurker', text: 'Nailed to the quay post.', pays: 'Ten silver a head' },
  ],
});

const check = (pack) => {
  const file = join(mkdtempSync(join(tmpdir(), 'pack-adventure-hooks-')), 'hooks.pack.json');
  writeFileSync(file, JSON.stringify(pack));
  return execFileSync('node', ['scripts/check-pack.mjs', file], { encoding: 'utf8' });
};

describe("pack:check on an adventure's hooks", () => {
  // Purpose: a pack written as the rulings say has nothing said about its hooks or its links to them.
  it('has nothing to say about a pack written as the rulings say', () => {
    expect(adventureHookNotes(good())).toEqual([]);
    expect(formatNotes(good()).filter((n) => n.includes('adventureHook'))).toEqual([]);
  });

  // Purpose: each entry's shape is checked the way the app reads it, once: by the importer, whose warnings the
  // checker prints (dec-12 B), and not again in the format notes.
  it("warns on an entry's shape, once", () => {
    const pack = good();
    pack.adventureHooks.push({ id: 'ew-bare' }, 'a hook');
    const read = readPackJson(JSON.stringify(pack));
    expect(read.ok && read.pack.warnings.filter((w) => w.startsWith('adventureHooks'))).toEqual([
      'adventureHooks: "ew-bare" has no name; the GM sees its id.',
      'adventureHooks: "ew-bare" has no text (the hook in the book\'s own words); it reads as empty.',
      'adventureHooks: "ew-bare" has no pays (what it pays, in words); it reads as empty.',
      "adventureHooks: entry 4 isn't a hook; skipped.",
    ]);
    expect(adventureHookNotes(pack)).toEqual([]);
    const out = check(pack);
    expect(out.split('has no pays (what it pays, in words)').length - 1).toBe(1);
  });

  // Purpose: a giver who isn't an npc of this pack is said; no giver at all is fine (a posted hook, pf-7a).
  it('warns on a giverNpcId that names no npc in the pack', () => {
    const pack = good();
    pack.adventureHooks[0].giverNpcId = 'ew-halewyn';
    expect(adventureHookNotes(pack)).toEqual(['adventureHooks: "ew-lost-lantern": giverNpcId "ew-halewyn" names no npc in this pack; the GM sees no one giving it.']);
  });

  // Purpose: a link to a hook the pack doesn't have is said, like any link that resolves to nothing.
  it('warns on an [[adventureHook:id]] link that names no hook', () => {
    const pack = good();
    pack.npcs[0].gm.notes = 'Offers [[adventureHook:ew-drowned-bell|the drowned bell]].';
    expect(formatNotes(pack)).toContain('npcs[0].gm.notes: the link to adventureHook "ew-drowned-bell" resolves to nothing in this pack; the app shows "the drowned bell" as plain text.');
  });

  // Purpose: a link to a hook the reader skipped (a repeated id) resolves to nothing, as the app would find it: the
  // link check reads the hooks as the app does, not the raw ids (#690's review).
  it('warns on a link to a hook the reader skipped', () => {
    const pack = good();
    pack.adventureHooks.push({ id: 'Bad Hook', name: 'Skipped', text: 't', pays: 'p' });
    pack.npcs[0].gm.notes = 'Offers [[adventureHook:Bad Hook|the skipped one]].';
    expect(formatNotes(pack)).toContain('npcs[0].gm.notes: the link to adventureHook "Bad Hook" resolves to nothing in this pack; the app shows "the skipped one" as plain text.');
  });

  // Purpose: the giver note reaches the checker through formatNotes.
  it('reaches the checker through formatNotes', () => {
    const pack = good();
    pack.adventureHooks[1].giverNpcId = 'ew-nobody';
    expect(formatNotes(pack)).toContain('adventureHooks: "ew-bog-bounty": giverNpcId "ew-nobody" names no npc in this pack; the GM sees no one giving it.');
  });

  // Purpose: run as npm run pack:check, the hooks are counted as the importer keeps them (a skipped entry, here a
  // repeated id, isn't counted: #690's review), checked, never called an unknown part, and the notes leave the exit
  // code at 0.
  it('counts and checks the hooks from the command line, without calling them unknown', () => {
    const pack = good();
    pack.adventureHooks[0].giverNpcId = 'ew-halewyn';
    pack.adventureHooks.push({ ...pack.adventureHooks[1] });
    const out = check(pack);
    expect(out).toContain('adventureHook: 2');
    expect(out).toContain('entry 3 repeats "ew-bog-bounty"');
    expect(out).toContain('giverNpcId "ew-halewyn" names no npc in this pack');
    expect(out).not.toContain('"adventureHooks" isn\'t a part');
  });
});
