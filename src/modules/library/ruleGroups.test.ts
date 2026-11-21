// The optional rules by source and the set-up's pack checks (ruling lr-5, lr-6, 2026-11-02). Invented packs only.
// What it checks:
//   * a source's changed rules come first, and the count line says how many (and "none" for a pack without rules);
//   * two packs with an option of the same ruleKey make one clash, the pack on top first; one pack alone makes none;
//   * ruleKey groups: the top pack wins by default, a pick wins, a pick naming an absent pack falls back; the losing
//     pack reads the winner's choice (or none); "Decided above" words for the loser only;
//   * the set-up's order: homebrew on top, the last picked highest within its layer;
//   * a picked pack whose base isn't picked is found, with Next's words; a base not in the library says to import it;
//   * "needs <pack> ✓" once the base is picked, else the library's "Needs: …";
//   * an overlay's option that `extends` a base option is shown as one with it (of-1), its choices labelled by pack.
import { describe, expect, it } from 'vitest';
import type { OptionalRule } from './options.ts';
import { changedFirst, choiceName, countLine, decidedAbove, ruleGroupsOf, missingBases, missingWords, needsPicked, ruleClashes, setupOrder, topicWords, withExtends, type RuleSource } from './ruleGroups.ts';

const rule = (id: string, extra: Partial<OptionalRule> = {}): OptionalRule => ({
  id,
  name: id,
  choices: [
    { id: 'on', name: 'On', notes: '' },
    { id: 'off', name: 'Off', notes: '' },
  ],
  defaultChoice: 'off',
  changeLater: 'allow',
  notes: '',
  category: '',
  source: '',
  ruleKey: '',
  extends: '',
  ...extra,
});

const source = (packId: string, rules: OptionalRule[], choices: Record<string, string> = {}, kind: RuleSource['kind'] = 'setting'): RuleSource => ({ packId, name: packId, shortName: packId, kind, rules, choices });

