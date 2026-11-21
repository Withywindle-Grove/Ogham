// @vitest-environment jsdom
// An overlay's option that extends a base option (of-1, design/rulings/m5b-options-format-2026-11-03.md; options-gates
// PR 2) on Rules for this campaign. Invented packs only.
// What it checks:
//   * the base's row holds every choice, each pack's under its name, and the overlay's group has no row of its own;
//   * choosing the overlay's choice stores it with the base pack's choices (one logged change), and the row says so.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => cleanup());

describe('Rules for this campaign: an option another pack extends (of-1)', () => {
  // Purpose: the GM sees one Carrying rule with the base's choices and the overlay's under each pack's name, and a
  // tap on the overlay's choice is stored as the base option's choice.
  it("shows one row with each pack's choices, and stores the overlay's choice on the base", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaignId = world.addCampaign('The Ash Barrows', gm);
    const pack = (id: string, name: string, kind: 'setting' | 'homebrew', shortName: string, options: Record<string, unknown>[]) => {
      world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.2', kind, format_version: 2, source: '', notes: '', extra_meta: { shortName }, updated_at: '2026-10-18T12:00:00Z' });
      for (const option of options) world.tables.library_entries.push({ id: `${id}-${String(option.id)}`, pack_id: id, kind: 'option', pack_entry_id: String(option.id), name: String(option.name), data: option });
    };
    pack('pack-fen', 'Fen Rules, Advanced', 'setting', 'Fen Rules', [
      {
        id: 'carrying',
        name: 'Carrying',
        default: 'none',
        changeLater: 'allow',
        ruleKey: 'encumbrance',
        choices: [
          { id: 'none', name: 'Not tracked' },
          { id: 'coin', name: 'By coin weight' },
        ],
      },
    ]);
    pack('pack-reed', 'Reed Zine', 'homebrew', 'Reed zine', [
      { id: 'reed-slots', name: 'Reed slots', extends: 'carrying', notes: 'Count reed bundles in slots.', choices: [{ id: 'slot', name: 'Reed slots' }] },
      { id: 'reed-boots', name: 'Wet boots', default: 'off', changeLater: 'allow', choices: [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }] },
    ]);
    world.tables.campaign_packs.push(
      { id: 'link-fen', campaign_id: campaignId, pack_id: 'pack-fen', pack_name: 'Fen Rules, Advanced', option_choices: {}, priority: 1 },
      { id: 'link-reed', campaign_id: campaignId, pack_id: 'pack-reed', pack_name: 'Reed Zine', option_choices: {}, priority: 2 },
    );
    world.signInAs(gm);

    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    const rules = within(await screen.findByRole('region', { name: 'Rules for this campaign' }));

    // The overlay's group lists only its own rule; the extending one isn't a row of its own.
    await user.click(await rules.findByRole('button', { name: 'Optional rules: Reed Zine, 1 rule, none changed' }));
    expect(rules.getByRole('group', { name: 'Wet boots' })).toBeTruthy();
    expect(rules.queryByRole('group', { name: 'Reed slots' })).toBeNull();

    // The base's row: every choice, each pack's under its name.
    await user.click(rules.getByRole('button', { name: 'Optional rules: Fen Rules, Advanced, 1 rule, none changed' }));
    await user.click(within(rules.getByRole('group', { name: 'Carrying' })).getByRole('button', { name: 'Carrying: Not tracked, 1 of 3. Change' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Carrying' }));
    expect(within(sheet.getByRole('group', { name: 'Fen Rules' })).getAllByRole('button')).toHaveLength(2);
    await user.click(within(sheet.getByRole('group', { name: 'Reed zine' })).getByRole('button', { name: 'Reed zine, Reed slots' }));

    // Stored with the base pack's choices, one logged change; the row names the overlay's choice in use.
    await waitFor(() => expect(world.tables.campaign_packs.find((l) => l.id === 'link-fen')?.option_choices).toEqual({ carrying: 'slot' }));
    expect(world.tables.campaign_packs.find((l) => l.id === 'link-reed')?.option_choices).toEqual({});
    expect(world.tables.events.filter((e) => e.type === 'rules.setOptions')).toHaveLength(1);
    expect(await rules.findByRole('button', { name: 'Carrying: Reed slots, Reed zine, 1 of 3. Change' })).toBeTruthy();
  });
});
