// The creation step shell's logic (M5b step 0c, slice 2; cr-2, cr-9, cr-10, cr-11), on the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json. Every name and number is invented.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { creationMethods, methodsToPick } from './creation.ts';
import { gearHelp } from './startingGear.ts';
import { adjustmentRule, scoresRule } from './creationRules.ts';
import {
  APP_HELP,
  methodLeavesOut,
  adjustProblem,
  adjustStepExists,
  bankLine,
  bankOf,
  canLower,
  canRaise,
  keptLine,
  classFit,
  classHeadings,
  modifierWords,
  pickProblem,
  primeXpBonus,
  raceHeadings,
  requirementFit,
  scoresProblem,
  specialApprovalOf,
  tileChange,
  tradedScores,
  whyNotOpen,
  withoutChip,
  tradeChips,
  tradeableScores,
  type Trade,
} from './creationSteps.ts';

type Entry = { id: string; name: string; [key: string]: unknown };
const pack = JSON.parse(fixture) as { rulesSets: Record<string, unknown>[]; races: Entry[]; classes: Entry[]; options: Entry[] };
const rules = pack.rulesSets;
const entry = (e: Entry) => ({ packEntryId: e.id, name: e.name, data: e });
const bogFolk = entry(pack.races.find((r) => r.id === 'bog-folk')!);
const stoneKin = entry(pack.races.find((r) => r.id === 'stone-kin')!);
const warden = entry(pack.classes.find((c) => c.id === 'lantern-warden')!);
const witch = entry(pack.classes.find((c) => c.id === 'reed-witch')!);
const stalker = entry(pack.classes.find((c) => c.id === 'mire-stalker')!);
const label = (key: string) => key;
const rule = adjustmentRule(rules)!;

describe('the Scores step (cr-9)', () => {
  it('words the modifier and what it affects from the score\'s row', () => {
    expect(modifierWords(rules, 'MUS', 13)).toBe('+1 melee');
    expect(modifierWords(rules, 'WIT', 9)).toBe('+1 extra languages, literacy Reads');
    expect(modifierWords(rules, 'NIM', 4)).toBe('−2 missile, −1 AC');
    expect(modifierWords(rules, 'MUS', null)).toBe('');
    expect(modifierWords([{}], 'MUS', 13)).toBe('');
  });

  // Gate walk 2026-11-05, bug 3 (Design's shape): a book's plain figures (a value column) read label first with no
  // sign, a zero modifier isn't shown, a zero value is, and a pack without the marks reads as before but for zeros.
  describe('plain-value columns (abilityModifierColumns)', () => {
    const table = (marks?: Record<string, string>) => [{ abilityModifiers: { CHARM: [{ range: '3-8', parley: -1, followers: 2, faith: 5 }, { range: '9-12', parley: 0, followers: 0, faith: 7 }] }, ...(marks ? { abilityModifierColumns: marks } : {}) }];
    it('a value column shows its label first and no sign; a modifier keeps its sign', () => {
      expect(modifierWords(table({ followers: 'value', faith: 'value' }), 'CHARM', 5)).toBe('−1 parley, followers 2, faith 5');
    });
    it('a modifier of zero is left out; a value of zero is shown', () => {
      expect(modifierWords(table({ followers: 'value', faith: 'value' }), 'CHARM', 10)).toBe('followers 0, faith 7');
    });
    it('a row whose modifiers are all zero gives no words (the tile has no caption line)', () => {
      expect(modifierWords([{ abilityModifiers: { MUS: [{ range: '9-12', melee: 0, missile: 0 }] } }], 'MUS', 10)).toBe('');
    });
    it('without the marks every number is a modifier, as before, only its zeros left out', () => {
      expect(modifierWords(table(), 'CHARM', 5)).toBe('−1 parley, +2 followers, +5 faith');
      expect(modifierWords(table(), 'CHARM', 10)).toBe('+7 faith');
    });
    it('a later rules set’s mark counts, and text is shown as written after its column', () => {
      const sets = [...table(), { abilityModifierColumns: { faith: 'value' } }, { abilityModifiers: { WIT: [{ range: '3-18', liftGate: '2-in-6', lore: 0 }] } }];
      expect(modifierWords(sets, 'CHARM', 10)).toBe('faith 7');
      expect(modifierWords(sets, 'WIT', 10)).toBe('lift gate 2-in-6');
    });
  });

  it('Next explains an empty score, then one outside the range; nothing when all six are in', () => {
    const keys = ['MUS', 'NIM'];
    const scores = scoresRule(rules);
    expect(scoresProblem(keys, { MUS: 9 }, scores, label)).toBe('NIM is missing');
    expect(scoresProblem(keys, { MUS: 1, NIM: 9 }, scores, label)).toBe('MUS must be 2–16');
    expect(scoresProblem(keys, { MUS: 9, NIM: 17 }, scores, label)).toBe('NIM must be 2–16');
    expect(scoresProblem(keys, { MUS: 9, NIM: 9 }, scores, label)).toBeNull();
    // Without a scores block, the modifier table's range stands in; a "19+" row has no top.
    expect(scoresProblem(['MUS'], { MUS: 20 }, null, label, () => ({ min: 3, max: 18 }))).toBe('MUS must be 3–18');
    expect(scoresProblem(['MUS'], { MUS: 2 }, null, label, () => ({ min: 3, max: null }))).toBe('MUS must be 3 or more');
    expect(scoresProblem(['MUS'], { MUS: 50 }, null, label)).toBeNull();
  });
});

