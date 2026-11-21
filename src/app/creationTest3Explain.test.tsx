// @vitest-environment jsdom
// Explain and pick, the third creation test's PR I (M5b step 0c; plan "Follow-up to the third test", ruling
// design/rulings/m5b-0c-creation-test-3-2026-11-03.md ct3-9, ct3-11), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   No figure on the sheet shows without a breakdown: every value a field shows from the rules, and every figure no
//   field shows, is a button that opens its own lines; the "How it's worked out" link is gone (ct3-9).
//   A tapped birth omen (the fixture's moon sign) opens its entry: what it is, what it does, source and page; so do the
//   kindred, the calling, the alignment and each language the list has (ct3-11).
//   On the creation review the same values open their entries (ct3-11).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

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
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };
const layoutFields = pack.fieldTemplates![0]!.fields as LayoutField[];

/** The fixture on a campaign with the birth omens on, its fields as the importer makes them. */
function fenWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  for (const o of pack.options!.filter((o) => o.id === 'fen-omens')) entry('option', o);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: { 'fen-omens': 'on' }, overrides: {}, priority: 1 });
  layoutFields
    .filter((f) => f.key !== 'hp')
    .forEach((f, order) => {
      const fromList = f.from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.from) ? f.from : null;
      const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
    });
  world.signInAs(me);
  return { gm, me, campaign };
}

/** A bog folk warden with an omen, a background, a leaning and languages (one the list doesn't have), on the sheet. */
function withWarden() {
  const { me, campaign } = fenWorld();
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === reed)!, {
    level: 1,
    race_ref: 'bog-folk',
    fields: { MUS: 9, NIM: 9, GRT: 9, WIT: 9, LORE: 13, CHARM: 9, omen: 'heron-at-dawn', background: 'Eel catcher', languages: 'Fen common, Old lantern, Marsh whistle', motto: 'Light first' },
    creation: { scores: { MUS: 9, NIM: 9, GRT: 9, WIT: 9, LORE: 13, CHARM: 9 } },
    classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
  });
  world.tables.character_alignments.push({ actor_id: reed, campaign_id: campaign, owner_user_id: me, alignment: 'Lantern', created_at: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.members.find((m) => m.user_id === me && m.campaign_id === campaign)!.active_actor_id = reed;
  return reed;
}

async function openSheet(): Promise<User> {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Character options' }));
  await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
  // The Combat block is gone (plan m5b-sheet-revised A1); the sheet is open once its Level row is there.
  await screen.findByRole('region', { name: 'Level' });
  return user;
}

const worked = /: how it's worked out$/;

describe("every worked-out figure opens its breakdown (ct3-9)", () => {
  it('no figure on the sheet shows without a breakdown', async () => {
    // Purpose: every value a field shows from the rules, and every figure no field shows, is tappable and opens at
    // least one line saying how it's worked out; the separate link is gone.
    withWarden();
    const user = await openSheet();
    expect(screen.queryByRole('button', { name: "How it's worked out" })).toBeNull();
    const fills = new Map(layoutFields.filter((f) => f.fill && f.key !== 'ac' && f.key !== 'attack').map((f) => [f.label, f.fill!]));
    // The details are the ledger's rows now (plan m5b-sheet-revised A2: look A, a dl of label and value).
    const cells = [...document.querySelectorAll('.sheet__ledger-row')] as HTMLElement[];
    const figureCells = cells.filter((c) => fills.has(c.querySelector('dt')?.textContent ?? ''));
    // The saves are tiles (plan m5b-players-screens-standard D), each opening its breakdown sheet (checked below).

    // The left column's AC and Attack tiles (the Combat block and its figure tiles are gone; plan A1, A3).
    const figureTiles = [...document.querySelectorAll<HTMLElement>('.sheet__vitals .stat-tile--tap')];
    expect(figureTiles).toHaveLength(2);
    expect(figureCells.length + figureTiles.length).toBeGreaterThanOrEqual(2);
    for (const tile of figureTiles) {
      expect(tile.getAttribute('aria-label')).toMatch(worked);
      await user.click(tile);
      const dialog = within(await screen.findByRole('dialog'));
      expect(dialog.getAllByText(/\S/, { selector: 'p.reading' }).length).toBeGreaterThan(0);
      await user.click(dialog.getAllByRole('button', { name: 'Close' })[0]!);
    }
    for (const cell of figureCells) {
      const value = cell.querySelector('dd')?.textContent ?? '';
      if (value === '—') continue;
      const label = cell.querySelector('dt')?.textContent ?? '';
      const button = within(cell).getByRole('button', { name: worked });
      await user.click(button);
      const dialog = within(await screen.findByRole('dialog', { name: label }));
      expect(dialog.getAllByText(/\S/, { selector: 'p.reading' }).length).toBeGreaterThan(0);
      await user.click(dialog.getByRole('button', { name: 'Close' }));
    }
    const saves = within(screen.getByRole('region', { name: 'Saves' })).getAllByRole('button');
    expect(saves.length).toBeGreaterThan(0);
    for (const tile of saves) {
      await user.click(tile);
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.getAllByText(/\S/, { selector: 'p.reading' }).length).toBeGreaterThan(0);
      await user.click(dialog.getAllByRole('button', { name: 'Close' })[0]!);
    }
    // Hark, under Skills (sr-2) as the pack writes it ("6+", equal-or-over; heard "6+ on d6", C14) with what the kindred
    // says beside it as its tag; its pop-up says only what succeeds and what to roll (tfs-1, 2026-11-19): no "Base
    // chance for everyone", and the kindred's words stay on the row, not in the pop-up.
    await user.click(within(screen.getByRole('region', { name: 'Skills' })).getByRole('button', { name: 'Hark, 4 when wading 6+ on d6: where it comes from' }));
    const hark = within(await screen.findByRole('dialog', { name: 'Hark' }));
    expect(hark.getByText('Succeeds on a 6+,')).toBeTruthy();
    expect(hark.queryByText(/Base chance for everyone/)).toBeNull();
    expect(hark.queryByText('Bog folk: 4 when wading.')).toBeNull();
  });
});

