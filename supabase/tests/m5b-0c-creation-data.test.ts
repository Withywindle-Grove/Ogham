// M5b step 0c, slice 1: creation data (supabase/migrations/20261102200000_m5b_0c_creation_data.sql). TEST project
// only; invented content.
//   Purpose:
//   1. Alignment visibility (cr-22): a player reads another player's alignment only when the setting says "all"
//      (the default); with "owner", only its owner and the GM read it, and the value never sits on actors.fields.
//      The owner and the GM read it either way; a draft's alignment stays hidden from the GM like the draft itself.
//   2. The spell book (cr-13): the owner writes it while the character waits, not once approved (unless First spells
//      is left to finish); the GM always; each spell once; another player never.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadCharacterSheet } from '../../src/core/characterSheet.ts';
import { loadPlayers } from '../../src/core/gmCampaign.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, editCharacter } from '../../src/modules/characters/commands.ts';
import { setSpellBook } from '../../src/modules/characters/spellBook.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let original: unknown;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}
const settle = async (settings: Record<string, unknown>) =>
  must(await world.admin.from('campaigns').update({ settings: { ...(original as object), ...settings } }).eq('id', world.campaignId).select('id'));

/** An invented rules set attached to the campaign, saying who sees alignments; null detaches it. */
let packId: string | null = null;
async function setVisibility(visibility: 'owner' | 'all' | null) {
  if (packId) {
    await world.admin.from('campaign_packs').delete().eq('campaign_id', world.campaignId).eq('pack_id', packId);
    await world.admin.from('packs').delete().eq('id', packId);
    packId = null;
  }
  if (visibility === null) return;
  const pack = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen sample', version: '0.1', kind: 'setting' }).select('id').single());
  packId = pack.id as string;
  must(await world.admin.from('library_entries').insert({ pack_id: packId, kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { alignmentVisibility: visibility } }).select('id'));
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, created_by: world.gm.id }).select('id'));
}

const alignmentFromFields = async (person: Person, actorId: string) => {
  const row = must(await person.db.from('actors').select('fields').eq('id', actorId).maybeSingle());
  const fields = (row?.fields ?? {}) as Record<string, unknown>;
  return fields.alignment ?? null;
};
const alignmentRows = async (person: Person, actorId: string) => must(await person.db.from('character_alignments').select('alignment').eq('actor_id', actorId));
const sheetAlignment = async (person: Person, actorId: string) => ((await loadCharacterSheet(asDb(person), actorId))?.fields as Record<string, unknown> | null)?.alignment ?? null;

beforeAll(async () => {
  world = await buildWorld();
  original = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
  must(
    await world.admin
      .from('field_definitions')
      .insert({ campaign_id: world.campaignId, applies_to: 'pc', key: 'alignment', label: 'Leaning', type: 'list', choices: ['Lantern', 'Reed', 'Mire'], sort_order: 40 })
      .select('id'),
  );
}, 300_000);
afterAll(async () => {
  await setVisibility(null);
  await settle({});
  await tearDownWorld(world);
});

