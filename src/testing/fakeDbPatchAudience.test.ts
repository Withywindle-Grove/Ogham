// The fake database reads patches as the access rule does (look-back review of #437, approved by Francis 2026-11-10;
// hard rule 5; supabase/migrations/20261111110000_fix_hidden_data_cache_and_patches.sql). Invented content only.
import { describe, expect, it } from 'vitest';
import type { Json } from '../core/database.types.ts';
import { createFakeDb } from './fakeDb.ts';

describe('the fake database and patches players may not read', () => {
  // Purpose: a player's device never receives a patch naming an item the player can't read (here, an item no
  // attached pack has), nor one that changes a rules set's monsters or a field the item it names keeps GM-only; a
  // patch on an item they read, on an open field, still arrives; the GM receives all of them.
  it('a player reads only the patches on items and fields they may read; the GM reads all', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mire zine', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-10T12:00:00Z', extra_meta: {} });
    const entry = (kind: string, id: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${kind}-${id}`, pack_id: 'pack-mire', kind, pack_entry_id: id, name: id, data: { id, ...data } });
    entry('item', 'bog-lantern', { name: 'Bog lantern', category: 'gear', cost: 3 });
    // An item with a GM-only field: its readable part here, the hidden part kept apart (as the database splits it).
    entry('item', 'eel-lamp', { name: 'Eel lamp', category: 'gear', cost: 5 });
    world.tables.library_entry_secrets.push({ id: 'entry-item-eel-lamp', pack_id: 'pack-mire', data: { gmOnly: ['curse'], curse: 'Smells of eels' } });
    entry('rulesSet', 'mire-rules', { name: 'Mire rules', healing: { perDay: 1 } });
    const patch = (id: string, match: Record<string, unknown>, change: Record<string, unknown>) => entry('patch', id, { byOption: 'mire-depth=deep', match, change });
    patch('open-lantern', { kind: 'item', ids: ['bog-lantern'] }, { cost: { delta: 1 } });
    patch('ghost-blade', { kind: 'item', ids: ['ghost-blade'] }, { damage: { delta: 2 } });
    patch('lurker-hd', { kind: 'rulesSet' }, { 'monsters.bog-lurker.hd': { delta: 1 } });
    patch('eel-curse', { kind: 'item', ids: ['eel-lamp'] }, { curse: 'Smells of mud' });
    patch('gear-curse', { kind: 'item', category: 'gear' }, { curse: 'Smells of reeds' });
    patch('gear-cost', { kind: 'item', category: 'gear' }, { cost: { delta: -1 } });
    world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mire zine', option_choices: {}, overrides: {}, priority: 1 });

    const patchesSeen = async () =>
      ((await world.db.from('library_entries').select('kind, pack_entry_id')).data ?? [])
        .filter((e) => (e as { kind: string }).kind === 'patch')
        .map((e) => (e as { pack_entry_id: string }).pack_entry_id)
        .sort();
    world.signInAs(me);
    expect(await patchesSeen()).toEqual(['gear-cost', 'open-lantern']);
    world.signInAs(gm);
    expect(await patchesSeen()).toEqual(['eel-curse', 'gear-cost', 'gear-curse', 'ghost-blade', 'lurker-hd', 'open-lantern']);
  });

  // Purpose (local review of #629): like the database, an edit that turns a patch players may not read into one they
  // may is logged for the GM only (its `before` names the item they can't read); the next edit is everyone's.
  it('an edit from a GM-only patch to an open one is the GM’s line', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'Homebrew', version: '0.1', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-11-10T12:00:00Z', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'Homebrew', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(gm);
    const data = (match: { [key: string]: Json }, delta: number) => ({ byOption: 'mire-depth=deep', match, change: { cost: { delta } } });
    const made = await world.db.from('library_entries').insert({ pack_id: 'pack-home', kind: 'patch', pack_entry_id: 'patch-ghost', name: 'patch-ghost', data: data({ kind: 'item', ids: ['ghost-blade'] }, 1) }).select('id').single();
    const id = (made.data as { id: string }).id;
    await world.db.from('library_entries').update({ data: data({ kind: 'item', category: 'gear' }, 1) }).eq('id', id);
    await world.db.from('library_entries').update({ data: data({ kind: 'item', category: 'gear' }, 2) }).eq('id', id);
    const lines = world.tables.events.filter((e) => e.target_table === 'library_entries' && e.target_id === id).sort((a, b) => Number(a.seq) - Number(b.seq));
    expect(lines.map((e) => e.audience)).toEqual(['gm', 'gm', 'all']);
  });
});
