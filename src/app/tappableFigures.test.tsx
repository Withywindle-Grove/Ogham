// @vitest-environment jsdom
// Every worked-out figure tappable wherever it appears (PR J; ruling bq-2, docs/design/rulings/m5b-builder-questions-
// 2026-11-03.md), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json (the stalker's own skills
// added here, as in sheetCombat.test.tsx). Every name and number is invented.
//   The Player screen's skill pop-up has the full sheet's breakdown for the same skill, word for word.
//   The Player screen's save pop-up has the full sheet's breakdown for the same save, word for word.
//   Hit points keep their own tap on the Player screen (the damage pad), not a breakdown.
//   At hand's weapon row opens the item's sheet; its Attack row opens the figure's breakdown (sq-4, plan m5b-players-screens-standard C).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';

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
const layoutFields = pack.fieldTemplates![0]!.fields as LayoutField[];

/** An invented AC-style option, as a pack writes it: the style's name starts each choice's id (07). */
const acStyle = { id: 'fen-armour-style', name: 'Armour and attacks', ruleKey: 'ac-style', default: 'descending-sum', choices: [{ id: 'descending-sum', name: 'Going down' }, { id: 'ascending', name: 'Going up' }] };
/** The stalker's own skills: six, rolled at or over a target on a d6. */
const stalkerSkills = {
  names: { 'slip-reeds': 'Slip through reeds', 'pick-lock': 'Pick a lock', 'read-tracks': 'Read tracks', 'climb-willow': 'Climb a willow', 'still-water': 'Walk still water', 'mimic-heron': 'Mimic a heron' },
  die: 'd6',
  rollMode: 'equal-or-over',
  byLevel: [{ level: 1, 'slip-reeds': 4, 'pick-lock': 5, 'read-tracks': 5, 'climb-willow': 4, 'still-water': 6, 'mimic-heron': 6 }],
};

function fenWorld(style: string) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const me = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, me, 'player');
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const entry = (kind: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  for (const r of pack.rulesSets!) entry('rulesSet', { ...r, attack: { unarmouredAC: { descending: 9, ascending: 10 } } });
  for (const r of pack.races!) entry('race', r);
  for (const c of pack.classes!) {
    // The stalker gives both figures: the target number and the bonus (A4 picks one by the style).
    const progression = c.id === 'mire-stalker' ? [{ level: 1, hitDice: '1d6', thac0: 19, attackBonus: 1, saves: { mire: 13 } }] : c.progression;
    entry('class', c.id === 'mire-stalker' ? { ...c, progression, skills: stalkerSkills } : c);
  }
  // The level fill reaches the class's skills too, as the real packs' do.
  for (const h of pack.hooks!) entry('hook', h.id === 'fen-fill-level' ? { ...h, target: [...(h.target as string[]), 'skills'] } : h);
  for (const i of pack.items!) entry('item', i);
  for (const t of pack.traitLists!) entry('traitList', t);
  for (const t of pack.fieldTemplates!) entry('fieldTemplate', t);
  entry('option', acStyle);
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: { 'fen-armour-style': style }, overrides: {}, priority: 1 });
  layoutFields
    .filter((f) => f.key !== 'hp')
    .forEach((f, order) => {
      const fromList = f.from && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.from) ? f.from : null;
      const type = f.type === 'list' && !f.choices?.length && !fromList ? 'text' : f.type;
      world.tables.field_definitions.push({ id: `field-${f.key}`, campaign_id: campaign, applies_to: 'pc', key: f.key, label: f.label, type, choices: f.choices ?? [], field_group: f.group ?? '', sort_order: order, show_on_card: false, hidden: false, fill: f.fill ?? null, required: !!f.required, from_list: fromList, created_at: '2026-10-18T12:00:00Z' });
    });
  world.signInAs(me);
  const tam = world.addCharacter(campaign, 'Tam', { ownerId: me, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === tam)!, {
    level: 1,
    race_ref: 'stone-kin',
    hp_current: 5,
    hp_max: 6,
    fields: { MUS: 9, NIM: 13, GRT: 9, WIT: 9, LORE: 9, CHARM: 9 },
    creation: { scores: { MUS: 9, NIM: 13, GRT: 9, WIT: 9, LORE: 9, CHARM: 9 } },
    classes: [{ classRef: 'mire-stalker', level: 1, xp: 0 }],
  });
  world.tables.members.find((m) => m.user_id === me && m.campaign_id === campaign)!.active_actor_id = tam;
  return { campaign, tam };
}

