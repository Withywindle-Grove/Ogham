// The reminder card (M5 step 6; docs/05 "The reminder card"). Invented rules only.
//   What came due goes on one card in a fixed order: procedure steps, then lights, then rest, then the GM's own.
//   A mode's check shows its chance with the modifiers counted, what a hit rolls, and when it's next due.
//   Repeats merge with counts; 4 lines show, then "N more"; Hit, Miss or Done take one off a line's count.
//   All done keeps only what needs a decision (checks and recharges).
//   "+ Modifier" adds faces to the chance and lists the GM's line by hand; 0 changes nothing.
//   A check already run this period comes as the optional "Check again", never as a second count (ruled 2026-10-29).
//   Check now never adds a line already on the card (M5 gate fix); its Undo takes off only what it added.
import { describe, expect, it } from 'vitest';
import { addCheckNow, addHandModifier, allDone, cardFrom, cardView, checkAgain, checkedWords, mergeCard, modifierWords, perGroup, takeOne, withoutLines, type CardLine } from './card.ts';
import { fenRules } from './fixtures.ts';
import { elapsedSteps } from './clock.ts';
import { checkPrompt } from './checks.ts';
import { readCheck, readExploration } from './modes.ts';
import { campaignUnits } from './play.ts';
import { nextSteps } from './procedure.ts';
import { whichTables } from './tableList.ts';

const units = campaignUnits({ time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24 } }, []);
const rules = readExploration([fenRules]);
const creep = rules.modes.find((m) => m.id === 'creep')!;

const line = (key: string, group: CardLine['group'], decision: CardLine['decision'] = 'done', count = 1): CardLine => ({
  key,
  group,
  decision,
  name: key,
  icon: 'note',
  count,
  stepId: null,
  note: null,
  check: null,
  tableId: null,
  recharge: null,
  nextAt: null,
});

describe("a mode's checks on the card", () => {
  it('four turns of creeping bring the wandering check twice, as one line with its chance, its table and when it is next due', () => {
    const summary = nextSteps({ rules, mode: creep, units, startedAt: 0, now: 0 }, 4)!;
    const card = cardFrom(summary, { mode: creep, units, startedAt: 0 });
    const wander = card.find((l) => l.check?.checkId === 'creep-wander')!;
    expect(wander).toMatchObject({ name: 'Wandering things', count: 2, decision: 'check', group: 'procedure', stepId: 'wander' });
    // checks[].secret defaults to true (ruled 2026-10-29).
    expect(wander.check).toMatchObject({ source: 'mode', chance: { die: 'd8', on: [1] }, encounter: true, secret: true });
    expect(wander.nextAt).toBe(6 * units.turn!);
    // It runs on the Next turn that brings the clock to it: the strip then reads turn 7 (elapsedSteps counts from 1).
    expect(elapsedSteps(wander.nextAt!, 0, units.turn!)).toBe(7);
  });
});

describe('open and secret checks', () => {
  it('a check the pack marks secret: false is an open roll on the card', () => {
    const check = readCheck({ id: 'open', name: 'Open roll', chance: { die: 'd6', on: [1] }, secret: false })!;
    const line = cardFrom({ prompts: [{ kind: 'check', stepId: null, source: 'mode', count: 1, again: false, ...checkPrompt(check, 'dot', null) }], rest: null, reminders: [], to: 0 });
    expect(line[0]!.check!.secret).toBe(false);
    expect(readCheck({ id: 'x', name: 'X' })!.secret).toBe(true);
  });
});

describe('order, merging and counts', () => {
  it('orders procedure, lights, rest, then the GM own, and shows 4 then "N more"', () => {
    const card = mergeCard([], [line('gm-a', 'gm'), line('rest', 'rest'), line('step-a', 'procedure'), line('gm-b', 'gm'), line('light', 'light')]);
    expect(card.map((l) => l.key)).toEqual(['step-a', 'light', 'rest', 'gm-a', 'gm-b']);
    const view = cardView(card);
    expect(view.lines).toHaveLength(4);
    expect(view.more).toBe(1);
  });

  it('a line still on the card counts up when it comes due again, keeping a modifier added by hand', () => {
    const check = { ...line('check', 'procedure', 'check'), check: { checkId: 'c', source: 'mode' as const, chance: { die: 'd6', on: [1] }, always: false, ruledOut: false, modifiers: [], hit: { tables: [], tableFrom: null, pick: false, column: null, columns: [], regionTable: null, regionTables: false, swap: null, noteOnly: true, note: null, candidates: [] }, encounter: true, secret: true, again: false } };
    const modified = addHandModifier(check, 'Noisy armour', 1);
    const card = mergeCard([modified], [{ ...check, count: 2 }]);
    expect(card[0]!.count).toBe(3);
    expect(card[0]!.check!.chance).toEqual({ die: 'd6', on: [1, 2] });
    expect(modifierWords(card[0]!.check!.modifiers[0]!)).toBe('+1, Noisy armour (by hand)');
  });

  it('Hit, Miss or Done take one off; at 0 the line goes', () => {
    const card = [line('a', 'gm', 'check', 2)];
    expect(takeOne(card, 'a')[0]!.count).toBe(1);
    expect(takeOne(takeOne(card, 'a'), 'a')).toEqual([]);
  });

  it('All done keeps only checks and recharges', () => {
    const card = [line('a', 'procedure', 'roll'), line('b', 'gm', 'check'), line('c', 'gm', 'recharge'), line('d', 'rest'), line('e', 'gm', 'info')];
    expect(allDone(card).map((l) => l.key)).toEqual(['b', 'c']);
  });

  it('a modifier of 0, or on a line that is not a check, changes nothing', () => {
    const plain = line('a', 'gm');
    expect(addHandModifier(plain, 'x', 2)).toBe(plain);
  });
});

