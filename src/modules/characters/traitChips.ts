// The Traits section as chips (tc-1 … tc-4, ruled 2026-11-04, amending sr-3): every kindred and class trait as a chip,
// grouped by where it comes from (the kindred or race, the class, the options), with what sr-3 carried inside the chip
// in words: its uses as dots, ", drawback", and ", lv N" for a trait the character hasn't reached yet. Pure.
import type { Trait } from './bonuses.ts';
import { limitedAbilities } from './playState.ts';

/** One trait as its chip shows it. */
export interface TraitChip {
  key: string;
  name: string;
  /** Its uses at this level, one dot each (0: no dots). */
  uses: number;
  /** How many of them are spent (the Player screen's use dots, kept in the play state), at most `uses`: a ring each. */
  spent: number;
  /** The uses in words, for the screen reader and the chip's name: "1 use a day". Empty without uses. */
  usesWords: string;
  drawback: boolean;
  /** The level it starts at, when the character hasn't reached it yet; null otherwise. */
  laterLevel: number | null;
  trait: Trait;
}

export interface TraitGroup {
  id: 'kindred' | 'class' | 'options';
  /** The small heading: "Kindred: Bog folk", "Class: Lantern Warden", "From options" (no middle dot, plan D). */
  title: string;
  chips: TraitChip[];
}

const PER: Record<string, string> = { day: 'a day', week: 'a week', rest: 'each rest', fight: 'each fight' };

/** "1 use a day", "3 uses each rest", "2 uses" (when the pack doesn't say when they come back). */
export function usesWords(uses: number, per: string): string {
  if (uses < 1) return '';
  const when = PER[per] ?? (per ? `each ${per}` : '');
  return `${uses === 1 ? '1 use' : `${uses} uses`}${when ? ` ${when}` : ''}`;
}

/**
 * The chip's name for a screen reader: "Steady flame, 1 use a day, a drawback, from level 3"; with a use spent, what's
 * left as the use dots say it ("Ward the light, 3 uses each rest, 1 of 3 left").
 */
export function chipLabel(chip: TraitChip): string {
  const left = chip.spent > 0 ? `${chip.uses - chip.spent} of ${chip.uses} left` : '';
  return [chip.name, chip.usesWords, left, chip.drawback ? 'a drawback' : '', chip.laterLevel !== null ? `from level ${chip.laterLevel}` : ''].filter(Boolean).join(', ');
}

/**
 * The traits by source (tc-1): the kindred's (or race's), then the class's, then those from options, each group
 * only when it has one, in the pack's order. `raceTitle` and `classTitle` are the setting's words for the steps.
 */
export function traitGroups(
  traits: readonly Trait[],
  ctx: {
    level: number;
    race: Record<string, unknown> | null;
    klass: Record<string, unknown> | null;
    raceTitle: string;
    classTitle: string;
    /** The uses spent by ability name (the play state's `usesSpent`); none when left out. */
    usesSpent?: Readonly<Record<string, number>>;
  },
): TraitGroup[] {
  const limited = limitedAbilities(ctx.klass, ctx.race, ctx.level);
  const chip = (t: Trait): TraitChip => {
    const found = limited.find((a) => a.name === t.name && (a.from === 'race') === (t.from === 'kindred'));
    const uses = found?.uses ?? 0;
    return {
      key: t.key,
      name: t.name,
      uses,
      spent: Math.max(0, Math.min(uses, ctx.usesSpent?.[t.name] ?? 0)),
      usesWords: usesWords(uses, found?.refill ?? ''),
      drawback: t.kind === 'disadvantage',
      laterLevel: t.fromLevel !== null && t.fromLevel > ctx.level ? t.fromLevel : null,
      trait: t,
    };
  };
  const titled = (word: string, name: string) => (name ? `${word}: ${name}` : word);
  const kindred = traits.filter((t) => !t.fromOption && t.from === 'kindred');
  const klass = traits.filter((t) => !t.fromOption && t.from === 'class');
  const options = traits.filter((t) => t.fromOption);
  const groups: TraitGroup[] = [
    { id: 'kindred', title: titled(ctx.raceTitle, kindred[0]?.sourceName ?? ''), chips: kindred.map(chip) },
    { id: 'class', title: titled(ctx.classTitle, klass[0]?.sourceName ?? ''), chips: klass.map(chip) },
    { id: 'options', title: 'From options', chips: options.map(chip) },
  ];
  return groups.filter((g) => g.chips.length > 0);
}
