// A value that comes from a pack list opens its entry (ct3-11, ruled 2026-11-03: "every value that comes from a pack
// list — languages, moon sign, alignment, background, kindred, class — is tappable on the sheet and in creation and
// opens its entry: what it is, what it does, source and page"). Pure: from the setting's entries and rules sets to
// the entry pop-up's name, source line, one line and headings, built by the same heading readers creation uses
// (raceHeadings, classHeadings, traitHeadings, languageHeadings), so an entry reads the same wherever it opens.
// A value the list doesn't have (a typed Other…, a language of the GM's own) has no entry: it shows as words.
import { packAndPage, type SourceTitles } from '../library/sourceTitles.ts';
import { blurbOf, descriptionOf, languageList, stepTitle } from './creationGuide.ts';
import { classHeadings, raceHeadings, STEP_TITLES, type EntryHeading, type Label } from './creationSteps.ts';
import { findLanguage, languagesRule } from './creationRules.ts';
import type { FieldDefinition } from './fields.ts';
import { layoutHints, traitHeadings, traitListsOf, traitPicksOf, traitSteps } from './traitLists.ts';
import { entryRollPlan, rolledSpellOf, rolledSpellWords } from './traitSpellRoll.ts';
import { alignmentLine, alignmentRows } from './whoTheyAre.ts';
import type { Trait } from './bonuses.ts';
import type { RuleTextBlocks } from '../library/ruleText.ts';

/** A setting entry as the app holds it (a resolved library entry). */
export interface ListedEntry {
  kind: string;
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
  packId?: string;
}

/** An entry to open: its name, the source line ("Fen rules · p. 14"), its one line, and its headings. */
export interface ValueEntry {
  /** Unique on a screen: "<field key>:<id>", "race:<id>", "class:<id>". */
  key: string;
  name: string;
  meta: string;
  /**
   * The entry's one line (its blurb), or a trait's note: its words, or its blocks when the pack writes it in pf-18's
   * blocks (tfb-5), which the entry sets out one by one.
   */
  lead: string | RuleTextBlocks;
  /** A class's or kindred's descriptive paragraphs (its `description`), after the lead; absent for other entries. */
  description?: string[];
  headings: EntryHeading[];
  /** A trait entry's spell rolled under its pick (bq3-18): "Spark · cantrip, rolled 10 on d12"; absent without. */
  rolled?: string;
}

