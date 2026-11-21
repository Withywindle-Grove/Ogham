// What the setting rules fill in for a character (ruled 2026-10-25): worked out from its scores, class and level
// with the setting's fill hooks; fields linked by a sheet layout's `fill` show their value, and the rest are listed
// in "From your setting" on the full sheet.
import { fillName, fillsAtCreation, raceNotes, ruleFills, showFilled, type Filled } from '../modules/library/fills.ts';
import { AC_KEY, explainFigure, signed, type Explaining, type FigureContext } from '../modules/characters/explain.ts';
import { abilityKeys, abilityNames, classRace, holdsAbility, raceDataAsPlayed } from '../modules/characters/creation.ts';
import { acDirection, acDirectionStated, acLines, unarmouredAc, workOutAc, type AcDirection, type AcWorkedOut, type WornGear } from '../modules/characters/play.ts';
import { acBonusCounts, acBonusesOf, joinNotes, saveBonusNotes, type AcBonus } from '../modules/characters/bonuses.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { readExpertise, type Expertise } from '../modules/characters/expertise.ts';
import { groupChoice, type CampaignSetting } from './campaignSetting.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface FillFor {
  level: number;
  scores: Record<string, number>;
  classRef: string | null;
  raceRef: string | null;
  /**
   * The expertise points spent (G-208; actors.expertise): read only while the class's `skills.points` is in force (its
   * skills' figures, fills.ts). Left out, every class skill reads its base (ex-8).
   */
  expertise?: Expertise;
}

/** What the setting fills in for a character, and what's said beside its figures. */
export interface SettingFilled {
  filled: Filled;
  /** The campaign fields' links to the filled values (field key → fill name). */
  links: Map<string, string>;
  /** Everything said beside a figure, by fill name, the race's then the class's ("+3 to the roll vs poison"). */
  notes: Record<string, string>;
  /** What the race says: a save's bonus by CON or its `saveBonus`, a skill target in a situation (fills.ts raceNotes). */
  raceNotes: Record<string, string>;
  /** What the class says: its `saveBonus` (cs-7). */
  classNotes: Record<string, string>;
}

/**
 * The filled values, the fields' fill links, and what the race and class say beside a figure (by fill name: a save's
 * bonus by CON or the kindred's or class's `saveBonus`, cs-7; a skill target that holds only in a situation).
 */
export function settingFills(setting: CampaignSetting, character: FillFor, fieldDefs: readonly FieldDefinition[]): SettingFilled {
  const entry = (kind: string, id: string | null) => (id ? (setting.all.find((e) => e.kind === kind && e.packEntryId === id)?.data ?? null) : null);
  const hooks = setting.all.filter((e) => e.kind === 'hook').map((e) => e.data);
  const klass = entry('class', character.classRef);
  // A kindred-class replaces its kindred's traits (cs-4): the race as this character plays it.
  const race = raceDataAsPlayed(entry('race', character.raceRef), character.raceRef, klass);
  // The attack figure follows the campaign's AC style (A4, bq3-13).
  // Only when the setting says which way AC runs; otherwise the class's figure as it gives it.
  const direction = acDirectionStated(setting.rulesSets, acStyleOf(setting));
  const { filled: hooked } = fillsAtCreation(hooks, setting.rulesSets, { level: character.level, scores: character.scores, klass, race, ...(direction ? { acDirection: direction } : {}), ...(character.expertise ? { expertise: character.expertise } : {}) });
  // Movement, skills and save modifiers the race and the rules set give (ct3-10, ct3-12a).
  const filled = { ...hooked, ...ruleFills(setting.rulesSets, { klass, race, classRef: character.classRef, raceRef: character.raceRef }, hooked) };
  const saveKeys = Object.keys(filled).filter((k) => k.startsWith('saves.')).map((k) => k.slice('saves.'.length));
  const ofRace = joinNotes(raceNotes(race, character.scores), saveBonusNotes(race, saveKeys));
  const ofClass = saveBonusNotes(klass, saveKeys);
  return { filled, links: new Map(fieldDefs.flatMap((f) => (f.fill ? [[f.key, f.fill] as const] : []))), notes: joinNotes(ofRace, ofClass), raceNotes: ofRace, classNotes: ofClass };
}

