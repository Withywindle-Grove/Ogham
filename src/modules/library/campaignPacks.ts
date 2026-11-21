// Setting rules attached to a campaign (docs/07-content-packs.md, docs/04-data-model.md CampaignPack): the GM
// attaches packs from their own library, with optional-rule choices (starting at their defaults); players read
// the player-facing parts. They stack in one order (homebrew on top by default) with the GM's per-entry
// exceptions, and each campaign can have its own homebrew pack. Every change here is logged in the campaign.
import { readSourceTitles, type SourceTitles } from './sourceTitles.ts';
import { readStatBlockLayout, type StatBlockLayout } from './statBlockLayout.ts';
import { defineCommand, failed, fromWrite, isGm, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { withHiddenFields } from './library.ts';
import { encumbranceModeOf, ruleGroupPicksOf, withRuleGroupPick, type EncumbranceMode } from '../../core/campaignSettings.ts';
import { defaultChoices, readOptions, type Choices } from './options.ts';
import type { EntryKind, PackEntry, PackKind } from './packFile.ts';
import { ruleGroupsOf, withExtends, type RuleSource } from './ruleGroups.ts';
import { moveInStack, placeNewPack, stackOrder, type PriorityChange, type StackPack } from './stack.ts';
import { packRefId } from './packMeta.ts';

export interface CampaignPack {
  /** The link between the campaign and the pack. */
  id: string;
  campaignId: string;
  packId: string;
  name: string;
  /** The pack's short name for popups (meta.shortName), or its name. */
  shortName: string;
  /** The pack's own `meta.id`, which another pack's pinned copy names (sn-1b, `pinnedFrom`); absent without one. */
  metaId?: string;
  /** The id other packs' "<meta.id>:<id>" links name it by: its `meta.id`, else its short name's slug (packMeta.ts; December 5a). */
  refId?: string | null;
  version: string;
  kind: PackKind;
  optionChoices: Choices;
  priority: number;
  /**
   * The GM's exceptions: entries ("kind:id" → name) this pack wins whatever the order. The GM gets them all; a
   * player only those for entries they can read (ruled 2026-10-29, A4: the exceptions themselves are the GM's).
   */
  overrides: Record<string, string>;
  /** The campaign's own homebrew pack (never in anyone's library). */
  campaignHomebrew: boolean;
  /**
   * The pack's content stamp (`packs.content_rev`, perf fix 2b): a whole number the database bumps whenever the pack's
   * entries or hidden fields change. The on-device copy of the pack's entries is used only while it matches. Absent
   * in fixtures built by hand (tests): read as 0.
   */
  contentRev?: number;
  /** The pack's sources map (07 `meta.sourceTitles`, G-212): code → the book's own title; absent or {} without one. */
  sourceTitles?: SourceTitles;
  /** How the pack lays out its stat blocks (07 `meta.statBlockLayout`, pf-13); absent or null without one. */
  statBlockLayout?: StatBlockLayout | null;
}

/** An entry in the campaign's setting rules; `entryId` is its row (an item line points back to it). */
export type CampaignEntry = PackEntry & { packId: string; entryId?: string };

const asStrings = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
    : {};
const asChoices = (value: unknown): Choices => asStrings(value);

/**
 * The GM's exceptions, by link (ruled 2026-10-29, A4): kept where only the GM reads them; the database gives a
 * player only those for entries the player can read, so their device picks the same winning version.
 */
async function loadExceptions(db: Db, campaignId: string): Promise<Map<string, Record<string, string>> | null> {
  const { data, error } = await db.rpc('campaign_exceptions', { campaign: campaignId });
  if (error || !data) return null;
  return new Map(data.map((row) => [row.id, asStrings(row.overrides)]));
}

/** A pack's own `meta.id` (kept with its other meta), as `{ metaId }`, or nothing without one (sn-1b). */
const metaIdOf = (meta: unknown): { metaId?: string } => {
  const value = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as { id?: unknown }).id : null;
  return typeof value === 'string' && value.trim() ? { metaId: value.trim() } : {};
};

