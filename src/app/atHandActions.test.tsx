// @vitest-environment jsdom
// At hand's weapon actions (ruling m5b-at-hand-actions-2026-11-08, ah-1 … ah-4; mockup players/06). Invented rules and
// names only (hard rule 2). Purposes:
//   A pinned weapon not in hand shows Wield, and no Attack; Wield puts it in hand (inventory.equip, logged) with an Undo
//   toast, and the row then shows Attack; Undo puts it back.
//   A weapon with two or more modes has the pack's mode button beside its action, and its line says the mode in use; a
//   weapon with one mode has no button.
//   The mode button opens the mode sheet: the modes as pick rows, the one in use Picked; picking one is stored on the
//   line (item.setMode, logged, Undo; Design on #569: a shared game fact) and changes the row's line; a mode with none in
//   the pack explains instead of being chosen.
//   Attack opens the Attack sheet (a sheet, not a roll): the parts and the rules that bear, and no line about the fight
//   rules (tfw-3, 2026-11-19); with a mode that draws a stack, Fire one spends one through item.use, logged, Undo in the
//   toast.
//   A fresh bow (nothing stored) fires the plain arrows it carries; with no arrows at all it reads "No reed arrows in the
//   pack" (Design on #569, round 3).
//   When a stack is spent the mode stays disengaged, even with another kind in the pack (a fresh bow's default is stored
//   in the same request): the toast and the line say so, Attack stays a button whose tap says why and opens the mode
//   sheet; one Undo brings back the stack (and the fresh bow).
//   The Attack sheet names what the attack inflicts (applies.conditionId) with the condition's brief effect, and says
//   nothing when there's none (Design on #569).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { watchMarks } from '../testing/markScan.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let wren = '';
let marks: ReturnType<typeof watchMarks> | null = null;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  // No middle dot, angle quote or plain ▲ in the rows, the sheets or the toasts.
  marks = watchMarks('section.pack, [role="dialog"], .toast');
});

afterEach(() => {
  marks?.stop();
  cleanup();
  vi.restoreAllMocks();
});

const REED_BOW = {
  slot: 'hand',
  hands: 2,
  weapon: {
    damage: '1d6',
    qualities: ['Missile'],
    modes: {
      button: 'quiver',
      list: [
        { id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
        { id: 'bone', name: 'Bone-tipped arrows', draws: { itemId: 'bone-arrows' }, note: 'counts as bone' },
        { id: 'ember', name: 'Ember arrows', draws: { itemId: 'ember-arrows' }, damage: '1d8' },
      ],
    },
  },
};

/** Wren with the given lines (each pinned unless it says otherwise), signed in as Wren's player; the Fen rules' sting. */
function fenWorld(lines: { name: string; extra?: Record<string, unknown> }[]) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({ id: 'entry-fen-sting', pack_id: 'pack-fen', kind: 'condition', pack_entry_id: 'fen-sting', name: 'Fen sting', data: { id: 'fen-sting', name: 'Fen sting', notes: 'Slow for a turn' } });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
  for (const [i, l] of lines.entries()) {
    world.tables.inventory_lines.push({
      id: `line-${l.name.toLowerCase().replace(/\W+/g, '-')}`,
      campaign_id: campaign,
      actor_id: wren,
      location_id: null,
      library_entry_id: null,
      name: l.name,
      category: 'weapon',
      weight_coin: 10,
      slots: null,
      stack: 1,
      qty: 1,
      container_line_id: null,
      equipped: false,
      how_got: 'found',
      cost: '',
      notes: '',
      item_data: {},
      source_pack_id: 'pack-fen',
      source_entry_id: null,
      charges_left: null,
      charges_hidden: false,
      charges_used: 0,
      spent_shown: false,
      last_roll: null,
      pinned: true,
      at_hand_hidden: false,
      approval: 'approved',
      per_units: 1,
      version: 1,
      created_at: `2026-10-23T10:00:0${i}Z`,
      ...l.extra,
    });
  }
  world.signInAs(sam);
}

const arrows = (name: string, id: string, qty: number) => ({ name, extra: { category: 'ammunition', pinned: false, qty, stack: 20, weight_coin: 1, source_entry_id: id } });
const bow = (extra: Record<string, unknown> = {}) => ({ name: 'Reed bow', extra: { equipped: true, item_data: REED_BOW, ...extra } });

