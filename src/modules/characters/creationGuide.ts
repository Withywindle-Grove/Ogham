// Guided creation revisited (M5b step 0; docs/05 "Guided creation revisited", 07 `creationGuide`, `creation.require`,
// `blurb`). Pure: each step's why-line (the pack's, else the app's own), the longer help behind Help me choose, which
// steps the pack makes required, a choice's one-line blurb, the order of the steps after "Who are they?", the step
// counter, and the To finish list kept on the character's creation record.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The step names a pack's `creationGuide` and `creation.require` use (07). */
export const GUIDE_STEPS = ['method', 'scores', 'race', 'class', 'who', 'spells', 'gear', 'languages', 'weaponSkills', 'expertise', 'traits', 'details'] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

/** The app's own why-lines, used when the pack gives none (06, Guided-flow instruction: one line, about 12 words). */
export const APP_WHY: Record<GuideStep | 'adjust', string> = {
  method: 'Pick the way your table builds a character.',
  scores: 'Roll each score as your setting says, then enter what you rolled.',
  // One sentence a step, in the ruled words (dec-10 A; cs-2, cs-31).
  race: 'The people your character was born to.',
  class: 'Your trade as an adventurer.',
  adjust: 'Trade points between scores, if your setting allows it.',
  who: 'A name the table will remember.',
  spells: 'The spells your character starts with.',
  gear: 'What you carry into your first adventure.',
  languages: 'The tongues your character speaks.',
  weaponSkills: 'The weapons your character has trained with.',
  // G-208 (ex-3, mockup december/29 X1): the step's one line.
  expertise: 'Each point makes one skill better.',
  traits: 'Choose who your character was before adventuring.',
  details: 'None of these change the rules.',
};

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/**
 * The Scores step's line when the pack gives none (final draft 1): "Six numbers say what your character is naturally
 * good at." The dice go in the step's Roll row, not here.
 */
export function scoresWhy(count: number): string {
  const word = COUNT_WORDS[count] ?? String(count);
  return count === 1 ? 'One number says what your character is naturally good at.' : `${word} numbers say what your character is naturally good at.`;
}

/** The top rules set that says, as the packs stack (the last wins). */
function top(rulesSets: readonly Record<string, unknown>[], key: string): unknown {
  for (const rules of [...rulesSets].reverse()) if (rules[key] !== undefined) return rules[key];
  return undefined;
}

/** The pack's guide for one step: a line, or `{ why, help }` (07). Null parts when the pack doesn't say. */
function packGuide(rulesSets: readonly Record<string, unknown>[], step: GuideStep): { why: string | null; help: string | null; title: string | null } {
  const guide = top(rulesSets, 'creationGuide');
  if (!isRecord(guide)) return { why: null, help: null, title: null };
  const entry = guide[step];
  if (typeof entry === 'string') return { why: entry.trim() || null, help: null, title: null };
  if (isRecord(entry)) return { why: text(entry.why) || null, help: text(entry.help) || null, title: text(entry.title) || null };
  return { why: null, help: null, title: null };
}

/** The step's title in the pack's word (`creationGuide.<step>.title`, ruled 2026-11-02: "Kindred"), else the app's. */
export function stepTitle(rulesSets: readonly Record<string, unknown>[], step: GuideStep, fallback: string): string {
  return packGuide(rulesSets, step).title ?? fallback;
}

/**
 * A step's why-line and help. The why-line is the pack's, else the app's own; the help is the pack's longer guidance,
 * null without it (Help me choose then shows the choices' blurbs side by side, ruled 2026-11-01, ⚑ 1).
 */
export function stepGuide(rulesSets: readonly Record<string, unknown>[], step: GuideStep | 'adjust'): { why: string; help: string | null } {
  // The adjustments share the scores step's guidance when the pack gives a help text; their line is the app's.
  if (step === 'adjust') return { why: APP_WHY.adjust, help: null };
  const pack = packGuide(rulesSets, step);
  return { why: pack.why ?? APP_WHY[step], help: pack.help };
}

/** The steps the pack makes required (`creation.require`, 07): a required step has no Decide later. */
export function requiredSteps(rulesSets: readonly Record<string, unknown>[]): Set<string> {
  const creation = top(rulesSets, 'creation');
  if (!isRecord(creation) || !Array.isArray(creation.require)) return new Set();
  return new Set(creation.require.filter((s): s is string => typeof s === 'string').map((s) => s.trim()));
}

/** A choice's one line under its name: the pack's `blurb`, else its older alias `summary` (E39); '' without either. */
export function blurbOf(data: Record<string, unknown>): string {
  return text(data.blurb) || text(data.summary);
}