describe('fit lines (cr-10)', () => {
  it('a race: the requirement met with a tick, unmet with the number in bold and a problem for Next; "No requirement" without one', () => {
    expect(requirementFit(bogFolk, { NIM: 9 }, label)).toEqual({ parts: [{ text: 'Needs NIM 8, you have 9 ✓' }], problem: null });
    expect(requirementFit(stoneKin, { GRT: 8 }, label)).toEqual({ parts: [{ text: 'Needs GRT 9, you have ' }, { text: '8', strong: true }, { text: "Needs the GM's special approval", warn: true }], problem: 'Stone kin needs GRT 9, you have 8' });
    expect(requirementFit(stoneKin, {}, label).problem).toBe('Stone kin needs GRT 9, you have not entered');
    expect(requirementFit(entry({ id: 'human', name: 'Human' }), {}, label)).toEqual({ parts: [{ text: 'No requirement' }], problem: null });
  });

  // Purpose (dec-10 A; cs-5, cs-33): one wording at every width, "Might 15, d8, +5% experience, to level 12 as Stone kin".
  it('a class: the prime and its score, the hit die, the experience bonus, the level cap for the race, "casts"', () => {
    const fit = classFit(warden, bogFolk, null, { MUS: 13, GRT: 9 }, rules, label);
    expect(fit.parts.map((p) => p.text).join('')).toBe('MUS 13, d8, +5% experience, to level 8 as Bog folk');
    expect(fit.problem).toBeNull();
    const caster = classFit(witch, null, null, { LORE: 15 }, rules, label);
    expect(caster.parts.map((p) => p.text).join('')).toBe('LORE 15, d4, +10% experience, to level 10, casts');
    expect(primeXpBonus(warden, rules, { MUS: 9 })).toBe(0);
    expect(primeXpBonus(entry({ id: 'x', name: 'X' }), rules, { MUS: 9 })).toBeNull();
  });

  it('a class with prime XP in the old app shape ({ any: [{ min, bonus }] }) shows no XP line (rc-1 replaced it)', () => {
    const old = entry({ id: 'old-shape', name: 'Old shape', primeRequisites: ['MUS'], primeXp: { any: [{ min: 12, bonus: 5 }] } });
    expect(primeXpBonus(old, rules, { MUS: 15 })).toBeNull();
  });
});

