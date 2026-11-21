// @vitest-environment jsdom
// Options-gates build order 5 (bq3-13; plans/options-gates.md) on Rules for this campaign: an add-on that `requires`
// another pack's option (A1), the load method following a later change of the rule (A3), and a pack's preset (A8).
// Invented packs only.
// What it checks:
//   * an add-on is hidden while its parent hasn't the choice it needs, offered once it has;
//   * switching the parent off sets the add-on back to its default in the same logged change, and Undo puts both back;
//   * changing the carrying rule moves the campaign's load method in that one change, and Undo moves it back;
//   * a preset opens its preview (each rule it changes, the load method), then applies at once with Undo.
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

const onOff = [
  { id: 'off', name: 'Off' },
  { id: 'on', name: 'On' },
];

/** Fen Rules (carrying, lantern songs, a beginner preset) under the Reed zine (an add-on to lantern songs). */
function campaign(choices: { fen?: Record<string, string>; reed?: Record<string, string> } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaignId = world.addCampaign('The Ash Barrows', gm);
  const pack = (id: string, name: string, kind: 'setting' | 'homebrew', entries: { kind: string; data: Record<string, unknown> }[]) => {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.2', kind, format_version: 2, source: '', notes: '', extra_meta: { shortName: name }, updated_at: '2026-10-18T12:00:00Z' });
    for (const { kind: entryKind, data } of entries) world.tables.library_entries.push({ id: `${id}-${String(data.id)}`, pack_id: id, kind: entryKind, pack_entry_id: String(data.id), name: String(data.name), data });
  };
  pack('pack-fen', 'Fen Rules', 'setting', [
    {
      kind: 'option',
      data: { id: 'carrying', name: 'Carrying', default: 'none', changeLater: 'allow', presets: { beginner: 'coin' }, choices: [{ id: 'none', name: 'Not counted' }, { id: 'coin', name: 'By weight' }] },
    },
    { kind: 'option', data: { id: 'lantern-songs', name: 'Lantern songs', default: 'off', changeLater: 'allow', presets: { beginner: 'on' }, choices: onOff } },
    { kind: 'option', data: { id: 'bog-oaths', name: 'Bog oaths', default: 'off', changeLater: 'lock', presets: { beginner: 'on' }, choices: onOff } },
    {
      kind: 'rulesSet',
      data: {
        id: 'fen-rules',
        name: 'Fen rules',
        optionPresets: [{ id: 'beginner', name: 'First night in the fen', notes: 'Gentle choices for a new table.' }],
        encumbrance: { coin: { maxLoadCoin: 500 }, byOption: { 'carrying=coin': { mode: 'coin' }, 'carrying=none': { mode: 'none' } } },
      },
    },
  ]);
  pack('pack-reed', 'Reed Zine', 'homebrew', [
    { kind: 'option', data: { id: 'reed-chorus', name: 'Reed chorus', default: 'off', changeLater: 'allow', requires: { 'lantern-songs': 'on' }, choices: onOff } },
  ]);
  world.tables.campaign_packs.push(
    { id: 'link-fen', campaign_id: campaignId, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: choices.fen ?? {}, priority: 1 },
    { id: 'link-reed', campaign_id: campaignId, pack_id: 'pack-reed', pack_name: 'Reed Zine', option_choices: choices.reed ?? {}, priority: 2 },
  );
  world.signInAs(gm);
  return campaignId;
}

async function openRules() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Rules' }));
  const rules = within(await screen.findByRole('region', { name: 'Rules for this campaign' }));
  return { user, rules };
}

const choicesOf = (linkId: string) => world.tables.campaign_packs.find((l) => l.id === linkId)?.option_choices;
const setOptionEvents = () => world.tables.events.filter((e) => e.type === 'rules.setOptions');
const modeOf = (campaignId: string) => (world.tables.campaigns.find((c) => c.id === campaignId)?.settings as { encumbrance?: { mode?: string } } | undefined)?.encumbrance?.mode;

