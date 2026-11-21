// @vitest-environment jsdom
// A trait-list entry's powers on the sheet (07 `traitLists[].entries[].abilities`, G-213; creation retest 4 T9,
// 2026-11-09), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json and an invented overlay ("Reed
// overlay") holding a spell. Purposes:
//   Once an entry is picked, its powers join the full sheet's Abilities rows; a power with uses says them in words and
//   gets the Player screen's Use row and dots; one without uses has no dots and no Use row.
//   A power's spell resolves into another attached pack's spells, and its row opens the power's text and the spell.
//   A power with uses named like the class's own (Steady flame) stays with the class: it shows once.
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

/** Wren, a Lantern Warden whose heron sign (a trait list, "grey-heron") gives three powers. */
function heronWorld() {
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
  for (const i of pack.items!) entry('pack-fen', 'item', i);
  for (const h of pack.hooks!) entry('pack-fen', 'hook', h);
  entry('pack-fen', 'xpTable', { id: 'warden-xp', name: 'Warden XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 1500 }] });
  entry('pack-fen', 'traitList', {
    id: 'heron-signs',
    name: 'Heron signs',
    entries: [
      {
        id: 'grey-heron',
        name: 'Grey heron',
        abilities: [
          { name: 'Still water', note: 'Stand unseen in the reeds for a turn.', uses: { count: 2, per: 'day' }, spellId: 'reed-lamp' },
          { name: "Heron's patience", note: 'Wait without tiring.' },
          { name: 'Steady flame', note: 'A second steady flame.', uses: { count: 1, per: 'day' } },
        ],
      },
      { id: 'night-heron', name: 'Night heron' },
    ],
  });
  entry('pack-reed', 'spell', { id: 'reed-lamp', name: 'Reed lamp', level: 1 });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_packs.push({ id: 'link-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'Reed overlay', option_choices: {}, overrides: {}, priority: 2 });
  const layout = (pack.fieldTemplates![0]!.fields as { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; from?: string }[]).filter((f) => f.key !== 'omen' && f.key !== 'hp' && !f.from);
  const field = (f: { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; from?: string }, order: number) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type === 'list' && !f.choices?.length && !f.from ? 'text' : f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, from_list: f.from ?? null, created_at: '2026-10-18T12:00:00Z' });
  layout.forEach(field);
  field({ key: 'sign', label: 'Heron sign', type: 'list', group: 'Identity', from: 'heron-signs' }, layout.length);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
    level: 1,
    hp_current: 6,
    hp_max: 9,
    race_ref: 'bog-folk',
    fields: { MUS: 13, NIM: 12, GRT: 11, WIT: 14, LORE: 9, CHARM: 10, sign: 'grey-heron' },
    classes: [{ classRef: 'lantern-warden', level: 1, xp: 120 }],
  });
  world.addMember(campaign, me, 'player', wren);
  return { me };
}

async function openPlayer(as: string) {
  world.signInAs(as);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'Vitals' });
  return user;
}

describe('a trait-list entry’s powers (T9, G-213)', () => {
  it('join the sheet’s Abilities rows, the spell from another pack, a class power named alike shown once', async () => {
    const { me } = heronWorld();
    const user = await openPlayer(me);
    await openFullSheetFromMenu(user);
    const abilities = await screen.findByRole('region', { name: 'Abilities' });
    expect(within(abilities).getByText('Still water')).toBeTruthy();
    expect(within(abilities).getByText('2 uses a day')).toBeTruthy();
    expect(within(abilities).getByText("Heron's patience")).toBeTruthy();
    expect(within(abilities).getAllByText('Steady flame')).toHaveLength(1);
    await user.click(within(abilities).getByRole('button', { name: /^Still water/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Still water' }));
    expect(sheet.getByText('Stand unseen in the reeds for a turn.')).toBeTruthy();
    expect(sheet.getByText('Reed lamp')).toBeTruthy();
  });

  it('a power with uses gets the Player screen’s Use row; one without uses gets none', async () => {
    const { me } = heronWorld();
    await openPlayer(me);
    const traits = screen.getByRole('heading', { name: 'Traits' }).closest('section') as HTMLElement;
    expect(within(traits).getByRole('button', { name: 'Use Still water' })).toBeTruthy();
    expect(within(traits).queryByRole('button', { name: "Use Heron's patience" })).toBeNull();
    expect(within(traits).getAllByRole('button', { name: 'Use Steady flame' })).toHaveLength(1);
  });
});
