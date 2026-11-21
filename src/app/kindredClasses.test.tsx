// @vitest-environment jsdom
// Kindred-classes and grants on the creation steps (Creation survey PR 2: cs-2, cs-4), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json, changed here in the test (the file itself isn't touched). Every name is invented.
//   A kindred-class (Bog-kin) is listed under its own kindred only, and says it replaces the kindred's traits.
//   Another kindred unpicks it; the "Calling as kindred" path (no Kindred step) saves the kindred it stands for.
//   A kindred's grants (a roll on First charms, a starting item) show up as "from your kindred" groups.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const BOG_KIN = { race: 'bog-folk', replacesRaceTraits: true, abilities: [{ name: 'Bog pride', note: 'Never lost in a fen.', blurb: 'Never lost in a fen.' }] };
const BOG_GRANTS = { firstSpells: { rollTable: 'first-charms', note: 'A charm the bog folk hum.' }, startingItems: ['reed-bundle'] };

/**
 * The fixture's setting on a campaign, with the Bog-kin class bound to bog folk, and bog folk granting a roll on
 * First charms and a reed bundle (`grants`). `callings` sets the kin-callings option; `path` the creation-path choice.
 */
function fenWorld({ callings = true, grants = true, bogGrants = BOG_GRANTS }: { callings?: boolean; grants?: boolean; bogGrants?: Record<string, unknown> } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r.id === 'bog-folk' && grants ? { ...r, ...bogGrants } : r);
  for (const c of pack.classes!) entry('class', c.id === 'bog-kin-calling' ? { ...c, ...BOG_KIN } : c);
  for (const o of pack.options!) entry('option', o);
  for (const s of pack.spells!) entry('spell', s);
  for (const l of pack.spellLists!) entry('spellList', l);
  for (const t of pack.tables!) entry('table', t);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: callings ? { 'fen-kin-callings': 'on' } : {}, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => !['background', 'languages', 'hp', 'alignment'].includes(f.key));
  layout.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, created_at: '2026-10-18T12:00:00Z' }),
  );
  world.signInAs(me);
  return { gm, me, campaign };
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;

/** Opens the guided creation on its first step, then picks the creation path. */
async function toMethod(user: User, path: 'Kindred, then calling' | 'Calling as kindred') {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: 'How do you want to build?' });
  await pick(user, path);
  await next(user);
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
}

/** Through Method, Scores, (Kindred and) the class, Adjust scores and Who they are (named Tam), to the step after it. */
async function pastWho(user: User, { path, kindred, klass }: { path: 'Kindred, then calling' | 'Calling as kindred'; kindred?: string; klass: string }) {
  await toMethod(user, path);
  if (kindred) {
    await screen.findByRole('heading', { name: 'Kindred' });
    await pick(user, kindred);
  }
  await screen.findByRole('heading', { name: 'Class' });
  await pick(user, klass);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
  await user.type(screen.getByLabelText('Name'), 'Tam');
  await next(user);
}

