// @vitest-environment jsdom
// A kindred's names, trinket and details at creation and on the sheet (cs-1, design/rulings/m5b-0c-creation-survey-
// 2026-11-03.md; mockup creation/11), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json: the
// stone kin carry a name table (first name · surname), a trinket table, two detail tables, a growth and their age,
// height and weight dice; the bog folk carry none. Every name and number is invented.
//   Roll for a name (R3-1) fills the name from a cell marked in each column; a kindred without a name table has no button.
//   The trinket is rolled in Gear: the number typed on the long table picks its row, and it becomes an item in the pack;
//   Change swaps it (one trinket in the pack); Undo puts the old one back.
//   The Details step can be skipped and never blocks Send; a kindred with nothing for it has no Details step.
//   A picked detail and a typed age show on the review and on the sheet, and can be changed there.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { tableOf, type CharacterDetails, type CreationTable } from '../modules/characters/kindredTables.ts';
import { CreationLeave } from '../ui/creation.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { DetailsStep, usualCaption, withUsual } from './KindredTables.tsx';
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
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[]; required?: boolean; from?: string };

/** The fixture on a campaign (its tables too), its fields as the importer makes them. */
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
  for (const h of pack.hooks!) entry('hook', h);
  for (const i of pack.items!) entry('item', i);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  for (const t of pack.tables!) entry('table', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  (pack.fieldTemplates![0]!.fields as LayoutField[])
    .filter((f) => f.key !== 'hp')
    .forEach((f, order) => {
      const fromList = f.from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.from) ? f.from : null;
      const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
    });
  world.signInAs(me);
  return { gm, me, campaign };
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tam = () => world.tables.actors.find((a) => a.name === 'Tam' || a.name === 'Bramble Mudfoot')!;
const tamLines = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id);

/** Scores (WIT 6: no extra language), the kindred, the warden, Adjust scores, to Who they are. */
async function toWho(user: User, race: string) {
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(await screen.findByRole('button', { name: 'Create your character' }));
  await user.click(await screen.findByRole('button', { name: /^Guided/ }));
  await screen.findByRole('heading', { name: /^Scores/ });
  const wit = screen.getByLabelText('Wit');
  await user.clear(wit);
  await user.type(wit, '6');
  await next(user);
  await pick(user, race);
  await next(user);
  await pick(user, 'Lantern Warden');
  await next(user);
  if (heading() === 'Adjust scores') await next(user);
  await screen.findByRole('heading', { name: 'Who they are' });
}

/** Who they are (Tam, leaning Reed) to Gear with the money typed. */
async function toGear(user: User, race: string) {
  await toWho(user, race);
  await user.type(screen.getByLabelText('Name'), 'Tam');
  await pick(user, 'Reed');
  await next(user);
  await screen.findByRole('heading', { name: 'Gear' });
  await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
  await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '100');
}

/** On from Gear through the background list to the step after it. */
async function pastGear(user: User) {
  await next(user);
  await screen.findByRole('heading', { name: /backgrounds$/ });
  await pick(user, heading().startsWith('Stone') ? '1–2: Causeway mason' : '4–5: Reed cutter');
  await next(user);
}

describe('the Name field’s roll (cs-1)', () => {
  // Purpose (R3-1): the Name field has its placeholder and one Roll for a name button (no fold); the one table opens as
  // a sheet at once, with one tab per part and no number box; a tap only marks a row; Use this name fills the field in
  // part order, replacing what was typed, and says where it came from.
  it('Roll for a name opens the table; Use this name fills the field from the parts tapped and says where it came from', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user, 'Stone kin');
    expect(screen.getByLabelText('Name').getAttribute('placeholder')).toBe('Type a name, or roll for one');
    expect(screen.queryByText(/^Name tables/)).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Tam');
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const sheet = await screen.findByRole('dialog', { name: 'Stone kin names' });
    expect(within(sheet).getByText('Tap a name in each column, or type your own.')).toBeTruthy();
    expect(within(sheet).getByText('Roll d6, then tap the rows.')).toBeTruthy();
    // The only box is the typed roll (any table with a die, #571 round 3); the row is still the tap.
    expect(within(sheet).getAllByRole('textbox').map((box) => box.id)).toEqual([within(sheet).getByLabelText('What you rolled').id]);
    // In the book's style (cs-7, dec-10 D; 19-D2): the part's title bar, a head row naming the die, the rows one banded
    // block; the parts are the two-sided switch, its chosen side marked without a tick (ds-1d).
    const head = sheet.querySelector('.book-tap-head')!;
    expect(head.querySelector('.book-tap-head__bar')?.textContent).toBe(within(sheet).getByRole('group', { name: 'Parts of the name' }).querySelector('[aria-pressed="true"]')?.textContent);
    expect(head.querySelector('.book-tap-head__row')?.textContent).toBe('d6Name');
    expect(sheet.querySelector('.button-row--switch')).not.toBeNull();
    await user.click(within(sheet).getByRole('radio', { name: /^1 Bramble/ }));
    await user.click(within(sheet).getByRole('radio', { name: /^2 Mudfoot/ }));
    // Marked only: the typed name stays until Use this name.
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tam');
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bramble Mudfoot');
    expect(screen.getByText('From Stone kin names, rolled 1 and 2. Edit the field to change it.')).toBeTruthy();
  });

  it('bog folk have no name table, so no roll', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user, 'Bog folk');
    expect(screen.queryByRole('button', { name: 'Roll for a name' })).toBeNull();
  });
});

