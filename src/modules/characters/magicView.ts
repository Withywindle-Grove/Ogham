// What magic's three screens show, worked out as data (December step 8, ahead of pieces B, C and D; docs/plans/
// dec-8-magic-first-cut.md; mp-1 to mp-5, mp-20, mm-1, mm-4, mm-5; mockups magic/04-magic-tab and 06-prepare-and-rest).
// Pure: each function takes a character's state (character_play, read by readPlay) and the pack's facts as arguments
// and returns plain data, so the screens compose them and work nothing out themselves. No words: names, sentences and
// the pop-up's text are the screens'. Built on piece A's state (magicState.ts: readySpells, nextReady, afterRest),
// never a second copy of it.
//   magicTabLevels    the Magic tab's ready spells, by level (piece B)
//   prepareView       Prepare: each level's slots and steppers, Same as yesterday, chosen and ready kept apart (piece C)
//   restRows          the GM's rest prompt: who is listed and what a tick does (piece D)
//   refillUses        the uses a rest or the new day gives back, by `uses.per` (piece D)
import { afterRest, castKey, nextReady, readySpells } from './magicState.ts';
import { preparedProblem, type CharacterPlay, type PreparedSpell } from './playState.ts';

// ---------------------------------------------------------------------------------------------------------------
// The Magic tab (piece B; mm-1, mp-20)

/** One row of the Magic tab: one spell at one level (mm-1), whatever the times it is ready. */
export interface MagicTabRow {
  spell: string;
  level: number;
  /** Whether the pack still has this spell (false: the row stays, by its id; the screen shows what it can). */
  inPack: boolean;
  /** How many castings it was prepared with. */
  times: number;
  /** How many of those are cast. */
  cast: number;
  /** How many are left. */
  left: number;
  /**
   * A dot per casting, as picture 04 draws them: the castings left first (filled, `false`), then the cast ones (hollow,
   * `true`); one cast of three reads filled, filled, hollow. Empty for a spell prepared once: it has no dots (mm-1).
   */
  dots: boolean[];
  /** The row still offers Cast: a casting is left (mm-1). */
  offersCast: boolean;
  /** No casting is left: the screen crosses it out and says it is cast (mm-1). */
  spent: boolean;
}

/** One level of the Magic tab: its slots a day (the level line, "Level 1, 2 a day") and its rows. */
export interface MagicTabLevel {
  level: number;
  /** The character's slots at this level (`slotsOf`); 0 when the progression gives none (a spell ready there all the same). */
  slots: number;
  rows: MagicTabRow[];
}

/**
 * The Magic tab's ready spells, grouped by spell level, lowest first. Within a level the rows keep the order the state
 * holds them in (first prepared first, as readySpells gives them): neither the rulings nor the picture say otherwise
 * (a question in the status file). Nothing ready is an empty list. `packSpells`, when given, marks a spell the pack no
 * longer has (it stays listed by its id).
 */
export function magicTabLevels(play: Pick<CharacterPlay, 'prepared' | 'spellsCast'>, slots: readonly number[], packSpells?: ReadonlySet<string>): MagicTabLevel[] {
  const levels = new Map<number, MagicTabRow[]>();
  for (const r of readySpells(play)) {
    const left = r.times - r.cast;
    const row: MagicTabRow = {
      spell: r.spell,
      level: r.level,
      inPack: packSpells ? packSpells.has(r.spell) : true,
      times: r.times,
      cast: r.cast,
      left,
      dots: r.times > 1 ? Array.from({ length: r.times }, (_, i) => i >= left) : [],
      offersCast: left > 0,
      spent: left === 0,
    };
    levels.set(r.level, [...(levels.get(r.level) ?? []), row]);
  }
  return [...levels].sort(([a], [b]) => a - b).map(([level, rows]) => ({ level, slots: slots[level - 1] ?? 0, rows }));
}

// ---------------------------------------------------------------------------------------------------------------
// Prepare (piece C; mp-1 to mp-4, mm-4)

/** How many times each spell is in a list, by spell and level, in the list's order. */
export interface SpellCount {
  spell: string;
  level: number;
  count: number;
}

/** A list counted: one entry a spell and level, in the order first listed ("Mire lamp ×2, Reed whisper"). */
export function countSpells(list: readonly PreparedSpell[]): SpellCount[] {
  const out = new Map<string, SpellCount>();
  for (const p of list) {
    const key = castKey(p.level, p.spell);
    const row = out.get(key);
    if (row) row.count += 1;
    else out.set(key, { spell: p.spell, level: p.level, count: 1 });
  }
  return [...out.values()];
}

/** One spell's stepper on Prepare (mp-1). */
export interface PrepareStep {
  spell: string;
  inPack: boolean;
  /** How many times it is chosen for the next rest (never below nought). */
  count: number;
  /** + adds one: the level has an empty slot. When false, + still answers (mp-1): the screen says the level is full. */
  mayAdd: boolean;
  /** − takes one away: it is chosen at least once. */
  mayRemove: boolean;
  /**
   * Under the fold (mp-1; the lead's answer 3, 2026-11-14): set, and only then, for a spell not chosen when the caster
   * chooses from the whole class list. A spell-book caster's steppers never carry it.
   */
  folded?: true;
}

