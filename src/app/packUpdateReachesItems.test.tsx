// @vitest-environment jsdom
// A pack update reaches the items already owned, on the Pack (gate finding F27, 2026-11-10, option 1), and the item
// sheet names the book, not its code (gate check 73). Invented names only (hard rule 2). Purposes:
//   1. An item added before a pack update shows a mode the update added: the Reed bow's own copy has no modes, the
//      Fen Rules' entry now has a quiver, and At hand shows the Quiver button and the "Quiver: Reed arrows" line.
//   2. The GM's character overview reads the same bow with its quiver: "Reed bow, Quiver: Reed arrows ×18".
//   3. The item sheet's source line shows the book's title (the pack's meta.sourceTitles), not its code.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting, loadCampaignSetting } from './campaignSetting.ts';
import { CharacterOverview } from './CharacterOverview.tsx';

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

const QUIVER = { button: 'quiver', list: [{ id: 'reed', name: 'Reed arrows', draws: { itemId: 'reed-arrows' } }, { id: 'bone', name: 'Bone-tipped arrows', draws: { itemId: 'bone-arrows' } }] };

/** Wren with the given lines, signed in as Wren's player; the Fen Rules (short name Fen, its book FB) with the given entries. */
function fenWorld(lines: { name: string; extra?: Record<string, unknown> }[], entries: { id: string; name: string; data: Record<string, unknown> }[] = []) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.packs.push({
    id: 'pack-fen',
    owner_user_id: gm,
    campaign_id: null,
    name: 'Fen Rules',
    version: '2',
    kind: 'setting',
    format_version: 2,
    source: '',
    notes: '',
    updated_at: '2026-10-18T12:00:00Z',
    extra_meta: { shortName: 'Fen', sourceTitles: { FB: 'The Fen Book' } },
  });
  for (const e of entries) world.tables.library_entries.push({ id: `entry-${e.id}`, pack_id: 'pack-fen', kind: 'item', pack_entry_id: e.id, name: e.name, data: { id: e.id, name: e.name, ...e.data } });
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
      pinned: false,
      at_hand_hidden: false,
      approval: 'approved',
      per_units: 1,
      version: 1,
      created_at: `2026-10-23T10:00:0${i}Z`,
      ...l.extra,
    });
  }
  world.signInAs(sam);
  return { gm, campaign, wren };
}

async function openPack() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
  await screen.findByRole('heading', { name: 'Wren’s pack' });
  return user;
}

/** The Reed bow added before the update (its own copy has no modes) and its arrows; the Fen Rules' entry now has a quiver. */
const oldBowWorld = () =>
  fenWorld(
    [
      { name: 'Reed bow', extra: { equipped: true, pinned: true, source_entry_id: 'reed-bow', item_data: { slot: 'hand', hands: 2, weapon: { damage: '1d6', qualities: ['Missile'] } } } },
      { name: 'Reed arrows', extra: { category: 'ammunition', qty: 18, stack: 20, weight_coin: 1, source_entry_id: 'reed-arrows' } },
    ],
    [{ id: 'reed-bow', name: 'Reed bow', data: { category: 'weapon', slot: 'hand', hands: 2, weapon: { damage: '1d6', qualities: ['Missile'], modes: QUIVER } } }],
  );

const atHand = () => within(screen.getByRole('region', { name: 'At hand' }));

describe('a pack update reaches items already owned, on the Pack (F27)', () => {
  it('1. a bow added before the update shows the quiver the update added', async () => {
    oldBowWorld();
    await openPack();
    expect(atHand().getByRole('button', { name: 'Quiver of Reed bow' })).toBeTruthy();
    expect(atHand().getByRole('button', { name: /^Reed bow/ }).textContent).toContain('Quiver: Reed arrows ×18');
    // Reading only: the line's own copy is unchanged.
    expect(world.tables.inventory_lines.find((l) => l.name === 'Reed bow')!.item_data).toEqual({ slot: 'hand', hands: 2, weapon: { damage: '1d6', qualities: ['Missile'] } });
  });

  it('2. the GM’s character overview reads the old bow with its quiver', async () => {
    const { gm, campaign, wren } = oldBowWorld();
    world.signInAs(gm);
    const setting = await loadCampaignSetting(world.db, gm, campaign);
    render(
      <CharacterOverview
        db={world.db}
        user={{ id: gm, roles: { [campaign]: 'gm' } }}
        character={{ id: wren, campaignId: campaign, name: 'Wren', ownerUserId: null, level: 1, hpCurrent: null, hpMax: null, archived: false }}
        setting={setting}
        settings={null}
        showHp
        refresh={0}
        onClose={() => undefined}
      />,
    );
    expect(await screen.findByText('Reed bow, Quiver: Reed arrows ×18')).toBeTruthy();
  });

  it('3. the item sheet’s source line shows the book’s title, not its code', async () => {
    fenWorld([{ name: 'Coil of rope', extra: { category: 'gear', source_entry_id: 'rope', item_data: { id: 'rope', name: 'Coil of rope', source: 'FB p. 9' } } }]);
    const user = await openPack();
    await user.click(screen.getByRole('button', { name: /^Coil of rope/ }));
    const source = screen.getByText(/^From your setting: /);
    expect(source.textContent).toContain('The Fen Book, p. 9');
    expect(source.textContent).not.toMatch(/\bFB\b/);
  });
});
