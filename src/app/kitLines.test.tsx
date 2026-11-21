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
//   The setting's given pick offers up to N rows of a shared table, fewer allowed, folded under one row (R3-4): a tap
//   puts the row's things in the pack, the − square takes them out, and a full count says so.
//   A row can be picked more than once (R3-8): Pick on a picked row adds one and reads "Picked ×2"; the count counts
//   every pick; − puts one back; each pick is one toast with Undo; a thing that stacks by its own rule joins its line,
//   one that doesn't is a line of its own.
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

describe("the setting's given pick (of-11, G-83)", () => {
  it('up to N rows of a shared table, fewer allowed, folded: a tap marks, Take these takes, − unmarks; a full count says so; folding again takes nothing', async () => {
    // Purpose (cs-15 and the lead's ruling (a) on batch F): the table stays one folded row (its heading with its count,
    // what is taken and how many rows); inside, a tap only MARKS a row and one Take these at the fold's end takes the
    // marks; − unmarks one; marking past N says why; folding again without Take these takes nothing.
    const pack = patchedPack();
    pack.tables!.push({ id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 2, result: 'Basket', items: [{ itemId: 'reed-basket' }] }, { min: 3, max: 4, result: 'Eel', items: [{ itemId: 'bog-eel', qty: 2 }] }] });
    const rules = pack.rulesSets![0]!;
    (rules.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ itemId: 'dry-rations', qty: 2 }, { pick: { tableId: 'fen-odds', upTo: 2 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    const user = userEvent.setup();
    await toGear(user);
    // The given lines as { itemId, qty }: two rations.
    expect(within(screen.getByRole('group', { name: 'Yours already' })).getByText('Dry rations ×2', { selector: '.pick-row__name' })).toBeTruthy();
    const fold = () => screen.getByText('Fen odds and ends: pick up to 2').closest('details')!;
    expect(fold().textContent).toContain('0 of 2 picked. 3 to choose from');
    expect(fold().open).toBe(false);
    await user.click(screen.getByText('Fen odds and ends: pick up to 2'));
    expect(fold().open).toBe(true);
    // The table's die in a Roll row inside the fold, over its rows (cs-22: none over the folded row).
    expect(within(fold()).getByText('Roll d4, or choose.')).toBeTruthy();
    const rows = () => within(within(fold()).getByRole('group', { name: 'Fen odds and ends' }));
    // P27: each row shows its price and weight, as the shop does; a price in a coin the setting lacks is left out.
    const rowOf = (name: RegExp) => rows().getByRole('checkbox', { name });
    expect(rowOf(/^1 Reed rope/).textContent).toContain('1 gp, 50 coins');
    expect(rowOf(/^3 to 4 Bog eel ×2/).textContent).toContain('10 coins');
    expect(rowOf(/^3 to 4 Bog eel ×2/).textContent).not.toContain('gp');
    await user.click(rowOf(/^1 Reed rope/));
    await user.click(rowOf(/^3 to 4 Bog eel ×2/));
    // Marked, not taken.
    expect(rowOf(/^1 Reed rope/).getAttribute('aria-checked')).toBe('true');
    expect(tamsLines().map((l) => l.name)).not.toContain('Reed rope');
    // Full: a third says why and marks nothing.
    await user.click(rowOf(/^2 Reed basket/));
    expect((await screen.findAllByText('2 of 2 marked: take one off to mark another.')).length).toBeGreaterThan(0);
    expect(rowOf(/^2 Reed basket/).getAttribute('aria-checked')).toBe('false');
    await user.click(within(fold()).getByRole('button', { name: 'Take these' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toContain('Reed rope'));
    await waitFor(() => expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(2));
    expect(fold().querySelector('.creation-fold__note')?.textContent).toBe('2 of 2 picked. 3 to choose from');
    // − unmarks; only Take these takes it out.
    await user.click(within(fold()).getByRole('button', { name: 'Put back one 1: Reed rope' }));
    expect(tamsLines().map((l) => l.name)).toContain('Reed rope');
    await user.click(within(fold()).getByRole('button', { name: 'Take these' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).not.toContain('Reed rope'));
    expect((tam().creation as { givenPicks?: Record<string, unknown[]> }).givenPicks?.['fen-odds']).toHaveLength(1);
    // Marked and folded again: nothing taken, and the marks are gone when it opens again.
    await user.click(rowOf(/^2 Reed basket/));
    await user.click(screen.getByText('Fen odds and ends: pick up to 2'));
    expect(fold().open).toBe(false);
    expect(tamsLines().map((l) => l.name)).not.toContain('Reed basket');
    await user.click(screen.getByText('Fen odds and ends: pick up to 2'));
    expect(rowOf(/^2 Reed basket/).getAttribute('aria-checked')).toBe('false');
  });

  it('a row marked twice shows ✓✓ and counts twice; a stacking thing joins its line, another is a second line; − and Undo put them back', async () => {
    // Purpose (R3-8 under cs-15): a row may be marked more than once (✓✓, said aloud "picked twice"); Take these puts a
    // stacking thing on one line and another on two; the toast's Undo puts back that take; − then Take these takes one off.
    const pack = patchedPack();
    pack.tables!.push({ id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 4, result: 'Eel', items: [{ itemId: 'bog-eel', qty: 2 }] }] });
    const rules = pack.rulesSets![0]!;
    (rules.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ pick: { tableId: 'fen-odds', upTo: 4 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    const user = userEvent.setup();
    await toGear(user);
    const fold = () => screen.getByText('Fen odds and ends: pick up to 4').closest('details')!;
    await user.click(screen.getByText('Fen odds and ends: pick up to 4'));
    const row = (name: RegExp) => within(within(fold()).getByRole('group', { name: 'Fen odds and ends' })).getByRole('checkbox', { name });
    const take = () => user.click(within(fold()).getByRole('button', { name: 'Take these' }));
    const note = () => fold().querySelector('.creation-fold__note')?.textContent;
    // Bog eels stack (their own rule): two marks are one line of 4.
    await user.click(row(/^2 to 4 Bog eel ×2/));
    await user.click(row(/^2 to 4 Bog eel ×2/));
    expect(row(/^2 to 4 Bog eel ×2/).textContent).toContain('✓✓');
    expect(row(/^2 to 4 Bog eel ×2/).getAttribute('aria-label')).toContain('picked twice');
    await take();
    await waitFor(() => expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(4));
    expect(tamsLines().filter((l) => l.name === 'Bog eel')).toHaveLength(1);
    expect(note()).toBe('2 of 4 picked. 2 to choose from');
    // Reed rope doesn't stack: two marks are two lines.
    await user.click(row(/^1 Reed rope/));
    await user.click(row(/^1 Reed rope/));
    await take();
    await waitFor(() => expect(tamsLines().filter((l) => l.name === 'Reed rope')).toHaveLength(2));
    expect(note()).toBe('4 of 4 picked. 2 to choose from');
    // That take's own toast: Undo puts both ropes back, the eels stay.
    const toast = (await screen.findAllByText(/^In the pack: .*Reed rope ×2/)).at(-1)!.closest('.toast')!;
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tamsLines().filter((l) => l.name === 'Reed rope')).toHaveLength(0));
    expect(note()).toBe('2 of 4 picked. 2 to choose from');
    // − one eel, then Take these: 2 left on the one line.
    await user.click(within(fold()).getByRole('button', { name: 'Put back one 2 to 4: Bog eel ×2' }));
    await take();
    await waitFor(() => expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(2));
    expect(note()).toBe('1 of 4 picked. 2 to choose from');
  });

  // Purpose (m5b-one-table-open, 2026-11-09): a step with two tables beside other content (Gear, with two given picks)
  // keeps both folded; only a step that is one list starts open.
  it('two given picks on Gear: both tables start folded', async () => {
    const pack = patchedPack();
    pack.tables!.push(
      { id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 2, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 3, max: 4, result: 'Basket', items: [{ itemId: 'reed-basket' }] }] },
      { id: 'fen-catch', name: 'Fen catch', die: 'd6', gmOnly: false, rows: [{ min: 1, max: 3, result: 'Eel', items: [{ itemId: 'bog-eel' }] }, { min: 4, max: 5, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 6, max: 6, result: 'Basket', items: [{ itemId: 'reed-basket' }] }] },
    );
    const rules = pack.rulesSets![0]!;
    (rules.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ pick: { tableId: 'fen-odds', upTo: 1 } }, { pick: { tableId: 'fen-catch', upTo: 1 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    const user = userEvent.setup();
    await toGear(user);
    expect(screen.getByText('Fen odds and ends: pick up to 1').closest('details')!.open).toBe(false);
    expect(screen.getByText('Fen catch: pick up to 1').closest('details')!.open).toBe(false);
  });
});

describe('Next with marks not yet taken (cs-42, the lead on #786)', () => {
  /** A pick-up-to-2 table on Gear, with Gear open. */
  async function withOdds(user: User) {
    const pack = patchedPack();
    pack.tables!.push({ id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 2, result: 'Basket', items: [{ itemId: 'reed-basket' }] }, { min: 3, max: 4, result: 'Eel', items: [{ itemId: 'bog-eel', qty: 2 }] }] });
    (pack.rulesSets![0]!.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ pick: { tableId: 'fen-odds', upTo: 2 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    await toGear(user);
    await user.click(screen.getByText('Fen odds and ends: pick up to 2'));
    const fold = screen.getByText('Fen odds and ends: pick up to 2').closest('details')!;
    return (name: RegExp) => within(within(fold).getByRole('group', { name: 'Fen odds and ends' })).getByRole('checkbox', { name });
  }

  // Purpose: marked rows aren't lost when the player goes on: Next takes them as Take these does, says so with Undo
  // ("2 taken from <the pack's table name>."), then goes on; while marks wait, Take these is the one accent, not Next.
  it('Next takes the marks, says so with Undo, and goes on; Take these, not Next, is the accent while they wait', async () => {
    const user = userEvent.setup();
    const row = await withOdds(user);
    expect(screen.getByRole('button', { name: 'Next' }).className).toContain('button-primary');
    await user.click(row(/^1 Reed rope/));
    await user.click(row(/^3 to 4 Bog eel ×2/));
    expect(screen.getByRole('button', { name: 'Next' }).className).not.toContain('button-primary');
    expect(screen.getByRole('button', { name: 'Take these' }).className).toContain('button-primary');
    // A third mark is refused (past N), so Next can only ever take N.
    await user.click(row(/^2 Reed basket/));
    expect((await screen.findAllByText('2 of 2 marked: take one off to mark another.')).length).toBeGreaterThan(0);
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Gear'));
    expect(tamsLines().map((l) => l.name).sort()).toEqual(['Bog eel', 'Reed rope']);
    const toast = (await screen.findAllByText('2 taken from Fen odds and ends.')).at(-1)!.closest('.toast')!;
    // Undo puts them back; the player stays on the next step.
    const after = heading();
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tamsLines()).toHaveLength(0));
    expect(heading()).toBe(after);
    // The record says so too, and Back to Gear reads it: nothing taken (#786's review).
    await waitFor(() => expect((tam().creation as { givenPicks?: Record<string, unknown[]> }).givenPicks?.['fen-odds'] ?? []).toHaveLength(0));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Gear' });
    expect(screen.getByText('Fen odds and ends: pick up to 2').closest('details')!.querySelector('.creation-fold__note')?.textContent).toBe('0 of 2 picked. 3 to choose from');
  });

  // Purpose (cs-42, the lead's words): a Next that only puts rows back says "1 put back in <table>.", and one that takes
  // and puts back says "1 taken, 1 put back in <table>."; Undo on each puts the pack back as it was.
  it('Next that puts back, and Next that takes and puts back, say so; Undo puts the pack back', async () => {
    const user = userEvent.setup();
    const row = await withOdds(user);
    const fold = () => screen.getByText('Fen odds and ends: pick up to 2').closest('details')!;
    await user.click(row(/^1 Reed rope/));
    await user.click(within(fold()).getByRole('button', { name: 'Take these' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toEqual(['Reed rope']));
    // Only put back.
    await user.click(within(fold()).getByRole('button', { name: 'Put back one 1: Reed rope' }));
    await next(user);
    let toast = (await screen.findAllByText('1 put back in Fen odds and ends.')).at(-1)!.closest('.toast')!;
    await waitFor(() => expect(tamsLines()).toHaveLength(0));
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toEqual(['Reed rope']));
    // Back to Gear: rope taken; take one, put one back.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Gear' });
    // With something taken the fold starts open.
    expect(fold().open).toBe(true);
    await user.click(within(fold()).getByRole('button', { name: 'Put back one 1: Reed rope' }));
    await user.click(within(within(fold()).getByRole('group', { name: 'Fen odds and ends' })).getByRole('checkbox', { name: /^2 Reed basket/ }));
    await next(user);
    toast = (await screen.findAllByText('1 taken, 1 put back in Fen odds and ends.')).at(-1)!.closest('.toast')!;
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toEqual(['Reed basket']));
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tamsLines().map((l) => l.name)).toEqual(['Reed rope']));
  });

  // Purpose (#786's review): the Undo runs after the walk went on, maybe after the next step saved; it starts from the
  // record as it is then and changes only the table's picks and the pack, so that newer work survives.
  it("Undo after the next step saved keeps that step's work", async () => {
    const user = userEvent.setup();
    const row = await withOdds(user);
    await user.click(row(/^1 Reed rope/));
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Gear'));
    const toast = (await screen.findAllByText('1 taken from Fen odds and ends.')).at(-1)!.closest('.toast')!;
    // The next step saves something of its own on the creation record (as Details or Languages would).
    const actor = tam();
    actor.creation = { ...(actor.creation as Record<string, unknown>), laterStep: 'kept' };
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tamsLines()).toHaveLength(0));
    await waitFor(() => expect((tam().creation as { givenPicks?: Record<string, unknown[]> }).givenPicks?.['fen-odds'] ?? []).toHaveLength(0));
    expect((tam().creation as { laterStep?: string }).laterStep).toBe('kept');
  });

  // Purpose (#786's review): when the record can't be read at Undo (offline, an error), the Undo stops with the app's
  // couldn't-save words and changes nothing, rather than undoing from Gear's older copy.
  it("Undo that can't read the record stops and says so, changing nothing", async () => {
    const user = userEvent.setup();
    const row = await withOdds(user);
    await user.click(row(/^1 Reed rope/));
    await next(user);
    await waitFor(() => expect(heading()).not.toBe('Gear'));
    const toast = (await screen.findAllByText('1 taken from Fen odds and ends.')).at(-1)!.closest('.toast')!;
    const from = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { select: (c: string) => unknown };
      if (table !== 'actors') return query;
      const select = query.select.bind(query);
      query.select = (c: string) => (c === 'creation' ? { eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }) } : select(c));
      return query;
    }) as typeof world.db.from);
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    expect((await screen.findAllByText("Couldn't save that. Check your connection and try again.")).length).toBeGreaterThan(0);
    expect(tamsLines().map((l) => l.name)).toEqual(['Reed rope']);
    vi.restoreAllMocks();
  });

  // Purpose (cs-42): a Next taking from two tables says so for each, in the one toast the app shows at a time (a second
  // toast would replace the first and lose its Undo); its Undo puts both tables back.
  it('Next taking from two tables names each in its toast, and its Undo puts both back', async () => {
    const pack = patchedPack();
    pack.tables!.push(
      { id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 2, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 3, max: 4, result: 'Basket', items: [{ itemId: 'reed-basket' }] }] },
      { id: 'fen-catch', name: 'Fen catch', die: 'd6', gmOnly: false, rows: [{ min: 1, max: 3, result: 'Eel', items: [{ itemId: 'bog-eel' }] }, { min: 4, max: 6, result: 'Basket', items: [{ itemId: 'reed-basket' }] }] },
    );
    (pack.rulesSets![0]!.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ pick: { tableId: 'fen-odds', upTo: 1 } }, { pick: { tableId: 'fen-catch', upTo: 1 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    const user = userEvent.setup();
    await toGear(user);
    for (const [label, table, name] of [['Fen odds and ends: pick up to 1', 'Fen odds and ends', /^1 to 2 Reed rope/], ['Fen catch: pick up to 1', 'Fen catch', /^1 to 3 Bog eel/]] as const) {
      await user.click(screen.getByText(label));
      const fold = screen.getByText(label).closest('details')!;
      await user.click(within(within(fold).getByRole('group', { name: table })).getByRole('radio', { name }));
    }
    await next(user);
    await waitFor(() => expect(tamsLines().map((l) => l.name).sort()).toEqual(['Bog eel', 'Reed rope']));
    const toast = (await screen.findAllByText('1 taken from Fen odds and ends. 1 taken from Fen catch.')).at(-1)!.closest('.toast')!;
    await user.click(within(toast as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tamsLines()).toHaveLength(0));
  });

  // Purpose: only Next and Take these commit marks; Back takes nothing (cs-42).
  it('Back takes nothing that was only marked', async () => {
    const user = userEvent.setup();
    const row = await withOdds(user);
    await user.click(row(/^1 Reed rope/));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(tamsLines()).toHaveLength(0);
  });
});