// rc-1 (design/rulings/m5b-0c-creation-recheck-2026-11-03.md): the packs' primeXp shape is canonical.
describe('prime XP in the packs’ shape (rc-1)', () => {
  const twoPrimes = (primeXp: unknown) => entry({ id: 'reed-knight', name: 'Reed Knight', primeRequisites: ['MUS', 'NIM'], primeXp });

  it('a class whose prime XP follows the setting’s table shows −10% XP for a prime of 7', () => {
    expect(primeXpBonus(warden, rules, { MUS: 7 })).toBe(-10);
    expect(classFit(warden, null, null, { MUS: 7, GRT: 9 }, rules, label).parts.map((p) => p.text).join('')).toBe('MUS 7, d8, −10% experience, to level 12');
    expect(classHeadings(warden, null, { MUS: 7, GRT: 9 }, rules, label).find((h) => h.label === 'Prime requisite')?.text).toBe('MUS, −10% XP with your scores');
  });

  // P10 (2026-11-06): with several primes the entry shows the pack's own line on how they count; never one of the app's.
  it('a class with two primes shows the pack’s line on how they count; one prime, or a pack with no line, shows none', () => {
    const knight = twoPrimes({ type: 'standard' });
    const said = [...rules, { primeRequisiteRule: 'lowest', primeRequisiteNote: 'With two primes, the lower one sets the bonus.' }];
    const prime = (klass: typeof knight, sets: typeof rules) => classHeadings(klass, null, { MUS: 13, NIM: 8 }, sets, label).find((h) => h.label === 'Prime requisite')?.text ?? '';
    expect(prime(knight, said)).toMatch(/^MUS, NIM, [−+]?\d+% XP with your scores\. With two primes, the lower one sets the bonus\.$/);
    expect(prime(warden, said)).not.toContain('lower one');
    expect(prime(knight, rules)).not.toContain('.');
  });

  it('a prime in the table’s bonus rows shows +5% and +10%; in the middle row 0%', () => {
    expect(primeXpBonus(warden, rules, { MUS: 13 })).toBe(5);
    expect(primeXpBonus(warden, rules, { MUS: 15 })).toBe(10);
    expect(primeXpBonus(warden, rules, { MUS: 9 })).toBe(0);
    expect(classFit(warden, null, null, { MUS: 15, GRT: 9 }, rules, label).parts.map((p) => p.text).join('')).toBe('MUS 15, d8, +10% experience, to level 12');
  });

  it('the rules set’s "lowest" makes the lower of two primes decide, for a class on the setting’s table', () => {
    const knight = twoPrimes({ type: 'standard' });
    expect(primeXpBonus(knight, rules, { MUS: 15, NIM: 6 })).toBe(-10);
    expect(primeXpBonus(knight, rules, { MUS: 13, NIM: 16 })).toBe(5);
    // Without primeRequisiteRule the pack says nothing, so the higher prime decides (⚑ 1 ruled by Francis, 2026-11-03: defer to the pack).
    const noRule = rules.map((r) => Object.fromEntries(Object.entries(r).filter(([key]) => key !== 'primeRequisiteRule')));
    const lorist = entry({ id: 'reed-lorist', name: 'Reed Lorist', primeRequisites: ['MUS', 'LORE'], primeXp: { type: 'standard' } });
    expect(primeXpBonus(lorist, noRule, { MUS: 13, LORE: 7 })).toBe(5);
    expect(primeXpBonus(lorist, rules, { MUS: 13, LORE: 7 })).toBe(-10);
    // A prime not entered yet: no XP line until both are in.
    expect(primeXpBonus(knight, rules, { MUS: 15 })).toBeNull();
  });

  it('a class with "rules" thresholds: an "all" rule needs every named score at its minimum', () => {
    const knight = twoPrimes({ type: 'rules', rules: [{ all: { MUS: 12, NIM: 12 }, bonus: 5 }, { all: { MUS: 15, NIM: 12 }, bonus: 10 }] });
    expect(primeXpBonus(knight, rules, { MUS: 15, NIM: 11 })).toBe(0);
    expect(primeXpBonus(knight, rules, { MUS: 12, NIM: 12 })).toBe(5);
    expect(primeXpBonus(knight, rules, { MUS: 15, NIM: 13 })).toBe(10);
  });

  it('a class with "rules" thresholds: an "any" rule needs one of the named scores at its minimum', () => {
    const knight = twoPrimes({ type: 'rules', rules: [{ any: { MUS: 12, NIM: 12 }, bonus: 5 }, { all: { MUS: 15, NIM: 15 }, bonus: 10 }] });
    expect(primeXpBonus(knight, rules, { MUS: 3, NIM: 12 })).toBe(5);
    expect(primeXpBonus(knight, rules, { MUS: 11, NIM: 11 })).toBe(0);
    expect(primeXpBonus(knight, rules, { MUS: 15, NIM: 15 })).toBe(10);
    expect(classFit(knight, null, null, { MUS: 15, NIM: 15 }, rules, label).parts.map((p) => p.text).join('')).toBe('MUS 15 and NIM 15, +10% experience');
  });

  it('no XP line when the class has no primeXp, its table isn’t in the rules sets, or the score is off the table', () => {
    expect(primeXpBonus(entry({ id: 'plain', name: 'Plain', primeRequisites: ['MUS'] }), rules, { MUS: 15 })).toBeNull();
    expect(primeXpBonus(warden, [{}], { MUS: 15 })).toBeNull();
    expect(primeXpBonus(warden, rules, { MUS: 30 })).toBeNull();
  });
});

