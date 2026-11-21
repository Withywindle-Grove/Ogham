// A campaign field shows a filled value, and what creation asks (M4b steps 4a and 4b; ruled 2026-10-25; docs/07 sheet layouts `fill`;
// supabase/migrations/20261025190000_m4b_field_fill_links.sql). TEST project only; invented content.
//   "Use this sheet layout" copies each field's fill link onto the campaign's field, where players read it (the
//   sheet layout itself stays the GM's).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { applySheetLayout, loadFieldDefinitions } from '../../src/modules/characters/fields.ts';
import { layoutFields } from '../../src/modules/library/sheetLayout.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('fill links on campaign fields', () => {
  it('"Use this sheet layout" copies the link; a player reads it; the layout stays the GM\'s', async () => {
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Fen Rules' },
        fieldTemplates: [{ id: 'fen-sheet', appliesTo: 'pc', fields: [{ key: 'saveR', label: 'River', type: 'number', fill: 'saves.R' }, { key: 'wit', label: 'Wit', type: 'number' }] }],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    expect(await as(world.gm, applySheetLayout, { campaignId: world.campaignId, fields: layoutFields(read.pack.entries) })).toMatchObject({ ok: true, value: 2 });
    const seen = await loadFieldDefinitions(asDb(world.playerA), world.campaignId);
    // The layout's "saveR" becomes the campaign key "saver" (made from it like any layout key).
    expect(seen?.find((f) => f.key === 'saver')?.fill).toBe('saves.R');
    expect(seen?.find((f) => f.key === 'wit')?.fill).toBeNull();
    // A player can't set one.
    await world.playerA.db.from('field_definitions').update({ fill: 'attack' }).eq('campaign_id', world.campaignId).eq('key', 'wit');
    expect(must(await world.admin.from('field_definitions').select('fill').eq('campaign_id', world.campaignId).eq('key', 'wit').single()).fill).toBeNull();
  });

  it('a required "hp" in the layout marks the campaign’s HP as asked (no "hp" field is made); other required fields are copied', async () => {
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Fen Sheet' },
        fieldTemplates: [{ id: 'fen-sheet-2', appliesTo: 'pc', fields: [{ key: 'hp', label: 'HP', type: 'number', required: true }, { key: 'Oath', label: 'Oath', type: 'text', required: true }] }],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    expect(await as(world.gm, applySheetLayout, { campaignId: world.campaignId, fields: layoutFields(read.pack.entries) })).toMatchObject({ ok: true, value: 1 });
    const fields = (await loadFieldDefinitions(asDb(world.playerA), world.campaignId)) ?? [];
    expect(fields.some((f) => f.key === 'hp')).toBe(false);
    expect(fields.find((f) => f.key === 'oath')?.required).toBe(true);
    const [campaign] = must(await world.playerA.db.from('campaigns').select('settings').eq('id', world.campaignId));
    expect(campaign!.settings).toMatchObject({ hpRequired: true });
  });
});
