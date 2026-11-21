// @vitest-environment jsdom
// Gate walk 2026-11-06, item 4 (of-9, gate check 59): creation's Who they are showed a sheet field whose option is off
// (blank) in a campaign whose fields were made by "Use this sheet layout", which writes each key in lower case. #522
// keyed the option gates by both spellings; this follows creation's own path to them. On the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json, with an invented layout field behind its drill option (names invented).
//   With the drill option at its default (off), Who they are doesn't ask for Weapon drills.
//   With the drill option on, it does.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { layoutKey } from '../modules/library/optionGate.ts';
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

/** The layout's drill field, keyed in mixed case as packs write it, behind the fixture's drill option. */
const DRILLS = { key: 'weaponDrills', label: 'Weapon drills', type: 'text', group: 'Combat', option: ['fen-weapon-drill=on'] };

/** The fixture's setting, its layout carrying the drill field, and the campaign's fields as "Use this sheet layout" keys them. */
function fenWorld(options: Record<string, string> = {}) {
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
  for (const o of pack.options!.filter((x) => x.id === 'fen-weapon-drill')) entry('option', o);
  const template = { ...pack.fieldTemplates![0]!, fields: [DRILLS] };
  entry('fieldTemplate', template);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: options, overrides: {}, priority: 1 });
  world.tables.field_definitions.push({ id: 'field-drills', campaign_id: campaign, applies_to: 'pc', key: layoutKey(DRILLS.key), label: DRILLS.label, type: 'text', choices: [], field_group: DRILLS.group, sort_order: 0, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  world.signInAs(me);
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';

/** Scores, Bog folk, the warden, Adjust scores if it shows, to Who they are. */
async function toWho(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, 'Bog folk');
  if (heading() === 'Kindred') await next(user);
  await screen.findByRole('heading', { name: 'Class' });
  await pick(user, 'Lantern Warden');
  if (heading() === 'Class') await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
}

describe('Who they are asks only for the fields in play (of-9, gate walk 2026-11-06 item 4)', () => {
  it('with the drill option off, Who they are has no Weapon drills field', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.queryByLabelText('Weapon drills')).toBeNull();
  });

  it('with the drill option on, Who they are asks for Weapon drills', async () => {
    fenWorld({ 'fen-weapon-drill': 'on' });
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user);
    expect(screen.getByLabelText('Weapon drills')).toBeTruthy();
  });
});
