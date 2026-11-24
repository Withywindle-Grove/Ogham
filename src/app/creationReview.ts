// The creation review's words (M5b step 0c, slice 7; cr-18; mockup creation/09): what each section says, and the
// first step whose check fails when the player taps Send to the GM (cr-2: "the last step re-runs every check and
// lands on the first failing step"). Pure: the review screen (CreationReview.tsx) and CreateCharacter supply the data.
import { SPECIAL_NOTE } from '../modules/characters/creationSteps.ts';
import { entryMoneyOf, showMoney, type Coin } from '../modules/characters/startingGear.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface ReviewLine {
  text: string;
  strong?: boolean;
  why?: string;
}

/** One step's check, in the order walked: its id and what its Next would say (null: fine). */
export interface StepCheck {
  step: string;
  problem: string | null;
}

/** The first step whose check fails, with its message; null when every step passes. */
export function firstProblem(checks: readonly StepCheck[]): { step: string; message: string } | null {
  for (const check of checks) if (check.problem) return { step: check.step, message: check.problem };
  return null;
}

/**
 * The scores left at the average, never touched (final drafts A5): the record's `scoresAverage`, kept to the scores it
 * has. Empty when every score was rolled, or the record predates the list.
 */
export function notRolledScores(creation: unknown): string[] {
  const record = isRecord(creation) ? creation : {};
  const scores = isRecord(record.scores) ? record.scores : {};
  return Array.isArray(record.scoresAverage) ? record.scoresAverage.filter((k): k is string => typeof k === 'string' && scores[k] !== undefined) : [];
}

/**
 * The scores a roll changed (the kindred, a trade), each with its roll: the GM's card marks them and the review says
 * "(rolled N)". A score left at the average is no roll, whatever the kindred did to it (caf-7, finding 9).
 */
export function changedRolls(creation: unknown): { key: string; rolled: unknown }[] {
  const record = isRecord(creation) ? creation : {};
  const scores = isRecord(record.scores) ? record.scores : {};
  const rolled = isRecord(record.rolled) ? record.rolled : {};
  const notRolled = new Set(notRolledScores(creation));
  return Object.keys(scores)
    .filter((key) => !notRolled.has(key) && rolled[key] !== undefined && rolled[key] !== scores[key])
    .map((key) => ({ key, rolled: rolled[key] }));
}

/** "STR 14 (rolled 13), WIT 9": the scores once, each changed one with its roll; a score not rolled carries none (caf-7). */
export function scoresLine(creation: unknown, label: (key: string) => string): string {
  const record = isRecord(creation) ? creation : {};
  const scores = isRecord(record.scores) ? record.scores : {};
  const changed = new Map(changedRolls(creation).map((c) => [c.key, c.rolled]));
  return Object.keys(scores)
    .map((key) => `${label(key)} ${String(scores[key])}${changed.has(key) ? ` (rolled ${String(changed.get(key))})` : ''}`)
    .join(', ');
}

/**
 * The review's last card (final drafts D, mockup creation/final/07): every exception the GM must approve specially,
 * under "1 thing needs the GM's special approval" with the sign; each its name over the pack's reason. Null with none.
 */
export function exceptionsPart(creation: unknown): { id: string; title: string; warn: true; lines: ReviewLine[] } | null {
  const record = isRecord(creation) ? creation : {};
  const list = Array.isArray(record.specialApprovals) ? record.specialApprovals.filter(isRecord) : [];
  if (list.length === 0) return null;
  return {
    id: 'exceptions',
    title: `${list.length} ${list.length === 1 ? 'thing needs' : 'things need'} the GM's special approval`,
    warn: true,
    lines: list.map((s) => ({ text: String(s.name ?? s.entryId ?? ''), sub: String(s.requirement ?? '') })),
  };
}

/** The exceptions on a creation record (the flagged picks, ruled 2026-11-02), for the GM's card (final drafts D). */
export function exceptionsOf(creation: unknown): { step: string; entryId: string; name: string; requirement: string }[] {
  const record = isRecord(creation) ? creation : {};
  const list = Array.isArray(record.specialApprovals) ? record.specialApprovals.filter(isRecord) : [];
  return list.map((s) => ({ step: String(s.step ?? ''), entryId: String(s.entryId ?? ''), name: String(s.name ?? s.entryId ?? ''), requirement: String(s.requirement ?? '') }));
}