describe('1. alignment visibility', () => {
  it("a player reads another's alignment only when the setting says all; the owner and the GM always; the field itself never carries it", async () => {
    await settle({ characterApproval: true, startLevel: 'one' });
    const made = await ok(as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Hollis', level: 1, fields: { alignment: 'Lantern' } }));
    must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', made.id).select('id'));

    // The value lives in its own table, never on actors.fields, for anyone.
    expect(((must(await world.admin.from('actors').select('fields').eq('id', made.id).single()).fields ?? {}) as Record<string, unknown>).alignment).toBeUndefined();
    expect(must(await world.admin.from('character_alignments').select('alignment, owner_user_id').eq('actor_id', made.id))).toEqual([{ alignment: 'Lantern', owner_user_id: world.playerA.id }]);

    // No setting says: everyone reads it (the default is all).
    await setVisibility(null);
    expect(await alignmentRows(world.playerB, made.id)).toEqual([{ alignment: 'Lantern' }]);
    expect(await sheetAlignment(world.playerB, made.id)).toBe('Lantern');

    // The setting says owner: the owner and the GM read it; another player doesn't, in the table nor on the sheet.
    await setVisibility('owner');
    expect(await alignmentRows(world.playerA, made.id)).toEqual([{ alignment: 'Lantern' }]);
    expect(await sheetAlignment(world.playerA, made.id)).toBe('Lantern');
    expect(await alignmentRows(world.gm, made.id)).toEqual([{ alignment: 'Lantern' }]);
    expect(await sheetAlignment(world.gm, made.id)).toBe('Lantern');
    expect(await alignmentRows(world.playerB, made.id)).toEqual([]);
    expect(await sheetAlignment(world.playerB, made.id)).toBeNull();
    const players = await loadPlayers(asDb(world.gm), world.campaignId);
    expect((players?.flatMap((p) => p.characters).find((c) => c.id === made.id)?.fields as Record<string, unknown>).alignment).toBe('Lantern');

    // The setting says all: back to everyone.
    await setVisibility('all');
    expect(await alignmentRows(world.playerB, made.id)).toEqual([{ alignment: 'Lantern' }]);

    // An edit changes the row (and is logged as the owner's line); clearing it takes the row away.
    const ref = { id: made.id, campaignId: world.campaignId, ownerType: 'user' as const, ownerUserId: world.playerA.id, approval: 'approved' as const, archived: false };
    expect(await as(world.playerA, editCharacter, { character: ref, changes: { fields: { alignment: 'Reed' } } })).toMatchObject({ ok: true });
    expect(await alignmentRows(world.playerA, made.id)).toEqual([{ alignment: 'Reed' }]);
    expect(await alignmentFromFields(world.playerA, made.id)).toBeNull();
    const lines = must(await world.admin.from('events').select('audience, owner_user_id, after').eq('campaign_id', world.campaignId).eq('target_table', 'character_alignments').eq('target_id', made.id));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.every((l) => l.audience === 'owner' && l.owner_user_id === world.playerA.id)).toBe(true);

    await setVisibility(null);
    await world.admin.from('actors').update({ status: 'archived' }).eq('id', made.id);
  });

  it("a draft's alignment stays hidden from the GM, like the draft; the owner reads it", async () => {
    const draft = await ok(as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Quill', level: 1, fields: { alignment: 'Mire' }, draft: true }));
    expect(await alignmentRows(world.playerA, draft.id)).toEqual([{ alignment: 'Mire' }]);
    expect(await alignmentRows(world.gm, draft.id)).toEqual([]);
    expect(await alignmentRows(world.playerB, draft.id)).toEqual([]);
    await world.admin.from('actors').delete().eq('id', draft.id);
  });
});

describe('2. the spell book', () => {
  it('the owner writes it while the character waits, the GM always; approved, only with First spells left to finish; each spell once; never another player', async () => {
    await settle({ characterApproval: true, startLevel: 'one' });
    const made = await ok(as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Wren the Witch', level: 1 }));
    const bookOf = async () => must(await world.admin.from('actors').select('spell_book').eq('id', made.id).single()).spell_book;
    const ref = (approval: 'pending' | 'approved', toFinish?: string[]) => ({ ...made, approval, ...(toFinish ? { toFinish } : {}) });

    expect(await bookOf()).toEqual([]);
    expect(await as(world.playerA, setSpellBook, { character: ref('pending'), spellIds: ['glimmer', 'reed-whisper', ' glimmer '] })).toMatchObject({ ok: true });
    expect(await bookOf()).toEqual(['glimmer', 'reed-whisper']);
    // Well formed, whatever a device sends: strings, each once, short ids.
    expect((await world.playerA.db.from('actors').update({ spell_book: ['glimmer', 'glimmer'] }).eq('id', made.id).select('id')).error).not.toBeNull();
    const badRow = await world.playerA.db.from('actors').update({ spell_book: [{ id: 'glimmer' }] }).eq('id', made.id).select('id');
    expect(badRow.error).not.toBeNull();
    expect(await as(world.playerA, setSpellBook, { character: ref('pending'), spellIds: ['x'.repeat(81)] })).toMatchObject({ ok: false });
    expect(await bookOf()).toEqual(['glimmer', 'reed-whisper']);
    // Another player: no.
    expect(await as(world.playerB, setSpellBook, { character: ref('pending'), spellIds: ['mire-grip'] })).toMatchObject({ ok: false });

    // Approved: the owner no longer writes it (the app's rule and the database's agree)…
    must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', made.id).select('id'));
    expect(await as(world.playerA, setSpellBook, { character: ref('approved'), spellIds: ['mire-grip'] })).toMatchObject({ ok: false });
    expect((await world.playerA.db.from('actors').update({ spell_book: ['mire-grip'] }).eq('id', made.id).select('id')).error).not.toBeNull();
    expect(await bookOf()).toEqual(['glimmer', 'reed-whisper']);
    // … unless First spells was left for later (the creation record's To finish list).
    must(await world.admin.from('actors').update({ creation: { toFinish: ['spells'] } }).eq('id', made.id).select('id'));
    expect(await as(world.playerA, setSpellBook, { character: ref('approved', ['spells']), spellIds: ['glimmer', 'mire-grip'] })).toMatchObject({ ok: true });
    expect(await bookOf()).toEqual(['glimmer', 'mire-grip']);
    // The GM always.
    must(await world.admin.from('actors').update({ creation: {} }).eq('id', made.id).select('id'));
    expect(await as(world.gm, setSpellBook, { character: ref('approved'), spellIds: ['damp-wick'] })).toMatchObject({ ok: true });
    expect(await bookOf()).toEqual(['damp-wick']);
    // Logged under its own name.
    const logged = must(await world.admin.from('events').select('type').eq('campaign_id', world.campaignId).eq('target_id', made.id).eq('type', 'creation.spellBook.set'));
    expect(logged.length).toBeGreaterThanOrEqual(3);

    await world.admin.from('actors').update({ status: 'archived' }).eq('id', made.id);
  });
});
