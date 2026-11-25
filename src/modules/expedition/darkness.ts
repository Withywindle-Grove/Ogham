// Darkness (docs/05 "Expeditions, time and light"; ruled 2026-10-30, DG7 and S2-7; the screen dim was removed at the
// M5 gate, R3 audit 8): when a player's group has no light, their screen shows the reminder "No light · Light a torch
// (N left)". Turn-by-turn modes are dark without a light; a day-by-day mode only while the GM's **Travelling in
// darkness** is on. Pure: the Player screen reads the lights and groups.
import type { LightOption } from './lightPlay.ts';

export interface DarknessFacts {
  /** An expedition is under way. */
  underWay: boolean;
  /** The current mode's pace (null without an expedition). */
  pace: 'turn' | 'day' | null;
  /** The GM's Travelling in darkness switch (S2-7), for day-by-day modes. */
  travellingInDarkness: boolean;
  /** Everyone in the player's group (characters and hirelings), by id. */
  group: readonly string[];
  /** Whose light is lit now, by character id. */
  litBy: readonly string[];
}

/** A dark mode: turn by turn (a dungeon), or day by day while the GM's Travelling in darkness is on. There the sun's
 *  line ("N hours of light left") is hidden and Light is the only light fact (Francis, ⚑ 1 on #958, "yes, b", 2026-11-18). */
export function darkMode(pace: 'turn' | 'day' | null, travellingInDarkness: boolean): boolean {
  return pace === 'turn' || (pace === 'day' && travellingInDarkness);
}

/** Whether the player's group is in the dark now: under way, in a dark mode, and nobody in the group has a light lit. */
export function inDarkness(facts: DarknessFacts): boolean {
  if (!facts.underWay || facts.group.length === 0) return false;
  return darkMode(facts.pace, facts.travellingInDarkness) && !facts.group.some((id) => facts.litBy.includes(id));
}

/** "a torch", "an oil flask": the light's name with its article, lower case, for "Light a torch". */
function withArticle(name: string): string {
  const word = name.trim().toLowerCase() || 'light';
  return `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
}

/** The toast once a light is lit (the voice guide, 06): "Lit a rushlight.", "Lit an oil lamp."; the item keeps its name. */
export function litWords(name: string): string {
  return `Lit ${withArticle(name)}.`;
}

/**
 * The reminder's button for the first light the character can light (its name and how many are left: "Light a torch
 * (4 left)"), or null when there's nothing to light.
 */
export function lightButtonWords(option: Pick<LightOption, 'line' | 'type'> | null): string | null {
  if (!option) return null;
  return `Light ${withArticle(option.type.name || option.line.name)} (${option.line.qty} left)`;
}
