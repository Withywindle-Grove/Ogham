// @vitest-environment jsdom
// Picks kept on the device after Leave (cw-13, Francis 2026-11-06; mockup creation/13). Purposes:
//   Leaving guided creation before Who they are keeps the picks on this device and says so; the next Create offers
//     Continue where you left off (naming what's kept) and Start again; Continue brings every pick back, editable.
//   Another player signed in on the same device sees nothing of it.
//   A kept class the campaign's packs no longer have is dropped, the walk lands on Class, and the step says so.
//   The kept picks are gone once the draft exists (Who they are), on Start again, and on sign-out.
//   Every pick before Who they are is kept as it is made, not only on Leave (after-test A12).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetAllKept, keepPicks, readKept } from './keptCreation.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

/** The fixture's invented setting on a campaign, one path (no Method step), two players. */
function fenWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const other = world.addPerson('ash@lantern.example', 'Ash');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.addMember(campaign, other, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  world.signInAs(me);
  return { me, other, campaign };
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const toCreate = async (user: User) => {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
};

/** Scores (Muscle 13), then Stone kin, then Leave from the Class step. */
async function leaveOnClass(user: User) {
  await toCreate(user);
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  const muscle = await screen.findByLabelText('Muscle');
  await user.clear(muscle);
  await user.type(muscle, '13');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Stone kin' }));
  await screen.findByRole('heading', { name: 'Class' });
  // Leave is in the app bar's ⋯ (final drafts A1).
  // Creation's ⋯ opens a sheet (final draft 9); with picks kept its last row reads Save and leave.
  await user.click(screen.getByRole('button', { name: 'More' }));
  await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: /^Save and leave/ }));
}

describe('picks kept on the device after Leave (cw-13)', () => {
  it('Leave keeps them and says so; the next Create offers Continue, which brings every pick back', async () => {
    const { me, campaign } = fenWorld();
    const user = openApp();
    await leaveOnClass(user);
    expect(await screen.findByText('Kept on this device. Pick it up again from Create.')).toBeTruthy();
    expect(readKept(me, campaign)).toMatchObject({ step: 'class', race: { id: 'stone-kin', name: 'Stone kin' }, typed: { MUS: '13' } });
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    // Final drafts F: a sheet naming what was kept, where and when; Continue carries the accent.
    const sheet = within(await screen.findByRole('dialog', { name: 'Continue where you left off?' }));
    expect(sheet.getByText('You left a character on this device today: Scores, Stone kin.')).toBeTruthy();
    // The quiet line keeps "Kept on this device only." and nothing more (dec-10 B, cs-6).
    expect(sheet.getByText('Kept on this device only.')).toBeTruthy();
    expect(sheet.queryByText(/Nothing has been sent/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Start again' }).className).not.toContain('button-primary');
    expect(screen.getByRole('button', { name: 'Continue' }).className).toContain('button-primary');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Class' })).toBeTruthy();
    // Every kept value is there and editable: Back to the kindred (picked), then Scores (13).
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect(screen.getByRole('checkbox', { name: 'Pick Stone kin' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('13');
  });

  // After-test A12: an app update, a closed tab or a flat battery must lose nothing, so each pick is kept as it's made.
  it('every pick is kept as it is made, without Leave; opening the step alone keeps nothing', async () => {
    const { me, campaign } = fenWorld();
    const user = openApp();
    await toCreate(user);
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    const muscle = await screen.findByLabelText('Muscle');
    expect(readKept(me, campaign)).toBeNull();
    await user.clear(muscle);
    await user.type(muscle, '13');
    await waitFor(() => expect(readKept(me, campaign)).toMatchObject({ step: 'scores', typed: { MUS: '13' } }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Pick Stone kin' }));
    await screen.findByRole('heading', { name: 'Class' });
    expect(readKept(me, campaign)).toMatchObject({ step: 'class', race: { id: 'stone-kin', name: 'Stone kin' }, typed: { MUS: '13' } });
  });

  it('another player signed in on the same device sees nothing kept', async () => {
    const { other } = fenWorld();
    let user = openApp();
    await leaveOnClass(user);
    await screen.findByText('Kept on this device. Pick it up again from Create.');
    cleanup();
    world.signInAs(other);
    user = openApp();
    await toCreate(user);
    expect(await screen.findByRole('button', { name: /^Guided/ })).toBeTruthy();
    expect(screen.queryByText('Continue where you left off')).toBeNull();
  });

  it('a kept class the packs no longer have is dropped: Continue lands on Class and says so', async () => {
    const { me, campaign } = fenWorld();
    keepPicks(me, campaign, { step: 'adjust', method: null, typed: { MUS: '13' }, race: { id: 'stone-kin', name: 'Stone kin' }, klass: { id: 'old-calling', name: 'Old Calling' }, trades: [] });
    const user = openApp();
    await toCreate(user);
    // When it was kept, in words (final drafts F).
    expect(await screen.findByText('You left a character on this device today: Scores, Stone kin, Old Calling.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Class' })).toBeTruthy();
    expect(screen.getByText("Old Calling isn't in this campaign's rules any more. Pick again.")).toBeTruthy();
    // Next can't go on yet: the status line says why, marked.
    const status = screen.getByRole('status', { name: 'Step status' });
    expect(status.className).toContain('creation-step__hint--stop');
  });

  it('the kept picks are gone once the draft takes over (Who they are), and Start again forgets them', async () => {
    const { me, campaign } = fenWorld();
    let user = openApp();
    await leaveOnClass(user);
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Pick Lantern Warden' }));
    if (heading() === 'Adjust scores') await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(readKept(me, campaign)).toBeNull();

    // Start again: kept again, then forgotten from the Create screen.
    cleanup();
    keepPicks(me, campaign, { step: 'scores', method: null, typed: { MUS: '11' }, race: null, klass: null, trades: [] });
    user = openApp();
    await toCreate(user);
    await user.click(await screen.findByRole('button', { name: 'Start again' }));
    expect(readKept(me, campaign)).toBeNull();
    expect(await screen.findByRole('button', { name: /^Guided/ })).toBeTruthy();
    expect(within(document.body).queryByText('Continue where you left off')).toBeNull();
  });

  it('sign-out forgets every player’s kept picks on the device, and nothing else', () => {
    localStorage.setItem('grimoire.packOpen', '{"gear":true}');
    keepPicks('p1', 'c1', { step: 'scores', method: null, typed: {}, race: null, klass: null, trades: [] });
    keepPicks('p2', 'c1', { step: 'scores', method: null, typed: {}, race: null, klass: null, trades: [] });
    forgetAllKept();
    expect(readKept('p1', 'c1')).toBeNull();
    expect(readKept('p2', 'c1')).toBeNull();
    expect(localStorage.getItem('grimoire.packOpen')).toBe('{"gear":true}');
  });
});
