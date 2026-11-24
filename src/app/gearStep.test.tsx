// @vitest-environment jsdom
// The Gear step on the creation step shell (M5b step 0c, slice 5; cr-14; mockup creation/06), on the invented fixture
// pack scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
//   A kit and a shop buy add up: Gold to spend and the hint follow both, and the record keeps both.
//   Overspending is explained by Next (and by Add, which never greys), and the step stays.
//   The load tier follows the campaign's encumbrance rule: the coin tiers in coin mode, the slot tiers in slot mode,
//   nothing when the load isn't tracked.
//   Back keeps the money typed; Decide later puts Gear on the To finish list.
//   A tap on the burden opens its levels in a pop-up, "Burden", as on the Player tab (d5-19, 2026-11-20): nothing
//   opens in place under the bar, and closing it returns focus to the burden.
//   Starting coin (cw-11) starts at the pack's usual; untouched, Next keeps it as "the usual, not rolled" and records no
//   roll; stepped or typed, it was rolled and the roll is recorded; cleared, the purse starts at 0 (ruled 2026-11-02).
//   A kit's rolls (cw-11, Design's answer 3) come one at a time in a Roll sequence; closing midway keeps nothing;
//   Done takes the kit and shows what it gave; Change the rolls runs them again from the earlier taps; Take it off
//   removes exactly what the kit gave.
//   With the fixture's market option off (follow-up A, cf-4: `startingGear.shop` false and `startingEquipment` through
//   `byOption`): no Browse the shop, and a Given group (Yours already, folded since cw-11), ticked, never put back, in the pack and so in the
//   load tier, given once (reopened from the review, it isn't given twice).
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

/** The fixture's setting on a campaign whose load is tracked as `load` (the campaign's encumbrance rule). */
function fenWorld({ load = 'coin', options = {} }: { load?: 'coin' | 'slot' | 'none'; options?: Record<string, string> } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: load } } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', r);
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) entry('class', c);
  for (const i of pack.items!) entry('item', i);
  for (const k of pack.startingKits!) entry('startingKit', k);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: options, overrides: {}, priority: 1 });
  // The layout's fields without the ones other steps own (this test is about gear).
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
const hint = () => screen.getByRole('status', { name: 'Step status' }).textContent ?? '';
const heading = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const tam = () => world.tables.actors.find((a) => a.name === 'Tam')!;

/** Scores, Kindred, the warden, Adjust scores and Who they are (named Tam), to Gear. */
async function toGear(user: User) {
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
}

async function typeMoney(user: User, value: string) {
  const field = screen.getByRole('textbox', { name: 'Starting coin' });
  await user.clear(field);
  await user.type(field, value);
}