/** A pack's optional short name (meta.shortName, kept with its other meta), for popups. */
const shortNameOf = (meta: unknown): string | null => {
  const value = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as { shortName?: unknown }).shortName : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/** The setting rules attached to a campaign, top of the stack first. Null if they couldn't be loaded. */
export async function loadCampaignPacks(db: Db, campaignId: string): Promise<CampaignPack[] | null> {
  const [{ data, error }, secrets] = await Promise.all([
    db
      .from('campaign_packs')
      .select('id, campaign_id, pack_id, option_choices, priority, packs(name, version, kind, campaign_id, extra_meta, content_rev)')
      .eq('campaign_id', campaignId),
    loadExceptions(db, campaignId),
  ]);
  if (error || !secrets) return null;
  return stackOrder(
    data.map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      packId: row.pack_id,
      name: row.packs?.name ?? 'Setting rules',
      shortName: shortNameOf(row.packs?.extra_meta) ?? row.packs?.name ?? 'Setting rules',
      ...metaIdOf(row.packs?.extra_meta),
      refId: packRefId(row.packs?.extra_meta, row.packs?.name ?? ''),
      sourceTitles: readSourceTitles(row.packs?.extra_meta),
      statBlockLayout: readStatBlockLayout(row.packs?.extra_meta),
      version: row.packs?.version ?? '',
      kind: (row.packs?.kind ?? 'setting') as PackKind,
      optionChoices: asChoices(row.option_choices),
      priority: row.priority,
      overrides: secrets.get(row.id) ?? {},
      campaignHomebrew: row.packs?.campaign_id === row.campaign_id,
      contentRev: typeof row.packs?.content_rev === 'number' ? row.packs.content_rev : 0,
    })),
  );
}

/**
 * The campaign's seen stamp (`campaign_rules_revs.seen_rev`, perf fix 2b): bumped by the database when what a member
 * may read changes without any pack changing (an item revealed, a pack attached, detached, moved or its options
 * changed, an exception changed). A campaign with no row yet is at 0. Null when it couldn't be read.
 */
export async function loadSeenRev(db: Db, campaignId: string): Promise<number | null> {
  const { data, error } = await db.from('campaign_rules_revs').select('seen_rev').eq('campaign_id', campaignId).maybeSingle();
  if (error) return null;
  return data?.seen_rev ?? 0;
}

/** How many entries one request for the campaign's library asks for (the database sends at most 1,000). */
export const LIBRARY_PAGE = 1000;
type LibraryRow = { id: string; pack_id: string; kind: string; pack_entry_id: string; name: string; data: Json };

/**
 * Every entry of the campaign's setting rules this person may see in THIS campaign (players: the player-facing kinds
 * only, and an item only when this campaign has opened it). With `packIds`, only those packs' entries (the on-device
 * cache downloads just the packs whose stamp moved); without, every attached pack's.
 * Asked of the database by campaign (`campaign_library`; ruled hd-2, 2026-11-11): a pack's entries carry no campaign,
 * so a plain read of them can't keep one campaign's reveal out of another campaign on the same pack.
 */
export async function loadCampaignEntries(db: Db, campaignId: string, packIds?: readonly string[]): Promise<CampaignEntry[] | null> {
  let ids = packIds ? [...packIds] : null;
  if (!ids) {
    const links = await db.from('campaign_packs').select('pack_id').eq('campaign_id', campaignId);
    if (links.error) return null;
    ids = links.data.map((link) => link.pack_id);
  }
  if (ids.length === 0) return [];
  const wanted = ids;
  // A page at a time by key (the last id received), not by offset: each page costs the database the same.
  const data: LibraryRow[] = [];
  for (let after: string | null = null; ; ) {
    const page: { data: LibraryRow[] | null; error: unknown } = await db.rpc('campaign_library', {
      campaign: campaignId,
      packs: wanted,
      page_size: LIBRARY_PAGE,
      ...(after ? { after_id: after } : {}),
    });
    if (page.error || !page.data) return null;
    data.push(...page.data);
    if (page.data.length < LIBRARY_PAGE) break;
    after = page.data[page.data.length - 1]!.id;
  }
  // The GM gets items' hidden fields back; players never receive them.
  const whole = await withHiddenFields(db, wanted, data.map((row) => ({ ...row, data: (row.data ?? {}) as Record<string, unknown> })));
  if (!whole) return null;
  return whole.map((row) => ({
    entryId: row.id,
    packId: row.pack_id,
    kind: row.kind as EntryKind,
    packEntryId: row.pack_entry_id,
    name: row.name,
    data: row.data,
  }));
}

