// A rumour table's truth, the GM's alone, and giving a rolled row (dec-12 piece E; docs/plans/
// dec-12-calls-to-adventure-and-notes.md; ruled mc-65, tb-1; who reads a given row: rm-1, Francis's yes of 2026-11-14;
// migration 20261114220000). TEST project or CI's local database; invented content. What it checks:
//   * a rumours table is the GM's: no player in the campaign, nor an outsider, reads any of it, its words, its truth or
//     its note; the GM reads it all (hard rule 5);
//   * a row given to the party is read by every player as its words only; one given to a character by that character's
//     player only; another player can't read it; an outsider reads none;
//   * the truth and the note are in no payload a player receives: the given rows, the log's lines, and what a player
//     gets back from give_rumour (a refusal);
//   * Undo marks a give undone and players no longer read it;
//   * a second give of a row to the same hearer is refused in words; a player can't give, nor change a give's kind.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { loadCalls } from '../../src/modules/library/callsToAdventure.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { giveRumour } from '../../src/modules/library/rumours.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

const COG = 'The cog went down with her captain still aboard';
const LIGHT = 'There is a light in the shed some nights';
const TIDEWIFE = 'The Tidewife drowns anyone who rows at slack water';
// The GM's alone: a row's note, and a truth word no rumour's words hold ("partial").
const NOTE = 'The captain walks the bar as a Bog lurker now';
const TABLE = 'ew-quay-rumours';

let packId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The eel weirs', version: '0.1', kind: 'adventure' },
      tables: [
        {
          id: TABLE,
          name: 'What they say on the quay',
          die: 'd4',
          uses: ['world.rumours'],
          rows: [
            { min: 1, max: 1, result: COG, truth: 'true', note: NOTE },
            { min: 2, max: 3, result: `${TIDEWIFE} ([[npc:ew-tidewife|ask her]])`, truth: 'partial', note: NOTE },
            { min: 4, max: 4, result: LIGHT, truth: 'false', note: NOTE },
          ],
        },
      ],
    }),
  );
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

const givesAs = async (person: Person) => must(await person.db.from('hook_sends').select('*').eq('campaign_id', world.campaignId).eq('kind', 'rumour'));
const linesAs = async (person: Person) => JSON.stringify(must(await person.db.from('events').select('id, type, before, after').eq('campaign_id', world.campaignId).eq('target_table', 'hook_sends')));
const give = (actorId: string | null, min: number, max = min) => as(world.gm, giveRumour, { campaignId: world.campaignId, packId, tableId: TABLE, min, max, actorId });
// Nothing a player receives carries a truth or a note: the words "partial" and the note's never appear.
const noTruth = (payload: string) => {
  expect(payload).not.toContain(NOTE);
  expect(payload).not.toContain('partial');
  expect(payload).not.toContain('"truth"');
};

