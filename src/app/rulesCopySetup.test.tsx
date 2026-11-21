// @vitest-environment jsdom
// Copy the set-up on the GM's Rules tab (cs-set-1, ruled 2026-11-10): one tap puts the summary on the clipboard with a
// toast; where the clipboard is out of reach, the summary opens to copy by hand.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCurrentUser } from '../core/currentUser.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { RulesForCampaign } from './RulesForCampaign.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let campaignId: string;

beforeEach(() => {
  forgetCampaignSetting();
  world = createFakeDb();
  const gm = world.addPerson('wren@lantern.example', 'Wren');
  world.signInAs(gm);
  campaignId = world.addCampaign('The Mire Road', gm);
  world.tables.packs.push({
    id: 'pack-mire',
    owner_user_id: gm,
    campaign_id: null,
    name: 'Mire Rules',
    version: '0.4.2',
    kind: 'setting',
    format_version: 2,
    source: '',
    notes: '',
    extra_meta: {},
    updated_at: '2026-11-01T12:00:00Z',
  });
  world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaignId, pack_id: 'pack-mire', pack_name: 'Mire Rules', option_choices: { 'lantern-limits': 'lifted' }, priority: 1 });
  world.tables.library_entries.push({
    id: 'e-limits',
    pack_id: 'pack-mire',
    kind: 'option',
    pack_entry_id: 'lantern-limits',
    name: 'Lantern limits',
    data: { id: 'lantern-limits', default: 'off', choices: [{ id: 'off', name: 'Off' }, { id: 'lifted', name: 'Lifted' }] },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const campaign = (): OpenCampaign => ({ id: campaignId, name: 'The Mire Road', role: 'gm', line: null });

async function openRules() {
  const user = await loadCurrentUser(world.db);
  if (!user) throw new Error('not signed in');
  render(
    <ToastHost>
      <CampaignLog db={world.db} user={user} campaignId={campaignId}>
        <RulesForCampaign db={world.db} user={user} campaign={campaign()} />
      </CampaignLog>
    </ToastHost>,
  );
  return screen.findByRole('button', { name: 'Copy the set-up' });
}

describe('Copy the set-up', () => {
  it('one tap puts the campaign, its pack and version, and the changed rule on the clipboard, and a toast says so', async () => {
    const tapper = userEvent.setup();
    const button = await openRules();
    await screen.findByText(/Optional rules: Mire Rules/);
    await tapper.click(button);
    expect(await screen.findByText('Set-up copied')).toBeTruthy();
    const copied = await navigator.clipboard.readText();
    expect(copied.startsWith('The Mire Road\n')).toBe(true);
    expect(copied).toContain('- Mire Rules, version 0.4.2');
    expect(copied).toContain('Optional rules changed from the book\n- Lantern limits: Lifted');
  });

  it("leaves out the pack's notes and the campaign's character fields", async () => {
    world.tables.packs[0]!.notes = 'Only the warden knows the ferry toll';
    world.tables.field_definitions.push({ id: 'field-oath', campaign_id: campaignId, applies_to: 'pc', key: 'oath', label: 'Lantern oath', type: 'text', choices: [], field_group: '', sort_order: 1, show_on_card: false, hidden: false, fill: null, required: false, from_list: null, created_at: '2026-10-18T12:00:00Z' });
    const tapper = userEvent.setup();
    const button = await openRules();
    await screen.findByText(/Optional rules: Mire Rules/);
    await tapper.click(button);
    await screen.findByText('Set-up copied');
    const copied = await navigator.clipboard.readText();
    expect(copied).not.toContain('ferry toll');
    expect(copied).not.toContain('Lantern oath');
  });

  it('when the clipboard is out of reach, the summary opens to copy by hand', async () => {
    const tapper = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('not allowed'));
    const button = await openRules();
    await screen.findByText(/Optional rules: Mire Rules/);
    await tapper.click(button);
    expect(await screen.findByText("Couldn't copy it here. Select the text below and copy it by hand.")).toBeTruthy();
    expect(screen.getByText(/Lantern limits: Lifted/)).toBeTruthy();
  });
});
