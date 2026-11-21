// The optional rules shown one folded group per source, and the set-up's pack checks (docs/05 "Creating a campaign",
// 06 Components: Optional rules list, Setting rules step; ruling lr-5, lr-6, 2026-11-02). Pure: shared by the new
// campaign's steps 2 and 3 and (build order 4) Rules for this campaign.
//   * whenWords: when a rule can change, in words (the three lock levels; no padlock).
//   * changedFirst: a source's rules, the changed ones first, and how many.
//   * ruleGroupsOf / ruleClashes: the `ruleKey` groups (07, 2026-10-24/25; built 2026-11-02): options from different
//     packs with the same key form one group and one choice counts for the campaign. The winner is the pack the GM
//     picked (`settings.ruleGroups`, by pack id), else the pack on top of the stack (homebrew on top). A pick naming a
//     pack that isn't attached, or has no such rule any more, falls back to the order. ruleClashes keeps only the
//     groups with two or more offers (the callout).
//     A losing pack's own `byOption` keys and gates keep reading that pack's own choice (ruled 2026-11-02): the group
//     decides only the topic's effective choice (`winner`), read by `groupChoice`.
//   * withExtends: an option that `extends` another pack's option (of-1) shown as one: the base's choices, then the
//     overlay's, each labelled with its pack; the overlay's own row goes. The choice is the base option's (stored with
//     the base pack's choices), so the overlay's `byOption` keys name the base option ("encumbrance=items").
//   * setupOrder: the picked packs as they will stack (homebrew on top, the last picked on top of its layer), the
//     order attaching them one by one gives.
//   * missingBases: a picked pack whose `meta.requires` names a pack that isn't picked (lr-5: Next explains).
//   * offeredSources / changesWith: an add-on (`requires`, 07; A1, bq3-13) is offered only while its parent has a
//     choice it needs; a change that hides one sets it back to its default too, in the same change (Undo puts both
//     back). The parent is read from the add-on's own pack first, else the first pack (top of the stack) with it.
//   * presetChanges: a pack's preset (`optionPresets`, each option's `presets`; A8): what using it would change, and
//     what it leaves (a locked rule once the campaign has started).
import type { OptionalRule, Choices, OptionPreset } from './options.ts';
import { requiresOn } from './optionGate.ts';
import type { PackKind } from './packFile.ts';
import { stackOrder } from './stack.ts';

/** When a rule can change, in words (lr-6). */
export const WHEN_WORDS: Record<OptionalRule['changeLater'], string> = {
  allow: 'can change at any time',
  warn: 'can change, asks first',
  lock: "can't change once the campaign starts",
};

/** The choice in use: the one made, else the rule's default. */
export const choiceOf = (rule: OptionalRule, choices: Choices): string => {
  const made = choices[rule.id];
  return made !== undefined && rule.choices.some((c) => c.id === made) ? made : rule.defaultChoice;
};

/** A choice's name, or its id when the rule doesn't list it. */
export const choiceName = (rule: OptionalRule, choiceId: string): string => rule.choices.find((c) => c.id === choiceId)?.name ?? choiceId;

/** A source's rules with the changed ones first (each part in the pack's order). */
export function changedFirst(rules: readonly OptionalRule[], choices: Choices): { changed: OptionalRule[]; rest: OptionalRule[] } {
  const changed = rules.filter((r) => choiceOf(r, choices) !== r.defaultChoice);
  return { changed, rest: rules.filter((r) => !changed.includes(r)) };
}

/** "23 rules · 2 changed", "1 rule · none changed", or "none" for a pack without optional rules. */
export function countLine(total: number, changed: number): string {
  if (total === 0) return 'none';
  return `${total} ${total === 1 ? 'rule' : 'rules'}, ${changed === 0 ? 'none' : changed} changed`;
}

export interface RuleSource {
  packId: string;
  name: string;
  /** The pack's short name (meta.shortName), or its name: "Fen Rules". */
  shortName: string;
  kind: PackKind;
  rules: OptionalRule[];
  choices: Choices;
  /** The pack's presets (its rules sets' `optionPresets`, A8); absent or empty when it names none. */
  presets?: readonly OptionPreset[];
}

