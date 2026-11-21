// A campaign's settings chosen when it starts (docs/04-data-model.md, Campaign settings): how encumbrance is
// tracked, and the lengths of a round, a turn and a day. A turn is a whole number of rounds and a day a whole
// number of turns, so the counts worked out from them are whole too.
import type { Json } from './database.types.ts';

export const ENCUMBRANCE_MODES = ['none', 'armour', 'coin', 'slot'] as const;
export type EncumbranceMode = (typeof ENCUMBRANCE_MODES)[number];

export const ENCUMBRANCE_WORDS: Record<EncumbranceMode, { name: string; about: string }> = {
  none: { name: 'Not tracked', about: "Weight isn't tracked." },
  armour: { name: 'Armour', about: 'Speed follows the armour worn; only treasure is weighed.' },
  coin: { name: 'Coin weight', about: 'Everything carried is weighed in coins.' },
  slot: { name: 'Slots', about: 'Each character has a number of slots to fill.' },
};

export const isEncumbranceMode = (value: unknown): value is EncumbranceMode =>
  typeof value === 'string' && (ENCUMBRANCE_MODES as readonly string[]).includes(value);

export interface TimeLengths {
  roundSeconds: number;
  turnMinutes: number;
  dayHours: number;
}

export interface TimeSettings extends TimeLengths {
  roundsPerTurn: number;
  turnsPerDay: number;
}

export const DEFAULT_TIME: TimeLengths = { roundSeconds: 6, turnMinutes: 10, dayHours: 24 };

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : 0);

/** Reads the typed time lengths, or says plainly what's wrong with them. */
export function readTime(typed: { roundSeconds: string; turnMinutes: string; dayHours: string }): { ok: true; time: TimeSettings } | { ok: false; message: string } {
  const roundSeconds = whole(typed.roundSeconds);
  const turnMinutes = whole(typed.turnMinutes);
  const dayHours = whole(typed.dayHours);
  if (roundSeconds < 1) return { ok: false, message: 'A round needs a whole number of seconds above 0.' };
  if (turnMinutes < 1) return { ok: false, message: 'A turn needs a whole number of minutes above 0.' };
  if (dayHours < 1) return { ok: false, message: 'A day needs a whole number of hours above 0.' };
  if ((turnMinutes * 60) % roundSeconds !== 0) {
    return {
      ok: false,
      message: `A turn must be a whole number of rounds: ${turnMinutes} minutes is ${turnMinutes * 60} seconds, which ${roundSeconds}-second rounds don’t divide evenly.`,
    };
  }
  if ((dayHours * 60) % turnMinutes !== 0) {
    return {
      ok: false,
      message: `A day must be a whole number of turns: ${dayHours} hours is ${dayHours * 60} minutes, which ${turnMinutes}-minute turns don’t divide evenly.`,
    };
  }
  return {
    ok: true,
    time: { roundSeconds, turnMinutes, dayHours, roundsPerTurn: (turnMinutes * 60) / roundSeconds, turnsPerDay: (dayHours * 60) / turnMinutes },
  };
}

/** The settings a new campaign starts with. */
export function startingSettings(chosen: { encumbranceMode: EncumbranceMode; time: TimeSettings }): Json {
  return { encumbrance: { mode: chosen.encumbranceMode }, time: { ...chosen.time } };
}

/** "One-off items need approval" (ruled 2026-10-24): a player's one-off waits for the GM; on by default. */
export function oneOffApprovalOf(settings: unknown): boolean {
  return !(settings && typeof settings === 'object' && (settings as { oneOffApproval?: unknown }).oneOffApproval === false);
}

/** Whether character creation asks for HP: a sheet layout in use marks its "hp" field required (ruled 2026-10-24). */
export function hpRequiredOf(settings: unknown): boolean {
  return !!settings && typeof settings === 'object' && (settings as { hpRequired?: unknown }).hpRequired === true;
}

/** "New characters need approval" (docs/04 characterApproval): Yes by default. */
export function characterApprovalOf(settings: unknown): boolean {
  return !(settings && typeof settings === 'object' && (settings as { characterApproval?: unknown }).characterApproval === false);
}

/**
 * "New characters start at" (B21, ruled 2026-10-25): level 1, the party's lowest (worked out at creation), a fixed
 * level the GM sets, or "Player proposes, GM approves" (the default; it replaces "GM's choice", saved as "gm" before).
 */
