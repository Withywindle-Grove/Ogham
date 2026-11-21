// @vitest-environment jsdom
// Same-named entries show their source (sn-1; plan dec-1-creation 1d), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json ("Fen sample", short name "Fen") and, for the twin cases, a second invented pack
// ("Mire zine") with its own class called Lantern Warden (another id, other rules). Purpose:
//   Two same-named classes from two packs each show "From <pack's short name>" as the row's last line on creation's Class step.
//   A campaign with one setting shows no source for any race or class: nothing changes.
//   The sheet's class line reads "<class> <level> (from <pack>)" when another pack has a class of that name; else as before.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { RulesBrowser } from './RulesBrowser.tsx';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;
const had = window.matchMedia;

/** A window this many pixels wide (jsdom has no layout): matchMedia answers min-width and max-width queries. */
function windowOf(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && Boolean(min || max);
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  windowOf(375);
});

afterEach(() => {
  window.matchMedia = had;
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

/**
 * The fixture on a campaign, and Wren (a bog folk Lantern Warden from Fen sample) for Sam. With `twin`, a second pack,
 * Mire zine, is attached too, with its own Lantern Warden (id mire-warden) that bog folk may take.
 */
function fenWorld(twin: boolean) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen' } });
  const entry = (kind: string, data: Record<string, unknown>, packId = 'pack-fen') =>
    world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const o of pack.options ?? []) entry('option', o);
  for (const r of pack.races!) entry('race', twin && r.id === 'bog-folk' ? { ...r, classMaxLevels: { ...(r.classMaxLevels as object), 'mire-warden': 8 } } : r);
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
  if (twin) {
    world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mire zine, second printing', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Mire zine' } });
    const warden = pack.classes!.find((c) => c.id === 'lantern-warden')!;
    entry('class', { ...warden, id: 'mire-warden', blurb: 'A warden of the deep mire, with other rules.' }, 'pack-mire');
    world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mire zine, second printing', option_choices: {}, overrides: {}, priority: 2 });
  }
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'omen' && f.key !== 'hp' && !f.from);
  layout.forEach((f, order) => {
    const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-10-18T12:00:00Z' });
  });
  return { gm, me, campaign };
}

/** Sam with no character yet: guided creation to the Class step, as a bog folk. */
async function toClassStep(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await user.click(await screen.findByRole('checkbox', { name: 'Pick Kindred, then calling' }));
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Scores' });
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Kindred' });
}

/** Every pick row's name as shown, and its "From <pack>" line when it has one. */
const rowNames = () => [...document.querySelectorAll('.pick-row__name')].map((n) => n.textContent ?? '');
const fromLines = () => [...document.querySelectorAll('.pick-row__from')].map((n) => n.textContent ?? '');

