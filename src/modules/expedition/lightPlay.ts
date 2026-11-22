// Lights as the campaign keeps them (M5 step 7; docs/04 "LightSource"; docs/05 "Expeditions, time and light"; ruled
// M5-8, M5-9, D29). Each character has one light row (supabase/migrations/…_m5_light.sql): the light they're using
// now, lit on the campaign clock. Light (journey 5: one tap, or a pick when there's more than one light) and Put out
// are the player's (or the GM's); the database burns lights down as the clock moves, uses up a burnt-out torch (its
// stack loses one, the line goes with the last) and, with Keep lit on, lights another from the carrier's own pack.
// "Light another" (the burnout toast's action) and Refill (a lantern: one flask, the timer starts again) are Light
// and Refill again. light.ts beside this is the engine (burning down, warnings); this file is what's stored.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import type { InventoryLine } from '../inventory/inventory.ts';
import { unitName, type TimeUnits } from './clock.ts';
import { leftIn, lightNow, readLightType, type Lit, type LightType } from './light.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const textOrNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

/** A character's light, as stored. */
export interface CharacterLight {
  id: string;
  actorId: string;
  campaignId: string;
  /** The item line it burns from (it may be gone once the light burnt out: the log keeps it). */
  lineId: string | null;
  typeId: string | null;
  name: string;
  /** On the campaign clock: when it was lit (null: not lit), and how long it burns from then (null: never runs out). */
  litAt: number | null;
  burnSeconds: number | null;
  /** The light type's whole length (Refill and Keep lit start from it), and when it warns. */
  fullSeconds: number | null;
  warnSeconds: number | null;
  /** A doused light's time left (lit again, it burns on from there). */
  leftSeconds: number | null;
  consumed: boolean;
  fuelItem: string | null;
  keepLit: boolean;
  /** When it last burnt out, on the campaign clock (null once it's lit again). */
  outAt: number | null;
  version: number;
}

export function toCharacterLight(row: Record<string, unknown>): CharacterLight {
  return {
    id: String(row.id),
    actorId: String(row.actor_id),
    campaignId: String(row.campaign_id),
    lineId: textOrNull(row.line_id),
    typeId: textOrNull(row.type_id),
    name: typeof row.name === 'string' ? row.name : '',
    litAt: numOrNull(row.lit_at),
    burnSeconds: numOrNull(row.burn_seconds),
    fullSeconds: numOrNull(row.full_seconds),
    warnSeconds: numOrNull(row.warn_seconds),
    leftSeconds: numOrNull(row.left_seconds),
    consumed: row.consumed === true,
    fuelItem: textOrNull(row.fuel_item),
    keepLit: row.keep_lit === true,
    outAt: numOrNull(row.out_at),
    version: numOrNull(row.version) ?? 1,
  };
}

/** Every light this person can see in the campaign (one per character). Null if they couldn't be loaded. */
export async function loadLights(db: Db, campaignId: string): Promise<CharacterLight[] | null> {
  const { data, error } = await db.from('character_lights').select('*').eq('campaign_id', campaignId);
  if (error) return null;
  return ((data ?? []) as Record<string, unknown>[]).map(toCharacterLight);
}

/** "Ash's torch" ("Wren of the Wardens' lantern"): a light named with its character, for the card and the log. */
export function lightOfWords(who: string, light: string): string {
  const owner = who.trim() || 'Someone';
  return `${owner.endsWith('s') ? `${owner}'` : `${owner}'s`} ${light.trim().toLowerCase() || 'light'}`;
}

/**
 * The lit lights of everyone this person can see in the campaign, each named with its character ("Ash's torch"), as
 * the engine burns them (the hour track, the reminder card, Set time…). Null if they couldn't be loaded.
 */
