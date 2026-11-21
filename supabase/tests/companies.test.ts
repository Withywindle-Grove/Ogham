// Companies: the GM creates, renames and deletes them, and puts characters in them. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { createCompany, deleteCompany, renameCompany } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCompanies } from '../../src/core/companies.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadPlayers } from '../../src/core/gmCampaign.ts';
import { loadMyCampaigns } from '../../src/core/myCampaigns.ts';
import { loadMyCharacters } from '../../src/core/myCharacters.ts';
import type { Db } from '../../src/core/supabase.ts';
import { archiveCharacter, assignCompany, toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
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

async function fresh(approval: 'pending' | 'rejected' | 'approved', owner = world.playerA): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Hollis', owner_type: 'user', owner_user_id: owner.id, approval })
        .select()
        .single(),
    ),
  );
}

async function newCompany(name: string): Promise<string> {
  const made = await as(world.gm, createCompany, { campaignId: world.campaignId, name });
  if (!made.ok) throw new Error(made.message);
  return made.value.id;
}

const companyOf = async (id: string) =>
  must(await world.admin.from('actors').select('company_id').eq('id', id).single()).company_id;
const companyExists = async (id: string) => (must(await world.admin.from('companies').select('id').eq('id', id)) ?? []).length === 1;

describe('making and naming companies', () => {
  it('the GM creates and renames a company; a blank name is refused with a plain message', async () => {
    const id = await newCompany('  The Reed Cutters ');
    expect(must(await world.admin.from('companies').select('name').eq('id', id).single()).name).toBe('The Reed Cutters');

    expect(await as(world.gm, renameCompany, { campaignId: world.campaignId, companyId: id, name: 'The Reed Guild' })).toMatchObject({ ok: true });
    expect(await as(world.gm, renameCompany, { campaignId: world.campaignId, companyId: id, name: '  ' })).toMatchObject({
      ok: false,
      message: 'Give the company a name.',
    });
    expect(await as(world.gm, createCompany, { campaignId: world.campaignId, name: '' })).toMatchObject({
      ok: false,
      message: 'Give the company a name.',
    });
    expect(must(await world.admin.from('companies').select('name').eq('id', id).single()).name).toBe('The Reed Guild');
  });

  it('every member sees the companies, sorted by name; outsiders see none', async () => {
    await newCompany('An Early Company');
    for (const person of [world.gm, world.playerA]) {
      const names = ((await loadCompanies(asDb(person), world.campaignId)) ?? []).map((c) => c.name);
      expect(names).toContain('The Sluice Gate Company');
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
    expect(await loadCompanies(asDb(world.outsider), world.campaignId)).toEqual([]);
  });
});

describe('putting characters in companies', () => {
  it('the GM puts a waiting or sent-back character in a company, and moves an approved one between companies or out', async () => {
    const reed = await newCompany('The Reed Cutters');
    for (const approval of ['pending', 'rejected'] as const) {
      const character = await fresh(approval);
      expect(await as(world.gm, assignCompany, { character, companyId: reed })).toMatchObject({ ok: true });
      expect(await companyOf(character.id)).toBe(reed);
    }
    const approved = await fresh('approved');
    expect(await as(world.gm, assignCompany, { character: approved, companyId: world.companyId })).toMatchObject({ ok: true });
    expect(await as(world.gm, assignCompany, { character: approved, companyId: reed })).toMatchObject({ ok: true });
    expect(await companyOf(approved.id)).toBe(reed);
    expect(await as(world.gm, assignCompany, { character: approved, companyId: null })).toMatchObject({ ok: true });
    expect(await companyOf(approved.id)).toBeNull();
  });

  it('the GM and the player both see which company a character is in', async () => {
    const character = await fresh('approved');
    must(await world.admin.from('actors').update({ company_id: world.companyId }).eq('id', character.id).select());
    const players = (await loadPlayers(asDb(world.gm), world.campaignId)) ?? [];
    const seen = players.flatMap((p) => p.characters).find((c) => c.id === character.id);
    expect(seen?.companyId).toBe(world.companyId);
    const mine = (await loadMyCharacters(asDb(world.playerA), world.campaignId, world.playerA.id)) ?? [];
    expect(mine.find((c) => c.id === character.id)?.companyId).toBe(world.companyId);
  });

  it("the player's picker row names their active character's company", async () => {
    must(await world.admin.from('actors').update({ company_id: world.companyId }).eq('id', world.wrenId).select());
    must(await world.admin.from('members').update({ active_actor_id: world.wrenId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id).select());
    const campaigns = (await loadMyCampaigns(asDb(world.playerA), world.playerA.id)) ?? [];
    expect(campaigns.find((c) => c.id === world.campaignId)?.companyName).toBe('The Sluice Gate Company');
  });

  it("an archived character keeps its company: not even the GM can move it, even skipping the app's own check", async () => {
    const character = await fresh('approved');
    must(await world.admin.from('actors').update({ company_id: world.companyId }).eq('id', character.id).select());
    const archived = await as(world.gm, archiveCharacter, { character });
    if (!archived.ok) throw new Error(archived.message);
    const gm = (await loadCurrentUser(asDb(world.gm)))!;
    expect(await assignCompany.run(asDb(world.gm), gm, { character: archived.value, companyId: null })).toMatchObject({
      ok: false,
      reason: 'not-allowed',
    });
    expect(await companyOf(character.id)).toBe(world.companyId);
  });
});

describe('deleting companies', () => {
  it('an empty company can be deleted', async () => {
    const id = await newCompany('The Short-Lived Company');
    expect(await as(world.gm, deleteCompany, { campaignId: world.campaignId, companyId: id })).toMatchObject({ ok: true });
    expect(await companyExists(id)).toBe(false);
  });

  it("a company with a character in it (even an archived one) isn't deleted: the app says why, and the database refuses too", async () => {
    const id = await newCompany('The Barrow Watch');
    const character = await fresh('approved');
    must(await world.admin.from('actors').update({ company_id: id }).eq('id', character.id).select());
    must(await world.admin.from('actors').update({ status: 'archived' }).eq('id', character.id).select());

    expect(await as(world.gm, deleteCompany, { campaignId: world.campaignId, companyId: id })).toMatchObject({
      ok: false,
      message: 'Move its characters out of this company first.',
    });
    const direct = await world.gm.db.from('companies').delete().eq('id', id).select();
    expect(direct.data ?? []).toEqual([]);
    expect(await companyExists(id)).toBe(true);
    expect(await companyOf(character.id)).toBe(id);
  });
});
