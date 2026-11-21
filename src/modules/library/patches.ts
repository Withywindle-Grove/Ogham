// Overlay patches (design/rulings/m5b-options-format-2-2026-11-03.md of-13; m5b-builder-questions-3-2026-11-04.md
// bq3-17, "of-14"; docs/07 "Patches in detail"): a pack's `patches[]`, one library entry each (kind `patch`),
//   { byOption: "<option>=<choice>[,…]", match: { kind, category?, ids? }, change: { "<path>": value | { delta } | { times } } }
//   or `option: null` in place of `change` (the matched entries don't exist under those choices).
// The shared option reader applies them where the campaign's setting is read (campaignSetting.ts), after each entry's
// own `byOption`, to every attached pack's entries (the winning copy included); and the Pack applies the same patches
// to a carried line's own copy of its item (its details), so AC and damage follow the choice in play.
//   `change` names a dotted path ("armour.ac"); `{ delta }` adds (on dice, to the modifier: "1d8" −1 → "1d8−1"),
//   `{ times }` multiplies; a path the entry lacks changes nothing (`pack:check` says so), except that a set value
//   creates the missing keys on its way, objects only (pf-19; patchPath.ts reads the path). Several patches on one
//   path: deltas add, multipliers stack, and a set value follows the pack highest in the stack. Every figure a patch
//   changes names it ("AC −1 · Bronze, Mire zine"). Pure; nothing here touches the database.
import { byOptionKeyOn, specParts, type Choices } from './optionGate.ts';
import { hiddenByKind, planSet, readPath } from './patchPath.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

export type PatchChange = { kind: 'delta'; by: number } | { kind: 'times'; by: number } | { kind: 'set'; value: unknown };

export interface Patch {
  /** The pack the patch comes from, and its words for the breakdown ("Mire zine"). */
  packId: string;
  packName: string;
  packEntryId: string;
  /** The choices it applies under ("mire-metals=bronze", several comma-separated). */
  byOption: string;
  /** The part of `byOption` the campaign has chosen, for the breakdown's words (set by `patchesInPlay`); else all of it. */
  chosen: string;
  match: { kind: string; category: string | null; ids: string[] | null };
  /** Its changes by path; empty for a removal. */
  changes: { path: string; change: PatchChange }[];
  /** `option: null`: the matched entries don't exist under these choices. */
  removes: boolean;
  /** The pack's place in the stack (0 is the top): a set value from the pack on top wins. */
  rank: number;
}

/** One figure a patch changed, for the breakdown: "AC −1 · Bronze, Mire zine". */
export interface PatchLine {
  path: string;
  text: string;
}

export interface Patched<T> {
  data: T;
  /** Each figure's line, in the order applied; empty when nothing changed. */
  lines: PatchLine[];
  /** The byOption spec of the patch that removes the entry; '' when none does. */
  removedBy: string;
}

/** One change as the pack writes it: a plain value sets, `{ delta }` adds, `{ times }` multiplies. Null for a malformed one. */
function readChange(value: unknown): PatchChange | null {
  if (isRecord(value) && ('delta' in value || 'times' in value)) {
    if ('delta' in value) return whole(value.delta) ? { kind: 'delta', by: value.delta } : null;
    return whole(value.times) ? { kind: 'times', by: value.times } : null;
  }
  return { kind: 'set', value };
}

/**
 * A campaign's patches from its entries of kind `patch`, with each pack's name for the breakdown and its rank in the
 * stack (`packs`, top first). Malformed patches (no byOption, no match kind, neither change nor `option: null`) are
 * left out: `pack:check` reports them.
 */