describe('a given pick put back saves the record first (fix-gear-record-first-2; hard rule 4)', () => {
  // Purpose: two picks of a stacking thing share one line (Bog eel, 4). A put-back (− then Take these) whose record save
  // fails takes nothing out and keeps both picks on the record; Take these again then takes out one pick's 2, leaving
  // 2, never 0.
  it("a put-back whose save fails takes nothing out, so the next − leaves the line's right count", async () => {
    const pack = patchedPack();
    pack.tables!.push({ id: 'fen-odds', name: 'Fen odds and ends', die: 'd4', gmOnly: false, rows: [{ min: 1, max: 1, result: 'Rope', items: [{ itemId: 'rope-reed' }] }, { min: 2, max: 4, result: 'Eel', items: [{ itemId: 'bog-eel', qty: 2 }] }] });
    const rules = pack.rulesSets![0]!;
    (rules.byOption as Record<string, Entry>)['fen-market=off']!.startingEquipment = [{ pick: { tableId: 'fen-odds', upTo: 4 } }];
    fenWorld(pack, { 'fen-market': 'off' });
    const user = userEvent.setup();
    await toGear(user);
    const fold = () => screen.getByText('Fen odds and ends: pick up to 4').closest('details')!;
    await user.click(screen.getByText('Fen odds and ends: pick up to 4'));
    const eel = () => within(within(fold()).getByRole('group', { name: 'Fen odds and ends' })).getByRole('checkbox', { name: /^2 to 4 Bog eel ×2/ });
    const take = () => user.click(within(fold()).getByRole('button', { name: 'Take these' }));
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
    // − and Take these whose save fails: nothing comes out, and the record still has both picks.
    await user.click(within(fold()).getByRole('button', { name: 'Put back one 2 to 4: Bog eel ×2' }));
    await take();
    await waitFor(() => expect(failing).toBe(false));
    await new Promise((r) => setTimeout(r, 50));
    expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(4);
    expect(picks()).toBe(2);
    // Take these again, the connection back (the mark is kept): one pick's 2 comes out of the shared line.
    await take();
    await waitFor(() => expect(picks()).toBe(1));
    expect(tamsLines().find((l) => l.name === 'Bog eel')?.qty).toBe(2);
  });
});
