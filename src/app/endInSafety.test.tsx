// @vitest-environment jsdom
// m8b-0 delivery 5 (ruled 2026-11-06): safety is a question at End expedition, not a property of a place. On the
// stand-in database; invented names and rules only.
//   The place card has no Safe or hostile row, and coming back to a place raises no arrival card (not even one marked
//   Safe before the ruling). End expedition ends at once; the summary's first line asks In a safe place? · Yes · No:
//   unanswered and No offer nothing, Yes offers Start downtime · Not yet and is kept (read back after a reload, and
//   folded into End's Simple line); the other button changes it; Undo puts the expedition back and forgets the answer;
//   Not yet keeps the party in Adventure with ⋯ Start downtime still offered; the summary's Start downtime is 6a's;
//   players see nothing new.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { moveSomewhereElse, typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openDepart, startExpedition } from '../testing/depart.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

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

/** A GM, one player's character (Wren), invented rules: a market town by parts of the day. */
function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 4, hp_max: 6 });
  world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-quay-rules',
    pack_id: 'pack-quay',
    kind: 'rulesSet',
    pack_entry_id: 'quay-rules',
    name: 'Quay rules',
    data: { id: 'quay-rules', name: 'Quay rules', exploration: { modes: [{ id: 'quay', name: 'Market town', step: { value: 1, unit: 'partOfDay' }, procedure: [], checks: [] }] } },
  });
  world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: campaign, pack_id: 'pack-quay', pack_name: 'Quay Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 6 * 3600;
  const row = () => world.tables.campaigns.find((c) => c.id === campaign)!;
  return { gm, sam, campaign, row };
}

type User = ReturnType<typeof userEvent.setup>;

async function openAs(person: string) {
  world.signInAs(person);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  return user;
}

/** Start expedition at a place typed into Where?. */
async function setOut(user: User, where: string) {
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  // "Next part of day" in town shows only while a session runs (st-1, st-2): the GM starts one first.
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Session 1.');
  await typePlace(user, where, /^Where\?:/, await openDepart(user));
  await startExpedition(user);
  await screen.findByRole('heading', { name: where });
}

async function goTo(user: User, where: string) {
  await moveSomewhereElse(user, where);
  await screen.findByRole('heading', { name: where });
}

const place = (name: string) => world.tables.places.find((p) => p.name === name)!;
const offer = () => screen.queryByText('Staying a while?');
const question = (summary: HTMLElement) => within(summary).getByRole('group', { name: 'In a safe place?' });
const trip = () => world.tables.expeditions.at(-1)!;

async function endExpedition(user: User) {
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name: 'End expedition' }));
  return await screen.findByRole('region', { name: 'Expedition ended' });
}

async function answer(user: User, summary: HTMLElement, choice: 'Yes' | 'No') {
  await user.click(within(question(summary)).getByRole('button', { name: choice }));
  await waitFor(() => expect(within(question(summary)).getByRole('button', { name: choice }).getAttribute('aria-pressed')).toBe('true'));
}

