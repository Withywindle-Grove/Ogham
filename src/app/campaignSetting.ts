// A campaign's setting rules as the Pack screen and Add item use them: the items to search and the encumbrance
// rules, combined across the stack. Loaded once and kept for the session (docs/health/M3.md, item 13), so the
// add-item search doesn't download every entry each time; the Setting rules screen forgets it when the GM
// changes the rules.
//   Every entry passes the shared option reader once here (optionGate.ts, of-3, of-9, of-10): its fields as the
// campaign's options make them, and a mark (`optionOff`) on those an option switches off, which every list leaves out.
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import { ruleGroupPicksOf } from '../core/campaignSettings.ts';
import type { Db } from '../core/supabase.ts';
import { readChargeRules, type ChargeRules } from '../modules/inventory/charges.ts';
import { combineEncumbrance, type EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import { cameFromEntry, withEntryBlocks } from '../modules/inventory/lineItem.ts';
import { loadCalendarRows, loadCampaignEntries, loadCampaignPacks, loadSeenRev, needsCalendarRows, withCalendarRows, type CampaignEntry, type CampaignPack } from '../modules/library/campaignPacks.ts';
import { fieldsFor, fieldsOff, optionGate, optionSpecOn, entryOptionSpec, requiresOf, specParts, withRequires, type FieldFor } from '../modules/library/optionGate.ts';
import { readOptions, resolveRules } from '../modules/library/options.ts';
import { applyPatches, deltaAt, patchesInPlay, readPatches, type Patch } from '../modules/library/patches.ts';
import { ruleGroupsOf, withExtends, type RuleGroup, type RuleSource } from '../modules/library/ruleGroups.ts';
import { withClassReach } from '../modules/library/raceReach.ts';
import { withRaceOptions } from '../modules/library/raceOptions.ts';
import { resolveStack, stackOrder, type ResolvedEntry } from '../modules/library/stack.ts';
import { titledData } from '../modules/library/sourceTitles.ts';
import { claimDevice, readStoredCampaign, readStoredPacks, storeCampaign, storeCampaignExtras, storePack } from './packCache.ts';

export interface CampaignSetting {
  packs: CampaignPack[];
  /**
   * Every entry after stacking (one per kind and id: the winner): classes, races and options for creation. Each with
   * its fields as the campaign's options make them; one an option switches off is marked `optionOff` (kept, so what a
   * character already has still reads; every list keeps only `entriesInPlay`).
   */
  all: ResolvedEntry[];
  /**
   * Every attached pack's copy of every XP table, not stacked, each with its pack (cs-13, dec-10 X1), as the campaign
   * plays it (its byOption, the patches, `optionOff`, as in `all`): a class reads its own pack's table, else the
   * nearest pack's below it, never the stack's winner (startingXp.ts classXpTable). Absent in fixtures built by
   * hand: read as none.
   */
  xpTables?: ResolvedEntry[];
  /** The rules sets with their optional rules applied, lowest in the stack first. */
  rulesSets: Record<string, unknown>[];
  /** The campaign's items after stacking (one per id: the winner), marked as in `all`. */
  items: ResolvedEntry[];
  encumbrance: EncumbranceRules;
  /** The names of the setting rules that give encumbrance data, top first ("From your setting: …"). */
  encumbranceFrom: string[];
  /** magicItems.charges: whether charges are hidden, the dice per kind, the rechargeable default. */
  charges: ChargeRules;
  /** Item categories' friendly names and order (rulesSets[].itemCategories), by id; higher packs win. */
  itemCategories: Map<string, { name: string; order: number }>;
  /** The item categories the rules sets mark `unencumbering: true` (07): tiny things (sr-9). Absent: none. */
  tinyCategories?: ReadonlySet<string>;
  /** The calendar (07 `calendars`) of the highest pack that has one; null without one. */
  calendar: Record<string, unknown> | null;
  /**
   * The `ruleKey` groups (07: one choice per group, built 2026-11-02), top of the stack first in each: which pack's
   * rule counts for each topic, the GM's pick or the pack on top.
   */
  ruleGroups: RuleGroup[];
  /** The sheet fields (by key) whose option is off (of-9): hidden on every screen, their values kept. */
  fieldsOff?: ReadonlySet<string>;
  /** The sheet fields only some classes or kindreds are asked (cs-3, `forClasses` / `forRaces`), by key; optionGate.ts fieldsOffFor. */
  fieldsFor?: ReadonlyMap<string, FieldFor>;
  /**
   * The attached packs' patches whose choices are in play (of-13, bq3-17): applied to every entry in `all` and
   * `items` already; the Pack applies them again to a carried line's own copy of its item (`lineInPlay`).
   */
  patches: Patch[];
  /** Set when the device's stored copy served offline: when it was saved (see PacksAndEntries.asOf). */
  asOf?: string;
}

/**
 * The words for an option spec's choices ("Bronze"; several: "Bronze, Reed slots"): each choice's `short`, else its
 * name, from the option in the campaign; a choice the campaign doesn't know reads as written.
 */
export function choiceWords(all: readonly { kind: string; packEntryId: string; data: Record<string, unknown> }[], spec: string): string {
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
  return specParts(spec)
    .map((part) => {
      const option = all.find((e) => e.kind === 'option' && e.packEntryId === part.option);
      const choice = (Array.isArray(option?.data.choices) ? option.data.choices : []).filter(isRecord).find((c) => String(c.id ?? '') === (part.choice || 'on'));
      const words = choice ? [choice.short, choice.name].find((w): w is string => typeof w === 'string' && w.trim() !== '') : undefined;
      return words?.trim() || (part.choice ? `${part.option}=${part.choice}` : part.option);
    })
    .join(', ');
}

/**
 * The choice in play for a pack's option (its default when none), by the option's id; undefined when the campaign
 * hasn't it. A pack's own option reads that pack's own choice even when another pack decides its ruleKey group
 * (ruled 2026-11-02): the group's effective choice is `groupChoice`.
 */
export function choiceInPlay(setting: { all: readonly { kind: string; packEntryId: string; packId: string; data: Record<string, unknown> }[]; packs: readonly CampaignPack[] }, optionId: string): string | undefined {
  const option = setting.all.find((e) => e.kind === 'option' && e.packEntryId === optionId);
  if (!option) return undefined;
  // An option that extends another (of-1) has no choice of its own: the base's counts.
  if (typeof option.data.extends === 'string' && option.data.extends.trim()) return undefined;
  const chosen: unknown = setting.packs.find((p) => p.packId === option.packId)?.optionChoices[optionId];
  // A choice an overlay brought (of-1) counts only while that overlay is attached; else the default, as on the Rules row.
  const known = choiceIdsOf(setting.all, option);
  if (typeof chosen === 'string' && (known.size === 0 || known.has(chosen))) return chosen;
  return typeof option.data.default === 'string' ? option.data.default : undefined;
}

/** An option's choice ids, with those of every attached option that extends it (of-1). */
function choiceIdsOf(all: readonly { kind: string; data: Record<string, unknown> }[], option: { packEntryId: string; data: Record<string, unknown> }): Set<string> {
  const ids = (data: Record<string, unknown>) => (Array.isArray(data.choices) ? data.choices : []).flatMap((c: unknown) => (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string' ? [(c as { id: string }).id] : []));
  const extending = all.filter((e) => e.kind === 'option' && typeof e.data.extends === 'string' && e.data.extends.trim() === option.packEntryId);
  return new Set([...ids(option.data), ...extending.flatMap((e) => ids(e.data))]);
}

/**
 * Every option's choice in play, by option id (the default where none was made). An add-on whose parent hasn't the
 * choice it `requires` reads its default, whatever is stored (07; A1, bq3-13).
 */
export function choicesInPlay(setting: { all: readonly { kind: string; packEntryId: string; packId: string; data: Record<string, unknown> }[]; packs: readonly CampaignPack[] }): Record<string, string> {
  const out: Record<string, string> = {};
  const options = setting.all.filter((e) => e.kind === 'option');
  for (const option of options) {
    const chosen = choiceInPlay(setting, option.packEntryId);
    if (chosen !== undefined) out[option.packEntryId] = chosen;
  }
  // Each add-on at its default (its declared one, else its first choice, as readOptions reads it).
  const addOns = readOptions(options.filter((o) => Object.keys(requiresOf(o.data)).length > 0).map((o) => ({ kind: 'option' as const, packEntryId: o.packEntryId, name: o.packEntryId, data: o.data })));
  return { ...withRequires(addOns, out) };
}

/** The rule that counts for a `ruleKey` group (the campaign's effective choice for the topic); null when no attached pack has the key. */
export function groupChoice(setting: Pick<CampaignSetting, 'ruleGroups'>, ruleKey: string): { optionId: string; packId: string; choiceId: string } | null {
  const group = setting.ruleGroups.find((g) => g.ruleKey === ruleKey);
  if (!group) return null;
  return { optionId: group.winner.rule.id, packId: group.winner.source.packId, choiceId: group.winner.choiceId };
}

/**
 * The campaign's entries that exist under its options, for screens that read the entries themselves (the rules
 * browser in a campaign, the GM reference; the options audit's X7). Their fields are left as the pack has them:
 * those screens show the book (X3).
 */
export function campaignEntriesInPlay<T extends CampaignEntry>(entries: readonly T[], packs: readonly CampaignPack[]): T[] {
  const choices = choicesInPlay({ all: entries, packs });
  return entries.filter((e) => e.kind === 'option' || optionSpecOn(entryOptionSpec(e.data), choices));
}

/**
 * A campaign's setting rules from its packs and entries (the calendars already added) and its settings: the pure part
 * of loadCampaignSetting, so tests (and the options audit against the real packs) read a stack the same way.
 */
export function settingFrom(packs: CampaignPack[], entries: CampaignEntry[], settings: Record<string, unknown> | null): CampaignSetting {
  const stacked = resolveStack(entries, packs.map((p) => ({ id: p.id, packId: p.packId, name: p.name, priority: p.priority, kind: p.kind, overrides: p.overrides })));
  const choices = choicesInPlay({ all: stacked, packs });
  // The race as it is in play: its `byOption` for the campaign's choices (cs-5, bq2-1), then its optional abilities when
  // their option is on (07 Races). Then every class's raceMaxLevels merged into the races' classMaxLevels (pg-2), so
  // a choice that lifts a race's limits stays lifted: the one place race limits are read from (classLimits.ts).
  // Every other entry: the shared option reader (of-3): its fields now, and a mark when an option switches it off.
  // Then the attached packs' patches in play (of-13, bq3-17): after the entry's own byOption, on every pack's
  // entries (the winning copy included), each figure changed named for the breakdown; a patch that removes the
  // entry marks it off like an option does, with the choice's words ("Off · Bronze").
  const order = stackOrder(packs);
  const patches = patchesInPlay(readPatches(stacked, order), choices);
  const label = (spec: string) => choiceWords(stacked, spec);
  const inPlayOf = <T extends ResolvedEntry>(entry: T): T => {
    const { inPlay, offBy, data } = optionGate(entry, choices);
    const patched = entry.kind === 'option' || entry.kind === 'patch' ? null : applyPatches({ kind: entry.kind, packEntryId: entry.packEntryId, data }, patches, label);
    const off = inPlay ? (patched?.removedBy ?? '') : offBy;
    if (!off && data === entry.data && (!patched || patched.lines.length === 0)) return entry;
    return {
      ...entry,
      data: patched?.data ?? data,
      ...(off ? { optionOff: off, offLabel: `Off: ${label(off)}` } : {}),
      ...(patched && patched.lines.length > 0 ? { patched: patched.lines } : {}),
    };
  };
  const gated = stacked.map(inPlayOf);
  // Every source names its book, never a code (07 meta.sourceTitles, G-212; retest 4 T6): titled once here, so every
  // screen that prints an entry's source prints the title.
  const titlesOf = new Map(packs.map((p) => [p.packId, p.sourceTitles ?? {}]));
  const resolved = withClassReach(withRaceOptions(gated, choices)).map((entry) => {
    const data = titledData(entry.data, titlesOf.get(entry.packId) ?? {});
    return data === entry.data ? entry : { ...entry, data };
  });
  // One choice per ruleKey group (07): the GM's pick, else the pack on top; each pack then reads its choices in play.
  // An option extending another pack's (of-1) joins its base's choices first, so the group reads every choice.
  const sources: RuleSource[] = withExtends(stackOrder(packs).map((pack) => ({
    packId: pack.packId,
    name: pack.name,
    shortName: pack.shortName,
    kind: pack.kind,
    rules: readOptions(entries.filter((e) => e.kind === 'option' && e.packId === pack.packId)),
    choices: pack.optionChoices,
  })));
  const ruleGroups = ruleGroupsOf(sources, ruleGroupPicksOf(settings ?? {}));
  // Lowest first, so each pack higher in the stack fills in only what it says. Each rules set's `byOption` reads its
  // own pack's choices, whatever the ruleKey groups decide (ruled 2026-11-02), and the default of any option that has
  // no stored choice (one a pack update added: the options audit's X5).
  // A pack's own stored choices for options another pack's entry won in the stack; its options in play are read
  // (checked against their choices, of-1) in `choices` already.
  const ownChoices = (pack: CampaignPack) =>
    Object.fromEntries(Object.entries(pack.optionChoices).filter(([id]) => !stacked.some((e) => e.kind === 'option' && e.packEntryId === id && e.packId === pack.packId)));
  const bottomUp = [...stackOrder(packs)].reverse();
  const sets = bottomUp.flatMap((pack) =>
    resolved.filter((e) => e.kind === 'rulesSet' && e.packId === pack.packId).map((e) => ({ pack, rules: resolveRules(e.data, { ...choices, ...ownChoices(pack) }) })),
  );
  const sections = sets.map(({ pack, rules }) => ({ pack, section: rules.encumbrance }));
  const giving = sections.filter((s) => s.section && typeof s.section === 'object');
  const calendarPack = stackOrder(packs).find((pack) => resolved.some((e) => e.kind === 'calendar' && e.packId === pack.packId));
  const calendar = calendarPack ? (resolved.find((e) => e.kind === 'calendar' && e.packId === calendarPack.packId)?.data ?? null) : null;
  return {
    packs,
    calendar: calendar && typeof calendar === 'object' && !Array.isArray(calendar) ? (calendar as Record<string, unknown>) : null,
    all: resolved,
    // Every pack's copy, as the campaign plays it: its own byOption and the attached packs' patches, as for `all`.
    xpTables: entries.filter((e) => e.kind === 'xpTable').map((e) => inPlayOf({ ...e, alsoIn: [], preferred: false })),
    ruleGroups,
    rulesSets: sets.map((s) => s.rules),
    items: resolved.filter((e) => e.kind === 'item').sort((a, b) => a.name.localeCompare(b.name)),
    encumbrance: combineEncumbrance(giving.map((s) => s.section)),
    encumbranceFrom: [...new Set(giving.map((s) => s.pack.name))].reverse(),
    charges: readChargeRules(sets.map((s) => s.rules)),
    itemCategories: new Map(
      sets.flatMap((s) =>
        Array.isArray(s.rules.itemCategories)
          ? s.rules.itemCategories.flatMap((c: unknown) => {
              const cat = c && typeof c === 'object' ? (c as { id?: unknown; name?: unknown; order?: unknown }) : {};
              return typeof cat.id === 'string' && typeof cat.name === 'string'
                ? [[cat.id, { name: cat.name, order: typeof cat.order === 'number' ? cat.order : 999 }] as const]
                : [];
            })
          : [],
      ),
    ),
    // Higher packs win here too: a category a higher pack lists again without the mark isn't tiny.
    tinyCategories: new Set(
      [
        ...new Map(
          sets.flatMap((s) =>
            Array.isArray(s.rules.itemCategories)
              ? s.rules.itemCategories.flatMap((c: unknown) => {
                  const cat = c && typeof c === 'object' ? (c as { id?: unknown; unencumbering?: unknown }) : {};
                  return typeof cat.id === 'string' ? [[cat.id, cat.unencumbering === true] as const] : [];
                })
              : [],
          ),
        ),
      ].flatMap(([id, tiny]) => (tiny ? [id] : [])),
    ),
    fieldsOff: fieldsOff(resolved, choices),
    fieldsFor: fieldsFor(resolved),
    patches,
  };
}

/** What a carried line's item is now (bq3-17): its details with the patches in play applied, and why it's off. */
export interface LineInPlay {
  /** The line's copy of its item with the patches in play applied (the copy itself is never changed). */
  details: Record<string, unknown>;
  /** Each figure a patch changed ("Damage −1 · Bone, Mire zine"); empty when none did. */
  lines: string[];
  /** "Off · Bronze" when the campaign's choices remove the item (an option, or a patch); null while it's in play. */
  off: string | null;
  /**
   * The patches' deltas on `weapon.damage`, summed (0 for none): a rules set's every-weapon die (of-8) replaces the
   * line's die first, then takes these ("d6" with Bone −1 → "d6−1"; weaponFigures).
   */
  damageDelta?: number;
}

/**
 * A carried line as the campaign's choices make it (of-13, bq3-17 (5)–(7)): the patches in play applied to the
 * line's own copy of its item (matched by its category and the entry id it came from, so the winning copy's
 * patches reach it), and whether the entry is off now (an option's choice, or a patch's `option: null`): the row
 * says "Off · <choice>", and it can't be put on or used. A one-off (no entry) is left as it is.
 *
 * Then the entry's play blocks as the pack has them now (F27, lineItem.ts withEntryBlocks): for a line whose own
 * pack's entry is found, `weapon` and `armour` keys the line's copy hasn't (a mode a pack update added) come from
 * the entry, under the line's own; and the weapon's modes, range, magic bonus and bonus against a foe always come
 * from the entry when it has them (fp-1). The patches are applied to the line's copy first: the entry in `all` is patched
 * already, so its keys aren't patched twice, and their patch lines join the line's.
 */
export function lineInPlay(
  setting: Pick<CampaignSetting, 'patches' | 'all'> | null,
  line: { category: string; details: Record<string, unknown>; sourceEntryId: string | null; sourcePackId?: string | null; revealedFields?: readonly string[] },
): LineInPlay {
  if (!setting || !line.sourceEntryId) return { details: line.details, lines: [], off: null };
  const entry = setting.all.find((e) => e.kind === 'item' && e.packEntryId === line.sourceEntryId);
  const asEntry = { kind: 'item', packEntryId: line.sourceEntryId, data: { ...line.details, category: line.category } };
  const patched = applyPatches(asEntry, setting.patches, (spec) => choiceWords(setting.all, spec));
  const off = entry?.offLabel ?? (patched.removedBy ? `Off: ${choiceWords(setting.all, patched.removedBy)}` : null);
  // The line's own pack's entry (the one it was copied from), when the campaign still has it.
  const own = line.sourcePackId && entry?.packId === line.sourcePackId ? entry : null;
  const current = withEntryBlocks(patched.lines.length > 0 ? patched.data : line.details, own?.data);
  const entryLines = (own?.patched ?? []).filter((l) => cameFromEntry(l.path, current.fromEntry)).map((l) => l.text);
  // A key the entry replaced (fp-1) shows the entry's patch line, not the line's copy's as well.
  const lineLines = patched.lines.filter((l) => !cameFromEntry(l.path, current.fromEntry)).map((l) => l.text);
  return { details: withToldBonus(current.details, line), lines: [...lineLines, ...entryLines], off, damageDelta: deltaAt(asEntry, setting.patches, 'weapon.damage') };
}

/**
 * K22a: a bonus the GM told on this line stays the line's own. A player's copy of an unidentified entry is its face,
 * with no magic bonus in its blocks, so fp-1's "read from the current entry" would drop the told one; it comes back
 * from the line. Untold, nothing changes: the face has none to bring back, and the GM's entry brings back the truth.
 */
function withToldBonus(details: Record<string, unknown>, line: { details: Record<string, unknown>; revealedFields?: readonly string[] }): Record<string, unknown> {
  if (!line.revealedFields?.includes('bonus')) return details;
  let out = details;
  for (const block of ['weapon', 'armour'] as const) {
    const told = line.details[block];
    if (!told || typeof told !== 'object' || Array.isArray(told)) continue;
    const keep = Object.fromEntries(Object.entries(told).filter(([key]) => key === 'magicBonus' || key === 'bonusVs'));
    const now = out[block];
    if (Object.keys(keep).length === 0 || !now || typeof now !== 'object' || Array.isArray(now)) continue;
    out = { ...out, [block]: { ...now, ...keep } };
  }
  return out;
}

const kept = new Map<string, Promise<CampaignSetting | null>>();

/** The campaign's packs and every entry this person may read, as the database gives them. */
export interface PacksAndEntries {
  packs: CampaignPack[];
  entries: CampaignEntry[];
  /**
   * Set when the device's stored copy served because the stamp check couldn't reach the database (offline): when
   * that copy was saved (ISO). The screens where the rules are read say "Setting rules as of <date>, offline"
   * (ruled 2026-11-07, ⚑ 4 B); absent once a fresh check succeeds.
   */
  asOf?: string;
}

const keptRows = new Map<string, Promise<PacksAndEntries | null>>();

/** Entries in the order one read of them all would give (by row id), whichever copies they came from. */
const byEntryId = (a: CampaignEntry, b: CampaignEntry) => ((a.entryId ?? '') < (b.entryId ?? '') ? -1 : (a.entryId ?? '') > (b.entryId ?? '') ? 1 : 0);

/**
 * The campaign's packs and entries as this person may read them, read through the device's store (perf fix 2b,
 * docs/plans/perf-pack-cache.md). The packs list (with each pack's content stamp) and the campaign's seen stamp are
 * read fresh, as today; each pack's entries come from the device when its stored copy carries the same stamps, and
 * only the packs whose stamp moved are downloaded, then stored exactly as received. Nothing is worked out or copied
 * from anyone else's copy: the store holds what this person's own queries returned, under their user id, and the
 * database still decides what those queries return (row-level security; hard rule 5). When the stamp check itself
 * fails (offline) and a stored copy exists, it serves, marked `asOf`; without one, null as before.
 */
async function readThroughStore(db: Db, userId: string, campaignId: string): Promise<PacksAndEntries | null> {
  await claimDevice(userId);
  // The database library answers a failed request with an error, not a throw; a throw (a stand-in, a bug) counts the same.
  const [packs, seenRev] = await Promise.all([loadCampaignPacks(db, campaignId), loadSeenRev(db, campaignId)]).catch(() => [null, null] as const);
  if (!packs || seenRev === null) {
    // A failed stamp check isn't "changed": the stored copy stays, and serves while the database can't be reached.
    const [campaign, copies] = await Promise.all([readStoredCampaign(userId, campaignId), readStoredPacks(userId, campaignId)]);
    if (!campaign || campaign.packs.some((pack) => !copies.some((copy) => copy.packId === pack.packId))) return null;
    const entries = campaign.packs.flatMap((pack) => copies.find((copy) => copy.packId === pack.packId)?.entries ?? []).sort(byEntryId);
    return { packs: campaign.packs, entries, asOf: campaign.savedAt };
  }
  const copies = await readStoredPacks(userId, campaignId);
  const current = (pack: CampaignPack) => copies.find((copy) => copy.packId === pack.packId && copy.contentRev === (pack.contentRev ?? 0) && copy.seenRev === seenRev);
  const stale = packs.filter((pack) => !current(pack)).map((pack) => pack.packId);
  const downloaded = stale.length > 0 ? await loadCampaignEntries(db, campaignId, stale) : [];
  if (!downloaded) return null;
  const savedAt = new Date().toISOString();
  // Stored as received, by pack, under the stamps read before the download (a change in between moves a stamp, so
  // the copy is downloaded again next time: never kept wrongly).
  for (const packId of stale) {
    const pack = packs.find((p) => p.packId === packId)!;
    void storePack({ userId, campaignId, packId, contentRev: pack.contentRev ?? 0, seenRev, savedAt, entries: downloaded.filter((e) => e.packId === packId) });
  }
  void storeCampaign({ userId, campaignId, packs, seenRev, savedAt });
  const entries = [...packs.flatMap((pack) => current(pack)?.entries ?? []), ...downloaded].sort(byEntryId);
  return { packs, entries };
}

/**
 * The campaign's packs and entries as this person may read them, downloaded once and kept with the setting rules
 * (perf report 2026-11-06, fix 2a): the Setting rules, Rules and GM reference screens reuse what creation and the
 * Pack screen already downloaded, instead of fetching every entry again. Under the same access rules; kept per
 * person and campaign, and forgotten with the setting rules (`forgetCampaignSetting`), after which the next read
 * goes through the device's store again (fix 2b: a stamp check, then only what moved). Each call gets its own lists,
 * so a screen sorting or filtering them can't change another's.
 */
export async function loadCampaignPacksAndEntries(db: Db, userId: string | null, campaignId: string): Promise<PacksAndEntries | null> {
  // Outside a campaign's screens nobody is named to keep them for (or to store them under): read them afresh.
  if (userId === null) {
    return Promise.all([loadCampaignPacks(db, campaignId), loadCampaignEntries(db, campaignId)]).then(([packs, entries]) => (packs && entries ? { packs, entries } : null));
  }
  const key = `${userId}:${campaignId}`;
  let loading = keptRows.get(key);
  if (!loading) {
    loading = readThroughStore(db, userId, campaignId);
    // A failed load isn't kept, so the next visit tries again.
    keptRows.set(key, loading);
    const mine = loading;
    loading.then(
      (value) => value === null && keptRows.get(key) === mine && keptRows.delete(key),
      () => keptRows.get(key) === mine && keptRows.delete(key),
    );
  }
  const rows = await loading;
  return rows && { packs: [...rows.packs], entries: [...rows.entries], ...(rows.asOf ? { asOf: rows.asOf } : {}) };
}

/** The words for a stored copy serving offline (ruled 2026-11-07, ⚑ 4 B): "Setting rules as of 7 Nov, offline". */
export function asOfWords(asOf: string): string {
  return `Setting rules as of ${new Date(asOf).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, offline`;
}

export function loadCampaignSetting(db: Db, userId: string, campaignId: string): Promise<CampaignSetting | null> {
  const key = `${userId}:${campaignId}`;
  const known = kept.get(key);
  if (known) return known;
  const loading = Promise.all([loadCampaignPacksAndEntries(db, userId, campaignId), loadCampaignSettings(db, campaignId)]).then(async ([rows, settings]) => {
    if (!rows) return null;
    if (rows.asOf) {
      // Offline on a stored copy: its settings and calendar rows, as the last online start left them.
      const stored = await readStoredCampaign(userId, campaignId);
      if (!stored || (needsCalendarRows(rows.packs, rows.entries) && !stored.calendarRows)) return null;
      const withCalendars = withCalendarRows(rows.packs, rows.entries, stored.calendarRows ?? []);
      return { ...settingFrom(withCalendars.packs, withCalendars.entries, settings ?? stored.settings), asOf: rows.asOf };
    }
    const calendarRows = needsCalendarRows(rows.packs, rows.entries) ? await loadCalendarRows(db, campaignId) : [];
    if (!calendarRows) return null;
    void storeCampaignExtras(userId, campaignId, { settings: settings ?? null, calendarRows });
    const withCalendars = withCalendarRows(rows.packs, rows.entries, calendarRows);
    return settingFrom(withCalendars.packs, withCalendars.entries, settings ?? null);
  });
  // A failed load isn't kept, so the next visit tries again.
  kept.set(key, loading);
  loading.then((value) => value === null && kept.delete(key), () => kept.delete(key));
  return loading;
}

/** Forget a campaign's setting rules (after the GM changes them), for everyone signed in on this device; all of them without one. */
export function forgetCampaignSetting(campaignId?: string): void {
  for (const map of [kept, keptRows]) {
    for (const key of [...map.keys()]) if (campaignId === undefined || key.endsWith(`:${campaignId}`)) map.delete(key);
  }
}
