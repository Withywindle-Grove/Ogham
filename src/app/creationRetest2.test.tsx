// @vitest-environment jsdom
// Francis's second creation retest (2026-11-07, rulings via Design), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Purpose:
//   Rows needing the GM's approval start folded under one row, "N more need the GM's approval", after the open rows.
//   Adjust shows its tiles and no scores strip; the strip stays on Class (cr-10).
//   A name table's sheet opens with its own die's instruction, "Roll d6 for each part, then tap the row. Or type your
//   own above.", never a hard-coded d20.
//   A traded tile on Adjust says what it was ("was 12") under its value, before the modifier line (Design on #555).
//   Languages' fold names both kinds when the never-learnable rows fold with the approval ones (Design on #555).
//   Every roll has its Roll row (the audit): a table sheet whose pack names no die still opens with one ("Roll on the
//   table, then mark your row."; cts-5 c and cts-8, 2026-11-19, where it read "then tap the row"), with no glyph, and a
//   die it names draws its glyph.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { OneTableSheet } from './KindredTables.tsx';
import { tableOf } from '../modules/characters/kindredTables.ts';
import { languageFoldLabel } from '../ui/creation.tsx';
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
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => cleanup());

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };

/** The fixture on a campaign (as creationFinalC.test.tsx sets it up). */
function fenWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const o of pack.options ?? []) entry('option', o);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const s of pack.spellLists ?? []) entry('spellList', s);
  for (const s of pack.spells ?? []) entry('spell', s);
  for (const t of pack.tables ?? []) entry('table', t);
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'omen');
  layout.forEach((f, order) => {
    const fromList = f.key === 'background' ? 'fen-backgrounds-bog-folk' : null;
    const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
  });
  world.signInAs(me);
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';

/** Guided creation to the Class step as stone kin (whose list of classes leaves some out). */
async function toClass(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Kindred, then calling' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Scores' });
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Stone kin' }));
  await screen.findByRole('heading', { name: /Class|Calling/ });
}

describe('creation retest 2 (Francis, 2026-11-07)', () => {
  it('the classes needing the GM’s approval start folded under one row, after the open ones', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toClass(user);
    const list = screen.getByRole('group', { name: 'Classes' });
    const fold = list.querySelector('details.creation-fold') as HTMLDetailsElement | null;
    expect(fold).not.toBeNull();
    // Folded, with its count in words.
    expect(fold!.open).toBe(false);
    const inside = fold!.querySelectorAll('.pick-row').length;
    expect(inside).toBeGreaterThan(0);
    expect(within(fold!.querySelector('summary')!).getByText(new RegExp(`^${inside} more needs? the GM's approval$`))).toBeTruthy();
    // The closed class is inside the fold; the open one comes before it, outside.
    expect(fold!.textContent).toContain('Reed Witch');
    const warden = within(list).getByRole('button', { name: /^Lantern Warden/ });
    expect(fold!.contains(warden)).toBe(false);
    expect(warden.compareDocumentPosition(fold!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Adjust shows its tiles and no scores strip; Class keeps the strip', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toClass(user);
    expect(document.querySelector('.scores-strip')).not.toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }));
    await screen.findByRole('heading', { name: 'Adjust scores' });
    expect(document.querySelector('.scores-strip')).toBeNull();
    expect(document.querySelectorAll('.score-tiles > *').length).toBeGreaterThan(0);
    // No tile says "was" before a trade.
    expect(document.querySelector('.score-tile__was')).toBeNull();
    // Lower a score: its tile says what it was, under the value and before the modifier line.
    const lower = screen.getAllByRole('button', { name: /^Lower / })[0]!;
    const tile = lower.closest('.score-tile')!;
    const before = Number(tile.querySelector('.score-tile__now')!.textContent);
    await user.click(lower);
    const was = tile.querySelector('.score-tile__was');
    expect(was?.textContent).toBe(`was ${before}`);
    expect(tile.querySelector('.score-tile__value')!.compareDocumentPosition(was!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(was!.compareDocumentPosition(tile.querySelector('.score-tile__words')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Languages’ fold names both kinds, one, or only the approvals', () => {
    expect(languageFoldLabel(3, true, 1, 2)).toBe("3 more: not open to your kind, or need the GM's approval");
    expect(languageFoldLabel(2, true, 2, 0)).toBe('2 more: not open to your kind');
    expect(languageFoldLabel(1, false, 0, 1)).toBe("1 needs the GM's approval");
  });

  it('a name table’s sheet opens with its own die’s instruction (R3-2: no prompt in the pack, the die only)', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toClass(user);
    await user.click(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }));
    if (heading() === 'Adjust scores') await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const sheet = screen.getByRole('dialog', { name: 'Stone kin names' });
    const first = sheet.querySelector('.roll-row');
    expect(first?.textContent).toBe('Roll d6, then tap the rows.');
    expect(first?.querySelector('svg')).not.toBeNull();
  });

  it('a table sheet always opens with its Roll row: the die’s glyph when the pack names one, the words alone when not', () => {
    const rows = [1, 2, 3, 4].map((n) => ({ min: n, max: n, result: `Odd find ${n}` }));
    const bare = tableOf({ packEntryId: 'odd-finds', name: 'Odd finds', data: { rows } })!;
    render(<OneTableSheet table={bare} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    const first = screen.getByRole('dialog').querySelector('.roll-row');
    expect(first?.textContent).toBe('Roll on the table, then mark your row.');
    expect(first?.querySelector('svg')).toBeNull();
    cleanup();
    const d4 = tableOf({ packEntryId: 'odd-finds-d4', name: 'Odd finds', data: { die: 'd4', rows } })!;
    render(<OneTableSheet table={d4} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    const glyphed = screen.getByRole('dialog').querySelector('.roll-row');
    expect(glyphed?.textContent).toBe('Roll d4, then mark your row.');
    expect(glyphed?.querySelector('svg')).not.toBeNull();
  });
});
