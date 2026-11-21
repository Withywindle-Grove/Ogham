// @vitest-environment jsdom
// A race's optional abilities behind an option, its save bonus by CON and its skill target in a situation, where the
// player sees them (07 Races; the creation surveys' follow-up, 2026-11-03). On the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json (stone kin gain a LORE +1 and "Causeway memory" with kin callings on) and
// an invented setting with a CON score. Every name and number is invented.
//   With kin callings on, the stone kin's entry pop-up shows the score change and the extra ability, and the loaded
//   setting's stone kin carry them; with it off, neither shows.
//   A moss kin with CON 12 has "+2 to the roll vs rot" beside their Rot save on the sheet's field, "+2 to the roll"
//   beside the Mire save in From your setting and in the Player screen's save pop-up; their 4 when wading beside Delve.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { savesOf, skillsOf } from '../modules/characters/play.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting, loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { characterFigures, unclaimed } from './fromSetting.ts';

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

/** The fixture on a campaign with kin callings as given, its fields as the importer makes them. */
function fenWorld(kinCallings: 'on' | 'off') {
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
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  for (const o of pack.options!.filter((o) => o.id === 'fen-kin-callings')) entry('option', o);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: { 'fen-kin-callings': kinCallings }, overrides: {}, priority: 1 });
  layoutFields
    .filter((f) => f.key !== 'hp')
    .forEach((f, order) => {
      const fromList = f.from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.from) ? f.from : null;
      const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
    });
  world.signInAs(me);
  return { me, campaign };
}

/** Scores, then the Kindred step, then the stone kin's entry pop-up. */
async function stoneKinPopUp(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Kindred' });
  await user.click(screen.getByRole('button', { name: /^Stone kin/ }));
  return within(await screen.findByRole('dialog', { name: 'Stone kin' }));
}

describe('optional abilities behind an option (07 Races, optionalAbilities)', () => {
  it('with kin callings on, the stone kin show the LORE change and Causeway memory, and the setting carries them', async () => {
    const { me, campaign } = fenWorld('on');
    const sheet = await stoneKinPopUp(renderApp());
    expect(sheet.getByText(/Causeway memory/)).toBeTruthy();
    expect(sheet.getByText(/LORE \+1|Lore \+1/)).toBeTruthy();
    forgetCampaignSetting();
    const setting = await loadCampaignSetting(world.db, me, campaign);
    const stoneKin = setting!.all.find((e) => e.kind === 'race' && e.packEntryId === 'stone-kin')!;
    expect(stoneKin.data.abilityModifiers).toEqual({ LORE: 1 });
  });

  it('with kin callings off, neither shows', async () => {
    fenWorld('off');
    const sheet = await stoneKinPopUp(renderApp());
    expect(sheet.queryByText(/Causeway memory/)).toBeNull();
    expect(sheet.queryByText(/LORE \+1|Lore \+1/)).toBeNull();
  });
});

// bq2-1 (2026-11-03): a race's byOption may change any of its fields, abilityModifiers included, read by the shared
// option reader (of-3). An invented byOption on the bog folk: CHARM +1 while kin callings are on.
function withBogFolkCharm() {
  const row = world.tables.library_entries.find((e) => e.kind === 'race' && e.pack_entry_id === 'bog-folk')!;
  row.data = { ...(row.data as Record<string, unknown>), byOption: { 'fen-kin-callings=on': { abilityModifiers: { CHARM: 1 } } } };
}

/** Scores, then the Kindred step, then the bog folk's entry pop-up. */
async function bogFolkPopUp(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Kindred' });
  await user.click(screen.getByRole('button', { name: /^Bog folk/ }));
  return within(await screen.findByRole('dialog', { name: 'Bog folk' }));
}

describe("a race's byOption changing its score changes (bq2-1)", () => {
  // Purpose: with the option on, the race entry shows the changed score changes (its own kept), and the setting's race
  // (which the score strip and the sheet read) carries them.
  it('with the choice on, the bog folk show CHARM +1 beside their own changes', async () => {
    const { me, campaign } = fenWorld('on');
    withBogFolkCharm();
    const sheet = await bogFolkPopUp(renderApp());
    expect(sheet.getByText(/CHARM \+1|Charm \+1/)).toBeTruthy();
    forgetCampaignSetting();
    const setting = await loadCampaignSetting(world.db, me, campaign);
    const bogFolk = setting!.all.find((e) => e.kind === 'race' && e.packEntryId === 'bog-folk')!;
    expect(bogFolk.data.abilityModifiers).toEqual({ NIM: 1, GRT: -1, CHARM: 1 });
  });

  // Purpose: with the option off, nothing changes.
  it('with the choice off, they show only their own', async () => {
    const { me, campaign } = fenWorld('off');
    withBogFolkCharm();
    const sheet = await bogFolkPopUp(renderApp());
    expect(sheet.queryByText(/CHARM \+1|Charm \+1/)).toBeNull();
    forgetCampaignSetting();
    const setting = await loadCampaignSetting(world.db, me, campaign);
    expect(setting!.all.find((e) => e.kind === 'race' && e.packEntryId === 'bog-folk')!.data.abilityModifiers).toEqual({ NIM: 1, GRT: -1 });
  });
});

function renderApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

describe('a save bonus by CON and a skill target in a situation, beside the figures', () => {
  const resolved = (kind: string, data: Record<string, unknown>): ResolvedEntry => ({ kind, packEntryId: String(data.id), name: String(data.name ?? data.id), data, packId: 'pack-moss' }) as unknown as ResolvedEntry;
  const rules = {
    id: 'moss-rules',
    abilities: [{ key: 'MUS', name: 'Muscle' }, { key: 'CON', name: 'Constancy' }],
    saveCategories: [{ key: 'R', name: 'Rot' }, { key: 'M', name: 'Mire' }],
    skills: [{ id: 'delve', name: 'Delve', default: 6, rollMode: 'equal-or-over' }],
  };
  const mossKin = {
    id: 'moss-kin',
    name: 'Moss kin',
    saveBonusByCon: { saves: ['R(rot)', 'M'], byCon: [{ con: '6 or lower', bonus: 0 }, { con: '7-14', bonus: 2 }, { con: '15 or more', bonus: 3 }] },
    skillTargets: { delve: { value: 4, when: 'wading' } },
  };
  const warden = { id: 'moss-warden', name: 'Moss warden', progression: [{ level: 1, saves: { R: 13, M: 12 } }], skills: { names: { delve: 'Delve' } } };
  const hook = { id: 'moss-saves', kind: 'fill', when: 'levelUp', from: 'classProgression', target: 'saves' };
  const setting = { packs: [], ruleGroups: [], rulesSets: [rules], all: [resolved('race', mossKin), resolved('class', warden), resolved('hook', hook)] } as unknown as CampaignSetting;
  const fieldDefs: FieldDefinition[] = [
    { id: 'field-saveR', campaignId: 'c', key: 'saveR', label: 'Rot save', type: 'number', choices: [], group: 'Saves', order: 0, showOnCard: false, hidden: false, fill: 'saves.R', required: false, from: null },
  ];
  const character = { level: 1, fields: {}, creation: { scores: { MUS: 10, CON: 12 } }, classRef: 'moss-warden', raceRef: 'moss-kin' };

  it('says the bonus beside the sheet’s Rot save and beside Mire in From your setting; the numbers stay the class’s', () => {
    const figures = characterFigures(setting, character, fieldDefs);
    expect(figures.values.saveR).toBe('13');
    expect(figures.fieldNotes.saveR).toBe('+2 to the roll vs rot');
    const rows = unclaimed(setting, { level: 1, scores: character.creation.scores, classRef: 'moss-warden', raceRef: 'moss-kin' }, fieldDefs);
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Mire', value: '12 (+2 to the roll)' }), expect.objectContaining({ label: 'Delve', value: '6 (4 when wading)' })]));
  });

  it('gives the Player screen’s save and skill pop-ups the same words', () => {
    const figures = characterFigures(setting, character, fieldDefs);
    const saves = savesOf(figures.filled, setting.rulesSets, figures.notes);
    expect(saves.find((s) => s.key === 'R')).toMatchObject({ value: '13', raceNote: '+2 to the roll vs rot' });
    expect(saves.find((s) => s.key === 'M')).toMatchObject({ value: '12', raceNote: '+2 to the roll' });
    expect(skillsOf(figures.filled, figures.klass, figures.notes).find((s) => s.code === 'delve')?.raceNote).toBe('4 when wading');
  });

  it('says nothing beside the saves for a low CON', () => {
    const figures = characterFigures(setting, { ...character, creation: { scores: { MUS: 10, CON: 5 } } }, fieldDefs);
    expect(figures.fieldNotes.saveR).toBeUndefined();
    expect(savesOf(figures.filled, setting.rulesSets, figures.notes).every((s) => s.raceNote === undefined)).toBe(true);
  });
});
