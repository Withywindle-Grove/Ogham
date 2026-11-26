// What a character has prepared and which limited uses are spent (Player screen redesign, ruled 2026-10-26): the
// Spells section lists the prepared spells by level, the Abilities section shows each limited-use power's uses as
// dots. Stored per character in `character_play`; the owner or the GM changes it, for an approved character.
// Also the AC set by hand (Set AC, ruled 2026-10-29): kept per character, so it works without a campaign AC field.
import { defineCommand, failed, fromWrite, isGm, isMember, notAllowed, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import type { Filled } from '../library/fills.ts';
import { workOut } from '../library/formula.ts';
import { traitNoteWords } from '../library/ruleText.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** One slot used: the pack's spell id at a spell level. A spell prepared twice is listed twice. */
export interface PreparedSpell {
  spell: string;
  level: number;
}

/**
 * What a player can pin beside items (pin-2; widened by euf-2, 2026-11-19): a spell of their own character (At hand), or
 * any ability or trait of it, with uses or without (the Player tab's right column's list). Kind `trait` covers both an
 * ability and a trait: either is keyed by its name, as its spent uses are.
 */
export type PinKind = 'spell' | 'trait';
export interface Pin {
  kind: PinKind;
  /** The pack spell id (kind spell) or the ability's or trait's name (kind trait). */
  key: string;
}

export interface CharacterPlay {
  /**
   * What is pinned (pin-2, euf-2), in the player's own order (euf-4: pinned last unless moved); read with `livePins` so a
   * pin whose thing is gone is ignored.
   */
  pins: Pin[];
  prepared: PreparedSpell[];
  /** Uses spent since the last refill, by the ability's name. */
  usesSpent: Record<string, number>;
  /** The AC set by hand (Set AC); null when the worked-out AC shows. */
  acOverride: number | null;
  /** The class form the character is in (07 `classes[].forms`, eq-8); null when never switched (the first form). */
  formId: string | null;
  /**
   * What is chosen for the next rest (mp-2; dec-8 piece A), shaped like `prepared`, which is what is ready today.
   * Null: nothing new chosen, so the next rest brings back today's ready spells (mm-5).
   */
  chosen: PreparedSpell[] | null;
  /** Castings spent today by `castKey(level, spell)`; may run over a ready list that has since shrunk (read with `readySpells`). */
  spellsCast: Record<string, number>;
  /**
   * Whether the character has had its first rest, or the GM has set its spells by hand (fsr-4, fsr-5; `rested_once`).
   * False with no row yet: until then, and while nothing is cast, a choice is ready at once (`firstSpellsOpen`).
   */
  restedOnce: boolean;
}

const EMPTY: CharacterPlay = { pins: [], prepared: [], usesSpent: {}, acOverride: null, formId: null, chosen: null, spellsCast: {}, restedOnce: false };

/** The most an AC set by hand may be, either way (the database checks the same). */
export const AC_LIMIT = 999;

/** The longest form id and name the database keeps (the migration checks the same). */
export const FORM_ID_LIMIT = 80;
export const FORM_NAME_LIMIT = 120;

/** A stored spell list read safely: entries without a spell id or a whole-number level are left out. */
export function readSpellList(value: unknown): PreparedSpell[] {
  return Array.isArray(value)
    ? value.flatMap((p) => (isRecord(p) && typeof p.spell === 'string' && Number.isInteger(p.level) ? [{ spell: p.spell, level: p.level as number }] : []))
    : [];
}

/** The most pins a character holds, and the longest key (the database checks the same). */
export const PIN_LIMIT = 24;
export const PIN_KEY_LIMIT = 80;

/** Why a pin past the limit is refused (pg28-5, ⚑ 29; page 28, frame M4i): the blocked-action pop-up's line. */
export const PIN_LIMIT_WORDS = `A character can have ${PIN_LIMIT} pins. Unpin one to make room.`;

/** A stored pin list read safely: entries with an unknown kind or an empty key are left out, and a pin listed twice once. */
export function readPins(value: unknown): Pin[] {
  const seen = new Set<string>();
  return Array.isArray(value)
    ? value.flatMap((p) => {
        if (!isRecord(p) || (p.kind !== 'spell' && p.kind !== 'trait') || typeof p.key !== 'string' || !p.key.trim()) return [];
        const id = `${p.kind}:${p.key}`;
        if (seen.has(id)) return [];
        seen.add(id);
        return [{ kind: p.kind, key: p.key }];
      })
    : [];
}

/**
 * The pins whose thing the character still has (a spell still in the book or ready, a trait still on the sheet): the
 * rest stay stored and are ignored, never an error. Every reader of pins goes through this.
 */
export function livePins(pins: readonly Pin[], has: { spell: (key: string) => boolean; trait: (key: string) => boolean }): Pin[] {
  return pins.filter((p) => (p.kind === 'spell' ? has.spell(p.key) : has.trait(p.key)));
}

/** A stored count map read safely: only whole numbers above 0 are kept. */
function readCounts(value: unknown): Record<string, number> {
  return isRecord(value) ? Object.fromEntries(Object.entries(value).flatMap(([k, v]) => (Number.isInteger(v) && (v as number) > 0 ? [[k, v as number]] : []))) : {};
}

export function readPlay(
  row: { pins?: unknown; prepared?: unknown; uses_spent?: unknown; ac_override?: unknown; form_id?: unknown; chosen?: unknown; spells_cast?: unknown; rested_once?: unknown } | null | undefined,
): CharacterPlay {
  if (!row) return EMPTY;
  const prepared = readSpellList(row.prepared);
  const usesSpent = readCounts(row.uses_spent);
  const acOverride = Number.isInteger(row.ac_override) ? (row.ac_override as number) : null;
  const formId = typeof row.form_id === 'string' && row.form_id.trim() ? row.form_id : null;
  const chosen = Array.isArray(row.chosen) ? readSpellList(row.chosen) : null;
  // A row always has the column; one read without it (a select that left it out) counts as rested, as every row made
  // before the column did (fsr-13), so only a row that says so, or no row at all, reads as open.
  const restedOnce = row.rested_once !== false;
  return { pins: readPins(row.pins), prepared, usesSpent, acOverride, formId, chosen, spellsCast: readCounts(row.spells_cast), restedOnce };
}

/** Null if it couldn't be loaded; nothing prepared or spent yet reads as empty. */
export async function loadCharacterPlay(db: Db, characterId: string): Promise<CharacterPlay | null> {
  const found = await db.from('character_play').select('pins, prepared, uses_spent, ac_override, form_id, chosen, spells_cast, rested_once').eq('actor_id', characterId).maybeSingle();
  return found.error ? null : readPlay(found.data);
}

/** Spell slots per spell level at this level, from the class progression (`spellSlots`: [2, 1] = 2 at 1st, 1 at 2nd). */
export function slotsOf(filled: Filled): number[] {
  const slots = filled.spellSlots;
  return Array.isArray(slots) ? slots.map((n) => (typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0)) : [];
}

/** The class's spell list, by spell level: { 1: ["glimmer", …] }. */
export function spellListOf(klass: Record<string, unknown> | null, lists: readonly { packEntryId: string; data: Record<string, unknown> }[]): Map<number, string[]> {
  const spellcasting = klass && isRecord(klass.spellcasting) ? klass.spellcasting : null;
  const list = spellcasting ? lists.find((l) => l.packEntryId === spellcasting.listId) : undefined;
  const levels = list && Array.isArray(list.data.levels) ? list.data.levels.filter(isRecord) : [];
  return new Map(levels.flatMap((l) => (typeof l.level === 'number' && Array.isArray(l.spells) ? [[l.level, l.spells.map(String)] as const] : [])));
}

/** Why a set of prepared spells doesn't fit the slots, or null when it does. */
export function preparedProblem(prepared: PreparedSpell[], slots: number[]): string | null {
  for (const [i, room] of slots.entries()) {
    const used = prepared.filter((p) => p.level === i + 1).length;
    if (used > room) return `Level ${i + 1} has ${room === 1 ? '1 slot' : `${room} slots`}; take ${used - room === 1 ? 'one' : used - room} off first.`;
  }
  const beyond = prepared.find((p) => p.level < 1 || p.level > slots.length);
  return beyond ? `There are no level ${beyond.level} slots yet.` : null;
}

/** A limited-use power: from the class or the race (pack `abilities[].uses`, proposed), with its uses at this level. */
export interface LimitedAbility {
  name: string;
  uses: number;
  /** When the dots come back, in the pack's words ("rest", "day", "adventure"). */
  refill: string;
  note: string;
  /** 'trait': a trait-list entry's power (07 entries[].abilities, G-213), picked or rolled. */
  from: 'class' | 'race' | 'trait';
}

function limited(entries: unknown, level: number, from: 'class' | 'race'): LimitedAbility[] {
  return (Array.isArray(entries) ? entries.filter(isRecord) : []).flatMap((a) => {
    const name = text(a.name);
    if (!name || (typeof a.fromLevel === 'number' && a.fromLevel > level)) return [];
    const usesField = a.uses;
    const byLevel = isRecord(usesField) && Array.isArray(usesField.byLevel) ? usesField.byLevel.filter(isRecord) : [];
    const row = byLevel.filter((r) => typeof r.level === 'number' && r.level <= level).sort((x, y) => (y.level as number) - (x.level as number))[0];
    const uses = typeof usesField === 'number' ? usesField : isRecord(usesField) && typeof usesField.count === 'number' ? usesField.count : typeof row?.count === 'number' ? row.count : 0;
    if (!Number.isInteger(uses) || uses < 1) return [];
    const refill = isRecord(usesField) ? text(usesField.per) || text(usesField.refill) : text(a.refill);
    // A note in pf-18's blocks reads as its words on the trait's row and pop-up (tfb-5).
    return [{ name, uses, refill, note: traitNoteWords(a.note) || text(a.notes), from }];
  });
}

/**
 * Each thing once (dec-13 C8, pin-2; euf-2 to euf-4): the abilities and traits pinned, in the pins' own order (the
 * player's), and the rest in their own order. Any ability or trait, with uses or without: an ability's or a trait's pin
 * key is its name (as its spent uses are kept); a pin whose thing is gone is ignored (`livePins`).
 */
export function pinnedTraits<T extends { name: string }>(all: readonly T[], pins: readonly Pin[]): { pinned: T[]; rest: T[] } {
  const live = livePins(pins, { spell: () => false, trait: (key) => all.some((a) => a.name === key) });
  // Every one of that name goes (a class's and a kindred's alike), so none is lost from both places.
  const pinned = live.flatMap((p) => all.filter((a) => a.name === p.key));
  const keys = new Set(live.map((p) => p.key));
  return { pinned, rest: all.filter((a) => !keys.has(a.name)) };
}

/**
 * The names of the abilities and traits pinned, in the player's order (euf-4), among `names` (every ability and trait
 * the character has): a pin whose thing is gone, and a spell's, are left out. The order Move up and Move down step
 * through, and the one hold to move rearranges. Pure.
 */
export function pinnedNames(pins: readonly Pin[], names: readonly string[]): string[] {
  const has = new Set(names);
  return livePins(pins, { spell: () => false, trait: (key) => has.has(key) }).map((p) => p.key);
}

/** The character's limited-use powers: the class's, then the race's. */
export function limitedAbilities(klass: Record<string, unknown> | null, race: Record<string, unknown> | null, level: number): LimitedAbility[] {
  return [...limited(klass?.abilities, level, 'class'), ...limited(race?.abilities, level, 'race')];
}

/**
 * The picked trait-list entries' powers with uses (07 entries[].abilities, G-213; retest 4 T9), as the Traits rows read
 * them. Pure.
 */
export function powersWithUses(picked: readonly { name: string; note: string; uses?: { count: number; per: string } }[]): LimitedAbility[] {
  return picked.flatMap((p) => (p.uses ? [{ name: p.name, uses: p.uses.count, refill: p.uses.per, note: p.note, from: 'trait' as const }] : []));
}

/**
 * Every trait with uses, each a row with Use in the Player screen's Traits section (or At hand, pinned): the class's
 * and the race's, then the picked entries' powers (`more`). The one list the Traits rows are drawn from, and the one the
 * full sheet's foot reads to leave them out (`shownAbove`). Pure.
 */
export function traitsWithUsesOf(klass: Record<string, unknown> | null, race: Record<string, unknown> | null, level: number, more: readonly LimitedAbility[] = []): LimitedAbility[] {
  return [...limitedAbilities(klass, race, level), ...more];
}

/**
 * The foot's rows the Player screen leaves out (dec-13 C12; Francis's fix 9 of 19 Nov 2026), by key: a row with uses
 * whose name has its own row above (`above`, from `traitsWithUsesOf`). Only those, so the rows left out are always a
 * subset of the Traits rows with uses: a trait with uses never vanishes from both. Pure.
 */
export function shownAbove(rows: readonly { key: string; name: string; uses: number }[], above: readonly LimitedAbility[]): Set<string> {
  const names = new Set(above.map((a) => a.name));
  return new Set(rows.filter((r) => r.uses > 0 && names.has(r.name)).map((r) => r.key));
}

type Target = { id: string; campaignId: string; ownerUserId: string | null };
const mayChange = (user: { id: string } & Parameters<typeof isGm>[0], character: Target) =>
  isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id);

