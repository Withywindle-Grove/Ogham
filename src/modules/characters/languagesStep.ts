// The Languages step on the creation step shell (M5b step 0c, slice 6; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md
// cr-15; mockup creation/07; 07 `languages`). Pure: what the character speaks already (the common tongue(s), the
// alignment tongue following the alignment picked, the race's and the class's), what it may pick and how many (the
// `extraLanguages` column of the score the setting names), whether the step exists at all (skipped when there is
// nothing to pick), what Next checks, and the list as the languages field keeps it. A setting without the
// `languages` section (the older packs) still works: the races' and classes' languages are the list, and the count
// is whatever the ability table gives as a number (none: pick freely).
import { extraLanguages, findLanguage, languagesRule } from './creationRules.ts';
import { languageList } from './creationGuide.ts';

const names = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()) : []);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface GivenLanguage {
  /** The list's id, or the name as the race or class gives it. */
  id: string;
  name: string;
  blurb: string;
  note: string;
  source: string;
  /** Where it comes from, in words: "everyone", the race's or class's name, "alignment". */
  from: string;
}

export interface LanguageChoice {
  id: string;
  name: string;
  blurb: string;
  note: string;
  source: string;
  /** Its range on the extra-languages die ("2–3"; cs-6 `roll`): rolled at the table, or chosen; '' when it isn't rolled. */
  range: string;
  /** Why it needs the GM's leave (cs-6 `learnableBy`, soft): "Usually fairies only"; '' when it doesn't. */
  leave: string;
}

export interface LanguagesPlan {
  /** Yours already: ticked, not untickable. */
  given: GivenLanguage[];
  /** The setting's list without the given ones. */
  offered: LanguageChoice[];
  /** How many more to pick; null when the pack doesn't say it as a number (pick as your GM allows). */
  count: number | null;
  /** The score that gives the extras ("WIT") and its value, for the group's line. */
  ability: string;
  score: number | null;
  /** The die extra languages are rolled on ("d6"; cs-6 `roll`), '' when none is: then they're only chosen. */
  die: string;
  /** How many of the list the character's kind may not learn (cs-6 `learnableBy`, hard), left out of `offered`. */
  closed: number;
  /**
   * Those left out, each with why (final drafts D, P30): a rolled one shows as a closed row in the die's order ("4.
   * Not open to Stone kin"), so the die's numbers are never silently missing.
   */
  closedRows: { id: string; name: string; range: string; min: number; reason: string }[];
}

interface Entry {
  name: string;
  data: Record<string, unknown>;
}

/**
 * What the Languages step offers this character. `fields` are the campaign's fields: a race or class language named
 * after one (an "Alignment" tongue, N7) is the alignment tongue, not a language of its own. `legacy` is the setting's
 * languages as the races and classes name them (settingLanguages), used when the setting has no `languages` list.
 */