/** The kindred's and class's AC bonuses for a character (cs-7), the race as the class plays it. */
export function characterAcBonuses(setting: CampaignSetting, character: Pick<FillFor, 'level' | 'classRef' | 'raceRef'>): AcBonus[] {
  const entry = (kind: string, id: string | null) => (id ? (setting.all.find((e) => e.kind === kind && e.packEntryId === id)?.data ?? null) : null);
  const klass = entry('class', character.classRef);
  return acBonusesOf(raceDataAsPlayed(entry('race', character.raceRef), character.raceRef, klass), klass, character.level);
}

/** A character's scores: from its fields named like the setting's abilities, or else as recorded at creation. */
export function scoresOf(setting: CampaignSetting, fields: unknown, creation: unknown): Record<string, number> {
  const keys = abilityKeys(setting.rulesSets);
  const values = isRecord(fields) ? fields : {};
  const made = isRecord(creation) && isRecord(creation.scores) ? creation.scores : {};
  return Object.fromEntries(
    keys.flatMap((k) => {
      const field = Object.keys(values).find((key) => holdsAbility(key, k) && typeof values[key] === 'number');
      return field ? [[k, values[field] as number]] : typeof made[k] === 'number' ? [[k, made[k] as number]] : [];
    }),
  );
}

/** A figure with what the race says beside it: "6 (5 when foraging)". */
export const withNote = (value: string, note: string | undefined): string => (note && value.trim() ? `${value} (${note})` : value);

/** "From your setting": the filled values no campaign field shows, as label and words. */
export function unclaimed(setting: CampaignSetting, character: FillFor, fieldDefs: readonly FieldDefinition[]): { name: string; label: string; value: string }[] {
  const { filled, links, notes } = settingFills(setting, character, fieldDefs);
  const fieldKeys = fieldDefs.map((f) => f.key);
  const shown = new Set(links.values());
  // One figure once: the speed shown as `movement`.
  if (shown.has('movement.speed')) shown.add('movement');
  if (shown.has('movement')) shown.add('movement.speed');
  const klass = character.classRef ? (setting.all.find((e) => e.kind === 'class' && e.packEntryId === character.classRef)?.data ?? null) : null;
  return Object.entries(filled)
    .filter(([name]) => !shown.has(name) && !fieldKeys.includes(name))
    .map(([name, value]) => ({ name, label: fillName(name, setting.rulesSets, klass), value: withNote(showFilled(value), notes[name]) }));
}

/** What the sheet and the Player screen show for a character: names, filled values, and the fields' values. */
export interface CharacterFigures {
  raceName: string | null;
  /**
   * The race to show beside the class (ruled 2026-10-29): the race picked, else for race-as-class the race the
   * class names (`classes[].race`), as the sheet's Race row shows it; null when neither says.
   */
  shownRace: string | null;
  className: string | null;
  klass: Record<string, unknown> | null;
  race: Record<string, unknown> | null;
  /** What the setting fills in (empty without a class). */
  filled: Filled;
  /** The fields' values, with what the setting knows filling the empty ones (M4b re-test, 2026-10-26). */
  values: Record<string, unknown>;
  /** What the race says beside a figure, by fill name ("saves.D" → "+3 to the roll vs poison"); fills.ts raceNotes. */
  notes: Record<string, string>;
  /** The race's and the class's part of `notes`, for a breakdown that names who says it. */
  raceNotes: Record<string, string>;
  classNotes: Record<string, string>;
  /** The same, by the campaign field that shows the figure (its `fill`). */
  fieldNotes: Record<string, string>;
  /** The kindred's and class's own AC bonuses (cs-7), counted in `ac` when their condition holds. */
  acBonuses: AcBonus[];
  /** For tap-to-explain (ruled 2026-10-26). */
  explaining: Explaining;
  /** What a worked-out figure's breakdown reads beyond `explaining` (ct3-9). */
  figureCtx: FigureContext;
  /**
   * A worked-out figure's breakdown by its fill name (ct3-9, bq-2: every worked-out figure is tappable wherever it
   * appears, the same words on the full sheet, the Player screen and at creation); explainFigure.
   */
  explain: (name: string) => string[];
  /**
   * AC worked out from what's worn (ruled 2026-10-29, B9); null while that's loading. `seesHidden` (the GM) counts
   * hidden magic bonuses too.
   */
  ac: (worn: readonly WornGear[] | null, seesHidden?: boolean) => AcWorkedOut;
  /** An item of the setting rules by its id (a magic armour's base): its name and armour block; null if unknown. */
  baseArmour: (id: string) => { id: string; name: string; armour: unknown } | null;
  /** Which way the setting's AC runs. */
  acDirection: AcDirection;
  /** The same, only when the setting says it (null: the attack figure stays as the class gives it; A4). */
  acDirectionStated: AcDirection | null;
  /** An ability's short and long names: the GM's label, else the setting's, else the key (ruled 2026-10-29, B6). */
  abilityName: (key: string) => { short: string; long: string };
  /**
   * The class is the race and names none (ruled 2026-10-29, B10): no race was picked and the class has no `race`,
   * so the Race row is left out rather than guessed.
   */
  hideRace: boolean;
}

