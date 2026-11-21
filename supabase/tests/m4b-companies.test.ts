// Companies run by the players (M4b step 1h; rulings 33 and 33b, 2026-10-24; docs/04, 05;
// supabase/migrations/20261025130000_m4b_companies.sql). TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { answerInvitation, askToJoin, foundCompany } from '../../src/core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const freeCharacter = async (owner: Person, name: string) =>
  must(
    await world.admin
      .from('actors')
      .insert({ campaign_id: world.campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved' })
      .select('id')
      .single(),
  ).id as string;
const companyOf = async (actorId: string) => must(await world.admin.from('actors').select('company_id').eq('id', actorId).single()).company_id as string | null;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('companies run by the players', () => {
  it('a player founds a company with a co-founder; the co-founder accepts and is a founder; nobody joins two', async () => {
    const reed = await freeCharacter(world.playerA, 'Reed');
    const moss = await freeCharacter(world.playerB, 'Moss');
    const made = await as(world.playerA, foundCompany, { campaignId: world.campaignId, character: { id: reed, ownerUserId: world.playerA.id }, name: 'The Reed Cutters', cofounderIds: [moss] });
    if (!made.ok) throw new Error(made.message);
    expect(await companyOf(reed)).toBe(made.value);
    const [invitation] = must(await world.playerB.db.from('company_invitations').select('id, kind, status').eq('actor_id', moss));
    expect(invitation).toMatchObject({ kind: 'cofounder', status: 'open' });
    // Player A can't answer Player B's invitation.
    expect((await as(world.playerA, answerInvitation, { campaignId: world.campaignId, invitationId: invitation!.id as string, accept: true, mine: true })).ok).toBe(false);
    expect((await as(world.playerB, answerInvitation, { campaignId: world.campaignId, invitationId: invitation!.id as string, accept: true, mine: true })).ok).toBe(true);
    expect(await companyOf(moss)).toBe(made.value);
    expect(must(await world.admin.from('companies').select('founder_ids').eq('id', made.value).single()).founder_ids).toEqual([reed, moss]);
    // Already in a company: can't ask to join another.
    const other = must(await world.admin.from('companies').insert({ campaign_id: world.campaignId, name: 'The Toll Keepers' }).select('id').single()).id as string;
    expect((await as(world.playerB, askToJoin, { campaignId: world.campaignId, companyId: other, character: { id: moss, ownerUserId: world.playerB.id } })).ok).toBe(false);
  });

  it("a player still can't set their character's company directly", async () => {
    const fen = await freeCharacter(world.playerA, 'Fen');
    const other = must(await world.admin.from('companies').insert({ campaign_id: world.campaignId, name: 'The Ferry Folk' }).select('id').single()).id as string;
    await world.playerA.db.from('actors').update({ company_id: other }).eq('id', fen);
    expect(await companyOf(fen)).toBeNull();
  });

  it('with companies switched off, nothing can be founded or joined', async () => {
    const [row] = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId));
    await world.admin.from('campaigns').update({ settings: { ...(row!.settings as object), companies: false } }).eq('id', world.campaignId);
    const late = await freeCharacter(world.playerA, 'Late');
    expect((await as(world.playerA, foundCompany, { campaignId: world.campaignId, character: { id: late, ownerUserId: world.playerA.id }, name: 'Too Late' })).ok).toBe(false);
    await world.admin.from('campaigns').update({ settings: row!.settings }).eq('id', world.campaignId);
  });
});