// Purpose (R3-7): the Class step's Help me choose holds the prime experience table from the rules set, the picked
// class's band marked "you"; the rows' fit lines keep the experience now.
// Purpose (R3-3, C): the pack now carries no coin figure in Gear's lead, so the lead shows no dice; the Roll row is the
// one place the dice show.
describe('retest 3 in the walk (R3-7, R3-3)', () => {
  it('Class: Help me choose shows the prime experience table, the warden’s band marked', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await screen.findByRole('heading', { name: /^Scores/ });
    await next(user);
    await pick(user, 'Bog folk');
    await next(user);
    await pick(user, 'Lantern Warden');
    await user.click(screen.getByRole('button', { name: 'Help me choose' }));
    const help = screen.getByRole('region', { name: 'Help me choose' });
    // In creation it is the book's table (dec-10 B, 17-B4): the character's band bold, "you" said, not shown.
    const table = within(help).getByRole('table', { name: 'Experience by prime score' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(table.querySelectorAll('.book-table__marked')).toHaveLength(1);
    expect(table.querySelector('.book-table__marked .visually-hidden')!.textContent).toBe(', you');
  });

  it('Gear: the lead shows no dice when the pack’s words have none; the Roll row has them', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Bog folk');
    const why = document.querySelector('.creation-step__why')!;
    expect(why.textContent).not.toMatch(/\d*d\d+/);
    expect([...document.querySelectorAll('.roll-row')].some((r) => /\d*d\d+/.test(r.textContent ?? ''))).toBe(true);
  });
});

// Purpose (m5b-one-table-open, 2026-11-09; it replaced R3-4's collapsed list here): a step whose content is one list,
// the backgrounds step, shows its rows without a tap; its fold row still names the count, and the row folds it shut.
describe('the backgrounds step, one list (m5b-one-table-open)', () => {
  it('starts with its list open, every row there without a tap; the fold row still folds it', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Bog folk');
    await next(user);
    await screen.findByRole('heading', { name: /backgrounds$/ });
    const label = screen.getByText(/^\d+ to choose from$/);
    const fold = label.closest('details')!;
    expect(fold.open).toBe(true);
    expect(within(fold).getByText('Nothing picked yet')).toBeTruthy();
    const rows = within(fold).getAllByRole('checkbox', { name: /^Pick / });
    expect(rows.length).toBe(Number(label.textContent!.match(/^\d+/)![0]));
    await user.click(label);
    expect(fold.open).toBe(false);
  });
});