describe('fit lines (cr-10), continued', () => {
  it('a class the race’s hard limit rules out says so first and can’t be picked: Next says why (cs-3)', () => {
    expect(whyNotOpen(witch, null, stoneKin)).toBe('Not open to stone kin');
    expect(whyNotOpen(witch, null, bogFolk)).toBeNull();
    const fit = classFit(witch, stoneKin, null, { LORE: 12 }, rules, label);
    expect(fit.parts[0]).toEqual({ text: 'Not open to stone kin', strong: true });
    expect(fit.parts.some((p) => p.text === "Needs the GM's special approval")).toBe(false);
    expect(fit.blocked).toBe("Reed Witch isn't open to stone kin. Pick another class, or go back.");
    expect(pickProblem('class', { fit }, false)).toBe(fit.blocked);
  });

  it('a class the race names NPC-only is closed the same way, and says whose it is (cs-3)', () => {
    const npc = { ...bogFolk, data: { ...bogFolk.data, npcOnlyClasses: ['reed-witch'] } };
    expect(whyNotOpen(witch, null, npc)).toBe('Not open to bog folk');
    expect(classFit(witch, npc, null, { LORE: 12 }, rules, label).blocked).toBe("Reed Witch isn't open to bog folk (only the GM’s characters). Pick another class, or go back.");
  });

  it('a soft limit is pickable: the fit line keeps the cap and flags the GM’s special approval (cs-3)', () => {
    const soft = { ...bogFolk, data: { ...bogFolk.data, classMaxLevels: { 'reed-witch': { maxLevel: 5, soft: true } } } };
    expect(whyNotOpen(witch, null, soft)).toBeNull();
    const fit = classFit(witch, soft, null, { LORE: 12 }, rules, label);
    expect(fit.blocked).toBeUndefined();
    expect(fit.parts.map((p) => p.text).join('')).toContain('to level 5 as Bog folk');
    expect(fit.parts.at(-1)).toEqual({ text: "Needs the GM's special approval", warn: true });
    expect(fit.problem).toBe("Reed Witch as bog folk needs the GM's leave");
    expect(pickProblem('class', { fit }, false)).toBeNull();
    expect(specialApprovalOf('class', witch, fit)).toEqual({ step: 'class', entryId: 'reed-witch', name: 'Reed Witch', requirement: "Reed Witch as bog folk needs the GM's leave" });
  });

  it('a class the method leaves out is still picked with the GM’s special approval (ruled 2026-11-02)', () => {
    const method = methodsToPick(creationMethods(pack.options.map((o) => ({ data: o, packEntryId: o.id })), () => undefined)).find((m) => m.id === 'calling-only')!;
    expect(whyNotOpen(witch, method, null)).toBe('Not with Calling as kindred');
    const fit = classFit(witch, null, method, { LORE: 12 }, rules, label);
    expect(fit.blocked).toBeUndefined();
    expect(fit.parts.at(-1)).toEqual({ text: "Needs the GM's special approval", warn: true });
  });

  // Purpose (#631 review): the warning sits on its own line, so the fit line before it ends without a comma.
  it('no comma runs up to the special-approval warning', () => {
    const method = methodsToPick(creationMethods(pack.options.map((o) => ({ data: o, packEntryId: o.id })), () => undefined)).find((m) => m.id === 'calling-only')!;
    const parts = classFit(witch, null, method, { LORE: 12 }, rules, label).parts;
    expect(parts.at(-2)?.text).not.toBe(', ');
  });

  // Purpose (F49, dec-1c): a class only the method closes says the method's reason on the review and the GM's card,
  // never that it "isn't open to" a kindred, even with a kindred picked.
  it('a class the method closes is worded with the method’s reason, not a kindred’s', () => {
    const method = methodsToPick(creationMethods(pack.options.map((o) => ({ data: o, packEntryId: o.id })), () => undefined)).find((m) => m.id === 'calling-only')!;
    expect(classFit(witch, null, method, { LORE: 12 }, rules, label).problem).toBe('Not with Calling as kindred');
    const fit = classFit(witch, bogFolk, method, { LORE: 12 }, rules, label);
    expect(fit.problem).toBe('Not with Calling as kindred');
    expect(specialApprovalOf('class', witch, fit)?.requirement).toBe('Not with Calling as kindred');
  });

  it('a race’s entry lists only the classes open to it, a soft one marked (cs-3)', () => {
    const race = { ...bogFolk, data: { ...bogFolk.data, classMaxLevels: { 'lantern-warden': 8, 'reed-witch': { maxLevel: 5, soft: true }, 'mire-stalker': null }, npcOnlyClasses: ['mire-stalker'] } };
    const names = raceHeadings(race, {}, label, (id) => pack.classes.find((c) => c.id === id)?.name).find((h) => h.label === 'Open classes')?.chips?.map((c) => c.name);
    expect(names).toEqual(['Lantern Warden (to 8)', 'Reed Witch (to 5, with the GM’s leave)']);
  });

  it('an unmet class requirement is the problem, with the shortfall in bold', () => {
    const fit = classFit(stalker, bogFolk, null, { NIM: 8 }, rules, label);
    expect(fit.problem).toBe('Mire Stalker needs NIM 9, you have 8');
    expect(fit.parts.some((p) => p.strong && p.text === '8')).toBe(true);
  });

  it('Next on a pick step: nothing picked (with or without Decide later); an unmet pick goes on, flagged (ruled 2026-11-02)', () => {
    expect(pickProblem('race', null, true)).toBe('Pick a race, or Decide later');
    expect(pickProblem('class', null, false)).toBe('Pick a class first.');
    expect(pickProblem('race', { fit: requirementFit(stoneKin, { GRT: 8 }, label) }, false)).toBeNull();
    expect(specialApprovalOf('race', stoneKin, requirementFit(stoneKin, { GRT: 8 }, label))).toEqual({ step: 'race', entryId: 'stone-kin', name: 'Stone kin', requirement: 'Stone kin needs GRT 9, you have 8' });
    expect(specialApprovalOf('race', bogFolk, requirementFit(bogFolk, { NIM: 9 }, label))).toBeNull();
    expect(pickProblem('race', { fit: requirementFit(bogFolk, { NIM: 9 }, label) }, false)).toBeNull();
  });
});

