// @vitest-environment jsdom
// rq-1 on the campaign's Rules page (Setting rules): a pack whose required pack isn't attached says so on its row,
// with "Attach <Other>" when the GM's library has it (the same command as From your library, logged), and "Import it
// into your library first." when it hasn't. It refuses nothing and hides nothing. Invented packs only.
import { cleanup, render, screen } from '@testing-library/react';
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

/** A GM's campaign holding the conversion pack alone; the library has the pack it converts, or not. */
function setUp(baseInLibrary: boolean) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaignId = world.addCampaign('The Ash Barrows', gm);
  const pack = (id: string, name: string, meta: Record<string, unknown>) => {
    world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '0.2', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: meta, updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: `${id}-item`, pack_id: id, kind: 'item', pack_entry_id: `${id}-lantern`, name: 'Reed lantern', data: { id: `${id}-lantern`, name: 'Reed lantern' } });
  };
  if (baseInLibrary) pack('pack-moss', 'Moss Rules', { id: 'moss-rules', shortName: 'Moss' });
  pack('pack-conv', 'Fen to Moss conversion', { id: 'fen-moss', shortName: 'Conversion', requires: [{ packId: 'moss-rules' }] });
  world.tables.campaign_packs.push({ id: 'link-conv', campaign_id: campaignId, pack_id: 'pack-conv', pack_name: 'Fen to Moss conversion', option_choices: {}, priority: 1 });
  world.signInAs(gm);
  return campaignId;
}

async function openRules() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Rules' }));
  return user;
}

describe('Campaign → Setting rules: a pack that needs one not attached (rq-1)', () => {
  // Purpose: the conversion's row says what it needs, with one plain button that attaches the needed pack through the
  // same command as From your library (a campaign_packs row and a log line); then the line goes.
  it('says so on the row and attaches the needed pack from the library', async () => {
    const campaignId = setUp(true);
    const user = await openRules();
    const line = await screen.findByText("Fen to Moss conversion needs Moss Rules, which isn't attached to this campaign.");
    expect(line).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Attach Moss Rules' }));
    expect(await screen.findByText('Moss Rules was added to this campaign.')).toBeTruthy();
    expect(world.tables.campaign_packs.some((l) => l.campaign_id === campaignId && l.pack_id === 'pack-moss')).toBe(true);
    expect(world.tables.events.some((e) => e.type === 'rules.attach')).toBe(true);
    expect(screen.queryByText(/which isn't attached to this campaign/)).toBeNull();
  });

  // Purpose: a needed pack the library hasn't got: the line ends "Import it into your library first." and offers no button.
  it('says to import a needed pack the library has not got, with no button', async () => {
    setUp(false);
    await openRules();
    const line = await screen.findByText("Fen to Moss conversion needs moss-rules, which isn't attached to this campaign. Import it into your library first.");
    expect(line).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Attach / })).toBeNull();
  });

  // Purpose (departure, agreed in review): a retired campaign keeps the line, naming the missing pack, and offers no
  // Attach, as the page offers no add of any kind there (nothing in a retired campaign can change).
  it('in a retired campaign, still names the missing pack, with no Attach', async () => {
    const campaignId = setUp(true);
    world.tables.campaigns.find((c) => c.id === campaignId)!.retired_at = '2026-11-01T12:00:00Z';
    await openRules();
    const line = await screen.findByText("Fen to Moss conversion needs Moss Rules, which isn't attached to this campaign.");
    expect(line).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Attach Moss Rules' })).toBeNull();
  });

  // Purpose (status question 3, pinned as it is today): a needed pack attached from another person's library isn't in
  // this GM's library, so it can't be matched: the line still says it isn't attached, by its id, and says to import it.
  it("today, a needed pack attached from another person's library still reads as not attached", async () => {
    const campaignId = setUp(false);
    const other = world.addPerson('tam@lantern.example', 'Tam');
    world.tables.packs.push({ id: 'pack-moss-tam', owner_user_id: other, campaign_id: null, name: 'Moss Rules', version: '0.2', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: { id: 'moss-rules', shortName: 'Moss' }, updated_at: '2026-10-18T12:00:00Z' });
    world.tables.campaign_packs.push({ id: 'link-moss-tam', campaign_id: campaignId, pack_id: 'pack-moss-tam', pack_name: 'Moss Rules', option_choices: {}, priority: 2 });
    await openRules();
    expect(await screen.findByText("Fen to Moss conversion needs moss-rules, which isn't attached to this campaign. Import it into your library first.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Attach / })).toBeNull();
  });

  // Purpose: several Attach buttons sit in the page's action row (the token gap between them, wrapping on a phone).
  it('puts several Attach buttons in the action row', async () => {
    setUp(true);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: world.tables.packs[0]!.owner_user_id, campaign_id: null, name: 'Fen Rules', version: '0.2', kind: 'setting', format_version: 2, source: '', notes: '', extra_meta: { id: 'fen-rules' }, updated_at: '2026-10-18T12:00:00Z' });
    const conv = world.tables.packs.find((p) => p.id === 'pack-conv')!;
    conv.extra_meta = { ...(conv.extra_meta as Record<string, unknown>), requires: [{ packId: 'fen-rules' }, { packId: 'moss-rules' }] };
    await openRules();
    const fen = await screen.findByRole('button', { name: 'Attach Fen Rules' });
    const moss = screen.getByRole('button', { name: 'Attach Moss Rules' });
    expect(fen.parentElement).toBe(moss.parentElement);
    expect(fen.parentElement!.className).toBe('setting-rules__actions');
  });

  // Purpose: it hides nothing: the conversion's row is still there with its counts.
  it('hides nothing on the row', async () => {
    setUp(true);
    await openRules();
    await screen.findByText(/which isn't attached to this campaign/);
    expect(screen.getAllByText('Fen to Moss conversion').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 item/).length).toBeGreaterThan(0);
  });
});
