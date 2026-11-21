// Every step's Help is its own (creation retest 4 S2, 2026-11-09). Invented setting only. Purpose: Help me choose on
// each creation step comes from that step (the pack's `creationGuide.<step>.help`, else the app's own) and each trait
// list's from that list (its `help`, else the app's words naming the list), as the screens read them (Characters.tsx,
// FinishCreation.tsx); no two steps share one text unless the pack itself gave them the same words. The bug it guards:
// an overlay's bloodline list showed the base setting's secondary-skill help.
import { describe, expect, it } from 'vitest';
import { stepGuide, type GuideStep } from './creationGuide.ts';
import { APP_HELP } from './creationSteps.ts';
import { traitHelp, traitListsOf } from './traitLists.ts';

const STEPS: (GuideStep | 'adjust')[] = ['method', 'scores', 'race', 'class', 'adjust', 'who', 'spells', 'gear', 'languages', 'weaponSkills', 'traits', 'details'];

/** Each step's help as its screen shows it; trait lists each their own step. */
function helps(rulesSets: Record<string, unknown>[], lists: ReturnType<typeof traitListsOf>): { step: string; help: string }[] {
  const steps = STEPS.filter((s) => s !== 'traits' && s !== 'gear').map((s) => ({ step: s, help: stepGuide(rulesSets, s).help ?? APP_HELP[s] ?? '' }));
  return [...steps, ...lists.map((l) => ({ step: `trait:${l.id}`, help: traitHelp(l) }))].filter((h) => h.help);
}

/** The steps sharing a text, as "a + b"; [] when every text is its own. */
function shared(all: { step: string; help: string }[]): string[] {
  const by = new Map<string, string[]>();
  for (const h of all) by.set(h.help, [...(by.get(h.help) ?? []), h.step]);
  return [...by.values()].filter((steps) => steps.length > 1).map((steps) => steps.join(' + '));
}

const list = (id: string, name: string, data: Record<string, unknown> = {}) => ({ kind: 'traitList', packEntryId: id, name, data: { entries: [{ id: `${id}-1`, name: 'One' }], ...data } });

describe('every step’s Help is its own (S2)', () => {
  it('a base setting with a guide and an overlay’s lists without help: no two steps share a text', () => {
    const rulesSets = [{ creationGuide: { race: { help: 'Pick your folk.' }, traits: { help: 'A trade from before adventuring: eel catcher, reed cutter.' } } }];
    const lists = traitListsOf([list('fen-trades', 'Fen trades', { die: 'd6', help: 'A trade from before adventuring: eel catcher, reed cutter.' }), list('ember-bloodline', 'Ember bloodline', { die: 'd8' }), list('heron-signs', 'Heron signs')]);
    const all = helps(rulesSets, lists);
    expect(shared(all)).toEqual([]);
    // The bloodline speaks of itself, never of the trade.
    expect(all.find((h) => h.step === 'trait:ember-bloodline')!.help).toMatch(/^Ember bloodline:/);
  });

  it('two steps share a text only when the pack gave both the same words', () => {
    const same = 'Ask the table what fits.';
    const lists = traitListsOf([list('moon-signs', 'Moon signs', { help: same }), list('star-signs', 'Star signs', { help: same })]);
    const all = helps([], lists);
    expect(shared(all)).toEqual(['trait:moon-signs + trait:star-signs']);
    expect(all.filter((h) => h.help === same).every((h) => lists.some((l) => `trait:${l.id}` === h.step && l.help === same))).toBe(true);
  });
});