async function openPack() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
  await screen.findByRole('heading', { name: 'Wren’s pack' });
  return user;
}

const atHand = () => within(screen.getByRole('region', { name: 'At hand' }));
const row = (name: RegExp) => atHand().getByRole('button', { name });
const line = (name: string) => world.tables.inventory_lines.find((l) => l.name === name);

describe('At hand weapon actions (ah-1 … ah-4)', () => {
  it('Wield puts a pinned weapon in hand, logged, with Undo; the row then shows Attack', async () => {
    fenWorld([{ name: 'Hand axe', extra: { item_data: { slot: 'hand', weapon: { damage: '1d6' } } } }]);
    const user = await openPack();
    expect(atHand().queryByRole('button', { name: 'Attack with Hand axe' })).toBeNull();
    await user.click(atHand().getByRole('button', { name: 'Wield Hand axe' }));
    await waitFor(() => expect(line('Hand axe')).toMatchObject({ equipped: true }));
    expect(world.tables.events.some((e) => e.type === 'inventory.equip')).toBe(true);
    expect(await screen.findByText('Hand axe in hand')).toBeTruthy();
    expect(await atHand().findByRole('button', { name: 'Attack with Hand axe' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Hand axe')).toMatchObject({ equipped: false }));
    expect(await atHand().findByRole('button', { name: 'Wield Hand axe' })).toBeTruthy();
    expect([...marks!.found]).toEqual([]);
  });

  it('a weapon with modes carries the mode button and says the mode in use; one mode, no button', async () => {
    fenWorld([
      bow(),
      arrows('Reed arrows', 'reed-arrows', 18),
      { name: 'Fen lance', extra: { equipped: true, item_data: { slot: 'hand', weapon: { damage: '1d8', modes: { button: 'stance', list: [{ id: 'normal', name: 'Normal' }] } } } } },
    ]);
    await openPack();
    // The state first, then the figures, then the mode (Design on #569); no weight on an At hand row.
    expect(row(/^Reed bow/).textContent).toBe('Reed bow pinned, In hand, 1d6, Quiver: Reed arrows ×18');
    expect(atHand().getByRole('button', { name: 'Quiver of Reed bow' })).toBeTruthy();
    expect(atHand().queryByRole('button', { name: /^Stance/ })).toBeNull();
    expect(row(/^Fen lance/).textContent).not.toContain('Stance');
  });

  it('the mode sheet lists the kinds carried as pick rows; a pick changes the line and is remembered', async () => {
    // tfh-6 (2026-11-19; page M2, frame M2o): only the kinds in the pack, "18 in the pack" under each; no line over the
    // rows ("What the Reed bow fires…") and none under them ("Out of a kind…"); the kind not carried is not listed.
    fenWorld([bow(), arrows('Reed arrows', 'reed-arrows', 18), arrows('Bone-tipped arrows', 'bone-arrows', 4)]);
    const user = await openPack();
    await user.click(atHand().getByRole('button', { name: 'Quiver of Reed bow' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Quiver' }));
    expect(sheet.queryByText(/Each shot uses one|Out of a kind/)).toBeNull();
    expect(sheet.getByRole('checkbox', { name: 'Pick Reed arrows' }).getAttribute('aria-checked')).toBe('true');
    expect(sheet.getByText('Reed arrows').closest('.pick-row')!.textContent).toContain('18 in the pack');
    expect(sheet.queryByText('Ember arrows')).toBeNull();
    expect(sheet.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Pick Reed arrows', 'Pick Bone-tipped arrows']);
    await user.click(sheet.getByRole('checkbox', { name: 'Pick Bone-tipped arrows' }));
    await waitFor(() => expect(line('Reed bow')).toMatchObject({ mode_id: 'bone' }));
    expect(world.tables.events.some((e) => e.type === 'item.setMode')).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Quiver' })).toBeNull();
    expect(await screen.findByText('Reed bow: Bone-tipped arrows')).toBeTruthy();
    await waitFor(() => expect(row(/^Reed bow/).textContent).toContain('Quiver: Bone-tipped arrows ×4'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Reed bow')).toMatchObject({ mode_id: null }));
  });

  it('the Quiver with no kind carried says so in one line and lists nothing', async () => {
    // tfh-6 (page M2, frame M2o): "Nothing to fire in your pack.", and the sheet closes with ✕ alone.
    fenWorld([bow()]);
    const user = await openPack();
    await user.click(atHand().getByRole('button', { name: 'Quiver of Reed bow' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Quiver' }));
    expect(sheet.getByText('Nothing to fire in your pack.')).toBeTruthy();
    expect(sheet.queryAllByRole('checkbox')).toHaveLength(0);
    expect(sheet.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
  });

  it('the Quiver’s rows are plain: the picked row has no wash or edge, only its button says Picked ✓; a Grip’s rows are unchanged', async () => {
    // Page M2, frame M2o (approved 2026-11-19; Francis on #1069's ⚑ 2, "go with approved"): a Quiver's rows are the pick
    // row's plain variant, the kind in use told by its button alone; a Grip draws no stack and keeps the boxed pick rows,
    // the picked one washed with its edge. The look itself (no box, the dotted rule) is measured by the layout spec.
    const GRIP = { slot: 'hand', weapon: { damage: '1d8', modes: { button: 'grip', list: [{ id: 'one', name: 'One hand' }, { id: 'two', name: 'Two hands', damage: '1d10' }] } } };
    fenWorld([bow(), arrows('Reed arrows', 'reed-arrows', 18), arrows('Bone-tipped arrows', 'bone-arrows', 4), { name: 'Fen lance', extra: { equipped: true, item_data: GRIP } }]);
    const user = await openPack();
    await user.click(atHand().getByRole('button', { name: 'Quiver of Reed bow' }));
    const quiver = within(await screen.findByRole('dialog', { name: 'Quiver' }));
    const reed = quiver.getByRole('checkbox', { name: 'Pick Reed arrows' });
    expect(reed.textContent).toBe('Picked ✓');
    const quiverRows = quiver.getAllByRole('checkbox').map((c) => c.closest('.pick-row')!);
    expect(quiverRows.map((r) => r.classList.contains('pick-row--plain'))).toEqual([true, true]);
    expect(reed.closest('.pick-row')!.classList.contains('pick-row--picked')).toBe(true);
    await user.click(quiver.getByRole('button', { name: 'Close' }));
    await user.click(atHand().getByRole('button', { name: 'Grip of Fen lance' }));
    const grip = within(await screen.findByRole('dialog', { name: 'Grip' }));
    const gripRows = grip.getAllByRole('checkbox').map((c) => c.closest('.pick-row')!);
    expect(gripRows).toHaveLength(2);
    expect(gripRows.some((r) => r.classList.contains('pick-row--plain'))).toBe(false);
    expect(grip.getByRole('checkbox', { name: 'Pick One hand' }).closest('.pick-row')!.classList.contains('pick-row--picked')).toBe(true);
  });

  it('Attack opens the Attack sheet; Fire one spends one through item.use, logged, Undo in the toast', async () => {
    fenWorld([bow(), arrows('Reed arrows', 'reed-arrows', 18)]);
    const user = await openPack();
    await user.click(atHand().getByRole('button', { name: 'Attack with Reed bow' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Reed bow' }));
    // tfw-3: the sheet ends with its rows; no line about the fight rules.
    expect(sheet.queryByText(/fight rules/)).toBeNull();
    // One comma list, headed Qualities (Design on #569).
    expect(sheet.getByText(/Qualities:/).closest('p')!.textContent).toBe('Qualities: Missile, two-handed');
    // The bow inflicts nothing: no Inflicts line.
    expect(sheet.queryByText(/Inflicts:/)).toBeNull();
    // The damage card's first row: the weapon and its die (as-1: the parts with their own figures).
    expect([...document.querySelectorAll('[role="dialog"] .breakdown__row')].map((r) => r.textContent)).toContain('Reed bow1d6');
    await user.click(sheet.getByRole('button', { name: 'Fire one, 17 left after' }));
    await waitFor(() => expect(line('Reed arrows')).toMatchObject({ qty: 17 }));
    expect(world.tables.events.some((e) => e.type === 'item.use')).toBe(true);
    expect(await screen.findByText('Fired Reed arrows, 17 left')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Reed arrows')).toMatchObject({ qty: 18 }));
    expect([...marks!.found]).toEqual([]);
  });

  it('a spent stack disengages the mode: the toast and the line say so, Attack explains and opens the quiver; Undo brings it back', async () => {
    fenWorld([bow({ mode_id: 'bone' }), arrows('Reed arrows', 'reed-arrows', 18), arrows('Bone-tipped arrows', 'bone-arrows', 1)]);
    const user = await openPack();
    await user.click(atHand().getByRole('button', { name: 'Attack with Reed bow' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Reed bow' })).getByRole('button', { name: 'Fire one, 0 left after' }));
    await waitFor(() => expect(line('Bone-tipped arrows')).toBeUndefined());
    // The chosen mode stays stored: spent, not cleared (Design on #569, round 3).
    expect(line('Reed bow')).toMatchObject({ mode_id: 'bone' });
    const uses = world.tables.events.filter((e) => e.type === 'item.use');
    expect(new Set(uses.map((e) => e.request_id)).size).toBe(1);
    expect(await screen.findByText('Fired the last Bone-tipped arrows. Quiver: nothing chosen')).toBeTruthy();
    await waitFor(() => expect(row(/^Reed bow/).textContent).toContain('Quiver: nothing chosen'));
    // Never a disabled button: Attack stays tappable and says why.
    const attack = atHand().getByRole('button', { name: 'Attack with Reed bow' });
    expect(attack.hasAttribute('disabled')).toBe(false);
    await user.click(attack);
    const blocked = within(await screen.findByRole('dialog', { name: 'Nothing chosen' }));
    expect(blocked.getByText('Bone-tipped arrows used up. Choose what the Reed bow fires next.')).toBeTruthy();
    await user.click(blocked.getByRole('button', { name: 'Open the quiver' }));
    expect(await screen.findByRole('dialog', { name: 'Quiver' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Bone-tipped arrows')).toMatchObject({ qty: 1 }));
    await waitFor(() => expect(line('Reed bow')).toMatchObject({ mode_id: 'bone' }));
    await waitFor(() => expect(row(/^Reed bow/).textContent).toContain('Quiver: Bone-tipped arrows'));
  });

  it('a fresh bow fires the plain arrows it carries; spending the last keeps that mode, blocked; Undo makes it fresh again', async () => {
    fenWorld([bow(), arrows('Reed arrows', 'reed-arrows', 1), arrows('Bone-tipped arrows', 'bone-arrows', 4)]);
    const user = await openPack();
    expect(row(/^Reed bow/).textContent).toMatch(/Quiver: Reed arrows$/);
    await user.click(atHand().getByRole('button', { name: 'Attack with Reed bow' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Reed bow' })).getByRole('button', { name: 'Fire one, 0 left after' }));
    await waitFor(() => expect(line('Reed arrows')).toBeUndefined());
    // The fresh default is stored in the same request, so the bow doesn't slide on to the bone-tipped arrows.
    expect(line('Reed bow')).toMatchObject({ mode_id: 'reed' });
    const uses = world.tables.events.filter((e) => e.type === 'item.use');
    expect(new Set(uses.map((e) => e.request_id)).size).toBe(1);
    await waitFor(() => expect(row(/^Reed bow/).textContent).toContain('Quiver: nothing chosen'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Reed arrows')).toMatchObject({ qty: 1 }));
    await waitFor(() => expect(line('Reed bow')).toMatchObject({ mode_id: null }));
  });

  it('with no arrows at all in the pack the bow reads "No reed arrows in the pack", and Attack says so', async () => {
    fenWorld([bow()]);
    const user = await openPack();
    expect(row(/^Reed bow/).textContent).toContain('Quiver: no reed arrows in the pack');
    await user.click(atHand().getByRole('button', { name: 'Attack with Reed bow' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'No reed arrows in the pack' }));
    expect(sheet.getByRole('button', { name: 'Open the quiver' })).toBeTruthy();
  });

  it('the Attack sheet names what the attack inflicts, with the condition’s brief effect', async () => {
    fenWorld([{ name: 'Sting spear', extra: { equipped: true, item_data: { slot: 'hand', applies: { conditionId: 'fen-sting', save: 'poison' }, weapon: { damage: '1d6' } } } }]);
    const user = await openPack();
    await user.click(atHand().getByRole('button', { name: 'Attack with Sting spear' }));
    const sheet = await screen.findByRole('dialog', { name: 'Sting spear' });
    const inflicts = sheet.querySelector('.at-hand-sheet__inflicts')!;
    expect(inflicts.textContent).toBe('Inflicts: Fen stingSlow for a turn');
  });
});