/** Prepare spells in the slots (the simple log). */
export const prepareSpells = defineCommand({
  name: 'character.prepare',
  log: 'simple',
  target: (input: { character: Target; prepared: PreparedSpell[]; slots: number[] }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<PreparedSpell[]>> => {
    const problem = preparedProblem(input.prepared, input.slots);
    if (problem) return failed(problem);
    const saved = fromWrite(
      await db
        .from('character_play')
        .upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, prepared: input.prepared as unknown as Json })
        .select('actor_id'),
    );
    return saved.ok ? ok(input.prepared) : saved;
  },
});

/**
 * Mark a limited use spent, or give one back (the detailed log, like each HP tick). The database changes only this
 * ability's count (use_ability), so two taps at once on different devices don't overwrite each other.
 */
export const useAbility = defineCommand({
  name: 'character.useAbility',
  log: 'verbose',
  target: (input: { character: Target; ability: string; spent: number; of: number }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<Record<string, number>>> => {
    if (!Number.isInteger(input.spent) || input.spent < 0 || input.spent > input.of) return failed(`${input.ability} has ${input.of === 1 ? '1 use' : `${input.of} uses`}.`);
    const { data, error } = await db.rpc('use_ability', { actor: input.character.id, ability: input.ability, spent: input.spent });
    if (error) return error.code === '42501' ? notAllowed() : failed(error.message);
    return ok(readPlay({ uses_spent: data }).usesSpent);
  },
});

/**
 * Set the character's AC by hand, or clear it (null) so the worked-out AC shows again (Set AC, ruled 2026-10-29;
 * the simple log). Undo is this command again with the AC before.
 */
export const setAc = defineCommand({
  name: 'character.setAc',
  log: 'simple',
  target: (input: { character: Target; ac: number | null }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<number | null>> => {
    if (input.ac !== null && !(Number.isInteger(input.ac) && Math.abs(input.ac) <= AC_LIMIT)) return failed(`Type a whole number from -${AC_LIMIT} to ${AC_LIMIT}, like 7 or -2.`);
    const saved = fromWrite(
      await db.from('character_play').upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, ac_override: input.ac }).select('actor_id'),
    );
    return saved.ok ? ok(input.ac) : saved;
  },
});

