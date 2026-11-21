// Reading the event log, and hearing about new entries live. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { createInvite } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadLog, watchLog } from '../../src/core/events.ts';
import type { Db } from '../../src/core/supabase.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { setHp } from '../../src/modules/characters/hp.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

const wren = async () => toCharacterRef(must(await world.admin.from('actors').select('*').eq('id', world.wrenId).single()));

/**
 * Starts listening as this person; once listening (plus a beat: Supabase can report "ready" a moment early),
 * runs each action in turn until something is heard, waiting up to `ms` after each. True as soon as anything
 * arrives. The free-tier test project is sometimes slow, so a second action gives it another chance.
 */
function heardAfter(person: Person, actions: (() => Promise<unknown>)[], ms: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (heard: boolean) => {
      if (settled) return;
      settled = true;
      stop();
      resolve(heard);
    };
    const runFrom = (index: number) => {
      if (settled) return;
      const action = actions[index];
      if (!action) return finish(false);
      action().then(() => setTimeout(() => runFrom(index + 1), ms), reject);
    };
    const stop = watchLog(
      asDb(person),
      world.campaignId,
      () => finish(true),
      () => setTimeout(() => runFrom(0), 1_000),
    );
  });
}

describe('reading the log', () => {
  it('shows newest first; HP ticks only in the verbose view; older entries a page at a time', async () => {
    const character = await wren();
    for (const hp of [10, 9, 8]) await as(world.playerA, setHp, { character, hpCurrent: hp });

    const simple = await loadLog(asDb(world.playerA), world.campaignId);
    expect(simple?.events.some((e) => e.type === 'character.setHp')).toBe(false);

    const verbose = await loadLog(asDb(world.playerA), world.campaignId, { verbose: true });
    const ticks = verbose!.events.filter((e) => e.type === 'character.setHp').map((e) => e.after?.hp_current);
    expect(ticks).toEqual([8, 9, 10]);

    const newest = verbose!.events[0]!;
    const older = await loadLog(asDb(world.playerA), world.campaignId, { verbose: true, olderThan: newest.seq });
    expect(older!.events.every((e) => e.seq < newest.seq)).toBe(true);
  });
});

describe('live updates', () => {
  it('a player hears about a new entry they may see, and not about one they may not', async () => {
    const character = await wren();

    // Player B may see Player A's HP change on an approved character…
    expect(
      await heardAfter(
        world.playerB,
        [() => as(world.playerA, setHp, { character, hpCurrent: 6 }), () => as(world.playerA, setHp, { character, hpCurrent: 5 })],
        12_000,
      ),
    ).toBe(true);
    // …but not the GM making an invite (GM only).
    expect(await heardAfter(world.playerB, [() => as(world.gm, createInvite, { campaignId: world.campaignId })], 8_000)).toBe(false);
  }, 90_000);
});