/**
 * Players see the date and season (ruled 2026-10-30; 05 S17-11): a player's device doesn't read calendars with the
 * rest of the setting rules, so it asks the database for the part of them players may see (their GM-only fields
 * never come back), and for which pack's calendar the GM's exception prefers, so stacking picks the same one as the
 * GM's device. The GM already has them. Null when it couldn't be read.
 */
export async function addCampaignCalendars(
  db: Db,
  campaignId: string,
  packs: CampaignPack[],
  entries: CampaignEntry[],
): Promise<{ packs: CampaignPack[]; entries: CampaignEntry[] } | null> {
  if (!needsCalendarRows(packs, entries)) return { packs, entries };
  const rows = await loadCalendarRows(db, campaignId);
  if (!rows) return null;
  return withCalendarRows(packs, entries, rows);
}

/** A player's calendar row as the database sends it (`campaign_calendars`); the device cache stores them as received. */
export interface CalendarRow {
  id: string;
  pack_id: string;
  pack_entry_id: string;
  name: string;
  data: unknown;
  preferred: boolean;
}

/** Whether the calendars need asking for: the GM's entries already have them; no packs, nothing to ask. */
export function needsCalendarRows(packs: readonly CampaignPack[], entries: readonly CampaignEntry[]): boolean {
  return !entries.some((e) => e.kind === 'calendar') && packs.length > 0;
}

/** The calendar rows the database lets this person see, as sent. Null when they couldn't be read. */
export async function loadCalendarRows(db: Db, campaignId: string): Promise<CalendarRow[] | null> {
  const { data, error } = await db.rpc('campaign_calendars', { campaign: campaignId });
  if (error) return null;
  return data ?? [];
}

/** The calendar rows joined to the packs and entries (the pure half of addCampaignCalendars). */
export function withCalendarRows(packs: CampaignPack[], entries: CampaignEntry[], rows: readonly CalendarRow[]): { packs: CampaignPack[]; entries: CampaignEntry[] } {
  if (rows.length === 0) return { packs, entries };
  const calendars: CampaignEntry[] = rows.map((row) => ({
    entryId: row.id,
    packId: row.pack_id,
    kind: 'calendar',
    packEntryId: row.pack_entry_id,
    name: row.name,
    data: row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {},
  }));
  const preferred = rows.filter((row) => row.preferred);
  return {
    packs: packs.map((pack) => {
      const mine = preferred.filter((row) => row.pack_id === pack.packId);
      return mine.length === 0 ? pack : { ...pack, overrides: { ...pack.overrides, ...Object.fromEntries(mine.map((row) => [`calendar:${row.pack_entry_id}`, row.name])) } };
    }),
    entries: [...entries, ...calendars],
  };
}

/** The campaign's stack as the stacking rules need it, or a plain message. */
async function loadStack(db: Db, campaignId: string): Promise<StackPack[] | string> {
  const [{ data, error }, secrets] = await Promise.all([
    db.from('campaign_packs').select('id, pack_id, priority, pack_name, packs(kind)').eq('campaign_id', campaignId),
    loadExceptions(db, campaignId),
  ]);
  if (error || !secrets) return "Couldn't read this campaign's setting rules. Try again.";
  return data.map((row) => ({
    id: row.id,
    packId: row.pack_id,
    name: row.pack_name,
    priority: row.priority,
    kind: (row.packs?.kind ?? 'setting') as PackKind,
    overrides: secrets.get(row.id) ?? {},
  }));
}

