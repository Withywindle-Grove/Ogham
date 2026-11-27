// @vitest-environment jsdom
// First spells on the creation step shell (M5b step 0c, slice 4; cr-13; mockup creation/05), on the invented fixture
// pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   A book caster gets the step after Who they are, with Given, Pick N and the cantrips; Next says what's left and
//   writes the spell book.
//   A class that doesn't cast at level 1 (a non-caster, or a divine caster from level 2) has no step.
//   Decide later writes what's picked and puts First spells on the To finish list.
//   A player reads the tables the pack marks `"gmOnly": false` (fs-1, 2026-11-02) and rolls on them, one group per
//   table (fs-3); a table the pack doesn't share is said so, and doesn't hold Next up. The roll itself (ranges first,
//   tapped, a duplicate says "already yours: roll again") is tested on the step with the table.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { NO_PICKS, firstSpellsPlan, type FirstSpellsPicks } from '../modules/characters/firstSpells.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { FirstSpellsStep } from './FirstSpellsStep.tsx';

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

/**
 * The fixture's setting on a campaign, plus a GM-only table (Bog omens). A player reads only the tables marked
 * `"gmOnly": false` (the fake database applies the rule); `shared: false` strips the mark, as a pack that forgot it.
 */
function fenWorld({ shared = true }: { shared?: boolean } = {}) {
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
  for (const s of pack.spells!) entry('spell', s);
  for (const l of pack.spellLists!) entry('spellList', l);
  for (const t of pack.tables!) entry('table', shared ? t : { ...t, gmOnly: undefined });
  entry('table', { id: 'bog-omens', name: 'Bog omens', die: 'd6', rows: [{ min: 1, max: 6, result: 'A heron, still' }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  // The layout's fields without the ones later steps own, and without the leaning (this test is about spells).
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
/** A rolled table's rows (dec-10 E), by the table's name. */
const table = (name: string) => within(screen.getByRole('group', { name }));
const hint = () => screen.getByRole('status', { name: 'Step status' }).textContent ?? '';
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const group = (name: RegExp) => within(screen.getByRole('group', { name }));
/** The titles of the step's roll groups, in order. */
const rollGroups = () => [...document.querySelectorAll('.book-tap-table .table-sheet__rows')].map((g) => g.getAttribute('aria-label') ?? '');

/** Scores, Kindred, the class, Adjust scores and Who they are (named Tam), to the step after it. */
async function pastWho(user: User, klass: string) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  await next(user);
  await pick(user, 'Bog folk');
  await next(user);
  await pick(user, klass);
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
  await user.type(screen.getByLabelText('Name'), 'Tam');
  await next(user);
}

const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;

describe('First spells (cr-13)', () => {
  it('a book caster picks spells and cantrips; Next explains what is left, then writes the spell book', async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, 'Reed Witch');
    await screen.findByRole('heading', { name: 'First spells' });
    // The pack's why-line and the groups.
    expect(screen.getByText('The spells you carry out of your training.')).toBeTruthy();
    // What the class gives is marked Given, with no Pick (final drafts D).
    expect(group(/^From your class/).getByText('Given')).toBeTruthy();
    expect(group(/^From your class/).queryByRole('checkbox', { name: 'Pick Glimmer' })).toBeNull();
    expect(group(/^Pick 2/).getAllByRole('checkbox')).toHaveLength(3);
    expect(group(/^Level 0: pick 2/).getAllByRole('checkbox')).toHaveLength(3);
    // The roll's table is shared with players (fs-1): its ranges are here, and the roll is named as a roll to go
    // (walk fix, ruled 2026-11-12; before, it counted as a spell).
    expect(table('First whispers').getAllByRole('radio')).toHaveLength(4);
    expect(hint()).toBe('2 spells, 1 roll and 2 level 0 spells to go');
    await next(user);
    expect((await screen.findAllByText('2 spells, 1 roll and 2 level 0 spells to go, or Decide later')).length).toBeGreaterThan(0);
    expect(heading()).toBe('First spells');

    await pick(user, 'Reed whisper');
    await pick(user, 'Mire grip');
    // A third pick past the count is explained.
    await pick(user, 'Damp wick');
    expect((await screen.findAllByText('2 of 2 picked: take one off to pick another.')).length).toBeGreaterThan(0);
    await pick(user, 'Frog chorus');
    await pick(user, 'Knot charm');
    expect(hint()).toBe('Roll d4 at the table, then tap what it shows');
    await pick(user, '3: Damp wick');
    expect(hint()).toBe('6 spells in your book');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' }); // the step after (slice 5)
    expect(tam().spell_book).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick', 'frog-chorus', 'knot-charm']);
    expect(world.tables.events.some((e) => e.type === 'creation.spellBook.set')).toBe(true);
  });

  it("a player sees the class's shared table and no other: the GM-only Bog omens is nowhere on the step", async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, 'Reed Witch');
    await screen.findByRole('heading', { name: 'First spells' });
    expect(rollGroups()).toEqual(['First whispers']);
    expect(screen.queryByText(/Bog omens|A heron, still/)).toBeNull();
    // Hidden means hidden: the table isn't in what the player's device reads at all (the stone kin's shared creation tables, cs-1, aside).
    const read = await world.db.from('library_entries').select('pack_entry_id').eq('kind', 'table');
    expect((read.data ?? []).map((r: { pack_entry_id: string }) => r.pack_entry_id).filter((id: string) => !id.startsWith('stone-kin-')).sort()).toEqual(['first-charms', 'first-whispers']);
  });

  it('a class rolling on two tables (fs-3) gets two groups, in the pack’s order, one roll each', async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, 'Fen Cantor');
    await screen.findByRole('heading', { name: 'First spells' });
    expect(rollGroups()).toEqual(['First whispers', 'First charms']);
    expect(hint()).toBe('Roll d4 at the table, then tap what it shows');
    await user.click(table('First whispers').getByRole('radio', { name: /^2 Mire grip/ }));
    expect(hint()).toBe('Roll d2 at the table, then tap what it shows');
    // The second table's Mire grip is now a duplicate; the whole-book row goes in as two spells.
    const charms = table('First charms');
    expect(charms.getByRole('radio', { name: /^2 Mire grip/ }).textContent).toContain('Already yours: roll again');
    await user.click(charms.getByRole('radio', { name: /^1 Light and dark/ }));
    expect(hint()).toBe('3 spells in your book');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    expect(tam().spell_book).toEqual(['mire-grip', 'glimmer', 'damp-wick']);
  });

  it("a row opens the spell's full rules, with Pick at its foot", async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, 'Reed Witch');
    await screen.findByRole('heading', { name: 'First spells' });
    await user.click(group(/^Pick 2/).getByRole('button', { name: /^Mire grip/ }));
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText('One foe in range is held fast by the mud until it breaks free.')).toBeTruthy();
    expect(sheet.getByText('Saves')).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Pick Mire grip' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(group(/^Pick 2/).getByRole('checkbox', { name: 'Pick Mire grip' }).getAttribute('aria-checked')).toBe('true');
  });

  it('a class that does not cast at level 1 has no step: a non-caster, and a divine caster whose spells come at level 2', async () => {
    for (const klass of ['Lantern Warden', 'Marsh Chaplain']) {
      cleanup();
      world = createFakeDb();
      forgetCampaignSetting();
      window.history.replaceState(null, '', '/');
      fenWorld();
      const user = openApp();
      await pastWho(user, klass);
      await screen.findByRole('heading', { name: 'Gear' }); // the step after (slice 5)
      expect(screen.queryByRole('heading', { name: 'First spells' })).toBeNull();
      expect(tam().spell_book ?? []).toEqual([]);
    }
  });

  it('a skipped First spells reached by Back says why: a level lowered on Who they are leaves the class no spells', async () => {
    // Purpose: L5 (clo-5, clo-17): the steps were set at level 2; lowered to 1, First spells has nothing, Next passes it,
    // and Back onto it shows the app's line naming the class in the singular, with "Nothing to choose here" once.
    fenWorld();
    // The chaplain given one prayer when the spells come (level 2), so a level-2 chaplain has the step.
    const chaplain = world.tables.library_entries.find((e) => e.pack_entry_id === 'marsh-chaplain')!;
    const casting = (chaplain.data as { spellcasting: Record<string, unknown> }).spellcasting;
    chaplain.data = { ...(chaplain.data as Record<string, unknown>), spellcasting: { ...casting, firstSpells: { given: ['lantern-blessing'] } } };
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    await next(user);
    await pick(user, 'Bog folk');
    await next(user);
    await pick(user, 'Marsh Chaplain');
    await next(user);
    if (heading() === 'Adjust scores') await next(user);
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await user.click(screen.getByRole('button', { name: 'More starting level' }));
    await next(user);
    await screen.findByRole('heading', { name: 'First spells' });
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.click(screen.getByRole('button', { name: 'Less starting level' }));
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'First spells' });
    expect(document.querySelector('.creation-step__why')?.textContent).toContain('A Marsh Chaplain has no spells to pick.');
    expect(hint()).toBe('Nothing to choose here');
    expect(screen.getAllByText(/Nothing to choose here/)).toHaveLength(1);
    expect(screen.queryByText('Skipped')).toBeNull();
  });

  it('Decide later writes what is picked so far and puts First spells on the To finish list', async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, 'Reed Witch');
    await screen.findByRole('heading', { name: 'First spells' });
    await pick(user, 'Mire grip');
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findByRole('heading', { name: 'Gear' }); // the step after (slice 5)
    expect(tam().spell_book).toEqual(['glimmer', 'mire-grip']);
    expect((tam().creation as { toFinish?: string[] }).toFinish).toEqual(['spells']);
  });

  it("a table the pack doesn't share (no gmOnly: false): the group says so, and Next doesn't wait for it", async () => {
    fenWorld({ shared: false });
    const user = openApp();
    await pastWho(user, 'Reed Witch');
    await screen.findByRole('heading', { name: 'First spells' });
    expect(group(/^Rolled at the table/).getByText(/a table this setting doesn't share with players \("first-whispers"\)/)).toBeTruthy();
    await pick(user, 'Reed whisper');
    await pick(user, 'Mire grip');
    await pick(user, 'Frog chorus');
    await pick(user, 'Dry boots');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' }); // the step after (slice 5)
    expect(tam().spell_book).toEqual(['glimmer', 'reed-whisper', 'mire-grip', 'frog-chorus', 'dry-boots']);
  });

  // Back from the first step after Who they are opens it again on the draft (the third test, ct3-5); Next comes back
  // to First spells with the picks kept.
  it('Back on First spells opens Who they are on the draft, and Next comes back with the picks kept', async () => {
    fenWorld();
    const user = openApp();
    await pastWho(user, 'Reed Witch');
    await screen.findByRole('heading', { name: 'First spells' });
    await pick(user, 'Mire grip');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'First spells' });
    expect(world.tables.actors.filter((a) => a.name === 'Tam')).toHaveLength(1);
    expect(group(/^Pick 2/).getByRole('checkbox', { name: 'Pick Mire grip' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('First spells: the roll, with the table readable (cr-13; mockup creation/05 §2)', () => {
  const entry = (e: Record<string, unknown>) => ({ packEntryId: String(e.id), name: String(e.name), data: e });
  const plan = firstSpellsPlan(entry(pack.classes!.find((c) => c.id === 'reed-witch')!), 1, {
    spells: pack.spells!.map(entry),
    lists: pack.spellLists!.map(entry),
    tables: pack.tables!.map(entry),
    choices: {},
  })!;

  function Step({ onSave }: { onSave: (book: string[]) => Promise<boolean> }) {
    const [picks, setPicks] = useState<FirstSpellsPicks>(NO_PICKS);
    return (
      <ToastHost>
        <FirstSpellsStep plan={plan} picks={picks} onPicks={setPicks} title="First spells" counter={{ at: 7, of: 9 }} why="Why" help={null} level={1} onBack={() => undefined} onSave={onSave} />
      </ToastHost>
    );
  }

  it("the roll is the book's tapped table: the Roll row's ruled words, the table's name on its bar alone, the die over its column", () => {
    // Purpose (dec-10 E, picture 20-E2): the table's bar carries its name, so no heading says it a second time; the Roll
    // row reads "Roll d4, then tap the row."; the head row names the die and the table's column (the pack's, else
    // "Result"); each row keeps the build's ⓘ beside it.
    render(<Step onSave={async () => true} />);
    expect(screen.getByText('Roll d4, then tap the row.')).toBeTruthy();
    expect([...document.querySelectorAll('.book-tap-head__bar')].map((b) => b.textContent)).toEqual(['First whispers']);
    expect([...document.querySelectorAll('.pick-group__title')].map((t) => t.textContent)).not.toContain('First whispers');
    expect(document.querySelector('.book-tap-head__row')?.textContent).toMatch(/^d4/);
    expect(screen.getByRole('button', { name: 'Damp wick: read it' })).toBeTruthy();
  });

  it('the roll is tapped, ranges first; a duplicate says "already yours: roll again"; the rolled spell goes in the book', async () => {
    const saved: string[][] = [];
    const user = userEvent.setup();
    render(
      <Step
        onSave={async (book) => {
          saved.push(book);
          return true;
        }}
      />,
    );
    const roll = table('First whispers');
    // The given spell's row is a duplicate: it says so, and a tap answers.
    expect(roll.getByRole('radio', { name: /^4 Glimmer/ }).textContent).toContain('Already yours: roll again');
    await user.click(roll.getByRole('radio', { name: /^4 Glimmer/ }));
    expect((await screen.findAllByText('Already yours: roll again.')).length).toBeGreaterThan(0);
    await pick(user, 'Reed whisper');
    await pick(user, 'Mire grip');
    await pick(user, 'Frog chorus');
    await pick(user, 'Knot charm');
    expect(hint()).toBe('Roll d4 at the table, then tap what it shows');
    await user.click(roll.getByRole('radio', { name: /^3 Damp wick/ }));
    expect(hint()).toBe('6 spells in your book');
    // One count per step (P26a): the foot's; the roll's group says no "1 of 1 tapped".
    expect(roll.queryByText(/tapped/)).toBeNull();
    await next(user);
    expect(saved).toEqual([['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick', 'frog-chorus', 'knot-charm']]);
  });
});

// of-2's safety net (si-1): the cantrips' level has no spells in the campaign's packs.
describe('First spells: an empty list level (of-2)', () => {
  const entry = (e: Record<string, unknown>) => ({ packEntryId: String(e.id), name: String(e.name), data: e });
  const witch = entry(pack.classes!.find((c) => c.id === 'reed-witch')!);
  const casting = witch.data.spellcasting as Record<string, unknown>;
  const atEmpty = { ...witch, data: { ...witch.data, spellcasting: { ...casting, known: { ...(casting.known as object), listLevel: 7 } } } };
  const plan = firstSpellsPlan(atEmpty, 1, { spells: pack.spells!.map(entry), lists: pack.spellLists!.map(entry), tables: pack.tables!.map(entry), choices: {} })!;

  function Step({ onSave }: { onSave: (book: string[]) => Promise<boolean> }) {
    const [picks, setPicks] = useState<FirstSpellsPicks>(NO_PICKS);
    return (
      <ToastHost>
        <FirstSpellsStep plan={plan} picks={picks} onPicks={setPicks} title="First spells" counter={{ at: 7, of: 9 }} why="Why" help={null} level={1} onBack={() => undefined} onSave={onSave} />
      </ToastHost>
    );
  }

  // Purpose: the known group (named by its level, "Level 7", lv-1) says there are no spells at that level, asks for no
  // picks, and Next writes the book.
  it('says "No spells at this level in your packs" and lets Next go on without cantrips', async () => {
    const saved: string[][] = [];
    const user = userEvent.setup();
    render(
      <Step
        onSave={async (book) => {
          saved.push(book);
          return true;
        }}
      />,
    );
    const cantrips = group(/^Level 7/);
    expect(cantrips.getByText('No spells at this level in your packs.')).toBeTruthy();
    expect(cantrips.queryByText(/picked/)).toBeNull();
    await pick(user, 'Reed whisper');
    await pick(user, 'Mire grip');
    await user.click(table('First whispers').getByRole('radio', { name: /^3 Damp wick/ }));
    expect(hint()).toBe('4 spells in your book');
    await next(user);
    expect(saved).toEqual([['glimmer', 'reed-whisper', 'mire-grip', 'damp-wick']]);
  });
});

// F45, Francis's option B (2026-11-10): a class with powers known by level and no first spells gets the step.
describe('Magic: known powers standing alone (F45, option B)', () => {
  const entry = (e: Record<string, unknown>) => ({ packEntryId: String(e.id), name: String(e.name), data: e });
  const emberList = { packEntryId: 'ember-list', name: 'Ember whispers', data: { levels: [{ level: 1, spells: ['glimmer', 'reed-whisper', 'mire-grip'] }] } };
  const listener = { packEntryId: 'ember-listener', name: 'Ember Listener', data: { spellcasting: { listId: 'ember-list', fromLevel: 1, known: { byLevel: [{ level: 1, count: 2 }], listLevel: 1 } } } };
  const plan = firstSpellsPlan(listener, 1, { spells: pack.spells!.map(entry), lists: [...pack.spellLists!.map(entry), emberList], tables: [], choices: {} })!;

  // Purpose: the group is headed with the list's name, the foot counts down (sp-2), and Next keeps the two powers picked.
  it('heads the group "Ember whispers: pick 2", counts down "2 to go", "1 to go", and Next writes the two picked', async () => {
    const saved: string[][] = [];
    const user = userEvent.setup();
    function Step() {
      const [picks, setPicks] = useState<FirstSpellsPicks>(NO_PICKS);
      const onSave = async (book: string[]) => {
        saved.push(book);
        return true;
      };
      return (
        <ToastHost>
          <FirstSpellsStep plan={plan} picks={picks} onPicks={setPicks} title="Magic" counter={{ at: 7, of: 9 }} why="Why" help={null} level={1} onBack={() => undefined} onSave={onSave} />
        </ToastHost>
      );
    }
    render(<Step />);
    expect(screen.queryByRole('group', { name: /^Level 0/ })).toBeNull();
    expect(group(/^Ember whispers: pick 2/).getAllByRole('checkbox')).toHaveLength(3);
    expect(hint()).toBe('2 to go');
    await pick(user, 'Glimmer');
    expect(hint()).toBe('1 to go');
    await pick(user, 'Mire grip');
    expect(hint()).toBe('All picked: 2 yours');
    await next(user);
    expect(saved).toEqual([['glimmer', 'mire-grip']]);
  });

  // Purpose: a class that may know more powers than the setting offers is told "Only 3 at this level in your setting." (sp-2).
  it('says "Only 3 at this level in your setting." when the class may know 4', () => {
    const four = { ...listener, data: { spellcasting: { ...listener.data.spellcasting, known: { byLevel: [{ level: 1, count: 4 }], listLevel: 1 } } } };
    const short = firstSpellsPlan(four, 1, { spells: pack.spells!.map(entry), lists: [...pack.spellLists!.map(entry), emberList], tables: [], choices: {} })!;
    render(
      <ToastHost>
        <FirstSpellsStep plan={short} picks={NO_PICKS} onPicks={() => undefined} title="Ember whispers" counter={{ at: 7, of: 9 }} why="Why" help={null} level={1} onBack={() => undefined} onSave={async () => true} />
      </ToastHost>,
    );
    // The step is the list's own ("Ember whispers"): its group drops the repeat (the lead's one rule, 2026-11-14).
    expect(group(/^Pick 3/).getByText('Only 3 at this level in your setting.')).toBeTruthy();
    expect(screen.queryByText(/choices at this level/)).toBeNull();
  });
});