/** The campaign's choice for the "ac-style" ruleKey group (one choice per group, 07; its default when not chosen), or null. */
export function acStyleOf(setting: CampaignSetting): string | null {
  return groupChoice(setting, 'ac-style')?.choiceId ?? null;
}

/**
 * The option that sets the AC style, by its name ("Armour class and attacks"), for Attack's breakdown (sr-8); null
 * when a rules set's `attack.style` sets it instead, or no option does.
 */
export function attackStyleOption(setting: CampaignSetting): string | null {
  const attack = (Object.assign({}, ...setting.rulesSets) as Record<string, unknown>).attack;
  if (isRecord(attack) && typeof attack.style === 'string' && attack.style.trim()) return null;
  const chosen = groupChoice(setting, 'ac-style');
  if (!chosen) return null;
  return setting.all.find((e) => e.kind === 'option' && e.packEntryId === chosen.optionId && e.packId === chosen.packId)?.name ?? null;
}

/**
 * The fills at creation with AC worked out (the second test, 2026-11-02): a layout field whose `fill` is `ac` shows
 * the AC with nothing worn yet — the setting's `attack.unarmouredAC` (in its AC style) and every ability modifier the
 * scores give AC (the DEX column, whatever the setting calls it) — the same sum as the sheet's AC line. Only when no
 * fill hook gave `ac` already and the setting has the numbers; never a guess.
 */
export function withCreationAc(setting: CampaignSetting, filled: Filled, fieldDefs: readonly FieldDefinition[], bonuses: readonly AcBonus[] = []): Filled {
  if (filled.ac !== undefined || !fieldDefs.some((f) => !f.hidden && f.fill?.trim() === 'ac')) return filled;
  const worked = workOutAc({ rulesSets: setting.rulesSets, chosenStyle: acStyleOf(setting), worn: [], filled, abilityName: (k) => k, bonuses });
  return worked.value === null ? filled : { ...filled, ac: worked.value };
}

/**
 * AC's parts at creation (ct-5): "unarmoured, DEX +0" — the setting's unarmoured AC and each ability modifier the
 * scores give AC (a 0 named too, so the player sees the score counted). Null when `withCreationAc` gave no AC.
 */
export function creationAcParts(setting: CampaignSetting, filled: Filled, abilityName: (key: string) => string, bonuses: readonly AcBonus[] = []): string | null {
  if (unarmouredAc(setting.rulesSets, acStyleOf(setting)) === null) return null;
  const better = acDirection(setting.rulesSets, acStyleOf(setting)) === 'ascending' ? 1 : -1;
  const parts = ['unarmoured'];
  for (const [name, row] of Object.entries(filled)) {
    if (!name.startsWith('abilityModifiers.') || !isRecord(row)) continue;
    for (const [key, value] of Object.entries(row)) if (AC_KEY.test(key) && typeof value === 'number') parts.push(`${abilityName(name.slice('abilityModifiers.'.length))} ${signed(better * value)}`);
  }
  // The kindred's and class's bonuses that count with nothing worn (cs-7), as withCreationAc adds them.
  for (const b of bonuses) if (acBonusCounts(b, 'none') === 'counts') parts.push(`${b.source} ${signed(better * b.value)}`);
  return parts.join(', ');
}