export function languagesPlan(input: {
  rulesSets: readonly Record<string, unknown>[];
  race: Entry | null;
  klass: Entry;
  scores: Record<string, number>;
  /** The alignment picked on Who they are ("Reed"), or null. */
  alignment: string | null;
  fields: readonly { key: string; label: string }[];
  legacy: readonly string[];
  /** The kindred's creature type as the class plays it ("fairy"; cs-6 `learnableBy`); left out or '': no limit is read. */
  creatureType?: string;
}): LanguagesPlan {
  const rule = languagesRule(input.rulesSets);
  const isField = (language: string) => input.fields.some((f) => same(f.label, language) || same(f.key, language));
  const given: GivenLanguage[] = [];
  const give = (language: GivenLanguage) => {
    if (!given.some((g) => same(g.name, language.name))) given.push(language);
  };
  const named = (language: string, from: string): GivenLanguage => {
    const found = findLanguage(rule, language)?.language;
    return found ? { id: found.id, name: found.name, blurb: found.blurb, note: found.note, source: found.source, from } : { id: language, name: language, blurb: '', note: '', source: '', from };
  };
  for (const id of rule?.common ?? []) give(named(id, 'everyone'));
  // The alignment tongue: with the languages section, whenever it says alignment tongues exist; without it, when a
  // race or class names one (N7). It reads the alignment picked, and is left out until there is one.
  const own = [input.race, input.klass].filter((e): e is Entry => !!e);
  const tongue = rule ? rule.alignment : own.some((e) => names(e.data.languages).some(isField));
  if (tongue && input.alignment?.trim()) give({ id: input.alignment.trim(), name: input.alignment.trim(), blurb: 'The tongue of your alignment; it changes if your alignment does.', note: '', source: '', from: 'alignment' });
  for (const entry of own) for (const language of names(entry.data.languages)) if (!isField(language)) give(named(language, entry.name));
  // Who may learn each (cs-6, rc-5): a hard limit leaves it out for other kinds; a soft one offers it with the GM's leave.
  // A kindred with no creature type isn't limited (a pack that doesn't say shouldn't empty the list).
  const kind = (input.creatureType ?? '').trim();
  const fits = (types: readonly string[]) => types.some((t) => same(t, kind));
  let closed = 0;
  const closedRows: LanguagesPlan['closedRows'] = [];
  const kindName = input.race?.name ?? '';
  const rangeWords = (roll: { min: number; max: number } | undefined) => (roll ? (roll.min === roll.max ? `${roll.min}` : `${roll.min}–${roll.max}`) : '');
  const list: LanguageChoice[] = rule
    ? rule.list.flatMap((l) => {
        const by = l.learnableBy;
        const open = !by || (by.types.length > 0 && (!kind || fits(by.types)));
        if (!open && by && !by.soft) {
          closed += 1;
          closedRows.push({ id: l.id, name: l.name, range: rangeWords(l.roll), min: l.roll?.min ?? 0, reason: kindName ? `Not open to ${kindName}` : 'Not open to your kind' });
          return [];
        }
        const leave = open || !by ? '' : by.types.length === 0 ? 'Only with the GM’s leave' : `Usually learnt only by ${by.types.join(' or ')} kinds`;
        const range = rangeWords(l.roll);
        return [{ id: l.id, name: l.name, blurb: l.blurb, note: l.note, source: l.source, range, leave }];
      })
    : input.legacy.map((name) => ({ id: name, name, blurb: '', note: '', source: '', range: '', leave: '' }));
  // Rolled languages first, in the die's order (a roll is read off the list); the chosen-only ones after.
  const rollOf = (l: LanguageChoice) => rule?.list.find((r) => r.id === l.id)?.roll;
  const ordered = [...list.filter((l) => rollOf(l)).sort((a, b) => rollOf(a)!.min - rollOf(b)!.min), ...list.filter((l) => !rollOf(l))];
  const dice = [...new Set((rule?.list ?? []).flatMap((l) => (l.roll ? [l.roll.die] : [])))];
  const ability = rule?.extraFrom ?? 'INT';
  return {
    given,
    offered: ordered.filter((l) => !given.some((g) => same(g.name, l.name))),
    count: extraLanguages(input.rulesSets, input.scores, rule),
    ability,
    score: input.scores[ability] ?? null,
    die: dice.length === 1 ? dice[0]! : '',
    closed,
    closedRows: closedRows.sort((a, b) => a.min - b.min),
  };
}

/** A language row's name (cs-6): the range first when it's rolled ("2–3 · Reedspeak"), as kit rolls read. */
export const languageRowName = (language: LanguageChoice): string => (language.range ? `${language.range}: ${language.name}` : language.name);

/** A range in words for a numbered row (final drafts D): "2 to 3", "4". */
export const rangeInWords = (range: string): string => range.replace('–', ' to ');

/**
 * A rolled language's line (final drafts D, mockup creation/final/04): the die's number first, then its blurb ("2 to 3.
 * The common speech of the folk"); a chosen-only one is its blurb alone.
 */
export const numberedBlurb = (range: string, blurb: string): string => (range ? `${rangeInWords(range)}.${blurb ? ` ${blurb}` : ''}` : blurb);

/**
 * The picks the GM approves specially (cs-6, rc-5: a soft `learnableBy`, "with the GM's leave"): one per such language
 * picked, kept on the creation record beside the race's and class's (step `languages`).
 */
export function languageApprovals(plan: LanguagesPlan, picks: LanguagePicks): { step: 'languages'; entryId: string; name: string; requirement: string }[] {
  return picks.chosen.flatMap((id) => {
    const l = plan.offered.find((o) => o.id === id);
    return l && l.leave ? [{ step: 'languages' as const, entryId: l.id, name: l.name, requirement: l.leave }] : [];
  });
}

/** cr-15: skipped when there is nothing to pick (0 extra, or no list and no count). Other… alone counts when N > 0. */
export function languagesStepExists(plan: LanguagesPlan): boolean {
  if (plan.count === null) return plan.offered.length > 0;
  return plan.count > 0;
}

export interface LanguagePicks {
  /** Ids from the offered list. */
  chosen: string[];
  /** Typed with Other… */
  others: string[];
}

export const NO_LANGUAGE_PICKS: LanguagePicks = { chosen: [], others: [] };

/** How many picks are made (the list's and Other…'s). */
export const picksMade = (picks: LanguagePicks) => picks.chosen.length + picks.others.length;

/** A tap on an offered row: picked or unpicked, or why not ("1 of 1 picked · take one off to pick another."). */
export function tapLanguage(plan: LanguagesPlan, picks: LanguagePicks, id: string): { picks: LanguagePicks } | { problem: string } {
  if (picks.chosen.includes(id)) return { picks: { ...picks, chosen: picks.chosen.filter((c) => c !== id) } };
  if (plan.count !== null && picksMade(picks) >= plan.count) return { problem: `${picksMade(picks)} of ${plan.count} picked: take one off to pick another.` };
  return { picks: { ...picks, chosen: [...picks.chosen, id] } };
}