/** What the entries are read from: the setting, and the character they're opened for. */
export interface EntryContext {
  all: readonly ListedEntry[];
  rulesSets: readonly Record<string, unknown>[];
  /** A pack's short name by its id ("Fen rules"); '' when unknown. */
  packName: (packId: string | undefined) => string;
  /** A pack's sources map by its id (07 meta.sourceTitles, G-212), so a source naming its book drops the short name. */
  packTitles?: (packId: string | undefined) => SourceTitles;
  /** The character's scores (a race's and class's requirement lines read them). */
  scores: Record<string, number>;
  /** An ability's short name. */
  label: Label;
  raceRef: string | null;
  classRef: string | null;
  /** The character's creation record, for a trait entry's rolled spell (`traitSpells`, bq3-18); left out: none shown. */
  creation?: unknown;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const join = (...parts: string[]) => parts.filter(Boolean).join(', ');
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "Fen rules · p. 12": the pack's short name and the entry's page. */
const sourceOf = (ctx: EntryContext, entry: ListedEntry) => packAndPage(ctx.packName(entry.packId), text(entry.data.source), ctx.packTitles?.(entry.packId));

const findEntry = (ctx: EntryContext, kind: string, id: string | null) => (id ? (ctx.all.find((e) => e.kind === kind && e.packEntryId === id) ?? null) : null);

/** A race's entry (the race step's six headings), or null when the setting doesn't have it. */
export function raceEntry(ctx: EntryContext, raceId: string | null): ValueEntry | null {
  const race = findEntry(ctx, 'race', raceId);
  if (!race) return null;
  const classNameOf = (id: string) => findEntry(ctx, 'class', id)?.name;
  return { key: `race:${race.packEntryId}`, name: race.name, meta: sourceOf(ctx, race), lead: blurbOf(race.data), description: descriptionOf(race.data), headings: raceHeadings(race, ctx.scores, ctx.label, classNameOf, undefined, ctx.rulesSets) };
}

/** A class's entry (the class step's headings), or null when the setting doesn't have it. */
export function classEntry(ctx: EntryContext, classId: string | null): ValueEntry | null {
  const klass = findEntry(ctx, 'class', classId);
  if (!klass) return null;
  const races = ctx.all.filter((e) => e.kind === 'race');
  const race = findEntry(ctx, 'race', ctx.raceRef);
  const raceWord = stepTitle(ctx.rulesSets, 'race', STEP_TITLES.race);
  return { key: `class:${klass.packEntryId}`, name: klass.name, meta: sourceOf(ctx, klass), lead: blurbOf(klass.data), description: descriptionOf(klass.data), headings: classHeadings(klass, race, ctx.scores, ctx.rulesSets, ctx.label, races, raceWord) };
}

/** An alignment's entry: its line from the pack's `alignmentNotes`, and the setting's general note. Null when the setting has none. */
export function alignmentEntry(ctx: EntryContext, field: Pick<FieldDefinition, 'key' | 'choices'>, value: string): ValueEntry | null {
  const row = alignmentRows(field.choices, ctx.rulesSets).find((r) => same(r.name, value));
  if (!row) return null;
  const general = alignmentLine(ctx.rulesSets);
  return { key: `${field.key}:${row.name}`, name: row.name, meta: '', lead: row.note, headings: general ? [{ label: 'About', text: general }] : [] };
}

/** Each language of a languages field the setting's list has, as an entry (its blurb, note and source). */
export function languageEntries(ctx: EntryContext, fieldKey: string, value: unknown): ValueEntry[] {
  const rule = languagesRule(ctx.rulesSets);
  return languageList(value).flatMap((named) => {
    const found = findLanguage(rule, named);
    if (!found) return [];
    const l = found.language;
    return [{ key: `${fieldKey}:${l.id}`, name: l.name, meta: l.source, lead: l.blurb, headings: l.note ? [{ label: 'Note', text: l.note }] : [] }];
  });
}

/**
 * The entries a sheet field's value opens (ct3-11): a race or class field (by its key), the alignment, each language,
 * or a trait list's entry (a field fed by a list, a per-race list by the character's race). Empty when the value
 * isn't from a pack list.
 */
export function fieldEntries(ctx: EntryContext, field: FieldDefinition, value: unknown, fieldDefs: readonly FieldDefinition[]): ValueEntry[] {
  const words = typeof value === 'string' ? value.trim() : '';
  if (!words) return [];
  const key = field.key.toLowerCase();
  if (key === 'race') {
    const race = ctx.all.find((e) => e.kind === 'race' && (e.packEntryId === words || same(e.name, words)));
    const entry = race ? raceEntry(ctx, race.packEntryId) : null;
    return entry ? [entry] : [];
  }
  if (key === 'class') {
    const klass = ctx.all.find((e) => e.kind === 'class' && (e.packEntryId === words || same(e.name, words)));
    const entry = klass ? classEntry(ctx, klass.packEntryId) : null;
    return entry ? [entry] : [];
  }
  if (key === 'alignment') {
    const entry = alignmentEntry(ctx, field, words);
    return entry ? [entry] : [];
  }
  if (key === 'languages') return languageEntries(ctx, field.key, words);
  // A trait list's entry: the field's own step (a per-race list by the character's race), the entry by id or name.
  const step = traitSteps(fieldDefs, traitListsOf(ctx.all), { layout: layoutHints(ctx.all), raceId: ctx.raceRef }).find((s) => s.field.key === field.key);
  if (!step) return [];
  // A list rolled more than once (pf-16) holds several picks: each entry picked, once.
  const ids = [...new Set(traitPicksOf(step, words).flatMap((p) => ('entryId' in p ? [p.entryId] : [])))];
  const itemName = (id: string) => ctx.all.find((e) => e.kind === 'item' && e.packEntryId === id)?.name;
  const list = ctx.all.find((e) => e.kind === 'traitList' && e.packEntryId === step.list.id);
  return ids.flatMap((id) => {
    const entry = step.list.entries.find((e) => e.id === id);
    if (!entry) return [];
    // The spell rolled under the pick (bq3-18), from the creation record.
    const plan = entryRollPlan(entry.spellRoll, ctx.all);
    const rolled = plan ? rolledSpellOf(ctx.creation, step.list.id, entry.id) : null;
    const rolledWords = plan && rolled ? rolledSpellWords(rolled, plan) : '';
    return [
      {
        key: `${field.key}:${entry.id}`,
        name: entry.name,
        meta: join(list ? ctx.packName(list.packId) : '', entry.source || step.list.source),
        lead: entry.blurb,
        headings: [{ label: 'From', text: step.list.name }, ...traitHeadings(step.list, entry, itemName, plan?.what).filter((h) => h.label !== 'In short'), ...(rolledWords ? [{ label: 'Rolled', text: rolledWords }] : [])],
        ...(rolledWords ? { rolled: rolledWords } : {}),
      },
    ];
  });
}

/**
 * A kindred's or class's trait as an entry (cs-7, the full sheet's Traits section; ct3-11): what it does, where it's
 * from, and when it starts if later. `packName` is the short name of the pack the kindred or class comes from.
 */
export function traitEntry(trait: Trait, packName = ''): ValueEntry {
  const whose = trait.from === 'kindred' ? 'Your kindred' : 'Your class';
  const headings: EntryHeading[] = [{ label: 'From', text: trait.sourceName ? `${whose}, ${trait.sourceName}` : whose }];
  if (trait.fromLevel !== null && trait.fromLevel > 1) headings.push({ label: 'When', text: `At level ${trait.fromLevel}` });
  if (trait.kind === 'disadvantage') headings.push({ label: 'Kind', text: 'A drawback' });
  return { key: `trait:${trait.key}`, name: trait.name, meta: join(packName, trait.source), lead: trait.noteBlocks ?? trait.note, headings };
}
