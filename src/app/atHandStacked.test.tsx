// @vitest-environment jsdom
// The Player screen's stacked buttons on At hand's rows (plan dec-13 C6, first half; sb-2, md-1, ic-3; frames P1, P2 of
// december/14, approved 2026-11-14; icons page 20, frame IC1). Invented rules and names only (hard rule 2). Purposes:
//   On the Player screen, At hand's Wield, the mode button beside it, a charged thing's Use and a draught's Drink are
//   stacked buttons: the ruled icon above the word (Wield the sword hilt, Quiver the quiver, Use the pointing hand, Drink
//   the round flask, p47-2); each still named in full for a screen reader.
//   Fire, Eat and Stance carry the icons Francis picked on frame 47-2 (p47-2): the striking arrows, the bread and the
//   pikeman, so no button on At hand's rows is left with the generic mark.
//   A charged thing's stacked button says "Use", as frame P1 draws, and still spends a charge.
//   The stacked Wield still puts the weapon in hand, logged, with Undo.
//   The weapon in hand's block (C14) carries Attack as a stacked button with the raised sword, and a weapon with modes its
//   mode button stacked beside it (C6's second half), Attack still opening the Attack sheet.
//   The Pack tab's own At hand group keeps its small word buttons ("Use a charge"): its stacked buttons wait for a frame.
//   Each word maps to its ruled icon (Fire, Drink, Eat and Stance too, p47-2), and a word without one to the generic mark.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ICON_SET, type SetIconName } from '../ui/iconSet.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { ACTION_ICONS, actionIcon } from './ItemAction.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MARSH_BOW = {
  slot: 'hand',
  hands: 2,
  weapon: {
    damage: '1d6',
    modes: {
      button: 'quiver',
      list: [
        { id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } },
        { id: 'bone', name: 'Bone arrows', draws: { itemId: 'bone-arrows' } },
      ],
    },
  },
};

/** Wren carrying the given lines (pinned unless they say otherwise), signed in as Wren's player. */
function marshWorld(lines: { name: string; extra?: Record<string, unknown> }[]) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  world.addMember(campaign, sam, 'player', wren);
  for (const [i, l] of lines.entries()) {
    world.tables.inventory_lines.push({
      id: `line-${l.name.toLowerCase().replace(/\W+/g, '-')}`, campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name: l.name,
      category: 'weapon', weight_coin: 10, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '',
      item_data: {}, source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null,
      pinned: true, at_hand_hidden: false, approval: 'approved', per_units: 1, version: 1, created_at: `2026-11-18T10:00:0${i}Z`, ...l.extra,
    });
  }
  world.signInAs(sam);
}

const MARSH = [
  { name: 'Marsh bow', extra: { item_data: MARSH_BOW } },
  { name: 'Reed arrows', extra: { category: 'ammunition', pinned: false, qty: 18, stack: 20, weight_coin: 1, source_entry_id: 'reed-arrows' } },
  { name: 'Heron wand', extra: { category: 'wand', item_data: { charges: { initial: '2d4' } }, charges_left: 5 } },
  { name: 'Moss draught', extra: { category: 'draught', qty: 2, stack: 5 } },
  { name: 'Reed spear', extra: { equipped: true, item_data: { slot: 'hand', weapon: { damage: '1d6' } } } },
];

async function openPlayer() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'At hand' });
  return user;
}

const atHand = () => within(screen.getByRole('region', { name: 'At hand' }));
/** The one drawn path of a button's icon. */
const iconPath = (button: HTMLElement) => button.querySelector('svg path')?.getAttribute('d') ?? null;
const drawsIcon = (button: HTMLElement, name: SetIconName) => expect(iconPath(button)).toBe(ICON_SET[name].d);