/** Other…: a typed language joins the picks, unless the count is full or it's already there. */
export function addOther(plan: LanguagesPlan, picks: LanguagePicks, typed: string): { picks: LanguagePicks } | { problem: string } {
  const name = typed.trim();
  const offered = plan.offered.find((o) => same(o.name, name));
  if (plan.given.some((g) => same(g.name, name)) || picks.others.some((o) => same(o, name)) || (offered && picks.chosen.includes(offered.id))) return { problem: `${name} is already yours.` };
  if (offered) return tapLanguage(plan, picks, offered.id);
  if (plan.count !== null && picksMade(picks) >= plan.count) return { problem: `${picksMade(picks)} of ${plan.count} picked: take one off to pick another.` };
  return { picks: { ...picks, others: [...picks.others, name] } };
}

/** Next's check (cr-2): the count, never silent. Null when it may go on. */
export function languagesProblem(plan: LanguagesPlan, picks: LanguagePicks, later: boolean): string | null {
  if (plan.count === null) return null;
  const left = plan.count - picksMade(picks);
  return left > 0 ? `Pick ${left} more${later ? ', or Decide later' : ''}.` : null;
}

/** The foot's hint: "0 of 1 picked", "1 picked", "Nothing more to pick". */
export function languagesHint(plan: LanguagesPlan, picks: LanguagePicks): string {
  if (plan.count === null) return picksMade(picks) === 0 ? 'Pick any your GM allows' : `${picksMade(picks)} picked`;
  return `${picksMade(picks)} of ${plan.count} picked`;
}

/** The languages as the field keeps them: the given ones, then the picks, then the typed ones (names). */
export function languagesOfPlan(plan: LanguagesPlan, picks: LanguagePicks): string[] {
  const picked = picks.chosen.map((id) => plan.offered.find((o) => o.id === id)?.name ?? id);
  return [...plan.given.map((g) => g.name), ...picked, ...picks.others];
}

/** The picks a saved languages field holds (Back, or the To finish card): the list's by name, the rest as Other…. */
export function picksFromSaved(plan: LanguagesPlan, saved: unknown): LanguagePicks {
  const out: LanguagePicks = { chosen: [], others: [] };
  for (const name of languageList(saved)) {
    // A field filled before the step (the race's and class's ids) reads by id as well as by name.
    if (plan.given.some((g) => same(g.name, name) || same(g.id, name))) continue;
    const offered = plan.offered.find((o) => same(o.name, name) || same(o.id, name));
    if (offered) out.chosen.push(offered.id);
    else out.others.push(name);
  }
  return out;
}

/**
 * The derived line under the step (mockup creation/07: "Literacy: Reads · from WIT 12"): the layout's fields filled
 * from the same score's row as the extra languages (their `fill` reaches into `abilityModifiers.<ability>`), never a
 * list of the app's own.
 */
export function languageDerived(fields: readonly { key: string; label: string; fill: string | null; hidden: boolean }[], rows: readonly { key: string; label: string; value: string }[], ability: string): { label: string; value: string }[] {
  const prefix = `abilityModifiers.${ability}.`;
  return fields.filter((f) => !f.hidden && f.fill?.startsWith(prefix) && !f.fill.endsWith('.extraLanguages')).flatMap((f) => rows.filter((r) => r.key === f.key && r.value !== '').map((r) => ({ label: r.label, value: r.value })));
}

/** The entry pop-up's headings for a language (its blurb, note and where it comes from). */
export function languageHeadings(language: { blurb: string; note: string; from?: string; range?: string; leave?: string }, die = ''): { label: string; text: string }[] {
  return [
    ...(language.blurb ? [{ label: 'About', text: language.blurb }] : []),
    ...(language.range ? [{ label: 'Roll', text: `${language.range}${die ? ` on ${die}` : ''}` }] : []),
    ...(language.leave ? [{ label: 'Who learns it', text: `${language.leave}: needs the GM's special approval` }] : []),
    ...(language.note ? [{ label: 'Note', text: language.note }] : []),
    ...(language.from ? [{ label: 'Yours from', text: language.from }] : []),
  ];
}

/**
 * The Languages step's line (dec-10 A, cs-2): its one sentence, then, only as a true fact, how many more tongues the
 * character's score gives ("Wits 13 gives you one more.", "… gives you 3 more."), the score named as the pack writes
 * it. `count` is the score's own share (`extraLanguages`, the score's row alone); nought, no table or no score yet:
 * the first sentence stands alone.
 */
export function languagesLine(why: string, plan: { count: number | null; score: number | null }, scoreName: string): string {
  if (!plan.count || plan.count <= 0 || plan.score === null) return why;
  return `${why} ${scoreName} ${plan.score} gives you ${plan.count === 1 ? 'one' : plan.count} more.`;
}