describe('the entry\'s full rules (cr-10, cr-24)', () => {
  it('a race has the six headings, abilities as bullet lines by kind, open classes as chips with their caps (ct-2)', () => {
    const headings = raceHeadings(bogFolk, { NIM: 9 }, label, (id) => pack.classes.find((c) => c.id === id)?.name);
    expect(headings.map((h) => h.label)).toEqual(['Requirement', 'Score changes', 'Advantages', 'Disadvantages', 'Languages', 'Open classes']);
    expect(headings.find((h) => h.label === 'Advantages')?.bullets).toEqual([{ name: 'Second wind', effect: 'Breathes under water for a turn.' }]);
    expect(headings.find((h) => h.label === 'Disadvantages')?.bullets).toEqual([{ name: 'Small', effect: "Can't use large weapons." }]);
    expect(headings.find((h) => h.label === 'Open classes')?.chips?.map((c) => c.name)).toEqual(['Lantern Warden (to 8)', 'Reed Witch (to 6)', 'Mire Stalker (to 10)', 'Marsh Chaplain (to 8)', 'Fen Cantor (to 6, with the GM’s leave)', 'Bog-kin (to 8)']);
    expect(headings.find((h) => h.label === 'Open classes')?.chips?.[0]?.id).toBe('lantern-warden');
    // A class the campaign doesn't offer (its optional rule is off; ct-10) is left out of Open classes.
    const offered = raceHeadings(bogFolk, { NIM: 9 }, label, (id) => pack.classes.find((c) => c.id === id)?.name, (id) => id !== 'bog-kin-calling');
    expect(offered.find((h) => h.label === 'Open classes')?.chips?.map((c) => c.name)).not.toContain('Bog-kin (to 8)');
  });

  it('a class lists its requirement, prime with the XP bonus, hit die, advantages, disadvantages, spellcasting and the cap by race (ct-2)', () => {
    const races = pack.races.map((r) => ({ packEntryId: r.id, name: r.name, data: r }));
    const headings = classHeadings(witch, bogFolk, { LORE: 12 }, rules, label, races, 'Kindred');
    expect(headings.map((h) => h.label)).toEqual(['Requirement', 'Prime requisite', 'Hit die', 'Advantages', 'Spellcasting', 'Level cap by kindred']);
    expect(headings.find((h) => h.label === 'Spellcasting')?.text).toBe('arcane, from level 1, up to spell level 3');
    // The picked race's cap first.
    expect(headings.find((h) => h.label === 'Level cap by kindred')?.text).toMatch(/^bog folk 6/);
    // Without the races: the cap as the race picked.
    expect(classHeadings(witch, bogFolk, { LORE: 12 }, rules, label).find((h) => h.label === 'Level cap')?.text).toBe('6 as bog folk');
    expect(classHeadings(warden, null, {}, rules, label).map((h) => h.label)).toContain('Disadvantages');
  });
});

