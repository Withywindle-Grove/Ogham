// @vitest-environment jsdom
// Class forms (eq-8, ruled 2026-11-04, docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md; area 3 order 10):
// a class with forms shows a Form switch on the sheet's Combat block; switching is logged with Undo; gear the new
// form can't use comes off in the same change, carried, with the reason; Undo puts the form and the gear back.
// Clicked through against the stand-in database. Invented names only.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

/** A Phase kin (Dawn phase: anything; Dusk phase: knives only, no armour) wearing an iron coat and holding a knife. */
function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', { attack: { unarmouredAC: 10, style: 'ascending' } });
  entry('class', 'phase-kin', 'Phase kin', {
    hitDie: 'd6',
    armourAllowed: { types: 'any', shields: true },
    weaponsAllowed: { mode: 'any' },
    forms: [
      { id: 'dawn-phase', name: 'Dawn phase', weaponsAllowed: { mode: 'any' }, armourAllowed: { types: 'any', shields: true }, note: 'Any weapon or armour.' },
      { id: 'dusk-phase', name: 'Dusk phase', weaponsAllowed: { mode: 'list', ids: ['eel-knife'] }, armourAllowed: { types: [], shields: false }, note: 'Knives only; no armour or shield.' },
    ],
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 6, hp_max: 6, classes: [{ classRef: 'phase-kin', level: 1, xp: 0 }] });
  world.addMember(campaign, sam, 'player', wren);
  const line = (id: string, name: string, category: string, item_data: Record<string, unknown>, sourceEntryId: string | null = null) =>
    world.tables.inventory_lines.push({
      id, campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name, category, weight_coin: null, slots: null,
      stack: 1, qty: 1, container_line_id: null, equipped: true, how_got: 'found', cost: '', notes: '', item_data,
      source_pack_id: sourceEntryId ? 'pack-fen' : null, source_entry_id: sourceEntryId, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false,
      approval: 'approved', per_units: 1, base_armour_id: null, version: 1, created_at: '2026-10-23T10:00:00Z',
    });
  line('line-coat', 'Iron coat', 'armour', { slot: 'armour', armourType: 'heavy', armour: { base: 16 } });
  line('line-knife', 'Eel knife', 'weapon', { slot: 'hand', hands: 1, weaponTags: ['Melee'] }, 'eel-knife');
  const lineOf = (id: string) => world.tables.inventory_lines.find((l) => l.id === id)!;
  const play = () => world.tables.character_play.find((p) => p.actor_id === wren) ?? null;
  return { gm, sam, campaign, wren, lineOf, play };
}

async function openSheet(who: string) {
  world.signInAs(who);
  forgetCampaignSetting();
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await openFullSheetFromMenu(user);
  return user;
}

const toastUndo = async (text: RegExp) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });

describe('the class form switch (eq-8)', () => {
  // Purpose (the plan's test): switching form takes off gear the new form can't use, in the same logged change; the
  // toast says what came off and why; the knife the form allows stays in hand; one Undo puts the form and the gear back.
  it('switching form takes off gear the new form can’t use; Undo puts it all back', async () => {
    const t = table();
    const user = await openSheet(t.sam);
    const form = within(await screen.findByRole('group', { name: 'Form' }));
    expect(form.getByRole('button', { name: 'Dawn phase ✓' }).getAttribute('aria-pressed')).toBe('true');
    expect(form.getByText('Any weapon or armour.')).toBeTruthy();
    await user.click(form.getByRole('button', { name: 'Dusk phase' }));
    await waitFor(() => expect(t.play()?.form_id).toBe('dusk-phase'));
    expect(t.play()?.form_name).toBe('Dusk phase');
    expect(t.lineOf('line-coat').equipped).toBe(false);
    expect(t.lineOf('line-knife').equipped).toBe(true);
    const events = world.tables.events.filter((e) => e.type === 'character.setForm');
    expect(events).toHaveLength(2);
    expect(new Set(events.map((e) => e.request_id)).size).toBe(1);
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Form' })).getByRole('button', { name: 'Dusk phase ✓' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByText('Knives only; no armour or shield.')).toBeTruthy();
    await user.click(await toastUndo(/Wren is now in Dusk phase\. Iron coat came off and is carried: Phase kin can't use Iron coat in Dusk phase\./));
    await waitFor(() => expect(t.lineOf('line-coat').equipped).toBe(true));
    expect(t.play()?.form_id ?? null).toBeNull();
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Form' })).getByRole('button', { name: 'Dawn phase ✓' }).getAttribute('aria-pressed')).toBe('true'));
  });

  // Purpose: the GM switches any character's form from the sheet (View sheet); a form that takes nothing off says
  // only the switch; tapping the current form says it's already that one, and nothing is written.
  it('the GM switches a form that takes nothing off; the current form says so when tapped', async () => {
    const t = table();
    Object.assign(t.lineOf('line-coat'), { equipped: false });
    world.signInAs(t.gm);
    forgetCampaignSetting();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: "View Wren's sheet" }));
    const form = within(await screen.findByRole('group', { name: 'Form' }));
    await user.click(form.getByRole('button', { name: 'Dawn phase ✓' }));
    expect(await screen.findByText('Wren is already in Dawn phase.')).toBeTruthy();
    expect(t.play()).toBeNull();
    await user.click(form.getByRole('button', { name: 'Dusk phase' }));
    await waitFor(() => expect(t.play()?.form_id).toBe('dusk-phase'));
    expect(await screen.findByText('Wren is now in Dusk phase.')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'character.setForm')).toHaveLength(1);
  });
});