/** Writes new priorities one link at a time, in the order given (the log line leads with the first). */
async function writePriorities(db: Db, changes: PriorityChange[]): Promise<CommandResult<null>> {
  for (const change of changes) {
    const written = fromWrite(await db.from('campaign_packs').update({ priority: change.priority }).eq('id', change.id).select('id'));
    if (!written.ok) return written;
  }
  return ok(null);
}

/**
 * The campaign's optional rules by pack, top of the stack first, with each pack's own choices: what the `ruleKey`
 * groups are worked out from (07: one choice per group). Null when they couldn't be read.
 */
async function loadRuleSources(db: Db, campaignId: string): Promise<RuleSource[] | null> {
  const links = await db.from('campaign_packs').select('id, pack_id, priority, pack_name, option_choices, packs(kind, extra_meta)').eq('campaign_id', campaignId);
  if (links.error) return null;
  const ids = links.data.map((row) => row.pack_id);
  const options = ids.length > 0 ? await db.from('library_entries').select('pack_id, kind, pack_entry_id, name, data').in('pack_id', ids).eq('kind', 'option') : { data: [], error: null };
  if (options.error) return null;
  const ordered = stackOrder(links.data.map((row) => ({ row, packId: row.pack_id, priority: row.priority, kind: (row.packs?.kind ?? 'setting') as PackKind })));
  return withExtends(ordered.map(({ row, kind }) => ({
    packId: row.pack_id,
    name: row.pack_name,
    shortName: shortNameOf(row.packs?.extra_meta) ?? row.pack_name,
    kind,
    rules: readOptions(
      options.data
        .filter((o) => o.pack_id === row.pack_id)
        .map((o) => ({ kind: 'option' as const, packEntryId: o.pack_entry_id, name: o.name, data: (o.data ?? {}) as Record<string, unknown> })),
    ),
    choices: asChoices(row.option_choices),
  })));
}