/** One spell level on Prepare: "Level 1, 2 a day. 2 chosen". */
export interface PrepareLevel {
  level: number;
  slots: number;
  chosen: number;
  /** Empty slots left at this level (the foot's "1 slot still empty" adds them up). */
  empty: number;
  /** Every slot is chosen: + on this level answers with the pop-up ("Level 1 is full"). */
  full: boolean;
  /**
   * The steppers in the order the screen shows them (the lead's answers 1 and 3, 2026-11-14): the spells chosen at this
   * level first, in the order chosen (one gone from the book or the pack among them, by its id, so nothing chosen is
   * hidden); then the rest of the candidates, in the order given.
   */
  steps: PrepareStep[];
  /** How many steppers are under the fold (the rest, for a caster choosing from the whole list); 0 for a spell book. */
  folded: number;
}

export interface PrepareView {
  /** Each level the character has slots at, lowest first. */
  levels: PrepareLevel[];
  /** Empty slots across every level (the foot). */
  empty: number;
  /** The levels that are full, lowest first (where + answers with the pop-up). */
  fullLevels: number[];
  /**
   * What is chosen for the next rest, counted. With nothing chosen anew (`chosenIsNew` false) the next rest brings back
   * today's ready spells (piece A, mm-5), so this is today's ready set.
   */
  chosenForRest: SpellCount[];
  /** Whether a choice has been made since the last rest (`chosen` stored), or the next rest would bring back today's. */
  chosenIsNew: boolean;
  /** What is ready today, counted: Prepare never changes it (mp-2). The screen tells the two apart in words. */
  readyToday: SpellCount[];
  /** Whether what is chosen for the next rest differs from what is ready today (same spells, same counts, any order). */
  chosenDiffers: boolean;
  /** Same as yesterday ("Pick", mm-4): what it would choose (today's ready set, as stored), and whether it fits the slots. */
  sameAsYesterday: { offers: boolean; would: SpellCount[]; fits: boolean };
  /** Chosen spells at a level the character has no slots at (messy data; the command would refuse the list as it is). */
  beyond: SpellCount[];
}

/** The same spells with the same counts, whatever the order. */
const sameCounts = (a: readonly SpellCount[], b: readonly SpellCount[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.spell === x.spell && y.level === x.level && y.count === x.count));

/**
 * Prepare's facts (mp-1 to mp-4, mm-4). `slots` is the character's slots a level (`slotsOf`: [2, 1] = 2 at level 1, 1
 * at level 2); `candidates` the spells it may choose from at each level, in the order the screen lists them (the
 * caller decides which: a book caster's spell book, or the whole class list for a prayer caster, mp-1). Steppers count
 * the set chosen for the next rest; "ready today" is returned apart.
 */
export function prepareView(
  play: Pick<CharacterPlay, 'prepared' | 'chosen'>,
  slots: readonly number[],
  candidates: ReadonlyMap<number, readonly string[]>,
  packSpells?: ReadonlySet<string>,
  /**
   * `wholeList`: the candidates are the whole class list (a caster who chooses from it, mp-1: "chosen first, the rest
   * folded"), not a spell book. The caller knows which, as it chose the candidates (`spellListOf`, or the book).
   */
  { wholeList = false }: { wholeList?: boolean } = {},
): PrepareView {
  const chosenList = nextReady(play);
  const chosenForRest = countSpells(chosenList);
  const readyToday = countSpells(play.prepared);
  const inPack = (spell: string) => (packSpells ? packSpells.has(spell) : true);
  const levels: PrepareLevel[] = [];
  slots.forEach((n, i) => {
    if (n <= 0) return;
    const level = i + 1;
    const here = chosenForRest.filter((c) => c.level === level);
    const chosen = here.reduce((sum, c) => sum + c.count, 0);
    const full = chosen >= n;
    const offered = [...new Set(candidates.get(level) ?? [])];
    // The chosen first, in the order chosen (`here` keeps the order first listed); then the rest in the order given.
    const chosenFirst = here.map((c) => c.spell);
    const listed = [...chosenFirst, ...offered.filter((s) => !chosenFirst.includes(s))];
    const steps = listed.map((spell): PrepareStep => {
      const count = here.find((c) => c.spell === spell)?.count ?? 0;
      return { spell, inPack: inPack(spell), count, mayAdd: !full, mayRemove: count > 0, ...(wholeList && count === 0 ? { folded: true as const } : {}) };
    });
    levels.push({ level, slots: n, chosen, empty: Math.max(0, n - chosen), full, steps, folded: steps.filter((st) => st.folded).length });
  });
  const would = countSpells(play.prepared);
  return {
    levels,
    empty: levels.reduce((sum, l) => sum + l.empty, 0),
    fullLevels: levels.filter((l) => l.full).map((l) => l.level),
    chosenForRest,
    chosenIsNew: play.chosen !== null,
    readyToday,
    chosenDiffers: !sameCounts(chosenForRest, readyToday),
    sameAsYesterday: { offers: play.prepared.length > 0, would, fits: preparedProblem(play.prepared, [...slots]) === null },
    beyond: chosenForRest.filter((c) => !(slots[c.level - 1] && slots[c.level - 1]! > 0)),
  };
}