/**
 * Switch the character's class form (07 `classes[].forms`; eq-8, ruled 2026-11-04; the simple log): the form is kept
 * with the character's play state, and the gear the new form can't use (`takeOff`, worked out by the caller with the
 * equip check) comes off in the same change, carried, so one log line and one Undo cover both. Undo from the toast is
 * this command again with the form before. `form` null clears the switch (the first form again).
 */
export const setForm = defineCommand({
  name: 'character.setForm',
  log: 'simple',
  target: (input: { character: Target; form: { id: string; name: string } | null; takeOff?: { id: string; version?: number }[]; putOn?: { id: string; version?: number }[] }) => input.character,
  allowed: (user, character) => mayChange(user, character),
  run: async (db, _user, input): Promise<CommandResult<string | null>> => {
    const form = input.form;
    if (form && (!form.id.trim() || form.id.length > FORM_ID_LIMIT || form.name.length > FORM_NAME_LIMIT)) return failed("That form's id or name is too long.");
    const saved = fromWrite(
      await db
        .from('character_play')
        .upsert({ actor_id: input.character.id, campaign_id: input.character.campaignId, form_id: form?.id ?? null, form_name: form?.name ?? null })
        .select('actor_id'),
    );
    if (!saved.ok) return saved;
    // The gear the form can't use comes off; the toast's Undo switches back and puts it on again (putOn).
    for (const [lines, equipped] of [[input.takeOff ?? [], false] as const, [input.putOn ?? [], true] as const]) {
      for (const line of lines) {
        let query = db.from('inventory_lines').update({ equipped, container_line_id: null }).eq('id', line.id).eq('actor_id', input.character.id);
        if (line.version !== undefined) query = query.eq('version', line.version);
        const changed = fromWrite(await query.select('id'));
        if (!changed.ok) return changed;
      }
    }
    return ok(form?.id ?? null);
  },
});

