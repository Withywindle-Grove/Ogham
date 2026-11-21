// @vitest-environment jsdom
// The bugs of the third creation test (M5b step 0c, PR H; plan "Follow-up to the third test", 2026-11-03), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented (the fixture's
// stone kin stand for a kindred with a skill target and a spell ward; its birth omens leave them out).
//   An excluded kindred never sees the list: stone kin with the birth omens on get no Omen step and are never asked
//   an Omen on Who they are; Affiliation isn't asked there either (ct3-3, ct3-4b).
//   A stone kin's Hark is 5 and their spell ward the LORE modifier plus 2; a bog folk's Hark stays at the default
//   6 (ct3-12a).
//   Back from step 6 reaches Kindred with every pick kept, through Who they are and the class, Back beside Next on
//   each; going forward again comes back to step 6 with no second character made (ct3-5).
//   Movement shows on the full sheet, worked out from the pack, and Affiliation there has an ⓘ (ct3-10, ct3-3).
//   A sheet layout field marked atCreation: false (Affiliation) isn't asked on Who they are and shows on the full
//   sheet; unmarked (Motto, or Affiliation with the mark taken off), it is asked (ruled B 2026-11-03).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { layoutHelp } from '../modules/characters/traitLists.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
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

/** The fixture on a campaign, its fields as the importer makes them (a `{race}` pattern is kept as a text field). */
function fenWorld({ omens = false }: { omens?: boolean } = {}) {
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
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: omens ? { 'fen-omens': 'on' } : {}, overrides: {}, priority: 1 });
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

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const footBack = (user: User) => user.click(screen.getByRole('button', { name: 'Back to the step before' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const picked = (name: string) => screen.getByRole('checkbox', { name: `Pick ${name}` }).getAttribute('aria-checked');
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const derived = (label: string) => (screen.getByRole('button', { name: label }).closest('.derived-fields__row') as HTMLElement | null)?.querySelector('dd')?.textContent ?? null;
const counter = () => document.querySelector('.step-counter')?.textContent ?? '';

/** Scores (WIT as given), the kindred and the warden, to Who they are. */
async function toWho(user: User, { wit = '6', race = 'Bog folk' } = {}) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  const witField = screen.getByLabelText('Wit');
  await user.clear(witField);
  await user.type(witField, wit);
  await next(user);
  await pick(user, race);
  if (heading() === 'Kindred') await next(user);
  await pick(user, 'Lantern Warden');
  if (heading() === 'Class') await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
}

describe('an excluded kindred never sees the list (ct3-4b), and Affiliation isn’t asked (ct3-3)', () => {
  it('stone kin with the birth omens on: no Omen on Who they are, no Birth omens step', async () => {
    fenWorld({ omens: true });
    const user = openApp();
    await toWho(user, { race: 'Stone kin' });
    expect(screen.queryByLabelText('Omen')).toBeNull();
    expect(screen.queryByLabelText('Affiliation')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Heron at dawn/);
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await pick(user, 'Reed');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');
    await next(user);
    await screen.findByRole('heading', { name: 'Stone kin backgrounds' });
    await pick(user, '1–2: Causeway mason');
    if (heading() === 'Stone kin backgrounds') await next(user);
    // Stone kin have a Details step (cs-1), optional: Next passes it, nothing filled (cs-11: no "Skip, leave blank").
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(screen.queryByRole('heading', { name: 'Birth omens' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Birth omens/);
  });

  it('bog folk with the birth omens on still get the list as a step (never on Who they are)', async () => {
    fenWorld({ omens: true });
    const user = openApp();
    await toWho(user, { race: 'Bog folk' });
    expect(screen.queryByLabelText('Omen')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await pick(user, 'Reed');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');
    await next(user);
    await screen.findByRole('heading', { name: 'Bog folk backgrounds' });
    await pick(user, '4–5: Reed cutter');
    if (heading() === 'Bog folk backgrounds') await next(user);
    await screen.findByRole('heading', { name: 'Birth omens' });
  });
});

// Ruled B 2026-11-03: the app keeps no list of fields left out of creation; a sheet layout field's
// `atCreation: false` does it. Such a field isn't asked at creation and shows on the sheet; one without it is asked.
describe('a sheet layout field’s atCreation: false (ct3-3, ruled B 2026-11-03)', () => {
  /** The fixture with Affiliation's `atCreation` taken off the layout (as a pack that doesn't write it). */
  function withoutAtCreation() {
    for (const e of world.tables.library_entries.filter((x) => x.kind === 'fieldTemplate')) {
      const data = e.data as { fields: Record<string, unknown>[] };
      e.data = { ...data, fields: data.fields.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'atCreation'))) };
    }
  }

  it('Affiliation, marked atCreation: false, isn’t asked on Who they are; Motto, unmarked, is', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user, { race: 'Bog folk' });
    expect(screen.queryByLabelText('Affiliation')).toBeNull();
    expect(screen.getByLabelText('Motto')).toBeTruthy();
  });

  it('without the mark, Affiliation is asked on Who they are as before (no list in the app)', async () => {
    fenWorld();
    withoutAtCreation();
    const user = openApp();
    await toWho(user, { race: 'Bog folk' });
    expect(screen.getByLabelText('Affiliation')).toBeTruthy();
  });

  it('a field marked atCreation: false still shows on the full sheet, with its value', async () => {
    const { campaign, me } = fenWorld();
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: me, approval: 'approved' });
    world.tables.members.find((m) => m.user_id === me)!.active_actor_id = wren;
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, fields: { affiliation: 'Heron watch' }, class_ref: 'lantern-warden', race_ref: 'bog-folk' });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    expect(await screen.findByText('Affiliation')).toBeTruthy();
    expect(screen.getByText('Heron watch')).toBeTruthy();
  });
});

