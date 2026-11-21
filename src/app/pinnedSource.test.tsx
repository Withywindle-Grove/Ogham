// @vitest-environment jsdom
// A pinned copy names the pack it was pinned from (sn-1b, docs/design/rulings/dec-pinned-source-2026-11-13.md), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json ("Fen sample", meta id fen-sample, short name "Fen")
// and a second invented pack, "Mire conversion" (meta id mire-conversion, short name "Mire"), on top of it. The
// conversion carries, inside itself, its own Lantern Warden (mire-warden) and its own Bog folk (mire-bog-folk) and,
// beside each, a pinned copy of Fen's (same ids, `"pinnedFrom": "fen-sample"`), as the December conversion does.
// Every name and number is invented.
//   Creation's Kindred and Class rows: the pinned copy says "From Fen", the conversion's own "From Mire", and each
//   Pick names its pack.
//   The sheet's identity line: a character with the pinned class reads "Lantern Warden 1 (from Fen)".
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;
const had = window.matchMedia;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  // A phone's width (jsdom has no layout): matchMedia answers min-width and max-width queries for 375 px.
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || 375 >= Number(min[1])) && (!max || 375 <= Number(max[1])) && Boolean(min || max);
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
});

afterEach(() => {
  window.matchMedia = had;
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

/** Fen sample, and the Mire conversion on top with its own Lantern Warden and Bog folk beside pinned copies of Fen's. */
function pinnedWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { id: 'fen-sample', shortName: 'Fen' } });
  world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mire conversion', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { id: 'mire-conversion', shortName: 'Mire' } });
  const entry = (kind: string, data: Record<string, unknown>, packId = 'pack-fen') =>
    world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  const fenBog = pack.races!.find((r) => r.id === 'bog-folk')!;
  const bogWith = (r: Record<string, unknown>) => ({ ...r, classMaxLevels: { ...(r.classMaxLevels as object), 'mire-warden': 8 } });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const o of pack.options ?? []) entry('option', o);
  for (const r of pack.races!) entry('race', r.id === 'bog-folk' ? bogWith(r) : r);
  for (const c of pack.classes!) entry('class', c);
  for (const s of pack.spellLists ?? []) entry('spellList', s);
  for (const s of pack.spells ?? []) entry('spell', s);
  for (const t of pack.tables ?? []) entry('table', t);
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  // The conversion: a pinned copy of Fen's warden and bog folk (same ids, so they always mean Fen's), and its own of each.
  const warden = pack.classes!.find((c) => c.id === 'lantern-warden')!;
  entry('class', { ...warden, pinnedFrom: 'fen-sample' }, 'pack-mire');
  entry('class', { ...warden, id: 'mire-warden', blurb: 'A warden of the deep mire, with other rules.' }, 'pack-mire');
  entry('race', { ...bogWith(fenBog), pinnedFrom: 'fen-sample' }, 'pack-mire');
  entry('race', { ...bogWith(fenBog), id: 'mire-bog-folk', blurb: 'Folk of the deep mire, with other rules.' }, 'pack-mire');
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mire conversion', option_choices: {}, overrides: {}, priority: 2 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'omen' && f.key !== 'hp' && !f.from);
  layout.forEach((f, order) => {
    const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-10-18T12:00:00Z' });
  });
  return { gm, me, campaign };
}

/** Each pick row with this name: whether it is the conversion's own (its blurb says "deep mire"), its From line, its Pick's name. */
function rowsNamed(name: string) {
  return [...document.querySelectorAll('.pick-row')]
    .filter((r) => r.querySelector('.pick-row__name')?.textContent === name)
    .map((row) => ({
      own: row.querySelector('.pick-row__blurb')?.textContent?.includes('deep mire') ?? false,
      from: row.querySelector('.pick-row__from')?.textContent ?? null,
      pick: within(row as HTMLElement).queryAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))[0] ?? null,
    }))
    .sort((a, b) => Number(a.own) - Number(b.own));
}

describe('a pinned copy names the pack it was pinned from (sn-1b)', () => {
  // Purpose: inside one pack, the pinned copy reads "From Fen" (the pack it names) and the pack's own "From Mire", on
  // creation's Kindred and Class rows and in each Pick's name.
  it('creation: the pinned kindred and class say "From Fen", the conversion’s own "From Mire"', async () => {
    const { me, campaign } = pinnedWorld();
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user: User = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.click(await screen.findByRole('checkbox', { name: 'Pick Kindred, then calling' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Scores' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Kindred' });
    expect(rowsNamed('Bog folk')).toEqual([
      { own: false, from: 'From Fen', pick: 'Pick Bog folk (from Fen)' },
      { own: true, from: 'From Mire', pick: 'Pick Bog folk (from Mire)' },
    ]);
    await user.click(screen.getByRole('checkbox', { name: 'Pick Bog folk (from Fen)' }));
    await screen.findByRole('checkbox', { name: 'Pick Lantern Warden (from Fen)' });
    expect(rowsNamed('Lantern Warden')).toEqual([
      { own: false, from: 'From Fen', pick: 'Pick Lantern Warden (from Fen)' },
      { own: true, from: 'From Mire', pick: 'Pick Lantern Warden (from Mire)' },
    ]);
    // A class with no namesake is unchanged: no From line.
    const witch = [...document.querySelectorAll('.pick-row')].find((r) => r.querySelector('.pick-row__name')?.textContent === 'Reed Witch');
    expect(witch?.querySelector('.pick-row__from')).toBeNull();
  });

  // Purpose: the sheet's identity line names the pinned class's pack: the one it was pinned from.
  it('the sheet: a character with the pinned class reads "Lantern Warden 1 (from Fen)"', async () => {
    const { me, campaign } = pinnedWorld();
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: me, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
      level: 1,
      hp_current: 6,
      hp_max: 9,
      race_ref: 'mire-bog-folk',
      fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10 },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 120 }],
    });
    world.addMember(campaign, me, 'player', wren);
    world.signInAs(me);
    const user: User = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await screen.findByRole('region', { name: 'Vitals' });
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    expect(document.querySelector('.sheet__identity')?.textContent ?? '').toMatch(/Lantern Warden 1 \(from Fen\), Bog folk \(from Mire\)$/);
  });
});