describe('the ability adjustment (cr-11)', () => {
  const base = { MUS: 13, NIM: 9, GRT: 9, WIT: 16, LORE: 9, CHARM: 12 };

  it('a lowering banks a raise; the scores follow the trades; the bank line says what was traded', () => {
    const trades: Trade[] = [{ kind: 'lower', key: 'WIT' }, { kind: 'raise', key: 'MUS' }];
    expect(tradedScores(base, trades, rule)).toMatchObject({ WIT: 14, MUS: 14 });
    expect(bankOf(trades)).toBe(0);
    expect(bankLine(trades, rule, label)).toBe('Lowered WIT by 2 → raised MUS by 1: 0 to spend');
    expect(bankLine([], rule, label)).toBe('No trades yet: 0 to spend');
    expect(adjustProblem([{ kind: 'lower', key: 'WIT' }])).toBe('1 to spend: raise a prime, or undo the lowering');
    expect(adjustProblem(trades)).toBeNull();
  });

  it('a forbidden tap answers in a line: a prime can\'t be lowered, the floor, a class exception, a non-prime raise, nothing banked, the cap', () => {
    expect(canLower(rule, 'MUS', 13, warden, label)).toEqual({ ok: false, why: 'MUS is a prime: it can only be raised.', never: true });
    expect(canLower(rule, 'NIM', 8, warden, label)).toEqual({ ok: false, why: "NIM is 8: lowering it by 2 would take it under 7, so it can't be lowered." });
    // P11: a score already under the floor says so against its own number.
    expect(canLower(rule, 'NIM', 6, warden, (k) => (k === 'NIM' ? 'Nimbleness' : k))).toEqual({ ok: false, why: "Nimbleness is 6: already under 7, so it can't be lowered." });
    expect(canLower(rule, 'GRT', 12, warden, label)).toEqual({ ok: false, why: "GRT can't be lowered as a Lantern Warden.", never: true });
    expect(canLower(rule, 'WIT', 16, warden, label)).toEqual({ ok: true });
    expect(canRaise(rule, 'WIT', 16, warden, 1, label)).toEqual({ ok: false, why: "WIT isn't a prime of a Lantern Warden: only primes are raised.", never: true });
    expect(canRaise(rule, 'MUS', 13, warden, 0, label)).toEqual({ ok: false, why: 'Nothing banked. Lower a score by 2 first, then raise MUS.' });
    expect(canRaise(rule, 'MUS', 15, warden, 1, label)).toEqual({ ok: false, why: "MUS can't go above 15 by trading." });
    expect(canRaise(rule, 'MUS', 13, warden, 1, label)).toEqual({ ok: true });
    // A setting that names the lowerable scores: the others are never traded.
    const named = { ...rule, lowerable: ['WIT', 'LORE'] };
    expect(canLower(named, 'CHARM', 12, warden, label)).toEqual({ ok: false, why: "CHARM isn't tradeable in this setting.", never: true });
  });

  it('each trade is a chip "WIT −2 → MUS +1"; a chip\'s ✕ takes back that lowering and the raise it paid for, the others stay (ct-3)', () => {
    const trades: Trade[] = [{ kind: 'lower', key: 'WIT' }, { kind: 'raise', key: 'MUS' }, { kind: 'lower', key: 'CHARM' }, { kind: 'raise', key: 'MUS' }, { kind: 'lower', key: 'LORE' }];
    expect(tradeChips(trades, rule, label).map((c) => c.text)).toEqual(['WIT −2 → MUS +1', 'CHARM −2 → MUS +1', 'LORE −2']);
    expect(withoutChip(trades, 0)).toEqual([{ kind: 'lower', key: 'CHARM' }, { kind: 'raise', key: 'MUS' }, { kind: 'lower', key: 'LORE' }]);
    expect(tradeChips(withoutChip(trades, 1), rule, label).map((c) => c.text)).toEqual(['WIT −2 → MUS +1', 'LORE −2']);
    expect(withoutChip(trades, 2)).toEqual(trades.slice(0, 4));
  });

  it('only the tradeable scores have tiles; the rest are named as kept as rolled (ct-3, option C)', () => {
    const keys = Object.keys(base);
    // The warden: MUS is the prime (raised only), GRT can't be lowered as a warden, the rest lower.
    expect(tradeableScores(rule, keys, warden, label)).toEqual({ lowerable: ['NIM', 'WIT', 'LORE', 'CHARM'], raisable: ['MUS'], kept: ['GRT'] });
    const named = { ...rule, lowerable: ['WIT', 'LORE'] };
    const t = tradeableScores(named, keys, warden, label);
    expect(t.kept).toEqual(['NIM', 'GRT', 'CHARM']);
    expect(keptLine(t.kept, label)).toBe('NIM, GRT and CHARM stay as rolled in these rules');
    expect(keptLine(['GRT'], label)).toBe('GRT stays as rolled in these rules');
    expect(keptLine([], label)).toBe('');
  });

  it('the step exists only with the rule as data, a raisable prime and a lowerable score above the floor', () => {
    const keys = Object.keys(base);
    expect(adjustStepExists(rule, warden, keys, base, label)).toBe(true);
    expect(adjustStepExists(null, warden, keys, base, label)).toBe(false);
    expect(adjustStepExists(rule, null, keys, base, label)).toBe(false);
    // Every other score at the floor: nothing to lower.
    expect(adjustStepExists(rule, warden, keys, { MUS: 13, NIM: 7, GRT: 7, WIT: 7, LORE: 7, CHARM: 7 }, label)).toBe(false);
    // The prime at the cap: nothing to raise.
    expect(adjustStepExists(rule, warden, keys, { ...base, MUS: 15 }, label)).toBe(false);
    expect(adjustmentRule([{ abilityAdjustment: 'Lower one score by 2 to raise your prime by 1.' }])).toBeNull();
  });

  it('a tile shows before → after and the modifier\'s change', () => {
    expect(tileChange(16, 14, '+2 saves', '+1 saves')).toEqual({ delta: '16 −2', words: '+2 saves → +1 saves' });
    expect(tileChange(13, 13, '+1 melee', '+1 melee')).toEqual({ delta: '', words: '+1 melee' });
    expect(tileChange(13, 14, '', '+1 melee')).toEqual({ delta: '13 +1', words: '+1 melee' });
  });
});