describe('safety as a question at End expedition (m8b-0 delivery 5)', () => {
  // Purpose: a place is no longer Safe or Hostile: the place card has no such row, and coming back raises no arrival card.
  it('has no Safe or hostile row and no arrival card, even at a place marked Safe before the ruling', async () => {
    const { gm } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    expect(screen.queryByRole('group', { name: 'Safe or hostile' })).toBeNull();
    // An old mark stays in the database, unread by the strip.
    await world.db.from('places').update({ safety: 'safe', version: Number(place('Quay Gate').version) }).eq('id', String(place('Quay Gate').id));
    // Marked Safe, it is a town again, which keeps today's place card (5b leaves towns to 5t): wait for it.
    await screen.findByRole('button', { name: 'Change place' }, { timeout: 3000 });
    await goTo(user, 'The Old Mill');
    await goTo(user, 'Quay Gate');
    expect(screen.queryByRole('status', { name: 'Back in a safe place' })).toBeNull();
    expect(screen.queryByText(/back in a safe place/i)).toBeNull();
    // Purpose (st-2, superseding "the main advance stays the accent"): the band's advance is never the accent.
    expect(screen.getByRole('button', { name: 'Next part of day' }).className).not.toContain('button-primary');
  });

  // Purpose: End still ends at once; the summary's first line asks In a safe place?, unanswered, with no downtime offer yet.
  it('ends at once and asks In a safe place? first, with no offer until it is answered', async () => {
    const { gm, row } = table();
    const user = await openAs(gm);
    await setOut(user, 'The Old Mill');
    const summary = await endExpedition(user);
    expect(world.tables.events.filter((e) => e.type === 'expedition.end' && e.target_table === 'expeditions')).toHaveLength(1);
    expect(row().mode).toBe('adventure');
    // The first line after the time it took (S19, T11); the two-sided switch (ds-1d) with neither side lit, neither the accent.
    const line = question(summary).parentElement!;
    expect(line.previousElementSibling?.className).toContain('end-card__took');
    expect(question(summary).className).toContain('button-row--switch');
    for (const name of ['Yes', 'No']) {
      const button = within(question(summary)).getByRole('button', { name });
      expect(button.className).not.toContain('button-primary');
      expect(button.getAttribute('aria-pressed')).toBe('false');
    }
    expect(offer()).toBeNull();
    expect(trip().ended_safe ?? null).toBeNull();
  });

  // Purpose: Yes offers Start downtime · Not yet and is kept with the expedition's end (one Verbose line); No offers nothing; the other button changes it.
  it('Yes offers Start downtime, Not yet; No offers nothing; the answer can be changed', async () => {
    const { gm } = table();
    const user = await openAs(gm);
    await setOut(user, 'The Old Mill');
    const summary = await endExpedition(user);
    await answer(user, summary, 'Yes');
    expect(within(summary).getByText('Staying a while?')).toBeTruthy();
    expect(within(summary).getByRole('button', { name: 'Start downtime' }).className).not.toContain('button-primary');
    expect(trip().ended_safe).toBe(true);
    expect(world.tables.events.filter((e) => e.type === 'expedition.safePlace').map((e) => e.level)).toEqual(['verbose']);
    // Changed to No: the offer goes.
    await answer(user, summary, 'No');
    await waitFor(() => expect(offer()).toBeNull());
    expect(trip().ended_safe).toBe(false);
    // The same answer again writes nothing.
    await user.click(within(question(summary)).getByRole('button', { name: 'No' }));
    expect(world.tables.events.filter((e) => e.type === 'expedition.safePlace')).toHaveLength(2);
  });

  // Purpose: the Yes survives a reload: it is read back from the database, and End's Simple line says "in a safe place".
  it('keeps a Yes through a reload, and the Simple log reads one End line in a safe place', async () => {
    const { gm } = table();
    const user = await openAs(gm);
    await setOut(user, 'The Old Mill');
    await answer(user, await endExpedition(user), 'Yes');
    cleanup();
    const again = await openAs(gm);
    await again.click(await screen.findByRole('button', { name: 'Log' }));
    expect((await within(await screen.findByRole('dialog', { name: 'Log' })).findAllByText(/ended the expedition in a safe place/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/said the party ended in a safe place/)).toBeNull();
    expect(trip().ended_safe).toBe(true);
  });

  // Purpose: Undo puts the expedition back and forgets the answer, so ending again asks afresh.
  it('Undo brings the expedition back and forgets the answer', async () => {
    const { gm } = table();
    const user = await openAs(gm);
    await setOut(user, 'The Old Mill');
    const summary = await endExpedition(user);
    await answer(user, summary, 'Yes');
    await user.click(within(summary).getByRole('button', { name: 'Undo ending the expedition' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Expedition ended' })).toBeNull());
    await screen.findByRole('button', { name: 'Next part of day' });
    expect(trip().ended_at).toBeNull();
    expect(trip().ended_safe).toBeNull();
    expect(offer()).toBeNull();
    const fresh = await endExpedition(user);
    expect(within(question(fresh)).getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('false');
    expect(offer()).toBeNull();
  });

  // Purpose: Not yet keeps the party in town, in Adventure, and the strip's ⋯ still offers Start downtime (also after No).
  it('Not yet keeps the party in Adventure; ⋯ still offers Start downtime', async () => {
    const { gm, row } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    const summary = await endExpedition(user);
    await answer(user, summary, 'Yes');
    await user.click(within(summary).getByRole('button', { name: 'Not yet' }));
    expect(within(summary).queryByText('Staying a while?')).toBeNull();
    expect(row().mode).toBe('adventure');
    await answer(user, summary, 'No');
    await user.click(within(summary).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Depart' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name: /Start downtime/ })).toBeTruthy();
  });

  // Purpose: the summary's Start downtime is 6a's own (a full rest, then Downtime).
  it("Start downtime on the summary is 6a's: Downtime begins with its full rest", async () => {
    const { gm, row } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    const summary = await endExpedition(user);
    await answer(user, summary, 'Yes');
    await user.click(within(summary).getByRole('button', { name: 'Start downtime' }));
    expect(await screen.findByText('Downtime began')).toBeTruthy();
    expect(row().mode).toBe('downtime');
    expect(world.tables.events.filter((e) => e.type === 'downtime.start').length).toBeGreaterThan(0);
  });

  // Purpose (S19 follow-up): End's toast (6 s, with Undo) is taken down when downtime starts, so its Undo can't un-end
  // the expedition during downtime.
  it("Start downtime takes down End's toast", async () => {
    const { gm, row } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    const summary = await endExpedition(user);
    await screen.findByText(/^Expedition ended\. /, { selector: '.toast__text' });
    await answer(user, summary, 'Yes');
    await user.click(within(summary).getByRole('button', { name: 'Start downtime' }));
    expect(await screen.findByText('Downtime began')).toBeTruthy();
    expect(row().mode).toBe('downtime');
    await waitFor(() => expect(screen.queryByText(/^Expedition ended\. /, { selector: '.toast__text' })).toBeNull());
    expect(document.querySelector('.toast')).toBeNull();
  });

  // Purpose (S19, T11): End expedition shows its toast with Undo as well as the card; the card's Full rest is the
  // page's accent until the rest is taken, then Done is; after the rest the hurt character has a row with their hit
  // points and Heal; Done puts the card away.
  it('S19: the toast, the accent from Full rest to Done, the rows after the rest, and Done', async () => {
    const { gm } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    const summary = await endExpedition(user);
    const toast = (await screen.findByText(/^Expedition ended\. /, { selector: '.toast__text' })).closest('.toast') as HTMLElement;
    expect(within(toast).getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(within(summary).getByRole('button', { name: 'Full rest' }).className).toContain('button-primary');
    expect(within(summary).getByRole('button', { name: 'Done' }).className).not.toContain('button-primary');
    // One accent on the page: Depart is hidden while the card is up, the band's step is plain.
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    await user.click(within(summary).getByRole('button', { name: 'Full rest' }));
    await within(summary).findByText('Rest and day abilities are back.');
    expect(within(summary).getByRole('button', { name: 'Done' }).className).toContain('button-primary');
    const wren = (await within(summary).findByRole('button', { name: 'Heal Wren' })).closest('li') as HTMLElement;
    expect(wren.querySelector('.end-card__hp-words')?.textContent).toBe('4 of 6');
    await user.click(within(summary).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Expedition ended' })).toBeNull());
  });

  // Purpose: players see nothing new: no question, no offer, no Safe or hostile row, and the answer's own line isn't theirs.
  it('shows players nothing new', async () => {
    const { gm, sam } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await answer(user, await endExpedition(user), 'Yes');
    cleanup();
    const player = await openAs(sam);
    await player.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    await screen.findByRole('region', { name: 'Time' });
    expect(screen.queryByRole('group', { name: 'In a safe place?' })).toBeNull();
    expect(offer()).toBeNull();
    expect(screen.queryByRole('group', { name: 'Safe or hostile' })).toBeNull();
    // (The gate itself, a player with an ended expedition in hand, is tested in endCard.test.ts: no player screen can hold
    // one, so this test only shows the screen path; it would pass without the gate.)
    // S19: nothing of the end card reaches a player: no card, no Full rest, no Heal, no Done.
    expect(screen.queryByRole('region', { name: 'Expedition ended' })).toBeNull();
    expect(screen.queryByText('Expedition ended')).toBeNull();
    for (const name of [/^Full rest$/, /^Heal /, /^Done$/, /^Undo ending the expedition$/]) expect(screen.queryByRole('button', { name })).toBeNull();
  });
});
