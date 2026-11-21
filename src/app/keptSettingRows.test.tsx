// @vitest-environment jsdom
// Fix 2a of the perf report (2026-11-06): the Rules screen, the GM reference and Setting rules reuse the setting rules
// the app already downloaded (for creation and the Pack screen) instead of reading every entry again; the kept copy is
// per person and forgotten when the rules change. Only how often the same reads run changes, never what they return.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCurrentUser } from '../core/currentUser.ts';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { forgetCampaignSetting, loadCampaignPacksAndEntries, loadCampaignSetting } from './campaignSetting.ts';
import { GmReference } from './GmReference.tsx';
import { CampaignRules } from './RulesBrowser.tsx';
import { SettingRules } from './SettingRules.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;
let campaignId: string;
/** How many times the campaign's entries were read from the database (the campaign read, not the library's lists). */
let entryReads: number;
/** Set to make the campaign's entry read fail. */
let entriesBroken: boolean;

beforeEach(() => {
  forgetCampaignSetting();
  world = createFakeDb();
  gm = world.addPerson('wren@lantern.example', 'Wren');
  world.signInAs(gm);
  campaignId = world.addCampaign('The Mire Road', gm);
  world.tables.packs.push({
    id: 'pack-mire',
    owner_user_id: gm,
    campaign_id: null,
    name: 'Mire Rules',
    version: '0.1',
    kind: 'setting',
    format_version: 2,
    source: '',
    notes: '',
    extra_meta: {},
    updated_at: '2026-11-01T12:00:00Z',
  });
  world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaignId, pack_id: 'pack-mire', pack_name: 'Mire Rules', option_choices: {}, priority: 1 });
  world.tables.library_entries.push({ id: 'e-lurker', pack_id: 'pack-mire', kind: 'monster', pack_entry_id: 'bog-lurker', name: 'Bog lurker', data: { id: 'bog-lurker' } });
  world.tables.library_entries.push({ id: 'e-lantern', pack_id: 'pack-mire', kind: 'item', pack_entry_id: 'reed-lantern', name: 'Reed lantern', data: { id: 'reed-lantern', category: 'gear' } });
  entryReads = 0;
  entriesBroken = false;
  // The campaign's entries are asked for by campaign (`campaign_library`, hd-2): each ask is one read.
  const counted = world.db as unknown as { rpc: (name: string, args: Record<string, unknown>) => unknown };
  const rpc = counted.rpc.bind(counted);
  vi.spyOn(counted, 'rpc').mockImplementation((name, args) => {
    if (name === 'campaign_library') {
      entryReads += 1;
      if (entriesBroken) throw new Error('offline');
    }
    return rpc(name, args);
  });
});

/** Waits until a screen has its setting rules on screen (no "Opening…", no error). */
async function settled() {
  await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
  expect(screen.queryByRole('alert')).toBeNull();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const campaign = (): OpenCampaign => ({ id: campaignId, name: 'The Mire Road', role: 'gm', line: null });

async function signedIn(): Promise<CurrentUser> {
  const user = await loadCurrentUser(world.db);
  if (!user) throw new Error('not signed in');
  return user;
}

describe('the kept setting rules', () => {
  it('a second screen reuses what the first downloaded: the Rules screen after creation reads no entries again', async () => {
    const user = await signedIn();
    expect(await loadCampaignSetting(world.db, user.id, campaignId)).not.toBeNull();
    const afterSetting = entryReads;
    expect(afterSetting).toBeGreaterThan(0);
    render(
      <CampaignLog db={world.db} user={user} campaignId={campaignId}>
        <CampaignRules db={world.db} campaign={campaign()} backLabel="Back" onBack={() => undefined} />
      </CampaignLog>,
    );
    await settled();
    expect(entryReads).toBe(afterSetting);
  });

  it('the GM reference after the Rules screen reads no entries again', async () => {
    const user = await signedIn();
    render(
      <CampaignLog db={world.db} user={user} campaignId={campaignId}>
        <CampaignRules db={world.db} campaign={campaign()} backLabel="Back" onBack={() => undefined} />
      </CampaignLog>,
    );
    await settled();
    const once = entryReads;
    cleanup();
    render(
      <CampaignLog db={world.db} user={user} campaignId={campaignId}>
        <GmReference db={world.db} campaign={campaign()} />
      </CampaignLog>,
    );
    await settled();
    expect(entryReads).toBe(once);
  });

  it('Setting rules opens on the kept copy', async () => {
    const user = await signedIn();
    await loadCampaignSetting(world.db, user.id, campaignId);
    const afterSetting = entryReads;
    render(
      <ToastHost>
        <CampaignLog db={world.db} user={user} campaignId={campaignId}>
          <SettingRules db={world.db} user={user} campaign={campaign()} />
        </CampaignLog>
      </ToastHost>,
    );
    expect(await screen.findAllByText(/Mire Rules/)).not.toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(entryReads).toBe(afterSetting);
  });

  it('once the rules change (forgotten), the next screen reads them afresh and sees the change', async () => {
    const user = await signedIn();
    await loadCampaignPacksAndEntries(world.db, user.id, campaignId);
    world.tables.library_entries.push({ id: 'e-witch', pack_id: 'pack-mire', kind: 'monster', pack_entry_id: 'reed-witch', name: 'Reed Witch', data: { id: 'reed-witch' } });
    const before = entryReads;
    expect((await loadCampaignPacksAndEntries(world.db, user.id, campaignId))?.entries.map((e) => e.name)).not.toContain('Reed Witch');
    expect(entryReads).toBe(before);
    forgetCampaignSetting(campaignId);
    expect((await loadCampaignPacksAndEntries(world.db, user.id, campaignId))?.entries.map((e) => e.name)).toContain('Reed Witch');
    expect(entryReads).toBe(before + 1);
  });

  it("is kept per person: someone else signing in on the same device never gets the first person's copy", async () => {
    const user = await signedIn();
    await loadCampaignPacksAndEntries(world.db, user.id, campaignId);
    const before = entryReads;
    await loadCampaignPacksAndEntries(world.db, 'someone-else', campaignId);
    expect(entryReads).toBe(before + 1);
  });

  it('each screen gets its own lists, so sorting one changes no other', async () => {
    const user = await signedIn();
    const first = await loadCampaignPacksAndEntries(world.db, user.id, campaignId);
    const names = first?.entries.map((e) => e.name);
    first?.entries.reverse();
    first?.entries.pop();
    const second = await loadCampaignPacksAndEntries(world.db, user.id, campaignId);
    expect(second?.entries.map((e) => e.name)).toEqual(names);
    expect(names).toHaveLength(2);
  });

  it('a failed read is not kept: the next screen tries again', async () => {
    const user = await signedIn();
    entriesBroken = true;
    await expect(loadCampaignPacksAndEntries(world.db, user.id, campaignId)).rejects.toThrow('offline');
    entriesBroken = false;
    expect((await loadCampaignPacksAndEntries(world.db, user.id, campaignId))?.entries).toHaveLength(2);
  });
});
