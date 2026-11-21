// M5 calendar follow-ups (supabase/migrations/20261030140000_m5_calendar_followups.sql; ruled 2026-10-30). TEST
// project only; invented content.
//   Players see the date and season: a member reads the campaign's calendars (names, months, seasons) through
//   campaign_calendars, never their GM-only fields; an outsider reads none; library_entries still keeps calendars
//   the GM's. The GM's exception for a calendar shows as preferred, so every device stacks the same one.
//   Special seasons reach players without their start chances or encounter swaps; the GM gets them whole.
//   "Not now" on "Which season?" is kept with the campaign, logged Verbose as the GM's; a player can't say it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { seasonNotNow } from '../../src/modules/expedition/play.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack, loadPackEntries } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

let packId = '';
let linkId = '';
beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen reckoning', version: '1' },
      calendars: [
        {
          id: 'river-reckoning',
          name: 'Reckoning of the river towns',
          months: [
            { name: 'Thawmonth', days: 28, season: 'spring' },
            { name: 'Highsun', days: 31, season: 'summer' },
          ],
          omens: 'The heron moon brings the drowned folk ashore.',
          gmOnly: ['omens'],
        },
      ],
      rulesSets: [
        {
          id: 'fen-rules',
          name: 'Fen rules',
          seasons: [{ id: 'spring', name: 'Spring' }, { id: 'summer', name: 'Summer' }],
          specialSeasons: [
            {
              id: 'mistwane',
              name: 'Mistwane',
              weatherFrom: 'spring',
              start: { text: 'On the first day of spring, 1 in 6.', chance: { die: 'd6', on: [1] } },
              encounterSwap: { chance: { die: 'd6', on: [1, 2] }, tableId: 'mist-things' },
            },
            { id: 'stillwater', name: 'Stillwater' },
          ],
        },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  if (!attached.ok) throw new Error(attached.message);
  linkId = attached.value.id;
}, 300_000);

afterAll(async () => {
  if (packId) await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

const calendarsFor = async (person: Person) => must(await person.db.rpc('campaign_calendars', { campaign: world.campaignId }));

describe('players see the date and season (ruled 2026-10-30)', () => {
  it("a player reads the calendar's names, months and seasons, never its GM-only fields", async () => {
    const [calendar] = await calendarsFor(world.playerA);
    expect(calendar).toMatchObject({ pack_id: packId, pack_entry_id: 'river-reckoning', name: 'Reckoning of the river towns', preferred: false });
    const data = calendar!.data as Record<string, unknown>;
    expect(data.months).toEqual([
      { name: 'Thawmonth', days: 28, season: 'spring' },
      { name: 'Highsun', days: 31, season: 'summer' },
    ]);
    // Hidden means hidden: the GM-only part (and the list naming it) never reaches a player.
    expect(JSON.stringify(calendar)).not.toContain('heron moon');
    expect(data).not.toHaveProperty('omens');
    expect(data).not.toHaveProperty('gmOnly');
  });

  it('calendars stay out of players\' reach in the setting rules themselves; an outsider reads none at all', async () => {
    expect(must(await world.playerA.db.from('library_entries').select('kind').eq('pack_id', packId).eq('kind', 'calendar'))).toEqual([]);
    expect(await calendarsFor(world.outsider)).toEqual([]);
    // The GM still has the whole calendar.
    const entries = await loadPackEntries(asDb(world.gm), packId);
    expect(entries?.find((e) => e.kind === 'calendar')?.data).toMatchObject({ omens: 'The heron moon brings the drowned folk ashore.' });
  });

  it("the GM's exception for a calendar shows as preferred, so every device picks the same one", async () => {
    must(await world.admin.from('campaign_pack_secrets').update({ overrides: { 'calendar:river-reckoning': 'Fen reckoning' } }).eq('id', linkId).select('id'));
    try {
      expect((await calendarsFor(world.playerA))[0]).toMatchObject({ preferred: true });
    } finally {
      must(await world.admin.from('campaign_pack_secrets').update({ overrides: {} }).eq('id', linkId).select('id'));
    }
  });
});

describe("special seasons' start chances are the GM's (ruled 2026-10-30)", () => {
  it('a player gets each special season without its start chance or encounter swap; the GM gets them whole', async () => {
    const [asPlayer] = must(await world.playerA.db.from('library_entries').select('data').eq('pack_id', packId).eq('kind', 'rulesSet'));
    expect((asPlayer!.data as Record<string, unknown>).specialSeasons).toEqual([
      { id: 'mistwane', name: 'Mistwane', weatherFrom: 'spring' },
      { id: 'stillwater', name: 'Stillwater' },
    ]);
    expect(JSON.stringify(asPlayer)).not.toContain('1 in 6');
    // The encounter swap (its chance and its table) never reaches a player either (confirmed 2026-10-30).
    expect(JSON.stringify(asPlayer)).not.toContain('encounterSwap');
    expect(JSON.stringify(asPlayer)).not.toContain('mist-things');
    expect(must(await world.playerA.db.from('library_entry_secrets').select('id').eq('pack_id', packId))).toEqual([]);
    const whole = await loadPackEntries(asDb(world.gm), packId);
    const seasons = (whole?.find((e) => e.kind === 'rulesSet')?.data as Record<string, unknown>).specialSeasons as Record<string, unknown>[];
    expect(seasons[0]).toMatchObject({ start: { chance: { die: 'd6', on: [1] } }, encounterSwap: { tableId: 'mist-things' } });
  });
});

describe('"Not now" on "Which season?" (ruled 2026-10-30)', () => {
  it('the GM\'s Not now is kept with the campaign and logged Verbose; a player can\'t say it', async () => {
    const said = await as(world.gm, seasonNotNow, { campaignId: world.campaignId });
    expect(said.ok).toBe(true);
    const [row] = must(await world.playerA.db.from('campaigns').select('season_not_now_at').eq('id', world.campaignId));
    expect(row!.season_not_now_at).toBeTruthy();
    const logged = must(await world.admin.from('events').select('type, level').eq('campaign_id', world.campaignId).eq('type', 'calendar.seasonNotNow'));
    expect(logged).toEqual([{ type: 'calendar.seasonNotNow', level: 'verbose' }]);
    const refused = await world.playerA.db.rpc('season_not_now', { campaign: world.campaignId });
    expect(refused.error?.code).toBe('42501');
  });
});
