// @vitest-environment jsdom
// Creation's Kindred and Class steps list their rows alphabetically, whatever pack each comes from (cs-38,
// docs/design/rulings/dec-creation-order-and-closed-patrons-2026-11-13.md). Two invented packs: the fixture's Fen
// sample and a small Reed sample, each with a kindred called "Bog folk" and a class called "Lantern Warden".
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetAllKept } from './keptCreation.ts';

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
  forgetAllKept();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

/** The second pack: a kindred named as one of Fen's, one before it, and three classes, one named as one of Fen's. */
const REED = {
  races: [
    { id: 'reed-ash-kin', name: 'Ash kin', blurb: 'Grey from the old fires.' },
    { id: 'reed-bog-folk', name: 'Bog folk', blurb: 'Reed-born and quiet.', classMaxLevels: { 'lantern-warden': 8, 'reed-lantern-warden': 8 } },
  ],
  classes: [
    { id: 'reed-adder-priest', name: 'Adder Priest', blurb: 'Speaks for the coiled one.', hitDie: 'd6' },
    { id: 'reed-lantern-warden', name: 'Lantern Warden', blurb: 'Keeps the reed lamps.', hitDie: 'd8' },
    { id: 'reed-cinder-monk', name: 'Cinder Monk', blurb: 'Walks the ash roads.', hitDie: 'd8' },
  ],
};

/** Fen sample (the fixture, first in the stack) and Reed sample, attached to one campaign. */
function twoPackWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  const addPack = (packId: string, name: string, priority: number) => {
    world.tables.packs.push({ id: packId, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: name } });
    world.tables.campaign_packs.push({ id: `link-${packId}`, campaign_id: campaign, pack_id: packId, pack_name: name, option_choices: {}, overrides: {}, priority });
  };
  const entry = (packId: string, kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name), data });
  addPack('pack-fen', 'Fen sample', 2);
  addPack('pack-reed', 'Reed sample', 1);
  for (const r of pack.rulesSets!) entry('pack-fen', 'rulesSet', r);
  for (const r of pack.races!) entry('pack-fen', 'race', r);
  for (const c of pack.classes!) entry('pack-fen', 'class', c);
  for (const r of REED.races) entry('pack-reed', 'race', r);
  for (const c of REED.classes) entry('pack-reed', 'class', c);
  let order = 0;
  for (const key of ['MUS', 'NIM', 'GRT', 'WIT', 'LORE', 'CHARM']) {
    world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label: key, type: 'number', choices: [], field_group: 'Abilities', sort_order: order++, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  }
  world.signInAs(me);
}

async function toKindred(): Promise<User> {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  for (const [label, value] of [['Nimbleness', '8'], ['Grit', '8']] as const) {
    const field = screen.getByLabelText(label);
    await user.clear(field);
    await user.type(field, value);
  }
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kindred');
  return user;
}

/** The names shown on the rows directly in a container (not those in its fold), in order. */
const namesOf = (rows: readonly Element[]) => rows.map((row) => row.querySelector('.pick-row__name')?.textContent?.trim() ?? '');
const openRows = (group: HTMLElement) => [...group.children].filter((el) => el.classList.contains('pick-row'));
const foldedRows = (group: HTMLElement) => [...group.querySelectorAll('details .pick-row')];
/** The row whose blurb is this. */
const rowWith = (blurb: string) => screen.getByText(blurb).closest('.pick-row') as HTMLElement;

describe('creation lists kindreds and classes alphabetically (cs-38)', () => {
  it('the Kindred step lists every kindred alphabetically across both packs; the two called Bog folk sit together, the pack higher in the stack first', async () => {
    twoPackWorld();
    await toKindred();
    const group = screen.getByRole('group', { name: 'Races' });
    const rows = [...openRows(group), ...foldedRows(group)];
    expect(namesOf(rows)).toEqual(['Ash kin', 'Bog folk', 'Bog folk', 'Stone kin']);
    // Between the two Bog folk, the stack order: Fen sample is above Reed sample.
    expect(rows[1]).toBe(rowWith('Short, damp and hard to drown.'));
    expect(rows[2]).toBe(rowWith('Reed-born and quiet.'));
  });

  it('the Class step lists its open classes alphabetically, the two called Lantern Warden together, and the closed ones alphabetically in the fold after them', async () => {
    twoPackWorld();
    const user = await toKindred();
    // Reed's Bog folk lists two classes: both Lantern Wardens are open, the rest are closed to it.
    await user.click(within(rowWith('Reed-born and quiet.')).getByRole('checkbox'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Class' })).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Classes' });
    const open = openRows(group);
    expect(namesOf(open)).toEqual(['Lantern Warden', 'Lantern Warden']);
    expect(open[0]).toBe(rowWith('Keeps the light alive and the dark at bay.'));
    expect(open[1]).toBe(rowWith('Keeps the reed lamps.'));
    // The closed classes keep their place, folded after the open ones, alphabetical there across both packs.
    expect(namesOf(foldedRows(group))).toEqual(FOLDED);
  });

  it("a kindred's entry keeps its classes in the order it had: only the steps' rows are sorted", async () => {
    twoPackWorld();
    const user = await toKindred();
    await user.click(within(rowWith('Short, damp and hard to drown.')).getByRole('button', { name: /^Bog folk/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Bog folk' });
    const chips = [...sheet.querySelectorAll('.chip')].map((el) => el.textContent?.trim() ?? '').filter(Boolean);
    expect(chips).toEqual(ENTRY_CHIPS);
  });
});

/** Reed's Bog folk on the Class step: every class it doesn't list, from both packs, closed and folded, alphabetical. */
const FOLDED = ['Adder Priest', 'Cinder Monk', 'Fen Cantor', 'Marsh Chaplain', 'Reed Witch'];

/** The class chips on Fen's Bog folk entry as main showed them before cs-38 (unchanged by it). */
const ENTRY_CHIPS = ['Lantern Warden (to 8)', 'Reed Witch (to 6)', 'Mire Stalker (to 10)', 'Marsh Chaplain (to 8)', 'Fen Cantor (to 6, with the GM’s leave)'];
