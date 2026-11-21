// @vitest-environment jsdom
// Gate bug 1 of the early gate walk (2026-11-05, docs/status/2026-11-05-gate-early-walk.md): guided creation's step
// counter counted Adjust scores whenever the setting had the trade as data, so a class that leaves no trade to make
// went from "Step 3" on Class to "Step 5" on Who they are. On the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json (every name and number invented).
//   With no trade left (the prime typed at the rule's cap), Class is step 3 and Who they are is step 4: no gap.
//   With a trade to make, Adjust scores is step 4 and Who they are step 5, as before.
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
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

/** The fixture's rules, kindreds and classes on a campaign (no sheet layout: Who they are asks only the name). */
function fenWorld() {
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
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  world.signInAs(me);
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const counter = () => document.querySelector('.step-counter')?.textContent ?? '';
const stepNumber = () => Number(/^Step (\d+)/.exec(counter())?.[1] ?? NaN);

/** Scores (MUS, the warden's prime, as given), Bog folk, then the warden's Pick; returns the class step's number. */
async function toClassPicked(user: User, mus: string): Promise<number> {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  const field = screen.getByLabelText('Muscle');
  await user.clear(field);
  await user.type(field, mus);
  await next(user);
  await pick(user, 'Bog folk');
  if (heading() === 'Kindred') await next(user);
  await screen.findByRole('heading', { name: 'Class' });
  const classStep = stepNumber();
  await pick(user, 'Lantern Warden');
  return classStep;
}

describe('the step counter counts Adjust scores only when it shows (gate walk 2026-11-05, bug 1; cr-3)', () => {
  it('with no trade left to make, Who they are comes straight after Class in the numbering (no gap)', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    // MUS at the rule's cap (15): the prime can't be raised, so there's no Adjust scores step.
    const classStep = await toClassPicked(user, '15');
    if (heading() === 'Class') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(classStep).toBe(3);
    expect(stepNumber()).toBe(classStep + 1);
  });

  it('with a trade to make, Adjust scores is the next number after Class, and Who they are the one after that', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    const classStep = await toClassPicked(user, '10');
    await screen.findByRole('heading', { name: 'Adjust scores' });
    expect(stepNumber()).toBe(classStep + 1);
    const adjustTotal = counter().replace(/^Step \d+ of /, '');
    await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(stepNumber()).toBe(classStep + 2);
    // Once the class is picked the total holds from Adjust scores to Who they are.
    expect(counter()).toBe(`Step ${classStep + 2} of ${adjustTotal}`);
  });
});

// Ruled B (Francis, 2026-11-05): no total until the class is picked ("Step 1" … "Step 3"); from the step after the
// pick "Step 4 of N", and N holds on every step after, the review included.
describe('the step total shows only once the class is picked, and then holds (ruled B 2026-11-05)', () => {
  it('Scores, Kindred and Class say "Step 1", "Step 2", "Step 3"; Who they are "Step 4 of N"; every later step keeps N', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    expect(counter()).toBe('Step 1');
    const field = screen.getByLabelText('Muscle');
    await user.clear(field);
    await user.type(field, '15');
    await next(user);
    await screen.findByRole('heading', { name: 'Kindred' });
    expect(counter()).toBe('Step 2');
    await pick(user, 'Bog folk');
    if (heading() === 'Kindred') await next(user);
    await screen.findByRole('heading', { name: 'Class' });
    expect(counter()).toBe('Step 3');
    await pick(user, 'Lantern Warden');
    if (heading() === 'Class') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    const total = /^Step 4 of (\d+)$/.exec(counter())?.[1];
    expect(total).toBeTruthy();
    await user.type(screen.getByLabelText('Name'), 'Tam');
    // Every step after Who they are, to the review: numbered on, the total unchanged.
    for (let at = 5; at <= 12; at++) {
      await next(user);
      await screen.findByText(new RegExp(`^Step ${at} of ${total}(, Review)?$`));
      if (/Review$/.test(counter())) break;
      const money = screen.queryByRole('textbox', { name: 'Starting coin' });
      if (money) await user.type(money, '10');
      const skip = screen.queryByRole('button', { name: 'Skip, leave blank' });
      if (skip) { await user.click(skip); continue; }
      const first = screen.queryAllByRole('checkbox', { name: /^Pick / })[0];
      if (first && first.getAttribute('aria-checked') !== 'true' && !screen.queryByRole('button', { name: 'Decide later' })) await user.click(first);
    }
    expect(counter()).toBe(`Step ${total} of ${total}, Review`);
  });
});
