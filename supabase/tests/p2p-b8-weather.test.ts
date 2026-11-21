// Point to point's weather by the day (supabase/migrations/20261118160000_p2p_b8_weather_by_day.sql; plan
// docs/plans/scene-point-to-point.md, B8 and flag 10, ruled 2026-11-18, "Day weather"). TEST project only; invented
// weather, modes and places.
//   What the database works out is read through what it lets a player do: a player may enter only the weather step
//   that is due now, and its start is the database's (private.weather_now, which asks private.weather_every).
//   A point-to-point expedition's weather falls due once a day: the setting's day weather, not a turn's pace, not none.
//   Dungeon, Wilderness and a rules set's own modes are unchanged; a mode a pack wrote under the app's id is not used.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { enterWeather } from '../../src/modules/expedition/weatherPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

// Point to point's id as an expedition stores it: POINT_TO_POINT_ID in src/modules/expedition/modes.ts, which piece
// B8 adds (branch p2p-b8-method). Written out here so this test doesn't wait for that piece to be on main.
const POINT_TO_POINT = 'app:point-to-point';
const TURN = 600;
const DAY = 86_400;
const NOT_ROLLED = "The weather isn't rolled on this expedition.";
const NOT_DUE = "That isn't the weather that's due. Enter today's.";

const sky = (pack: string) => ({
  pack_id: pack,
  kind: 'table',
  pack_entry_id: 'fen-sky',
  name: 'Fen sky',
  data: { id: 'fen-sky', name: 'Fen sky', die: 'd6', rows: [{ min: 1, max: 3, result: 'Drizzle' }, { min: 4, max: 6, result: 'Clear skies' }] },
});
const skyStep = { id: 'sky', name: 'Read the sky', kind: 'roll', icon: 'weather', tableId: 'fen-sky' };

/** The three invented settings: day weather and no modes of its own; its own modes as well; no weather at all. */
const packs = { weather: '', modes: '', plain: '' };

beforeAll(async () => {
  world = await buildWorld();
  const make = async (name: string) => must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name }).select('id').single()).id as string;
  packs.weather = await make('Fen weather');
  packs.modes = await make('Fen ways');
  packs.plain = await make('Fen quiet');
  must(
    await world.admin
      .from('library_entries')
      .insert([
        // Day weather (rolled once a day, the default) and no modes: the campaign explores by the plain fallbacks.
        { pack_id: packs.weather, kind: 'rulesSet', pack_entry_id: 'fen-weather', name: 'Fen weather', data: { id: 'fen-weather', name: 'Fen weather', weather: { tables: { any: 'fen-sky' } } } },
        sky(packs.weather),
        // The same day weather, and modes of its own: a turn mode whose procedure reads the sky every turn, a day
        // mode whose own weather is rolled every 2 days, and a mode written under the app's id (which the app's
        // readMode leaves out), reading the sky every turn.
        {
          pack_id: packs.modes,
          kind: 'rulesSet',
          pack_entry_id: 'fen-ways',
          name: 'Fen ways',
          data: {
            id: 'fen-ways',
            name: 'Fen ways',
            weather: { tables: { any: 'fen-sky' } },
            exploration: {
              modes: [
                { id: 'fen-crawl', name: 'Crawling the sluices', step: { value: 1, unit: 'turn' }, procedure: [skyStep], checks: [] },
                { id: 'fen-walk', name: 'Walking the fen', step: { value: 1, unit: 'day' }, procedure: [], checks: [], weather: { tables: { any: 'fen-sky' }, rollEvery: { value: 2, unit: 'day' } } },
                { id: POINT_TO_POINT, name: 'A pack under the app’s id', step: { value: 1, unit: 'turn' }, procedure: [skyStep], checks: [] },
              ],
            },
          },
        },
        sky(packs.modes),
        // No weather anywhere.
        { pack_id: packs.plain, kind: 'rulesSet', pack_entry_id: 'fen-quiet', name: 'Fen quiet', data: { id: 'fen-quiet', name: 'Fen quiet' } },
      ])
      .select('id'),
  );
}, 300_000);

afterAll(async () => {
  for (const id of Object.values(packs)) if (id) await world.admin.from('packs').delete().eq('id', id);
  await tearDownWorld(world);
}, 60_000);

/** A fresh campaign with the world's GM and both players, one setting, players rolling the weather, and an expedition under way in a mode (the clock at 0). */
async function freshTrip(pack: string, mode: string) {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Lantern Road', created_by: world.gm.id, settings: { weatherRolledBy: 'players' } }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  must(await world.admin.from('campaign_packs').insert({ campaign_id: campaign.id, pack_id: pack, option_choices: {}, priority: 1 }).select());
  const expedition = must(await world.admin.from('expeditions').insert({ campaign_id: campaign.id, mode }).select().single());
  return { campaignId: campaign.id as string, expeditionId: expedition.id as string };
}