describe('Rules for this campaign: add-ons, the load method and presets (options-gates build order 5)', () => {
  // Purpose: an add-on whose parent (in another pack) is off isn't offered; once the parent is on, it is.
  it("offers an add-on only once its parent has the choice it needs (A1)", async () => {
    campaign();
    const { user, rules } = await openRules();
    // Its pack's group has nothing on offer yet.
    expect(await rules.findByRole('heading', { name: 'Optional rules: Reed Zine, none' })).toBeTruthy();
    expect(rules.queryByRole('group', { name: 'Reed chorus' })).toBeNull();

    await user.click(rules.getByRole('button', { name: 'Optional rules: Fen Rules, 3 rules, none changed' }));
    await user.click(within(rules.getByRole('group', { name: 'Lantern songs' })).getByRole('button', { name: 'On' }));
    await waitFor(() => expect(choicesOf('link-fen')).toEqual({ 'lantern-songs': 'on' }));
    await user.click(await rules.findByRole('button', { name: 'Optional rules: Reed Zine, 1 rule, none changed' }));
    expect(await rules.findByRole('group', { name: 'Reed chorus' })).toBeTruthy();
  });

  // Purpose: switching the parent off also sets the add-on back to its default, in one logged change; Undo puts both back.
  it('switching the parent off switches the add-on off with it, and Undo puts both back (A1)', async () => {
    campaign({ fen: { 'lantern-songs': 'on' }, reed: { 'reed-chorus': 'on' } });
    const { user, rules } = await openRules();
    await user.click(await rules.findByRole('button', { name: 'Optional rules: Fen Rules, 3 rules, 1 changed' }));
    await user.click(within(rules.getByRole('group', { name: 'Lantern songs' })).getByRole('button', { name: 'Off' }));

    await waitFor(() => expect(choicesOf('link-reed')).toEqual({ 'reed-chorus': 'off' }));
    expect(choicesOf('link-fen')).toEqual({ 'lantern-songs': 'off' });
    const events = setOptionEvents();
    expect(events).toHaveLength(2);
    expect(new Set(events.map((e) => e.request_id)).size).toBe(1);
    expect(await screen.findByText('Lantern songs: Off, Reed chorus: Off')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(choicesOf('link-reed')).toEqual({ 'reed-chorus': 'on' }));
    expect(choicesOf('link-fen')).toEqual({ 'lantern-songs': 'on' });
    expect(new Set(setOptionEvents().map((e) => e.request_id)).size).toBe(2);
  });

  // Purpose: a later change of the carrying rule moves the campaign's load method in the same change, and Undo moves it back.
  it("changing the carrying rule moves the campaign's load method with it (A3)", async () => {
    const campaignId = campaign();
    world.tables.campaigns.find((c) => c.id === campaignId)!.settings = { encumbrance: { mode: 'none' } };
    const { user, rules } = await openRules();
    await user.click(await rules.findByRole('button', { name: 'Optional rules: Fen Rules, 3 rules, none changed' }));
    await user.click(within(rules.getByRole('group', { name: 'Carrying' })).getByRole('button', { name: 'By weight' }));

    await waitFor(() => expect(modeOf(campaignId)).toBe('coin'));
    expect(choicesOf('link-fen')).toEqual({ carrying: 'coin' });
    expect(new Set(setOptionEvents().map((e) => e.request_id)).size).toBe(1);
    expect(await screen.findByText('Carrying: By weight, Load method: Coin weight')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(modeOf(campaignId)).toBe('none'));
    expect(choicesOf('link-fen')).toEqual({});
  });

  // Purpose: a preset shows what it would change first (a locked rule named as staying), then applies with Undo.
  it('a preset previews its changes, then applies them at once with Undo (A8)', async () => {
    const campaignId = campaign();
    const { user, rules } = await openRules();
    await user.click(await rules.findByRole('button', { name: 'Optional rules: Fen Rules, 3 rules, none changed' }));
    await user.click(within(rules.getByRole('group', { name: 'Presets' })).getByRole('button', { name: 'First night in the fen' }));

    const preview = within(await screen.findByRole('dialog', { name: 'Use First night in the fen?' }));
    expect(preview.getByText('It changes 2 rules:')).toBeTruthy();
    expect(preview.getByText(/Not counted → By weight/)).toBeTruthy();
    expect(preview.getByText(/The load method becomes Coin weight/)).toBeTruthy();
    expect(preview.getByText(/stays as it is/)).toBeTruthy();
    expect(setOptionEvents()).toHaveLength(0);

    await user.click(preview.getByRole('button', { name: 'Use First night in the fen' }));
    await waitFor(() => expect(choicesOf('link-fen')).toEqual({ carrying: 'coin', 'lantern-songs': 'on' }));
    expect(modeOf(campaignId)).toBe('coin');
    expect(await screen.findByText('First night in the fen: 2 rules changed')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(choicesOf('link-fen')).toEqual({}));
  });
});
