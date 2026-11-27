// @vitest-environment jsdom
// sf-3 with ⚑ 4 (plan dec-scene-feedback; page 44, EN1, PS2 B and C, EN7 A, approved 2026-11-26): the encounter's one
// mark, and the two encounter rows gone from the Scene. Clicked through like a person would, against the stand-in
// database. Invented rules only.
//   The crossed swords from the icon set are the encounter's mark on the band's button, on the Facts row's tile and on
//   the players' revealed card: one icon, named once.
//   During an expedition no encounter row stands on the Scene: no "Encounter tables ›" row, and no "<title>, nothing
//   due" line; the step's toast says "nothing due" instead.
//   "Encounter tables" is the first item of the band's ⋯ menu during an expedition, and opens the tables.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import type { Fact } from '../modules/expedition/sceneTop.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { startExpedition } from '../testing/depart.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { Root } from './App.tsx';
import { RevealedCard } from './CallCard.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { ENCOUNTER_MARK, FactsRow } from './SceneBand.tsx';

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

afterEach(cleanup);

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  return { gm, campaign };
}

/** Invented setting rules: a creeping mode whose wandering check, every 2 turns, rolls one of two tables. */
function withSetting(campaign: string, gm: string) {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    exploration: {
      modes: [
        {
          id: 'creep',
          name: 'Creeping',
          step: { value: 1, unit: 'turn' },
          procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
          checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: { tableChoices: ['shallows', 'deeps'] } }],
        },
      ],
    },
  });
  entry('table', 'shallows', 'Shallow things', { die: 'd6', rows: [{ min: 1, max: 3, result: 'Bog lurkers' }, { min: 4, max: 6, result: 'Reed wraith' }] });
  entry('table', 'deeps', 'Deep things', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Lantern eels' }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

async function openScene(who: string) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Scene' }));
  await screen.findByRole('heading', { name: 'No session yet' });
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Session 1.');
  return user;
}

/** The one path an icon draws: the set's filled shape (its `d`), or null for anything else. */
const pathOf = (scope: Element | null) => scope?.querySelector('svg.icon--filled path')?.getAttribute('d') ?? null;

/** A toast's words, wherever it stands. */
const toastTexts = () => Array.from(document.querySelectorAll('.toast')).map((t) => t.textContent ?? '');

describe('the encounter mark (⚑ 1)', () => {
  // Purpose: the Facts row's Encounter check tile, the band's Encounter check button and the players' revealed card all
  // draw the icon set's crossed swords, named once, so the encounter has one mark wherever it shows.
  it("the tile, the band's button and the players' card draw the same crossed swords", async () => {
    expect(ENCOUNTER_MARK).toBe('crossed-swords');
    const swords = ICON_SET['crossed-swords'].d;

    const check: Fact = { id: 'check', label: 'Encounter check', value: 'On every move', sub: '1 in 6', state: 'quiet', warn: false, die: 'd6' };
    const facts = render(<FactsRow facts={[check]} onOpen={() => undefined} />);
    expect(pathOf(screen.getByRole('button', { name: /^Encounter check/ }).querySelector('.scene-fact__icon'))).toBe(swords);
    facts.unmount();

    const card = render(<RevealedCard reveal={{ id: 'reveal-1', words: 'Two grey shapes rise from the weed.', shownAt: '2026-11-26T12:00:00Z' }} onGotIt={() => undefined} />);
    expect(pathOf(card.container)).toBe(swords);
    card.unmount();

    const { gm } = table();
    const user = await openScene(gm);
    await startExpedition(user);
    expect(pathOf(await screen.findByRole('button', { name: 'Encounter check' }))).toBe(swords);
  });
});

describe('no encounter row on the Scene (⚑ 4)', () => {
  // Purpose: in the setting's own mode, during an expedition, the Scene draws no "Encounter tables ›" row, open or after
  // a turn; a turn that brings nothing leaves no "<title>, nothing due" line, and its toast says "nothing due".
  it("in the setting's mode: no tables row, no 'nothing due' line, and the step's toast says it", async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    expect(screen.queryByRole('button', { name: /^Encounter tables/ })).toBeNull();
    expect(document.querySelector('.encounter-row, .encounter-row__none')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' });
    await waitFor(() => expect(toastTexts().some((t) => /, nothing due\./.test(t))).toBe(true));
    expect(screen.queryByText(/, nothing due$/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Encounter tables/ })).toBeNull();
  });

  // Purpose: the band's Encounter check, answered with a miss, leaves no "Encounter check, nothing due" line on the
  // Scene: the miss's own toast says what came of it.
  it("after the band's Encounter check and a miss, no 'Encounter check, nothing due' line", async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm);
    await startExpedition(user);
    await user.click(await screen.findByRole('button', { name: 'Encounter check' }));
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    await user.click(due.getByRole('button', { name: 'Miss, Wandering things, now' }));
    await waitFor(() => expect(toastTexts().some((t) => t.startsWith('Wandering things, now: a miss'))).toBe(true));
    expect(screen.queryByText('Encounter check, nothing due')).toBeNull();
    expect(screen.queryByText(/, nothing due$/)).toBeNull();
  });

  // Purpose: in the fallback mode (no setting rules: Dungeon, no checks) the Scene has no encounter row either, and its
  // turn's toast says "nothing due".
  it('in the fallback mode with no setting: no tables row and no nothing-due line', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    expect(document.querySelector('.encounter-row, .encounter-row__none')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' });
    await waitFor(() => expect(toastTexts().some((t) => /, nothing due\./.test(t))).toBe(true));
    expect(screen.queryByText(/, nothing due$/)).toBeNull();
    expect(document.querySelector('.encounter-row, .encounter-row__none')).toBeNull();
  });
});

describe('"Encounter tables" in the ⋯ menu (⚑ 4; EN7 A)', () => {
  // Purpose: during an expedition the band's ⋯ menu lists "Encounter tables" first, and a tap opens the Encounter
  // tables screen (the library still at its foot).
  it('is the first item during an expedition, and opens the tables', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm);
    await startExpedition(user);
    await user.click(await screen.findByRole('button', { name: 'Time options' }));
    const items = Array.from(document.querySelectorAll('.more-menu__item'));
    expect(items[0]?.textContent).toBe('Encounter tables');
    await user.click(items[0]!);
    const tables = within(await screen.findByRole('dialog', { name: 'Encounter tables' }));
    expect(tables.getByRole('button', { name: /^Shallow things/ })).toBeTruthy();
    expect(tables.getByRole('button', { name: 'Table library ›' })).toBeTruthy();
  });

  // Purpose: with no tables in the setting, the item is still there and still opens the screen, which says why it is
  // empty (never a button that does nothing).
  it('with no tables, still opens the screen, which says there are none', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    await startExpedition(user);
    await user.click(await screen.findByRole('button', { name: 'Time options' }));
    await user.click(document.querySelectorAll('.more-menu__item')[0]!);
    expect(within(await screen.findByRole('dialog', { name: 'Encounter tables' })).getByText(/No encounter tables in this setting/)).toBeTruthy();
  });

  // Purpose: between expeditions the ⋯ menu holds no "Encounter tables" (the band's "Table library ›" stays the way to
  // the tables then, as built).
  it('is not in the menu between expeditions', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm);
    expect(await screen.findByRole('button', { name: 'Table library ›' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(Array.from(document.querySelectorAll('.more-menu__item')).map((i) => i.textContent)).not.toContain('Encounter tables');
  });
});
