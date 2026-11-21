// @vitest-environment jsdom
// The full sheet for a class from another pack's sheet layout (creation retest 4, T8, 2026-11-09), on the invented
// fixture pack scripts/fixtures/m5b-creation.fixture.json and an invented overlay ("Reed overlay", class "Reed Warden").
// Purposes:
//   A character whose class comes from an overlay, in a campaign whose sheet fields are that overlay's layout (no field
//   holds a score), still gets the sheet's rows from the class: the Score tiles (from the scores they were made with),
//   Skills and Abilities; never the bare fallback (the scores as a text line, no skills).
//   A character whose class isn't in the campaign's setting rules any more says so in the identity line, instead of
//   the bare line the GM's own fields make for a character with no class.
//   (Design's answer on #570, T8) A character whose class comes from an attached pack, made on an older version of that
//   pack (its creation record has no layout or skills), in a campaign with the base layout and the overlay's: the sheet
//   still fills the revised rows from the current pack's class (identity, Score tiles, Save tiles, Skills, Abilities),
//   never the bare fallback (scores as a line under the name, empty Weapon proficiencies, the overlay's empty field).
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

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const SCORES = { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10 };

/**
 * The fixture as the base pack and "Reed overlay" on top with the class Reed Warden (the fixture's Lantern Warden under
 * another id and name) and its own sheet layout, the only one the campaign uses: one field, "Marsh sign". Wren (Sam's)
 * was made with the scores in her creation record, as Reed Warden, or with `classRef`.
 */
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; from?: string };

function reedWorld(classRef = 'reed-warden', { baseLayout = false, oldRecord = false }: { baseLayout?: boolean; oldRecord?: boolean } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  world.tables.packs.push({ id: 'pack-reed', owner_user_id: gm, campaign_id: null, name: 'Reed overlay', version: '0.1', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Reed overlay' } });
  const entry = (packId: string, kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('pack-fen', 'rulesSet', r);
  for (const o of pack.options ?? []) entry('pack-fen', 'option', o);
  for (const r of pack.races!) entry('pack-fen', 'race', r);
  for (const c of pack.classes!) entry('pack-fen', 'class', c);
  for (const s of pack.spellLists ?? []) entry('pack-fen', 'spellList', s);
  for (const s of pack.spells ?? []) entry('pack-fen', 'spell', s);
  for (const i of pack.items!) entry('pack-fen', 'item', i);
  for (const h of pack.hooks!) entry('pack-fen', 'hook', h);
  entry('pack-fen', 'xpTable', { id: 'warden-xp', name: 'Warden XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }] });
  const warden = pack.classes!.find((c) => c.id === 'lantern-warden')!;
  entry('pack-reed', 'class', { ...warden, id: 'reed-warden', name: 'Reed Warden' });
  // The overlay's layout: a field for every class, and one only for another pack's class (it must stay hidden here).
  entry('pack-reed', 'fieldTemplate', { id: 'reed-sheet', name: 'Reed sheet additions', appliesTo: 'pc', fields: [{ key: 'marshSign', label: 'Marsh sign', type: 'text', group: 'Identity' }, { key: 'reedTalents', label: 'Reed talents', type: 'text', group: 'Abilities', forClasses: ['lantern-warden'] }] });
  // The weapon drill on with the base layout, as the live campaign had its weapon rule on (Weapon proficiencies is then the Weapon skills line's).
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: baseLayout ? { 'fen-weapon-drill': 'on' } : {}, overrides: {}, priority: 1 });
  world.tables.campaign_packs.push({ id: 'link-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'Reed overlay', option_choices: {}, overrides: {}, priority: 2 });
  // The overlay's layout only (no field holds a score), or the base layout first and then the overlay's.
  const base = baseLayout ? (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => f.key !== 'omen' && f.key !== 'hp' && !f.from) : [];
  const extra: LayoutField[] = baseLayout ? [{ key: 'weaponProficiencies', label: 'Weapon proficiencies', type: 'text', group: 'Fight' }, { key: 'reedTalents', label: 'Reed talents', type: 'text', group: 'Abilities' }] : [];
  [...base, ...extra, { key: 'marshSign', label: 'Marsh sign', type: 'text', group: 'Identity' } as LayoutField].forEach((f, order) => {
    const type = f.type === 'list' && !f.choices?.length ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: baseLayout && /^(MUS|NIM|GRT|WIT|LORE|CHARM)$/.test(f.key), hidden: false, fill: f.fill ?? null, required: false, from_list: null, created_at: '2026-10-18T12:00:00Z' });
  });
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
    level: 1,
    hp_current: 6,
    hp_max: 9,
    race_ref: 'bog-folk',
    fields: baseLayout ? { ...SCORES, marshSign: 'Heron' } : { marshSign: 'Heron' },
    // A record from an older version of the overlay: no scores, no layout, no skills in it.
    creation: oldRecord ? { method: 'simple' } : { scores: SCORES },
    classes: [{ classRef, level: 1, xp: 120 }],
  });
  world.addMember(campaign, me, 'player', wren);
  return { me };
}

async function openSheet(as: string) {
  world.signInAs(as);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'Vitals' });
  await openFullSheetFromMenu(user);
  await screen.findByRole('region', { name: 'Level' });
  return user;
}

describe('a class from an overlay with its own sheet layout (T8)', () => {
  it('fills the Score tiles, Skills and Abilities from the class, never the bare fallback', async () => {
    const { me } = reedWorld();
    await openSheet(me);
    expect(document.querySelector('.sheet__identity')?.textContent).toContain('Reed Warden 1');
    const scores = screen.getByRole('region', { name: 'Scores' });
    for (const value of ['13', '12', '11', '14', '9', '10']) expect(within(scores).getAllByText(value).length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Skills' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Abilities' })).toBeTruthy();
    // No score as words in Details.
    expect(screen.getByRole('region', { name: 'Details and backstory' }).textContent).not.toMatch(/MUS|Muscle 13/);
  });

  it('a class the setting rules no longer have is named as missing, not the bare line', async () => {
    const { me } = reedWorld('gone-warden');
    await openSheet(me);
    expect(document.querySelector('.sheet__identity')?.textContent).toBe('Class not in this campaign’s setting rules');
  });
});

describe('a class from an attached pack, made on its older version (T8, Design on #570)', () => {
  it('fills the revised rows from the current pack\'s class, never the bare fallback', async () => {
    const { me } = reedWorld('reed-warden', { baseLayout: true, oldRecord: true });
    await openSheet(me);
    const identity = document.querySelector('.sheet__identity')?.textContent ?? '';
    expect(identity).toContain('Reed Warden 1');
    expect(identity).not.toMatch(/MUS|Muscle|13/);
    const scores = screen.getByRole('region', { name: 'Scores' });
    for (const value of ['13', '12', '11', '14', '9', '10']) expect(within(scores).getAllByText(value).length).toBeGreaterThan(0);
    const saves = screen.getByRole('region', { name: 'Saves' });
    expect(saves.textContent).toMatch(/\d/);
    expect(screen.getByRole('region', { name: 'Skills' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Abilities' })).toBeTruthy();
    const details = screen.getByRole('region', { name: 'Details and backstory' }).textContent ?? '';
    expect(details).not.toContain('Weapon proficiencies');
    // The overlay's field for another class stays hidden.
    expect(document.querySelector('.sheet')?.textContent).not.toContain('Reed talents');
  });
});