/** The creation record without one exception (Take it off on the GM's card): the rest as they were. */
export function withoutException(creation: unknown, e: { step: string; entryId: string }): Record<string, unknown> {
  const record = isRecord(creation) ? { ...creation } : {};
  const list = Array.isArray(record.specialApprovals) ? record.specialApprovals.filter(isRecord) : [];
  const left = list.filter((s) => !(String(s.step ?? '') === e.step && String(s.entryId ?? '') === e.entryId));
  if (left.length > 0) record.specialApprovals = left;
  else delete record.specialApprovals;
  return record;
}

/** A count in words for "All six" (caf-7); past twelve, the figure. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/**
 * The scores left at the average, never touched (final drafts A5; caf-7): named with no figure, "Wit, Lore: the
 * average, not rolled"; with none rolled, "All six: the average, not rolled", the count from the record's scores.
 * '' when every score was rolled, or the record predates the list.
 */
export function averageScoresLine(creation: unknown, label: (key: string) => string): string {
  const record = isRecord(creation) ? creation : {};
  const all = Object.keys(isRecord(record.scores) ? record.scores : {}).length;
  const left = notRolledScores(creation);
  if (left.length === 0) return '';
  const who = left.length === all && all > 1 ? `All ${COUNT_WORDS[all] ?? String(all)}` : left.map(label).join(', ');
  return `${who}: the average, not rolled`;
}

/** The picks the GM must approve specially (ruled 2026-11-02, ca-3): bold, with the requirement they miss. */
export function specialLines(creation: unknown): ReviewLine[] {
  const record = isRecord(creation) ? creation : {};
  const list = Array.isArray(record.specialApprovals) ? record.specialApprovals.filter(isRecord) : [];
  return list.map((s) => ({ text: `${String(s.name ?? s.entryId ?? '')}: ${SPECIAL_NOTE}`, strong: true, why: String(s.requirement ?? '') || undefined }));
}

/**
 * Whether the starting coin was rolled (cw-11; Design's answer 2, 2026-11-06): the Gear step's coin starts at the
 * setting's usual amount, and the creation record says whether the player touched it (`moneyTouched`, written with the
 * money by the Gear step). Only `moneyTouched: false` reads as "the average, not rolled" ("usual" is out, ruled 2026-11-07); a record without the flag (every
 * character made before it) reads as rolled, so their words don't change.
 */
export const coinRolled = (creation: unknown): boolean => !(isRecord(creation) && creation.moneyTouched === false);

/** The starting coin in words, the review's and the GM's approval card's alike (cw-11). */
export interface CoinWords {
  /** "100 rolled, +10 gp from Reed cutter, 60 gp spent: 50 gp left"; over the coin, "…: 2 gp over." (cs-45, cs-44). */
  text: string;
  /** What the Gear step's Next would say (Send lands there, cr-2). */
  problem: string | null;
}

/**
 * The money as the Gear step left it (cs-45, Gear's form): "100 rolled, +10 gp from Reed cutter, 60 gp spent: 50 gp
 * left", or "100, the average (not rolled), …". The "from …" part shows only when a pick adds coin (rc-2), naming the
 * pick (`pickName` by list id; "your picks" when it can't be named); nothing spent says no "spent". Over the coin,
 * "…: 2 gp over." (cs-44), (no second line). Not typed with no coin from a pick: the purse starts at 0 (ruled
 * 2026-11-02).
 */
