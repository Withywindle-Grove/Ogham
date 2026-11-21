// @vitest-environment jsdom
// The kindred's and class's own bonuses and the full sheet's Traits section (cs-7; the creation survey's PR 5). Pure
// readers (src/modules/characters/bonuses.ts), the figures the sheet and creation read (fromSetting.ts), the
// pack checker's lines, and one walk on the invented fixture pack (scripts/fixtures/m5b-creation.fixture.json, a
// copy patched here). Every name and number is invented.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { acBonusesOf, acBonusCounts, readArmourWhen, saveBonusNotes, traitsOf } from '../modules/characters/bonuses.ts';
import { raceDataAsPlayed } from '../modules/characters/creation.ts';
import { explainFigure } from '../modules/characters/explain.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { traitEntry } from '../modules/characters/listEntries.ts';
import { savesOf, type WornGear } from '../modules/characters/play.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { characterAcBonuses, characterFigures, creationAcParts, withCreationAc } from './fromSetting.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

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
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// An invented setting: ascending AC 10 unarmoured, two saves, a kindred with a coat that helps when lightly armoured
// and a save bonus, a class whose AC bonus grows by level and that has its own save bonus.
const resolved = (kind: string, data: Record<string, unknown>): ResolvedEntry => ({ kind, packEntryId: String(data.id), name: String(data.name ?? data.id), data, packId: 'pack-burr' }) as unknown as ResolvedEntry;
const rules = { id: 'burr-rules', attack: { unarmouredAC: 10, style: 'ascending' }, saveCategories: [{ key: 'R', name: 'Rot' }, { key: 'M', name: 'Mire' }] };
const thistleKin = {
  id: 'thistle-kin',
  name: 'Thistle kin',
  acBonus: { value: 1, when: 'unarmoured or Light armour' },
  saveBonus: [{ vs: 'spores or poison', bonus: 4 }, { vs: 'all other', bonus: 2 }],
  abilities: [{ name: 'Burr coat', note: '+1 AC when unarmoured or in light armour.' }, { name: 'Prickly', note: 'Hard to hug.', kind: 'disadvantage' }],
};
const hedgeAbbot = {
  id: 'hedge-abbot',
  name: 'Hedge Abbot',
  progression: [
    { level: 1, saves: { R: 13, M: 12 }, acBonus: 2 },
    { level: 4, saves: { R: 12, M: 11 }, acBonus: 3 },
  ],
  saveBonus: { bonus: 1, saves: ['M'] },
  abilities: [{ name: 'Armour of thorns', note: 'AC bonus by level.' }, { name: 'Vigil', note: 'Wakes at any sound.', fromLevel: 3 }, { name: 'Lantern rite', note: 'Only with the lantern option.', option: 'burr-lanterns' }],
};
const hook = { id: 'burr-saves', kind: 'fill', when: 'levelUp', from: 'classProgression', target: 'saves' };
const setting = { packs: [], ruleGroups: [], rulesSets: [rules], all: [resolved('race', thistleKin), resolved('class', hedgeAbbot), resolved('hook', hook)] } as unknown as CampaignSetting;
const acField: FieldDefinition = { id: 'field-ac', campaignId: 'c', key: 'ac', label: 'AC', type: 'number', choices: [], group: 'Combat', order: 0, showOnCard: false, hidden: false, fill: 'ac', required: false, from: null };
const character = (level: number) => ({ level, fields: {}, creation: { scores: {} }, classRef: 'hedge-abbot', raceRef: 'thistle-kin' });
const wearing = (type: string | null): WornGear[] => [{ name: 'Bark coat', slot: 'armour', armour: type ? { base: 12, type } : { base: 12 } }];