describe('the trinket in Gear (cs-1)', () => {
  it("on the trinket's long table a tap marks the row and Take it takes it; the X takes nothing; Change swaps it and Undo puts the old one back", async () => {
    // Purpose (cs-15, picture creation/final 21-F4; Francis asked when this goes live): on a long table nothing is taken
    // at once: a tap marks the row, one Take it at the foot takes it (with nothing marked it says "Mark a row first.", cts-5 b),
    // and the X closes with nothing taken. The sheet is titled with what is picked, "Trinket", the table's name on its
    // bar; no Roll row sits over the trinket's row on Gear (cs-22): the sheet says to roll.
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Stone kin');
    expect(screen.queryByText(/for your trinket/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open Trinket (Stone kin, d30. Not rolled yet)' }));
    let sheet = await screen.findByRole('dialog', { name: 'Trinket' });
    expect(within(sheet).getByText('Roll d30, then mark your row.')).toBeTruthy();
    expect(sheet.querySelector('.book-tap-head__bar')?.textContent).toBe('Stone kin trinkets');
    // Any table with a die has the typed roll too, the fast path for a rolled result (m5b-long-tables, #571 round 3).
    expect(within(sheet).getByLabelText('What you rolled').getAttribute('inputmode')).toBe('numeric');
    await user.click(within(sheet).getByRole('button', { name: 'Take it' }));
    expect((await screen.findAllByText('Mark a row first.')).length).toBeGreaterThan(0);
    await user.click(within(sheet).getByRole('radio', { name: /^11 to 12 A pebble that is always warm/ }));
    // Marked, not taken.
    expect(tamLines()).toEqual([]);
    await user.click(within(sheet).getByRole('button', { name: 'Take it' }));
    await waitFor(() => expect(tamLines().map((l) => l.name)).toEqual(['A pebble that is always warm']));
    // A one-off, approved on the draft (bq3-6: the character's own approval covers it; it never waits for the GM).
    expect(tamLines()[0]).toMatchObject({ library_entry_id: null, approval: 'approved' });
    expect(screen.queryByRole('dialog', { name: 'Trinket' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Trinket (Stone kin): Rolled 11: A pebble that is always warm. Change' })).toBeTruthy();
    expect((tam().creation as { trinket?: { text: string } }).trinket?.text).toBe('A pebble that is always warm');
    expect(screen.getByRole('button', { name: /^Trinket \(Stone kin\): Rolled 11/ }).textContent).toBe('Rolled 11: A pebble that is always warmTrinket, Stone kinChange');
    // Change: the table reopens with the trinket marked; another row marked and the X: nothing changes.
    await user.click(screen.getByRole('button', { name: /^Trinket \(Stone kin\): Rolled 11/ }));
    sheet = await screen.findByRole('dialog', { name: 'Trinket' });
    expect(within(sheet).getByRole('radio', { name: /A pebble that is always warm/ }).getAttribute('aria-checked')).toBe('true');
    await user.click(within(sheet).getByRole('radio', { name: /^1 to 2 A reed whistle that only frogs can hear/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(tamLines().map((l) => l.name)).toEqual(['A pebble that is always warm']);
    // Change again, mark another row and Take it: it replaces the trinket, one trinket in the pack.
    await user.click(screen.getByRole('button', { name: /^Trinket \(Stone kin\): Rolled 11/ }));
    sheet = await screen.findByRole('dialog', { name: 'Trinket' });
    await user.click(within(sheet).getByRole('radio', { name: /^1 to 2 A reed whistle that only frogs can hear/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Take it' }));
    await waitFor(() => expect(tamLines().map((l) => l.name)).toEqual(['A reed whistle that only frogs can hear']));
    // Undo on the toast: the pebble again.
    await user.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    await waitFor(() => expect(tamLines().map((l) => l.name)).toEqual(['A pebble that is always warm']));
    // Next never waits for a trinket: it's in the pack already, or the player leaves it.
    await pastGear(user);
    await screen.findByRole('heading', { name: 'Details' });
  });

  it('bog folk have no trinket table, so no trinket row', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Bog folk');
    expect(screen.queryByRole('group', { name: /^Trinket/ })).toBeNull();
  });
});

describe('the Details step (cs-1)', () => {
  // Purpose (after-test A11): a save that fails on Details is said on the foot's ▲ line, not in a toast; offline in its
  // own words; the step stays, and Next tries again.
  it("a failed save is on the foot's ▲ line, and Next tries again", async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Stone kin');
    await pastGear(user);
    await screen.findByRole('heading', { name: 'Details' });
    const from = world.db.from.bind(world.db);
    const failing = { eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) };
    const spy = vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { update: (v: Record<string, unknown>) => unknown };
      if (table === 'actors') query.update = () => failing;
      return query;
    }) as typeof world.db.from);
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const status = () => screen.getByRole('status', { name: 'Step status' }).textContent ?? '';
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(status()).toBe("You're offline. Nothing is saved until you're back: keep this screen open, then try again."));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Details');
    online.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull());
    expect(status()).not.toContain('offline');
    spy.mockRestore();
    online.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
  });

  it('Next passes it untouched and it never blocks Send; its figures are kept as the averages, said so', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Stone kin');
    await pastGear(user);
    await screen.findByRole('heading', { name: 'Details' });
    expect(screen.getByText('None of these change the rules.')).toBeTruthy();
    // Next passes it, nothing filled (cs-11: no "Skip, leave blank").
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    // Purpose (cs-11 as the lead ruled, dec-10 D; a Departure from 2026-11-06's B ⚑1, where Skip saved nothing): with
    // "Skip, leave blank" gone, Next on an untouched step saves the kindred's average age, height and weight, and the
    // review says each is the average, not rolled.
    expect(screen.getAllByText(/the average, not rolled/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Left blank (optional)')).toBeNull();
    expect(((tam().fields as { _details?: { averaged?: string[] } })._details?.averaged ?? []).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Send to the GM' })[0]!);
    await waitFor(() => expect(tam().approval).toBe('pending'));
  });

  // Purpose: age, height and weight step by the ruled steps from the kindred's usual (age by the formula's × 10, weight
  // by 5), a height typed "5 7" reads 5 ft 7 in once the box is left, and the describing tables sit under "Describe them".
  it('steps age, height and weight from the usual and reads a typed height', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Stone kin');
    await pastGear(user);
    await screen.findByRole('heading', { name: 'Details' });
    const box = (name: string) => (screen.getByRole('textbox', { name }) as HTMLInputElement).value;
    expect(box('Age')).toBe('110');
    await user.click(screen.getByRole('button', { name: 'Raise Age' }));
    expect(box('Age')).toBe('120');
    await user.click(screen.getByRole('button', { name: 'Lower Weight' }));
    expect(box('Weight')).toBe('160');
    await user.clear(screen.getByRole('textbox', { name: 'Height' }));
    await user.type(screen.getByRole('textbox', { name: 'Height' }), '5 7');
    await user.click(screen.getByRole('button', { name: 'Raise Weight' }));
    expect(box('Height')).toBe('5 ft 7 in');
    // Body and Looks and manner (final drafts D); each Body card names its dice, from the pack's usual.
    expect(screen.getByRole('heading', { name: 'Body' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Looks and manner' })).toBeTruthy();
    expect(screen.getByText('Roll for each at the table, or type them.')).toBeTruthy();
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect((tam().fields as { _details?: unknown })._details).toEqual({ tables: {}, age: '120', height: '67', weight: '165' });
  });

  it('a kindred with nothing for it has no Details step: bog folk go straight to the review', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Bog folk');
    await pastGear(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(screen.queryByRole('heading', { name: 'Details' })).toBeNull();
  });

  it('a picked detail, a growth and a typed age are saved, shown on the review, and Change › reopens them', async () => {
    fenWorld();
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Stone kin');
    await pastGear(user);
    await screen.findByRole('heading', { name: 'Details' });
    await user.click(screen.getByRole('button', { name: 'Open Looks (Stone kin, d4. Not rolled yet)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Looks' });
    // The sheet has the player's own words at its foot (final drafts D).
    expect(within(sheet).getByRole('textbox', { name: 'Or type your own' })).toBeTruthy();
    // A row marked, then Take it (cts-2: a tap no longer takes a row and closes the sheet): back on the step, the row
    // says what was rolled.
    await user.click(within(sheet).getByRole('radio', { name: /^1 Webbed fingers/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Take it' }));
    expect(screen.getByRole('button', { name: 'Looks: Rolled 1: Webbed fingers. Change' })).toBeTruthy();
    // A roll at a level is a row like the others (D4): its name, then whose, its die and the level, and Open; its Roll row
    // cut to the act (cs-8), "then mark your row" (cts-5 c, cts-8); its sheet marks, then Take it.
    expect(screen.getByText('Roll d4, then mark your row.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open Moss (Stone kin, d4 at level 1. Not rolled yet)' }));
    const moss = await screen.findByRole('dialog', { name: 'Moss' });
    await user.click(within(moss).getByRole('radio', { name: /^2 Lichen along the knuckles/ }));
    await user.click(within(moss).getByRole('button', { name: 'Take it' }));
    // Age, height and weight start at the kindred's usual (3d6 × 10 years → 110; 4 ft + 1d6 in → 4 ft 4 in; 150 + 3d10
    // lb → 165), the pack's words under each; the player types what they rolled over the age.
    // Untouched, the average stepper's line first (final drafts D): "Average." and the dice with their glyph, the unit
    // said once, beside the stepper (D4, cs-8).
    const ageLine = document.querySelector('.physical-row--age .physical-row__caption')!;
    expect(ageLine.textContent).toBe('Average. 3d6 × 10');
    expect(ageLine.querySelector('.die-glyph')).not.toBeNull();
    expect((screen.getByRole('textbox', { name: 'Height' }) as HTMLInputElement).value).toBe('4 ft 4 in');
    expect((screen.getByRole('textbox', { name: 'Weight' }) as HTMLInputElement).value).toBe('165');
    await user.clear(screen.getByRole('textbox', { name: 'Age' }));
    await user.type(screen.getByRole('textbox', { name: 'Age' }), '140');
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('5 of 6 filled');
    // Touched, the dice alone (D4).
    expect(ageLine.textContent).toBe('3d6 × 10');
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(screen.getByText('Looks: Webbed fingers')).toBeTruthy();
    expect(screen.getByText('Age: 140 years')).toBeTruthy();
    // Left at the average: said in words, as information (final drafts D).
    expect(screen.getByText('Height: 4 ft 4 in, the average, not rolled')).toBeTruthy();
    expect(screen.getByText('Weight: 165 lb, the average, not rolled')).toBeTruthy();
    expect(screen.getByText('Moss: Lichen along the knuckles')).toBeTruthy();
    expect((tam().fields as { _details?: unknown })._details).toEqual({ tables: { 'stone-kin-looks': 'Webbed fingers' }, age: '140', height: '52', weight: '165', growth: ['Lichen along the knuckles'], averaged: ['height', 'weight'] });
    // Change › on the review: the step again with what was saved, Next back to the review.
    const section = screen.getByRole('region', { name: 'Details' });
    await user.click(within(section).getByRole('button', { name: /^Change/ }));
    await screen.findByRole('heading', { name: 'Details' });
    expect(screen.getByRole('button', { name: 'Looks: Rolled 1: Webbed fingers. Change' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip, leave blank' })).toBeNull();
  });
});

/**
 * An invented homebrew "Table Kit" pack on the campaign (ct-5, G-201): tables only, no rules set, no requires. Its
 * "Fen names" are two halves of one word (join ""); "Quirks" is a details table; "Pocket finds" a trinket table.
 */
function addTableKit(campaign: string, gm: string) {
  world.tables.packs.push({ id: 'pack-kit', owner_user_id: gm, campaign_id: null, name: 'Table Kit', version: '0.1', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Table Kit' } });
  const tables = [
    { id: 'kit-fen-names', name: 'Fen names', die: 'd4', gmOnly: false, uses: ['creation.names'], join: '', columns: ['First half', 'Second half'], rows: [{ min: 1, max: 2, cells: ['Adder', 'ley'] }, { min: 3, max: 4, cells: ['Rush', 'wick'] }] },
    { id: 'kit-quirks', name: 'Quirks', die: 'd4', gmOnly: false, uses: 'creation.details', rows: [{ min: 1, max: 2, result: 'Hums when nervous' }, { min: 3, max: 4, result: 'Counts every step' }] },
    { id: 'kit-pocket-finds', name: 'Pocket finds', die: 'd4', gmOnly: false, uses: ['creation.trinket'], rows: [{ min: 1, max: 4, result: 'A snail shell painted blue' }] },
  ];
  for (const t of tables) world.tables.library_entries.push({ id: `entry-kit-${t.id}`, pack_id: 'pack-kit', kind: 'table', pack_entry_id: t.id, name: t.name, data: t });
  world.tables.campaign_packs.push({ id: 'link-kit', campaign_id: campaign, pack_id: 'pack-kit', pack_name: 'Table Kit', option_choices: {}, overrides: {}, priority: 2 });
}

// Creation tables from any attached pack (ct-3 … ct-7, design/rulings/m5b-creation-tables-2026-11-06.md):
//   A kindred with no tables of its own is offered the Table Kit's names, trinket and details, each "Optional, from
//   Table Kit"; the two halves join into one word; Next goes on with every offered table untouched.
describe("another pack's creation tables (ct-3 … ct-7)", () => {
  it('bog folk roll a Table Kit name as one word, see its trinket and quirks marked optional, and Next never waits for them', async () => {
    const { gm, campaign } = fenWorld();
    addTableKit(campaign, gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user, 'Bog folk');
    // Roll for a name opens the one table, which says where it's from (ct-6).
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const sheet = await screen.findByRole('dialog', { name: 'Fen names' });
    expect(within(sheet).getByText(/Optional, from Table Kit/)).toBeTruthy();
    await user.click(within(sheet).getByRole('radio', { name: /^1–2 Adder/ }));
    await user.click(within(sheet).getByRole('radio', { name: /^1–2 ley/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Adderley');
    // Gear: the trinket row, its title without the kindred, the row saying where it's from; left untouched.
    await pick(user, 'Reed');
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '100');
    expect(screen.getByRole('button', { name: 'Open Trinket (Optional, from Table Kit, d4. Not rolled yet)' })).toBeTruthy();
    await pastGear(user);
    // Details: bog folk have none of their own, so the kit's quirks; Next goes on with them untouched.
    await screen.findByRole('heading', { name: 'Details' });
    expect(screen.getByRole('button', { name: 'Open Quirks (Optional, from Table Kit, d4. Not rolled yet)' })).toBeTruthy();
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(world.tables.actors.find((a) => a.name === 'Adderley')).toBeTruthy();
  });

  it("stone kin keep their own names and details; the kit doesn't replace them", async () => {
    const { gm, campaign } = fenWorld();
    addTableKit(campaign, gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toWho(user, 'Stone kin');
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    expect(await screen.findByRole('dialog', { name: 'Stone kin names' })).toBeTruthy();
    expect(screen.queryByText(/Optional, from Table Kit/)).toBeNull();
  });
});

describe('the details on the sheet (cs-1: all editable later from the sheet)', () => {
  /** An approved stone kin warden with a look and an age, on the sheet. */
  async function openSheet(): Promise<User> {
    const { me, campaign } = fenWorld();
    const id = world.addCharacter(campaign, 'Bramble Mudfoot', { ownerId: me, approval: 'approved' });
    Object.assign(world.tables.actors.find((a) => a.id === id)!, {
      level: 1,
      race_ref: 'stone-kin',
      fields: { MUS: 9, NIM: 9, GRT: 9, WIT: 9, LORE: 13, CHARM: 9, _details: { tables: { 'stone-kin-looks': 'Webbed fingers' }, age: '140 years' } },
      creation: { scores: { MUS: 9, NIM: 9, GRT: 9, WIT: 9, LORE: 13, CHARM: 9 } },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
    });
    world.tables.members.find((m) => m.user_id === me && m.campaign_id === campaign)!.active_actor_id = id;
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    // The Combat block is gone (plan m5b-sheet-revised A1); the sheet is open once its Level row is there.
    await screen.findByRole('region', { name: 'Level' });
    return user;
  }

  // Plan m5b-sheet-revised A3/B6: "Change details" and its roll step are gone; Edit's Details rows save at once.
  it('shows them in Details and backstory, and a Details row in Edit saves a change at once', async () => {
    const user = await openSheet();
    const block = screen.getByRole('region', { name: 'Details and backstory' });
    expect(within(block).getByText('Webbed fingers')).toBeTruthy();
    expect(within(block).getByText('140 years')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change details' })).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
    const edit = within(await screen.findByRole('form', { name: 'Edit Bramble Mudfoot' }));
    await user.click(edit.getByRole('button', { name: /^Looks:/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Looks' }));
    await user.clear(sheet.getByLabelText('Looks'));
    await user.type(sheet.getByLabelText('Looks'), 'Counts everything twice');
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect((tam().fields as { _details?: { tables: Record<string, string> } })._details?.tables).toEqual({ 'stone-kin-looks': 'Counts everything twice' }));
    // The other fields are kept.
    expect((tam().fields as { LORE?: number }).LORE).toBe(13);
    expect(await screen.findByText('Counts everything twice')).toBeTruthy();
  });

  it('Edit has the Name field’s roll too', async () => {
    const user = await openSheet();
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
    // The Name row in Edit's Details opens a sheet with the roll (plan m5b-sheet-revised B5).
    await user.click(within(await screen.findByRole('form', { name: 'Edit Bramble Mudfoot' })).getByRole('button', { name: /^Name:/ }));
    expect(screen.getByRole('button', { name: 'Roll for a name' })).toBeTruthy();
  });
});

describe('the averages Next saves (cs-11, dec-10 D)', () => {
  // Purpose (the Departure's last line, #759's review): a kindred with no figures still saves nothing; Next keeps what
  // was there and flags no average.
  it('a kindred with no figures saves nothing and flags nothing', () => {
    const out = withUsual({ tables: { face: 'Scarred' } }, []);
    expect(out).toEqual({ tables: { face: 'Scarred' } });
    expect(out.averaged).toBeUndefined();
  });

  // Purpose (#759's review): an untouched measure whose usual names no dice still reads as a sentence, "Average.".
  it('the untouched caption is "Average." with or without dice; stepped, only the dice', () => {
    expect(usualCaption('', false)).toBe('Average.');
    expect(usualCaption('3d6 × 10', false)).toBe('Average. 3d6 × 10');
    expect(usualCaption('3d6 × 10', true)).toBe('3d6 × 10');
  });
});

/** Describing tables of one row each (invented names): a d12 each, its one row "<name> worth noting". */
const describing = (names: readonly string[]): CreationTable[] => names.map((name, n) => tableOf({ packEntryId: `d-${n}`, name, data: { die: 'd12', rows: [{ min: 1, max: 12, result: `${name} worth noting` }] } })!);

/** The Details step alone, for a stone kin with these describing tables; `onDraft` hears every change. */
function renderDetails(details: CreationTable[], filled: Record<string, string> = {}, onDraft?: (d: CharacterDetails) => void) {
  render(
    <ToastHost>
      <CreationLeave onLeave={() => {}}>
        <DetailsStep tables={{ names: null, trinket: null, details, growth: null }} kindred="Stone kin" physical={[]} details={{ tables: filled }} title="Details" why="None of this changes the rules." help={null} counter={{ at: 8, of: 9 }} onBack={() => {}} onSave={() => {}} onDraft={onDraft} />
      </CreationLeave>
    </ToastHost>,
  );
}

describe('Details shows every describing table (T1b; Francis, 2026-11-18, in #991)', () => {
  /** Each table's row, in the order drawn: the words before " (" of "Open Face (Stone kin, d12. Not rolled yet)", or before ":" of a filled row's "Voice: …. Change". */
  const rowNames = () =>
    within(screen.getByRole('group', { name: 'Detail tables' }))
      .getAllByRole('button')
      .map((row) => (row.getAttribute('aria-label') ?? '').replace(/^Open /, '').replace(/( \(|:).*$/, ''));
  const EIGHT = ['Face', 'Manner', 'Voice', 'Hands', 'Smell', 'Habit', 'Fear', 'Hope'];

  // Purpose: his words, "four more tables is still a collapsed list. I want all 8 tables on this screen displayed
  // together, no need to divide by two." Eight describing tables are eight rows, in the pack's order, and nothing on
  // the step folds any of them away. (The step once showed four and folded the rest as "4 more tables".)
  it('eight tables are eight rows in the pack’s order, with no "more tables" fold', () => {
    renderDetails(describing(EIGHT));
    expect(rowNames()).toEqual(EIGHT);
    expect(screen.queryByText(/more tables?$/)).toBeNull();
    expect(document.querySelector('details')).toBeNull();
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Nothing filled yet');
  });

  // Purpose: whatever their number. One table is one row; twelve are twelve, a later one filled in its place.
  it('one table is one row, and twelve are twelve, a filled one in its place', () => {
    renderDetails(describing(['Face']));
    expect(rowNames()).toEqual(['Face']);
    cleanup();
    const twelve = [...EIGHT, 'Scar', 'Walk', 'Laugh', 'Keepsake'];
    renderDetails(describing(twelve), { 'd-9': 'Walk worth noting' });
    expect(rowNames()).toEqual(twelve);
    expect(document.querySelector('details')).toBeNull();
    expect(screen.getByRole('button', { name: 'Walk: Rolled 1–12: Walk worth noting. Change' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('1 of 12 filled');
  });

  // Purpose: with no describing table the step reads as before: its one line, no Looks and manner, nothing folded.
  it('no table: the step says so, with no rows and no fold', () => {
    renderDetails([]);
    expect(screen.getByText('Your setting has no detail tables for stone kin. Next goes on.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Detail tables' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Looks and manner' })).toBeNull();
    expect(document.querySelector('details')).toBeNull();
  });
});

describe('Looks and manner in one format (cts-2, cts-4, cts-5, cts-9; frames TS5, TS6)', () => {
  /** A 6-row d6 table of manner (TS5's short table). */
  const MANNER = tableOf({
    packEntryId: 'manner',
    name: 'Stone kin manner',
    data: { die: 'd6', rows: ['Speaks only when sure', 'Laughs before the joke lands', 'Counts things under their breath', 'Hums while thinking', 'Polite to animals, short with people', 'Answers every question with another'].map((result, i) => ({ min: i + 1, max: i + 1, result })) },
  })!;
  const open = (user: User) => user.click(screen.getByRole('button', { name: 'Open Manner (Stone kin, d6. Not rolled yet)' }));
  const sheet = () => screen.getByRole('dialog', { name: 'Manner' });
  const lastDraft = (spy: ReturnType<typeof vi.fn>) => (spy.mock.calls.at(-1)?.[0] as CharacterDetails | undefined)?.tables ?? {};

  // Purpose (cts-5 c, frame TS6): the step's roll line reads "then mark your row", not "then tap the row".
  it('the step’s roll line reads "then mark your row"', () => {
    renderDetails([MANNER]);
    expect(screen.getByText('Roll d6 for each, then mark your row. Or type your own.').closest('.roll-row')).not.toBeNull();
    expect(screen.queryByText(/tap the row/)).toBeNull();
  });

  // Purpose (cts-2, TS5): on a 6-row table a tap marks the row and takes nothing; Take it takes it and closes the
  // sheet; no row carries a Pick button; the ✕ takes nothing.
  it('a tap marks and takes nothing; Take it takes and closes; no Pick on a row; the ✕ takes nothing', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    renderDetails([MANNER], {}, onDraft);
    await open(user);
    expect(within(sheet()).getByText('Roll d6, then mark your row. Or type your own below.')).toBeTruthy();
    expect(within(sheet()).queryAllByRole('button', { name: /^Pick/ })).toEqual([]);
    expect(within(sheet()).queryAllByRole('checkbox')).toEqual([]);
    expect(within(sheet()).getAllByRole('radio')).toHaveLength(6);
    // The ✕ after a mark: nothing taken.
    await user.click(within(sheet()).getByRole('radio', { name: /^4 Hums while thinking/ }));
    expect(within(sheet()).getByRole('radio', { name: /^4 Hums/ }).getAttribute('aria-checked')).toBe('true');
    expect(onDraft).not.toHaveBeenCalled();
    await user.click(within(sheet()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Manner' })).toBeNull();
    expect(onDraft).not.toHaveBeenCalled();
    // Marked and Take it: taken, the sheet closed, the step's row says what was rolled.
    await open(user);
    await user.click(within(sheet()).getByRole('radio', { name: /^4 Hums while thinking/ }));
    await user.click(within(sheet()).getByRole('button', { name: 'Take it' }));
    expect(lastDraft(onDraft)).toEqual({ manner: 'Hums while thinking' });
    expect(screen.queryByRole('dialog', { name: 'Manner' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Manner: Rolled 4: Hums while thinking. Change' })).toBeTruthy();
  });

  // Purpose (cts-4, TS6): typed words are the marked answer and are not kept until Take it; the ✕ leaves what was
  // taken before.
  it('typed words wait for Take it; the ✕ leaves what was taken before', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    renderDetails([MANNER], { manner: 'Speaks only when sure' }, onDraft);
    await user.click(screen.getByRole('button', { name: 'Manner: Rolled 1: Speaks only when sure. Change' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Or type your own' }), 'Speaks low');
    // The words are marked (the box marked, no row marked), and nothing is kept yet.
    expect(sheet().querySelector('.table-sheet__own--marked')).not.toBeNull();
    expect(within(sheet()).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toEqual([]);
    expect(onDraft).not.toHaveBeenCalled();
    await user.click(within(sheet()).getByRole('button', { name: 'Close' }));
    expect(onDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Manner: Rolled 1: Speaks only when sure. Change' })).toBeTruthy();
    // Typed again and Take it: the words are kept, and opened again by Change they come marked, with Clear.
    await user.click(screen.getByRole('button', { name: 'Manner: Rolled 1: Speaks only when sure. Change' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Or type your own' }), 'Speaks low');
    await user.click(within(sheet()).getByRole('button', { name: 'Take it' }));
    expect(lastDraft(onDraft)).toEqual({ manner: 'Speaks low' });
    await user.click(screen.getByRole('button', { name: 'Manner: Typed: Speaks low. Change' }));
    expect((within(sheet()).getByRole('textbox', { name: 'Or type your own' }) as HTMLInputElement).value).toBe('Speaks low');
    expect(sheet().querySelector('.table-sheet__own--marked')).not.toBeNull();
    // Clear takes the typed answer off as it does a row (cts-9): the box empties, nothing is marked.
    await user.click(within(sheet()).getByRole('button', { name: 'Clear' }));
    expect(lastDraft(onDraft)).toEqual({});
    expect((within(sheet()).getByRole('textbox', { name: 'Or type your own' }) as HTMLInputElement).value).toBe('');
    expect(sheet().querySelector('.table-sheet__own--marked')).toBeNull();
    expect(within(sheet()).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  // Purpose (cts-5 b, TS6): Take it with nothing marked is still a tap, plain, and on a table with the box says "Mark
  // a row or type your own first."; nothing is taken and the sheet stays.
  it('an empty Take it says "Mark a row or type your own first."', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    renderDetails([MANNER], {}, onDraft);
    await open(user);
    const take = within(sheet()).getByRole('button', { name: 'Take it' });
    expect(take.className).toContain('button-secondary');
    await user.click(take);
    expect((await screen.findAllByText('Mark a row or type your own first.')).length).toBeGreaterThan(0);
    expect(onDraft).not.toHaveBeenCalled();
    expect(sheet()).toBeTruthy();
  });

  // Purpose (cts-9, "latest wins"): typed words, then a row tapped: the row is marked and the words stay in the box,
  // unmarked; tapping the box marks the words again; Take it takes whichever was marked last.
  it('latest wins between typed words and a marked row', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    renderDetails([MANNER], {}, onDraft);
    await open(user);
    const box = () => within(sheet()).getByRole('textbox', { name: 'Or type your own' }) as HTMLInputElement;
    const markedRows = () => within(sheet()).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    await user.type(box(), 'Speaks low');
    await user.click(within(sheet()).getByRole('radio', { name: /^2 Laughs/ }));
    expect(markedRows().map((r) => r.textContent)).toEqual([expect.stringContaining('Laughs before the joke lands')]);
    expect(box().value).toBe('Speaks low');
    expect(sheet().querySelector('.table-sheet__own--marked')).toBeNull();
    // The box tapped: the words are marked again, the row no longer.
    await user.click(box());
    expect(sheet().querySelector('.table-sheet__own--marked')).not.toBeNull();
    expect(markedRows()).toEqual([]);
    // The row again, then Take it: the row is taken, not the words.
    await user.click(within(sheet()).getByRole('radio', { name: /^2 Laughs/ }));
    await user.click(within(sheet()).getByRole('button', { name: 'Take it' }));
    expect(lastDraft(onDraft)).toEqual({ manner: 'Laughs before the joke lands' });
    // Opened again, a row taken: typing marks the words and Take it takes them.
    await user.click(screen.getByRole('button', { name: 'Manner: Rolled 2: Laughs before the joke lands. Change' }));
    await user.type(box(), 'Speaks low');
    expect(markedRows()).toEqual([]);
    await user.click(within(sheet()).getByRole('button', { name: 'Take it' }));
    expect(lastDraft(onDraft)).toEqual({ manner: 'Speaks low' });
  });
});

// Purpose (cts-8, "Yes, same format"): a short trinket table on Gear (four rows here, the Table Kit's) marks on a tap
// and takes only on Take it, as a long one does; nothing goes in the pack before.
describe('a short trinket table marks, then Take it (cts-8)', () => {
  it('a tap marks the row and puts nothing in the pack; Take it does, and closes the sheet', async () => {
    const { gm, campaign } = fenWorld();
    addTableKit(campaign, gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await toGear(user, 'Bog folk');
    await user.click(screen.getByRole('button', { name: 'Open Trinket (Optional, from Table Kit, d4. Not rolled yet)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Trinket' });
    expect(within(sheet).getByText('Roll d4, then mark your row.')).toBeTruthy();
    expect(within(sheet).queryByRole('textbox', { name: 'Or type your own' })).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Take it' }));
    expect((await screen.findAllByText('Mark a row first.')).length).toBeGreaterThan(0);
    await user.click(within(sheet).getByRole('radio', { name: /A snail shell painted blue/ }));
    expect(screen.getByRole('dialog', { name: 'Trinket' })).toBeTruthy();
    expect(tamLines()).toEqual([]);
    await user.click(within(sheet).getByRole('button', { name: 'Take it' }));
    await waitFor(() => expect(tamLines().map((l) => l.name)).toEqual(['A snail shell painted blue']));
    expect(screen.queryByRole('dialog', { name: 'Trinket' })).toBeNull();
  });
});

describe('latest wins, its edges (cts-9; the reviews of #1060)', () => {
  /** A 4-row d4 table of voices, with the player's own words. */
  const VOICE = tableOf({
    packEntryId: 'voice',
    name: 'Stone kin voice',
    data: { die: 'd4', rows: ['Hoarse', 'Sing-song', 'Very quiet', 'Booming'].map((result, i) => ({ min: i + 1, max: i + 1, result })) },
  })!;
  const sheet = () => screen.getByRole('dialog', { name: 'Voice' });
  const box = () => within(sheet()).getByRole('textbox', { name: 'Or type your own' }) as HTMLInputElement;
  const markedRows = () => within(sheet()).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
  const lastDraft = (spy: ReturnType<typeof vi.fn>) => (spy.mock.calls.at(-1)?.[0] as CharacterDetails | undefined)?.tables ?? {};

  // Purpose: only typing in or tapping the box moves the mark to the words; focus alone doesn't. A keyboard player who
  // marks a row and Tabs past the box to Take it takes the row, not the words in the box.
  it('Tab from a marked row through the box to Take it keeps the row', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    renderDetails([VOICE], {}, onDraft);
    await user.click(screen.getByRole('button', { name: 'Open Voice (Stone kin, d4. Not rolled yet)' }));
    await user.type(box(), 'Gravel and honey');
    await user.click(within(sheet()).getByRole('radio', { name: /^2 Sing-song/ }));
    const take = within(sheet()).getByRole('button', { name: 'Take it' });
    let passedTheBox = false;
    for (let n = 0; n < 20 && document.activeElement !== take; n++) {
      await user.tab();
      if (document.activeElement === box()) passedTheBox = true;
    }
    expect(passedTheBox).toBe(true);
    expect(document.activeElement).toBe(take);
    expect(markedRows().map((r) => r.textContent)).toEqual([expect.stringContaining('Sing-song')]);
    await user.keyboard('{Enter}');
    expect(lastDraft(onDraft)).toEqual({ voice: 'Sing-song' });
  });

  // Purpose: Clear after a row was taken takes the row off and leaves words typed since in the box, unmarked: nothing
  // the player typed is lost, and nothing is marked until they tap or type again.
  it('after Clear the typed words stay in the box, unmarked', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    renderDetails([VOICE], { voice: 'Hoarse' }, onDraft);
    await user.click(screen.getByRole('button', { name: 'Voice: Rolled 1: Hoarse. Change' }));
    await user.type(box(), 'Gravel and honey');
    // The row tapped again: the mark is back on the taken row, the words in the box unmarked.
    await user.click(within(sheet()).getByRole('radio', { name: /^1 Hoarse/ }));
    await user.click(within(sheet()).getByRole('button', { name: 'Clear' }));
    expect(lastDraft(onDraft)).toEqual({});
    expect(box().value).toBe('Gravel and honey');
    expect(sheet().querySelector('.table-sheet__own--marked')).toBeNull();
    expect(markedRows()).toEqual([]);
  });

  // Purpose (kept as built, "latest wins"): a row marked, then words typed and deleted: the mark sits on the empty box,
  // the row is no longer marked, and Take it answers "Mark a row or type your own first." and takes nothing.
  it('a row marked, words typed then deleted: nothing is marked and Take it says so', async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    renderDetails([VOICE], {}, onDraft);
    await user.click(screen.getByRole('button', { name: 'Open Voice (Stone kin, d4. Not rolled yet)' }));
    await user.click(within(sheet()).getByRole('radio', { name: /^3 Very quiet/ }));
    await user.type(box(), 'Hm');
    await user.clear(box());
    expect(markedRows()).toEqual([]);
    expect(sheet().querySelector('.table-sheet__own--marked')).toBeNull();
    await user.click(within(sheet()).getByRole('button', { name: 'Take it' }));
    expect((await screen.findAllByText('Mark a row or type your own first.')).length).toBeGreaterThan(0);
    expect(onDraft).not.toHaveBeenCalled();
    expect(sheet()).toBeTruthy();
  });
});
