// The full sheet's Movement section (sr-1, bq-5), on invented rules.
import { describe, expect, it } from 'vitest';
import { movementOf } from './movement.ts';
import { ruleFills, showFilled, wholeDown } from '../library/fills.ts';
import { carriedLoad, combineEncumbrance, loadSpeed, speedOf } from '../inventory/encumbrance.ts';

const rulesSets = [{ movement: { default: 50, exploration: 'speed * 3', overland: 'floor(speed / 5)', running: 'speed * 3', swimming: 'speed / 2', combat: { formula: 'speed', unit: 'ft per round' }, partySpeed: 'slowest member' } }];

describe('Movement (sr-1)', () => {
  it("one section in the pack's words: speed, exploring, in a fight, overland; the rest folded under Speed", () => {
    // Purpose: no raw "Movement: <mode>" box: the usual figures get words, the others sit under Speed.
    const m = movementOf({ rulesSets, race: null, raceName: null, filled: {}, load: null, fields: [] });
    expect(m.rows.map((r) => `${r.label} ${r.value}`)).toEqual(['Speed 50', 'Exploring 150', 'In a fight 50 ft per round', 'Overland 10']);
    expect(m.more.map((r) => `${r.label} ${r.value}`)).toEqual(['Running 150', 'Swimming 25']);
    expect(m.rows[0]!.lines).toEqual(['Speed 50: the base speed for everyone in your setting.', 'Running: 150.', 'Swimming: 25.']);
    expect(m.rows.some((r) => /^Movement:/.test(r.label))).toBe(false);
  });

  it("the layout's own labels are the pack's words, in its order; a layout key the rules don't have leaves no blank row", () => {
    // Purpose: the pack names the rows; a key with no mode behind it never shows a blank or a second Exploring.
    const fields = [
      { key: 'speed', label: 'Speed', fill: 'movement.speed' },
      { key: 'exploring', label: 'Exploring (ft per turn)', fill: 'movement.explore' },
      { key: 'overland', label: 'Overland (points a day)', fill: 'movement.overland' },
    ];
    const m = movementOf({ rulesSets, race: null, raceName: null, filled: {}, load: null, fields });
    expect(m.rows.map((r) => `${r.label} ${r.value}`)).toEqual(['Speed 50', 'Overland (points a day) 10', 'Exploring 150', 'In a fight 50 ft per round']);
    // A mode the rules set has, but gives in words only, shows "—" under the layout's label.
    const words = [{ movement: { default: 50, exploration: 'base rate per turn' } }];
    expect(movementOf({ rulesSets: words, race: null, raceName: null, filled: {}, load: null, fields: [{ key: 'x', label: 'Exploring', fill: 'movement.exploration' }] }).rows[1]).toMatchObject({ label: 'Exploring', value: '—' });
  });

  it('the speed follows the load, as travel reads it (bq-5), and says why', () => {
    // Purpose: the sheet never disagrees with travel: a burdened character's figures come from the load's speed.
    const m = movementOf({ rulesSets, race: { speed: 30 }, raceName: 'Bog folk', filled: {}, load: { speed: 20, why: 'Laden (your load)' }, fields: [] });
    expect(m.rows[0]!.value).toBe('20');
    expect(m.rows[0]!.lines[0]).toBe('Speed 20: from Laden (your load).');
    expect(m.rows[1]!.lines).toEqual(['Speed 20: from Laden (your load).', 'Exploring: speed × 3 = 60.']);
    // With no load tracked, the kindred's own speed.
    expect(movementOf({ rulesSets, race: { speed: 30 }, raceName: 'Bog folk', filled: {}, load: null, fields: [] }).rows[0]!.lines[0]).toBe("Speed 30: Bog folk's own.");
    // Over the most they can carry: the setting's words.
    expect(movementOf({ rulesSets, race: null, raceName: null, filled: {}, load: { speed: null, why: "Can't move" }, fields: [] }).rows[0]!.value).toBe("Can't move");
  });

  it('a figure worked out from an odd speed shows as a whole number, rounded down, unless the pack rounds it itself', () => {
    // Purpose: the full sheet never shows "In a fight 41.666666666666664 ft per round": a speed of 125, 40 or 10
    // divided by 3 shows 41, 13 and 3 (rounded down, hard rule 8), the breakdown says so, and a pack that writes its
    // own rounding in the formula (ceil) keeps it. A figure the computer's sums leave just under a whole number
    // (0.29 × 100 = 28.999999999999996) still shows 29, and a speed that divides evenly says nothing about rounding.
    const odd = [{ movement: { default: 50, combat: { formula: 'speed / 3', unit: 'ft per round' }, wading: 'ceil(speed / 3)', creeping: 'speed * 0.29' } }];
    const sheet = (speed: number) => movementOf({ rulesSets: odd, race: { speed }, raceName: 'Reed folk', filled: {}, load: null, fields: [] });
    const fight = (speed: number) => sheet(speed).rows.find((r) => r.key === 'movement.combat')!;
    expect(fight(125).value).toBe('41 ft per round');
    expect(fight(40).value).toBe('13 ft per round');
    expect(fight(10).value).toBe('3 ft per round');
    expect(fight(125).lines[1]).toBe('In a fight: speed / 3 = 41 ft per round (rounded down).');
    const wading = sheet(125).more.find((r) => r.key === 'movement.wading')!;
    expect(wading.value).toBe('42');
    expect(wading.lines[1]).toBe('Wading: ceil(speed / 3) = 42.');
    const creeping = sheet(100).more.find((r) => r.key === 'movement.creeping')!;
    expect(creeping.value).toBe('29');
    expect(creeping.lines[1]).not.toContain('(rounded down)');
    expect(fight(30).value).toBe('10 ft per round');
    expect(fight(30).lines[1]).toBe('In a fight: speed / 3 = 10 ft per round.');
  });

  it('a speed the guided fill wrote at creation does not hide the load speed; one the player wrote by hand (marked) still wins', () => {
    // Purpose: one screen never gives a player two speeds. A region's base speed, copied onto the sheet's speed field
    // by creation's guided fill and never marked as typed by hand, is not a hand-written value: the Movement section
    // shows the speed the load gives (as the load summary and travel do), and In a fight follows it. A speed the player
    // typed by hand, marked in the character's edited fields (mv-2), still wins.
    const tiered = [
      {
        movement: { combat: { formula: 'speed / 3', unit: 'ft' } },
        encumbrance: { mode: 'coin', coin: { maxLoadCoin: 1500, tiers: [{ label: 'Unladen', max: 450, movement: "150' (50')" }, { label: 'Laden', max: 700, movement: "75' (25')" }, { label: 'Heavy', max: 1500, movement: "30' (10')" }] } },
      },
    ];
    // A region pack whose kindreds carry no speed: the setting's base speed only.
    const region = [{ unencumberedMovement: { speed: 45 }, defaultSpeed: 45 }];
    const rules = [...tiered, ...region];
    const kindred = { name: 'Moss kin' };
    const filled = ruleFills(rules, { klass: null, race: kindred }, {});
    const fields = [{ key: 'mv', label: 'Movement', fill: 'movement.speed' }];
    // What creation stored on the character: the guided fill's value, unmarked.
    const stored = { mv: showFilled(filled['movement.speed']!) };
    const load = carriedLoad([{ id: 'sack', name: 'Sack of coins', category: 'treasure', qty: 1, weightCoin: 696, slots: null, stack: 1, containerLineId: null, equipped: false, container: null, armourType: null }], combineEncumbrance(rules.map((r) => (r as { encumbrance?: unknown }).encumbrance)), 'coin');
    const sheet = (typed: Record<string, unknown>, edited: string[]) => {
      const input = { rulesSets: rules, race: kindred, raceName: 'Moss kin', filled, load: loadSpeed(load), fields, typed, edited };
      return movementOf(input);
    };
    const m = sheet(stored, []);
    expect(m.rows[0]!.value).toBe(String(speedOf(load)));
    expect(m.rows.find((r) => r.key === 'movement.combat')!.value).toBe(`${wholeDown(speedOf(load)! / 3)} ft`);
    // The player wrote their own speed on the sheet, and it was marked: it wins, and says so.
    const hand = sheet({ mv: '35' }, ['mv']);
    expect(hand.rows[0]!.value).toBe('35');
    expect(hand.rows[0]!.lines[0]).toBe('35 is written on the sheet.');
  });

  it('a setting that gives its speed only in words shows them; a hand-written value wins and says so', () => {
    // Purpose: words stay words; what the player wrote is shown as theirs.
    const words = [{ movement: { default: '80 ft (25 ft)' } }];
    const fields = [{ key: 'mv', label: 'Movement', fill: 'movement' }];
    expect(movementOf({ rulesSets: words, race: null, raceName: null, filled: { movement: '80 ft (25 ft)' }, load: null, fields }).rows).toEqual([
      { key: 'movement.speed', label: 'Movement', value: '80 ft (25 ft)', lines: ["80 ft (25 ft): your setting's rules give this."] },
    ]);
    const typed = movementOf({ rulesSets, race: null, raceName: null, filled: {}, load: null, fields, typed: { mv: '35' } });
    expect(typed.rows[0]!.value).toBe('35');
    expect(typed.rows[0]!.lines[0]).toBe('35 is written on the sheet.');
  });
});
