// @vitest-environment jsdom
// Creation's final drafts, slice B (plan m5b-creation-final-drafts, final draft 1): Scores and Adjust scores, on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { forgetAllKept } from './keptCreation.ts';

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
  forgetAllKept();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const NOTE = 'With two primes, the lower one sets the bonus.';

/** The invented setting, no method step; `rules` changes the rules set, `classes` patches a class by id. */
function fenWorld({ rules = {}, classes = {} }: { rules?: Record<string, unknown>; classes?: Record<string, Record<string, unknown>> } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name), data });
  for (const r of pack.rulesSets!) entry('rulesSet', { ...r, ...rules });
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', { ...c, ...(classes[String(c.id)] ?? {}) });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  let order = 0;
  for (const key of ['MUS', 'NIM', 'GRT', 'WIT', 'LORE', 'CHARM']) {
    world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label: key, type: 'number', choices: [], field_group: 'Abilities', sort_order: order++, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
  }
  world.signInAs(me);
}

function openApp(): User {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

async function toGuided(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: 'Scores', level: 1 });
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const hint = () => screen.getByRole('status', { name: 'Step status' }).textContent ?? '';
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tile = (name: string) => screen.getByRole('group', { name: `${name} score` });
const words = (name: string) => tile(name).querySelector('.score-tile__words')?.textContent ?? '';
const AVERAGE = 'Average';

async function typeScore(user: User, name: string, value: string) {
  const field = screen.getByLabelText(name);
  await user.clear(field);
  await user.type(field, value);
}

/** Scores typed (by full name), Bog folk, the Lantern Warden: Adjust scores. */
async function toAdjust(user: User, typed: Record<string, string>) {
  await toGuided(user);
  for (const [name, value] of Object.entries(typed)) await typeScore(user, name, value);
  await next(user);
  await pick(user, 'Bog folk');
  await pick(user, 'Lantern Warden');
  expect(heading()).toBe('Adjust scores');
}

