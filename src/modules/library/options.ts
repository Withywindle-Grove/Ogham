// Optional rules (a pack's `options`, docs/07-content-packs.md): each has choices and a default, picked when the
// pack is attached to a campaign. `changeLater` says whether the GM can change it afterwards: allow, warn
// (changes, with a warning) or lock ("never" in some packs). A rules set's `byOption` overrides are merged over
// its defaults for the choices made.
import { isEncumbranceMode, type EncumbranceMode, type TimeLengths } from '../../core/campaignSettings.ts';
import { byOptionKeyOn, entryOptionSpec, mergeOver, optionSpecOn, requiresOf } from './optionGate.ts';
import type { PackEntry } from './packFile.ts';

export interface OptionalRule {
  id: string;
  name: string;
  /** `short`: the choice's short label (about 14 letters, tf-3), for a Rules row's segmented control; absent when the pack gives none. */
  /**
   * `pack`: the short name of the pack a choice comes from, on an option another pack extends (of-1: the base's choices
   * plus the overlay's, each labelled); absent on an option no pack extends.
   */
  choices: { id: string; name: string; notes: string; short?: string; pack?: string }[];
  defaultChoice: string;
  changeLater: 'allow' | 'warn' | 'lock';
  notes: string;
  /** The pack's category for it (X-4), '' when none. */
  category: string;
  /** Its page reference (`source`, "Book p. 31"), '' when none (lr-6: source and page on every row). */
  source: string;
  /** Its shared topic name (`ruleKey`, 07), '' when none: read for the set-up's clash callout (lr-6); nothing resolves by it here. */
  ruleKey: string;
  /** The base option it extends (`extends`, of-1), '' when none: its choices join that option's, shown as one. */
  extends: string;
  /** The app doesn't apply it yet (`manual: true`, ex-7): shown as "Run by hand", its choice still saved. */
  manual?: boolean;
  /**
   * The parent choices it needs (`requires`, 07; A1, bq3-13): offered only while every option named has one of its
   * choices; otherwise hidden, at its default. Absent when it needs none.
   */
  requires?: Readonly<Record<string, readonly string[]>>;
  /** The presets it belongs to (`presets`, 07; A8, bq3-13): its choice under each, by the preset's id. Absent when none. */
  presets?: Readonly<Record<string, string>>;
}

/** A named bundle of choices (a rules set's `optionPresets`, 07): the options carrying its id in their `presets`. */
export interface OptionPreset {
  id: string;
  name: string;
  notes: string;
}

/** The fixed topic groups of "Rules for this campaign" (B15, ruled 2026-10-25), in order; anything unmapped is Other. */
export const RULE_TOPICS = ['Characters', 'Adventuring', 'Combat', 'Items and treasure', 'Time and calendar', 'Table and players', 'Other'] as const;
export type RuleTopic = (typeof RULE_TOPICS)[number];

/** Which topic group a pack's option category belongs in, by the words it uses; Other when none fits. */
export function topicOf(category: string): RuleTopic {
  const c = category.toLowerCase();
  if (/charact|class|race|kindred|abilit|\blevel|creation|hit point|\bhp\b|\bxp\b|experience/.test(c)) return 'Characters';
  if (/combat|fight|battle|initiative|attack|armou?r class|damage|morale/.test(c)) return 'Combat';
  if (/item|treasure|equipment|gear|encumb|carry|money|coin|magic item|weapon/.test(c)) return 'Items and treasure';
  if (/time|calendar|season|weather|rest|day/.test(c)) return 'Time and calendar';
  if (/explor|adventur|dungeon|wilderness|travel|light|camp|hazard|encounter/.test(c)) return 'Adventuring';
  if (/table|player|social|company|vote|retainer|hireling/.test(c)) return 'Table and players';
  return 'Other';
}

export type Choices = Record<string, string>;

/**
 * Whether an entry gated by an optional rule is in play (07, G-40; the second test, ct-10, 2026-11-02): the entry's
 * `option` ("<option id>", "<option id>=<choice id>" or ":<choice id>"), else the older `onlyWithOption`, names
 * the option and the choice it needs (no choice: `on`). An entry that names none is always in play; one whose option
 * the campaign hasn't chosen (and that has no default) isn't. Read the same way for any kind (classes, kits, lists),
 * so the app keeps no option ids. The shared reader's answer (optionGate.ts, of-3).
 */