describe('rules by source', () => {
  it('puts the changed rules first, each part in the pack order', () => {
    const rules = [rule('a'), rule('b'), rule('c')];
    const { changed, rest } = changedFirst(rules, { c: 'on', a: 'off' });
    expect(changed.map((r) => r.id)).toEqual(['c']);
    expect(rest.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('says how many rules and how many changed, and "none" for a pack without any', () => {
    expect(countLine(23, 2)).toBe('23 rules, 2 changed');
    expect(countLine(1, 0)).toBe('1 rule, none changed');
    expect(countLine(0, 0)).toBe('none');
  });
});

describe('ruleKey clashes', () => {
  it('two packs with the same ruleKey make one clash, the pack on top first, with each one\'s choice', () => {
    const fen = source('fen', [rule('fen-load', { ruleKey: 'item-load', choices: [{ id: 'weight', name: 'By weight', notes: '' }, { id: 'count', name: 'By count', notes: '' }], defaultChoice: 'weight' })]);
    const zine = source('zine', [rule('zine-load', { ruleKey: 'item-load', choices: [{ id: 'slots', name: 'Item counts', notes: '' }], defaultChoice: 'slots' })], {}, 'homebrew');
    const clashes = ruleClashes([zine, fen]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]!.topic).toBe('item load');
    expect(clashes[0]!.offers.map((o) => [o.source.packId, o.choiceName])).toEqual([
      ['zine', 'Item counts'],
      ['fen', 'By weight'],
    ]);
  });

  it('a ruleKey in one pack only, or options without one, make no clash', () => {
    expect(ruleClashes([source('fen', [rule('a', { ruleKey: 'omens' }), rule('b')]), source('zine', [rule('b')])])).toEqual([]);
  });

  it('writes a ruleKey as words', () => {
    expect(topicWords('creation-method')).toBe('creation method');
  });
});

describe('ruleKey groups (one choice per group)', () => {
  const choice = (id: string, name: string) => ({ id, name, notes: '' });
  const fen = () => source('fen', [rule('fen-load', { ruleKey: 'item-load', choices: [choice('weight', 'By weight'), choice('count', 'By count')], defaultChoice: 'weight' })]);
  const zine = () => source('zine', [rule('zine-load', { ruleKey: 'item-load', choices: [choice('weight', 'Weigh it'), choice('slots', 'Item counts')], defaultChoice: 'slots' }), rule('plain')], {}, 'homebrew');

  it('the pack on top wins a group by default (not picked); a pick naming the lower pack makes it the winner', () => {
    const byDefault = ruleGroupsOf([zine(), fen()])[0]!;
    expect(byDefault.winner.source.packId).toBe('zine');
    expect(byDefault.picked).toBe(false);
    const picked = ruleGroupsOf([zine(), fen()], { 'item-load': 'fen' })[0]!;
    expect(picked.winner.source.packId).toBe('fen');
    expect(picked.picked).toBe(true);
  });

  it('a pick naming a pack that is not among the offers falls back to the top pack', () => {
    const group = ruleGroupsOf([zine(), fen()], { 'item-load': 'gone' })[0]!;
    expect(group.winner.source.packId).toBe('zine');
    expect(group.picked).toBe(false);
  });

  it('says "Decided above: <winner>, <choice>" for the losing pack\'s rule, and nothing for the winner\'s or a plain rule', () => {
    const groups = ruleGroupsOf([zine(), fen()], { 'item-load': 'fen' });
    const zineRule = zine().rules[0]!;
    expect(decidedAbove(groups, 'zine', zineRule)).toBe('Decided above: fen, By weight');
    expect(decidedAbove(groups, 'fen', fen().rules[0]!)).toBeUndefined();
    expect(decidedAbove(groups, 'zine', zine().rules[1]!)).toBeUndefined();
  });

  it('ruleClashes still lists the group once, with the pick applied', () => {
    expect(ruleClashes([zine(), fen()], { 'item-load': 'fen' })[0]!.winner.source.packId).toBe('fen');
  });
});

describe('the set-up order', () => {
  it('puts homebrew on top, then the last picked highest', () => {
    const picked = [
      { id: 'fen', kind: 'setting' as const },
      { id: 'zine', kind: 'homebrew' as const },
      { id: 'abbey', kind: 'adventure' as const },
    ];
    expect(setupOrder(picked).map((p) => p.id)).toEqual(['zine', 'abbey', 'fen']);
  });
});

describe('missing bases', () => {
  const lib = [
    { id: 'p1', name: 'Fen Rules, Advanced', requires: [] as string[], meta: 'fen-rules' },
    { id: 'p2', name: 'The Drowned Abbey', requires: ['fen-rules'], meta: 'abbey' },
    { id: 'p3', name: 'Moth Hollow', requires: ['moth-rules'], meta: 'moth' },
  ];
  const idOf = (p: (typeof lib)[number]) => p.meta;

  it('an adventure whose base isn\'t picked is found, with Next\'s words', () => {
    const missing = missingBases([lib[1]!], lib, idOf);
    expect(missing).toEqual([{ name: 'The Drowned Abbey', needs: [{ name: 'Fen Rules, Advanced', inLibrary: true }] }]);
    expect(missingWords(missing[0]!)).toBe('The Drowned Abbey needs Fen Rules, Advanced, pick it, or leave it out.');
  });

  it('nothing is missing once the base is picked', () => {
    expect(missingBases([lib[0]!, lib[1]!], lib, idOf)).toEqual([]);
  });

  it('a base not in the library says to import it', () => {
    const missing = missingBases([lib[2]!], lib, idOf);
    expect(missingWords(missing[0]!)).toBe('Moth Hollow needs moth-rules, import it into your library, or leave it out.');
  });

  it('says "needs <pack> ✓" once the base is picked, else the library\'s line', () => {
    const names = new Map([['fen-rules', 'Fen Rules, Advanced']]);
    expect(needsPicked(['fen-rules'], new Set(['fen-rules']), names)).toBe('needs Fen Rules, Advanced ✓');
    expect(needsPicked(['fen-rules'], new Set(), names)).toBe('Needs: Fen Rules, Advanced.');
    expect(needsPicked([], new Set(), names)).toBe('');
  });
});

// of-1 (design/rulings/m5b-options-format-2026-11-03.md): an overlay's option with `extends` joins the base option.
describe("an option that extends another pack's (of-1)", () => {
  const load = rule('carrying', {
    name: 'Carrying',
    ruleKey: 'encumbrance',
    choices: [
      { id: 'none', name: 'Not tracked', notes: '' },
      { id: 'weight', name: 'By weight', notes: 'Coins and pounds.' },
    ],
    defaultChoice: 'none',
  });
  const counts = rule('reed-item-counts', {
    name: 'Item counts',
    extends: 'carrying',
    notes: 'Count bundles, not weight.',
    choices: [
      { id: 'items', name: 'Item counts', notes: '' },
      { id: 'weight', name: 'Reed weight', notes: '' },
    ],
    defaultChoice: 'items',
  });
  const fen = source('fen', [load, rule('oil')]);
  const reed = source('reed', [counts, rule('reed-moss')], {}, 'homebrew');

  // Purpose: the GM sees one Carrying row holding the base's choices and then the overlay's, each labelled with its
  // pack, and the overlay's own list no longer has an Item counts row.
  it("shows the base's choices then the overlay's, each labelled with its pack, and drops the overlay's own row", () => {
    const [top, base] = withExtends([reed, fen]);
    expect(top!.rules.map((r) => r.id)).toEqual(['reed-moss']);
    const joined = base!.rules.find((r) => r.id === 'carrying')!;
    expect(joined.choices.map((c) => [c.id, c.pack])).toEqual([
      ['none', 'fen'],
      ['weight', 'fen'],
      ['items', 'reed'],
    ]);
    expect(base!.rules.find((r) => r.id === 'oil')!.choices.every((c) => c.pack === undefined)).toBe(true);
  });

  // Purpose: a choice id the base already has stays the base's (no second "weight"), and an overlay choice with no
  // notes of its own explains itself with its option's notes.
  it("keeps the base's choice on a shared id, and gives an overlay choice without notes its option's", () => {
    const joined = withExtends([reed, fen])[1]!.rules[0]!;
    expect(joined.choices.filter((c) => c.id === 'weight').map((c) => c.name)).toEqual(['By weight']);
    expect(joined.choices.find((c) => c.id === 'items')!.notes).toBe('Count bundles, not weight.');
  });

  // Purpose: without its base attached, the overlay's option isn't offered at all (nothing would read its choice).
  it("offers an extending option nowhere when its base isn't attached", () => {
    const [alone] = withExtends([reed]);
    expect(alone!.rules.map((r) => r.id)).toEqual(['reed-moss']);
  });

  // Purpose: the base's ruleKey group reads the overlay's choice as the topic's answer, once the base pack stores it.
  it("lets the base's ruleKey group read a choice the overlay brought", () => {
    const groups = ruleGroupsOf(withExtends([reed, { ...fen, choices: { carrying: 'items' } }]));
    const group = groups.find((g) => g.ruleKey === 'encumbrance')!;
    expect(group.winner.choiceId).toBe('items');
    expect(choiceName(group.winner.rule, 'items')).toBe('Item counts');
    expect(group.offers).toHaveLength(1);
  });

  // Purpose: sources with no extending option come back unchanged.
  it('leaves sources without an extending option as they are', () => {
    expect(withExtends([fen])).toEqual([fen]);
  });
});