/** A character's figures, worked out the same way wherever they show. */
export function characterFigures(
  setting: CampaignSetting | null,
  character: { level: number; fields: unknown; creation: unknown; classRef: string | null; raceRef: string | null; /** actors.expertise (G-208): the class skills' figures under points. */ expertise?: unknown },
  fieldDefs: readonly FieldDefinition[],
): CharacterFigures {
  // An ability's names wherever they show: the GM's own field label wins, then the setting's (ruled 2026-10-29, B6).
  const abilityName = abilityNames(setting?.rulesSets ?? [], fieldDefs);
  const dataOf = (kind: string, ref: unknown) => {
    const data = typeof ref === 'string' ? setting?.all.find((e) => e.kind === kind && e.packEntryId === ref)?.data : undefined;
    return isRecord(data) ? data : null;
  };
  const nameOf = (data: Record<string, unknown> | null) => (data && typeof data.name === 'string' ? data.name : null);
  const baseArmour = (id: string) => {
    const item = dataOf('item', id);
    return item ? { id, name: nameOf(item) ?? id, armour: item.armour } : null;
  };
  const klass = dataOf('class', character.classRef);
  // A kindred-class replaces its kindred's traits (cs-4): the race as this character plays it.
  const race = raceDataAsPlayed(dataOf('race', character.raceRef), character.raceRef, klass);
  const raceName = nameOf(race);
  const className = nameOf(klass);
  const fills =
    setting && character.classRef
      ? settingFills(setting, { level: character.level, scores: scoresOf(setting, character.fields, character.creation), classRef: character.classRef, raceRef: character.raceRef, expertise: readExpertise(character.expertise) }, fieldDefs)
      : null;
  const empty = (v: unknown) => v === undefined || v === null || v === '';
  const values: Record<string, unknown> = { ...(isRecord(character.fields) ? character.fields : {}) };
  // A class with no race chosen (the class is the race): the race the class names, or none (ruled 2026-10-29, B10).
  const standsFor = !raceName && klass && setting ? classRace(klass, setting.all.filter((e) => e.kind === 'race')) : null;
  const shownRace = raceName ?? standsFor?.name ?? null;
  for (const f of fieldDefs) {
    if (!empty(values[f.key])) continue;
    const link = fills?.links.get(f.key);
    if (link && fills && !empty(fills.filled[link])) values[f.key] = showFilled(fills.filled[link]);
    else if (shownRace && /^race$/i.test(f.key)) values[f.key] = shownRace;
  }
  const filled = fills?.filled ?? {};
  const notes = fills?.notes ?? {};
  const acBonuses = setting && character.classRef ? characterAcBonuses(setting, character) : [];
  const fieldNotes = Object.fromEntries(fieldDefs.flatMap((f) => (f.fill && notes[f.fill.trim()] ? [[f.key, notes[f.fill.trim()]!] as const] : [])));
  // Explanations use the long names (N23, ruled 2026-10-28).
  const explaining: Explaining = { level: character.level, filled, klass, klassName: className, race, raceName, xpTable: dataOf('xpTable', klass?.xpTableId), abilityLabel: (k) => abilityName(k).long };
  const figureCtx = figureContextOf(setting, { scores: setting ? scoresOf(setting, character.fields, character.creation) : {}, classRef: character.classRef, raceRef: character.raceRef, klass }, fills);
  return {
    raceName,
    shownRace,
    className,
    klass,
    race,
    filled,
    values,
    notes,
    raceNotes: fills?.raceNotes ?? {},
    classNotes: fills?.classNotes ?? {},
    fieldNotes,
    acBonuses,
    explaining,
    figureCtx,
    explain: (name) => explainFigure(name, explaining, figureCtx),
    ac: (worn, seesHidden = false) =>
      workOutAc({
        rulesSets: setting?.rulesSets ?? [],
        chosenStyle: setting ? acStyleOf(setting) : null,
        // Magic armour's chosen base (ruled 2026-10-29): the line keeps its id; the setting rules give its AC.
        worn: worn && worn.map((g) => (g.baseArmourId && !g.chosenBase ? { ...g, chosenBase: baseArmour(g.baseArmourId) } : g)),
        filled,
        abilityName: (k) => abilityName(k).long,
        seesHidden,
        bonuses: acBonuses,
      }),
    baseArmour,
    acDirection: acDirection(setting?.rulesSets ?? [], setting ? acStyleOf(setting) : null),
    acDirectionStated: acDirectionStated(setting?.rulesSets ?? [], setting ? acStyleOf(setting) : null),
    abilityName,
    hideRace: Boolean(klass) && !character.raceRef && shownRace === null,
  };
}

