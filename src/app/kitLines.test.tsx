// @vitest-environment jsdom
// Kits, bundles and given picks on the Gear step (creation survey PR 4; cs-6, G-83, G-88, G-92; si-2; rc-3), on the
// invented fixture pack scripts/fixtures/m5b-creation.fixture.json with this file's own additions (a Small bog folk
// with an armour substitute, a warden's kit with a size swap, a choice, dice units, a part-bundle and a one-off line, a
// weapon the warden can't use, and a given pick from a shared table). Every name and number is invented. Purposes:
//   A Small character's kit gives the swapped weapon, and the kindred's substitute armour; the kit row says so.
//   A choice comes ticked at its default, so one tap takes the kit; tapping the other swaps it in the pack.
//   Units given as dice are a roll to tap before the kit is taken; a part-bundle gives that many single pieces.
//   Single pieces read by their own name (after-test A1): the roll says "Ration days" and "3 ration days", the taken
//   row "3 reeds", never "Reed bundle · 3" (which reads as three bundles).
//   A kit line by name becomes a one-off item in the pack, approved on the draft (bq3-6: the character's approval covers it).
//   A kit item the class can't use is taken carried, never held, and the kit row says "<item> · your class can't use
//   it · carried" (si-2).
//   The setting's given pick offers up to N rows of a shared table, fewer allowed: one row on the step (Open, then
//   Change with what was taken), opening a sheet (cts-1, cts-3) where a tap marks, a tap again marks twice (R3-8), −
//   puts one back and a full count says so; Take these takes, closes and says so with Undo; the ✕ takes nothing. A
//   thing that stacks by its own rule joins its line; one that doesn't is a line of its own.
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
  // A spy (the failing save's `db.from`) never outlives its test, even when an assertion fails before its end.
  vi.restoreAllMocks();
});

type Entry = Record<string, unknown>;
type LayoutField = { key: string; label: string; type: string; group?: string; fill?: string; choices?: string[] };

/** The fixture with this file's additions (cs-6): what the Gear step reads for a Small bog folk warden. */
function patchedPack(): Record<string, Entry[]> {
  const pack = JSON.parse(fixture) as Record<string, Entry[]>;
  const bogFolk = pack.races!.find((r) => r.id === 'bog-folk')!;
  Object.assign(bogFolk, { size: 'Small', armourSubstitutes: { 'waxed-coat': 'bog-iron-coat' } });
  const warden = pack.classes!.find((c) => c.id === 'lantern-warden')!;
  warden.weaponsAllowed = { mode: 'list', ids: ['reed-spear', 'eel-knife'] };
  Object.assign(pack.items!.find((i) => i.id === 'reed-bundle')!, { bundle: 10, unitName: 'Reed', pluralName: 'reeds' });
  Object.assign(pack.items!.find((i) => i.id === 'dry-rations')!, { unitName: 'ration day', pluralName: 'ration days' });
  const kit = pack.startingKits!.find((k) => k.id === 'warden-kit')!;
  kit.items = [
    { itemId: 'reed-spear', qty: 1, ifSize: { Small: { itemId: 'eel-knife' } } },
    { itemId: 'waxed-coat', qty: 1 },
    { itemId: 'storm-lantern', qty: 1, oneOf: ['storm-lantern', 'rope-reed'] },
    { itemId: 'dry-rations', qty: 1, units: '1d4' },
    { itemId: 'reed-bundle', qty: 1, units: 3 },
    { itemId: 'bog-sling', qty: 1 },
    { name: 'Lucky eel tooth' },
  ];
  return pack;
}

function fenWorld(pack: Record<string, Entry[]>, options: Record<string, string> = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'coin' } } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Entry) => world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  for (const t of pack.tables!) entry('table', t);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: options, overrides: {}, priority: 1 });
  const layout = (pack.fieldTemplates![0]!.fields as LayoutField[]).filter((f) => !['background', 'languages', 'hp', 'alignment'].includes(f.key));
  layout.forEach((f, order) =>
    world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type: f.type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: false, created_at: '2026-10-18T12:00:00Z' }),
  );
  world.signInAs(me);
}

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Next' }));
const pick = (user: User, name: string) => user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;
const tamsLines = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id);

async function toGear(user: User) {
  render(<Root db={world.db} />);
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
  await next(user);
  await screen.findByRole('heading', { name: 'Gear' });
  await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
  await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '100');
}