describe('reading an AC bonus’s condition', () => {
  // Purpose: the armour words in a pack's `when` are read; anything else is the table's to count.
  it('reads unarmoured and the armour weights, and nothing else', () => {
    expect(readArmourWhen('unarmoured or Light armour')).toEqual(['none', 'light']);
    expect(readArmourWhen('when wearing medium or heavy armour')).toEqual(['medium', 'heavy']);
    expect(readArmourWhen('vs Large foes')).toBeNull();
    expect(readArmourWhen('unarmoured, or when wading')).toBeNull();
  });

  // Purpose: a bonus counts only when its condition holds, and an armour with no weight given never guesses.
  it('counts by what is worn', () => {
    const fur = { source: 'Thistle kin', value: 1, when: 'unarmoured or Light armour' };
    expect(acBonusCounts(fur, 'none')).toBe('counts');
    expect(acBonusCounts(fur, 'light')).toBe('counts');
    expect(acBonusCounts(fur, 'heavy')).toBe('not-now');
    expect(acBonusCounts(fur, null)).toBe('unknown');
    expect(acBonusCounts({ ...fur, when: 'vs Large' }, 'none')).toBe('at-the-table');
    expect(acBonusCounts({ ...fur, when: null }, 'heavy')).toBe('counts');
  });
});

describe('AC bonuses from the kindred and the class (cs-7)', () => {
  // Purpose: the kindred's bonus, then the class's at this level (the latest progression row at or below it).
  it('lists the kindred’s and the class’s bonus at the level', () => {
    expect(acBonusesOf(thistleKin, hedgeAbbot, 1)).toEqual([
      { source: 'Thistle kin', value: 1, when: 'unarmoured or Light armour' },
      { source: 'Hedge Abbot at level 1', value: 2, when: null },
    ]);
    expect(acBonusesOf(thistleKin, hedgeAbbot, 5)[1]).toEqual({ source: 'Hedge Abbot at level 5', value: 3, when: null });
  });

  // Purpose: a kindred-class replaces its kindred's traits (cs-4), so the kindred's AC bonus is gone and the class's own counts.
  it('a kindred-class drops its kindred’s bonus for its own', () => {
    const thistleCalling = { id: 'thistle-calling', name: 'Thistle calling', race: 'thistle-kin', acBonus: 2 };
    const played = raceDataAsPlayed(thistleKin, 'thistle-kin', thistleCalling);
    expect(acBonusesOf(played, thistleCalling, 1)).toEqual([{ source: 'Thistle calling', value: 2, when: null }]);
  });

  // Purpose (the plan's test): a thistle kin unarmoured has the coat's bonus in AC and its breakdown; in heavy armour, not.
  it('counts the coat unarmoured and in light armour, not in heavy armour, and says why', () => {
    const figures = characterFigures(setting, character(1), [acField]);
    const bare = figures.ac([]);
    expect(bare.value).toBe(13);
    expect(bare.lines).toEqual(['Unarmoured: 10', 'Thistle kin, unarmoured or Light armour: +1', 'Hedge Abbot at level 1: +2']);
    expect(figures.ac(wearing('light')).value).toBe(15);
    const heavy = figures.ac(wearing('heavy'));
    expect(heavy.value).toBe(14);
    expect(heavy.lines).toContain('Thistle kin: +1 only when unarmoured or Light armour, not now');
    const unknown = figures.ac(wearing(null));
    expect(unknown.value).toBe(14);
    expect(unknown.lines.some((l) => l.startsWith('Thistle kin: +1 only when unarmoured or Light armour;') && l.includes('Bark coat'))).toBe(true);
  });

  // Purpose: with descending AC the bonuses take AC down, as every other bonus does.
  it('takes the bonuses off with descending AC', () => {
    const down = { ...setting, rulesSets: [{ ...rules, attack: { unarmouredAC: 9, style: 'descending' } }] } as CampaignSetting;
    const worked = characterFigures(down, character(1), [acField]).ac([]);
    expect(worked.value).toBe(6);
    expect(worked.lines).toContain('Hedge Abbot at level 1: −2');
  });

  // Purpose: a situational bonus is named in the breakdown but never counted.
  it('names a situational bonus without counting it', () => {
    const vsLarge = { ...setting, all: [resolved('race', { ...thistleKin, acBonus: { value: 2, when: 'vs Large' } }), resolved('class', { ...hedgeAbbot, progression: [] }), resolved('hook', hook)] } as unknown as CampaignSetting;
    const worked = characterFigures(vsLarge, character(1), [acField]).ac([]);
    expect(worked.value).toBe(10);
    expect(worked.lines).toContain('Thistle kin: +2 vs Large, counted at the table');
  });

  // Purpose: creation's AC (nothing worn yet) and its parts on Derived fields count the same bonuses.
  it('joins creation’s AC and its parts', () => {
    const bonuses = characterAcBonuses(setting, { level: 1, classRef: 'hedge-abbot', raceRef: 'thistle-kin' });
    const filled = withCreationAc(setting, {}, [acField], bonuses);
    expect(filled.ac).toBe(13);
    expect(creationAcParts(setting, filled, (k) => k, bonuses)).toBe('unarmoured, Thistle kin +1, Hedge Abbot at level 1 +2');
  });
});

