// Other… typed at creation, on the GM's review (M5b step 0c, follow-up C; ruled 2026-11-02, cf-6,
// design/rulings/m5b-0c-creation-followups-2026-11-02.md; docs/03 Add to homebrew; docs/06 The GM's review). Pure:
// which of a character's languages and trait-list values were typed rather than picked (a language the setting's
// list doesn't have and no race or class gives; a trait field whose value matches no entry of its list), and the
// homebrew entry that makes each a pick for the next player (a typed weapon skill joins them, PR G of the second test,
// ruled 2026-11-02: a homebrew item with a `weapon` block, so the weapons step offers it): a "Campaign languages" rules set that sits on top with
// the setting's languages block plus the new one (per-key readers take the top set that has `languages`; a copy of
// the whole rules set would lose the campaign's option choices, which live on the original pack's link), or a homebrew
// version of the trait list (same kind and id, so it wins) with the entry appended.
import { languagesRule } from './creationRules.ts';
import type { FieldDefinition } from './fields.ts';
import { picksFromSaved, type LanguagesPlan } from './languagesStep.ts';
import { traitPickOf, type TraitList, type TraitStep } from './traitLists.ts';
import { isWeapon, weaponSkillsOf } from './weaponSkills.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export type TypedEntry =
  | { kind: 'language'; name: string }
  | { kind: 'weapon'; name: string }
  | { kind: 'trait'; name: string; note: string; listId: string; listName: string };

/** The id of the homebrew rules set that carries the campaign's added languages. */
export const CAMPAIGN_LANGUAGES_ID = 'campaign-languages';
export const CAMPAIGN_LANGUAGES_NAME = 'Campaign languages';

/** An id from a typed name: lowercase letters, digits and dashes (the pack format's ids); "other" when nothing is left. */
export function slugOf(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'other';
}

/**
 * What the player typed with Other…: the languages the field holds that the plan neither gives nor offers, and each
 * trait step whose field holds a value that isn't one of its list's entries ("Name — note").
 */
export function typedEntries(input: { fields: unknown; languagesField: FieldDefinition | null; languagePlan: LanguagesPlan | null; traitSteps: readonly TraitStep[]; weaponSkills?: unknown }): TypedEntry[] {
  const values = isRecord(input.fields) ? input.fields : {};
  const out: TypedEntry[] = [];
  if (input.languagesField && input.languagePlan) {
    for (const name of picksFromSaved(input.languagePlan, values[input.languagesField.key]).others) out.push({ kind: 'language', name });
  }
  for (const step of input.traitSteps) {
    const pick = traitPickOf(step, values[step.field.key]);
    if (pick && 'other' in pick) out.push({ kind: 'trait', name: pick.other, note: pick.note, listId: step.list.id, listName: step.list.name });
  }
  // A weapon skill typed with Other… (ct-8) keeps the typed name as its `itemId`, marked `other`.
  for (const skill of weaponSkillsOf(input.weaponSkills)) if (skill.other) out.push({ kind: 'weapon', name: skill.itemId });
  return out;
}

/** Whether the setting already offers the language (by id or name): nothing to add. */
export function languageKnown(rulesSets: readonly Record<string, unknown>[], name: string): boolean {
  const rule = languagesRule(rulesSets);
  return !!rule && rule.list.some((l) => same(l.id, name) || same(l.name, name));
}

/**
 * The homebrew "Campaign languages" rules set with the language added: the top rules set's `languages` block (the
 * campaign's own when it already has one) with the new language in its list. Null when the setting has no languages.
 */
export function withLanguage(rulesSets: readonly Record<string, unknown>[], name: string): Record<string, unknown> | null {
  const top = [...rulesSets].reverse().find((r) => isRecord(r.languages));
  if (!top) return null;
  const block = top.languages as Record<string, unknown>;
  const list = (Array.isArray(block.list) ? block.list : []).filter(isRecord);
  const id = slugOf(name);
  const taken = new Set(list.map((l) => String(l.id ?? '')));
  let unique = id;
  for (let n = 2; taken.has(unique); n++) unique = `${id}-${n}`;
  return { id: CAMPAIGN_LANGUAGES_ID, name: CAMPAIGN_LANGUAGES_NAME, languages: { ...block, list: [...list, { id: unique, name: name.trim() }] } };
}

/** The trait list's data with the typed entry appended (a homebrew version of the list, same id). */
export function withTraitEntry(list: TraitList, raw: Record<string, unknown>, name: string, note: string): Record<string, unknown> {
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).filter(isRecord);
  const id = slugOf(name);
  const taken = new Set(list.entries.map((e) => e.id));
  let unique = id;
  for (let n = 2; taken.has(unique); n++) unique = `${id}-${n}`;
  const entry: Record<string, unknown> = { id: unique, name: name.trim(), ...(note.trim() ? { notes: note.trim() } : {}) };
  return { ...raw, id: list.id, name: raw.name ?? list.name, entries: [...entries, entry] };
}

/** Whether a trait list already has the entry (by name): nothing to add. */
export const traitKnown = (list: TraitList, name: string): boolean => list.entries.some((e) => same(e.name, name));

interface ItemLike {
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

/** Whether the setting already has a weapon by that id or name: nothing to add. */
export const weaponKnown = (items: readonly ItemLike[], name: string): boolean => items.some((i) => isWeapon(i) && (same(i.packEntryId, name) || same(i.name, name)));

/**
 * The homebrew item for a typed weapon: a unique id (among all the setting's items), the name as typed and an empty
 * `weapon` block (07: what makes an item a weapon; the GM fills in its damage in the homebrew editor). When every
 * weapon in the setting shares one category, the new one takes it too, so the weapons step lists it with them.
 */
export function withWeapon(items: readonly ItemLike[], name: string): Record<string, unknown> {
  const id = slugOf(name);
  const taken = new Set(items.map((i) => i.packEntryId));
  let unique = id;
  for (let n = 2; taken.has(unique); n++) unique = `${id}-${n}`;
  const categories = new Set(items.filter((i) => isWeapon(i)).map((i) => (typeof i.data.category === 'string' ? i.data.category : '')));
  const category = categories.size === 1 ? [...categories][0]! : '';
  return { id: unique, name: name.trim(), ...(category ? { category } : {}), weapon: {} };
}
