// Leaving the dungeon (docs/07 "Exploration", Leaving the dungeon; ruled 2026-10-29, D24 and afternoon ruling 8):
// a rules set's `dungeonExit` turns on End expedition's escape rolls when it's present (and its onlyWithOption is
// on). Each character makes the roll at the table; the prompt counts the switched-on modifiers and the depth:
// `depth: { per, value }` is "value for every `per` levels down", the levels counted below the first (T3). Without a
// `roll` (of-5, G-104) the rule still turns on Leave the dungeon, offering Use safe paths only (no roll, the pack's
// note shown); it needs its `safePaths` note then. Its option is read by the shared reader (optionGate.ts). Pure.
import type { Choices } from '../library/options.ts';
import { optionOn, optionSpecOf } from './modes.ts';

export interface DungeonExit {
  /** The escape roll; null when the rule has none (of-5: safe paths only). */
  roll: { save: string } | { check: string } | null;
  modifiers: { id: string; name: string; value: number }[];
  depth: { per: number; value: number } | null;
  onFailTable: string | null;
  safePaths: string | null;
  /** Who rolls (ruled 2026-10-30, DG18): each character (the default), or the party once. */
  who: 'each' | 'party';
}

/** A rule with its escape roll (the escape-roll requests need one). */
export type RolledExit = DungeonExit & { roll: NonNullable<DungeonExit['roll']> };

/** Whether the rule has an escape roll (of-5: without one it offers Use safe paths only). */
export const hasRoll = (rule: DungeonExit): rule is RolledExit => rule.roll !== null;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const int = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

/** The rule from the top rules set that has one, when its option is on; null when there's none (no escape rolls). */
export function readDungeonExit(rulesSets: readonly Record<string, unknown>[], choices: Choices = {}): DungeonExit | null {
  for (const rules of [...rulesSets].reverse()) {
    const d = rules.dungeonExit;
    if (!isRecord(d)) continue;
    if (!optionOn(optionSpecOf(d), choices)) return null;
    // of-5: no roll at all is safe paths only, when the pack says how to use them; a roll it can't read stays off.
    if (d.roll === undefined || d.roll === null) {
      const safePaths = text(d.safePaths);
      return safePaths ? { roll: null, modifiers: [], depth: null, onFailTable: null, safePaths, who: 'each' } : null;
    }
    const roll = isRecord(d.roll) ? d.roll : {};
    const which = text(roll.save) ? { save: roll.save as string } : text(roll.check) ? { check: roll.check as string } : null;
    if (!which) return null;
    const depth = isRecord(d.depth) ? d.depth : null;
    const per = depth ? int(depth.per) : null;
    const value = depth ? int(depth.value) : null;
    return {
      roll: which,
      modifiers: (Array.isArray(d.modifiers) ? d.modifiers : []).flatMap((m) =>
        isRecord(m) && text(m.id) && int(m.value) !== null ? [{ id: m.id as string, name: text(m.name) ?? (m.id as string), value: m.value as number }] : [],
      ),
      depth: per !== null && per > 0 && value !== null ? { per, value } : null,
      onFailTable: isRecord(d.onFail) ? text(d.onFail.table) : null,
      safePaths: text(d.safePaths),
      who: d.who === 'party' ? 'party' : 'each',
    };
  }
  return null;
}

/** The stepper's label (of-5, T3): the depth counts the levels below the first. */
export const DEPTH_LABEL = 'levels below the first';

/** The depth in words: "1 level below the first", "0 levels below the first". */
export const depthWords = (levelsDown: number) => `${levelsDown} ${levelsDown === 1 ? 'level' : 'levels'} below the first`;

/** The depth's part: `value` for every `per` levels down ({per: 2, value: −1}: −1 on levels 2–3, −2 on 4–5). */
export function depthModifier(rule: DungeonExit, levelsDown: number): number {
  if (!rule.depth || levelsDown < 1) return 0;
  return Math.floor(levelsDown / rule.depth.per) * rule.depth.value || 0;
}

export interface ExitPrompt {
  roll: DungeonExit['roll'];
  lines: { id: string; name: string; value: number }[];
  depth: number;
  /** All counted together. */
  total: number;
  onFailTable: string | null;
  safePaths: string | null;
}

/** The escape roll's prompt for a depth and the modifiers switched on (ids not in the rule are ignored). */
export function exitPrompt(rule: DungeonExit, levelsDown: number, switchedOn: readonly string[] = []): ExitPrompt {
  const lines = rule.modifiers.filter((m) => switchedOn.includes(m.id));
  const depth = depthModifier(rule, levelsDown);
  return { roll: rule.roll, lines, depth, total: lines.reduce((sum, m) => sum + m.value, depth), onFailTable: rule.onFailTable, safePaths: rule.safePaths };
}