export const START_LEVELS = ['one', 'lowest', 'fixed', 'propose'] as const;
export type StartLevel = (typeof START_LEVELS)[number];
export const START_LEVEL_WORDS: Record<StartLevel, string> = { one: 'Level 1', lowest: "Party's lowest", fixed: 'Fixed level', propose: 'Player proposes, GM approves' };

export function startLevelOf(settings: unknown): StartLevel {
  const value = settings && typeof settings === 'object' ? (settings as { startLevel?: unknown }).startLevel : undefined;
  return (START_LEVELS as readonly unknown[]).includes(value) ? (value as StartLevel) : 'propose';
}

/** The level a "Fixed level" campaign starts characters at (1 if unset). */
export function startLevelFixedOf(settings: unknown): number {
  const value = settings && typeof settings === 'object' ? (settings as { startLevelFixed?: unknown }).startLevelFixed : undefined;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : 1;
}

/** The party's lowest level: approved, active player characters only (retainers and hirelings don't count); 1 if none. */
export function partyLowest(characters: readonly { kind: string; approval: string; status: string; level: number }[]): number {
  const levels = characters.filter((c) => c.kind === 'pc' && c.approval === 'approved' && c.status === 'active').map((c) => c.level);
  return levels.length > 0 ? Math.min(...levels) : 1;
}

/**
 * The level a new character starts at, or null when the player proposes one; the database checks the same as a
 * limit (a class that stops earlier may start lower).
 */
export function startLevelLimit(start: StartLevel, lowest: number, fixed = 1): number | null {
  return start === 'one' ? 1 : start === 'lowest' ? lowest : start === 'fixed' ? fixed : null;
}

/** Whether a player's new character joins at once: approval off, and (when the player proposes) no higher than the party's lowest. */
export function joinsAtOnce(settings: unknown, level: number, lowest: number): boolean {
  return !characterApprovalOf(settings) && (startLevelOf(settings) !== 'propose' || level <= lowest);
}

/** "Charged items can be recharged" (ruled 2026-10-24): used when neither the item nor the setting rules say; No by default. */
export function rechargeDefaultOf(settings: unknown): boolean {
  return !!settings && typeof settings === 'object' && (settings as { rechargeDefault?: unknown }).rechargeDefault === true;
}

/**
 * The GM's picks for `ruleKey` groups (07, one choice per group; built 2026-11-02): which pack's rule counts for
 * each topic, by pack id. Empty when none: the pack on top decides.
 */
export function ruleGroupPicksOf(settings: unknown): Record<string, string> {
  const picks = settings && typeof settings === 'object' ? (settings as { ruleGroups?: unknown }).ruleGroups : undefined;
  if (!picks || typeof picks !== 'object' || Array.isArray(picks)) return {};
  return Object.fromEntries(Object.entries(picks as Record<string, unknown>).filter((pair): pair is [string, string] => typeof pair[1] === 'string' && pair[1] !== ''));
}

/** The settings with one group's pick changed (a pack id), or taken away (null). */
export function withRuleGroupPick(settings: Record<string, unknown>, ruleKey: string, packId: string | null): Record<string, unknown> {
  const picks = ruleGroupPicksOf(settings);
  if (packId) picks[ruleKey] = packId;
  else delete picks[ruleKey];
  return { ...settings, ruleGroups: picks };
}

/** The campaign's encumbrance mode from its saved settings ("none" if unset or unknown). */
export function encumbranceModeOf(settings: unknown): EncumbranceMode {
  const encumbrance = settings && typeof settings === 'object' ? (settings as { encumbrance?: { mode?: unknown } }).encumbrance : undefined;
  return isEncumbranceMode(encumbrance?.mode) ? encumbrance.mode : 'none';
}

/** "Players can reorder marching order" (docs/04 playersReorderMarching; M5 step 8): Yes by default. */
export function playersReorderOf(settings: unknown): boolean {
  return !(!!settings && typeof settings === 'object' && (settings as { playersReorderMarching?: unknown }).playersReorderMarching === false);
}

/** "Show each other's HP" (docs/04 playersSeeHp; M5 step 8): Yes by default. */
export function playersSeeHpOf(settings: unknown): boolean {
  return !(!!settings && typeof settings === 'object' && (settings as { playersSeeHp?: unknown }).playersSeeHp === false);
}