describe('the kindred’s skill target and spell ward, and movement, from the pack (ct3-12a, ct3-10)', () => {
  it('a stone kin’s Hark is 5 and their spell ward 2 (LORE +0, kindred +2)', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user, { race: 'Stone kin' });
    expect(derived('Hark')).toBe('5');
    expect(derived('Spell ward')).toBe('2');
    // The fixture's own movement hook still wins over the rules set's speed (a hook's value is never replaced).
    expect(derived('Movement')).toBe('125');
  });

  it('a bog folk’s Hark stays at the default 6 (their 4 when wading beside it), with no kindred bonus to the spell ward', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user, { race: 'Bog folk' });
    expect(derived('Hark')).toBe('6, 4 when wading');
    expect(derived('Spell ward')).toBe('0');
  });
});

describe('Back beside Next, all the way back (ct3-5)', () => {
  it('Back from step 6 reaches Kindred with every pick kept; forward again comes back to step 6, one character', async () => {
    fenWorld();
    const user = openApp();
    await toWho(user, { race: 'Bog folk' });
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await pick(user, 'Reed');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    const gearStep = counter();
    expect(gearStep).toMatch(/^Step 6 of/);
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');
    // Step 6 → Who they are, on the draft: what was typed and picked is there.
    await footBack(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tam');
    expect(picked('Reed')).toBe('true');
    // Who they are → the adjustments or the class → Kindred, each with its pick.
    await footBack(user);
    if ((await screen.findByRole('heading', { level: 1 })).textContent === 'Adjust scores') await footBack(user);
    await screen.findByRole('heading', { name: 'Class' });
    expect(picked('Lantern Warden')).toBe('true');
    await footBack(user);
    await screen.findByRole('heading', { name: 'Kindred' });
    expect(picked('Bog folk')).toBe('true');
    // Forward again: Kindred, Class (and Adjust scores), Who they are, then step 6 with the money kept.
    await next(user);
    await screen.findByRole('heading', { name: 'Class' });
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tam');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    expect(counter()).toBe(gearStep);
    expect((screen.getByRole('textbox', { name: 'Starting coin' }) as HTMLInputElement).value).toBe('10');
    expect(world.tables.actors.filter((a) => a.name === 'Tam')).toHaveLength(1);
  });

  it('the first step has no Back beside Next; every later one does', async () => {
    fenWorld();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    expect(screen.queryByRole('button', { name: 'Back to the step before' })).toBeNull();
    await next(user);
    await screen.findByRole('heading', { name: 'Kindred' });
    const foot = document.querySelector('.creation-step__foot') as HTMLElement;
    expect(within(foot).getByRole('button', { name: 'Back to the step before' }).textContent).toBe('Back');
  });
});

describe('the full sheet (ct3-10, ct3-3)', () => {
  // The fixture as a campaign's setting reads it, for the sheet's figures; without its movement hook, so the figure is
  // the rules set's own (its speed, 30).
  const resolved = (kind: string, data: Record<string, unknown>): ResolvedEntry => ({ kind, packEntryId: String(data.id), name: String(data.name ?? data.id), data, packId: 'pack-fen' }) as unknown as ResolvedEntry;
  const setting = {
    packs: [],
    ruleGroups: [],
    rulesSets: pack.rulesSets!,
    all: [...pack.races!.map((r) => resolved('race', r)), ...pack.classes!.map((c) => resolved('class', c)), ...pack.hooks!.filter((h) => h.id !== 'fen-fill-movement').map((h) => resolved('hook', h)), ...pack.fieldTemplates!.map((t) => resolved('fieldTemplate', t))],
  } as unknown as CampaignSetting;
  const fieldDefs: FieldDefinition[] = layoutFields.map((f, order) => ({ id: `field-${f.key}`, campaignId: 'c', key: f.key, label: f.label, type: f.type as FieldDefinition['type'], choices: f.choices ?? [], group: f.group ?? '', order, showOnCard: false, hidden: false, fill: f.fill ?? null, required: false, from: null }));
  const stoneKin = { level: 1, fields: {}, creation: { scores: { MUS: 9, NIM: 9, GRT: 9, WIT: 9, LORE: 9, CHARM: 9 } }, classRef: 'lantern-warden', raceRef: 'stone-kin' };

  it('Movement shows, worked out from the pack, even on a character saved without it', () => {
    const figures = characterFigures(setting, stoneKin, fieldDefs);
    expect(figures.values.movement).toBe('30');
    expect(figures.values.hark).toBe('5');
    expect(figures.values.spellWard).toBe('2');
    // The other modes are worked out too, each once ("How it's worked out"): exploration and the combat rate.
    const rows = unclaimed(setting, { level: 1, scores: stoneKin.creation.scores, classRef: 'lantern-warden', raceRef: 'stone-kin' }, fieldDefs);
    expect(rows).toEqual(expect.arrayContaining([{ name: 'movement.exploration', label: 'Movement: exploration', value: '90' }, { name: 'movement.combat', label: 'Movement: combat', value: '10' }]));
    expect(rows.filter((r) => r.label === 'Movement')).toEqual([]);
  });

  it('Affiliation’s ⓘ text comes from the sheet layout’s help', () => {
    expect(layoutHelp(setting.all).get('affiliation')).toBe('The band your character answers to, if any. It comes from play, not from creation.');
  });
});