describe('kit lines on the Gear step (cs-6, si-2, rc-3)', () => {
  it("a Small bog folk's kit: the swap, the substitute, the choice, dice units, a part-bundle, a one-off and what the warden can't use", async () => {
    fenWorld(patchedPack());
    const user = userEvent.setup();
    await toGear(user);
    // The row reads the kit for this character: the eel knife for the spear (Small), the bog-iron coat for the coat.
    const row = screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row') as HTMLElement;
    expect(row.textContent).toContain('1 roll, 1 to choose');
    // Units as dice wait for their roll: Pick opens the Roll sequence (cw-11), in the kit's order: the choice, then the roll.
    await pick(user, "Warden's kit");
    const roll = within(await screen.findByRole('dialog', { name: "Warden's kit" }));
    expect(roll.getByText('1 of 2: choose one')).toBeTruthy();
    // The choice is ticked at its default.
    expect(roll.getByRole('checkbox', { name: 'Pick Storm lantern' }).getAttribute('aria-checked')).toBe('true');
    await user.click(roll.getByRole('button', { name: 'Next' }));
    expect(roll.getByText('Roll 2 of 2')).toBeTruthy();
    expect(tamsLines()).toHaveLength(0);
    await user.click(roll.getByRole('radio', { name: /^3 3 ration days/ }));
    await user.click(roll.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toContain('Eel knife'));
    const lines = tamsLines();
    const named = (name: string) => lines.find((l) => l.name === name);
    // A part-bundle gives 3 reeds, not 30; dice units give what was tapped.
    expect(named('Reed')?.qty).toBe(3); // the bundle's unit name, 3 single pieces
    expect(named('Dry rations')?.qty).toBe(3);
    // The choice's default; the substitute armour; the one-off by name, with no library item, approved on the draft
    // (bq3-6: the character's own approval covers it).
    expect(named('Storm lantern')).toBeTruthy();
    expect(named('Bog-iron coat')?.equipped).toBe(true);
    expect(named('Lucky eel tooth')).toMatchObject({ library_entry_id: null, approval: 'approved' });
    // si-2: the sling the warden can't use is carried, never held, and the row says so.
    expect(named('Bog sling')?.equipped).toBe(false);
    expect((screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row') as HTMLElement).querySelector('.warning-line')?.textContent).toBe("Bog sling: a Lantern Warden can't use it; carried");
    // Taken, the row reads what the kit gave.
    expect(screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row')!.textContent).toContain('Eel knife, Bog-iron coat, 3 reeds, Bog sling, Lucky eel tooth');
    // Change: the kit's entry lists each pick with its own Change (retest 2); the choice's Change opens it alone, and
    // the other choice swaps it in the pack.
    await user.click(screen.getByRole('button', { name: "Change Warden's kit" }));
    const entry = within(await screen.findByRole('dialog', { name: "Warden's kit" }));
    await user.click(entry.getByRole('button', { name: /^Change Storm lantern or / }));
    const again = within(await screen.findByRole('dialog', { name: "Warden's kit" }));
    expect(again.getByText('Choose one')).toBeTruthy();
    await user.click(again.getByRole('checkbox', { name: 'Pick Reed rope' }));
    await user.click(again.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toContain('Reed rope'));
    expect(tamsLines().map((l) => l.name)).not.toContain('Storm lantern');
  });
});

describe('a kit that gives part of a bundle names it with a capital (R3, the Pack test)', () => {
  it('a kit giving 3 torches from a bundle whose unitName is "torch" reads "Torch ×3"; the stored name is left as it is', async () => {
    // Purpose: the database names a bundle's single pieces by the pack's lower-case unitName; the words still start with a capital.
    const pack = patchedPack();
    pack.items!.push({ id: 'torch-bundle', name: 'Torches (6)', category: 'goods', weightCoin: 6, slots: 1, bundle: 6, unitName: 'torch' });
    pack.startingKits!.find((k) => k.id === 'warden-kit')!.items = [{ itemId: 'torch-bundle', qty: 1, units: 3 }];
    fenWorld(pack);
    const user = userEvent.setup();
    await toGear(user);
    await pick(user, "Warden's kit");
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toEqual(['torch']));
    expect(tamsLines()[0]!.qty).toBe(3);
    expect(screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row')!.textContent).toContain('Torch ×3');
    expect(screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row')!.textContent).not.toContain('torch ×3');
  });
});

describe("the setting's given pick in its sheet (of-11, G-83; cts-1, cts-3)", () => {
  /** A pick-up-to-N table on Gear, with Gear open; `rows` the table's rows. */
  async function withOdds(user: User, upTo: number, rows: Entry[]) {
    const pack = patchedPack();
    pack.tables!.push({ id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows });
    (pack.rulesSets![0]!.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ itemId: 'dry-rations', qty: 2 }, { pick: { tableId: 'fen-odds', upTo } }];
    fenWorld(pack, { 'fen-market': 'off' });
    await toGear(user);
  }
  const ODDS3 = [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 2, result: 'Basket', items: [{ itemId: 'reed-basket' }] }, { min: 3, max: 4, result: 'Eel', items: [{ itemId: 'bog-eel', qty: 2 }] }];
  const ODDS2 = [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 4, result: 'Eel', items: [{ itemId: 'bog-eel', qty: 2 }] }];
  /** The table's one row on Gear (cts-3): a button whose name starts with its action, then the label. */
  const pickRow = (upTo: number) => screen.getByRole('button', { name: new RegExp(`^(Open|Change) Fen odds and ends: pick up to ${upTo} `) });
  const sheet = (upTo: number) => screen.getByRole('dialog', { name: `Fen odds and ends: pick up to ${upTo}` });
  const rowIn = (upTo: number, name: RegExp) => within(sheet(upTo)).getByRole('checkbox', { name });
  const take = (user: User, upTo: number) => user.click(within(sheet(upTo)).getByRole('button', { name: 'Take these' }));
  const picksOnRecord = () => ((tam().creation as { givenPicks?: Record<string, unknown[]> }).givenPicks?.['fen-odds'] ?? []).length;

  // Purpose (cts-3, frame TS1): the table is one row on the step, like the trinket's: "Open" with nothing taken and
  // "Change" after, with what was taken by name; tapping it opens the sheet over the step; nothing unfolds in the page.
  it('the row reads Open with nothing taken and Change after, and opens the sheet; nothing unfolds in the page', async () => {
    const user = userEvent.setup();
    await withOdds(user, 2, ODDS3);
    // The given lines as { itemId, qty }: two rations.
    expect(within(screen.getByRole('group', { name: 'Yours already' })).getByText('Dry rations ×2', { selector: '.pick-row__name' })).toBeTruthy();
    expect(pickRow(2).textContent).toContain('0 of 2 picked. 3 to choose from');
    expect(pickRow(2).textContent).toContain('Open');
    // No chevron, no fold: the row is a button that opens a sheet.
    expect(pickRow(2).closest('details')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /^1 Reed rope/ })).toBeNull();
    await user.click(pickRow(2));
    // The sheet: its title with the count, the roll line (cts-5 a), the table, the foot.
    expect(within(sheet(2)).getByText('Roll d4, then mark your row.')).toBeTruthy();
    expect(within(sheet(2)).getByText('0 of 2 marked')).toBeTruthy();
    // P27: each row shows its price and weight, as the shop does; a price in a coin the setting lacks is left out.
    expect(rowIn(2, /^1 Reed rope/).textContent).toContain('1 gp, 50 coins');
    expect(rowIn(2, /^3 to 4 Bog eel ×2/).textContent).toContain('10 coins');
    expect(rowIn(2, /^3 to 4 Bog eel ×2/).textContent).not.toContain('gp');
    await user.click(rowIn(2, /^1 Reed rope/));
    await user.click(rowIn(2, /^3 to 4 Bog eel ×2/));
    await take(user, 2);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fen odds and ends: pick up to 2' })).toBeNull());
    expect(pickRow(2).textContent).toContain('2 of 2 picked: Reed rope, Bog eel ×2');
    expect(pickRow(2).textContent).toContain('Change');
    expect(pickRow(2).textContent).not.toContain('to choose from');
  });

  // Purpose (cts-1, R3-8, cs-50; frame TS3): in the sheet a tap only marks, a second tap on the row marks it twice
  // (✓✓, said aloud "picked twice"), − puts one back; a fifth tap at four says why and marks nothing; nothing is
  // taken while marking.
  it('a tap marks, a second tap marks twice, − puts one back; a fifth tap at four says so and marks nothing', async () => {
    const user = userEvent.setup();
    await withOdds(user, 4, ODDS3);
    await user.click(pickRow(4));
    await user.click(rowIn(4, /^3 to 4 Bog eel ×2/));
    expect(rowIn(4, /^3 to 4 Bog eel ×2/).getAttribute('aria-checked')).toBe('true');
    await user.click(rowIn(4, /^3 to 4 Bog eel ×2/));
    expect(rowIn(4, /^3 to 4 Bog eel ×2/).textContent).toContain('✓✓');
    expect(rowIn(4, /^3 to 4 Bog eel ×2/).getAttribute('aria-label')).toContain('picked twice');
    // The foot sums a row of two marked twice (T2a's one list): "Bog eel ×4".
    expect(within(sheet(4)).getByText('2 of 4 marked: Bog eel ×4')).toBeTruthy();
    await user.click(within(sheet(4)).getByRole('button', { name: 'Put back one 3 to 4: Bog eel ×2' }));
    expect(rowIn(4, /^3 to 4 Bog eel ×2/).textContent).not.toContain('✓✓');
    await user.click(rowIn(4, /^1 Reed rope/));
    await user.click(rowIn(4, /^1 Reed rope/));
    await user.click(rowIn(4, /^2 Reed basket/));
    expect(within(sheet(4)).getByText('4 of 4 marked: Bog eel ×2, Reed rope ×2, Reed basket')).toBeTruthy();
    // Past N: the row stays a tap, says why, and marks nothing; no row is greyed.
    await user.click(rowIn(4, /^3 to 4 Bog eel ×2/));
    expect((await screen.findAllByText('4 of 4 marked: take one off to mark another.')).length).toBeGreaterThan(0);
    expect(rowIn(4, /^3 to 4 Bog eel ×2/).textContent).not.toContain('✓✓');
    expect(tamsLines().filter((l) => l.name !== 'Dry rations')).toHaveLength(0);
  });

  // Purpose (cts-1, cts-3; frame TS1): Take these takes what is marked, closes the sheet and says so in one toast with
  // Undo, in the summed list (⚑ 4); Undo puts the pack (and the record) back. A stacking thing joins its line; another
  // is a line of its own.
  it('Take these takes the marks, closes the sheet and shows one toast with Undo; Undo puts the pack back', async () => {
    const user = userEvent.setup();
    await withOdds(user, 4, ODDS2);
    await user.click(pickRow(4));
    // Bog eels stack (their own rule): two marks are one line of 4. Reed rope doesn't: two marks are two lines.
    await user.click(rowIn(4, /^2 to 4 Bog eel ×2/));
    await user.click(rowIn(4, /^2 to 4 Bog eel ×2/));
    await user.click(rowIn(4, /^1 Reed rope/));
    await user.click(rowIn(4, /^1 Reed rope/));
    await take(user, 4);
    await waitFor(() => expect(tamsLines().filter((l) => l.name === 'Reed rope')).toHaveLength(2));
    expect(tamsLines().filter((l) => l.name === 'Bog eel').map((l) => l.qty)).toEqual([4]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(picksOnRecord()).toBe(4);
    const toast = (await screen.findAllByText(/^In the pack: Bog eel ×4, Reed rope ×2$/)).at(-1)!.closest('.toast')!;
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tamsLines().filter((l) => l.name !== 'Dry rations')).toHaveLength(0));
    expect(picksOnRecord()).toBe(0);
    expect(pickRow(4).textContent).toContain('0 of 4 picked. 2 to choose from');
  });

  // Purpose (⚑ 4, Francis 20 Nov: "Add them up"): the toast after Take these uses the same summed list as the row and
  // the foot, so a row of two taken twice reads "In the pack: Bog eel ×4", never "Bog eel ×2 ×2".
  it('the toast after Take these sums a row taken twice, as the row and the foot do', async () => {
    const user = userEvent.setup();
    await withOdds(user, 4, ODDS3);
    await user.click(pickRow(4));
    await user.click(rowIn(4, /^3 to 4 Bog eel ×2/));
    await user.click(rowIn(4, /^3 to 4 Bog eel ×2/));
    expect(within(sheet(4)).getByText('2 of 4 marked: Bog eel ×4')).toBeTruthy();
    await take(user, 4);
    expect((await screen.findAllByText('In the pack: Bog eel ×4')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/×2 ×2/)).toBeNull();
    expect(pickRow(4).textContent).toContain('2 of 4 picked: Bog eel ×4');
  });

  // Purpose (⚑ 5, Francis 20 Nov: "Take it"): on a pick-up-to-1 table the sheet's foot button reads Take it, not Take
  // these; it still says "Mark a row first." with nothing marked, and takes the marked row.
  // (A pick-up-to-2 or more table's Take these is used by every other test here.)
  it('a pick-up-to-1 table: the foot button reads Take it', async () => {
    const user = userEvent.setup();
    await withOdds(user, 1, ODDS3);
    await user.click(pickRow(1));
    expect(within(sheet(1)).queryByRole('button', { name: 'Take these' })).toBeNull();
    const takeIt = () => within(sheet(1)).getByRole('button', { name: 'Take it' });
    // Nothing marked: still a tap, and it says what to do.
    expect(takeIt().className).toContain('button-secondary');
    await user.click(takeIt());
    expect((await screen.findAllByText('Mark a row first.')).length).toBeGreaterThan(0);
    await user.click(within(sheet(1)).getByRole('radio', { name: /^1 Reed rope/ }));
    expect(takeIt().className).toContain('button-primary');
    await user.click(takeIt());
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toContain('Reed rope'));
    expect(pickRow(1).textContent).toContain('1 of 1 picked: Reed rope');
  });

  // Purpose (cts-1, cts-5 b): Take these with nothing marked and nothing taken stays a tap and says what to do; the sheet
  // stays open and nothing is written.
  it('Take these with nothing marked says "Mark a row first." and takes nothing', async () => {
    const user = userEvent.setup();
    await withOdds(user, 2, ODDS3);
    await user.click(pickRow(2));
    const button = within(sheet(2)).getByRole('button', { name: 'Take these' });
    expect(button.className).toContain('button-secondary');
    await user.click(button);
    expect((await screen.findAllByText('Mark a row first.')).length).toBeGreaterThan(0);
    expect(sheet(2)).toBeTruthy();
    expect(picksOnRecord()).toBe(0);
    // Marked: Take these is the sheet's accent.
    await user.click(rowIn(2, /^1 Reed rope/));
    expect(within(sheet(2)).getByRole('button', { name: 'Take these' }).className).toContain('button-primary');
  });

  // Purpose (cts-1, cs-15): the ✕ closes the sheet with nothing taken and writes no log line; its marks are gone when it
  // opens again.
  it('the ✕ takes nothing and writes no log line', async () => {
    const user = userEvent.setup();
    await withOdds(user, 2, ODDS3);
    await user.click(pickRow(2));
    await user.click(rowIn(2, /^1 Reed rope/));
    const events = world.tables.events.length;
    await user.click(within(sheet(2)).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(world.tables.events.length).toBe(events);
    expect(tamsLines().map((l) => l.name)).not.toContain('Reed rope');
    expect(pickRow(2).textContent).toContain('0 of 2 picked');
    await user.click(pickRow(2));
    expect(rowIn(2, /^1 Reed rope/).getAttribute('aria-checked')).toBe('false');
  });

  // Purpose (cts-1, frame TS3): opened again by Change, the rows taken come marked; − then Take these puts one back,
  // and the toast says it went back out of the pack when nothing is left.
  it('opened by Change, the rows taken come marked; − then Take these puts back', async () => {
    const user = userEvent.setup();
    await withOdds(user, 2, ODDS3);
    await user.click(pickRow(2));
    await user.click(rowIn(2, /^1 Reed rope/));
    await take(user, 2);
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toContain('Reed rope'));
    await user.click(pickRow(2));
    expect(pickRow(2).getAttribute('aria-label')).toMatch(/^Change /);
    expect(rowIn(2, /^1 Reed rope/).getAttribute('aria-checked')).toBe('true');
    // Take these with what is taken unchanged: nothing to take, so no event; the sheet closes.
    const events = world.tables.events.length;
    await take(user, 2);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(world.tables.events.length).toBe(events);
    await user.click(pickRow(2));
    await user.click(within(sheet(2)).getByRole('button', { name: 'Put back one 1: Reed rope' }));
    await take(user, 2);
    await waitFor(() => expect(tamsLines().map((l) => l.name)).not.toContain('Reed rope'));
    expect((await screen.findAllByText('Back out of the pack')).length).toBeGreaterThan(0);
    expect(pickRow(2).textContent).toContain('0 of 2 picked. 3 to choose from');
  });

  // Purpose (the plan's ⚑ 3): marks live only in the sheet, so Next never takes anything that was only marked: the
  // sheet's ✕ drops them, and Next is the step's accent.
  it('Next takes nothing that was only marked, and stays the accent', async () => {
    const user = userEvent.setup();
    await withOdds(user, 2, ODDS3);
    await user.click(pickRow(2));
    await user.click(rowIn(2, /^1 Reed rope/));
    await user.click(within(sheet(2)).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Next' }).className).toContain('button-primary');
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Gear'));
    expect(tamsLines().map((l) => l.name)).not.toContain('Reed rope');
    expect(picksOnRecord()).toBe(0);
  });

  // Purpose (m5b-one-table-open, now cts-1): two given picks on Gear are two rows, each opening its own sheet.
  it('two given picks on Gear: two rows, each opening its own sheet', async () => {
    const pack = patchedPack();
    pack.tables!.push(
      { id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 2, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 3, max: 4, result: 'Basket', items: [{ itemId: 'reed-basket' }] }] },
      { id: 'fen-catch', name: 'Fen catch', die: 'd6', gmOnly: false, rows: [{ min: 1, max: 3, result: 'Eel', items: [{ itemId: 'bog-eel' }] }, { min: 4, max: 5, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 6, max: 6, result: 'Basket', items: [{ itemId: 'reed-basket' }] }] },
    );
    (pack.rulesSets![0]!.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ pick: { tableId: 'fen-odds', upTo: 1 } }, { pick: { tableId: 'fen-catch', upTo: 1 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    const user = userEvent.setup();
    await toGear(user);
    await user.click(screen.getByRole('button', { name: /^Open Fen catch: pick up to 1 / }));
    const catchSheet = screen.getByRole('dialog', { name: 'Fen catch: pick up to 1' });
    // Up to 1: the rows are radios.
    await user.click(within(catchSheet).getByRole('radio', { name: /^1 to 3 Bog eel/ }));
    await user.click(within(catchSheet).getByRole('button', { name: 'Take it' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toEqual(['Bog eel']));
    expect(screen.getByRole('button', { name: /^Change Fen catch: pick up to 1 / }).textContent).toContain('1 of 1 picked: Bog eel');
    expect(screen.getByRole('button', { name: /^Open Fen odds and ends: pick up to 1 / }).textContent).toContain('0 of 1 picked. 2 to choose from');
  });
});

describe('a given pick put back saves the record first (fix-gear-record-first-2; hard rule 4)', () => {
  // Purpose: two picks of a stacking thing share one line (Bog eel, 4). A put-back (− then Take these) whose record save
  // fails takes nothing out, keeps both picks on the record and keeps the sheet open with its marks; Take these again
  // then takes out one pick's 2, leaving 2, never 0.
  it("a put-back whose save fails takes nothing out, so the next take leaves the line's right count", async () => {
    const pack = patchedPack();
    pack.tables!.push({ id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 4, result: 'Eel', items: [{ itemId: 'bog-eel', qty: 2 }] }] });
    const rules = pack.rulesSets![0]!;
    (rules.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ pick: { tableId: 'fen-odds', upTo: 4 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    const user = userEvent.setup();
    await toGear(user);
    const sheet = () => screen.getByRole('dialog', { name: 'Fen odds and ends: pick up to 4' });
    const open = () => user.click(screen.getByRole('button', { name: /^(Open|Change) Fen odds and ends: pick up to 4 / }));
    const eel = () => within(sheet()).getByRole('checkbox', { name: /^2 to 4 Bog eel ×2/ });
    const take = () => user.click(within(sheet()).getByRole('button', { name: 'Take these' }));
    await open();
    await user.click(eel());
    await user.click(eel());
    await take();
    await waitFor(() => expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(4));
    const picks = () => ((tam().creation as { givenPicks?: Record<string, unknown[]> }).givenPicks?.['fen-odds'] ?? []).length;
    expect(picks()).toBe(2);
    // The next edit of the creation record alone fails once (no connection), then goes through.
    let failing = true;
    const from = world.db.from.bind(world.db);
    const refused = { eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) };
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { update: (v: Record<string, unknown>) => unknown };
      if (table !== 'actors') return query;
      const update = query.update.bind(query);
      query.update = (v) => {
        if (!failing || Object.keys(v).length !== 1 || !('creation' in v)) return update(v);
        failing = false;
        return refused;
      };
      return query;
    }) as typeof world.db.from);
    // − and Take these whose save fails: nothing comes out, the record still has both picks, and the sheet stays open.
    await open();
    await user.click(within(sheet()).getByRole('button', { name: 'Put back one 2 to 4: Bog eel ×2' }));
    await take();
    await waitFor(() => expect(failing).toBe(false));
    await new Promise((r) => setTimeout(r, 50));
    expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(4);
    expect(picks()).toBe(2);
    expect(within(sheet()).getByText('1 of 4 marked: Bog eel ×2')).toBeTruthy();
    // Take these again, the connection back (the mark is kept): one pick's 2 comes out of the shared line.
    await take();
    await waitFor(() => expect(picks()).toBe(1));
    expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(2);
  });
});
