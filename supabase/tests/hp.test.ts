// Hit points on the Player screen: the owner or the GM sets current HP. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadMyCharacters } from '../../src/core/myCharacters.ts';
import type { Db } from '../../src/core/supabase.ts';
import { toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
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

async function fresh(owner = world.playerA): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({
          campaign_id: world.campaignId,
          kind: 'pc',
          name: 'Hollis',
          owner_type: 'user',
          owner_user_id: owner.id,
          approval: 'approved',
          hp_max: 14,
        })
        .select()
        .single(),
    ),
  );
}

const hpOf = async (id: string) => must(await world.admin.from('actors').select('hp_current').eq('id', id).single()).hp_current;

describe('hit points', () => {
  it('the owner sets their character’s HP, below 0 and above max too, and their page reads it back', async () => {
    const character = await fresh();
    for (const hp of [9, -3, 17]) {
      expect(await as(world.playerA, setHp, { character, hpCurrent: hp })).toMatchObject({ ok: true, value: hp });
      expect(await hpOf(character.id)).toBe(hp);
    }
    const mine = (await loadMyCharacters(asDb(world.playerA), world.campaignId, world.playerA.id)) ?? [];
    expect(mine.find((c) => c.id === character.id)).toMatchObject({ hpCurrent: 17, hpMax: 14 });
  });

  it('the GM can set a player character’s HP', async () => {
    const character = await fresh();
    expect(await as(world.gm, setHp, { character, hpCurrent: 4 })).toMatchObject({ ok: true });
    expect(await hpOf(character.id)).toBe(4);
  });

  it("another player can't change your character's HP, even skipping the app's own check", async () => {
    const character = await fresh();
    const other = (await loadCurrentUser(asDb(world.playerB)))!;
    expect(await setHp.run(asDb(world.playerB), other, { character, hpCurrent: 1 })).toMatchObject({
      ok: false,
      reason: 'not-allowed',
    });
    expect(await hpOf(character.id)).toBeNull();
  });

  it('HP must be a whole number', async () => {
    const character = await fresh();
    expect(await as(world.playerA, setHp, { character, hpCurrent: 2.5 })).toMatchObject({
      ok: false,
      message: 'HP must be a whole number.',
    });
    expect(await hpOf(character.id)).toBeNull();
  });
});