export function moneyOf(creation: unknown, coins: readonly Coin[], pickName: (listId: string) => string | null = () => null): CoinWords {
  const record = isRecord(creation) ? creation : {};
  const extra = entryMoneyOf(record);
  if (typeof record.startingMoney !== 'number' && extra === 0) return { text: 'Starting money not typed, so the purse starts at 0', problem: null };
  const typed = typeof record.startingMoney === 'number' ? record.startingMoney : 0;
  const coin = isRecord(record.moneyCoin) ? record.moneyCoin : {};
  const unit: Coin = { key: typeof coin.key === 'string' ? coin.key : 'gp', label: typeof coin.key === 'string' ? coin.key : 'gp', valueInBase: typeof coin.valueInBase === 'number' && coin.valueInBase > 0 ? coin.valueInBase : 1 };
  const spent = typeof record.spentBase === 'number' ? record.spentBase : 0;
  const left = (typed + extra) * unit.valueInBase - spent;
  // cs-45 (one form everywhere, Gear's, cs-22): the rolled figure alone, the coins on what was spent and what is left.
  const start = typeof record.startingMoney === 'number' ? (coinRolled(record) ? `${typed} rolled` : `${typed}, the average (not rolled)`) : '';
  // rc-2: each pick's coins, named ("+10 gp from Reed cutter"); the first part has no "+" when nothing was typed.
  const byPick = isRecord(record.traitMoney) ? Object.entries(record.traitMoney).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isInteger(e[1]) && e[1] > 0) : [];
  const from = byPick.map(([listId, n], i) => `${start || i > 0 ? '+' : ''}${n} ${unit.key} from ${pickName(listId) ?? 'your picks'}`);
  const parts = [start, ...from, spent > 0 ? `${showMoney(spent, coins, unit)} spent` : ''].filter(Boolean);
  // Over the coin (cs-44): "…: 2 gp over." in the same line; no separate "Over by" (it would say it twice, cs-45).
  if (left < 0) return { text: `${parts.join(', ')}: ${showMoney(-left, coins, unit)} over.`, problem: `${showMoney(-left, coins, unit)} short: put something back.` };
  return { text: `${parts.join(', ')}: ${showMoney(left, coins, unit)} left`, problem: null };
}

/** An item's name as one of a list: a name that is a sentence drops its closing full stop (an ellipsis stays). */
export const listedName = (name: string): string => name.trim().replace(/(?<!\.)\.$/, '');

/** One row of the review's Gear card (cw-11): what put things in the pack, and what they are. */
export interface GearRow {
  label: string;
  items: string;
  /** The pack lines the row names (a kit's: the review checks which its class can't wear or use). */
  ids: string[];
  /** A kit's row. */
  kit?: boolean;
}

/** The Gear card as lines (cw-11, mockup creation/12): a row per kit and per pick, the given gear folded, the count. */
export interface GearGroups {
  rows: GearRow[];
  /** The given gear (the setting's and the kindred's, and given picks), one name each; empty without. */
  given: string[];
  /** "6 items": how many things are given, each counted. */
  givenCount: string;
  /** "12 items · Unencumbered"; "Nothing yet" with an empty pack. */
  summary: string;
}

type Held = { id: string; qty: number };
const heldOf = (value: unknown): Held[] =>
  Array.isArray(value) ? value.filter(isRecord).flatMap((l) => (typeof l.id === 'string' && typeof l.qty === 'number' && l.qty > 0 ? [{ id: l.id, qty: l.qty }] : [])) : [];

/**
 * The review's Gear card as lines (cw-11): each kit taken with what it gave ("Warden's kit · Ring coat, Reed spear"),
 * what was bought, each name once with its count ("Bought"), what a pick put in the pack under the list's name ("Keepsake · A bag of
 * sticky sweets"), the given gear apart (folded on the card), and "12 items · Unencumbered". It reads the creation
 * record's `bought`, `traitGear`, `givenGear` and `givenPicks` against what the pack holds: a line no longer there is
 * left out, and what the pack holds that none of them put in shows as "Also in the pack".
 */
