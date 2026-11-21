// How a patch's dotted path is read (pf-19, design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md): the
// one reading the app's patches (patches.ts) and pack:check (scripts/pack-option-gates.mjs) share.
//   - A patch that sets a value creates the keys it lacks on its way, objects only.
//   - Never a list. pf-19c (the lead, 2026-11-14, for lv-1's levelNames; it widens pf-19): "In a patch's change path a
//     numeric step is always an object key; a patch never sets into, makes or pads a list." So "levelNames.0" makes or
//     adds the key "0"; a path through a list that is there is refused.
//   - Never over a value: a step that is there and isn't an object (words, a number, a list, nothing) is refused.
//   - Never `__proto__`, `constructor` or `prototype`, as any step: refused, and never followed.
//   - pf-19a (docs/design/rulings/dec-evening-2026-11-13.md): never touch a field its kind hides from players by name,
//     by any operation (a patron's `cult` and `statBlockId`, HIDDEN_BY_KIND), whether or not the entry has it; never add a
//     section a rules set doesn't have. Such a patch changes nothing, as before pf-19; it must be in the pack that owns
//     the entry. A rules set's existing sections, and fields in an entry's own gmOnly list, are as before.
// Every other kind of patch (a delta, a multiplier) changes nothing on a path the entry lacks, as before. Pure.

/** The step names a patch may never create or follow. */
export const FORBIDDEN_STEPS = ['__proto__', 'constructor', 'prototype'] as const;

/**
 * The fields a kind hides from players by name, whatever the entry's gmOnly list (pf-19a): the database's list,
 * `private.hidden_keys` (supabase/migrations/20261111130000_dec_1a_patrons.sql), but for a rules set's sections,
 * which the "no new section" rule covers. scripts/patch-hidden-by-kind.test.mjs checks the two lists agree.
 */
export const HIDDEN_BY_KIND: Readonly<Record<string, readonly string[]>> = { patron: ['cult', 'statBlockId'] };

/**
 * pf-19a, widened (the lead, 2026-11-13): a patch never touches a field its kind hides by name, by any operation (a
 * set, a delta, a multiplier, or any added later). The refusal when `path` starts at one, else null.
 */
export function hiddenByKind(kind: string, path: string): Extract<SetPlan, { kind: 'refused' }> | null {
  const head = path.split('.')[0]!;
  return HIDDEN_BY_KIND[kind]?.includes(head)
    ? { kind: 'refused', reason: 'hidden', at: head, text: `a patch can't change "${head}" on a ${kind}: it is hidden from players, so it must be in the pack that owns the entry` }
    : null;
}

export type SetPlan =
  /** The whole path is there: the value is set where it is. */
  | { kind: 'existing' }
  /** The path is missing from `from` (the first missing step, written as a path) on: those keys are made as objects. */
  | { kind: 'create'; from: string }
  /** The set can't be made: nothing changes. `at` is the path up to the step in question; `text` says why. */
  | { kind: 'refused'; reason: 'forbidden' | 'empty' | 'not-object' | 'hidden' | 'new-section'; at: string; text: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const own = (here: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(here, key);
const forbidden = (step: string) => (FORBIDDEN_STEPS as readonly string[]).includes(step);

/** Words for a value that isn't a group of fields. */
function what(value: unknown): string {
  if (typeof value === 'string') return 'words';
  if (typeof value === 'number') return 'a number';
  if (typeof value === 'boolean') return 'true or false';
  if (Array.isArray(value)) return 'a list';
  if (value === null) return 'null';
  return 'not a group of fields';
}

/** The steps of a path, or a refusal for an empty or forbidden step (whatever the entry holds). */
function stepsOf(path: string): string[] | Extract<SetPlan, { kind: 'refused' }> {
  const steps = path.split('.');
  const bad = steps.findIndex((s) => forbidden(s));
  if (bad >= 0) return { kind: 'refused', reason: 'forbidden', at: steps.slice(0, bad + 1).join('.'), text: `"${steps[bad]}" is a name a patch may never use` };
  const empty = steps.findIndex((s) => s.trim() === '');
  if (empty >= 0) return { kind: 'refused', reason: 'empty', at: steps.slice(0, empty).join('.'), text: `"${path}" has an empty step` };
  return steps;
}

/**
 * What setting a value at `path` of `data` would do: set where it is, create the missing keys, or refuse (and why).
 * With the entry's kind, pf-19a's two refusals too (a field the kind hides by name; a rules set's new section).
 */
export function planSet(data: unknown, path: string, kind?: string): SetPlan {
  const steps = stepsOf(path);
  if (!Array.isArray(steps)) return steps;
  const head = steps[0]!;
  const hidden = kind ? hiddenByKind(kind, path) : null;
  if (hidden) return hidden;
  if (kind === 'rulesSet' && isRecord(data) && !own(data, head)) {
    return { kind: 'refused', reason: 'new-section', at: head, text: `a patch can't add "${head}" to a rules set that doesn't have it: a new section may be hidden from players, so it must be in the pack that owns the entry` };
  }
  let here: unknown = data;
  for (let i = 0; i < steps.length; i++) {
    const at = steps.slice(0, i + 1).join('.');
    if (!isRecord(here)) {
      const before = steps.slice(0, i).join('.');
      return { kind: 'refused', reason: 'not-object', at: before, text: `"${before}" is ${what(here)}, not a group of fields; a patch never overwrites it` };
    }
    const step = steps[i]!;
    // From the first missing step on, everything is made as objects (a numeric step is a key there, pf-19c).
    if (!own(here, step)) return { kind: 'create', from: at };
    here = here[step];
  }
  return { kind: 'existing' };
}

/** The value at a dotted path, and whether the path is there at all: own fields of objects only, never a forbidden name. */
export function readPath(data: unknown, path: string): { found: boolean; value: unknown } {
  const steps = stepsOf(path);
  if (!Array.isArray(steps)) return { found: false, value: undefined };
  let here: unknown = data;
  for (const step of steps) {
    if (!isRecord(here) || !own(here, step)) return { found: false, value: undefined };
    here = here[step];
  }
  return { found: true, value: here };
}

/**
 * A copy of `data` with `value` set at `path` as a patch would set it (planSet first, with the entry's kind), the
 * missing keys made as objects; null when the set is refused. For pack:check, which plans a patch's sets in order.
 */
export function withSet(data: Record<string, unknown>, path: string, value: unknown, kind?: string): Record<string, unknown> | null {
  if (planSet(data, path, kind).kind === 'refused') return null;
  const put = (here: Record<string, unknown>, steps: string[]): Record<string, unknown> => {
    const [step, ...rest] = steps;
    const copy: Record<string, unknown> = { ...here };
    if (rest.length === 0) Object.defineProperty(copy, step!, { value, enumerable: true, writable: true, configurable: true });
    else {
      const inner = own(here, step!) && isRecord(here[step!]) ? (here[step!] as Record<string, unknown>) : {};
      Object.defineProperty(copy, step!, { value: put(inner, rest), enumerable: true, writable: true, configurable: true });
    }
    return copy;
  };
  return put(data, path.split('.'));
}