export async function loadPartyLights(db: Db, campaignId: string): Promise<(Lit & { name: string })[] | null> {
  const [lights, actors] = await Promise.all([loadLights(db, campaignId), db.from('actors').select('id, name').eq('campaign_id', campaignId)]);
  if (!lights || actors.error) return null;
  const names = new Map(((actors.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));
  return lights.flatMap((l) => {
    const lit = asLit(l);
    return lit ? [{ ...lit, name: lightOfWords(names.get(l.actorId) ?? '', l.name) }] : [];
  });
}

/** One character's light (null when it has none to see), or 'error' if it couldn't be loaded. */
export async function loadLight(db: Db, actorId: string): Promise<CharacterLight | null | 'error'> {
  const { data, error } = await db.from('character_lights').select('*').eq('actor_id', actorId).maybeSingle();
  if (error) return 'error';
  return data ? toCharacterLight(data as Record<string, unknown>) : null;
}

/** Where the campaign's clock is now (0 before it has moved), or null if it couldn't be read. */
export async function loadClockNow(db: Db, campaignId: string): Promise<number | null> {
  const { data, error } = await db.from('campaign_clocks').select('seconds').eq('campaign_id', campaignId).maybeSingle();
  if (error) return null;
  return numOrNull((data as { seconds?: unknown } | null)?.seconds) ?? 0;
}

// What a light is now ----------------------------------------------------------------------------------------------

export type LightState = 'lit' | 'low' | 'out' | 'unlit';

/** As the engine burns it (light.ts): a lit light, or null when it isn't lit. */
export function asLit(light: CharacterLight): (Lit & { name: string }) | null {
  if (light.litAt === null) return null;
  return { id: light.actorId, litAt: light.litAt, seconds: light.burnSeconds, warnSeconds: light.warnSeconds, name: light.name };
}

/**
 * Lit, low (its warning has started: warnAt, 07), out (it burnt out and nothing's lit since) or unlit. A light whose
 * time has run out while the clock hasn't been moved by the database yet still reads as low with nothing left.
 */
export function lightState(light: CharacterLight | null, now: number): LightState {
  if (!light) return 'unlit';
  const lit = asLit(light);
  if (lit) {
    const state = lightNow(lit, now);
    return state.warn || state.out ? 'low' : 'lit';
  }
  return light.outAt !== null ? 'out' : 'unlit';
}

/** Seconds a lit light has left (null: never runs out, or not lit). */
export function secondsLeft(light: CharacterLight, now: number): number | null {
  const lit = asLit(light);
  return lit ? lightNow(lit, now).left : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "4 turns left" in the light type's own unit (rounded up), or "burns on" for a light that never runs out. */
export function leftWords(left: number | null, unit: { name: string; seconds: number } | null): string {
  if (left === null) return 'burns on';
  if (!unit) return `${plural(Math.ceil(left / 60), 'minute')} left`;
  return `${plural(leftIn(left, unit.seconds), unit.name)} left`;
}

// The light items in a pack ---------------------------------------------------------------------------------------

/** One way to light: a light item line in the carrier's pack, with its light type worked out. */
export interface LightOption {
  line: Pick<InventoryLine, 'id' | 'name' | 'qty' | 'version' | 'needsFuel' | 'fuelLeftSeconds'>;
  type: LightType;
  /** The light type's unit ("turn") and its length, for "4 turns left". */
  unit: { name: string; seconds: number } | null;
  /** The type's radius as the pack says it ("30 ft"), if any. */
  radius: string | null;
}

/** The light type's unit, from its `unit`. */
export function unitOf(data: Record<string, unknown>, units: TimeUnits): { name: string; seconds: number } | null {
  if (typeof data.unit !== 'string') return null;
  const name = unitName(data.unit, units);
  return units[name] !== undefined ? { name, seconds: units[name] } : null;
}

/**
 * The light items a carrier can light, in pack order: approved lines with at least one left whose item names a light
 * type the setting rules have (`lightTypeId`, 07). Used up or a holder comes from the item if it says, else the
 * light type (07: `consumed: true`, or `fuel: "<item id>"`). Worked out for the carrier's level.
 */
export function lightOptions(
  lines: readonly InventoryLine[],
  lightTypes: ReadonlyMap<string, Record<string, unknown>>,
  units: TimeUnits,
  level = 1,
  stepSeconds?: number,
): LightOption[] {
  return lines.flatMap((line) => {
    const typeId = typeof line.details.lightTypeId === 'string' ? line.details.lightTypeId : null;
    const data = typeId ? lightTypes.get(typeId) : undefined;
    if (!data || line.approval !== 'approved' || line.qty < 1) return [];
    const read = readLightType({ ...data, id: typeId }, units, level, stepSeconds);
    if (!read) return [];
    const itemFuel = textOrNull(line.details.fuel) ?? textOrNull(line.details.fuelItemId);
    const type: LightType = { ...read, consumed: line.details.consumed === true || (read.consumed && !itemFuel), fuel: itemFuel ?? read.fuel };
    return [{ line: { id: line.id, name: line.name, qty: line.qty, version: line.version, needsFuel: line.needsFuel === true, fuelLeftSeconds: line.fuelLeftSeconds ?? null }, type, unit: unitOf(data, units), radius: textOrNull(data.radius) }];
  });
}

/** "Light another" after a burnout: another of the same light first, else any light the carrier has; null for none. */
export function anotherLight(options: readonly LightOption[], burnt: Pick<CharacterLight, 'typeId' | 'lineId' | 'fuelItem'>): LightOption | null {
  const others = othersThan(options, burnt);
  return others.find((o) => o.line.id === burnt.lineId) ?? others.find((o) => o.type.id === burnt.typeId) ?? others[0] ?? null;
}

/** How many fuel items (a holder's `fuel`) the carrier has left. */
export function fuelLeft(lines: readonly InventoryLine[], fuelItem: string | null): number {
  if (!fuelItem) return 0;
  return lines.filter((l) => l.sourceEntryId === fuelItem && l.approval === 'approved').reduce((sum, l) => sum + Math.max(0, l.qty), 0);
}

/** "Torch" → "torches"; "Lantern" → "lanterns": for "No torches left". */
export function pluralName(name: string): string {
  const lower = name.trim().toLowerCase();
  if (!lower) return 'lights';
  if (/(s|x|z|ch|sh)$/.test(lower)) return `${lower}es`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}

/**
 * What the burnout toast says (D29, ruled 2026-10-26 and 2026-10-29): "Torch burnt out", then its one action ("Light
 * another", or a holder's "Refill (2 left)") or, with nothing to relight from, the plain words ("No torches left",
 * "Out of oil").
 */
export function burnoutWords(
  light: Pick<CharacterLight, 'name' | 'fuelItem' | 'lineId'>,
  options: readonly LightOption[],
  fuel: { left: number; name: string | null },
): { text: string; action: 'light' | 'refill' | null; actionLabel: string | null } {
  const name = light.name || 'Light';
  const others = othersThan(options, light);
  if (light.fuelItem) {
    if (fuel.left > 0) return { text: `${name} burnt out`, action: 'refill', actionLabel: `Refill (${fuel.left} left)` };
    const out = `${name} burnt out, Out of ${(fuel.name ?? 'fuel').toLowerCase()}`;
    return others.length > 0 ? { text: out, action: 'light', actionLabel: 'Light another' } : { text: out, action: null, actionLabel: null };
  }
  if (others.length > 0) return { text: `${name} burnt out`, action: 'light', actionLabel: 'Light another' };
  return { text: `${name} burnt out, No ${pluralName(name)} left`, action: null, actionLabel: null };
}

/**
 * What can be lit after a light burnt out: everything but a holder that's out of fuel (it needs a Refill first): the
 * one that just burnt out, and any that burnt out earlier (its line remembers, whichever light is lit now).
 */
export function othersThan(options: readonly LightOption[], light: Pick<CharacterLight, 'fuelItem' | 'lineId'>): LightOption[] {
  return lightable(options).filter((o) => !light.fuelItem || o.line.id !== light.lineId);
}

/** What can be lit as it is: every light but a holder that burnt out and hasn't been refilled since. */
export function lightable(options: readonly LightOption[]): LightOption[] {
  return options.filter((o) => !o.line.needsFuel);
}

/**
 * Holders that burnt out earlier and can be refilled from the carrier's own pack now (the picker's "Refill and light"),
 * leaving out the current light (it has its own Refill).
 */
export function refillable(options: readonly LightOption[], lines: readonly InventoryLine[], current: string | null): LightOption[] {
  return options.filter((o) => o.line.needsFuel && o.line.id !== current && fuelLeft(lines, o.type.fuel) > 0);
}

/** "3 refills left", "1 refill left": the count of refills in the light's line (frame P1). */
export const refillsWords = (n: number) => `${n} ${n === 1 ? 'refill' : 'refills'} left`;

/** A light line's name as the pick and the block show it: "Torch ×4". */
export const optionName = (option: LightOption) => `${option.line.name}${option.line.qty > 1 ? ` ×${option.line.qty}` : ''}`;

/**
 * What At hand's light block shows (lt-1 to lt-5, page 35): `lit` (its ring "Put out"); `one` light to light (the ring
 * "Light"; `refillFirst` when it is a holder that burnt out earlier, so the tap refills and lights it, ⚑ 5); `several`
 * ("No light lit", the ring "Light…" opening the pick); `burnt` (the ring struck through, not a tap, with Refill and
 * Light another when each can act); `nothing` (only holders with no fuel: the still ring and the words, ⚑ 5). Null:
 * no block (no light and nothing to light). `lineId` is the pack line the block stands for (its item row is left out
 * and the light's name opens its sheet); null for several.
 */
export type LightBlock =
  | { kind: 'lit'; lineId: string | null }
  | { kind: 'one'; lineId: string; name: string; words: string; option: LightOption; refillFirst: boolean }
  | { kind: 'several'; lineId: null; name: string; words: string; lightable: LightOption[]; refills: LightOption[] }
  | { kind: 'burnt'; lineId: string | null; name: string; words: string; refill: boolean; another: boolean; lightable: LightOption[]; refills: LightOption[] }
  | { kind: 'nothing'; lineId: string | null; name: string; words: string };

export function lightBlock(
  light: CharacterLight | null,
  now: number,
  options: readonly LightOption[],
  lines: readonly InventoryLine[],
  fuel: { left: number; name: string | null },
): LightBlock | null {
  const state = lightState(light, now);
  if (light && (state === 'lit' || state === 'low')) return { kind: 'lit', lineId: light.lineId };
  // What can be lit now: after a holder burnt out, everything but it (it needs a Refill first), and never a holder
  // that burnt out earlier (its line remembers); those can be refilled and lit from the pick instead.
  const now1 = light && state === 'out' ? othersThan(options, light) : lightable(options);
  const refills = refillable(options, lines, light?.lineId ?? null);
  if (light && state === 'out') {
    const name = light.name || 'Light';
    const holderHere = !!light.fuelItem && !!light.lineId && options.some((o) => o.line.id === light.lineId);
    // The block's own words, without the name beside them (35E2): "Burnt out. 3 refills left" for a holder still in
    // the pack ("Out of oil" with no fuel); otherwise "Burnt out", and "No torches left" with nothing else to light.
    // A holder no longer in the pack promises no refills it can't take.
    const tail = holderHere ? (fuel.left > 0 ? refillsWords(fuel.left) : `Out of ${(fuel.name ?? 'fuel').toLowerCase()}`) : now1.length > 0 ? null : `No ${pluralName(name)} left`;
    return { kind: 'burnt', lineId: light.lineId, name, words: tail ? `Burnt out. ${tail}` : 'Burnt out', refill: holderHere && fuel.left > 0, another: now1.length + refills.length > 0, lightable: now1, refills };
  }
  if (options.length === 0) return null;
  const choices = [...now1, ...refills];
  if (choices.length === 0) {
    // Only holders that burnt out, and no fuel for them: said plainly (never a button that does nothing).
    const only = options.length === 1 ? options[0]! : null;
    return { kind: 'nothing', lineId: only?.line.id ?? null, name: only ? optionName(only) : 'No light lit', words: `Nothing to light: ${options.map((o) => o.line.name).join(', ')} ${options.length === 1 ? 'needs' : 'need'} fuel, and there's none in the pack.` };
  }
  if (choices.length > 1) {
    // What there is to light (35E2): "Torch ×4; Storm lantern, 4 turns left".
    const listed = (now1.length > 0 ? now1 : refills).map((o) => {
      const kept = keptSeconds(light, o);
      return kept !== null && o.unit ? `${optionName(o)}, ${leftWords(kept, o.unit)}` : optionName(o);
    });
    return { kind: 'several', lineId: null, name: 'No light lit', words: listed.join('; '), lightable: now1, refills };
  }
  const option = choices[0]!;
  const refillFirst = !now1.includes(option);
  const fuelFor = fuelLeft(lines, option.type.fuel);
  const kept = keptSeconds(light, option);
  const unit = option.unit;
  const time = refillFirst
    ? `Refill and light (${fuelFor} left)`
    : kept !== null && unit
      ? leftWords(kept, unit)
      : option.type.seconds === null
        ? 'Burns on'
        : unit
          ? leftWords(option.type.seconds, unit).replace(/ left$/, option.line.qty > 1 ? ' each' : '')
          : '';
  // A holder's refills in its line, as it is lit (35B: "Not lit. 4 turns left. 3 refills left").
  const refillCount = !refillFirst && option.type.fuel && fuelFor > 0 ? refillsWords(fuelFor) : '';
  return { kind: 'one', lineId: option.line.id, name: optionName(option), words: ['Not lit', time, refillCount].filter(Boolean).join('. '), option, refillFirst };
}

/** The time a light line keeps (a light put out keeps its time, 05 A2; a holder swapped out keeps its fuel), or null. */
function keptSeconds(light: CharacterLight | null, option: LightOption): number | null {
  if (light && light.litAt === null && light.lineId === option.line.id && light.leftSeconds !== null) return light.leftSeconds;
  return option.line.fuelLeftSeconds ?? null;
}

// Commands ---------------------------------------------------------------------------------------------------------

type Target = { id: string; campaignId: string; ownerUserId: string | null };

/** 03 "Light / douse a light source": the GM, or the player for their own carrier. */
export const mayLight = (user: CurrentUser, character: Target) =>
  isGm(user, character.campaignId) || (isMember(user, character.campaignId) && character.ownerUserId === user.id);

async function lightRow(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<CharacterLight>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) && typeof row.id === 'string' ? ok(toCharacterLight(row)) : fromError({ code: '42501', message: '' });
}

/** The version the person's copy showed (nothing when it doesn't depend on the copy: an Undo toast's reversal). */
const seenOf = (light: { version: number } | null | undefined) => light?.version;

/**
 * Light (journey 5) and "Light another": the character's light is now this line, lit at the clock's time. Logged in
 * the detailed log; Undo puts out what it lit and brings back what was there.
 */
export const lightLight = defineCommand({
  name: 'light.light',
  log: 'verbose',
  target: (input: { character: Target; light: CharacterLight | null; option: LightOption }) => input.character,
  allowed: mayLight,
  run: (db, _user, input) =>
    lightRow(
      db.rpc('light_light', {
        actor: input.character.id,
        line: input.option.line.id,
        light_type: input.option.type.id,
        light_name: input.option.type.name || input.option.line.name,
        burn_seconds: input.option.type.seconds,
        warn_seconds: input.option.type.warnSeconds,
        consumed: input.option.type.consumed,
        fuel_item: input.option.type.fuel,
        seen_version: seenOf(input.light),
      }),
    ),
});

/** Put out: the light stops burning and keeps its time left (lit again, it burns on from there). */
export const douseLight = defineCommand({
  name: 'light.douse',
  log: 'verbose',
  target: (input: { character: Target; light: CharacterLight | null }) => input.character,
  allowed: mayLight,
  run: (db, _user, input) => lightRow(db.rpc('douse_light', { actor: input.character.id, seen_version: seenOf(input.light) })),
});

/** Keep lit (per light, off by default): at burnout it's lit again from the carrier's own pack, and logged. */
export const keepLightLit = defineCommand({
  name: 'light.keepLit',
  log: 'verbose',
  target: (input: { character: Target; light: CharacterLight | null; keep: boolean }) => input.character,
  allowed: mayLight,
  run: (db, _user, input) => lightRow(db.rpc('keep_light_lit', { actor: input.character.id, keep: input.keep, seen_version: seenOf(input.light) })),
});

/**
 * Refill (a holder: a lantern): one fuel item from the carrier's own pack, and the timer starts again. With `option`, a
 * holder that isn't the current light (it burnt out earlier) is refilled and lit ("Refill and light"). Undo brings it
 * back.
 */
export const refillLight = defineCommand({
  name: 'light.refill',
  log: 'simple',
  target: (input: { character: Target; light: CharacterLight | null; option?: LightOption }) => input.character,
  allowed: mayLight,
  run: (db, _user, input) =>
    lightRow(
      input.option && input.option.line.id !== input.light?.lineId
        ? db.rpc('refill_and_light', {
            actor: input.character.id,
            line: input.option.line.id,
            light_type: input.option.type.id,
            light_name: input.option.type.name || input.option.line.name,
            burn_seconds: input.option.type.seconds ?? 0,
            warn_seconds: input.option.type.warnSeconds,
            fuel_item: input.option.type.fuel ?? '',
            seen_version: seenOf(input.light),
          })
        : db.rpc('refill_light', { actor: input.character.id, seen_version: seenOf(input.light) }),
    ),
});

export const LIGHT_COMMANDS = [lightLight, douseLight, keepLightLit, refillLight] as const;