export function readPatches(
  entries: readonly { kind: string; packId: string; packEntryId: string; data: Record<string, unknown> }[],
  packs: readonly { packId: string; name: string; shortName?: string }[],
): Patch[] {
  const out: Patch[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'patch') continue;
    const data = entry.data;
    const byOption = text(data.byOption);
    const match = isRecord(data.match) ? data.match : null;
    const kind = match ? text(match.kind) : '';
    if (!byOption || !kind || specParts(byOption).some((p) => !p.choice)) continue;
    const removes = 'option' in data && data.option === null;
    const changes = isRecord(data.change)
      ? Object.entries(data.change).flatMap(([path, value]) => {
          const change = readChange(value);
          return change && text(path) ? [{ path: text(path), change }] : [];
        })
      : [];
    if (!removes && changes.length === 0) continue;
    const ids = Array.isArray(match!.ids) ? match!.ids.map(text).filter(Boolean) : null;
    const rank = packs.findIndex((p) => p.packId === entry.packId);
    const pack = packs[rank];
    out.push({
      packId: entry.packId,
      packName: pack?.shortName || pack?.name || entry.packId,
      packEntryId: entry.packEntryId,
      byOption,
      chosen: byOption,
      match: { kind, category: text(match!.category) || null, ids: ids && ids.length > 0 ? ids : null },
      changes: removes ? [] : changes,
      removes,
      rank: rank < 0 ? packs.length : rank,
    });
  }
  return out;
}

/**
 * The patches whose choices the campaign has made (byOption as a `byOption` key: any of its choices), each with the
 * choices in play as `chosen` ("mire-metals=bronze" of "mire-metals=bronze,mire-metals=bone"), for its words.
 */
export function patchesInPlay(patches: readonly Patch[], choices: Choices): Patch[] {
  return patches
    .filter((p) => byOptionKeyOn(p.byOption, choices))
    .map((p) => ({ ...p, chosen: specParts(p.byOption).filter((part) => choices[part.option] === part.choice).map((part) => `${part.option}=${part.choice}`).join(',') || p.byOption }));
}

/** Whether a patch's `match` names this entry: its kind, its category when given, its id when ids are listed. */
export function patchMatches(patch: Patch, entry: { kind: string; packEntryId: string; data: Record<string, unknown> }): boolean {
  if (entry.kind !== patch.match.kind) return false;
  if (patch.match.category !== null && text(entry.data.category) !== patch.match.category) return false;
  return patch.match.ids === null || patch.match.ids.includes(entry.packEntryId);
}

/**
 * The value at a dotted path, and whether the path is there at all (a field the entry lacks changes nothing). Own
 * fields only, never `__proto__`, `constructor` or `prototype` (pf-19; patchPath.ts).
 */
export function atPath(data: unknown, path: string): { found: boolean; value: unknown } {
  return readPath(data, path);
}

/**
 * A copy with the value at a dotted path replaced: the path is there, or planSet said its missing keys may be made
 * (each made as an object; never a list, never over a value, never a forbidden name).
 */
function withPath(data: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (!head) return data;
  if (rest.length === 0) {
    if (value === undefined) {
      const kept = { ...data };
      delete kept[head];
      return kept;
    }
    return { ...data, [head]: value };
  }
  const inner = data[head];
  return { ...data, [head]: withPath(isRecord(inner) ? inner : {}, rest.join('.'), value) };
}

const DICE = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+\-−])\s*(\d+))?\s*$/i;

/** A dice expression with its modifier adjusted: "1d8" −1 → "1d8−1", "1d6+1" −1 → "1d6". Null when it isn't dice. */
export function adjustDice(dice: string, delta: number): string | null {
  const match = DICE.exec(dice);
  if (!match) return null;
  const modifier = (match[4] ? (match[3] === '+' ? 1 : -1) * Number(match[4]) : 0) + delta;
  const head = `${match[1] ?? ''}d${match[2]}`;
  return modifier === 0 ? head : modifier > 0 ? `${head}+${modifier}` : `${head}−${-modifier}`;
}

/**
 * The deltas the patches add at one path of an entry, summed: for a figure another rule sets first (a rules set's
 * every-weapon die, of-8), which then takes the patches' deltas after it ("d6" with −1 → "d6−1").
 */
export function deltaAt(entry: { kind: string; packEntryId: string; data: Record<string, unknown> }, patches: readonly Patch[], path: string): number {
  return patches
    .filter((p) => patchMatches(p, entry))
    .flatMap((p) => p.changes)
    .reduce((sum, { path: at, change }) => (at === path && change.kind === 'delta' ? sum + change.by : sum), 0);
}