export interface RuleOffer {
  source: RuleSource;
  rule: OptionalRule;
  choiceId: string;
  choiceName: string;
}

export interface RuleGroup {
  ruleKey: string;
  /** The topic in words: "encumbrance", "creation method". */
  topic: string;
  /** Each pack's rule of that key, top of the stack first; the first is the one on top. */
  offers: RuleOffer[];
  /** The offer whose choice counts for the campaign. */
  winner: RuleOffer;
  /** The winner is the GM's pick (`settings.ruleGroups`), not the order. */
  picked: boolean;
}

/** A clash (lr-6): a group two or more packs offer. */
export type RuleClash = RuleGroup;

/** The GM's picks, by ruleKey: which pack's rule counts (a pack id). */
export type RuleGroupPicks = Readonly<Record<string, string>>;

/** The ruleKey as words: "creation-method" → "creation method". */
export const topicWords = (ruleKey: string): string => ruleKey.replace(/[-_]+/g, ' ').trim();

/**
 * Every `ruleKey` group among the sources (top of the stack first), in the order the first offer appears. A pack
 * offering two rules of one key counts once (its first). The winner is the picked pack's offer when it is one of
 * them, else the first (the pack on top).
 */
export function ruleGroupsOf(sources: readonly RuleSource[], picks: RuleGroupPicks = {}): RuleGroup[] {
  const byKey = new Map<string, RuleOffer[]>();
  for (const source of sources) {
    for (const rule of source.rules) {
      if (!rule.ruleKey) continue;
      const offers = byKey.get(rule.ruleKey) ?? [];
      if (offers.some((o) => o.source.packId === source.packId)) continue;
      const choiceId = choiceOf(rule, source.choices);
      offers.push({ source, rule, choiceId, choiceName: choiceName(rule, choiceId) });
      byKey.set(rule.ruleKey, offers);
    }
  }
  return [...byKey.entries()].map(([ruleKey, offers]) => {
    const picked = offers.find((o) => o.source.packId === picks[ruleKey]);
    return { ruleKey, topic: topicWords(ruleKey), offers, winner: picked ?? offers[0]!, picked: Boolean(picked) };
  });
}

/**
 * The base an extending rule joins (of-1): the first source, top of the stack first, other than its own, with a rule
 * of that id that extends nothing itself. Null when no attached pack has it (then the overlay's rule isn't offered:
 * nothing reads its choice, as its `byOption` keys name the base option).
 */
function baseOf<S extends RuleSource>(sources: readonly S[], own: S, rule: OptionalRule): S | null {
  return sources.find((s) => s !== own && s.rules.some((r) => r.id === rule.extends && !r.extends)) ?? null;
}

/**
 * The sources with every extending option shown as one with its base (of-1): the base rule's choices, labelled with
 * the base pack, then each overlay's choices (an id the base already has is the base's), labelled with the overlay;
 * an overlay choice without notes takes its option's. Rules that extend something leave their own source's list.
 * Applied wherever a campaign's optional rules are listed or grouped, so the base option's choice can be any of them.
 */
export function withExtends<S extends RuleSource>(sources: readonly S[]): S[] {
  const extensions = sources.flatMap((source) => source.rules.filter((r) => r.extends).map((rule) => ({ source, rule, base: baseOf(sources, source, rule) })));
  if (extensions.length === 0) return [...sources];
  return sources.map((source) => {
    const rules = source.rules
      .filter((rule) => !rule.extends)
      .map((rule) => {
        const joining = extensions.filter((e) => e.base === source && e.rule.extends === rule.id);
        if (joining.length === 0) return rule;
        const choices: OptionalRule['choices'] = rule.choices.map((c) => ({ ...c, pack: source.shortName }));
        for (const { source: from, rule: overlay } of joining) {
          for (const c of overlay.choices) if (!choices.some((b) => b.id === c.id)) choices.push({ ...c, notes: c.notes || overlay.notes, pack: from.shortName });
        }
        return { ...rule, choices };
      });
    return { ...source, rules };
  });
}