/** The campaign's settings as stored (an object), or null when they couldn't be read. */
async function loadSettings(db: Db, campaignId: string): Promise<Record<string, unknown> | null> {
  const found = await db.from('campaigns').select('settings').eq('id', campaignId).maybeSingle();
  if (found.error) return null;
  const value = found.data?.settings;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A topic a newly attached pack brings a rival rule for ("New choice for <topic>", 07). */
export interface NewChoice {
  ruleKey: string;
  topic: string;
}

/**
 * After attaching a pack (07, `ruleKey`): for every group the new pack joins, the choice in use stays as it was,
 * pinned as the GM's pick when there was none, so the new rule changes nothing until the GM confirms it. Returns
 * the topics with a new choice to offer. A failed read returns none (the attach itself is done).
 */
async function keepChoicesOnAttach(db: Db, campaignId: string, packId: string): Promise<NewChoice[]> {
  const [sources, settings] = await Promise.all([loadRuleSources(db, campaignId), loadSettings(db, campaignId)]);
  if (!sources || !settings) return [];
  const picks = ruleGroupPicksOf(settings);
  const without = sources.filter((s) => s.packId !== packId);
  const before = ruleGroupsOf(without, picks);
  const joined = ruleGroupsOf(sources, picks).filter((g) => g.offers.length > 1 && g.offers.some((o) => o.source.packId === packId));
  let next = settings;
  for (const group of joined) {
    const standing = before.find((g) => g.ruleKey === group.ruleKey);
    if (standing && !group.picked) next = withRuleGroupPick(next, group.ruleKey, standing.winner.source.packId);
  }
  if (next !== settings) await db.from('campaigns').update({ settings: next as Json }).eq('id', campaignId);
  return joined.map((g) => ({ ruleKey: g.ruleKey, topic: g.topic }));
}

/** The GM attaches setting rules from their own library; optional rules start at their defaults unless given. */
export const attachPack = defineCommand({
  name: 'rules.attach',
  target: (input: { campaignId: string; packId: string; optionChoices?: Choices }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<{ id: string; newChoices: NewChoice[] }>> => {
    let choices = input.optionChoices;
    if (!choices) {
      const options = await db.from('library_entries').select('kind, pack_entry_id, name, data').eq('pack_id', input.packId).eq('kind', 'option');
      if (options.error) return failed("Couldn't read the optional rules. Try again.");
      choices = defaultChoices(
        readOptions(options.data.map((o) => ({ kind: 'option' as const, packEntryId: o.pack_entry_id, name: o.name, data: (o.data ?? {}) as Record<string, unknown> }))),
      );
    }
    const [stack, pack] = await Promise.all([loadStack(db, input.campaignId), db.from('packs').select('kind').eq('id', input.packId).maybeSingle()]);
    if (typeof stack === 'string') return failed(stack);
    // New rules go on top, under any homebrew at the top. Added first, so the log line names them.
    const { priority, shift } = placeNewPack(stack, (pack.data?.kind ?? 'setting') as PackKind);
    const result = await db
      .from('campaign_packs')
      .insert({ campaign_id: input.campaignId, pack_id: input.packId, option_choices: choices as Json, priority })
      .select('id');
    if (result.error?.code === '23505') return failed('Those setting rules are already in this campaign.');
    const saved = fromWrite(result);
    if (!saved.ok) return saved;
    const shifted = await writePriorities(db, shift);
    if (!shifted.ok) return shifted;
    return ok({ id: saved.value.id, newChoices: await keepChoicesOnAttach(db, input.campaignId, input.packId) });
  },
});

/** The GM changes the optional-rule choices of attached setting rules. */
/**
 * The GM changes optional rules: one pack's choices (`campaignPackId`), and in the same logged change any other packs'
 * a change moves too (`others`: an add-on its parent hides goes back to its default, A1; a preset, A8) and the
 * campaign's load method when the change moves the setting's (`encumbranceMode`, A3, bq3-13). Undo is the same command
 * with what each had before.
 */
export const setPackOptions = defineCommand({
  name: 'rules.setOptions',
  target: (input: {
    campaignId: string;
    campaignPackId: string;
    optionChoices: Choices;
    others?: readonly { campaignPackId: string; optionChoices: Choices }[];
    encumbranceMode?: EncumbranceMode;
  }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<{ id: string }>> => {
    const first = fromWrite(await db.from('campaign_packs').update({ option_choices: input.optionChoices as Json }).eq('id', input.campaignPackId).select('id'));
    if (!first.ok) return first;
    for (const other of input.others ?? []) {
      if (other.campaignPackId === input.campaignPackId) continue;
      const saved = fromWrite(await db.from('campaign_packs').update({ option_choices: other.optionChoices as Json }).eq('id', other.campaignPackId).select('id'));
      if (!saved.ok) return saved;
    }
    if (input.encumbranceMode === undefined) return first;
    const settings = await loadSettings(db, input.campaignId);
    if (!settings) return failed("Couldn't read the campaign's settings to change its load method. Try again.");
    if (encumbranceModeOf(settings) === input.encumbranceMode) return first;
    const encumbrance = settings.encumbrance && typeof settings.encumbrance === 'object' && !Array.isArray(settings.encumbrance) ? settings.encumbrance : {};
    const next = { ...settings, encumbrance: { ...encumbrance, mode: input.encumbranceMode } };
    const moved = fromWrite(await db.from('campaigns').update({ settings: next as Json }).eq('id', input.campaignId).select('id'));
    return moved.ok ? first : moved;
  },
});

/** The GM detaches setting rules from the campaign (they stay in the library). The campaign's homebrew stays. */
export const detachPack = defineCommand({
  name: 'rules.detach',
  target: (input: { campaignId: string; campaignPackId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<{ id: string }>> => {
    const link = await db.from('campaign_packs').select('pack_id').eq('id', input.campaignPackId).maybeSingle();
    // The campaign's own homebrew goes like any other (ruled 2026-10-24); saving homebrew again brings it back.
    const removed = fromWrite(await db.from('campaign_packs').delete().eq('id', input.campaignPackId).select('id'));
    if (!removed.ok || !link.data) return removed;
    // A ruleKey group this pack decided falls back to the next pack's choice (07), in the same logged change.
    const settings = await loadSettings(db, input.campaignId);
    if (!settings) return removed;
    const gone = link.data.pack_id;
    const lost = Object.entries(ruleGroupPicksOf(settings)).filter(([, packId]) => packId === gone);
    if (lost.length === 0) return removed;
    const next = lost.reduce((acc, [ruleKey]) => withRuleGroupPick(acc, ruleKey, null), settings);
    const fallen = fromWrite(await db.from('campaigns').update({ settings: next as Json }).eq('id', input.campaignId).select('id'));
    return fallen.ok ? removed : fallen;
  },
});

/** The GM moves setting rules one place up or down the stack (higher ones win when two have the same entry). */
export const moveSettingRules = defineCommand({
  name: 'rules.reorder',
  target: (input: { campaignId: string; campaignPackId: string; direction: 'up' | 'down' }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const stack = await loadStack(db, input.campaignId);
    if (typeof stack === 'string') return failed(stack);
    return writePriorities(db, moveInStack(stack, input.campaignPackId, input.direction));
  },
});

/**
 * The GM's exception for one entry: these setting rules' version wins whatever the order (campaignPackId), or
 * back to the order (null). The entry's name is kept with it, so the log can say which entry. Every exception is
 * kept where only the GM reads it (ruled 2026-10-29, A4).
 */
export const preferEntry = defineCommand({
  name: 'rules.prefer',
  target: (input: { campaignId: string; key: string; name: string; campaignPackId: string | null }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const stack = await loadStack(db, input.campaignId);
    if (typeof stack === 'string') return failed(stack);
    // The chosen pack first, so the log line leads with it.
    const ordered = [...stack].sort((a, b) => Number(b.id === input.campaignPackId) - Number(a.id === input.campaignPackId));
    for (const link of ordered) {
      const kept = link.overrides;
      const others = Object.fromEntries(Object.entries(kept).filter(([key]) => key !== input.key));
      const next = link.id === input.campaignPackId ? { ...others, [input.key]: input.name } : others;
      if (JSON.stringify(next) === JSON.stringify(kept)) continue;
      const written = fromWrite(await db.from('campaign_pack_secrets').update({ overrides: next }).eq('id', link.id).select('id'));
      if (!written.ok) return written;
    }
    return ok(null);
  },
});

/**
 * The campaign's own homebrew pack (one-off items, custom foes, anything made in the editor): made the first
 * time it's needed, on top of the stack. Returns its pack id; if it already exists, that one.
 */
export const startHomebrew = defineCommand({
  name: 'rules.homebrew',
  target: (input: { campaignId: string; campaignName: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, user, input): Promise<CommandResult<string>> => {
    const found = await db.from('packs').select('id').eq('campaign_id', input.campaignId).maybeSingle();
    if (found.error) return failed("Couldn't check for this campaign's homebrew. Try again.");
    let packId = found.data?.id;
    if (!packId) {
      const made = fromWrite(
        await db
          .from('packs')
          .insert({ owner_user_id: user.id, campaign_id: input.campaignId, name: `${input.campaignName} homebrew`, kind: 'homebrew', format_version: 2 })
          .select('id'),
      );
      if (!made.ok) return made;
      packId = made.value.id;
    }
    const linked = await db.from('campaign_packs').select('id').eq('campaign_id', input.campaignId).eq('pack_id', packId).maybeSingle();
    if (linked.error) return failed("Couldn't check for this campaign's homebrew. Try again.");
    if (linked.data) return ok(packId);
    const stack = await loadStack(db, input.campaignId);
    if (typeof stack === 'string') return failed(stack);
    const { priority } = placeNewPack(stack, 'homebrew');
    const attached = fromWrite(await db.from('campaign_packs').insert({ campaign_id: input.campaignId, pack_id: packId, priority }).select('id'));
    return attached.ok ? ok(packId) : attached;
  },
});