describe('Scores (final draft 1)', () => {
  // Purpose: the step opens with one line of what it is (the app's, counting the scores, when the pack has none), then
  // the Roll row, then Help me choose, in that order.
  it('the line, then the Roll row, then Help me choose', async () => {
    fenWorld({ rules: { creationGuide: { scores: { help: 'Weigh Grit for hit points.' } } } });
    const user = openApp();
    await toGuided(user);
    const line = screen.getByText('Six numbers say what your character is naturally good at.');
    const roll = screen.getByText('Roll 2d8 at the table for each score, then enter what you rolled.');
    const help = screen.getByRole('button', { name: /Help me choose/ });
    expect(line.compareDocumentPosition(roll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(roll.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Purpose: an untouched score shows the average's line; stepping and stepping back keeps it gone (touched is a flag);
  // the foot counts the scores rolled.
  it('untouched tiles show the line; a step and a step back keep it gone; "N of 6 rolled"', async () => {
    fenWorld();
    const user = openApp();
    await toGuided(user);
    expect(words('Muscle')).toBe(AVERAGE);
    expect(hint()).toBe('0 of 6 rolled');
    const muscle = within(tile('Muscle'));
    await user.click(muscle.getByRole('button', { name: 'Raise Muscle' }));
    await user.click(muscle.getByRole('button', { name: 'Lower Muscle' }));
    expect((screen.getByLabelText('Muscle') as HTMLInputElement).value).toBe('9');
    expect(words('Muscle')).not.toBe(AVERAGE);
    expect(words('Wit')).toBe(AVERAGE);
    await typeScore(user, 'Wit', '12');
    expect(words('Wit')).toBe('+2 extra languages, literacy Reads');
    expect(hint()).toBe('2 of 6 rolled');
  });

  // Purpose: what was touched survives Leave and Continue where you left off (kept on the device with the picks).
  it('the touched scores are kept with the picks when the player leaves', async () => {
    fenWorld();
    let user = openApp();
    await toGuided(user);
    await typeScore(user, 'Wit', '12');
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: /^Save and leave/ }));
    cleanup();
    user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Scores', level: 1 });
    expect((screen.getByLabelText('Wit') as HTMLInputElement).value).toBe('12');
    expect(words('Wit')).not.toBe(AVERAGE);
    expect(words('Muscle')).toBe(AVERAGE);
    expect(hint()).toBe('1 of 6 rolled');
  });
});

describe('Adjust scores (final draft 1)', () => {
  // Purpose: the lead names the prime in bold and the rule in one breath; the rule's own note is behind Help me choose.
  it('the lead names the prime and the rule; Help me choose holds the rule’s note', async () => {
    fenWorld();
    const user = openApp();
    await toAdjust(user, { Wit: '16' });
    const lead = document.querySelector('.guided-instruction')!;
    expect(lead.querySelector('b')?.textContent).toBe('Your prime is Muscle');
    expect(lead.textContent).toBe('Your prime is Muscle, the Lantern Warden’s main score. Lower another score by 2 to raise your prime by 1. Nothing may go under 7.');
    await user.click(screen.getByRole('button', { name: /Help me choose/ }));
    expect(screen.getByText(/Lower a score that isn't your prime by 2 to raise your prime by 1\. Nothing goes under 7\. Fen rules p\. 4/)).toBeTruthy();
  });

  // Purpose: each tile shows only the control the rule allows: + on the prime, − on the others, none at or under the
  // floor, with the reason (the sign when already under); the modifier now and the nearest thresholds on each.
  it('only the allowed control on each tile; thresholds, the prime’s experience and the floor’s reason', async () => {
    fenWorld();
    const user = openApp();
    await toAdjust(user, { Muscle: '12', Wit: '16', Lore: '7', Charm: '5' });
    const mus = within(tile('Muscle'));
    expect(mus.getByText('Prime')).toBeTruthy();
    expect(mus.getByRole('button', { name: 'Raise Muscle by 1' })).toBeTruthy();
    expect(mus.queryByRole('button', { name: /^Lower Muscle/ })).toBeNull();
    // The prime's tile shows its experience, not the modifier (Design / Francis, 2026-11-07).
    expect(words('Muscle')).toBe('+5% experience now, +10% at 15');
    const wit = within(tile('Wit'));
    expect(wit.getByRole('button', { name: 'Lower Wit by 2' })).toBeTruthy();
    expect(wit.queryByRole('button', { name: /^Raise Wit/ })).toBeNull();
    expect(words('Wit')).toBe('+3 now, +2 at 14');
    // At the floor: no −, the reason after the thresholds.
    expect(within(tile('Lore')).queryByRole('button', { name: /^Lower Lore/ })).toBeNull();
    // A tile with no control shows the modifier now only (Design on #544).
    expect(words('Lore')).toBe("−1 now. At the floor: can't go lower");
    // Under the floor: no control at all, the sign and the reason.
    expect(within(tile('Charm')).queryAllByRole('button', { name: /^(Lower|Raise) Charm/ })).toHaveLength(0);
    expect(words('Charm')).toBe("Already under 7: can't be lowered");
    expect(tile('Charm').querySelector('.score-tile__words svg')).not.toBeNull();
    // A lowering alone is reversible at once (Design on #544): its own toast with Undo.
    await user.click(wit.getByRole('button', { name: 'Lower Wit by 2' }));
    expect(await screen.findByText('Wit 16 → 14: now raise Muscle by 1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(wit.getByText('16')).toBeTruthy();
    expect(hint()).toBe('No trades yet');
    // A trade: the raise's toast replaces the lowering's; the thresholds move live.
    await user.click(wit.getByRole('button', { name: 'Lower Wit by 2' }));
    await user.click(mus.getByRole('button', { name: 'Raise Muscle by 1' }));
    expect(await screen.findByText('Wit 16 → 14, Muscle 12 → 13')).toBeTruthy();
    expect(screen.queryByText('Wit 16 → 14: now raise Muscle by 1')).toBeNull();
    expect(words('Wit')).toBe('+2 now, +1 at 11');
  });

  // Purpose: with two primes the lead shows the pack's line on how they count; without one the app adds nothing.
  // Design on #564: without the pack's line, the rules set's own rule says which prime counts (the fixture's "lowest").
  it('two primes: both tagged with +, the pack’s line in the lead; without it, the rule’s words', async () => {
    fenWorld({ rules: { primeRequisiteNote: NOTE }, classes: { 'lantern-warden': { primeRequisites: ['MUS', 'WIT'] } } });
    const user = openApp();
    await toAdjust(user, { Wit: '11', Charm: '14' });
    const lead = document.querySelector('.guided-instruction')!.textContent ?? '';
    expect(lead).toBe(`Your primes are Muscle and Wit, the Lantern Warden’s main scores. ${NOTE} Lower another score by 2 to raise a prime by 1. Nothing may go under 7.`);
    const wit = within(tile('Wit'));
    expect(wit.getByText('Prime')).toBeTruthy();
    expect(wit.getByRole('button', { name: 'Raise Wit by 1' })).toBeTruthy();
    expect(wit.queryByRole('button', { name: /^Lower Wit/ })).toBeNull();
    // Neither tile says "Sets your experience" (creation follow-up, 2026-11-07): the pack's line in the lead explains.
    expect(words('Muscle')).not.toMatch(/Sets your experience/);
    expect(words('Wit')).not.toMatch(/Sets your experience/);
    expect(within(tile('Muscle')).getByText('Prime')).toBeTruthy();
    cleanup();
    world = createFakeDb();
    forgetCampaignSetting();
    forgetAllKept();
    fenWorld({ classes: { 'lantern-warden': { primeRequisites: ['MUS', 'WIT'] } } });
    const again = openApp();
    await toAdjust(again, { Wit: '11', Charm: '14' });
    expect(document.querySelector('.guided-instruction')!.textContent).toBe('Your primes are Muscle and Wit, the Lantern Warden’s main scores. With two primes the lower one sets your experience. Lower another score by 2 to raise a prime by 1. Nothing may go under 7.');
  });
});
