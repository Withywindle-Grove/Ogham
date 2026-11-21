// @vitest-environment jsdom
// A class change from the review walks the new class's own steps (after-test A3), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json with a talents field for reed witches only (`forClasses`), fed by a
// trait list. Every name and number is invented.
//   Changed from a Lantern Warden to a Reed Witch on the review, the walk asks the witch's talents before the review
//   comes back (the steps are worked out for the NEW class's fields, not the old one's).
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; forClasses?: string[] };
const TALENTS: LayoutField = { key: 'talents', label: 'Witch talents', type: 'list', group: 'Who they are', forClasses: ['reed-witch'] };
const WITCH_TALENTS = {
  id: 'witch-talents',
  name: 'Witch talents',
  die: 'd4',
  entries: [
    { id: 'reed-whistle', name: 'Reed whistle', min: 1, max: 2, blurb: 'Calls the herons.' },
    { id: 'mist-step', name: 'Mist step', min: 3, max: 4, blurb: 'Walks unseen in fog.' },
  ],
};

/** The fixture with the witch's talents, on a campaign; the background fed by the bog folk's list. */
function fenWorld() {
  const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
  const template = pack.fieldTemplates![0]!;
  template.fields = [...(template.fields as LayoutField[]), TALENTS];
  pack.traitLists = [...pack.traitLists!, WITCH_TALENTS];
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
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const layout = (template.fields as LayoutField[]).filter((f) => f.key !== 'hp' && f.key !== 'omen');
  layout.forEach((f, order) => {
    const fromList = f.key === 'background' ? 'fen-backgrounds-bog-folk' : f.key === 'talents' ? 'witch-talents' : null;
    const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
  });
  world.signInAs(me);
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const atReview = () => screen.queryByRole('button', { name: 'Send to the GM' }) !== null;

/** A Lantern Warden walked to the review: the witch's talents are never asked of a warden. */
async function wardenToReview(user: User) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, 'Bog folk');
  await next(user);
  await pick(user, 'Lantern Warden');
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
  await user.type(screen.getByLabelText('Name'), 'Tam');
  await pick(user, 'Reed');
  await next(user);
  await waitFor(() => expect(heading()).not.toBe('Who they are'));
  expect(await walk(user)).not.toContain('Witch talents');
  await screen.findByRole('button', { name: 'Send to the GM' });
}

/**
 * Walks the later steps (Decide later where there is one, else what the step needs, then Next) until the review or
 * the step titled `stopAt`; the titles walked, in order.
 */
async function walk(user: User, stopAt?: string): Promise<string[]> {
  const seen: string[] = [];
  for (let n = 0; n < 12; n++) {
    if (atReview()) return seen;
    const now = heading();
    seen.push(now);
    if (now === stopAt) return seen;
    const later = screen.queryByRole('button', { name: 'Decide later' });
    if (later) await user.click(later);
    else {
      const coin = screen.queryByRole('textbox', { name: 'Starting coin' });
      if (coin) {
        await user.clear(coin);
        await user.type(coin, '100');
      }
      const tongue = screen.queryByRole('checkbox', { name: 'Pick Reedspeak' });
      if (tongue && tongue.getAttribute('aria-checked') !== 'true') await user.click(tongue);
      await next(user);
    }
    await waitFor(() => expect(atReview() || heading() !== now).toBe(true));
  }
  return seen;
}

describe('a class change from the review walks the new class’s steps (after-test A3)', () => {
  it('a warden changed to a reed witch is asked the witch’s talents before the review comes back', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await wardenToReview(user);
    await user.click(screen.getByRole('button', { name: 'Change Class' }));
    await screen.findByRole('heading', { name: 'Class' });
    await pick(user, 'Reed Witch');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    // The later steps are walked again, until the talents or the review.
    await waitFor(() => expect(heading()).not.toBe('Class'));
    expect(await walk(user, 'Witch talents')).toContain('Witch talents');
  });
});