/** The words for a path's figure: "AC", "Damage", "Price", "Weight", else the leaf as written. */
export function figureName(path: string): string {
  const leaf = path.split('.').pop() ?? path;
  if (/^armour\.(ac|aac|base)$/.test(path)) return 'AC';
  if (path === 'armour.acBonus') return 'AC bonus';
  if (path === 'armour.magicBonus') return 'Magic bonus';
  if (path === 'weapon.damage') return 'Damage';
  if (path === 'value' || /^value\./.test(path)) return 'Price';
  if (leaf === 'weightCoin') return 'Weight';
  if (leaf === 'slots') return 'Slots';
  return leaf.charAt(0).toUpperCase() + leaf.slice(1);
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
const shown = (value: unknown) => (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value));

/**
 * The changes of several patches on one path, combined as ruled (bq3-17 (3)): a set value from the pack highest in
 * the stack (its patches in order; ties: the later patch), then the deltas added and the multipliers stacked. On a
 * number: set, then ×times, then +delta. On dice: only the deltas, on the modifier. A set of `null` removes the field.
 * Null when the value can't take the change (times on words), so nothing changes.
 */
function combine(value: unknown, applied: readonly { patch: Patch; change: PatchChange }[]): unknown {
  const sets = applied.filter((a) => a.change.kind === 'set').sort((a, b) => b.patch.rank - a.patch.rank);
  const set = sets.length > 0 ? sets[sets.length - 1]!.change : null;
  const delta = applied.reduce((sum, a) => (a.change.kind === 'delta' ? sum + a.change.by : sum), 0);
  const times = applied.reduce((product, a) => (a.change.kind === 'times' ? product * a.change.by : product), 1);
  let now: unknown = set && set.kind === 'set' ? set.value : value;
  if (typeof now === 'number') return now * times + delta;
  if (typeof now === 'string' && delta !== 0) {
    const dice = adjustDice(now, delta);
    if (dice === null) return set ? now : null;
    now = dice;
  }
  if (typeof now === 'string' && times !== 1 && !set) return null;
  return now === null ? undefined : now;
}

/**
 * An entry's fields with the patches that match it applied (of-13, bq3-17), with a line for every figure changed,
 * and the choice (`chosen`) of the patch that removes it. The same object back when no patch touches it. `choiceName`
 * gives the words for a byOption spec ("Bronze"); the line names the figure, the change and the source: "AC −1 ·
 * Bronze, Mire zine" for a delta, "Price ×10 · …" for a multiplier, "AC 5 · …" for a set value.
 */
export function applyPatches<T extends Record<string, unknown>>(
  entry: { kind: string; packEntryId: string; data: T },
  patches: readonly Patch[],
  choiceName: (byOption: string) => string = (spec) => spec,
): Patched<T> {
  const matching = patches.filter((p) => patchMatches(p, entry));
  if (matching.length === 0) return { data: entry.data, lines: [], removedBy: '' };
  const removedBy = matching.find((p) => p.removes)?.chosen ?? '';
  const byPath = new Map<string, { patch: Patch; change: PatchChange }[]>();
  for (const patch of matching) for (const { path, change } of patch.changes) byPath.set(path, [...(byPath.get(path) ?? []), { patch, change }]);
  let data: Record<string, unknown> = entry.data;
  const lines: PatchLine[] = [];
  for (const [path, applied] of byPath) {
    // A field the kind hides from players by name is never touched, by any operation (pf-19a, widened).
    if (hiddenByKind(entry.kind, path)) continue;
    const at = atPath(data, path);
    // A set that would add a section a rules set doesn't have, or that its path refuses, changes nothing (pf-19, pf-19a).
    const sets = applied.some((a) => a.change.kind === 'set');
    const plan = sets ? planSet(data, path, entry.kind) : null;
    if (plan?.kind === 'refused') continue;
    // A path the entry lacks: only a set value makes it, objects only (pf-19); anything else changes nothing there.
    if (!at.found && !(applied.some((a) => a.change.kind === 'set' && a.change.value !== null) && plan?.kind === 'create')) continue;
    const next = combine(at.value, applied);
    if (next === null || next === at.value) continue;
    data = withPath(data, path, next);
    const name = figureName(path);
    for (const { patch, change } of applied) {
      const what = change.kind === 'delta' ? signed(change.by) : change.kind === 'times' ? `×${change.by}` : change.value === null ? 'off' : shown(change.value);
      lines.push({ path, text: `${name} ${what}: ${choiceName(patch.chosen)}, ${patch.packName}` });
    }
  }
  return { data: data as T, lines, removedBy };
}
