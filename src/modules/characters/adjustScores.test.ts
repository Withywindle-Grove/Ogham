// Creation's final drafts, slice B (final draft 1): Adjust scores' lead, each tile's modifier and thresholds, the
// prime's experience, the floor's reason, the trade's toast, and Scores' line. On the invented fixture pack
// scripts/fixtures/m5b-creation.fixture.json; every name and number is invented.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { scoresWhy } from './creationGuide.ts';
import { adjustmentRule } from './creationRules.ts';
import { adjustLead, adjustTileWords, loweredToast, primeXpLine, thresholdLine, tradeToast } from './creationSteps.ts';

type Entry = { id: string; name: string; [key: string]: unknown };
const pack = JSON.parse(fixture) as { rulesSets: Record<string, unknown>[]; classes: Entry[] };
const rules = pack.rulesSets;
const entry = (e: Entry) => ({ packEntryId: e.id, name: e.name, data: e });
const warden = entry(pack.classes.find((c) => c.id === 'lantern-warden')!);
const chaplain = entry(pack.classes.find((c) => c.id === 'marsh-chaplain')!);
// An invented two-prime class: Muscle and Wit, on the standard experience table.
const twoPrimes = entry({ id: 'dyke-reeve', name: 'Dyke Reeve', primeRequisites: ['MUS', 'WIT'], primeXp: { type: 'standard' } });
const rule = adjustmentRule(rules)!;
const names: Record<string, string> = { MUS: 'Muscle', NIM: 'Nimbleness', GRT: 'Grit', WIT: 'Wit', LORE: 'Lore', CHARM: 'Charm' };
const label = (key: string) => names[key] ?? key;
const NOTE = 'With two primes, the lower one sets the bonus.';

describe('Adjust scores: the lead (final draft 1, P8, P10)', () => {
  // Purpose: the lead names the prime and the rule in one breath, with the setting's own numbers.
  it('one prime: the prime in bold, the class, the experience sentence, the trade and the floor', () => {
    expect(adjustLead(rule, warden, rules, label)).toEqual({
      bold: 'Your prime is Muscle',
      rest: ', the Lantern Warden’s main score. Lower another score by 2 to raise your prime by 1. Nothing may go under 7.',
    });
  });

  // Purpose: a class whose prime earns no experience bonus (no primeXp) doesn't claim one.
  it('a prime with no experience bonus leaves the experience sentence out', () => {
    expect(adjustLead(rule, chaplain, rules, label).rest).toBe(', the Marsh Chaplain’s main score. Lower another score by 2 to raise your prime by 1. Nothing may go under 7.');
  });

  // Purpose: two primes show the pack's own line on how they count; without one, the rules set's rule in words (Design
  // on #564: the step always says which prime counts); with neither, nothing invented.
  it('two primes: the pack’s line when it has one, the rule’s words when it hasn’t, nothing invented with neither', () => {
    const withNote = adjustLead(rule, twoPrimes, [...rules, { primeRequisiteNote: NOTE }], label);
    expect(withNote.bold).toBe('Your primes are Muscle and Wit');
    expect(withNote.rest).toBe(`, the Dyke Reeve’s main scores. ${NOTE} Lower another score by 2 to raise a prime by 1. Nothing may go under 7.`);
    expect(adjustLead(rule, twoPrimes, [...rules, { primeRequisiteRule: 'lowest' }], label).rest).toBe(', the Dyke Reeve’s main scores. With two primes the lower one sets your experience. Lower another score by 2 to raise a prime by 1. Nothing may go under 7.');
    expect(adjustLead(rule, twoPrimes, rules.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'primeRequisiteRule'))), label).rest).toBe(', the Dyke Reeve’s main scores. Lower another score by 2 to raise a prime by 1. Nothing may go under 7.');
  });
});

describe('Adjust scores: a tile’s modifier and thresholds (final draft 1, P9)', () => {
  // Purpose: a prime only rises, so its tile shows the modifier now and the next threshold up.
  it('a prime: now and the next one up', () => {
    expect(thresholdLine(rules, 'MUS', 9, 'up')).toBe('+0 now, +1 at 12');
    expect(thresholdLine(rules, 'MUS', 13, 'up')).toBe('+1 now, +2 at 15');
  });

  // Purpose (Design on #544): one rule, from the controls: a score with − shows the next step down; a tile with no
  // control shows "now" only; neither goes past the table's ends.
  it('another score: the next one down; a tile with no control: now only', () => {
    expect(thresholdLine(rules, 'NIM', 10, 'down')).toBe('+0 now, −1 at 7');
    expect(thresholdLine(rules, 'NIM', 16, 'down')).toBe('+2 now, +1 at 14');
    expect(thresholdLine(rules, 'NIM', 2, 'down')).toBe('−2 now');
    expect(thresholdLine(rules, 'NIM', 10, 'none')).toBe('+0 now');
    expect(thresholdLine(rules, 'MUS', 16, 'up')).toBe('+2 now');
  });

  // Purpose: without the setting's table the line is left out rather than guessed.
  it('no table, no row for the number, or no modifier column: nothing', () => {
    expect(thresholdLine(rules, 'LUCK', 10, 'down')).toBe('');
    expect(thresholdLine(rules, 'MUS', 40, 'down')).toBe('');
    expect(thresholdLine([{ abilityModifiers: { MUS: [{ range: '3-18', literacy: 'Reads' }] } }], 'MUS', 10, 'down')).toBe('');
  });

  // Purpose: a column the setting marks as a value (not a modifier) isn't counted as the modifier.
  it('a value column is skipped for the first modifier column', () => {
    const valued = [{ abilityModifierColumns: { loyalty: 'value' }, abilityModifiers: { CHARM: [{ range: '3-8', loyalty: 5, reaction: -1 }, { range: '9-18', loyalty: 7, reaction: 0 }] } }];
    expect(thresholdLine(valued, 'CHARM', 10, 'down')).toBe('+0 now, −1 at 8');
  });
});