/** Two or more sources offering a rule with the same `ruleKey` (lr-6): one callout each. */
export function ruleClashes(sources: readonly RuleSource[], picks: RuleGroupPicks = {}): RuleClash[] {
  return ruleGroupsOf(sources, picks).filter((group) => group.offers.length > 1);
}

/** The group a rule of a source belongs to and whether that source lost it (another pack decides). */
const lostGroup = (groups: readonly RuleGroup[], packId: string, rule: OptionalRule): RuleGroup | null => {
  if (!rule.ruleKey) return null;
  const group = groups.find((g) => g.ruleKey === rule.ruleKey);
  return group && group.winner.source.packId !== packId && group.offers.some((o) => o.source.packId === packId && o.rule.id === rule.id) ? group : null;
};

/** "Decided above · Zine · Item counts" for a rule another pack decides, else undefined (the row's own buttons). */
export function decidedAbove(groups: readonly RuleGroup[], packId: string, rule: OptionalRule): string | undefined {
  const lost = lostGroup(groups, packId, rule);
  return lost ? `Decided above: ${lost.winner.source.shortName}, ${lost.winner.choiceName}` : undefined;
}

/** The picked packs as they will stack once attached in pick order: top first (homebrew on top, the last picked highest). */
export function setupOrder<T extends { id: string; kind: PackKind }>(picked: readonly T[]): T[] {
  return stackOrder(picked.map((pack, index) => ({ pack, packId: pack.id, kind: pack.kind, priority: index + 1 }))).map((row) => row.pack);
}

export interface MissingBase {
  /** The picked pack that needs another. */
  name: string;
  /** The names of what it needs and isn't picked; `inLibrary` false when the library hasn't got it. */
  needs: { name: string; inLibrary: boolean }[];
}

/**
 * Each picked pack whose `meta.requires` names a pack not picked (lr-5). `idOf` gives a library pack's `meta.id`;
 * a required id not in the library is named as it is.
 */
export function missingBases<T extends { id: string; name: string; requires: readonly string[] }>(picked: readonly T[], library: readonly T[], idOf: (pack: T) => string | null): MissingBase[] {
  return missingOf(picked, library, idOf).map(({ pack, needs }) => ({ name: pack.name, needs: needs.map((n) => ({ name: n.found?.name ?? n.id, inLibrary: Boolean(n.found) })) }));
}

/** The one reading behind missingBases and missingFromCampaign: each pack's required ids not among `picked`, found in the library or not. */
function missingOf<T extends { id: string; name: string; requires: readonly string[] }>(picked: readonly T[], library: readonly T[], idOf: (pack: T) => string | null) {
  const pickedIds = new Set(picked.map(idOf).filter((id): id is string => Boolean(id)));
  return picked.flatMap((pack) => {
    const needs = pack.requires.filter((id) => !pickedIds.has(id)).map((id) => ({ id, found: library.find((p) => idOf(p) === id) }));
    return needs.length > 0 ? [{ pack, needs }] : [];
  });
}

/** A campaign's attached pack that needs another not attached (rq-1): the base's words, each need's library pack. */
export interface MissingFromCampaign extends MissingBase {
  /** The attached pack's library id. */
  packId: string;
  /** What it needs; `packId` is the needed pack's library id, null when the library hasn't got it. */
  needs: { name: string; inLibrary: boolean; packId: string | null }[];
}

/**
 * Each attached pack whose `meta.requires` names a pack not attached to the campaign (rq-1). An attached pack carries
 * no `requires` of its own: it is read from its library entry (`library`, by id), as the attach step reads it; an
 * attached pack not in the library (the campaign's own homebrew) needs nothing here.
 */
export function missingFromCampaign<T extends { id: string; name: string; requires: readonly string[] }>(
  attachedPackIds: readonly string[],
  library: readonly T[],
  idOf: (pack: T) => string | null,
): MissingFromCampaign[] {
  const attached = attachedPackIds.flatMap((id) => library.find((p) => p.id === id) ?? []);
  return missingOf(attached, library, idOf).map(({ pack, needs }) => ({
    name: pack.name,
    packId: pack.id,
    needs: needs.map((n) => ({ name: n.found?.name ?? n.id, inLibrary: Boolean(n.found), packId: n.found?.id ?? null })),
  }));
}