/** What explainFigure reads beyond `Explaining` (ct3-9): the rules sets, the scores, the refs and what's said beside each figure. */
function figureContextOf(
  setting: CampaignSetting | null,
  character: { scores: Record<string, number>; classRef: string | null; raceRef: string | null; klass: Record<string, unknown> | null },
  fills: Pick<SettingFilled, 'raceNotes' | 'classNotes'> | null,
): FigureContext {
  const rulesSets = setting?.rulesSets ?? [];
  return {
    rulesSets,
    scores: character.scores,
    classRef: character.classRef,
    raceRef: character.raceRef,
    notes: fills?.raceNotes ?? {},
    classNotes: fills?.classNotes ?? {},
    label: (name) => fillName(name, rulesSets, character.klass),
  };
}

/**
 * A worked-out figure's breakdown at creation (bq-2: creation's Derived fields open the same breakdown as the full
 * sheet), from the draft's picks: its scores, class, kindred and level, and the fills worked out from them.
 */
export function creationExplainer(
  setting: CampaignSetting,
  draft: FillFor,
  filled: Filled,
  fills: Pick<SettingFilled, 'raceNotes' | 'classNotes'> | null,
  fieldDefs: readonly FieldDefinition[],
): (name: string) => string[] {
  const dataOf = (kind: string, ref: unknown) => {
    const data = typeof ref === 'string' ? setting.all.find((e) => e.kind === kind && e.packEntryId === ref)?.data : undefined;
    return isRecord(data) ? data : null;
  };
  const klass = dataOf('class', draft.classRef);
  const race = raceDataAsPlayed(dataOf('race', draft.raceRef), draft.raceRef, klass);
  const nameOf = (data: Record<string, unknown> | null) => (data && typeof data.name === 'string' ? data.name : null);
  const abilityName = abilityNames(setting.rulesSets, fieldDefs);
  const explaining: Explaining = { level: draft.level, filled, klass, klassName: nameOf(klass), race, raceName: nameOf(race), xpTable: dataOf('xpTable', klass?.xpTableId), abilityLabel: (k) => abilityName(k).long };
  const ctx = figureContextOf(setting, { scores: draft.scores, classRef: draft.classRef, raceRef: draft.raceRef, klass }, fills);
  return (name) => explainFigure(name, explaining, ctx);
}

/** The line that ends creation's AC breakdown under a worked figure. Creation only: the sheet's pop-up dropped it (tfw-1). */
export const CREATION_AC_CHECKED = 'Your GM checks it at the table.';

/**
 * AC's breakdown at creation (bq-2), with nothing worn yet: the same lines as the AC tile's pop-up on the sheet (the
 * setting's unarmoured AC, each ability modifier, the kindred's and class's bonuses that count), long names. Under a
 * worked figure creation still ends with "Your GM checks it at the table.": kept in creation (Francis, 2026-11-19),
 * while the sheet's pop-up dropped it (tfw-1).
 */
export function creationAcLines(setting: CampaignSetting, filled: Filled, fieldDefs: readonly FieldDefinition[], bonuses: readonly AcBonus[] = []): string[] {
  const abilityName = abilityNames(setting.rulesSets, fieldDefs);
  const worked = workOutAc({ rulesSets: setting.rulesSets, chosenStyle: acStyleOf(setting), worn: [], filled, abilityName: (k) => abilityName(k).long, bonuses });
  const lines = acLines(null, worked);
  return worked.known && !worked.chooseBase && worked.value !== null ? [...lines, CREATION_AC_CHECKED] : lines;
}
