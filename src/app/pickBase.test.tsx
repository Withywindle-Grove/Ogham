// @vitest-environment jsdom
// bq3-8 (ruled 2026-11-04, docs/design/rulings/m5b-builder-questions-3-2026-11-04.md): "chosen" magic armour still
// goes on while some base fits the class; the GM then gets "Pick the base for <armour> (worn by <name>)" in Waiting
// for you. Picking keeps the base on the item (logged, Undo); a base the wearer's class can't wear takes the armour
// off, carried, with words saying why, in the same logged change. Clicked through against the stand-in database.
// Invented names only.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { waitingForBase } from './pickBase.ts';

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

/** A Fen warden (light armour only) wearing Glimmer mail, whose base is a reed coat (light) or an iron shell (heavy). */
function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', { attack: { unarmouredAC: 10, style: 'ascending' } });
  entry('class', 'fen-warden', 'Fen warden', { armourAllowed: { types: ['light'] } });
  entry('item', 'reed-coat', 'Reed coat', { slot: 'armour', armourType: 'light', armour: { base: 13 } });
  entry('item', 'iron-shell', 'Iron shell', { slot: 'armour', armourType: 'heavy', armour: { base: 16 } });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 6, hp_max: 6, classes: [{ classRef: 'fen-warden', level: 1, xp: 0 }] });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.inventory_lines.push({
    id: 'line-glimmer', campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name: 'Glimmer mail', category: 'armour', weight_coin: null, slots: null,
    stack: 1, qty: 1, container_line_id: null, equipped: true, how_got: 'found', cost: '', notes: '',
    item_data: { slot: 'armour', armourType: 'chosen', armour: { magicBonus: 1, baseArmour: { choose: ['reed-coat', 'iron-shell'] } } },
    source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false,
    approval: 'approved', per_units: 1, base_armour_id: null, version: 1, created_at: '2026-10-23T10:00:00Z',
  });
  const glimmer = () => world.tables.inventory_lines.find((l) => l.id === 'line-glimmer')!;
  return { gm, sam, campaign, wren, glimmer };
}

async function open(who: string, gm: boolean) {
  world.signInAs(who);
  forgetCampaignSetting();
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  if (gm) await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  return user;
}

const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
const card = async () => (await screen.findByText('Pick the base for Glimmer mail (worn by Wren)')).closest('li') as HTMLElement;

describe("the GM's Pick the base (bq3-8)", () => {
  // Purpose: worn chosen-type armour with no base picked waits for the GM as "Pick the base for <armour> (worn by
  // <name>)", listing its bases; a base the class can wear is kept on the item, the armour stays on, the card goes,
  // and Undo brings the card back.
  it('lists the bases; a base that fits is kept and the armour stays on; Undo puts the card back', async () => {
    const t = table();
    const user = await open(t.gm, true);
    const waiting = within(await screen.findByRole('region', { name: 'Waiting for you' }));
    const pick = within(await card());
    expect(waiting.queryByText('Nothing is waiting.')).toBeNull();
    expect(pick.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Reed coat', 'Iron shell']);
    await user.click(pick.getByRole('radio', { name: 'Reed coat' }));
    await waitFor(() => expect(t.glimmer().base_armour_id).toBe('reed-coat'));
    expect(t.glimmer().equipped).toBe(true);
    await waitFor(() => expect(screen.queryByText('Pick the base for Glimmer mail (worn by Wren)')).toBeNull());
    expect(world.tables.events.filter((e) => e.type === 'inventory.setBaseArmour')).toHaveLength(1);
    await user.click(await toastUndo('Glimmer mail: Reed coat'));
    await waitFor(() => expect(t.glimmer().base_armour_id).toBeNull());
    expect(await card()).toBeTruthy();
  });

  // Purpose: a base the wearer's class can't wear takes the armour off (carried) in the same logged change; the
  // toast says why; one Undo puts it back on with no base.
  it("a base the class can't wear takes the armour off, saying why; one Undo puts both back", async () => {
    const t = table();
    const user = await open(t.gm, true);
    await user.click(within(await card()).getByRole('radio', { name: 'Iron shell' }));
    await waitFor(() => expect(t.glimmer().base_armour_id).toBe('iron-shell'));
    expect(t.glimmer().equipped).toBe(false);
    expect(t.glimmer().container_line_id).toBeNull();
    const events = world.tables.events.filter((e) => e.type === 'inventory.setBaseArmour');
    expect(events).toHaveLength(1);
    await user.click(await toastUndo("Glimmer mail came off and is carried: Fen warden can't wear Iron shell."));
    await waitFor(() => expect(t.glimmer().equipped).toBe(true));
    expect(t.glimmer().base_armour_id).toBeNull();
  });

  // Purpose: nothing waits once the base is picked, or for armour that isn't worn: the section says nothing waits.
  it('asks nothing for armour with its base picked or not worn', async () => {
    const t = table();
    Object.assign(t.glimmer(), { equipped: false });
    await open(t.gm, true);
    expect(screen.queryByRole('region', { name: 'Waiting for you' })).toBeNull();
    expect(screen.queryByText(/Pick the base for/)).toBeNull();
  });
});

describe("the player's Choose base armour (bq3-8)", () => {
  // Purpose: the player's own pick on AC follows the same rule: a base their class can't wear takes the armour off,
  // carried, and the toast says why.
  it("a base the class can't wear takes the armour off, with the reason", async () => {
    const t = table();
    const user = await open(t.sam, false);
    await user.click(await screen.findByRole('button', { name: 'Armour class: choose the base armour for Glimmer mail' }));
    const choose = within(await screen.findByRole('dialog', { name: 'Base armour for Glimmer mail' }));
    await user.click(choose.getByRole('radio', { name: 'Iron shell' }));
    await waitFor(() => expect(t.glimmer().equipped).toBe(false));
    expect(t.glimmer().base_armour_id).toBe('iron-shell');
    expect(await screen.findByText("Glimmer mail came off and is carried: Fen warden can't wear Iron shell.")).toBeTruthy();
  });
});

describe('what waits for a base', () => {
  const line = (extra: Partial<InventoryLine>): InventoryLine =>
    ({
      id: 'line-1', campaignId: 'c', actorId: 'actor-wren', locationId: null, equipped: true, approval: 'approved', baseArmourId: null,
      details: { armour: { baseArmour: { choose: ['reed-coat'] } } }, ...extra,
    }) as InventoryLine;
  // Purpose: only worn, approved armour on a character that offers bases and has none picked waits for the GM.
  it('worn armour offering bases with none picked; not when picked, not worn, in the stash, or offering none', () => {
    expect(waitingForBase(line({}))).toBe(true);
    expect(waitingForBase(line({ baseArmourId: 'reed-coat' }))).toBe(false);
    expect(waitingForBase(line({ equipped: false }))).toBe(false);
    expect(waitingForBase(line({ actorId: null, locationId: 'stash' }))).toBe(false);
    expect(waitingForBase(line({ approval: 'pending' }))).toBe(false);
    expect(waitingForBase(line({ details: { armour: { base: 12 } } }))).toBe(false);
  });
});
