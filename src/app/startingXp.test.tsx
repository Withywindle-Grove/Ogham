// @vitest-environment jsdom
// Experience at a higher starting level, through guided creation (cs-13, plan dec-10 X1), on the invented fixture
// pack scripts/fixtures/m5b-creation.fixture.json with an XP table for the Reed Witch (`witch-xp`), and a second
// attached pack on top of it with its own, different `witch-xp`. The campaign starts characters at a fixed level.
// Every name and number is invented.
//   A witch made at level 2 is saved with her own pack's level-2 figure, not the top pack's table of the same id.
//   A witch made at level 1 is saved with 0, as before.
import { cleanup, render, screen } from '@testing-library/react';
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
});

afterEach(() => {
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };

/** The fixture's setting, with the witch's XP table, under a second pack with a `witch-xp` of its own, starting at `level`. */
function fenWorld(level: number) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { startLevel: 'fixed', startLevelFixed: level } });
  for (const [packId, name] of [['pack-fen', 'Fen sample'], ['pack-mire', 'Mire zine']] as const) {
    world.tables.packs.push({ id: packId, owner_user_id: gm, campaign_id: null, name, version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: name } });
  }
  const entry = (packId: string, kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${packId}-${kind}-${String(data.id)}`, pack_id: packId, kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('pack-fen', 'rulesSet', r);
  for (const r of pack.races!) entry('pack-fen', 'race', r);
  for (const c of pack.classes!) entry('pack-fen', 'class', c);
  for (const s of pack.spells!) entry('pack-fen', 'spell', s);
  for (const l of pack.spellLists!) entry('pack-fen', 'spellList', l);
  for (const t of pack.tables!) entry('pack-fen', 'table', t);
  entry('pack-fen', 'xpTable', { id: 'witch-xp', name: 'Witch XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 2400 }, { level: 3, xp: 4800 }] });
  // On top of the stack: a table of the same id, longer and with other figures.
  entry('pack-mire', 'xpTable', { id: 'witch-xp', name: 'Witch XP', levels: [{ level: 1, xp: 0 }, { level: 2, xp: 3100 }, { level: 3, xp: 6200 }, { level: 4, xp: 12400 }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mire zine', option_choices: {}, overrides: {}, priority: 2 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => !['background', 'languages', 'hp', 'alignment'].includes(f.key));
  layout.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, created_at: '2026-10-18T12:00:00Z' }),
  );
  world.signInAs(me);
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tam = () => world.tables.actors.find((a) => a.name === 'Tam');

/** Scores, Kindred, the witch, Adjust scores and Who they are (named Tam): the draft is made on its Next. */
async function makeWitch(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, 'Bog folk');
  await next(user);
  await pick(user, 'Reed Witch');
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
  await user.type(screen.getByLabelText('Name'), 'Tam');
  await next(user);
  await screen.findByRole('heading', { name: 'First spells' });
}

describe('Experience at a higher starting level (cs-13)', () => {
  // Purpose: a character made at level 2 starts with her own pack's level-2 figure, not the top pack's table of the same id.
  it('a level-2 witch starts with 2,400 experience from her own pack’s table', async () => {
    fenWorld(2);
    const user = openApp();
    await makeWitch(user);
    expect(tam()?.level).toBe(2);
    expect(tam()?.classes).toEqual([{ classRef: 'reed-witch', level: 2, xp: 2400 }]);
  });

  // Purpose: a character made at level 1 starts with 0 experience, as before.
  it('a level-1 witch starts with 0', async () => {
    fenWorld(1);
    const user = openApp();
    await makeWitch(user);
    expect(tam()?.classes).toEqual([{ classRef: 'reed-witch', level: 1, xp: 0 }]);
  });
});