/**
 * A class's or kindred's `description` (ruled by Francis 2026-11-07): the book's descriptive paragraphs, plain text,
 * shown in its entry after the blurb. One string per paragraph (a line break starts a new one); [] without.
 */
export function descriptionOf(data: Record<string, unknown>): string[] {
  if (typeof data.description !== 'string') return [];
  return data.description
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The steps after "Who are they?" in the order the app uses when the pack doesn't order them. */
const LATER_DEFAULT: GuideStep[] = ['spells', 'gear', 'languages', 'weaponSkills', 'expertise', 'traits'];

/**
 * The order of the steps after "Who are they?" (gear and the new steps), only those present. They follow the pack's
 * order (ruled 2026-11-01, ⚑ 2): the order its `creationGuide` names them in. Steps it doesn't name keep the app's
 * order after the named ones.
 */
export function laterSteps(rulesSets: readonly Record<string, unknown>[], present: readonly GuideStep[]): GuideStep[] {
  const guide = top(rulesSets, 'creationGuide');
  const named = isRecord(guide) ? Object.keys(guide) : [];
  const rank = (step: GuideStep) => {
    const at = named.indexOf(step);
    return at >= 0 ? at : named.length + LATER_DEFAULT.indexOf(step);
  };
  return LATER_DEFAULT.filter((s) => present.includes(s)).sort((a, b) => rank(a) - rank(b));
}

/** The steps left with Decide later, kept on the creation record (04, PC extras: toFinish). */
export function toFinishOf(creation: unknown): string[] {
  if (!isRecord(creation) || !Array.isArray(creation.toFinish)) return [];
  return [...new Set(creation.toFinish.filter((s): s is string => typeof s === 'string' && s.trim() !== ''))];
}

/** The creation record with a step added to (later) or taken off (done) the To finish list. */
export function withToFinish(creation: unknown, step: string, later: boolean): Record<string, unknown> {
  const record = isRecord(creation) ? { ...creation } : {};
  const now = toFinishOf(record).filter((s) => s !== step);
  const next = later ? [...now, step] : now;
  if (next.length === 0) delete record.toFinish;
  else record.toFinish = next;
  return record;
}

/** The words for a To finish line ("Languages"); a trait list's id reads as words ("Fen backgrounds") until its name is known. */
export function toFinishName(step: string): string {
  if (step === 'languages') return 'Languages';
  if (step === 'weaponSkills') return 'Weapon skills';
  // The pack's word for its points names the line where the setting is known (FinishCreation, the review).
  if (step === 'expertise') return 'Skill points';
  if (step === 'spells') return 'First spells';
  const words = step.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The setting's languages (N13): every language its races and classes name, once each, in the setting's order. A
 * language named after a campaign field (a class's "Alignment" tongue) isn't a language of its own and is left out.
 */
export function settingLanguages(
  entries: readonly { data: Record<string, unknown> }[],
  fieldNames: readonly string[],
  /** How a language id reads (creationRules.ts languageNamer); as written by default. */
  languageName: (named: string) => string = (named) => named,
): string[] {
  const named = new Set(fieldNames.map((n) => n.trim().toLowerCase()));
  const all = entries.flatMap((e) => (Array.isArray(e.data.languages) ? e.data.languages : [])).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  const out: string[] = [];
  for (const language of all.map((l) => languageName(l.trim()).trim())) if (!named.has(language.toLowerCase()) && !out.some((o) => o.toLowerCase() === language.toLowerCase())) out.push(language);
  return out;
}

/** A languages field's text as a list ("Common, Reedspeak"), and back. */
export const languageList = (value: unknown): string[] =>
  typeof value === 'string' ? [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))] : [];
export const languageText = (list: readonly string[]): string => [...new Set(list.map((s) => s.trim()).filter(Boolean))].join(', ');

/** An ability's blurb from the rules set's `abilities` (07), shown under it on the scores step; '' without one. */
export function abilityBlurb(rulesSets: readonly Record<string, unknown>[], key: string): string {
  let found = '';
  for (const rules of rulesSets) {
    if (!Array.isArray(rules.abilities)) continue;
    for (const a of rules.abilities) if (isRecord(a) && a.key === key && blurbOf(a)) found = blurbOf(a);
  }
  return found;
}

/** The pack's own why-line for a step, or null (for steps whose fallback isn't the app's fixed line). */
export function packWhy(rulesSets: readonly Record<string, unknown>[], step: GuideStep): string | null {
  return packGuide(rulesSets, step).why;
}