describe('At hand’s stacked buttons on the Player screen (dec-13 C6, first half)', () => {
  it('draws Wield, Quiver, Use and Drink as stacked buttons with their icons, each named in full', async () => {
    marshWorld(MARSH);
    await openPlayer();
    const wield = await atHand().findByRole('button', { name: 'Wield Marsh bow' });
    const quiver = atHand().getByRole('button', { name: 'Quiver of Marsh bow' });
    const use = atHand().getByRole('button', { name: 'Use a charge of Heron wand' });
    const drink = atHand().getByRole('button', { name: 'Drink Moss draught' });
    for (const b of [wield, quiver, use, drink]) expect(b.classList.contains('stacked-button')).toBe(true);
    // The word under the icon, as frame P1 draws: "Use", not "Use a charge".
    expect([wield, quiver, use, drink].map((b) => b.textContent)).toEqual(['Wield', 'Quiver', 'Use', 'Drink']);
    drawsIcon(wield, 'sword-hilt');
    drawsIcon(quiver, 'quiver');
    drawsIcon(use, 'pointing');
    drawsIcon(drink, 'round-bottom-flask');
    // The mode button opens its sheet.
    expect(quiver.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('draws Fire, Eat and Stance with the icons picked on frame 47-2 (p47-2)', async () => {
    marshWorld([
      { name: 'Reed arrows', extra: { category: 'ammunition', qty: 18, stack: 20, weight_coin: 1 } },
      { name: 'Trail bread', extra: { category: 'food', qty: 5, stack: 5, weight_coin: 1 } },
      { name: 'Heron pike', extra: { item_data: { slot: 'hand', hands: 2, weapon: { damage: '1d8', modes: { button: 'stance', list: [{ id: 'set', name: 'Set' }, { id: 'swing', name: 'Swing' }] } } } } },
    ]);
    await openPlayer();
    const fire = await atHand().findByRole('button', { name: /^Fire / });
    const eat = atHand().getByRole('button', { name: /^Eat / });
    const stance = atHand().getByRole('button', { name: /^Stance / });
    for (const b of [fire, eat, stance]) expect(b.classList.contains('stacked-button')).toBe(true);
    expect([fire, eat, stance].map((b) => b.textContent)).toEqual(['Fire', 'Eat', 'Stance']);
    drawsIcon(fire, 'striking-arrows');
    drawsIcon(eat, 'bread');
    drawsIcon(stance, 'pikeman');
  });

  it('a stacked Use still spends a charge', async () => {
    marshWorld(MARSH);
    const user = await openPlayer();
    await user.click(await atHand().findByRole('button', { name: 'Use a charge of Heron wand' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Heron wand')).toMatchObject({ charges_left: 4 }));
  });

  it('a stacked Wield still puts the weapon in hand, logged, with Undo', async () => {
    marshWorld(MARSH);
    const user = await openPlayer();
    await user.click(await atHand().findByRole('button', { name: 'Wield Marsh bow' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Marsh bow')).toMatchObject({ equipped: true }));
    expect(world.tables.events.some((e) => e.type === 'inventory.equip')).toBe(true);
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('the weapon in hand’s block carries Attack as a stacked button with the raised sword, opening the Attack sheet', async () => {
    marshWorld(MARSH);
    const user = await openPlayer();
    const block = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    const attack = await block.findByRole('button', { name: 'Attack with Reed spear' });
    expect(attack.classList.contains('stacked-button')).toBe(true);
    expect(attack.textContent).toBe('Attack');
    drawsIcon(attack, 'sword-brandish');
    await user.click(attack);
    expect(await screen.findByRole('dialog', { name: 'Reed spear' })).toBeTruthy();
  });

  it('a weapon in hand with modes carries its mode button stacked beside Attack', async () => {
    marshWorld([{ name: 'Marsh bow', extra: { item_data: MARSH_BOW, equipped: true } }, MARSH[1]!, MARSH[2]!]);
    await openPlayer();
    const block = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    const quiver = await block.findByRole('button', { name: 'Quiver of Marsh bow' });
    const attack = block.getByRole('button', { name: 'Attack with Marsh bow' });
    for (const b of [quiver, attack]) expect(b.classList.contains('stacked-button')).toBe(true);
    drawsIcon(quiver, 'quiver');
    expect(quiver.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('the Pack tab’s At hand group keeps its small word buttons', async () => {
    marshWorld(MARSH);
    const user = await openPlayer();
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await screen.findByRole('heading', { name: 'Wren’s pack' });
    const use = await atHand().findByRole('button', { name: 'Use a charge of Heron wand' });
    expect(use.classList.contains('stacked-button')).toBe(false);
    expect(use.textContent).toBe('Use a charge of Heron wand');
    expect(atHand().getByRole('button', { name: 'Wield Marsh bow' }).classList.contains('stacked-button')).toBe(false);
  });
});

describe('the buttons’ icons (ic-3)', () => {
  it('maps each ruled word to its icon, and a word with none to the generic mark', () => {
    expect(ACTION_ICONS).toMatchObject({ Wield: 'sword-hilt', Grip: 'fist', Quiver: 'quiver', Pouch: 'swap-bag', Use: 'pointing', Light: 'torch', 'Put out': 'smoking-finger', Refill: 'jug' });
    // Frame 47-2's picks (p47-2, Francis 2026-11-28: "Fire 1, Drink 3, Eat 1, Stance 1").
    expect(['Fire', 'Drink', 'Eat', 'Stance'].map(actionIcon)).toEqual(['striking-arrows', 'round-bottom-flask', 'bread', 'pikeman']);
    expect(actionIcon('Sing')).toBeNull();
  });
});