describe('save bonuses beside the saves (cs-7, as bq-8)', () => {
  // Purpose: a bonus against something reads "vs …", "all other" reads "otherwise", and one naming its saves stays on them.
  it('words each bonus and puts it on the saves it names', () => {
    expect(saveBonusNotes(thistleKin, ['R', 'M'])).toEqual({
      'saves.R': '+4 to the roll vs spores or poison; +2 to the roll otherwise',
      'saves.M': '+4 to the roll vs spores or poison; +2 to the roll otherwise',
    });
    expect(saveBonusNotes(hedgeAbbot, ['R', 'M'])).toEqual({ 'saves.M': '+1 to the roll' });
    expect(saveBonusNotes({ saveBonus: 0 }, ['R'])).toEqual({});
  });

  // Purpose: the saves keep the class's numbers, with the kindred's and class's words beside them, and the breakdown names who says each.
  it('shows them beside the save and names who gives each in its breakdown', () => {
    const figures = characterFigures(setting, character(1), []);
    const saves = savesOf(figures.filled, setting.rulesSets, figures.notes);
    expect(saves.find((s) => s.key === 'R')).toMatchObject({ value: '13', raceNote: '+4 to the roll vs spores or poison; +2 to the roll otherwise' });
    expect(saves.find((s) => s.key === 'M')?.raceNote).toBe('+4 to the roll vs spores or poison; +2 to the roll otherwise; +1 to the roll');
    const lines = explainFigure('saves.M', figures.explaining, { rulesSets: setting.rulesSets, scores: {}, classRef: 'hedge-abbot', raceRef: 'thistle-kin', notes: figures.raceNotes, classNotes: figures.classNotes, label: () => 'Mire' });
    expect(lines.slice(-2)).toEqual(['Thistle kin: +4 to the roll vs spores or poison; +2 to the roll otherwise.', 'Hedge Abbot: +1 to the roll.']);
  });
});

describe('the traits (cs-7)', () => {
  // Purpose: every kindred trait, then every class trait, in the pack's order; one whose option is off is left out.
  it('lists the kindred’s and the class’s traits, without one whose option is off', () => {
    const off = traitsOf(thistleKin, hedgeAbbot, (t) => !t.option);
    expect(off.map((t) => `${t.from}:${t.name}`)).toEqual(['kindred:Burr coat', 'kindred:Prickly', 'class:Armour of thorns', 'class:Vigil']);
    expect(traitsOf(thistleKin, hedgeAbbot, () => true)).toHaveLength(5);
  });

  // Purpose: a trait's entry says what it does, whose it is, when it starts and whether it's a drawback.
  it('opens an entry with its source, its level and its kind', () => {
    const [, prickly, , vigil] = traitsOf(thistleKin, hedgeAbbot, () => true);
    expect(traitEntry(prickly!, 'Burr rules')).toEqual({
      key: 'trait:kindred:1',
      name: 'Prickly',
      meta: 'Burr rules',
      lead: 'Hard to hug.',
      headings: [{ label: 'From', text: 'Your kindred, Thistle kin' }, { label: 'Kind', text: 'A drawback' }],
    });
    expect(traitEntry(vigil!).headings).toContainEqual({ label: 'When', text: 'At level 3' });
  });
});

