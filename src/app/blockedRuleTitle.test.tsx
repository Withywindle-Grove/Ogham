// @vitest-environment jsdom
// When a class can't use a thing, the pop-up says the rule once (tfw-4; plan test-feedback-2026-11-19, B5): its title is
// the rule itself ("Lantern Warden can't use Marsh bow"), with the pack's own note under it when the rule has one, and
// no "Can't wield" or "Can't use" title. Invented rules and names only (hard rule 2). Purposes:
//   A blocked Wield on the Player screen's At hand opens a pop-up titled by the rule, with no line under it when the
//   rule has no note.
//   A blocked Wield whose rule carries a note shows the note under the title, and nothing else.
//   A blocked Wear on the item's sheet titles its pop-up by the rule, the note under it, OK the way on.
//   A blocked Wield by a rules set's weapon rule leaves the rule's verdict out: the title, and the class's note if any.
//   The pop-up of an item that is off (not a class's rule) keeps its own title and line, through Wield on At hand.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { EquipWarningCard } from './EquipWarning.tsx';

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

/**
 * Wren, a Lantern Warden whose weapons are knives only, carrying a pinned bow, signed in as Wren's player. `more` adds
 * entries to the Fen pack (a rules set's weapon rules, an option); `bow` adds to the bow's details.
 */
function wardenWorld(weaponsAllowed: Record<string, unknown>, { more = [], bow = {}, warden = {} }: { more?: Record<string, unknown>[]; bow?: Record<string, unknown>; warden?: Record<string, unknown> } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-lantern-warden', pack_id: 'pack-fen', kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden',
    data: { id: 'lantern-warden', name: 'Lantern Warden', weaponsAllowed, ...warden },
  });
  for (const data of more) {
    world.tables.library_entries.push({ id: `entry-${String(data.id)}`, pack_id: 'pack-fen', kind: String(data.kind), pack_entry_id: String(data.id), name: String(data.name), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
  world.tables.inventory_lines.push({
    id: 'line-marsh-bow', campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name: 'Marsh bow',
    category: 'weapon', weight_coin: 10, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '',
    item_data: { slot: 'hand', hands: 2, weaponTags: ['Missile'], weapon: { damage: '1d6' }, ...bow }, source_pack_id: null, source_entry_id: 'marsh-bow', charges_left: null,
    charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: true, at_hand_hidden: false, approval: 'approved', per_units: 1, version: 1,
    created_at: '2026-11-18T10:00:00Z',
  });
  world.signInAs(sam);
}

async function wieldTheBow() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
  await user.click(await atHand.findByRole('button', { name: 'Wield Marsh bow' }));
  return screen.findByRole('dialog', { name: "Lantern Warden can't use Marsh bow" });
}

describe("a class that can't use a thing: the pop-up says the rule once (tfw-4, B5)", () => {
  it('a blocked Wield is titled by the rule, with no line under it when the rule has no note', async () => {
    wardenWorld({ mode: 'list', ids: ['knife'] });
    const popup = await wieldTheBow();
    expect(popup.textContent).not.toMatch(/Can't wield|Can't use/);
    expect(popup.querySelector('.blocked-sheet__why')).toBeNull();
    expect(world.tables.inventory_lines[0]).toMatchObject({ equipped: false });
  });

  it("a blocked Wield whose rule carries a note shows the pack's note under the title, and nothing else", async () => {
    wardenWorld({ mode: 'list', ids: ['knife'], note: 'Knives only: a warden keeps one hand for the lantern.' });
    const popup = await wieldTheBow();
    expect([...popup.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['Knives only: a warden keeps one hand for the lantern.']);
    expect(popup.textContent).not.toContain("can't use Marsh bow.");
  });

  it("a blocked Wield by a weapon rule shows the rule as the title and leaves the rule's verdict out", async () => {
    const longbows = { id: 'fen-rules', kind: 'rulesSet', name: 'Fen rules', weaponRules: [{ category: 'Longbow', classCategories: ['martial'], note: 'The marsh referee decides for chaplains.' }] };
    wardenWorld({ mode: 'list', ids: ['knife'] }, { more: [longbows], bow: { weaponTags: ['Longbow', 'Missile'] }, warden: { weaponProficiencyCategory: 'gentle' } });
    const popup = await wieldTheBow();
    expect(popup.querySelector('.blocked-sheet__why')).toBeNull();
    expect(popup.textContent).not.toMatch(/Longbow rule|referee/);
  });

  it('an item that is off keeps its own pop-up through Wield on At hand: "Can\'t wield the …" and why', async () => {
    const powder = { id: 'fen-powder', kind: 'option', name: 'Powder age', default: 'none', choices: [{ id: 'none', name: 'No guns' }, { id: 'wheel', name: 'Wheel guns' }] };
    const bowEntry = { id: 'marsh-bow', kind: 'item', name: 'Marsh bow', category: 'weapon', slot: 'hand', weaponTags: ['Missile'], weapon: { damage: '1d6' }, option: 'fen-powder=wheel' };
    wardenWorld({ mode: 'any' }, { more: [powder, bowEntry] });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(await atHand.findByRole('button', { name: 'Wield Marsh bow' }));
    const popup = await screen.findByRole('dialog', { name: "Can't wield the Marsh bow" });
    expect(popup.querySelector('.blocked-sheet__why')?.textContent).toBe("Marsh bow is off under Wheel guns: it can't be worn, held or used.");
  });

  it("a blocked Wear's pop-up is titled by the rule, the note under it and nothing else, OK the way on", () => {
    const why = 'The Iron rule allows martial classes; Reed Witch is gentle.';
    render(
      <EquipWarningCard
        itemName="Bog-iron coat"
        check={{
          blocked: [`Reed Witch can't use Bog-iron coat in Dusk phase. Heavy iron drowns the whisper. ${why}`],
          blocks: [{ rule: "Reed Witch can't use Bog-iron coat in Dusk phase", note: 'Heavy iron drowns the whisper.', why }],
          stopsCasting: null,
          warnings: [],
          skipped: [],
          equipped: {},
        }}
        busy={false}
        onAnyway={() => {}}
        onOffer={() => {}}
        onKeep={() => {}}
      />,
    );
    const popup = screen.getByRole('dialog', { name: "Reed Witch can't use Bog-iron coat in Dusk phase" });
    expect([...popup.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['Heavy iron drowns the whisper.']);
    expect(within(popup).getByRole('button', { name: 'OK' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: "Can't use Bog-iron coat" })).toBeNull();
  });
});