describe("a rumours table is the GM's (hard rule 5)", () => {
  // Purpose: no player in the campaign and no outsider reads any part of a rumours table (its words, truth or note).
  it('is read by no player, nor an outsider, as each reads the tables', async () => {
    for (const person of [world.playerA, world.playerB, world.outsider]) {
      const raw = JSON.stringify(must(await person.db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', packId)));
      expect(raw).not.toContain(TABLE);
      expect(raw).not.toContain(COG);
      noTruth(raw);
      // Nor any log line they can read (the import's lines included).
      const log = JSON.stringify(must(await person.db.from('events').select('before, after').eq('campaign_id', world.campaignId)));
      expect(log).not.toContain(NOTE);
      expect(log).not.toContain(COG);
    }
  });

  // Purpose: the GM reads the table whole, its truth included, as the GM's sheet shows it.
  it('is read whole by the GM, truth included', async () => {
    const calls = await loadCalls(asDb(world.gm), world.campaignId);
    const table = calls?.adventures[0]?.rumours[0];
    expect(table?.rows.map((r) => [r.range, r.words, r.truth])).toEqual([
      ['1', COG, 'True'],
      ['2–3', `${TIDEWIFE} (ask her)`, 'Partly'],
      ['4', LIGHT, 'False'],
    ]);
  });
});

describe('giving a row (rumour.give)', () => {
  // Purpose: a row given to the party is read by every player as its words only, its link mark as words, never its
  // truth or note; an outsider reads nothing; the GM reads it.
  it('to the party: every player reads its words only; an outsider nothing; the GM reads it', async () => {
    expect(await give(null, 2, 3)).toMatchObject({ ok: true, value: { key: `${TABLE}#2-3` } });
    for (const person of [world.playerA, world.playerB]) {
      const rows = await givesAs(person);
      // Named "A rumour", never the table's name (rm-2, 20261115001000_dec_12e_rumour_name.sql).
      expect(rows.map((r) => [r.body, r.name, r.pays, r.actor_id])).toEqual([[`${TIDEWIFE} (ask her)`, 'A rumour', '', null]]);
      expect(JSON.stringify(rows)).not.toContain('What they say on the quay');
      noTruth(JSON.stringify(rows));
      expect(JSON.stringify(rows)).not.toContain('ew-tidewife');
      noTruth(await linesAs(person));
    }
    expect(await givesAs(world.outsider)).toEqual([]);
    expect((await givesAs(world.gm)).map((r) => r.hook_key)).toEqual([`${TABLE}#2-3`]);
  });

  // Purpose: a row given to one character is read by that character's player (its words only) and the GM, never by
  // the other player, its row and its log line both.
  it("to one character: that character's player reads it, the other player doesn't, row and log line", async () => {
    expect(await give(world.ashId, 1)).toMatchObject({ ok: true });
    const hearer = (await givesAs(world.playerB)).filter((r) => r.actor_id === world.ashId);
    expect(hearer.map((r) => r.body)).toEqual([COG]);
    noTruth(JSON.stringify(hearer));
    noTruth(await linesAs(world.playerB));
    const other = await givesAs(world.playerA);
    expect(other.filter((r) => r.actor_id === world.ashId)).toEqual([]);
    expect(JSON.stringify(other)).not.toContain(COG);
    expect(await linesAs(world.playerA)).not.toContain(COG);
    expect((await givesAs(world.gm)).filter((r) => r.actor_id === world.ashId).map((r) => r.body)).toEqual([COG]);
    const line = must(await world.admin.from('events').select('audience, owner_user_id').eq('campaign_id', world.campaignId).eq('type', 'rumour.give').order('seq', { ascending: false }).limit(1));
    expect(line[0]).toMatchObject({ audience: 'owner', owner_user_id: world.playerB.id });
  });

  // Purpose: what is stored for a give holds the row's words alone: no truth and no note anywhere in the row.
  it('stores the words alone: no truth and no note in the given row', async () => {
    const rows = must(await world.admin.from('hook_sends').select('*').eq('campaign_id', world.campaignId).eq('kind', 'rumour'));
    expect(rows.length).toBeGreaterThan(0);
    noTruth(JSON.stringify(rows));
  });

  // Purpose: a second give of a row to the same hearer is refused in words, and nothing is written.
  it('refuses a second give to the same hearer in words, and changes nothing', async () => {
    expect(await give(null, 2, 3)).toMatchObject({ ok: false, message: "It wasn't sent again: the party already has it. Nothing changed." });
    expect(must(await world.admin.from('hook_sends').select('id').eq('campaign_id', world.campaignId).eq('kind', 'rumour'))).toHaveLength(2);
  });

  // Purpose: only the GM gives: a player is refused through the command and the function (whose refusal carries no
  // truth), and a player can't change a give, its kind included.
  it("a player can't give, and the refusal carries nothing of the table; nor change a give", async () => {
    expect(await as(world.playerA, giveRumour, { campaignId: world.campaignId, packId, tableId: TABLE, min: 4, max: 4, actorId: null })).toMatchObject({ ok: false });
    const raw = await world.playerA.db.rpc('give_rumour', { campaign: world.campaignId, pack: packId, table_key: TABLE, row_min: 4, row_max: 4 });
    expect(raw.error?.code).toBe('42501');
    noTruth(JSON.stringify(raw));
    expect(JSON.stringify(raw)).not.toContain(LIGHT);
    const party = must(await world.admin.from('hook_sends').select('id').eq('hook_key', `${TABLE}#2-3`))[0]!;
    await world.playerA.db.from('hook_sends').update({ kind: 'hook', body: 'Changed.' }).eq('id', party.id);
    expect(must(await world.admin.from('hook_sends').select('kind, body').eq('id', party.id))[0]).toMatchObject({ kind: 'rumour', body: `${TIDEWIFE} (ask her)` });
  });

  // Purpose: a row the table doesn't have, and a table that isn't rumours, are refused in words.
  it('refuses a row the table lacks, in words', async () => {
    expect(await give(null, 9)).toMatchObject({ ok: false, message: "That rumour isn't in its table any more." });
    expect(await as(world.gm, giveRumour, { campaignId: world.campaignId, packId, tableId: 'ew-no-such-table', min: 1, max: 1, actorId: null })).toMatchObject({
      ok: false,
      message: "That table of rumours isn't in an adventure this campaign uses.",
    });
  });

  // Purpose: Undo marks a give undone (nothing is erased), its hearer no longer reads it, and the row can be given
  // to that hearer again.
  it('Undo marks the give undone, and the hearer no longer reads it', async () => {
    const line = must(await world.admin.from('events').select('id, actor_user_id').eq('campaign_id', world.campaignId).eq('type', 'rumour.give').order('seq', { ascending: false }).limit(1))[0]!;
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: line.id, authorUserId: line.actor_user_id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('hook_sends').select('undone').eq('hook_key', `${TABLE}#1-1`))[0]?.undone).toBe(true);
    expect((await givesAs(world.playerB)).filter((r) => r.actor_id === world.ashId)).toEqual([]);
    expect(await give(world.ashId, 1)).toMatchObject({ ok: true });
  });

  // Purpose: a give leaves the hooks' count alone: the GM's calls read it as a rumour heard, never as a hook sent.
  it("is a rumour heard in the GM's calls, never a hook sent", async () => {
    const calls = await loadCalls(asDb(world.gm), world.campaignId);
    expect(calls?.sends).toEqual([]);
    expect(calls?.gives.map((g) => g.key).sort()).toEqual([`${TABLE}#1-1`, `${TABLE}#2-3`]);
  });
});