// The walk: the fixture's bog folk gain a coat bonus; an approved bog folk Lantern Warden's full sheet lists the
// traits, each opening its entry, and AC's breakdown names the bonus.
const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

function fenWorld() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r.id === 'bog-folk' ? { ...r, acBonus: { value: 1, when: 'unarmoured or light armour' } } : r);
  for (const c of pack.classes!) entry('class', c);
  for (const h of pack.hooks!) entry('hook', h);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  entry('xpTable', { id: 'warden-xp', name: 'Warden XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  (pack.fieldTemplates![0]!.fields as LayoutField[])
    .filter((f) => f.key !== 'hp' && !f.from)
    .forEach((f, order) => {
      const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: null, created_at: '2026-10-18T12:00:00Z' });
    });
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, race_ref: 'bog-folk', fields: { MUS: 10, NIM: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
  world.addMember(campaign, me, 'player', reed);
  world.signInAs(me);
}

describe('the full sheet (cs-7)', () => {
  // Purpose: the sheet has a Traits section listing every kindred and class trait, each opening its entry; AC's
  // breakdown names the kindred's bonus.
  it('lists the traits, opens one, and names the coat in AC', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openFullSheetFromMenu(user);
    const traits = within(await screen.findByRole('region', { name: 'Traits' }));
    // Plan m5b-sheet-revised A2: the kindred's traits are Traits rows (no chips, no groups by source), the class's are
    // Abilities rows; a drawback says so in words on its row.
    expect(traits.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Second wind', 'Small, a drawback']);
    const calling = within(screen.getByRole('region', { name: 'Abilities' }));
    expect(calling.getByRole('button', { name: /^Steady flame/ })).toBeTruthy();
    expect(calling.getByRole('button', { name: /^Oath of light/ })).toBeTruthy();
    await user.click(traits.getByRole('button', { name: 'Second wind' }));
    const entry = within(await screen.findByRole('dialog', { name: /Second wind/ }));
    expect(entry.getByText('Breathes under water for a turn.')).toBeTruthy();
    expect(entry.getByText(/Your kindred, Bog folk/)).toBeTruthy();
    await user.click(entry.getByRole('button', { name: 'Got it' }));
    // The Combat block is gone (plan A1): AC is a tile in the left column.
    await user.click(screen.getByRole('button', { name: /^Armour class .*: how it's worked out$/ }));
    expect(within(await screen.findByRole('dialog', { name: 'Armour class' })).getByText('Bog folk, unarmoured or light armour: +1')).toBeTruthy();
  });

  // Purpose: the sheet shows the XP and how far to the next level under Level, the experience bonus as an Abilities row
  // whose tap says why, and the level title by the name (sr-5; plan m5b-sheet-revised A1, A2: the Advancement block is gone).
  it('shows the XP to the next level, the experience bonus and why, the title by the name', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openFullSheetFromMenu(user);
    const level = within(await screen.findByRole('region', { name: 'Level' }));
    expect(level.getByText('0 of 1,500 experience')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Advancement' })).toBeNull();
    expect(screen.getByText('Lamplighter')).toBeTruthy();
    await user.click(within(screen.getByRole('region', { name: 'Abilities' })).getByRole('button', { name: /^Experience bonus/ }));
    const why = within(await screen.findByRole('dialog', { name: 'Experience bonus' }));
    expect(why.getByText(/prime requisite MUS 10/)).toBeTruthy();
  });
});
