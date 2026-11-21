// @vitest-environment jsdom
// The bugs of the second creation test (M5b step 0c, PR D; plan "Follow-up to the second test", 2026-11-02), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   Each step opens scrolled to its top: the page scrolls up when Who they are opens after the class.
//   A class gated by an optional rule (the fixture's kin callings) is offered only while the rule is on: off, it is
//   in no list, no folded group and no kindred's Open classes; on, it is a pick row like any other.
//   A kit gated by an optional rule (the fixture's quick bundle) is on Gear only while the rule is on.
//   A layout field whose fill is `ac` shows AC at creation: the setting's unarmoured AC plus the NIM modifier.
// (The score tiles' sizes are checked in a real browser: tests/layout/layout.spec.ts, "score tiles".)
import { cleanup, render, screen, within } from '@testing-library/react';
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
let scrolled: ReturnType<typeof vi.fn>;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  scrolled = vi.fn();
  vi.spyOn(window, 'scrollTo').mockImplementation(scrolled as unknown as typeof window.scrollTo);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean };

/** The fixture on a campaign: its rules, races, classes, gear, hooks and the two options this file is about. */
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
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const h of pack.hooks!) entry('hook', h);
  // The two gated options are always attached (default off), so "off" is the pack's default, as in a campaign.
  for (const o of pack.options!.filter((o) => ['fen-kin-callings', 'fen-quick-kit'].includes(String(o.id)))) entry('option', o);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: options, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => !['background', 'languages', 'hp', 'alignment', 'omen'].includes(f.key));
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
const derived = (label: string) => (screen.getByRole('button', { name: label }).closest('.derived-fields__row') as HTMLElement).querySelector('dd')!.textContent;
const toTop = () => scrolled.mock.calls.filter(([to]) => (to as ScrollToOptions | undefined)?.top === 0).length;

// The Scores step shows each ability's full name (cw-11).
const FULL_NAMES: Record<string, string> = { MUS: 'Muscle', NIM: 'Nimbleness', GRT: 'Grit', WIT: 'Wit', LORE: 'Lore', CHARM: 'Charm' };

async function typeScore(user: User, key: string, value: string) {
  const field = screen.getByLabelText(FULL_NAMES[key] ?? key);
  await user.clear(field);
  await user.type(field, value);
}

/** Scores (NIM as given), to the Kindred step. */
async function toKindred(user: User, nim = '9') {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await typeScore(user, 'NIM', nim);
  await next(user);
  expect(heading()).toBe('Kindred');
}

/** On to Who they are with Bog folk and the class named. */
async function toWho(user: User, { nim = '9', klass = 'Lantern Warden' } = {}) {
  await toKindred(user, nim);
  await pick(user, 'Bog folk');
  await next(user);
  await pick(user, klass);
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
}

describe('each step opens at its top (the second test, 2026-11-02)', () => {
  it('the page scrolls up as each step opens, Who they are included', async () => {
    fenWorld();
    const user = openApp();
    await toKindred(user);
    const atKindred = toTop();
    expect(atKindred).toBeGreaterThanOrEqual(2); // Scores, then Kindred.
    await pick(user, 'Bog folk');
    await next(user);
    expect(toTop()).toBe(atKindred + 1); // The class step.
    await pick(user, 'Lantern Warden');
    const beforeWho = toTop();
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(toTop()).toBeGreaterThan(beforeWho);
    expect(scrolled).toHaveBeenLastCalledWith({ top: 0 });
  });
});

describe('a class gated by an optional rule (ct-10)', () => {
  it('with the rule off the class is offered nowhere: not a row, not folded, not in the kindred’s Open classes', async () => {
    fenWorld();
    const user = openApp();
    await toKindred(user);
    await user.click(screen.getByRole('button', { name: /^Bog folk/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Bog folk' }));
    // The chips follow their sub-heading in the book format (dec-10 S3).
    const chips = () => [...(sheet.getByText('Open classes').nextElementSibling as HTMLElement).querySelectorAll('.chip')].map((c) => c.textContent);
    expect(chips()).toEqual(['Lantern Warden (to 8)', 'Reed Witch (to 6)', 'Mire Stalker (to 10)', 'Marsh Chaplain (to 8)', 'Fen Cantor (to 6, with the GM’s leave)']);
    await user.click(sheet.getByRole('button', { name: 'Pick Bog folk' }));
    expect(heading()).toBe('Class');
    expect(screen.queryByRole('checkbox', { name: 'Pick Bog-kin' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/bog-kin/i);
  });

  it('with the rule on the class is a pick row, and the kindred’s Open classes name it', async () => {
    fenWorld({ 'fen-kin-callings': 'on' });
    const user = openApp();
    await toKindred(user);
    await user.click(screen.getByRole('button', { name: /^Bog folk/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Bog folk' }));
    expect(sheet.getByRole('button', { name: 'Bog-kin (to 8)' })).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Pick Bog folk' }));
    expect(heading()).toBe('Class');
    // A one-of-many pick moves on: Bog-kin's Pick lands on the next step; Back shows it picked.
    await pick(user, 'Bog-kin');
    if (heading() !== 'Class') await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect(screen.getByRole('checkbox', { name: 'Pick Bog-kin' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('a kit gated by an optional rule (ct-10)', () => {
  async function toGear(user: User) {
    await toWho(user);
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
  }

  it('with the rule off the quick bundle isn’t on Gear; the calling’s own kit is', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    expect(screen.getByRole('button', { name: /^Warden's kit/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Quick bundle/ })).toBeNull();
  });

  it('with the rule on the quick bundle is a kit row any calling can take', async () => {
    fenWorld({ 'fen-quick-kit': 'on' });
    const user = openApp();
    await toGear(user);
    expect(screen.getByRole('button', { name: /^Quick bundle/ }).closest('.pick-row')!.textContent).toContain("A spear, a rope and two days' food, for anyone in a hurry.");
    expect(screen.getByRole('button', { name: /^Warden's kit/ })).toBeTruthy();
  });

  // Purpose (eq-9, area 3 order 13): one quick kit, each class its own rolls: a Lantern Warden taking the quick
  // bundle is asked for the Warden's roll and never sees the Reed Witch's.
  it("a Lantern Warden sees only the Warden's quick-kit roll", async () => {
    fenWorld({ 'fen-quick-kit': 'on' });
    const user = openApp();
    await toGear(user);
    await user.click(screen.getByRole('button', { name: /^Quick bundle/ }));
    expect(await screen.findByText(/Warden's light/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("Witch's book");
  });
});

describe('AC at creation (fill `ac`)', () => {
  it('is the unarmoured AC plus the NIM modifier, its parts beside it (ct-5): 10 with NIM +0, 11 with NIM +1', async () => {
    fenWorld();
    let user = openApp();
    await toWho(user); // NIM 9 → 10 with bog folk: +0.
    expect(derived('Armour')).toBe('10, unarmoured, Nimbleness +0');
    cleanup();
    world = createFakeDb();
    forgetCampaignSetting();
    fenWorld();
    user = openApp();
    await toWho(user, { nim: '12' }); // NIM 12 → 13: +1.
    expect(derived('Armour')).toBe('11, unarmoured, Nimbleness +1');
  });
});