/**
 * One more of a spell chosen at a level (the stepper's +), or null when the list with it wouldn't fit the slots: the
 * level is full (the screen's pop-up), or has no slots. Decided by `preparedProblem`, the one home of "does it fit",
 * so it also refuses while the list already holds a spell beyond the slots (messy data the command would refuse too).
 */
export function chooseOneMore(chosen: readonly PreparedSpell[], spell: string, level: number, slots: readonly number[]): PreparedSpell[] | null {
  const next = [...chosen, { spell, level }];
  return preparedProblem(next, [...slots]) === null ? next : null;
}

/** One fewer of a spell at a level (the stepper's −): the last one chosen goes; nought stays nought. */
export function chooseOneFewer(chosen: readonly PreparedSpell[], spell: string, level: number): PreparedSpell[] {
  const at = chosen.map((p) => p.spell === spell && p.level === level).lastIndexOf(true);
  return at < 0 ? [...chosen] : [...chosen.slice(0, at), ...chosen.slice(at + 1)];
}

// ---------------------------------------------------------------------------------------------------------------
// The rest prompt (piece D; mp-5)

/** A limited-use power as the rest reads it: its name (how its spent uses are kept), its uses, and the pack's `uses.per`. */
export interface UsesPower {
  name: string;
  uses: number;
  /** When its uses come back, as the pack says it (`LimitedAbility.refill`): "rest", "day", "week"… */
  refill: string;
}

/** What comes back at a rest, or at the new day. */
export interface Refill {
  /** The rest's tick: uses with `per: rest` come back to those who rested. */
  rested: boolean;
  /** The new day: uses with `per: day` come back to everyone. */
  newDay: boolean;
}

/** The pack's `uses.per`, read for the rest: only "rest" and "day" refill here (the plan leaves the rest to the table). */
const perOf = (refill: string) => refill.trim().toLowerCase();

/**
 * The spent uses after a rest or the new day (mp-5): `per: rest` back to nought when `rested`, `per: day` when
 * `newDay`; anything else (a week, a year, once ever, a fight, a word the pack uses that isn't one of those) is left as
 * it is, for the table. A count for a power the character no longer has is left too.
 */
export function refillUses(usesSpent: Readonly<Record<string, number>>, powers: readonly UsesPower[], refill: Refill): Record<string, number> {
  const out: Record<string, number> = { ...usesSpent };
  for (const power of powers) {
    const per = perOf(power.refill);
    if ((per === 'rest' && refill.rested) || (per === 'day' && refill.newDay)) delete out[power.name];
  }
  return out;
}

/** A power the rest's tick gives back: its name, its uses, and how many were spent (all come back). */
export interface UsesBack {
  name: string;
  uses: number;
  spent: number;
}

/** One character on the GM's rest prompt (mp-5) and what a ✓ does, as data. */
export interface RestRow {
  characterId: string;
  /** Any spell slots, or anything ready or chosen: magic comes back with ✓. */
  caster: boolean;
  /** What becomes ready with ✓: the chosen set, or today's when nothing new is chosen (piece A's afterRest), counted. */
  becomeReady: SpellCount[];
  /** Today's casts that ✓ clears, by `castKey`. */
  castsCleared: Record<string, number>;
  /** Its `per: rest` powers, every one, with what was spent (✓ gives all back). */
  usesBack: UsesBack[];
}

/** One character as the rest prompt reads them. */
export interface RestCharacter {
  id: string;
  play: Pick<CharacterPlay, 'prepared' | 'chosen' | 'spellsCast' | 'usesSpent'> & Partial<Pick<CharacterPlay, 'restedOnce'>>;
  /** Its spell slots a level (`slotsOf`). */
  slots: readonly number[];
  /** Its limited-use powers (the class's and kindred's `limitedAbilities`, and any trait's). */
  powers: readonly UsesPower[];
}

/**
 * The GM's rest prompt's rows (mp-5): each caster (any spell slots, or anything ready or chosen) and each character with
 * a power whose uses return at a rest, in the order given; a character with neither isn't listed. Per-day uses are not
 * a row's: they return to everyone at the new day (refillUses with `newDay`).
 */
export function restRows(characters: readonly RestCharacter[]): RestRow[] {
  return characters.flatMap((c) => {
    const caster = c.slots.some((n) => n > 0) || c.play.prepared.length > 0 || (c.play.chosen?.length ?? 0) > 0;
    const restPowers = c.powers.filter((p) => perOf(p.refill) === 'rest' && p.uses > 0);
    if (!caster && restPowers.length === 0) return [];
    const after = afterRest(c.play);
    return [
      {
        characterId: c.id,
        caster,
        becomeReady: caster ? countSpells(after.prepared) : [],
        castsCleared: caster ? { ...c.play.spellsCast } : {},
        usesBack: restPowers.map((p) => ({ name: p.name, uses: p.uses, spent: Math.min(p.uses, c.play.usesSpent[p.name] ?? 0) })),
      },
    ];
  });
}