type Trip = Awaited<ReturnType<typeof freshTrip>>;
const entry = (t: Trip, period: number) => ({ campaignId: t.campaignId, expeditionId: t.expeditionId, period, startsAt: 0, tableId: 'fen-sky', roll: '2', rolledBy: 'players' as const });
/** A player's try at entering the weather for a step: where the database put its start, or the words it refused with. */
async function enter(person: Person, t: Trip, period: number): Promise<number | string> {
  const done = await as(person, enterWeather, entry(t, period));
  return done.ok ? done.value.startsAt : done.message;
}
const setClock = async (t: Trip, seconds: number) => expect((await world.gm.db.rpc('set_clock', { campaign: t.campaignId, to_seconds: seconds })).error).toBeNull();
const rollsOf = async (t: Trip) =>
  (must(await world.admin.from('weather_rolls').select('period, starts_at').eq('expedition_id', t.expeditionId).order('period')) as { period: number; starts_at: number }[]).map((r) => [r.period, Number(r.starts_at)]);

describe("point to point's weather falls due once a day", () => {
  // Purpose: on a point-to-point expedition in a setting with day weather, the weather is due at the start and then
  // once a day: turns passing don't make a new step due, a day does, and each step's start is the database's.
  it('the setting’s day weather: due at the start, not again after turns, again after a day', async () => {
    const t = await freshTrip(packs.weather, POINT_TO_POINT);
    expect(await enter(world.playerA, t, 0)).toBe(0);
    // Six turns on: still the first day's weather, so a second step isn't due.
    await setClock(t, 6 * TURN);
    expect(await enter(world.playerB, t, 1)).toBe(NOT_DUE);
    // Just short of a day: still not.
    await setClock(t, DAY - 1);
    expect(await enter(world.playerB, t, 1)).toBe(NOT_DUE);
    // A day on: the second step is due and starts on the day; the one after it isn't due yet.
    await setClock(t, DAY);
    expect(await enter(world.playerB, t, 2)).toBe(NOT_DUE);
    expect(await enter(world.playerB, t, 1)).toBe(DAY);
    expect(await rollsOf(t)).toEqual([[0, 0], [1, DAY]]);
  });

  // Purpose: point to point takes the setting's day weather even where the setting has turn modes of its own, and a
  // mode a pack wrote under the app's id (read every turn) is never the one used.
  it('in a setting with its own modes: still once a day, never the mode a pack wrote under the app’s id', async () => {
    const t = await freshTrip(packs.modes, POINT_TO_POINT);
    expect(await enter(world.playerA, t, 0)).toBe(0);
    await setClock(t, TURN);
    expect(await enter(world.playerB, t, 1)).toBe(NOT_DUE);
    await setClock(t, DAY);
    expect(await enter(world.playerB, t, 1)).toBe(DAY);
    expect(await rollsOf(t)).toEqual([[0, 0], [1, DAY]]);
  });

  // Purpose: "Day weather" means the setting's; a setting with no weather gives point to point none, as in any mode.
  it('a setting with no weather: none in point to point either', async () => {
    const t = await freshTrip(packs.plain, POINT_TO_POINT);
    expect(await enter(world.playerA, t, 0)).toBe(NOT_ROLLED);
    expect(await rollsOf(t)).toEqual([]);
  });
});

describe('the other modes are unchanged', () => {
  // Purpose: the plain Dungeon still has no weather, in a setting whose weather is the day's.
  it('Dungeon (the plain fallback): the weather isn’t rolled', async () => {
    const t = await freshTrip(packs.weather, 'dungeon');
    expect(await enter(world.playerA, t, 0)).toBe(NOT_ROLLED);
    await setClock(t, DAY);
    expect(await enter(world.playerA, t, 1)).toBe(NOT_ROLLED);
  });

  // Purpose: the plain Wilderness still takes the setting's day weather, once a day.
  it('Wilderness (the plain fallback): once a day, as before', async () => {
    const t = await freshTrip(packs.weather, 'wilderness');
    expect(await enter(world.playerA, t, 0)).toBe(0);
    await setClock(t, 6 * TURN);
    expect(await enter(world.playerB, t, 1)).toBe(NOT_DUE);
    await setClock(t, DAY);
    expect(await enter(world.playerB, t, 1)).toBe(DAY);
  });

  // Purpose: a rules set's own turn mode whose procedure reads the sky still has its weather due every turn, by its
  // own id and as "dungeon" (the first turn-by-turn mode).
  it('a rules set’s own turn mode with a weather step: every turn, by its id and as "dungeon"', async () => {
    for (const mode of ['fen-crawl', 'dungeon']) {
      const t = await freshTrip(packs.modes, mode);
      expect(await enter(world.playerA, t, 0)).toBe(0);
      await setClock(t, TURN);
      expect(await enter(world.playerB, t, 1)).toBe(TURN);
      await setClock(t, 3 * TURN);
      expect(await enter(world.playerA, t, 3)).toBe(3 * TURN);
    }
  });

  // Purpose: a rules set's own day mode with its own weather block still goes by that block's pace (every 2 days
  // here), by its own id and as "wilderness" (the first day-by-day mode).
  it('a rules set’s own day mode with its own weather: by that block’s pace, by its id and as "wilderness"', async () => {
    for (const mode of ['fen-walk', 'wilderness']) {
      const t = await freshTrip(packs.modes, mode);
      expect(await enter(world.playerA, t, 0)).toBe(0);
      await setClock(t, DAY);
      expect(await enter(world.playerB, t, 1)).toBe(NOT_DUE);
      await setClock(t, 2 * DAY);
      expect(await enter(world.playerB, t, 1)).toBe(2 * DAY);
    }
  });
});
