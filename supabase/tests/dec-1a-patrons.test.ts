// Patrons as a player-readable kind (December step 1a; supabase/migrations/20261111130000_dec_1a_patrons.sql;
// docs/plans/dec-1-creation.md 1a, docs/plans/m5b-patrons.md part A). TEST project only; invented content.
//   Purpose: a pack's patrons import as entries of kind patron; a player in the campaign reads each patron's entry
//   but never its cult or its stat block's id (hard rule 5), nor the stat block itself; the GM reads the cult from
//   the hidden part; a player whose campaign hasn't the pack reads none of it, nor does an outsider.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const CULT = 'Wayside shrines with a lamp that is never let go out.';
const packFile = JSON.stringify({
  format: 'tabletop-pack',
  formatVersion: 2,
  meta: { name: 'Lantern road', version: '1', kind: 'homebrew' },
  options: [{ id: 'ex-opt-patrons', name: 'Patrons', default: 'off', changeLater: 'allow', choices: [{ id: 'off', name: 'Off' }, { id: 'on', name: 'On' }] }],
  patrons: [
    {
      id: 'ex-patron-lantern-warden',
      name: 'The Lantern Warden',
      option: 'ex-opt-patrons',
      blurb: 'Keeper of the Last Light.',
      followers: { classes: ['reed-chaplain'], alignments: ['Reed', 'Mire'] },
      holySymbol: 'A lantern with an open shutter.',
      holyGarb: [{ atSpellLevel: 0, text: 'A grey travelling cloak', itemIds: ['ex-garb-warden-0'], costGp: 5 }],
      cult: CULT,
      statBlockId: 'lantern-lord',
      approval: 'gm',
      approvalNote: 'Ask your GM: the Warden takes few servants.',
    },
  ],
  // Neither is for sale, known or in a kit: only the one a patron's garb names is the player's to read.
  items: [
    { id: 'ex-garb-warden-0', name: 'Grey travelling cloak', category: 'clothing', forSale: false },
    { id: 'ex-relic-lamp', name: 'Lamp of the last road', category: 'treasure', forSale: false },
  ],
  statBlocks: [{ id: 'lantern-lord', name: 'Lantern lord', hp: '9d8' }],
});

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(packFile);
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

const entriesSeenBy = async (person: Person) =>
  must(await person.db.from('library_entries').select('id, kind, pack_entry_id, name, data').eq('pack_id', packId)).sort((a, b) => (a.kind as string).localeCompare(b.kind as string));

describe('who reads a patron (hard rule 5)', () => {
  it("a player in the campaign reads the patron, never its cult or its stat block; the GM reads the cult from the hidden part; a player elsewhere and an outsider read none", async () => {
    const player = await entriesSeenBy(world.playerA);
    // Purpose (the review of #636): the garb item, though not for sale, is the player's to read, because the Gear
    // step puts it in the pack from the player's own device; an item no patron's garb names stays the GM's.
    expect(player.map((e) => `${e.kind}:${e.pack_entry_id}`)).toEqual(['item:ex-garb-warden-0', 'option:ex-opt-patrons', 'patron:ex-patron-lantern-warden']);
    expect(JSON.stringify(player)).not.toContain('ex-relic-lamp');
    const patron = player.find((e) => e.kind === 'patron')!;
    expect(patron.data).toMatchObject({ holySymbol: 'A lantern with an open shutter.', approval: 'gm', followers: { classes: ['reed-chaplain'] } });
    expect(patron.data).not.toHaveProperty('cult');
    expect(patron.data).not.toHaveProperty('statBlockId');
    expect(JSON.stringify(player)).not.toContain(CULT);
    expect(JSON.stringify(player)).not.toContain('lantern-lord');
    // The hidden part is closed to the player.
    expect(must(await world.playerA.db.from('library_entry_secrets').select('id, data').eq('pack_id', packId))).toEqual([]);

    const gm = await entriesSeenBy(world.gm);
    expect(gm.map((e) => e.kind)).toEqual(['item', 'item', 'option', 'patron', 'statBlock']);
    const secrets = must(await world.gm.db.from('library_entry_secrets').select('id, data').eq('pack_id', packId));
    const hidden = secrets.find((s) => s.id === gm.find((e) => e.kind === 'patron')!.id);
    expect(hidden?.data).toMatchObject({ cult: CULT, statBlockId: 'lantern-lord' });

    // The newcomer is in the other campaign only (world.ts), which hasn't this pack: nothing of it.
    expect(await entriesSeenBy(world.newcomer)).toEqual([]);
    expect(await entriesSeenBy(world.outsider)).toEqual([]);
  });
});
