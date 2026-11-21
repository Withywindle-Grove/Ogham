// GM-defined character fields: who can read and change them, keys and types, deleting, and values. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, editCharacter } from '../../src/modules/characters/commands.ts';
import {
  createField,
  deleteField,
  loadFieldDefinitions,
  reorderFields,
  updateField,
} from '../../src/modules/characters/fields.ts';
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

async function gmAdds(label: string, type: 'number' | 'text' | 'longtext' | 'checkbox' | 'list', choices?: string[]) {
  const result = await as(world.gm, createField, { campaignId: world.campaignId, label, type, choices, group: 'Basics' });
  if (!result.ok) throw new Error(result.message);
  return must(await world.admin.from('field_definitions').select('*').eq('id', result.value.id).single());
}

describe('who can see and change fields', () => {
  it('the GM adds a field; players in the campaign can read it, outsiders cannot', async () => {
    const field = await gmAdds('Calling', 'text');
    expect(field).toMatchObject({ key: 'calling', label: 'Calling', type: 'text', field_group: 'Basics', hidden: false });
    expect((await loadFieldDefinitions(asDb(world.playerA), world.campaignId))?.map((f) => f.key)).toContain('calling');
    expect(await loadFieldDefinitions(asDb(world.outsider), world.campaignId)).toEqual([]);
  });

  it("a player can't add, change, hide or delete a field", async () => {
    const field = await gmAdds('Oath', 'text');
    const added = await world.playerA.db
      .from('field_definitions')
      .insert({ campaign_id: world.campaignId, key: 'sneaky', label: 'Sneaky', type: 'text' })
      .select();
    expect(added.error).not.toBeNull();
    for (const patch of [{ label: 'Mud' }, { hidden: true }]) {
      const changed = await world.playerA.db.from('field_definitions').update(patch).eq('id', field.id).select();
      expect(changed.data ?? []).toEqual([]);
    }
    await world.playerA.db.from('field_definitions').delete().eq('id', field.id);
    expect(must(await world.admin.from('field_definitions').select('label, hidden').eq('id', field.id).single())).toEqual({
      label: 'Oath',
      hidden: false,
    });
  });
});

describe('keys and types', () => {
  it('a second field with the same name gets its own key', async () => {
    const first = await gmAdds('Patron', 'text');
    const second = await gmAdds('Patron', 'text');
    expect([first.key, second.key]).toEqual(['patron', 'patron_2']);
  });

  it("two fields can't share a key in one campaign", async () => {
    const field = await gmAdds('Kin', 'text');
    const clash = await world.gm.db
      .from('field_definitions')
      .insert({ campaign_id: world.campaignId, key: field.key, label: 'Kin again', type: 'text' })
      .select();
    expect(clash.error).not.toBeNull();
  });

  it("a field's key and type can't be changed, even by the GM; renaming keeps the key", async () => {
    const field = await gmAdds('Grit', 'number');
    for (const patch of [{ key: 'courage' }, { type: 'text' }]) {
      const attempt = await world.gm.db.from('field_definitions').update(patch).eq('id', field.id).select();
      expect(attempt.error, JSON.stringify(patch)).not.toBeNull();
    }
    const renamed = await as(world.gm, updateField, {
      field: { id: field.id, campaignId: world.campaignId },
      changes: { label: 'Nerve' },
    });
    expect(renamed.ok).toBe(true);
    expect(must(await world.admin.from('field_definitions').select('key, label').eq('id', field.id).single())).toEqual({
      key: 'grit',
      label: 'Nerve',
    });
  });

  it('a list needs at least one choice', async () => {
    const result = await as(world.gm, createField, {
      campaignId: world.campaignId,
      label: 'Empty list',
      type: 'list' as const,
      choices: ['  ', ''],
    });
    expect(result).toMatchObject({ ok: false, reason: 'failed' });
  });

  it('the GM can put the fields in a new order', async () => {
    const a = await gmAdds('Order A', 'text');
    const b = await gmAdds('Order B', 'text');
    expect((await as(world.gm, reorderFields, { campaignId: world.campaignId, ids: [b.id, a.id] })).ok).toBe(true);
    const keys = (await loadFieldDefinitions(asDb(world.gm), world.campaignId))?.map((f) => f.key) ?? [];
    expect(keys.indexOf('order_b')).toBeLessThan(keys.indexOf('order_a'));
  });
});

describe('values and deleting', () => {
  it("a player's field values are saved with their new character, checked against the field types", async () => {
    await gmAdds('Might', 'number');
    await gmAdds('Path', 'list', ['Lantern Warden', 'Reedblade']);
    await gmAdds('Swims', 'checkbox');
    const make = (fields: Record<string, number | string | boolean>) =>
      as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Hollis', fields });

    expect(await make({ might: 2.5 })).toMatchObject({ ok: false, reason: 'failed' });
    expect(await make({ path: 'Mire Witch' })).toMatchObject({ ok: false, reason: 'failed' });
    expect(await make({ no_such_field: 'x' })).toMatchObject({ ok: false, reason: 'failed' });

    const made = await make({ might: -1, path: 'Reedblade', swims: true });
    if (!made.ok) throw new Error(made.message);
    expect(must(await world.admin.from('actors').select('fields').eq('id', made.value.id).single()).fields).toEqual({
      might: -1,
      path: 'Reedblade',
      swims: true,
    });
  });

  it("editing keeps the values of hidden fields and clears the ones left empty", async () => {
    const secret = await gmAdds('Old name', 'text');
    await gmAdds('Motto', 'text');
    const made = await as(world.playerA, createCharacter, {
      campaignId: world.campaignId,
      kind: 'pc' as const,
      name: 'Hollis the Keeper',
      fields: { old_name: 'Hollis Reedborn', motto: 'Light first' },
    });
    if (!made.ok) throw new Error(made.message);
    await as(world.gm, updateField, { field: { id: secret.id, campaignId: world.campaignId }, changes: { hidden: true } });

    const edited = await as(world.playerA, editCharacter, { character: made.value, changes: { fields: { motto: '' } } });
    expect(edited.ok).toBe(true);
    expect(must(await world.admin.from('actors').select('fields').eq('id', made.value.id).single()).fields).toEqual({
      old_name: 'Hollis Reedborn',
    });
  });

  it('the GM can delete a field nobody has filled in, but not one a character uses', async () => {
    const unused = await gmAdds('Typo fieldd', 'text');
    const used = await gmAdds('Hometown', 'text');
    const made = await as(world.playerB, createCharacter, {
      campaignId: world.campaignId,
      kind: 'pc' as const,
      name: 'Ash the Younger',
      fields: { hometown: 'Reedmouth' },
    });
    expect(made.ok).toBe(true);

    expect((await as(world.gm, deleteField, { field: { id: unused.id, campaignId: world.campaignId, key: unused.key } })).ok).toBe(true);
    expect(await as(world.gm, deleteField, { field: { id: used.id, campaignId: world.campaignId, key: used.key } })).toMatchObject({
      ok: false,
    });
    // The database refuses too, not just the app.
    await world.gm.db.from('field_definitions').delete().eq('id', used.id);
    expect((await world.admin.from('field_definitions').select('id').eq('id', used.id)).data).toHaveLength(1);
  });
});