describe('Checked today, Check again (05, Once per period; ruled 2026-10-29)', () => {
  const check = readCheck({ id: 'bog-wander', name: 'Bog lurkers', chance: { die: 'd6', on: [1] }, onHit: { tableId: 'lurkers' } })!;
  const prompt = (again: boolean, stepId: string) => ({ kind: 'check' as const, stepId, source: 'mode' as const, count: 1, again, ...checkPrompt(check, 'monster', null) });

  it('a second step running a check that already ran is its own optional line, not a second count on the first', () => {
    const card = cardFrom({ prompts: [prompt(false, 'a'), prompt(true, 'b')], rest: null, reminders: [], to: 0 });
    expect(card.map((l) => [l.key, l.decision, l.count])).toEqual([
      ['check:mode:bog-wander', 'check', 1],
      ['again:mode:bog-wander:b', 'again', 1],
    ]);
    expect(card[1]!.check!.again).toBe(true);
  });

  it("a camp's own checks join the card: one the day already ran is the optional Check again", () => {
    const camp = { kind: 'camp' as const, stepId: 'camp', name: 'Camp', icon: 'camp' as const, steps: [], checks: [{ count: 1, again: true, ...checkPrompt(check, 'monster', null) }], quickOption: null, note: null, count: 1 };
    const card = cardFrom({ prompts: [prompt(false, 'w'), camp], rest: null, reminders: [], to: 0 });
    expect(card.map((l) => [l.key, l.decision])).toEqual([
      ['check:mode:bog-wander', 'check'],
      ['camp:camp', 'done'],
      ['again:mode:bog-wander:camp', 'again'],
    ]);
  });

  it('tapping Check again makes it a check with Hit / Miss; left alone, All done clears it', () => {
    const card = cardFrom({ prompts: [prompt(true, 'b')], rest: null, reminders: [], to: 0 });
    expect(checkAgain(card, 'again:mode:bog-wander:b')[0]!.decision).toBe('check');
    expect(allDone(card)).toEqual([]);
  });
});

describe("the words follow the mode's step (ruled 2026-10-30)", () => {
  it('a check already run reads "Checked this turn" in a turn mode and "Checked today" in a day mode', () => {
    expect(checkedWords('turn')).toBe('Checked this turn');
    expect(checkedWords('day')).toBe('Checked today');
  });

  it('a weather line with no season carries the tables to pick from and says so; one with a table carries none', () => {
    const weather = (tableId: string | null, tableChoices: string[]) =>
      cardFrom({ prompts: [{ kind: 'weather', stepId: 'sky', tableId, season: null, count: 1, tableChoices }], rest: null, reminders: [], to: 0 })[0]!;
    expect(weather(null, ['spring-sky', 'summer-sky'])).toMatchObject({ decision: 'roll', tableId: null, tableChoices: ['spring-sky', 'summer-sky'], note: 'No season yet: pick the weather table.' });
    expect(weather('any-sky', []).tableChoices).toBeUndefined();
  });
});

describe('lights on the card (M5-8, M5 step 7)', () => {
  it('one information line when a light runs low, or (once it burns out, even in the same +N) only the burnout; after the procedure', () => {
    const lights = [
      { id: 'wren', litAt: 0, seconds: 6 * 600, warnSeconds: 600, name: "Wren's rushlight" },
      { id: 'ash', litAt: 0, seconds: 8 * 600, warnSeconds: 2 * 600, name: "Ash's reed lamp" },
    ];
    const summary = nextSteps({ rules, mode: creep, units, startedAt: 0, now: 0, lights }, 6)!;
    const card = cardFrom(summary, { mode: creep, units, startedAt: 0 });
    expect(card.filter((l) => l.group === 'light').map((l) => [l.name, l.decision, l.icon])).toEqual([
      ["Wren's rushlight burnt out", 'info', 'light'],
      ["Ash's reed lamp is running low", 'info', 'light'],
    ]);
    // Procedure steps first, then lights.
    const groups = mergeCard([], card).map((l) => l.group);
    expect(groups.indexOf('light')).toBeGreaterThan(groups.lastIndexOf('procedure'));
  });
});