const plural = (n: string, unit: string) => (n === '1' ? unit : unit.endsWith('s') ? unit : `${unit}s`);

/** A spell's one line on the Player screen: "name · duration · range", the duration worked out for this level. */
export function spellLine(name: string, data: Record<string, unknown>, level: number): string {
  return [name, ...spellParts(data, level)].join(', ');
}

/** The spell's worked-out duration and its range, each only when the pack gives it. */
function spellParts(data: Record<string, unknown>, level: number): string[] {
  const d = data.duration;
  let duration = typeof d === 'string' ? d.trim() : '';
  if (isRecord(d)) {
    const unit = text(d.unit);
    const formula = typeof d.formula === 'number' ? String(d.formula) : text(d.formula);
    const worked = formula ? workOut(formula, level) : null;
    const amount = worked?.text ?? formula;
    duration = amount ? (unit ? `${amount} ${plural(amount, unit)}` : amount) : text(d.text);
  }
  const range = typeof data.range === 'string' ? data.range.trim() : typeof data.range === 'number' ? String(data.range) : '';
  return [duration, range].filter(Boolean);
}

/** The prepared spells by level, highest first (the highest level shows open; ruled 2026-10-26). */
export function preparedByLevel(prepared: PreparedSpell[]): { level: number; spells: string[] }[] {
  const levels = [...new Set(prepared.map((p) => p.level))].sort((a, b) => b - a);
  return levels.map((level) => ({ level, spells: prepared.filter((p) => p.level === level).map((p) => p.spell) }));
}