/** A weapon in Tam's hand: the fixture's reed spear, as a line of the pack. */
function spearInHand(campaign: string, tam: string) {
  const spear = pack.items!.find((i) => i.id === 'reed-spear')!;
  world.tables.inventory_lines.push({
    id: 'line-reed-spear', campaign_id: campaign, actor_id: tam, location_id: null, library_entry_id: null, name: 'Reed spear', category: 'weapon',
    weight_coin: 30, slots: 1, stack: 1, qty: 1, container_line_id: null, equipped: true, how_got: 'bought', cost: '', notes: '',
    item_data: { slot: 'hand', weapon: spear.weapon, weaponTags: spear.weaponTags }, source_pack_id: null, source_entry_id: null,
    charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false,
    approval: 'approved', per_units: 1, version: 1, created_at: '2026-10-23T10:00:00Z',
  });
}


/**
 * A pop-up's breakdown: its plain lines (the breakdown sheet's figure first, plan m5b-players-screens-standard B),
 * without the setting's name or the "doesn't describe" note.
 */
const linesOf = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll('.dialog__figure, p.reading, p.breakdown-sheet__figure'))
    .map((p) => p.textContent ?? '')
    .filter((line) => !/^From your setting|doesn't describe|doesn't say how/.test(line));

/** Opens the Player screen of the fixture's character. */
async function openPlayer(): Promise<User> {
  render(<Root db={world.db} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  return user;
}

/** Taps a button, reads the pop-up's breakdown, and closes it. */
async function readPopUp(user: User, button: HTMLElement, title?: string): Promise<string[]> {
  await user.click(button);
  const dialog = await screen.findByRole('dialog', title ? { name: title } : {});
  const lines = linesOf(dialog);
  // The full sheet's pop-ups have Got it; the Player screen's breakdown sheets close with their ✕.
  await user.click(within(dialog).queryByRole('button', { name: 'Got it' }) ?? within(dialog).getByRole('button', { name: 'Close' }));
  return lines;
}

async function toSheet(user: User) {
  await openFullSheetFromMenu(user);
  // The Combat block is gone (plan m5b-sheet-revised A1): the sheet is open once its Level row is there.
  await screen.findByRole('region', { name: 'Level' });
}

describe('every worked-out figure tappable wherever it appears (bq-2)', () => {
  it("the Player screen's skill pop-up has the full sheet's breakdown for the same skill", async () => {
    // Purpose: a skill opens the same breakdown on the Player screen as on the full sheet (the rules, the class, the
    // kindred, which counts), not only its odds.
    fenWorld('descending-sum');
    const user = await openPlayer();
    const skills = within(await screen.findByRole('region', { name: 'Skills' }));
    const hark = skills.getAllByRole('button').find((b) => b.querySelector('.list-row__title')?.textContent === 'Hark')!;
    const playerLines = await readPopUp(user, hark, 'Hark');
    await toSheet(user);
    const sheetLines = await readPopUp(user, screen.getByRole('button', { name: /^Hark, .+ 5\+ on d6: where it comes from$/ }), 'Hark');
    // More than the odds: the parts the number comes from.
    expect(sheetLines.length).toBeGreaterThan(1);
    expect(playerLines).toEqual(sheetLines);
  });

  it("the Player screen's save pop-up has the full sheet's breakdown for the same save", async () => {
    // Purpose: a save opens the same sheet on the Player screen as on the full sheet: the figure, then "Modifiers" with
    // what really changes it (sv-2b; #784's review: the fixture's Spell ward is the kindred's +2 while Lore gives 0, so
    // the line names the kindred and never "+2 from Lore"), and no class-and-level line (sv-2a).
    fenWorld('descending-sum');
    const user = await openPlayer();
    const saves = within(await screen.findByRole('region', { name: 'Saves' }));
    // The breakdown sheet shows the figure first (plan m5b-players-screens-standard B), then the same lines.
    const [figure, ...playerLines] = await readPopUp(user, saves.getAllByRole('button')[0]!);
    expect(figure).toBe('13');
    expect(playerLines[0]).toBe('Spell ward: +2 from Stone kin.');
    expect(playerLines.some((line) => /from Lore/.test(line))).toBe(false);
    expect(playerLines.some((line) => /for a Mire Stalker at level 1/.test(line))).toBe(false);
    await toSheet(user);
    // The sheet's Saves are the Player screen's tiles (plan D): the same sheet, the figure and every line.
    const sheetSaves = within(screen.getByRole('region', { name: 'Saves' }));
    const [sheetFigure, ...sheetLines] = await readPopUp(user, sheetSaves.getAllByRole('button')[0]!);
    expect(sheetFigure).toBe('13');
    expect(sheetLines).toEqual(playerLines);
  });

  it('hit points keep their own tap on the Player screen: typing a value, not a breakdown', async () => {
    // Purpose: bq-2 leaves HP's tap its own; since 2026-11-08 the figure's tap types a value (hit points in place).
    fenWorld('descending-sum');
    const user = await openPlayer();
    await user.click(await screen.findByRole('button', { name: /^Hit points 5 of 6/ }));
    expect(await screen.findByRole('dialog', { name: 'Hit points' })).toBeTruthy();
    expect(screen.getByLabelText('Current HP (max 6)')).toBeTruthy();
  });

  it("the weapon in hand's name opens its At hand pop-up, whose rolls show where the figure comes from", async () => {
    // Purpose: sq-4 as the At hand pop-up keeps it (tfh-1, 2026-11-19; page M2, frame M2l): on the Player tab the weapon's
    // name opens its pop-up, which holds the same rolls as the Attack view (as-1: the class at this level, the score's
    // modifier, the weapon's die, each its own figure), agreeing with the block's roll lines; no Attack row to open.
    const { campaign, tam } = fenWorld('ascending');
    spearInHand(campaign, tam);
    const user = await openPlayer();
    // The weapon in hand is its own block above At hand (dec-13 C14).
    const atHand = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    await user.click(atHand.getByRole('button', { name: /^Reed spear/ }));
    const card = await screen.findByRole('dialog', { name: 'Reed spear' });
    const sheet = within(card);
    expect(sheet.getByRole('button', { name: 'Hide from At hand' })).toBeTruthy();
    expect(sheet.queryByRole('button', { name: /^Attack/ })).toBeNull();
    const rows = Array.from(card.querySelectorAll('.breakdown__row')).map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
    expect(rows[0]).toEqual(['Mire Stalker, level 1', '+1']);
    expect(rows).toContainEqual(['Reed spear', '1d6']);
    // The block's roll lines are the rolls': the first to-hit line's sum, and the die (dec-13 C14).
    const first = card.querySelector('.roll-row')!.textContent ?? '';
    const sum = /^Roll 1d20(?: ([+−]) (\d+))? to hit/.exec(first);
    expect(sum).not.toBeNull();
    const rolls = [...document.querySelectorAll('.weapon-in-hand__roll')].map((r) => r.textContent);
    expect(rolls).toEqual([`d20 ${sum![2] ? `${sum![1] === '−' ? '−' : '+'}${sum![2]}` : '+0'} to hit`, 'd6 damage']);
  });

  it("At hand's Attack opens the Attack sheet with the same parts and their sources and the rules, and no fight rules line", async () => {
    // Purpose: ah-1 as reordered by as-1: Attack is a sheet until M6, holding every to-hit and damage part with its own
    // figure (the class at this level, the score, the weapon's die); it ends with its rows, with no line that rolling
    // comes later (tfw-3, 2026-11-19).
    const { campaign, tam } = fenWorld('ascending');
    spearInHand(campaign, tam);
    const user = await openPlayer();
    const atHand = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    await user.click(atHand.getByRole('button', { name: 'Attack with Reed spear' }));
    const sheet = await screen.findByRole('dialog', { name: 'Reed spear' });
    const rows = Array.from(sheet.querySelectorAll('.breakdown__row')).map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]);
    expect(rows[0]).toEqual(['Mire Stalker, level 1', '+1']);
    expect(rows).toContainEqual(['Reed spear', '1d6']);
    expect(within(sheet).queryByText(/fight rules/)).toBeNull();
    // A weapon without modes spends nothing here: no Fire one.
    expect(within(sheet).queryByRole('button', { name: /one, .* left after/ })).toBeNull();
  });
});