describe('a split party: wandering checks per group (ruled 2026-10-30, DG14)', () => {
  const encounter = (): CardLine => ({
    ...line('check:gm:wander', 'gm', 'check'),
    name: 'Wandering check',
    check: { checkId: 'wander', source: 'gm', chance: { die: 'd6', on: [1] }, always: false, ruledOut: false, modifiers: [], hit: { tables: [], tableFrom: null, pick: false, column: null, columns: [], regionTable: null, regionTables: false, swap: null, noteOnly: true, note: null, candidates: [] }, encounter: true, secret: true, again: false },
  });

  it('with one group the card is as it was', () => {
    const card = [encounter(), line('rest', 'rest')];
    expect(perGroup(card, [1])).toEqual(card);
  });

  it('with two groups each gets its own wandering check, named and keyed apart; other lines stay one', () => {
    const split = perGroup([encounter(), line('rest', 'rest')], [1, 2]);
    expect(split.map((l) => l.name)).toEqual(['Wandering check, Group 1', 'Wandering check, Group 2', 'rest']);
    expect(new Set(split.map((l) => l.key)).size).toBe(3);
    // Recording one group's check leaves the other's on the card.
    expect(takeOne(split, split[0]!.key).map((l) => l.name)).toEqual(['Wandering check, Group 2', 'rest']);
  });
});

describe('Check now on the card (M5 gate fix)', () => {
  const hit = { tables: [], tableFrom: null, pick: false, column: null, columns: [], regionTable: null, regionTables: false, swap: null, noteOnly: true, note: null, candidates: [] };
  const now: CardLine = {
    ...line('now:check:mode:wander', 'procedure', 'check'),
    check: { checkId: 'wander', source: 'mode', chance: { die: 'd6', on: [1] }, always: false, ruledOut: false, modifiers: [], hit, encounter: true, secret: true, again: false, now: true },
  };

  it('a Check now line already on the card stays at one; nothing is added', () => {
    const first = addCheckNow([], [now]);
    expect(first.added).toEqual([now.key]);
    const second = addCheckNow(first.card, [now]);
    expect(second.added).toEqual([]);
    expect(second.card).toHaveLength(1);
    expect(second.card[0]!.count).toBe(1);
  });

  it('after a split, only the groups whose check is missing get one', () => {
    const [g1, g2] = perGroup([now], [1, 2]);
    const { card, added } = addCheckNow([g1!], [g1!, g2!]);
    expect(added).toEqual([g2!.key]);
    expect(card.map((l) => [l.key, l.count])).toEqual([[g1!.key, 1], [g2!.key, 1]]);
  });

  it("Undo takes off only the lines Check now added, leaving the rest of the card", () => {
    const other = line('gm-a', 'gm');
    const { card, added } = addCheckNow([other], [now]);
    expect(withoutLines(card, added)).toEqual([other]);
  });
});

describe("a place's own check on the card ('Which table?' tags, d5-12)", () => {
  // Purpose (d5-12, ruled 2026-11-20: "Yes to all three"): when a place's own check is the one that hit, its own
  // table reads "this place" in that hit's list, not "this check"; a mode's check that hits keeps "this check".
  it.fails("a place's own check that hits tags its table as the place's; a mode's keeps its own", () => {
    const check = readCheck({ id: 'harbour-wander', name: 'Encounters on the water', chance: { die: 'd6', on: [1] }, onHit: { tableChoices: ['on-the-water', 'under-the-piles'] } })!;
    const prompt = { ...checkPrompt(check, 'encounter', null), kind: 'check' as const, stepId: null, count: 1, again: false };
    const [place] = cardFrom({ prompts: [{ ...prompt, source: 'location' as const }], rest: null, reminders: [], to: 0 });
    expect(place!.check!.hit.candidates).toEqual([
      { tableId: 'on-the-water', why: 'place', season: null },
      { tableId: 'under-the-piles', why: 'place', season: null },
    ]);
    expect(whichTables({ pins: [], candidates: place!.check!.hit.candidates, known: () => true }).rows.map((r) => r.why)).toEqual(['this place', 'this place']);
    const [mode] = cardFrom({ prompts: [{ ...prompt, source: 'mode' as const }], rest: null, reminders: [], to: 0 });
    expect(mode!.check!.hit.candidates.map((c) => c.why)).toEqual(['check', 'check']);
  });
});
