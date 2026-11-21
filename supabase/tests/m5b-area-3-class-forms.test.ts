// The character's class form (eq-8, ruled 2026-11-04; supabase/migrations/20261104210000_m5b_area_3_class_forms.sql):
// kept in character_play.form_id (with form_name for the log). TEST project only; invented content.
//   The owner and the GM switch it; another player and an outsider can't; members read an approved character's form,
//   an outsider reads nothing, and a draft's form is its owner's alone (hidden from another player); the id and the
//   name have length caps; the switch is logged as character.setForm.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const formOf = async (person: Person, actorId: string) => must(await person.db.from('character_play').select('actor_id, form_id, form_name').eq('actor_id', actorId));
const switchTo = (person: Person, actorId: string, form: { id: string; name: string } | null) =>
  person.db.from('character_play').upsert({ actor_id: actorId, campaign_id: world.campaignId, form_id: form?.id ?? null, form_name: form?.name ?? null }).select('actor_id');

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('character_play.form_id (class forms, eq-8)', () => {
  it('the owner and the GM switch the form; another player and an outsider cannot', async () => {
    expect((await switchTo(world.playerA, world.wrenId, { id: 'dusk-phase', name: 'Dusk phase' })).error).toBeNull();
    expect((await switchTo(world.gm, world.wrenId, { id: 'dawn-phase', name: 'Dawn phase' })).error).toBeNull();
    expect((await switchTo(world.playerB, world.wrenId, { id: 'dusk-phase', name: 'Dusk phase' })).error).not.toBeNull();
    expect((await switchTo(world.outsider, world.wrenId, { id: 'dusk-phase', name: 'Dusk phase' })).error).not.toBeNull();
    const row = must(await world.admin.from('character_play').select('form_id, form_name').eq('actor_id', world.wrenId).single());
    expect(row).toEqual({ form_id: 'dawn-phase', form_name: 'Dawn phase' });
  });

  it("members read an approved character's form; an outsider reads nothing", async () => {
    expect((await formOf(world.playerB, world.wrenId))[0]?.form_id).toBe('dawn-phase');
    expect(await formOf(world.outsider, world.wrenId)).toHaveLength(0);
  });

  it("a draft's form is its owner's alone: another player can't read it", async () => {
    const draft = must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Moss', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'draft' })
        .select('id')
        .single(),
    ).id as string;
    must(await world.admin.from('character_play').insert({ actor_id: draft, campaign_id: world.campaignId, form_id: 'dusk-phase', form_name: 'Dusk phase' }).select('actor_id'));
    expect((await formOf(world.playerA, draft))[0]?.form_id).toBe('dusk-phase');
    expect(await formOf(world.playerB, draft)).toHaveLength(0);
    expect(await formOf(world.gm, draft)).toHaveLength(0);
  });

  it('the id and the name are capped, and clearing the switch is allowed', async () => {
    expect((await switchTo(world.gm, world.ashId, { id: 'x'.repeat(81), name: 'Long' })).error).not.toBeNull();
    expect((await switchTo(world.gm, world.ashId, { id: 'ok', name: 'y'.repeat(121) })).error).not.toBeNull();
    expect((await switchTo(world.gm, world.ashId, { id: '', name: 'Empty' })).error).not.toBeNull();
    expect((await switchTo(world.gm, world.ashId, null)).error).toBeNull();
  });

  it('the switch is a logged command of the simple log', async () => {
    const row = must(await world.admin.from('logged_commands').select('name, level, gm_only').eq('name', 'character.setForm').single());
    expect(row).toEqual({ name: 'character.setForm', level: 'simple', gm_only: false });
  });
});