describe("Help me choose, the app's own texts (cw-4)", () => {
  // Purpose: every step's text is one plain paragraph with no labels, and a first-time player is pointed to the GM.
  it('is one plain paragraph per step, with none of the old labels', () => {
    // No 'traits': each trait list's help is its own (retest 4 T5, traitLists.ts genericTraitHelp).
    const keys = ['method', 'scores', 'race', 'class', 'adjust', 'who', 'spells', 'languages', 'weaponSkills', 'details'];
    expect(Object.keys(APP_HELP).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const text = APP_HELP[key]!;
      expect(text, key).not.toMatch(/What to weigh|What this decides|If you.re unsure\./);
      expect(text.includes(String.fromCharCode(10)), key).toBe(false);
      expect(text, key).toMatch(/If you.re unsure/);
    }
    expect(APP_HELP.who).toContain('ask your GM');
  });

  // Purpose: Gear's help depends on what the step offers; the no-kit text never names a kit.
  it('Gear help is a choice of three: a kit offered, shop only, or gear given', () => {
    const kit = gearHelp({ kits: true, shop: true });
    const shop = gearHelp({ kits: false, shop: true });
    const given = gearHelp({ kits: false, shop: false });
    expect(new Set([kit, shop, given]).size).toBe(3);
    expect(kit).toContain('A kit is a ready-made set');
    expect(shop).not.toMatch(/kit/i);
    expect(given).not.toMatch(/kit|shop/i);
    for (const text of [kit, shop, given]) expect(text).not.toContain('What to weigh');
  });
});