/** What is left, as Gear's coin line says it (cs-22: "100 rolled, 22 gp spent: 78 gp left") and as the shop's top does ("78 gp to spend"). */
const coin = () => document.querySelector('.gear-coin .average-stepper__line')?.textContent ?? '';
const shopLeft = () => document.querySelector('.gear-tally__money')?.textContent ?? '';
describe('Gear (cr-14)', () => {
  it('a kit and a shop buy add up: Gold to spend and the hint follow both, and the record keeps both', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    // The money roll from the pack, typed; the class's kit as a row with its contents, cost and weight.
    // Purpose (Design's gallery review of #555): the coin is a Roll row with the pack's dice and multiplier and the die's
    // glyph, the untouched stepper says "Average" as hit points do, and the step never
    // says "usual".
    const coinRoll = screen.getByText('Roll 3d6 × 10, then enter it.').closest('.roll-row');
    expect(coinRoll).not.toBeNull();
    expect(coinRoll!.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Average')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/usual/i);
    // How many kits may be taken (creation.kits.pick): the fixture doesn't say, so 1.
    expect(screen.getByRole('group', { name: 'To choose (pick 1)' })).toBeTruthy();
    await typeMoney(user, '100');
    await waitFor(() => expect(coin()).toBe('100 rolled'));
    const row = screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row') as HTMLElement;
    expect(row.textContent).toContain('Spear, coat, lantern and food for a dive.');
    expect(row.textContent).toContain('22 gp');
    expect(row.textContent).toContain('300 coins');
    expect(row.textContent).toContain('Fen sample, p. 31');
    expect(hint()).toBe('No kit yet, nothing bought');
    await pick(user, "Warden's kit");
    await waitFor(() => expect(coin()).toBe('100 rolled, 22 gp spent: 78 gp left'));
    // Purpose (Francis, 2026-11-24): after a kit is taken the line beside Undo last reads "Last taken", not "Last bought";
    // a purchase after it reads "Last bought" again.
    expect(document.querySelector('.gear-tally__last')?.textContent).toBe("Last taken: Warden's kit");
    // The shop: categories from the pack, each row with its price and Add.
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    await waitFor(() => expect(shopLeft()).toBe('78 gp to spend'));
    await user.click(screen.getByRole('button', { name: /Adventuring gear/ }));
    // R3-10: the row's text opens the item's full entry, its cost the shop's, Pick at its foot adding it as Add does.
    await user.click(screen.getByRole('button', { name: /^Storm lantern$/ }));
    const lantern = await screen.findByRole('dialog', { name: 'Storm lantern' });
    expect(within(lantern).getByText('Cost')).toBeTruthy();
    expect(within(lantern).getByText('Weight')).toBeTruthy();
    await user.click(within(lantern).getByRole('button', { name: 'Pick Storm lantern' }));
    await waitFor(() => expect(shopLeft()).toBe('70 gp to spend'));
    // A stackable item asks how many (the existing prompt), then comes off at once.
    await user.click(screen.getByRole('button', { name: 'Buy Dry rations, 1 gp' }));
    await user.click(await screen.findByRole('button', { name: 'One more' }));
    expect(screen.getByText('2 gp')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Buy 2' }));
    await waitFor(() => expect(shopLeft()).toBe('68 gp to spend'));
    // The buy's toast Undo puts the rations back (cs-21: the shop's top says only the coin to spend).
    await user.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    await waitFor(() => expect(shopLeft()).toBe('70 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Done shopping' }));
    expect(hint()).toBe('1 kit, 1 thing bought');
    expect(document.querySelector('.gear-tally__last')?.textContent).toBe('Last bought: Storm lantern');
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(tam().creation).toMatchObject({ startingMoney: 100, spentBase: 300, gearDone: true, bought: [{ label: "Warden's kit", price: 220, kitId: 'warden-kit' }, { label: 'Storm lantern', price: 80 }] });
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === tam().id).map((l) => l.name)).toEqual(['Reed basket', 'Reed spear', 'Waxed coat', 'Storm lantern', 'Dry rations', 'Storm lantern']);
    expect(world.tables.rolls.map((r) => [r.expression, r.result, r.purpose])).toContainEqual(['3d6 × 10 gp', 100, 'money']);
  });

  // Purpose (cs-22; pictures creation/final 21-F1, 21-F2): the coin under its own sub-heading, its Roll row only the act;
  // the sum under the stepper is the step's one place for what is left; no boxed tally of the money on the step; a
  // kit's price at the right of its blurb's first line; the shop a row with Open and no second line.
  it("Gear swept: the coin and its sum, the kit row's price, the shop row", async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    const coinGroup = screen.getByRole('group', { name: 'Starting coin' });
    expect(within(coinGroup).getByText('Roll 3d6 × 10, then enter it.')).toBeTruthy();
    expect(coin()).toBe('Average');
    expect(screen.queryByRole('status', { name: /to spend$/ })).toBeNull();
    const row = screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row') as HTMLElement;
    expect(row.querySelector('.pick-row__blurb > .pick-row__price')?.textContent).toBe('22 gp');
    await pick(user, "Warden's kit");
    await waitFor(() => expect(coin()).toBe('Average, 22 gp spent: 78 gp left'));
    const shop = screen.getByRole('button', { name: 'Open The shop' });
    expect(shop.closest('.detail-row')?.querySelector('.detail-row__note')).toBeNull();
  });

  // Purpose (cs-20, cs-21, cs-37; picture creation/final 21-F5): the shop's top says only the coin to spend (no load);
  // its search shows a placeholder, its label for a screen reader; categories fold with their counts and the chevron;
  // a row's Buy buys at once, and a thing that stacks opens the count screen, whose one button reads "Buy 2", its cost
  // above it.
  it("the shop: the coin to spend, the search, the folds, and the count screen's Buy", async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await typeMoney(user, '100');
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeTruthy();
    expect(shopLeft()).toBe('100 gp to spend');
    expect(screen.queryByText(/of 1,200 coins/)).toBeNull();
    const search = screen.getByLabelText('Search items') as HTMLInputElement;
    expect(search.placeholder).toBe('Search items');
    expect(document.querySelector(`label[for="${search.id}"]`)?.className).toBe('visually-hidden');
    const fold = screen.getByRole('button', { name: /^Adventuring gear: \d+$/ });
    expect(fold.querySelector('.creation-fold__mark')).not.toBeNull();
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    await user.click(fold);
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Buy Dry rations, 1 gp' }));
    await user.click(await screen.findByRole('button', { name: 'One more' }));
    const buy = screen.getByRole('button', { name: 'Buy 2' });
    expect(buy.previousElementSibling?.textContent).toBe('2 gp');
    await user.click(buy);
    await waitFor(() => expect(shopLeft()).toBe('98 gp to spend'));
  });

  // Purpose (plan dec-15 row 2; caf-1 to caf-3, caf-10; frames 41-2-gear-merged, 41-2-fix-gear-undo-last): same-name purchases show as one row with their count and summed price, one button a row
  // ("Put back one", or "Put back" on a row of one), which puts back the last one bought: the row's count, the coin and
  // the pack each move by one. A purchase of several at once joins its row and goes back one at a time. The line beside
  // Undo last names the last purchase, with its count, follows each buy and put-back, and is gone with nothing to undo;
  // Undo last still takes back the whole last purchase.
  it('same-name purchases as one row: Put back one takes one, and Last bought names what Undo last takes', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await typeMoney(user, '100');
    const rows = () => [...document.querySelectorAll('.starting-gear__line > span')].map((s) => s.textContent);
    const last = () => document.querySelector('.gear-tally__last')?.textContent ?? null;
    // A character awaiting approval keeps its lines apart (public.join_added_line), so each buy is a line of its own.
    const rations = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id && l.name === 'Dry rations').reduce((n, l) => n + Number(l.qty), 0);
    const lanterns = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id && l.name === 'Storm lantern');
    expect(last()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    await user.click(screen.getByRole('button', { name: /Adventuring gear/ }));
    // Two lanterns, one ration, then three rations at once.
    await user.click(screen.getByRole('button', { name: 'Buy Storm lantern, 8 gp' }));
    await waitFor(() => expect(shopLeft()).toBe('92 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Buy Dry rations, 1 gp' }));
    await user.click(await screen.findByRole('button', { name: 'Buy 1' }));
    await waitFor(() => expect(shopLeft()).toBe('91 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Buy Storm lantern, 8 gp' }));
    await waitFor(() => expect(shopLeft()).toBe('83 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Buy Dry rations, 1 gp' }));
    await user.click(await screen.findByRole('button', { name: 'One more' }));
    await user.click(screen.getByRole('button', { name: 'One more' }));
    await user.click(screen.getByRole('button', { name: 'Buy 3' }));
    await waitFor(() => expect(shopLeft()).toBe('80 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Done shopping' }));
    await waitFor(() => expect(rows()).toEqual(['Storm lantern ×2, 16 gp', 'Dry rations ×4, 4 gp']));
    expect(rations()).toBe(4);
    expect(lanterns()).toHaveLength(2);
    expect(last()).toBe('Last bought: Dry rations ×3');
    expect(hint()).toBe('No kit yet, 4 things bought');
    // The record keeps what each buy added.
    expect((tam().creation as { bought: unknown[] }).bought).toEqual([
      expect.objectContaining({ label: 'Storm lantern', price: 80 }),
      expect.objectContaining({ label: 'Dry rations', price: 10, lines: [expect.objectContaining({ qty: 1 })] }),
      expect.objectContaining({ label: 'Storm lantern', price: 80 }),
      expect.objectContaining({ label: 'Dry rations ×3', price: 30, lines: [expect.objectContaining({ qty: 3 })] }),
    ]);
    // One of the three bought at once goes back: the row reads ×3, the coin gains 1 gp, the pack loses one.
    await user.click(screen.getByRole('button', { name: 'Put back one Dry rations, 1 gp back' }));
    await waitFor(() => expect(rows()).toEqual(['Storm lantern ×2, 16 gp', 'Dry rations ×3, 3 gp']));
    expect(coin()).toBe('100 rolled, 19 gp spent: 81 gp left');
    expect(rations()).toBe(3);
    expect(last()).toBe('Last bought: Dry rations ×2');
    // A lantern goes back: one row of one, its button "Put back".
    await user.click(screen.getByRole('button', { name: 'Put back one Storm lantern, 8 gp back' }));
    await waitFor(() => expect(rows()).toEqual(['Storm lantern, 8 gp', 'Dry rations ×3, 3 gp']));
    expect(lanterns()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Put back Storm lantern, 8 gp back' }).textContent).toBe('Put back');
    // Undo last, unchanged: the whole last purchase (the two left of the three bought at once).
    await user.click(screen.getByRole('button', { name: 'Undo last' }));
    await waitFor(() => expect(rows()).toEqual(['Storm lantern, 8 gp', 'Dry rations, 1 gp']));
    expect(rations()).toBe(1);
    expect(last()).toBe('Last bought: Dry rations');
    // Putting the last of a row back removes the row; with nothing to undo, no line.
    await user.click(screen.getByRole('button', { name: 'Put back Dry rations, 1 gp back' }));
    await user.click(await screen.findByRole('button', { name: 'Put back Storm lantern, 8 gp back' }));
    await waitFor(() => expect(rows()).toEqual([]));
    expect(coin()).toBe('100 rolled');
    expect(last()).toBeNull();
    expect(rations()).toBe(0);
  });

  it('overspending is explained: Add answers instead of buying, and Next says how much is short and stays', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await typeMoney(user, '25');
    await pick(user, "Warden's kit");
    await waitFor(() => expect(coin()).toBe('25 rolled, 22 gp spent: 3 gp left'));
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    await user.click(screen.getByRole('button', { name: /Adventuring gear/ }));
    await user.click(screen.getByRole('button', { name: 'Buy Whisper book, 15 gp' }));
    expect((await screen.findAllByText('12 gp short.')).length).toBeGreaterThan(0);
    await waitFor(() => expect(shopLeft()).toBe('3 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Done shopping' }));
    await typeMoney(user, '20');
    // cs-44: exactly the coin is "0 gp left"; over it, "N over." (never "0 left", never a negative), in the warning's
    // colour as the foot's line is.
    await typeMoney(user, '22');
    await waitFor(() => expect(coin()).toBe('22 rolled, 22 gp spent: 0 gp left'));
    expect(document.querySelector('.gear-coin--over')).toBeNull();
    await typeMoney(user, '20');
    await waitFor(() => expect(coin()).toBe('20 rolled, 22 gp spent: 2 gp over.'));
    expect(document.querySelector('.gear-coin--over')).not.toBeNull();
    expect(hint()).toBe('2 gp over: take something off, or raise your coin');
    expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull();
    await next(user);
    expect((await screen.findAllByText('2 gp short: put something back, or Decide later.')).length).toBeGreaterThan(0);
    expect(heading()).toBe('Gear');
    // Putting the kit back fixes it.
    await pick(user, "Warden's kit");
    await waitFor(() => expect(coin()).toBe('20 rolled'));
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(tam().creation).toMatchObject({ startingMoney: 20, spentBase: 0 });
  });

  it("the load tier follows the campaign's encumbrance rule: coin tiers, slot tiers, or nothing when not tracked", async () => {
    for (const [load, tier, amount] of [
      ['coin', 'Light, speed 125', '300 of 1,200 coins'],
      ['slot', 'Burdened, speed 50', '6 of 10 slots'],
      ['none', null, null],
    ] as const) {
      cleanup();
      world = createFakeDb();
      forgetCampaignSetting();
      window.history.replaceState(null, '', '/');
      fenWorld({ load });
      const user = openApp();
      await toGear(user);
      await typeMoney(user, '100');
      await pick(user, "Warden's kit");
      await waitFor(() => expect(coin()).toBe('100 rolled, 22 gp spent: 78 gp left'));
      if (tier === null) {
        await waitFor(() => expect(screen.queryByRole('button', { name: /Light|Nimble|Burdened|Laden/ })).toBeNull());
        expect(screen.queryByText(/of 1,200 coins/)).toBeNull();
        continue;
      }
      expect(await screen.findByRole('button', { name: tier })).toBeTruthy();
      expect(screen.getByText(new RegExp(amount))).toBeTruthy();
    }
  });

  // Purpose: in the Gear step a tap on the burden opens its levels in a pop-up, not in place (d5-19), and closing it
  // returns focus to the burden.
  it('a tap on the burden opens its levels in a pop-up, nothing in place (d5-19)', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await typeMoney(user, '100');
    await pick(user, "Warden's kit");
    const tier = await screen.findByRole('button', { name: 'Light, speed 125' });
    expect(tier.getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(tier);
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByRole('region', { name: 'Burden by weight' })).toBeTruthy();
    expect(document.querySelector('.pack__explain')).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Burden' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Gear' })).toBeTruthy();
    expect(document.activeElement).toBe(tier);
  });

  // Purpose: the coin a player never touches is the setting's usual, kept and said as not rolled (cw-11), and the GM's
  // roll log gets no roll that never happened.
  it('starting coin starts at the usual 100; untouched, Next keeps it as the average (not rolled) and records no roll', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    expect((screen.getByRole('textbox', { name: 'Starting coin' }) as HTMLInputElement).value).toBe('100');
    await waitFor(() => expect(coin()).toBe('Average'));
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(tam().creation).toMatchObject({ startingMoney: 100, moneyTouched: false, gearDone: true });
    expect(world.tables.rolls.filter((r) => r.purpose === 'money')).toEqual([]);
  });

  // Purpose: a step on the coin counts as rolling it (cw-11): the step is the roll's "× 10", the record says rolled, and
  // the roll is recorded; at 0 the − explains instead of going below.
  it('a step on the coin moves it by the roll’s × 10 and makes it rolled; at 0 the − explains', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await user.click(screen.getByRole('button', { name: 'Raise Starting coin' }));
    expect((screen.getByRole('textbox', { name: 'Starting coin' }) as HTMLInputElement).value).toBe('110');
    await typeMoney(user, '0');
    await user.click(screen.getByRole('button', { name: 'Lower Starting coin' }));
    expect((await screen.findAllByText('Starting coin can’t go below 0.')).length).toBeGreaterThan(0);
    expect((screen.getByRole('textbox', { name: 'Starting coin' }) as HTMLInputElement).value).toBe('0');
    await user.click(screen.getByRole('button', { name: 'Raise Starting coin' }));
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(tam().creation).toMatchObject({ startingMoney: 10, moneyTouched: true });
    expect(world.tables.rolls.filter((r) => r.purpose === 'money').map((r) => r.result)).toEqual([10]);
  });

  // Purpose (final drafts D, Francis 2026-11-06 "I put 19 gold when the max is 18"): a coin the dice can't give is
  // warned about with the sign and the limit, never clamped and never blocking; Next is plain, explains and goes on,
  // and the record carries the exception for the GM's card. Back inside the range, the warning and the exception go.
  it('190 on 3d6 × 10 warns with the limit, keeps 190, and Next goes on with the exception on the record', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await typeMoney(user, '190');
    // 23-H4: what is wrong and the two ways on, once, under the stepper; the foot doesn't repeat it.
    expect(screen.getByText('190 is above what 3d6 × 10 can roll. Roll again, or send it and the GM decides.')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Starting coin' }) as HTMLInputElement).value).toBe('190');
    expect(hint()).not.toMatch(/dice/);
    expect(screen.getByRole('button', { name: 'Next' }).className).not.toContain('button-primary');
    await next(user);
    expect((await screen.findAllByText('190 is above what 3d6 × 10 can roll. Your GM sees it when you send.')).length).toBeGreaterThan(0);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(tam().creation).toMatchObject({ startingMoney: 190, specialApprovals: [{ step: 'gear', entryId: 'starting-coin', name: 'Starting coin 190', requirement: '3d6 × 10 gives 30 to 180' }] });
  });

  // Purpose (Design, 2026-11-07, creation.kits.pick): a kit past the limit is still takeable; the footer carries the
  // sign and the count against the limit, Next explains and goes on, and the record carries the exception for the
  // review's exceptions card and the GM's card, on the same flagged path as the coin.
  it('a second kit past the limit of 1 is taken; the footer says so with the sign, Next explains, the exception is on the record', async () => {
    fenWorld();
    world.tables.library_entries.push({
      id: 'entry-startingKit-mud',
      pack_id: 'pack-fen',
      kind: 'startingKit',
      pack_entry_id: 'mud-kit',
      name: 'Mud kit',
      data: { id: 'mud-kit', name: 'Mud kit', classIds: ['lantern-warden'], blurb: 'Rope for the flats.', items: [{ itemId: 'rope-reed', qty: 1 }], source: 'p. 34' },
    });
    const user = openApp();
    await toGear(user);
    await typeMoney(user, '100');
    await pick(user, "Warden's kit");
    await pick(user, 'Mud kit');
    await waitFor(() => expect(hint()).toContain('2 kits, 1 allowed'));
    expect(screen.getByRole('status', { name: 'Step status' }).querySelector('.warning-sign')).not.toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Pick Mud kit' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Next' }).className).not.toContain('button-primary');
    await next(user);
    expect((await screen.findAllByText('2 kits, 1 allowed. Your GM sees it when you send.')).length).toBeGreaterThan(0);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect((tam().creation as { specialApprovals?: unknown[] }).specialApprovals).toContainEqual({ step: 'gear', entryId: 'kits-over', name: '2 kits', requirement: 'Your setting allows 1' });
    expect(screen.getByRole('region', { name: "1 thing needs the GM's special approval" }).textContent).toContain('2 kits');
  });

  it('Next goes on with the coin cleared: no starting money on the record (the purse starts at 0), no money roll recorded', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    expect(coin()).toBe('Type what you rolled.');
    await next(user);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Starting coin' })).toBeNull());
    expect(tam().creation).toMatchObject({ gearDone: true });
    expect((tam().creation as Record<string, unknown>).startingMoney).toBeUndefined();
    expect(world.tables.rolls.filter((r) => r.purpose === 'money')).toEqual([]);
  });

  it('Back keeps the money typed; Decide later puts Gear on the To finish list', async () => {
    fenWorld();
    const user = openApp();
    await toGear(user);
    await typeMoney(user, '60');
    // Back from the first step after Who they are opens it again on the draft (ct3-5); Next comes back with the money kept.
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tam');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Gear' });
    expect((screen.getByRole('textbox', { name: 'Starting coin' }) as HTMLInputElement).value).toBe('60');
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect((tam().creation as { toFinish?: string[] }).toFinish).toEqual(['gear']);
    expect(tam().creation).toMatchObject({ startingMoney: 60, gearDone: true });
    // The review shows the To finish box with Gear in it.
    expect(within(screen.getByRole('region', { name: 'Tam' })).getAllByText(/Gear/).length).toBeGreaterThan(0);
  });

  it('with the market off: no shop, and the given gear is ticked at the top, in the pack and counted in the load', async () => {
    fenWorld({ options: { 'fen-market': 'off' } });
    const user = openApp();
    await toGear(user);
    const given = within(screen.getByRole('group', { name: 'Yours already' }));
    // Marked Given with no Pick (final drafts D), and a tap says why it stays (never put back here).
    expect(given.queryByRole('checkbox', { name: 'Pick Reed rope' })).toBeNull();
    expect(given.getByText('Reed rope').closest('.pick-row')?.className).toContain('pick-row--given');
    expect(given.getByText('Storm lantern').closest('.pick-row')?.className).toContain('pick-row--given');
    await user.click(given.getByText('Reed rope'));
    expect((await screen.findAllByText('Reed rope is given to everyone in your setting: it stays in the pack.')).length).toBeGreaterThan(0);
    // No shop row when the setting rolls its gear.
    expect(screen.queryByRole('button', { name: /^Open The shop/ })).toBeNull();
    // In the pack, so in the load: 50 + 40 coins, then the kit's 300 on top.
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.actor_id === tam().id).map((l) => l.name)).toEqual(['Reed rope', 'Storm lantern']));
    expect(await screen.findByText(/90 of 1,200 coins/)).toBeTruthy();
    await typeMoney(user, '100');
    await pick(user, "Warden's kit");
    expect(await screen.findByText(/390 of 1,200 coins/)).toBeTruthy();
    await waitFor(() => expect(coin()).toBe('100 rolled, 22 gp spent: 78 gp left'));
    // Given once: reopened from the review (Change Gear), the step doesn't add it a second time.
    await next(user);
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    await user.click(screen.getByRole('button', { name: 'Change Gear' }));
    await screen.findByRole('heading', { name: 'Gear' });
    expect(within(screen.getByRole('group', { name: 'Yours already' })).getByText('Reed rope').closest('.pick-row')?.className).toContain('pick-row--given');
    // Nothing changed since it opened from the review: one foot button, Back to review, and "Nothing changed" (22-G4: two
    // buttons with one meaning became one).
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Back to review' })).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Nothing changed');
    // A change (the coin) and Next reads Done again; changed back, Back to review again.
    await typeMoney(user, '110');
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    await typeMoney(user, '100');
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    await typeMoney(user, '110');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    const names = world.tables.inventory_lines.filter((l) => l.actor_id === tam().id).map((l) => l.name);
    expect(names.filter((n) => n === 'Reed rope')).toHaveLength(1);
    expect((tam().creation as { givenGear?: unknown[] }).givenGear).toHaveLength(2);
  });

  // Gate walk 2026-11-06 (kit twice): Back from Gear to Who they are, then Next, must not put the given gear in the pack
  // a second time (the walk back carried the record from before the gear was given).
  it('back to Who they are and forward again: the given gear is still given only once', async () => {
    fenWorld({ options: { 'fen-market': 'off' } });
    const user = openApp();
    await toGear(user);
    await waitFor(() => expect((tam().creation as { givenGear?: unknown[] }).givenGear).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    await next(user);
    await screen.findByRole('heading', { name: 'Gear' });
    await screen.findByRole('group', { name: 'Yours already' });
    // Long enough for a second giving to have landed, were there one.
    await new Promise((r) => setTimeout(r, 50));
    const names = world.tables.inventory_lines.filter((l) => l.actor_id === tam().id).map((l) => l.name);
    expect(names).toEqual(['Reed rope', 'Storm lantern']);
    expect((tam().creation as { givenGear?: unknown[] }).givenGear).toHaveLength(2);
  });

  /** A test-only kit for the warden with two rolls (the second rolled twice, two different ones) and a choice. */
  function dredgerKit({ distinct = true }: { distinct?: boolean } = {}) {
    world.tables.library_entries.push({
      id: 'entry-startingKit-dredger',
      pack_id: 'pack-fen',
      kind: 'startingKit',
      pack_entry_id: 'dredger-kit',
      name: "Dredger's kit",
      data: {
        id: 'dredger-kit',
        name: "Dredger's kit",
        classIds: ['lantern-warden'],
        blurb: 'Given, not bought: roll for a coat and two tools.',
        items: [{ itemId: 'rope-reed', qty: 1 }, { itemId: 'reed-whistle', oneOf: ['reed-whistle', 'eel-hooks'], qty: 1 }],
        rolls: [
          { name: 'Armour', die: 'd6', rows: [{ min: 1, max: 3, items: [] }, { min: 4, max: 6, items: [{ itemId: 'waxed-coat', qty: 1 }] }] },
          {
            name: 'Tools',
            die: 'd4',
            times: 2,
            ...(distinct ? { distinct: true } : {}),
            rows: [{ min: 1, max: 2, items: [{ itemId: 'eel-knife', qty: 1 }] }, { min: 3, max: 3, items: [{ itemId: 'bog-sling', qty: 1 }] }, { min: 4, max: 4, items: [{ itemId: 'reed-spear', qty: 1 }] }],
          },
        ],
        source: 'p. 33',
      },
    });
  }
  const dialog = () => within(screen.getByRole('dialog', { name: "Dredger's kit" }));
  const line = () => document.querySelector('.roll-sequence__line')?.textContent ?? '';
  const rollStatus = () => dialog().getByRole('status', { name: 'Roll status' }).textContent ?? '';
  const mineNames = () => world.tables.inventory_lines.filter((l) => l.actor_id === tam().id).map((l) => l.name);

  // Purpose: the kit's line names how many rolls it has (cw-11: the blurb, then "· 3 rolls").
  it('a kit with rolls reads its blurb, then how many rolls and choices', async () => {
    fenWorld();
    dredgerKit();
    const user = openApp();
    await toGear(user);
    expect(screen.getByRole('button', { name: /^Dredger's kit/ }).closest('.pick-row')!.textContent).toContain('Given, not bought: roll for a coat and two tools. 3 rolls, 1 to choose');
  });

  // Purpose: a kit's rolls come one at a time (Design's answer 3), in the kit's order; a roll made twice is ONE step with
  // two taps (ct3-6; Francis, retest 2), a taken row of a distinct roll saying "Already rolled" (no sign); the choice
  // last; Next with a tap missing explains and stays.
  it('Pick opens the Roll sequence: a roll made twice is one step with two taps, Already rolled on a distinct roll, then the kit is taken', async () => {
    fenWorld();
    dredgerKit();
    const user = openApp();
    await toGear(user);
    await pick(user, "Dredger's kit");
    expect(line()).toBe('Roll 1 of 3');
    // The die in its own Roll row under the line (creation follow-up, 2026-11-07).
    expect(dialog().getByText('Roll d6, then tap what you rolled.').closest('.roll-row')).not.toBeNull();
    expect(rollStatus()).toBe('Tap what you rolled');
    // Purpose: a roll step's rows are compact, the whole row the target, with no Pick button (Design, 2026-11-06).
    expect(dialog().queryAllByRole('checkbox')).toHaveLength(0);
    expect(dialog().getAllByRole('radio').map((r) => r.textContent)).toContain('4 to 6 Waxed coat');
    // Nothing tapped: Next explains and stays.
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    expect(rollStatus()).toBe('Roll d6 at the table, then tap what you rolled.');
    expect(line()).toContain('Roll 1 of 3');
    await user.click(dialog().getByRole('radio', { name: /^4 to 6 Waxed coat/ }));
    expect(rollStatus()).toBe('Waxed coat');
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    // One step for both rolls of Tools, its Roll row saying so.
    expect(line()).toBe('Roll 2 of 3');
    expect(dialog().getByText('Roll d4 twice, then tap each result.').closest('.roll-row')).not.toBeNull();
    await user.click(dialog().getByRole('radio', { name: /^3 Bog sling/ }));
    // Taken on a distinct roll: picked (✓), with "Already rolled" in plain words: information, so no warning sign
    // (06 rule 12; Design's gallery review of #555).
    const sling = () => dialog().getByRole('radio', { name: /^3 Bog sling/ });
    expect(sling().getAttribute('aria-checked')).toBe('true');
    expect(sling().textContent).toContain('Already rolled');
    expect(sling().textContent).toContain('✓');
    expect(sling().textContent).not.toContain('⚠');
    expect(sling().querySelector('.warning-sign')).toBeNull();
    expect(rollStatus()).toBe('Bog sling: 1 of 2 tapped');
    // One tap missing: Next explains and stays.
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    expect(rollStatus()).toBe('Roll d4 again at the table, then tap what you rolled: 1 of 2 tapped.');
    expect(line()).toBe('Roll 2 of 3');
    await user.click(dialog().getByRole('radio', { name: /^4 Reed spear/ }));
    expect(rollStatus()).toBe('Bog sling, Reed spear');
    // Both tapped: a third row says how to change one.
    await user.click(dialog().getByRole('radio', { name: /^1 to 2 Eel knife/ }));
    expect(rollStatus()).toBe('Both tapped: tap one to take it off first.');
    // A taken row tapped again comes off.
    await user.click(sling());
    expect(sling().getAttribute('aria-checked')).toBe('false');
    expect(rollStatus()).toBe('Reed spear: 1 of 2 tapped');
    await user.click(sling());
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    expect(line()).toBe('3 of 3: choose one');
    // Back goes a step back with the taps kept.
    await user.click(dialog().getByRole('button', { name: 'Back' }));
    expect(sling().getAttribute('aria-checked')).toBe('true');
    expect(dialog().getByRole('radio', { name: /^4 Reed spear/ }).getAttribute('aria-checked')).toBe('true');
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    // The choice starts on the pack's default; Done on the last step.
    expect(dialog().getByRole('checkbox', { name: 'Pick Reed whistle' }).getAttribute('aria-checked')).toBe('true');
    await user.click(dialog().getByRole('checkbox', { name: 'Pick Eel hooks' }));
    await user.click(dialog().getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: "Dredger's kit" })).toBeNull());
    await waitFor(() => expect(screen.getByRole('checkbox', { name: "Pick Dredger's kit" }).getAttribute('aria-checked')).toBe('true'));
    // What it gave, the rolled parts marked (final drafts D), and one Change.
    expect(screen.getByRole('button', { name: /^Dredger's kit/ }).closest('.pick-row')!.textContent).toContain('5 items: Reed rope, Waxed coat (rolled), Bog sling (rolled), Reed spear (rolled), Eel hooks (rolled)');
    expect(screen.getByRole('button', { name: "Change Dredger's kit" })).toBeTruthy();
    await waitFor(() => expect(mineNames()).toEqual(['Reed rope', 'Waxed coat', 'Bog sling', 'Reed spear', 'Eel hooks']));
  });

  // Purpose (retest 4 T3, R3-8; phone test 2026-11-09): on a roll made twice, the same row rolled twice shows two ✓
  // (✓✓) and no count in words, with a − square that puts one back; the foot keeps its list; the kit then gives two.
  it('a row rolled twice shows ✓✓ with no "twice", − puts one back, and the kit gives two', async () => {
    fenWorld();
    dredgerKit({ distinct: false });
    const user = openApp();
    await toGear(user);
    await pick(user, "Dredger's kit");
    await user.click(dialog().getByRole('radio', { name: /^4 to 6 Waxed coat/ }));
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    const sling = () => dialog().getByRole('radio', { name: /^3 Bog sling/ });
    const marks = () => (sling().textContent ?? '').split('✓').length - 1;
    await user.click(sling());
    expect(marks()).toBe(1);
    expect(dialog().queryByRole('button', { name: 'Put back one 3: Bog sling' })).toBeNull();
    await user.click(sling());
    expect(marks()).toBe(2);
    expect(sling().textContent).not.toMatch(/twice|Picked ×/);
    expect(sling().getAttribute('aria-checked')).toBe('true');
    expect(rollStatus()).toBe('Bog sling, Bog sling');
    await user.click(dialog().getByRole('button', { name: 'Put back one 3: Bog sling' }));
    expect(marks()).toBe(1);
    expect(rollStatus()).toBe('Bog sling: 1 of 2 tapped');
    await user.click(sling());
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    await user.click(dialog().getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(mineNames().filter((n) => n === 'Bog sling').length).toBeGreaterThan(0));
    const slings = world.tables.inventory_lines.filter((l) => l.actor_id === tam().id && l.name === 'Bog sling');
    expect(slings.reduce((n, l) => n + Number(l.qty ?? 1), 0)).toBe(2);
  });

  // Purpose: closing midway keeps nothing (Design's answer 3): no item in the pack, the kit not picked, and the toast
  // reads "<kit> put back" (Francis, retest 2), its Undo opening the sequence again where it was.
  it('✕ midway keeps nothing and says the kit was put back; Undo opens the sequence where it was', async () => {
    fenWorld();
    dredgerKit();
    const user = openApp();
    await toGear(user);
    await pick(user, "Dredger's kit");
    await user.click(dialog().getByRole('radio', { name: /^4 to 6 Waxed coat/ }));
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    await user.click(dialog().getByRole('button', { name: 'Close' }));
    expect((await screen.findAllByText("Dredger's kit put back")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/not taken/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: "Pick Dredger's kit" }).getAttribute('aria-checked')).toBe('false');
    expect(mineNames()).toEqual([]);
    await user.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    expect(line()).toBe('Roll 2 of 3');
    await user.click(dialog().getByRole('button', { name: 'Back' }));
    expect(dialog().getByRole('radio', { name: /^4 to 6 Waxed coat/ }).getAttribute('aria-checked')).toBe('true');
    await user.click(dialog().getByRole('button', { name: 'Close' }));
    // Opened again, it starts from nothing tapped.
    await pick(user, "Dredger's kit");
    expect(rollStatus()).toBe('Tap what you rolled');
  });

  // Purpose (Francis, retest 2): a kit's rolled picks are reviewable and changeable one at a time. The row's Change opens
  // the kit's entry, where "Rolled at the table" lists each roll with its result and its own Change; that Change reopens
  // the sequence at that roll only, Done swaps exactly what changed; Take it off removes exactly what the kit gave.
  it('the entry lists each roll with its result and its own Change, which reopens that roll alone; Take it off removes what the kit gave', async () => {
    fenWorld();
    dredgerKit();
    const user = openApp();
    await toGear(user);
    await pick(user, "Dredger's kit");
    await user.click(dialog().getByRole('radio', { name: /^1 to 3 nothing/ }));
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    await user.click(dialog().getByRole('radio', { name: /^1 to 2 Eel knife/ }));
    await user.click(dialog().getByRole('radio', { name: /^4 Reed spear/ }));
    await user.click(dialog().getByRole('button', { name: 'Next' }));
    await user.click(dialog().getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(mineNames()).toEqual(['Reed rope', 'Eel knife', 'Reed spear', 'Reed whistle']));
    // The row's Change opens the kit's entry, not the sequence from its start.
    await user.click(screen.getByRole('button', { name: "Change Dredger's kit" }));
    expect(document.querySelector('.roll-sequence__line')).toBeNull();
    const group = () => dialog().getByRole('group', { name: 'Rolled at the table' });
    const rowsText = [...group().querySelectorAll('.rolled-picks__row')].map((r) => r.textContent);
    expect(rowsText).toEqual(['Armour: d6nothingChange', 'Tools: d4, twiceEel knife, Reed spearChange', 'You choose: Reed whistle or Eel hooksReed whistleChange']);
    // Each roll's Roll row carries its die's glyph; the choice has none.
    expect(within(group()).getByText('Armour: d6').closest('.roll-row')?.querySelector('svg')).not.toBeNull();
    // Change on Tools reopens that roll alone: no step count, Done at once, the other taps kept.
    await user.click(within(group()).getByRole('button', { name: 'Change Tools' }));
    expect(line()).toBe('Tools, twice');
    expect(dialog().getByRole('radio', { name: /^4 Reed spear/ }).getAttribute('aria-checked')).toBe('true');
    await user.click(dialog().getByRole('radio', { name: /^4 Reed spear/ }));
    await user.click(dialog().getByRole('radio', { name: /^3 Bog sling/ }));
    await user.click(dialog().getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(mineNames()).toEqual(['Reed rope', 'Eel knife', 'Bog sling', 'Reed whistle']));
    // Back on the kit's entry, the new result listed.
    await waitFor(() => expect(group().textContent).toContain('Eel knife, Bog sling'));
    // ✕ on one roll's change leaves the kit as it was and comes back to the entry.
    await user.click(within(group()).getByRole('button', { name: 'Change Armour' }));
    await user.click(dialog().getByRole('button', { name: 'Close' }));
    expect(group()).toBeTruthy();
    await user.click(dialog().getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('checkbox', { name: "Pick Dredger's kit" }).getAttribute('aria-checked')).toBe('true');
    // Picked ✓ takes it off (the kit's Pick still puts it back).
    await user.click(screen.getByRole('checkbox', { name: "Pick Dredger's kit" }));
    await waitFor(() => expect(mineNames()).toEqual([]));
    expect(screen.getByRole('checkbox', { name: "Pick Dredger's kit" }).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('button', { name: "Change Dredger's kit" })).toBeNull();
  });

  it('with the market on (the default), the shop is there and nothing is given', async () => {
    fenWorld({ options: { 'fen-market': 'on' } });
    const user = openApp();
    await toGear(user);
    expect(screen.getByRole('button', { name: 'Open The shop' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Yours already' })).toBeNull();
  });
});

/** A window `width` px wide for the test inside (jsdom has no layout): min-width and max-width queries answered. */
async function atWidth(width: number, run: () => Promise<void>) {
  const had = window.matchMedia;
  const matches = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
  };
  window.matchMedia = ((query: string) => ({ matches: matches(query), media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  try {
    await run();
  } finally {
    window.matchMedia = had;
  }
}

const side = () => document.querySelector('.creation-step__side') as HTMLElement | null;

describe('Gear on a tablet (final draft 5, creation follow-up)', () => {
  // Purpose (retest 2, 2026-11-07): Gear is one column at every width: at 820 and 1180 there is no second column,
  // the tally (coin left, the load) sits under the step, and an opened kit is a sheet.
  it('at 820 and 1180, one column: the tally under the step, and a kit opens as a sheet', async () => {
    for (const width of [820, 1180]) {
      await atWidth(width, async () => {
        fenWorld({ options: { 'fen-market': 'off' } });
        const user = openApp();
        await toGear(user);
        expect(side()).toBeNull();
        expect(screen.queryByRole('group', { name: 'Yours so far' })).toBeNull();
        expect(screen.getByRole('textbox', { name: 'Starting coin' }).closest('.creation-step__content')).not.toBeNull();
        expect(screen.getByRole('group', { name: 'Yours already' })).toBeTruthy();
        await user.click(screen.getByRole('button', { name: /^Warden's kit/ }));
        expect(screen.getByRole('dialog', { name: "Warden's kit" }).classList.contains('dialog--sheet')).toBe(true);
      });
      cleanup();
      world = createFakeDb();
      forgetCampaignSetting();
    }
  });
});

