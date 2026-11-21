// Patrons as a pack part and a kind players read (December step 1a; plans/m5b-patrons.md part A;
// supabase/migrations/20261111130000_dec_1a_patrons.sql, mirrored by src/testing/fakeDb.ts). Invented content only.
import { describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { loadCurrentUser } from '../../core/currentUser.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { attachPack } from './campaignPacks.ts';
import { KIND_WORDS } from './kindWords.ts';
import { importPack } from './library.ts';
import { PATRON_GM_FIELDS, PLAYER_FACING, playerFacingEntry, readPackJson } from './packFile.ts';

const CULT = 'Wayside shrines with a lamp that is never let go out.';
const file = (patrons: Record<string, unknown>[]) =>
  JSON.stringify({
    format: 'tabletop-pack',
    formatVersion: 2,
    meta: { name: 'Lantern road', version: '1', kind: 'setting' },
    options: [{ id: 'ex-opt-patrons', name: 'Patrons', default: 'off', choices: [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }] }],
    patrons,
    statBlocks: [{ id: 'lantern-lord', name: 'Lantern lord', hp: '9d8' }],
  });
const WARDEN = {
  id: 'ex-patron-lantern-warden',
  name: 'The Lantern Warden',
  option: 'ex-opt-patrons',
  followers: { classes: ['marsh-chaplain'], alignments: ['Lantern'] },
  holySymbol: 'A lantern with an open shutter.',
  cult: CULT,
  statBlockId: 'lantern-lord',
  approval: 'gm',
};

describe('reading a pack with patrons', () => {
  // Purpose: `patrons` is a part the app knows (no "unknown part" note); each patron is one entry, named by its name.
  it('reads each patron as an entry of its own kind, with no unknown-part note', () => {
    const read = readPackJson(file([WARDEN]));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.pack.warnings).toEqual([]);
    expect(read.pack.problems).toEqual([]);
    expect(read.pack.counts.patron).toBe(1);
    expect(read.pack.entries.find((e) => e.kind === 'patron')).toMatchObject({ packEntryId: 'ex-patron-lantern-warden', name: 'The Lantern Warden' });
    expect(KIND_WORDS.patron).toEqual(['patron', 'patrons']);
  });

  // Purpose: a patron nobody may follow, or one with an approval the app doesn't know, imports with a plain warning.
  it('warns about a patron with no follower classes, and about an approval it does not know', () => {
    const read = readPackJson(file([{ id: 'ex-patron-nobody', name: 'The Quiet One', approval: 'council' }]));
    expect(read.ok && read.pack.warnings).toEqual([
      'patrons: "The Quiet One" names no follower classes (followers.classes), so no character is offered it.',
      'patrons: "The Quiet One" has approval "council"; only "gm" is known, so it is read as free to pick.',
    ]);
  });

  // Purpose: the app's own list of kinds players read (which the stand-in database and the exceptions filter follow)
  // has patrons in it, as the database's does, and names the two fields that stay the GM's.
  it('counts patrons among the kinds players read', () => {
    expect(PLAYER_FACING).toContain('patron');
    expect(playerFacingEntry('patron', {})).toBe(true);
    expect(PATRON_GM_FIELDS).toEqual(['cult', 'statBlockId']);
  });
});

describe('who reads a patron (hard rule 5)', () => {
  // Purpose (plan m5b-patrons, tests): a player's device never receives a patron's stat block or cult, whether or not
  // the pack lists them in gmOnly; the player does read the rest of the patron; the GM keeps the cult in the hidden part.
  it("a player reads the patron without its cult or stat block; the hidden part holds them for the GM", async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, player, 'player');
    world.signInAs(gm);
    const registry = createAppRegistry();
    const read = readPackJson(file([WARDEN]));
    if (!read.ok) throw new Error(read.message);
    const made = await runCommand(registry, world.db, (await loadCurrentUser(world.db)) as CurrentUser, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    const attached = await runCommand(registry, world.db, (await loadCurrentUser(world.db)) as CurrentUser, attachPack, { campaignId: campaign, packId: made.value });
    expect(attached.ok).toBe(true);

    const stored = world.tables.library_entries.find((e) => e.kind === 'patron')!;
    expect(stored.data).not.toHaveProperty('cult');
    expect(stored.data).not.toHaveProperty('statBlockId');
    expect(world.tables.library_entry_secrets.find((s) => s.id === stored.id)?.data).toEqual({ cult: CULT, statBlockId: 'lantern-lord' });

    world.signInAs(player);
    const seen = await world.db.from('library_entries').select('kind, pack_entry_id, data').eq('pack_id', made.value);
    const rows = (seen.data ?? []) as { kind: string; pack_entry_id: string; data: Record<string, unknown> }[];
    expect(rows.map((r) => r.kind).sort()).toEqual(['option', 'patron']);
    expect(rows.find((r) => r.kind === 'patron')!.data).toMatchObject({ holySymbol: 'A lantern with an open shutter.', approval: 'gm' });
    expect(JSON.stringify(rows)).not.toContain(CULT);
    expect(JSON.stringify(rows)).not.toContain('lantern-lord');
    const secrets = await world.db.from('library_entry_secrets').select('id, data').eq('pack_id', made.value);
    expect(JSON.stringify(secrets.data ?? [])).not.toContain(CULT);
  });
});
