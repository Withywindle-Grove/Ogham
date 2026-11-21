// Making a character and the GM's approval: level, review note, and the first active character. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { setActiveCharacter } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import {
  createCharacter,
  editCharacter,
  reviewCharacter,
  toCharacterRef,
  type CharacterRef,
} from '../../src/modules/characters/commands.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();

beforeAll(async () => {
  world = await buildWorld();
  // The newcomer has just joined The Reedmouth Delve and has no character yet.
  must(
    await world.admin
      .from('members')
      .insert({ campaign_id: world.campaignId, user_id: world.newcomer.id, base_role: 'player' })
      .select(),
  );
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  const db = person.db as unknown as Db;
  return runCommand(registry, db, await loadCurrentUser(db), command, input);
}

async function make(person: Person, name: string, extra: { level?: number; hpMax?: number; backstory?: string } = {}) {
  const result = await as(person, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, ...extra });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const row = async (id: string) => must(await world.admin.from('actors').select('*').eq('id', id).single());
const activeOf = async (person: Person) =>
  must(
    await world.admin
      .from('members')
      .select('active_actor_id')
      .eq('campaign_id', world.campaignId)
      .eq('user_id', person.id)
      .single(),
  ).active_actor_id;

describe('making a character', () => {
  it("a player's new character waits for approval at the level they chose, with their HP max and backstory", async () => {
    const hollis = await make(world.newcomer, 'Hollis', { level: 3, hpMax: 5, backstory: 'Raised by lock-keepers.' });
    expect(await row(hollis.id)).toMatchObject({
      approval: 'pending',
      level: 3,
      hp_max: 5,
      hp_current: 5,
      backstory: 'Raised by lock-keepers.',
      review_note: '',
    });
  });

  it('HP max must be a whole number of at least 1', async () => {
    const result = await as(world.newcomer, createCharacter, {
      campaignId: world.campaignId,
      kind: 'pc' as const,
      name: 'Half a Hollis',
      hpMax: 2.5,
    });
    expect(result).toMatchObject({ ok: false, reason: 'failed' });
  });

  it('a character with no level chosen starts at level 1', async () => {
    const plain = await make(world.newcomer, 'Plain Hollis');
    expect((await row(plain.id)).level).toBe(1);
  });

  it('a starting level must be a whole number of at least 1', async () => {
    for (const level of [0, 1.5]) {
      const result = await as(world.newcomer, createCharacter, {
        campaignId: world.campaignId,
        kind: 'pc' as const,
        name: 'Odd Hollis',
        level,
      });
      expect(result, String(level)).toMatchObject({ ok: false, reason: 'failed' });
    }
  });

  it("a player can't create a character with a review note already on it", async () => {
    const attempt = await world.newcomer.db
      .from('actors')
      .insert({
        campaign_id: world.campaignId,
        kind: 'pc',
        name: 'Sir Shortcut',
        owner_type: 'user',
        owner_user_id: world.newcomer.id,
        review_note: 'Approved by me',
      })
      .select();
    expect(attempt.error).not.toBeNull();
  });

  it('a waiting character is never active, even if its owner asks', async () => {
    const waiting = await make(world.newcomer, 'Pip the Unready');
    const result = await as(world.newcomer, setActiveCharacter, { campaignId: world.campaignId, character: waiting });
    expect(result).toMatchObject({ ok: false, reason: 'not-allowed' });
    // The database refuses too, not just the app.
    await world.newcomer.db
      .from('members')
      .update({ active_actor_id: waiting.id })
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.newcomer.id);
    expect(await activeOf(world.newcomer)).toBeNull();
  });
});

describe("the GM's approval", () => {
  let first: CharacterRef;

  it("approving keeps the player's level and makes it their active character", async () => {
    first = await make(world.newcomer, 'Hollis the First', { level: 2 });
    const result = await as(world.gm, reviewCharacter, { character: first, decision: 'approved' as const });
    expect(result.ok).toBe(true);
    expect(await row(first.id)).toMatchObject({ approval: 'approved', level: 2 });
    expect(await activeOf(world.newcomer)).toBe(first.id);
  });

  it("a later approved character doesn't replace the active one", async () => {
    const second = await make(world.newcomer, 'Hollis the Second');
    await as(world.gm, reviewCharacter, { character: second, decision: 'approved' as const });
    expect(await activeOf(world.newcomer)).toBe(first.id);
  });

  it('the GM can fill in HP max at approval when the player left it empty', async () => {
    const noHp = await make(world.newcomer, 'Hollis the Unrolled');
    await as(world.gm, reviewCharacter, { character: noHp, decision: 'approved' as const, hpMax: 6 });
    expect(await row(noHp.id)).toMatchObject({ hp_max: 6, hp_current: 6 });
  });

  it('sending back keeps the character, marked rejected with the note, which its owner can read', async () => {
    const back = await make(world.newcomer, 'Hollis the Hasty');
    const result = await as(world.gm, reviewCharacter, {
      character: back,
      decision: 'rejected' as const,
      note: 'Pick a name that fits the river towns.',
    });
    expect(result.ok).toBe(true);
    const seen = must(await world.newcomer.db.from('actors').select('approval, review_note').eq('id', back.id).single());
    expect(seen).toEqual({ approval: 'rejected', review_note: 'Pick a name that fits the river towns.' });
    const other = await world.playerA.db.from('actors').select('id').eq('id', back.id);
    expect(other.data).toEqual([]);
  });

  it('a player can change the level of a character that is waiting or sent back', async () => {
    const waiting = await make(world.newcomer, 'Hollis the Unsure', { level: 1 });
    const edited = await as(world.newcomer, editCharacter, { character: waiting, changes: { level: 3 } });
    expect(edited.ok).toBe(true);
    expect((await row(waiting.id)).level).toBe(3);
  });

  it("once approved, a player can't change their character's level; nor ever its review note", async () => {
    const own = toCharacterRef(await row(first.id));
    for (const patch of [{ level: 9 }, { review_note: 'Looks great!' }]) {
      const attempt = await world.newcomer.db.from('actors').update(patch).eq('id', own.id).select();
      expect(attempt.error, JSON.stringify(patch)).not.toBeNull();
    }
    expect(await row(own.id)).toMatchObject({ level: 2, review_note: '' });
  });
});
