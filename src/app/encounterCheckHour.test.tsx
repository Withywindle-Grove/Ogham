// @vitest-environment jsdom
// Purpose: At the night stop (a camp made), the GM's Encounter check puts the night-only wandering check on the card and
// not the day-only one; by day (no camp, clock at morning) the day-only one and not the night-only one. (Rulings nc-1
// and nc-3, 2026-11-11: night = the setting's sunset→sunrise, else 22:00–06:00; the night stop — a camp made, or the
// move held for the night check — always counts as night.) The rules are the invented fixture pack's Fen trek, with its
// Prowlers made night-only and a day-only "Stalkers" check added; every name is invented.
import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { startExpedition } from '../testing/depart.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

configure({ asyncUtilTimeout: 3000 });

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
// The Fen trek's checks: Prowlers only at night, plus Stalkers only by day (same die and table as the fixture's own).
const trek = (pack.rulesSets![0]!.exploration as { modes: { checks: Record<string, unknown>[] }[] }).modes[0]!;
const prowl = trek.checks.find((c) => c.id === 'fen-prowl')!;
prowl.onlyAt = 'night';
trek.checks.push({ ...prowl, id: 'fen-stalk', name: 'Stalkers', onlyAt: 'day' });

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

const live = (rows: Record<string, unknown>[]) => rows.filter((r) => r.undone !== true);

it("the GM's Encounter check offers the night-only check at the night stop and the day-only one by day", async () => {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Reed', { ownerId: sam }));
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of pack[list] ?? []) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  // The clock starts at midnight (night by the 22:00–06:00 default); set it to 08:00, a morning.
  world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 8 * 3600;
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Long Fen Road/ }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^Fen trek, day 1/ });
  // S2/S3 (page 16, T6b): Make camp and Encounter check are icon buttons in the band's Quick actions, not in ⋯.
  const quick = async (name: string) => within(await screen.findByRole('group', { name: 'Quick actions' })).getByRole('button', { name });
  const dueCard = async () => {
    await user.click(await quick('Encounter check'));
    return within(await screen.findByRole('region', { name: 'Due' }));
  };

  // By day (no camp, the clock at the morning start): Stalkers, not Prowlers.
  let due = await dueCard();
  expect(await due.findByRole('button', { name: 'Miss, Stalkers, now' })).toBeTruthy();
  expect(due.queryByRole('button', { name: /Prowlers/ })).toBeNull();
  await user.click(due.getByRole('button', { name: 'Miss, Stalkers, now' }));
  await waitFor(() => expect(live(world.tables.check_results)).toHaveLength(1));

  // At the night stop (camp made): Prowlers, not Stalkers.
  await user.click(await quick('Make camp'));
  await waitFor(() => expect(live(world.tables.camps)).toHaveLength(1));
  due = await dueCard();
  expect(await due.findByRole('button', { name: 'Miss, Prowlers, now' })).toBeTruthy();
  expect(due.queryByRole('button', { name: /Stalkers/ })).toBeNull();
}, 60000);
