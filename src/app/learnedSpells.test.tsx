// @vitest-environment jsdom
// Spells learned above level 1, at creation (December step 1b; plan docs/plans/dec-1-creation.md, 1b), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json, the Reed Witch given a learnByLevel and spell
// slots, and one more 1st-level spell (Lily lamp). The campaign starts characters at a fixed level. Every name and
// number is invented.
//   A witch made at level 2 gets "Pick 1 more, for level 2" after the first spells; Next waits for it, and the pick
//   goes in the book and on the review with the first spells.
//   A witch made at level 1 gets no learned group.
//   Decide later with the learned pick still open puts the step on To finish, and the GM's card says so.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { reviewSections } from './reviewSections.ts';

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

/** The witch with a learnByLevel and a slot more at each row (1st level only up to level 3). */
function learningWitch(klass: Record<string, unknown>): Record<string, unknown> {
  if (klass.id !== 'reed-witch') return klass;
  const casting = klass.spellcasting as Record<string, unknown>;
  const rows = (klass.progression as Record<string, unknown>[]).map((r) => ({ ...r, spellSlots: r.level === 1 ? [1] : [2, 1] }));
  return { ...klass, progression: rows, spellcasting: { ...casting, learnByLevel: [{ level: 2, count: 1 }, { level: 3, count: 1 }] } };
}

/** The fixture's setting on a campaign that starts characters at `level`. */
function fenWorld(level: number) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { startLevel: 'fixed', startLevelFixed: level } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', learningWitch(c));
  for (const s of pack.spells!) entry('spell', s);
  entry('spell', { id: 'lily-lamp', name: 'Lily lamp', lists: { 'witch-list': 1 }, blurb: 'A pale glow on still water.' });
  for (const l of pack.spellLists!) entry('spellList', l);
  for (const t of pack.tables!) entry('table', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
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
/** A tap on a spell's Pick, or, for "3: Damp wick", on that row of a rolled table (dec-10 E: the book's tapped table). */
const pick = (user: User, name: string) => {
  const rolled = /^(\d+(?:–\d+)?): (.+)$/.exec(name);
  return user.click(rolled ? screen.getByRole('radio', { name: new RegExp(`^${rolled[1]!.replace('–', ' to ')} ${rolled[2]}`) }) : screen.getByRole('checkbox', { name: `Pick ${name}` }));
};
const hint = () => screen.getByRole('status', { name: 'Step status' }).textContent ?? '';
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const group = (name: RegExp) => within(screen.getByRole('group', { name }));
const groupTitles = () => [...document.querySelectorAll('.pick-group__title')].map((t) => t.textContent ?? '');
const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;

/** Scores, Kindred, the witch, Adjust scores and Who they are (named Tam), to First spells. */
async function toSpells(user: User) {
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

/** The first spells, all picked: Reed whisper and Mire grip, the roll's 3 (Damp wick), two cantrips. */
async function firstSpells(user: User) {
  await user.click(group(/^Pick 2/).getByRole('checkbox', { name: 'Pick Reed whisper' }));
  await user.click(group(/^Pick 2/).getByRole('checkbox', { name: 'Pick Mire grip' }));
  await pick(user, '3: Damp wick');
  await pick(user, 'Frog chorus');
  await pick(user, 'Knot charm');
}

describe('Spells learned above level 1 (dec-1b)', () => {
  // Purpose: a book caster made at level 2 gets one more titled group after the first spells, Next waits for it, the pick goes in the book, and the review lists it with the first spells.
  it('a level-2 witch picks "Pick 1 more, for level 2"; the spell is in the book and on the review', async () => {
    fenWorld(2);
    const user = openApp();
    await toSpells(user);
    // After the first spells' groups, one learned group (not level 3: the campaign starts at 2).
    expect(groupTitles().at(-1)).toBe('Pick 1 more, for level 2');
    expect(groupTitles().filter((t) => /for level|Learned/.test(t))).toEqual(['Pick 1 more, for level 2']);
    const learned = () => group(/^Pick 1 more, for level 2/);
    expect(learned().getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Pick Reed whisper', 'Pick Mire grip', 'Pick Damp wick', 'Pick Lily lamp']);
    await firstSpells(user);
    expect(hint()).toBe('1 spell to go');
    await next(user);
    expect((await screen.findAllByText('1 spell to go, or Decide later')).length).toBeGreaterThan(0);
    // A spell already in the book from the first spells isn't offered again (#633 picture review): only Lily lamp is left.
    expect(learned().getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual(['Pick Lily lamp']);
    expect(learned().getByText('0 of 1 picked')).toBeTruthy();
    await user.click(learned().getByRole('checkbox', { name: 'Pick Lily lamp' }));
    expect(learned().getByText('1 of 1 picked')).toBeTruthy();
    expect(hint()).toBe('7 spells in your book');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    expect(tam().spell_book).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'lily-lamp', 'damp-wick', 'frog-chorus', 'knot-charm']);

    // On to the review: every later step put off or passed.
    for (let n = 0; n < 12; n++) {
      // Each step loads first: wait for its foot (or the review's).
      await screen.findAllByRole('button', { name: /^(Decide later|Next|Send to the GM)$/ });
      if (screen.queryByRole('button', { name: 'Send to the GM' })) break;
      const later = screen.queryByRole('button', { name: 'Decide later' });
      await user.click(later ?? screen.getByRole('button', { name: 'Next' }));
    }
    await screen.findByRole('button', { name: 'Send to the GM' });
    const spells = screen.getAllByRole('heading', { level: 2 }).find((h) => (h.textContent ?? '').startsWith('First spells'))!.closest('section') as HTMLElement;
    const lines = [...spells.querySelectorAll('.creation-review__line')].map((p) => p.textContent ?? '');
    expect(lines.join(' | ')).toContain('Lily lamp');
    expect(lines.join(' | ')).toContain('Mire grip');
    // Read back from the book, the step's check passes: nothing is "to go" on the review.
    // (The toast from the earlier Next may still be up; the review itself says nothing is to go.)
    expect(screen.queryAllByText(/spells? to go/).filter((el) => !el.closest('.toast'))).toEqual([]);
  });

  // Purpose: a book caster made at level 1 is unchanged: no learned group.
  it('a level-1 witch gets no learned group', async () => {
    fenWorld(1);
    const user = openApp();
    await toSpells(user);
    expect(groupTitles().some((t) => /for level|Learned/.test(t))).toBe(false);
    await firstSpells(user);
    expect(hint()).toBe('6 spells in your book');
  });

  // Purpose: Decide later with the learned pick open puts the step on To finish, as the first spells' is, and the GM's card lists it.
  it('Decide later with the learned pick open puts First spells on To finish, and the GM’s card says so', async () => {
    fenWorld(2);
    const user = openApp();
    await toSpells(user);
    await firstSpells(user);
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findByRole('heading', { name: 'Gear' });
    expect(tam().spell_book).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick', 'frog-chorus', 'knot-charm']);
    expect((tam().creation as { toFinish?: string[] }).toFinish).toEqual(['spells']);
    // The GM's card builds its sections with reviewSections: the open step is on its To finish line.
    const sections = reviewSections({ name: 'Tam', level: 2, hpMax: null, backstory: '', fields: {}, fieldDefs: [], editedFields: [], creation: tam().creation, made: { way: 'guided', kinds: [], scores: null, gear: null, over: null }, flagged: [], showHidden: true });
    expect(sections.find((s) => s.id === 'details')!.lines.map((l) => l.text)).toContain('To finish: First spells');
  });
});
