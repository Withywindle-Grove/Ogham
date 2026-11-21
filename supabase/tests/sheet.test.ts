// The full character sheet: loading it, and saving edits from it. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { loadCharacterSheet } from '../../src/core/characterSheet.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { editCharacter, toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
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

async function fresh(): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({
          campaign_id: world.campaignId,
          kind: 'pc',
          name: 'Hollis',
          owner_type: 'user',
          owner_user_id: world.playerA.id,
          approval: 'approved',
          level: 2,
          hp_current: 6,
          hp_max: 9,
          notes: 'Owes the ferryman',
          backstory: 'Raised on the barges',
          company_id: world.companyId,
        })
        .select()
        .single(),
    ),
  );
}

describe('the full sheet', () => {
  it('the owner and the GM load the whole sheet; an outsider gets nothing', async () => {
    const character = await fresh();
    for (const person of [world.playerA, world.gm]) {
      expect(await loadCharacterSheet(asDb(person), character.id)).toMatchObject({
        id: character.id,
        campaignId: world.campaignId,
        ownerUserId: world.playerA.id,
        approval: 'approved',
        archived: false,
        name: 'Hollis',
        level: 2,
        hpCurrent: 6,
        hpMax: 9,
        notes: 'Owes the ferryman',
        backstory: 'Raised on the barges',
        companyId: world.companyId,
      });
    }
    expect(await loadCharacterSheet(asDb(world.outsider), character.id)).toBeNull();
  });

  // Design on #567 (2026-11-08): once approved, Max HP is the rules set's own figure, so the owner asks the GM for it
  // (sheet.requestChange) and the direct save is refused; notes and backstory still save at once.
  it('the owner saves notes and backstory from the sheet; Max HP on an approved character waits for the GM', async () => {
    const character = await fresh();
    const saved = await as(world.playerA, editCharacter, {
      character,
      changes: { notes: 'Paid the ferryman', backstory: 'Raised on the barges, then the docks' },
    });
    expect(saved).toMatchObject({ ok: true });
    expect(await as(world.playerA, editCharacter, { character, changes: { hpMax: 11 } })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await loadCharacterSheet(asDb(world.playerA), character.id)).toMatchObject({
      notes: 'Paid the ferryman',
      backstory: 'Raised on the barges, then the docks',
      hpMax: 9,
    });
  });

  it("only the GM changes an approved character's level", async () => {
    const character = await fresh();
    expect(await as(world.playerA, editCharacter, { character, changes: { level: 5 } })).toMatchObject({
      ok: false,
      reason: 'not-allowed',
    });
    expect(await as(world.gm, editCharacter, { character, changes: { level: 4 } })).toMatchObject({ ok: true });
    expect((await loadCharacterSheet(asDb(world.playerA), character.id))?.level).toBe(4);
  });
});
