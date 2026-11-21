// @vitest-environment jsdom
// Fix (fix-retired-pack-row, ruled by the lead 2026-11-14): in a retired campaign nothing can change, and the rest of
// Setting rules already hides its change buttons there; each pack's row must hide its own too (Update from a new
// file, Remove…, the ⋯ menu). Hidden, as the rest of the retired page does, never disabled.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { loadCurrentUser } from '../core/currentUser.ts';
import { createFakeDb } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { CampaignLog } from './campaignLog.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { SettingRules } from './SettingRules.tsx';

// Purpose: in a retired campaign, no pack row in Setting rules offers Update from a new file, Remove… or the ⋯ menu
// (and, so the test can't pass by finding nothing, the same rows in a live campaign do offer all three).
it('in a retired campaign, no pack row offers Update from a new file, Remove… or the ⋯ menu', async () => {
  forgetCampaignSetting();
  const world = createFakeDb();
  const gm = world.addPerson('wren@lantern.example', 'Wren');
  world.signInAs(gm);
  const campaignId = world.addCampaign('The Mire Road', gm);
  const pack = (id: string, name: string, kind: string) => ({
    id,
    owner_user_id: gm,
    campaign_id: null,
    name,
    version: '0.1',
    kind,
    format_version: 2,
    source: '',
    notes: '',
    extra_meta: {},
    updated_at: '2026-11-01T12:00:00Z',
  });
  // The GM's own setting pack (it offers Update from a new file) and their own homebrew pack (it has a ⋯ menu).
  world.tables.packs.push(pack('pack-mire', 'Mire Rules', 'setting'), pack('pack-reed', 'Reed Lore', 'homebrew'));
  world.tables.campaign_packs.push(
    { id: 'link-mire', campaign_id: campaignId, pack_id: 'pack-mire', pack_name: 'Mire Rules', option_choices: {}, priority: 1 },
    { id: 'link-reed', campaign_id: campaignId, pack_id: 'pack-reed', pack_name: 'Reed Lore', option_choices: {}, priority: 2 },
  );
  world.tables.library_entries.push(
    { id: 'e-lurker', pack_id: 'pack-mire', kind: 'monster', pack_entry_id: 'bog-lurker', name: 'Bog lurker', data: { id: 'bog-lurker' } },
    { id: 'e-witch', pack_id: 'pack-reed', kind: 'monster', pack_entry_id: 'reed-witch', name: 'Reed Witch', data: { id: 'reed-witch' } },
  );
  const user = await loadCurrentUser(world.db);
  if (!user) throw new Error('not signed in');

  /** Opens Setting rules for The Mire Road and waits for both packs' rows. */
  const open = async (retiredAt: string | null) => {
    cleanup();
    forgetCampaignSetting();
    const campaign: OpenCampaign = { id: campaignId, name: 'The Mire Road', role: 'gm', line: null, retiredAt };
    render(
      <ToastHost>
        <CampaignLog db={world.db} user={user} campaignId={campaignId}>
          <SettingRules db={world.db} user={user} campaign={campaign} />
        </CampaignLog>
      </ToastHost>,
    );
    await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
    expect(await screen.findAllByText('Mire Rules')).not.toHaveLength(0);
    expect(screen.getAllByText('Reed Lore')).not.toHaveLength(0);
  };

  try {
    await open(null);
    expect(screen.getByLabelText('Update Mire Rules from a new file')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Mire Rules from this campaign' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reed Lore options' })).toBeTruthy();

    await open('2026-11-10T12:00:00Z');
    expect(screen.queryByText('Update from a new file')).toBeNull();
    expect(screen.queryByText('Remove…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reed Lore options' })).toBeNull();
  } finally {
    cleanup();
  }
});