describe('Adjust scores: the prime’s experience (final draft 1)', () => {
  // Purpose (Design / Francis, 2026-11-07): a prime's tile shows experience, not the modifier: the experience now and
  // the next step up from the setting's prime-XP table, "+0% … now" under the first step, nothing past the top.
  it('a prime: the experience now and the next step up; +0% under the first step; the top alone', () => {
    expect(primeXpLine(warden, 'MUS', rules, { MUS: 13 })).toBe('+5% experience now, +10% at 15');
    expect(primeXpLine(warden, 'MUS', rules, { MUS: 9 })).toBe('+0% experience now, +5% at 12');
    expect(primeXpLine(warden, 'MUS', rules, { MUS: 6 })).toBe('−10% experience now, +0% at 8');
    expect(primeXpLine(warden, 'MUS', rules, { MUS: 16 })).toBe('+10% experience now');
  });

  // Purpose: where the class's experience doesn't say, the line is left out (the tile keeps its modifier line).
  it('no experience line for a non-prime, a class without primeXp, or a score off the table', () => {
    expect(primeXpLine(warden, 'NIM', rules, { MUS: 13, NIM: 10 })).toBe('');
    expect(primeXpLine(chaplain, 'LORE', rules, { LORE: 13 })).toBe('');
    expect(primeXpLine(warden, 'MUS', rules, { MUS: 40 })).toBe('');
    expect(primeXpLine(warden, 'MUS', rules, {})).toBe('');
  });

  // Purpose: a class's own experience rules (not the table) read the same way, raising only this prime.
  it('a class’s own rules: the next score that earns more', () => {
    const own = entry({ id: 'reed-scout', name: 'Reed Scout', primeRequisites: ['NIM'], primeXp: { type: 'rules', rules: [{ all: { NIM: 13 }, bonus: 5 }, { all: { NIM: 16 }, bonus: 10 }] } });
    expect(primeXpLine(own, 'NIM', rules, { NIM: 11 })).toBe('+0% experience now, +5% at 13');
  });
});

describe('Adjust scores: the words under a tile (final draft 1)', () => {
  // Purpose: at the floor the tile says why there's no −; under it, only the reason, with the sign.
  it('the floor’s reason; under it the sign; a prime’s note after its thresholds', () => {
    expect(adjustTileWords('+0 now, −1 at 8', 'at', 9)).toEqual({ text: "+0 now, −1 at 8. At the floor: can't go lower", warn: false });
    expect(adjustTileWords('+0 now', 'under', 9)).toEqual({ text: "Already under 9: can't be lowered", warn: true });
    expect(adjustTileWords('+5% experience now, +10% at 15', null, 9)).toEqual({ text: '+5% experience now, +10% at 15', warn: false });
    expect(adjustTileWords('', 'at', 9).text).toBe("At the floor: can't go lower");
  });

  // Purpose: the trade's toast names both scores, before and after.
  // Purpose (Design on #544): a lowering alone has its own toast naming what to raise next.
  it('the lowering’s toast: "Charm 11 → 9: now raise Muscle by 1"; two primes named with "or"', () => {
    expect(loweredToast('CHARM', { CHARM: 9 }, ['MUS'], rule, label)).toBe('Charm 11 → 9: now raise Muscle by 1');
    expect(loweredToast('CHARM', { CHARM: 9 }, ['MUS', 'WIT'], rule, label)).toBe('Charm 11 → 9: now raise Muscle or Wit by 1');
  });

  it('the toast: "Charm 11 → 9, Muscle 13 → 14"', () => {
    expect(tradeToast('CHARM', 'MUS', { CHARM: 9, MUS: 14 }, rule, label)).toBe('Charm 11 → 9, Muscle 13 → 14');
  });
});

describe('Scores: the line (final draft 1)', () => {
  // Purpose: the step's line says what the numbers are, counting them in words.
  it('counts the scores in words', () => {
    expect(scoresWhy(6)).toBe('Six numbers say what your character is naturally good at.');
    expect(scoresWhy(1)).toBe('One number says what your character is naturally good at.');
    expect(scoresWhy(14)).toBe('14 numbers say what your character is naturally good at.');
  });
});
