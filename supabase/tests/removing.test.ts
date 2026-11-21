// Removing characters (delete if never approved, archive if approved), restoring, and switching. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { setActiveCharacter } from '../../src/core/campaignCommands.ts';
import { characterCopy, loadCharacterCopy } from '../../src/core/characterCopy.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import {
  archiveCharacter,
  deleteCharacter,
  restoreCharacter,
  toCharacterRef,
  type CharacterRef,
} from '../../src/modules/characters/commands.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  const db = person.db as unknown as Db;
  return runCommand(registry, db, await loadCurrentUser(db), command, input);
}

/** A fresh character for Player A, made directly in the database. */
async function fresh(approval: 'pending' | 'approved' | 'rejected', name = 'Fresh Hollis'): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({
          campaign_id: world.campaignId,
          kind: 'pc',
          name,
          owner_type: 'user',
          owner_user_id: world.playerA.id,
          approval,
          level: 2,
          hp_max: 6,
          hp_current: 6,
          backstory: 'Raised by lock-keepers.',
        })
        .select()
        .single(),
    ),
  );
}

const exists = async (id: string) => ((await world.admin.from('actors').select('id').eq('id', id)).data ?? []).length > 0;
const row = async (id: string) => must(await world.admin.from('actors').select('*').eq('id', id).single());
const activeOfA = async () =>
  must(
    await world.admin
      .from('members')
      .select('active_actor_id')
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.playerA.id)
      .single(),
  ).active_actor_id;

describe('deleting a character that was never approved', () => {
  it('its owner can delete a waiting or sent-back character for good', async () => {
    for (const approval of ['pending', 'rejected'] as const) {
      const character = await fresh(approval);
      expect((await as(world.playerA, deleteCharacter, { character })).ok, approval).toBe(true);
      expect(await exists(character.id), approval).toBe(false);
    }
  });

  it('the GM can delete a waiting character', async () => {
    const character = await fresh('pending');
    expect((await as(world.gm, deleteCharacter, { character })).ok).toBe(true);
    expect(await exists(character.id)).toBe(false);
  });

  it("another player can't delete it", async () => {
    const character = await fresh('pending');
    expect(await as(world.playerB, deleteCharacter, { character })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await exists(character.id)).toBe(true);
  });

  it("an approved character can't be deleted outright, by its owner or the GM", async () => {
    const character = await fresh('approved');
    for (const who of [world.playerA, world.gm]) {
      expect(await as(who, deleteCharacter, { character })).toMatchObject({ ok: false, reason: 'not-allowed' });
      // The database refuses too, not just the app.
      await who.db.from('actors').delete().eq('id', character.id);
      expect(await exists(character.id)).toBe(true);
    }
  });
});

describe('removing an approved character (archiving)', () => {
  it('its owner can archive it; it stays in the database and stops being active', async () => {
    const character = await fresh('approved');
    must(
      await world.admin
        .from('members')
        .update({ active_actor_id: character.id })
        .eq('campaign_id', world.campaignId)
        .eq('user_id', world.playerA.id)
        .select(),
    );
    expect((await as(world.playerA, archiveCharacter, { character })).ok).toBe(true);
    expect((await row(character.id)).status).toBe('archived');
    expect(await activeOfA()).toBeNull();
  });

  it("another player can't archive it", async () => {
    const character = await fresh('approved');
    expect(await as(world.playerB, archiveCharacter, { character })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect((await row(character.id)).status).toBe('active');
  });

  it("an archived character can't be made active", async () => {
    const character = await fresh('approved');
    await as(world.gm, archiveCharacter, { character });
    const archived = toCharacterRef(await row(character.id));
    expect(await as(world.playerA, setActiveCharacter, { campaignId: world.campaignId, character: archived })).toMatchObject({
      ok: false,
      reason: 'not-allowed',
    });
    await world.playerA.db
      .from('members')
      .update({ active_actor_id: character.id })
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.playerA.id);
    expect(await activeOfA()).not.toBe(character.id);
  });

  it("only the GM can restore an archived character; its owner can't un-archive it", async () => {
    const character = await fresh('approved');
    await as(world.playerA, archiveCharacter, { character });
    const archived = toCharacterRef(await row(character.id));
    expect(await as(world.playerA, restoreCharacter, { character: archived })).toMatchObject({ ok: false });
    await world.playerA.db.from('actors').update({ status: 'active' }).eq('id', character.id);
    expect((await row(character.id)).status).toBe('archived');

    expect((await as(world.gm, restoreCharacter, { character: archived })).ok).toBe(true);
    expect((await row(character.id)).status).toBe('active');
  });

  it('the GM can delete an archived character permanently', async () => {
    const character = await fresh('approved');
    await as(world.gm, archiveCharacter, { character });
    const archived = toCharacterRef(await row(character.id));
    expect((await as(world.gm, deleteCharacter, { character: archived })).ok).toBe(true);
    expect(await exists(character.id)).toBe(false);
  });

  it("a player can delete their own archived character permanently, but not another player's", async () => {
    const character = await fresh('approved');
    await as(world.playerA, archiveCharacter, { character });
    const archived = toCharacterRef(await row(character.id));
    expect(await as(world.playerB, deleteCharacter, { character: archived })).toMatchObject({ ok: false });
    await world.playerB.db.from('actors').delete().eq('id', character.id);
    expect(await exists(character.id)).toBe(true);
    expect((await as(world.playerA, deleteCharacter, { character: archived })).ok).toBe(true);
    expect(await exists(character.id)).toBe(false);
  });

  it("a player can't change their character's status in other ways (for example to dead)", async () => {
    const character = await fresh('approved');
    const attempt = await world.playerA.db.from('actors').update({ status: 'dead' }).eq('id', character.id).select();
    expect(attempt.error).not.toBeNull();
  });
});

describe('switching the active character', () => {
  it('a player can switch between their own approved characters', async () => {
    const first = await fresh('approved', 'Wren the Elder');
    const second = await fresh('approved', 'Wren the Younger');
    for (const character of [first, second]) {
      expect((await as(world.playerA, setActiveCharacter, { campaignId: world.campaignId, character })).ok).toBe(true);
      expect(await activeOfA()).toBe(character.id);
    }
  });
});

describe('downloading a copy', () => {
  it("the copy holds the whole character, labelled so it can be restored later", async () => {
    const character = await fresh('approved', 'Hollis the Kept');
    const copy = await loadCharacterCopy(world.playerA.db as unknown as Db, character.id, 'The Reedmouth Delve');
    expect(copy).toMatchObject({
      format: 'grimoire-character',
      version: 1,
      campaignName: 'The Reedmouth Delve',
      character: { name: 'Hollis the Kept', level: 2, hp_max: 6, backstory: 'Raised by lock-keepers.' },
    });
    expect(JSON.parse(JSON.stringify(copy))).toEqual(copy);
    expect(characterCopy).toBeTypeOf('function');
  });

  it("another player can't download a copy of a character they can't see", async () => {
    const character = await fresh('pending', 'Hollis the Private');
    expect(await loadCharacterCopy(world.playerB.db as unknown as Db, character.id, 'The Reedmouth Delve')).toBeNull();
  });
});