export function gearGroups(
  creation: unknown,
  lines: readonly { id: string; name: string; qty: number }[],
  load: string,
  listName: (listId: string) => string,
  /** A pack's pick table by its id: its name as the pack writes it ("Odds and ends"; cs-23). */
  tableName: (tableId: string) => string = (tableId) => tableId,
): GearGroups {
  const record = isRecord(creation) ? creation : {};
  const byId = new Map(lines.map((l) => [l.id, l]));
  // How many of each line the record has said for so far: what's left over is "Also in the pack".
  const said = new Map<string, number>();
  const itemCount = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
  let givenQty = 0;
  let named: string[] = [];
  const counts = (held: readonly Held[], counted = false): { name: string; qty: number }[] =>
    held.flatMap((h) => {
      const line = byId.get(h.id);
      if (!line) return [];
      const qty = Math.min(h.qty, line.qty - (said.get(h.id) ?? 0));
      if (qty <= 0) return [];
      said.set(h.id, (said.get(h.id) ?? 0) + qty);
      if (counted) givenQty += qty;
      named.push(h.id);
      return [{ name: listedName(line.name), qty }];
    });
  const worded = (list: readonly { name: string; qty: number }[]) => list.map(({ name, qty }) => (qty > 1 ? `${name} ×${qty}` : name));
  const names = (held: readonly Held[], counted = false): string[] => worded(counts(held, counted));
  const given = names(heldOf(record.givenGear), true);
  const rows: GearRow[] = [];
  const bought = Array.isArray(record.bought) ? record.bought.filter(isRecord) : [];
  for (const kit of bought.filter((p) => typeof p.kitId === 'string')) {
    named = [];
    const items = names(heldOf(kit.lines));
    if (items.length > 0) rows.push({ label: listedName(String(kit.label ?? '')), items: items.join(', '), ids: named, kit: true });
  }
  named = [];
  // Each thing bought named once with its count, in the order first bought ("Bog sling ×3, Reed rope"; caf-1).
  const shop = worded(
    bought
      .filter((p) => typeof p.kitId !== 'string')
      .flatMap((p) => counts(heldOf(p.lines)))
      .reduce<{ name: string; qty: number }[]>((all, one) => {
        const same = all.find((a) => a.name === one.name);
        if (same) same.qty += one.qty;
        else all.push({ ...one });
        return all;
      }, []),
  );
  if (shop.length > 0) rows.push({ label: 'Bought', items: shop.join(', '), ids: named });
  if (isRecord(record.traitGear)) {
    for (const [listId, held] of Object.entries(record.traitGear)) {
      named = [];
      const items = names(heldOf(held));
      if (items.length > 0) rows.push({ label: listName(listId), items: items.join(', '), ids: named });
    }
  }
  // A pack's pick table, named by the pack on its own row ("Odds and ends: Eel line"; cs-23, 22-G1).
  if (isRecord(record.givenPicks)) {
    for (const [tableId, picks] of Object.entries(record.givenPicks)) {
      named = [];
      const items = Array.isArray(picks) ? picks.filter(isRecord).flatMap((p) => names(heldOf(p.lines))) : [];
      if (items.length > 0) rows.push({ label: tableName(tableId), items: items.join(', '), ids: named });
    }
  }
  // The trinket on a row of its own, "Trinket" (cs-23, ruled 2026-11-12), not under "Also in the pack".
  const trinket = isRecord(record.trinket) && typeof record.trinket.lineId === 'string' ? record.trinket.lineId : null;
  if (trinket) {
    named = [];
    const items = names([{ id: trinket, qty: 1 }]);
    if (items.length > 0) rows.push({ label: 'Trinket', items: items.join(', '), ids: named });
  }
  named = [];
  const rest = names(lines.map((l) => ({ id: l.id, qty: l.qty })));
  if (rest.length > 0) rows.push({ label: 'Also in the pack', items: rest.join(', '), ids: named });
  const count = lines.reduce((n, l) => n + l.qty, 0);
  return { rows, given, givenCount: itemCount(givenQty), summary: count === 0 ? 'Nothing yet' : [itemCount(count), load].filter(Boolean).join(', ') };
}

/**
 * The spells on the review's Magic card by source (cw-11): "From your kindred" for a kindred's grant (cs-2: its given
 * spells and the rows of its rolls), "From your class" for the rest.
 */
export function spellSources(book: readonly string[], kindred: { given: readonly { id: string }[]; rolled: readonly { id: string }[] } | null): { id: string; from: string }[] {
  const ids = new Set([...(kindred?.given ?? []), ...(kindred?.rolled ?? [])].map((s) => s.id));
  return book.map((id) => ({ id, from: ids.has(id) ? 'From your kindred' : 'From your class' }));
}

/**
 * A kit's thing the class can't wear or use (cw-11, Design 2026-11-06; the Gear step's "carried"): "▲ Ring coat: a Reed
 * Witch can't wear it; carried" (a weapon: "use"). The ▲ and the words carry it, never colour alone.
 */
export function cantUseLine(item: string, className: string, weapon: boolean): string {
  const article = /^[aeiou]/i.test(className) ? 'an' : 'a';
  return `${listedName(item)}: ${article} ${className} can't ${weapon ? 'use' : 'wear'} it; carried`;
}