describe('every pack-list value opens its entry (ct3-11)', () => {
  it('a tapped moon sign opens its entry: what it is, what it does, source and page', async () => {
    // Purpose: the omen on the sheet is a button that opens the list's entry, with the pack and page.
    withWarden();
    const user = await openSheet();
    await user.click(screen.getByRole('button', { name: 'Heron at dawn: open its entry' }));
    const entry = within(await screen.findByRole('dialog', { name: 'Heron at dawn' }));
    expect(entry.getByText('Patient; waits out any ambush.')).toBeTruthy();
    expect(entry.getByText('Birth omens')).toBeTruthy();
    expect(entry.getByText('1–2 on d4')).toBeTruthy();
    await user.click(entry.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog', { name: 'Heron at dawn' })).toBeNull();
  });

  it('the kindred, the calling, the alignment, the background and each listed language open their entries; a motto and a typed language stay words', async () => {
    // Purpose: every value from a pack list is tappable; free text never is.
    withWarden();
    const user = await openSheet();
    // The alignment is a Traits row now (plan m5b-sheet-revised A2: "Leaning Lantern"), the rest are as before.
    for (const [name, button] of [['Bog folk', 'Bog folk: open its entry'], ['Lantern Warden', 'Lantern Warden: open its entry'], ['Lantern', 'Leaning Lantern'], ['Eel catcher', 'Eel catcher: open its entry'], ['Fen common', 'Fen common: what it is'], ['Old lantern', 'Old lantern: what it is']] as const) {
      await user.click(screen.getAllByRole('button', { name: button })[0]!);
      const entry = within(await screen.findByRole('dialog', { name }));
      await user.click(entry.getByRole('button', { name: 'Got it' }));
    }
    expect(screen.queryByRole('button', { name: /^Marsh whistle/ })).toBeNull();
    expect(screen.getByText('Marsh whistle')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Light first/ })).toBeNull();
  });
});