describe('Kindred-classes on the Class step (cs-4)', () => {
  it('with kin callings on, Bog-kin is listed under bog folk and says it replaces the kindred’s traits; under stone kin it is in neither list', async () => {
    fenWorld();
    const user = openApp();
    await toMethod(user, 'Kindred, then calling');
    await pick(user, 'Bog folk');
    await screen.findByRole('heading', { name: 'Class' });
    const open = within(screen.getByRole('group', { name: 'Classes' }));
    expect(open.getByRole('checkbox', { name: 'Pick Bog-kin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Bog-kin/ }).closest('.pick-row')!.textContent).toContain('replaces your kindred’s traits');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Kindred' });
    await pick(user, 'Stone kin');
    await screen.findByRole('heading', { name: 'Class' });
    expect(within(screen.getByRole('group', { name: 'Classes' })).queryByRole('checkbox', { name: 'Pick Bog-kin' })).toBeNull();
    // The closed rows (final drafts C: in the list, after the open ones) hold the Reed Witch only, never Bog-kin.
    expect((screen.getByRole('button', { name: /^Reed Witch/ }).closest('.pick-row') as HTMLElement).querySelector('.warning-line')?.textContent).toBe('Not open to stone kin');
    expect(screen.queryByRole('button', { name: /^Bog-kin/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Pick Bog-kin' })).toBeNull();
  });

  it('picking bog folk and Bog-kin, then going back to Kindred and picking stone kin, unpicks Bog-kin', async () => {
    fenWorld();
    const user = openApp();
    await toMethod(user, 'Kindred, then calling');
    await pick(user, 'Bog folk');
    await pick(user, 'Bog-kin');
    // The class is picked; go back to the class step and on to the kindred to change it.
    if (heading() !== 'Class') await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect(screen.getByRole('checkbox', { name: 'Pick Bog-kin' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Kindred' });
    await pick(user, 'Stone kin');
    await screen.findByRole('heading', { name: 'Class' });
    expect(screen.queryByRole('checkbox', { name: 'Pick Bog-kin' })).toBeNull();
    // Nothing is picked on the class step: Next explains it.
    await next(user);
    expect(heading()).toBe('Class');
  });

  it('on the "Calling as kindred" path (no Kindred step), picking Bog-kin saves the character’s kindred as bog folk', async () => {
    fenWorld({ grants: false });
    const user = openApp();
    await pastWho(user, { path: 'Calling as kindred', klass: 'Bog-kin' });
    await screen.findByRole('heading', { name: 'Gear' });
    expect(tam().race_ref).toBe('bog-folk');
  });
});

describe('Grants from the kindred (cs-2)', () => {
  it('a Lantern Warden whose kindred grants a roll on First charms gets a step titled Magic with a "From your kindred" group', async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, { path: 'Kindred, then calling', kindred: 'Bog folk', klass: 'Lantern Warden' });
    await screen.findByRole('heading', { name: 'Magic' });
    // A roll group: its Roll row under the title (final drafts D); the table's name on its own bar (dec-10 E, 20-E1).
    const groups = screen.queryAllByRole('group').filter((g) => g.querySelector('.roll-row')).map((g) => g.querySelector('.pick-group__title')?.textContent ?? '');
    expect(groups).toEqual(['From your kindred']);
    expect([...document.querySelectorAll('.book-tap-table .table-sheet__rows')].map((t) => t.getAttribute('aria-label'))).toEqual(['First charms']);
    expect(screen.queryByText(/From your class/)).toBeNull();
  });

  it('a Reed Witch of bog folk sees both "From your class" and "From your kindred" groups', async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, { path: 'Kindred, then calling', kindred: 'Bog folk', klass: 'Reed Witch' });
    await screen.findByRole('heading', { name: 'Magic' });
    // A roll group: its Roll row under the title (final drafts D); the table's name on its own bar (dec-10 E, 20-E1).
    const groups = screen.queryAllByRole('group').filter((g) => g.querySelector('.roll-row')).map((g) => g.querySelector('.pick-group__title')?.textContent ?? '');
    expect(groups).toContain('From your class');
    expect(groups).toContain('From your kindred');
    expect([...document.querySelectorAll('.book-tap-table .table-sheet__rows')].map((t) => t.getAttribute('aria-label'))).toEqual(['First whispers', 'First charms']);
  });

  it('a kindred’s starting item shows in Gear’s Given group as "from your kindred"', async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, { path: 'Kindred, then calling', kindred: 'Bog folk', klass: 'Lantern Warden' });
    await screen.findByRole('heading', { name: 'Magic' });
    // Take the roll later so the step lets us on.
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findByRole('heading', { name: 'Gear' });
    const given = screen.getByRole('group', { name: 'Yours already' });
    // Folded under its own group (final drafts D), marked Given with no Pick.
    expect(within(given).getByText('From your kindred', { selector: '.creation-fold__label' })).toBeTruthy();
    const row = within(given).getByText('Reed bundle').closest('.pick-row')!;
    expect(row.getAttribute('class')).toContain('pick-row--given');
    expect(row.querySelector('.pick-row__fit')?.textContent).toBe('from your kindred');
    // Taking it back isn't possible: a tap says why.
    await user.click(within(given).getByText('Reed bundle'));
    expect((await screen.findAllByText('Reed bundle comes with your kindred: it stays in the pack.')).length).toBeGreaterThan(0);
  });
});

describe('Changing the class from the review', () => {
  it('Change › on the class from Bog-kin to Lantern Warden lands on the Kindred step first, with the toast naming it', async () => {
    fenWorld({ grants: false });
    const user = openApp();
    await pastWho(user, { path: 'Kindred, then calling', kindred: 'Bog folk', klass: 'Bog-kin' });
    // On to the review, whatever steps come after Who they are.
    const send = () => screen.queryByRole('button', { name: 'Send to the GM' });
    for (let step = 0; step < 10 && !send(); step++) {
      // Each step (or the review) loads after a save: wait for its Next, or for the review's Send.
      await waitFor(() => expect(send() ?? screen.queryByRole('button', { name: 'Next' })).toBeTruthy(), { timeout: 5000 });
      if (!send()) await next(user);
    }
    await waitFor(() => expect(send()).toBeTruthy(), { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Change Kindred and class' }));
    await screen.findByRole('heading', { name: 'Class' });
    await pick(user, 'Lantern Warden');
    // The pick moves on at once: the Kindred step first, bog folk still picked, and the toast says why.
    await screen.findByRole('heading', { name: 'Kindred' });
    expect((await screen.findAllByText('Lantern Warden picked. Your kindred’s own traits are back: check your kindred, then Next.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: 'Pick Bog folk' }).getAttribute('aria-checked')).toBe('true');
    // Next: the class step with the warden picked; Next again goes on, not back to Kindred.
    await next(user);
    await screen.findByRole('heading', { name: 'Class' });
    expect(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }).getAttribute('aria-checked')).toBe('true');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Class'));
    expect(heading()).not.toBe('Kindred');
  });
});