export function entryOptionOn(data: Record<string, unknown>, choices: Readonly<Choices>): boolean {
  return optionSpecOn(entryOptionSpec(data), choices);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The optional rules among a pack's entries, in the pack's order. Choices without an id are left out. */
export function readOptions(entries: PackEntry[]): OptionalRule[] {
  return entries
    .filter((entry) => entry.kind === 'option')
    .flatMap((entry) => {
      const data = entry.data;
      const choices = (Array.isArray(data.choices) ? data.choices : [])
        .filter(isObject)
        .map((choice) => ({
          id: String(choice.id ?? ''),
          name: String(choice.name ?? choice.id ?? ''),
          notes: String(choice.notes ?? ''),
          ...(typeof choice.short === 'string' && choice.short.trim() ? { short: choice.short.trim() } : {}),
        }))
        .filter((choice) => choice.id);
      if (choices.length === 0) return [];
      const fallback = choices[0]!.id;
      const declared = String(data.default ?? fallback);
      const later = String(data.changeLater ?? 'allow');
      const requires = requiresOf(data);
      const presets = isObject(data.presets)
        ? Object.fromEntries(Object.entries(data.presets).filter((pair): pair is [string, string] => typeof pair[1] === 'string' && choices.some((c) => c.id === pair[1])))
        : {};
      return [
        {
          id: entry.packEntryId,
          name: entry.name,
          choices,
          defaultChoice: choices.some((c) => c.id === declared) ? declared : fallback,
          changeLater: later === 'warn' ? 'warn' : later === 'never' || later === 'lock' ? 'lock' : 'allow',
          notes: String(data.notes ?? ''),
          category: typeof data.category === 'string' ? data.category : '',
          source: typeof data.source === 'string' ? data.source.trim() : '',
          ruleKey: typeof data.ruleKey === 'string' ? data.ruleKey.trim() : '',
          extends: typeof data.extends === 'string' ? data.extends.trim() : '',
          ...(data.manual === true ? { manual: true } : {}),
          ...(Object.keys(requires).length > 0 ? { requires } : {}),
          ...(Object.keys(presets).length > 0 ? { presets } : {}),
        },
      ];
    });
}

/**
 * The presets a pack names (its rules sets' `optionPresets`, 07; A8): id, name and notes, once each, in the file's
 * order. One without an id is left out; one without a name is called by its id.
 */
export function readPresets(entries: readonly PackEntry[]): OptionPreset[] {
  const out: OptionPreset[] = [];
  for (const entry of entries.filter((e) => e.kind === 'rulesSet')) {
    for (const preset of Array.isArray(entry.data.optionPresets) ? entry.data.optionPresets.filter(isObject) : []) {
      const id = typeof preset.id === 'string' ? preset.id.trim() : '';
      if (!id || out.some((p) => p.id === id)) continue;
      const name = typeof preset.name === 'string' && preset.name.trim() ? preset.name.trim() : id;
      out.push({ id, name, notes: typeof preset.notes === 'string' ? preset.notes.trim() : '' });
    }
  }
  return out;
}

/** Each option's default choice; an option that extends another (of-1) has none of its own: the base's choice counts. */
export function defaultChoices(options: OptionalRule[]): Choices {
  return Object.fromEntries(options.filter((option) => !option.extends).map((option) => [option.id, option.defaultChoice]));
}

/** Changing one optional rule: the new choices, whether to warn, or why it can't change. */
export function changeRule(
  options: OptionalRule[],
  current: Choices,
  optionId: string,
  choiceId: string,
  { attaching }: { attaching: boolean },
): { ok: true; warn: boolean; choices: Choices } | { ok: false; message: string } {
  const option = options.find((o) => o.id === optionId);
  if (!option) return { ok: false, message: "That optional rule isn't in these setting rules." };
  if (!option.choices.some((c) => c.id === choiceId)) {
    return { ok: false, message: `"${choiceId}" isn't one of the choices for ${option.name}.` };
  }
  if (!attaching && option.changeLater === 'lock') return { ok: false, message: `${option.name} is locked once the campaign has started.` };
  return { ok: true, warn: !attaching && option.changeLater === 'warn', choices: { ...current, [optionId]: choiceId } };
}

/**
 * Applies one `byOption` over a base: each override whose choice was made is merged in, in the file's order. A key may
 * list several choices, comma-separated: any of them (of-12).
 */
function applyChoices(base: unknown, byOption: unknown, choices: Choices): unknown {
  let resolved = base;
  if (isObject(byOption)) {
    for (const [key, override] of Object.entries(byOption)) {
      if (byOptionKeyOn(key, choices)) resolved = mergeOver(resolved, override);
    }
  }
  return resolved;
}

/**
 * A section as the campaign uses it (2026-10-23: byOption may sit inside any section, next to what it changes).
 * Inner sections first; a section that is just `{ default, byOption }` stands for a plain value ("hold-only").
 */
function resolveSection(section: Record<string, unknown>, choices: Choices): unknown {
  const { byOption, ...rest } = section;
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) inner[key] = isObject(value) ? resolveSection(value, choices) : value;
  const plain = Object.keys(inner).length === 1 && 'default' in inner && !isObject(inner.default) && byOption !== undefined;
  return applyChoices(plain ? inner.default : inner, byOption, choices);
}

/**
 * A rules set as the campaign uses it: its defaults with the overrides of the choices made. The top-level
 * byOption applies first, then each section's own, so the more specific one wins.
 */
export function resolveRules(rulesSet: Record<string, unknown>, choices: Choices): Record<string, unknown> {
  const { byOption, ...defaults } = rulesSet;
  const withTop = applyChoices(defaults, byOption, choices) as Record<string, unknown>;
  return resolveSection(withTop, choices) as Record<string, unknown>;
}

/**
 * What setting rules preset when a new campaign starts: the encumbrance mode and time lengths of their rules
 * sets, after the optional rules chosen. Later packs sit on top and fill in only what they say.
 */
export function campaignPresets(
  packs: { entries: PackEntry[]; choices: Choices }[],
): { encumbranceMode?: EncumbranceMode; time: Partial<TimeLengths> } {
  const presets: { encumbranceMode?: EncumbranceMode; time: Partial<TimeLengths> } = { time: {} };
  // Every pack's choices, each pack's own over them: an overlay's byOption may name its base's option (of-1, extends).
  const every = Object.assign({}, ...packs.map((p) => p.choices)) as Choices;
  for (const pack of packs) {
    for (const entry of pack.entries.filter((e) => e.kind === 'rulesSet')) {
      const rules = resolveRules(entry.data, { ...every, ...pack.choices });
      const mode = isObject(rules.encumbrance) ? rules.encumbrance.mode : undefined;
      if (isEncumbranceMode(mode)) presets.encumbranceMode = mode;
      if (isObject(rules.time)) {
        for (const key of ['roundSeconds', 'turnMinutes', 'dayHours'] as const) {
          const value = rules.time[key];
          if (typeof value === 'number' && Number.isInteger(value) && value > 0) presets.time[key] = value;
        }
      }
    }
  }
  return presets;
}
