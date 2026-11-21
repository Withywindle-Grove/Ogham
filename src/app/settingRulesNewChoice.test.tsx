// @vitest-environment jsdom
// "New choice for <topic>" on the Setting rules screen (docs/07 "ruleKey"; built 2026-11-02). Invented packs only.
// What it checks:
//   * adding a pack that brings a rival rule shows a callout with each pack's choice and the standing one as "kept";
//   * tapping the new pack's choice makes it decide, says so, and stores the pick on the campaign.
import { cleanup, render, screen, within } from '@testing-library/react';
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

describe('Campaign → Setting rules: New choice for a topic', () => {
  it('adding a rival rule keeps the standing choice, offers both, and tapping the new pack\'s choice makes it decide', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaignId = world.addCampaign('The Ash Barrows', gm);
    const pack = (id: string, name: string, kind: 'setting' | 'homebrew', shortName: string, option: Record<string, unknown>) => {
      world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.2', kind, format_version: 2, source: '', notes: '', extra_meta: { shortName }, updated_at: '2026-10-18T12:00:00Z' });
      world.tables.library_entries.push({ id: `${id}-opt`, pack_id: id, kind: 'option', pack_entry_id: String(option.id), name: String(option.name), data: option });
    };
    pack('pack-fen', 'Fen Rules, Advanced', 'setting', 'Fen Rules', {
      id: 'fen-load', name: 'Item load', default: 'weight', changeLater: 'allow', ruleKey: 'item-load', choices: [{ id: 'weight', name: 'By weight' }, { id: 'count', name: 'By count' }],
    });
    pack('pack-zine', 'Zine Compendium', 'homebrew', 'Zine', {
      id: 'zine-load', name: 'Item counts', default: 'counts', changeLater: 'allow', ruleKey: 'item-load', choices: [{ id: 'counts', name: 'Item counts' }, { id: 'weight', name: 'Weight' }],
    });
    // The setting pack is already part of the campaign.
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaignId, pack_id: 'pack-fen', pack_name: 'Fen Rules, Advanced', option_choices: {}, priority: 1 });
    world.signInAs(gm);

    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: 'From your library' }));
    await user.click(await screen.findByRole('button', { name: 'Add Zine Compendium to this campaign' }));
    await user.click(await screen.findByRole('button', { name: 'Add to this campaign' }));
    expect(await screen.findByText('Zine Compendium was added to this campaign.')).toBeTruthy();

    // The homebrew landed on top, yet the setting pack's choice still counts until the GM chooses.
    const callout = within(await screen.findByRole('group', { name: 'New choice for item load' }));
    expect(callout.getByText('Now: Fen Rules, By weight (kept).')).toBeTruthy();
    expect(callout.getByRole('button', { name: 'Fen Rules, By weight' })).toBeTruthy();
    await user.click(callout.getByRole('button', { name: 'Zine, Item counts' }));

    expect(await screen.findByText('Zine Compendium now decides item load for this campaign.')).toBeTruthy();
    const settings = world.tables.campaigns.find((c) => c.id === campaignId)?.settings as { ruleGroups?: Record<string, string> };
    expect(settings.ruleGroups).toEqual({ 'item-load': 'pack-zine' });
    expect(screen.queryByRole('group', { name: 'New choice for item load' })).toBeNull();
  });
});