describe("a method's row says which classes it leaves out (dec-10 B, cs-6)", () => {
  // Purpose: before it is picked, a method that leaves a class out says so on its row, in the warning words: picked,
  // those classes stay pickable with the GM's special approval (corrected 2026-11-12).
  const method = { id: 'point-buy', name: 'Point buy', races: 'required' as const, methods: [] };
  const open = entry({ id: 'lantern-warden', name: 'Lantern Warden' });
  const chaplain = entry({ id: 'marsh-chaplain', name: 'Marsh Chaplain', creationMethods: ['rolled'] });
  const cantor = entry({ id: 'fen-cantor', name: 'Fen Cantor', creationMethods: ['rolled'] });
  const both = entry({ id: 'reed-witch', name: 'Reed Witch', creationMethods: ['rolled', 'point-buy'] });
  it('none, one, two, and more', () => {
    expect(methodLeavesOut(method, [open, both])).toBeNull();
    expect(methodLeavesOut(method, [open, chaplain, both])).toBe('The Marsh Chaplain then needs the GM’s special approval');
    // A same-named class from a second pack counts once.
    expect(methodLeavesOut(method, [chaplain, { ...chaplain, packEntryId: 'marsh-chaplain-2' }])).toBe('The Marsh Chaplain then needs the GM’s special approval');
    expect(methodLeavesOut(method, [chaplain, cantor])).toBe('The Marsh Chaplain and the Fen Cantor then need the GM’s special approval');
    const many = ['A', 'B', 'C'].map((n) => entry({ id: n, name: n, creationMethods: ['rolled'] }));
    expect(methodLeavesOut(method, many)).toBe('3 classes then need the GM’s special approval');
  });
});