describe('creation: same-named classes show their source (sn-1)', () => {
  // Purpose: two same-named classes from two packs each show "From <pack>" as the row's quiet last line (never a
  // middle dot, words rule 11), and each Pick names its pack.
  it('two Lantern Wardens, from Fen sample and Mire zine, each show "From <pack>" as the last line of the row', async () => {
    const { me, campaign } = fenWorld(true);
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toClassStep(user);
    // No kindred has a namesake: none shows a source.
    expect(fromLines()).toEqual([]);
    await user.click(screen.getByRole('checkbox', { name: 'Pick Bog folk' }));
    await screen.findByRole('checkbox', { name: 'Pick Lantern Warden (from Fen)' });
    expect(screen.getByRole('checkbox', { name: 'Pick Lantern Warden (from Mire zine)' })).toBeTruthy();
    // The name itself is unchanged; the source is its own line.
    expect(rowNames().filter((n) => n === 'Lantern Warden')).toHaveLength(2);
    // Each row names its own pack: Mire zine's warden (the one with its own blurb) says Mire zine, on its line and its Pick.
    const wardens = [...document.querySelectorAll('.pick-row')].filter((r) => r.querySelector('.pick-row__name')?.textContent === 'Lantern Warden');
    const sourceOf = (row: Element) => ({
      mire: row.querySelector('.pick-row__blurb')?.textContent?.includes('deep mire') ?? false,
      from: row.querySelector('.pick-row__from')?.textContent,
      fenPick: within(row as HTMLElement).queryByRole('checkbox', { name: 'Pick Lantern Warden (from Fen)' }) !== null,
      mirePick: within(row as HTMLElement).queryByRole('checkbox', { name: 'Pick Lantern Warden (from Mire zine)' }) !== null,
    });
    expect(wardens.map(sourceOf).sort((a, b) => Number(a.mire) - Number(b.mire))).toEqual([
      { mire: false, from: 'From Fen', fenPick: true, mirePick: false },
      { mire: true, from: 'From Mire zine', fenPick: false, mirePick: true },
    ]);
    expect(document.body.textContent).not.toContain(' · ');
    // Francis, from the picture (2026-11-12): the From line is the row's last line, under the one-line description.
    for (const from of document.querySelectorAll('.pick-row__from')) {
      const blurb = from.parentElement?.querySelector('.pick-row__blurb');
      expect(blurb).toBeTruthy();
      expect(blurb!.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(from.parentElement?.lastElementChild).toBe(from);
    }
    // A class with no namesake is as it was: its row has no From line.
    const witch = [...document.querySelectorAll('.pick-row')].find((r) => r.querySelector('.pick-row__name')?.textContent === 'Reed Witch');
    expect(witch?.querySelector('.pick-row__from')).toBeNull();
  });

  // Purpose: a campaign with one setting shows no source for any kindred or class.
  it('with one setting, no kindred or class shows a source', async () => {
    const { me, campaign } = fenWorld(false);
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toClassStep(user);
    expect(fromLines()).toEqual([]);
    await user.click(screen.getByRole('checkbox', { name: 'Pick Bog folk' }));
    await screen.findByRole('checkbox', { name: 'Pick Lantern Warden' });
    expect(fromLines()).toEqual([]);
    expect(rowNames()).toContain('Lantern Warden');
  });
});

describe('the Rules browser: same-named entries show their source (sn-1)', () => {
  const stack = [
    { id: 'link-a', packId: 'example-a', name: 'Fen rules, full edition', shortName: 'Fen rules', priority: 2, kind: 'setting' as const, overrides: {} },
    { id: 'link-b', packId: 'example-b', name: 'Mire zine, second printing', shortName: 'Mire zine', priority: 1, kind: 'setting' as const, overrides: {} },
  ];
  const e = (kind: 'class' | 'race', packEntryId: string, name: string, packId: string) => ({ kind, packEntryId, name, packId, data: { name } });
  const rows = () => [...document.querySelectorAll('.rules-browser__entry')].map((r) => [...r.querySelectorAll('span')].map((s) => s.textContent).join(' / '));

  // Purpose: in the list, each of two same-named classes has its pack as a second line under its name.
  it('two Lantern Wardens each show "From <pack>" under the name', () => {
    render(<RulesBrowser gm={false} stack={stack} entries={[e('class', 'lantern-warden', 'Lantern Warden', 'example-a'), e('class', 'mire-warden', 'Lantern Warden', 'example-b'), e('class', 'reed-witch', 'Reed Witch', 'example-a')]} />);
    expect(rows().slice(0, 2)).toEqual(['Lantern Warden / From Fen rules, full edition', 'Lantern Warden / From Mire zine, second printing']);
  });

  // Purpose: the same id in two packs is one entry (the pack on top wins), listed once.
  it('the same class id in two packs is listed once', () => {
    render(<RulesBrowser gm={false} stack={stack} entries={[e('class', 'lantern-warden', 'Lantern Warden', 'example-a'), e('class', 'lantern-warden', 'Lantern Warden', 'example-b')]} />);
    expect(rows()).toHaveLength(1);
  });
});

describe('the sheet: the class line shows its source only with a namesake (sn-1)', () => {
  function withWren(twin: boolean) {
    const { me, campaign } = fenWorld(twin);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: me, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
      level: 1,
      hp_current: 6,
      hp_max: 9,
      race_ref: 'bog-folk',
      fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10 },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 120 }],
    });
    world.addMember(campaign, me, 'player', wren);
    world.signInAs(me);
  }

  async function identityLine() {
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await screen.findByRole('region', { name: 'Vitals' });
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    return document.querySelector('.sheet__identity')?.textContent ?? '';
  }

  // Purpose: with a second pack's Lantern Warden in play, Wren's class line names her class's pack.
  it('with a twin class in another pack, the class line reads "Lantern Warden 1 (from Fen)", the pack\'s short name', async () => {
    withWren(true);
    const line = await identityLine();
    expect(line).toMatch(/Lantern Warden 1 \(from Fen\), Bog folk$/);
    expect(line).not.toContain('Fen sample');
  });

  // Purpose: with one setting the line is exactly as before.
  it('with one setting, the class line has no source', async () => {
    withWren(false);
    const line = await identityLine();
    expect(line).toMatch(/Lantern Warden 1, Bog folk$/);
    expect(document.querySelector('.sheet__identity .name-from')).toBeNull();
  });
});