/** "A and B" (", " before the last for three or more: "A, B and C"). */
const andList = (names: readonly string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * The ▲ line on a campaign's pack row (rq-1), in missingWords' voice: "Fen Rules needs Moss Rules, which isn't attached
 * to this campaign." With two: "…needs A and B, which aren't attached to this campaign." A needed pack the library
 * hasn't got ends the line: "Import it into your library first." (several: "Import them…"; some only: "Import B…").
 */
export function notAttachedWords(missing: MissingBase): string {
  const one = missing.needs.length === 1;
  const line = `${missing.name} needs ${andList(missing.needs.map((n) => n.name))}, which ${one ? "isn't" : "aren't"} attached to this campaign.`;
  const absent = missing.needs.filter((n) => !n.inLibrary);
  if (absent.length === 0) return line;
  const what = absent.length === missing.needs.length ? (one ? 'it' : 'them') : andList(absent.map((n) => n.name));
  return `${line} Import ${what} into your library first.`;
}

/** Next's words for a missing base (lr-5): "The Drowned Abbey needs Fen Rules, Advanced · pick it, or leave it out." */
export function missingWords(missing: MissingBase): string {
  const names = missing.needs.map((n) => n.name).join(' and ');
  const one = missing.needs.length === 1;
  const inLibrary = missing.needs.every((n) => n.inLibrary);
  const fix = inLibrary ? `pick ${one ? 'it' : 'them'}` : `import ${one ? 'it' : 'them'} into your library`;
  // "leave it out", not the pack's name again: a long name would fill the foot twice (layout check, 375 px).
  return `${missing.name} needs ${names}, ${fix}, or leave it out.`;
}

/**
 * "needs Fen Rules, Advanced ✓" once every base is picked, else "Needs: Fen Rules, Advanced.", naming only the bases
 * not picked yet (rq-1: which required packs are missing, not the whole list).
 */
export function needsPicked(requires: readonly string[], pickedIds: ReadonlySet<string>, names: ReadonlyMap<string, string>): string {
  if (requires.length === 0) return '';
  const nameOf = (id: string) => names.get(id) ?? id;
  const missing = requires.filter((id) => !pickedIds.has(id));
  return missing.length === 0 ? `needs ${requires.map(nameOf).join(', ')} ✓` : `Needs: ${missing.map(nameOf).join(', ')}.`;
}

/** The choice in use of a parent option an add-on names: its own pack's rule of that id, else the first pack's (top first). */
function parentChoices(sources: readonly RuleSource[], own: RuleSource, rule: OptionalRule): Choices {
  const out: Record<string, string> = {};
  for (const optionId of Object.keys(rule.requires ?? {})) {
    const home = [own, ...sources].find((s) => s.rules.some((r) => r.id === optionId && !r.extends));
    const parent = home?.rules.find((r) => r.id === optionId && !r.extends);
    if (home && parent) out[optionId] = choiceOf(parent, home.choices);
  }
  return out;
}

/** Whether a source's rule is offered: it needs nothing, or each parent it names has one of the choices it needs (07). */
export const ruleOffered = (sources: readonly RuleSource[], source: RuleSource, rule: OptionalRule): boolean =>
  !rule.requires || requiresOn(rule.requires, parentChoices(sources, source, rule));

/**
 * The sources with every hidden add-on at its default (A1): followed until nothing moves, so an add-on to an add-on
 * goes too. A source whose choices don't move is the same object.
 */
export function settleRequires<S extends RuleSource>(sources: readonly S[]): S[] {
  let now = [...sources];
  for (let pass = 0; pass <= now.reduce((n, s) => n + s.rules.length, 0); pass++) {
    let moved = false;
    const before = now;
    now = before.map((source) => {
      let choices = source.choices;
      for (const rule of source.rules) {
        if (ruleOffered(before, source, rule) || choiceOf(rule, choices) === rule.defaultChoice) continue;
        choices = { ...choices, [rule.id]: rule.defaultChoice };
        moved = true;
      }
      return choices === source.choices ? source : { ...source, choices };
    });
    if (!moved) break;
  }
  return now;
}

/** The sources as the rows show them (A1): hidden add-ons at their default and left out of each source's rules. */
export function offeredSources<S extends RuleSource>(sources: readonly S[]): S[] {
  const settled = settleRequires(sources);
  return settled.map((source) => {
    const rules = source.rules.filter((rule) => ruleOffered(settled, source, rule));
    return rules.length === source.rules.length ? source : { ...source, rules };
  });
}

/** One pack's choices before and after a change. */
export interface ChoicesChange {
  packId: string;
  previous: Choices;
  next: Choices;
}

/**
 * Every pack's choices a change makes (A1): the edits given (by pack id), then each add-on they hide set back to its
 * default, in whatever pack it is. Only the packs whose choices move, each with what it had before (for Undo).
 */
export function changesWith(sources: readonly RuleSource[], edits: Readonly<Record<string, Choices>>): ChoicesChange[] {
  const edited = sources.map((s) => (edits[s.packId] ? { ...s, choices: edits[s.packId]! } : s));
  const settled = settleRequires(edited);
  return sources.flatMap((source, i) => {
    const next = settled[i]!.choices;
    return source.rules.some((r) => choiceOf(r, next) !== choiceOf(r, source.choices)) ? [{ packId: source.packId, previous: source.choices, next }] : [];
  });
}

/** One rule a change moves, in words: "Creation method: Basic → Advanced". */
export interface RuleMove {
  packId: string;
  ruleId: string;
  name: string;
  from: string;
  to: string;
}

/** The rules a set of changes moves (each source's, in its order), for a preview or a toast. */
export function movesOf(sources: readonly RuleSource[], changes: readonly ChoicesChange[]): RuleMove[] {
  return changes.flatMap((change) => {
    const source = sources.find((s) => s.packId === change.packId);
    return (source?.rules ?? []).flatMap((rule) => {
      const from = choiceOf(rule, change.previous);
      const to = choiceOf(rule, change.next);
      return from === to ? [] : [{ packId: change.packId, ruleId: rule.id, name: rule.name, from: choiceName(rule, from), to: choiceName(rule, to) }];
    });
  });
}

/** What using a preset would do (A8): the changes (Undo keeps `previous`), each rule it moves, and the rules it leaves. */
export interface PresetPlan {
  preset: OptionPreset;
  changes: ChoicesChange[];
  moves: RuleMove[];
  /** A rule the preset names that stays as it is, and why ("can't change once the campaign starts"). */
  kept: { name: string; why: string }[];
}

/**
 * A pack's preset over the campaign's choices (A8; 05 Optional rules grouped): each of that pack's rules naming the
 * preset takes the preset's choice; the rest stay as they are. Once the campaign has started (`attaching` false) a
 * locked rule stays as chosen and is named. Then the add-ons it hides go to their default (A1). Null when the pack
 * has no such preset.
 */
export function presetChanges(sources: readonly RuleSource[], packId: string, presetId: string, { attaching }: { attaching: boolean }): PresetPlan | null {
  const source = sources.find((s) => s.packId === packId);
  const preset = source?.presets?.find((p) => p.id === presetId);
  if (!source || !preset) return null;
  const next: Record<string, string> = { ...source.choices };
  const kept: PresetPlan['kept'] = [];
  for (const rule of source.rules) {
    const wanted = rule.presets?.[presetId];
    if (wanted === undefined || wanted === choiceOf(rule, source.choices)) continue;
    if (!attaching && rule.changeLater === 'lock') {
      kept.push({ name: rule.name, why: WHEN_WORDS.lock });
      continue;
    }
    next[rule.id] = wanted;
  }
  const changes = changesWith(sources, { [packId]: next });
  return { preset, changes, moves: movesOf(sources, changes), kept };
}
