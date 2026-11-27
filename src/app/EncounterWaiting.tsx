// The encounter's one card on the GM console (M5b step 2; docs/05 "Encounter waiting", ruled 2026-10-30, D11 and
// S2-4; docs/06 Components "Encounter waiting card"). One card per hit of an encounter check, newest first; nothing when
// none wait. One encounter, one card (sf-4; page 44, EN1 B to D and EN4 C, approved 2026-11-26): the heading "An
// encounter", the row's words at body size, a detail row for each creature it names (sf-6a), one quiet line naming the
// table and the row's range with "Change…" (it opens "Roll…"'s pop-up with that row ticked, sf-5), then "Reveal…",
// "Message…" and "Done", on one row. No "Start" until fights are built; "Done" closes the card (⚑ 2, ruled 26 Nov).
// "Who is awake…" stays where a camp's night hit asks which watch. Built from the scene card's parts, the detail row,
// the stacked buttons and the roll's pop-up.
import { useState } from 'react';
import { shownWords } from '../core/storedWords.ts';
import { cardWords, rowOfHit, type EncounterCard } from '../modules/expedition/encounterPlay.ts';
import { missingWords } from '../modules/expedition/rowLinks.ts';
import { rowCountShown, rowLabel, type ReadTable, type TableRow } from '../modules/expedition/tables.ts';
import { Dialog } from '../ui/Dialog.tsx';
import type { StatBlockShown } from '../modules/library/statBlockLayout.ts';
import { BookDetailRow, countedName, type BookDetail } from './BookDetail.tsx';
import { TableRollPopUp, type TableTap } from './EncounterTables.tsx';
import { Chip, StackedButton, StackedGroup } from '../ui/parts.tsx';
import './SceneExplore.css';
import { useWaitingAccentItem, useWaitingSource, type WaitingSourceItem } from './sceneWaiting.tsx';

export interface StatBlockRef {
  name: string;
  description: string | null;
  /** The whole block laid out as its pack says (pf-13), with its source line (December 5c); absent in older callers. */
  full?: { shown: StatBlockShown; source: string | null };
}

/** The encounters waiting (EncounterWaitingSource's props). */
export interface EncounterWaitingProps {
  /** The cards waiting on this expedition, newest first; null when they couldn't be read. */
  cards: EncounterCard[] | null;
  tables: ReadonlyMap<string, ReadTable>;
  /** A stat block's name and one-line description, by its id in the setting rules. */
  statBlock: (id: string) => StatBlockRef | null;
  /** A row's one-line description in the roll's pop-up (its note, or its stat block's). */
  describe?: (row: TableRow) => string | null;
  /** Done (⚑ 2): the card closes. */
  onDone: (card: EncounterCard) => void;
  /** "Change…" (sf-4, sf-5): another row tapped in the table's pop-up; the caller records it (check.setRoll). */
  onChange?: (card: EncounterCard, tap: TableTap) => void;
  /** "Reveal…". */
  onReveal?: (card: EncounterCard) => void;
  /** "Message…": the row's words into a new message (absent where messages can't be sent). */
  onMessage?: (card: EncounterCard, words: string) => void;
  /** A card with no row picked yet: the way to its tables, where the caller has one for this hit. */
  rollFor?: (card: EncounterCard) => (() => void) | null;
  /** The check's own words for a hit (its `onHit.note`), where the caller knows them: the body of a card with no row. */
  noteFor?: (card: EncounterCard) => string | null;
  /**
   * Which watch? (M5b step 4, D18): for a night hit in camp, the watches to pick from ("2nd watch · Reed, Moss"); null
   * or empty for any other hit (no question).
   */
  watchChoices?: (card: EncounterCard) => string[] | null;
  onWatch?: (card: EncounterCard, watch: string) => void;
  /** No other accent shows on the console: the first card's Done is the screen's accent (fl-2). */
  accent?: boolean;
  /** Items that stand before the cards, in the same source (the hit just rolled, S8b): their order kept. */
  lead?: readonly WaitingSourceItem[];
}

const CardsUnread = () => <p className="scene-card__note">Couldn't load the waiting encounters. They'll show when the connection is back.</p>;

/**
 * The row's own words, as the card's body reads them (finding 14: at body size, under the heading): the words the
 * tapped row recorded after its tables' names ("Shallow things: Bog lurkers, 1d4" reads "Bog lurkers, 1d4"); the whole
 * line where its table can't be found.
 */
export function rowWordsOf(rowText: string, table: ReadTable | null): string {
  if (!table) return rowText;
  const lead = `${table.name}: `;
  const at = rowText.indexOf(lead);
  return at >= 0 ? rowText.slice(at + lead.length) : rowText;
}

/** What the card's picked line says (sf-4, EN1 B): the table and the row's range, "Encounters in the harbour, 15–16." */
export const pickedWords = (table: ReadTable, roll: string): string => `${table.name}, ${roll}.`;

/**
 * The encounter's one card, whole (sf-4; page 44, EN1 B and D, EN4 C): "An encounter"; the row's words; its count and
 * note; each creature a detail row (sf-6a); the picked line with "Change…"; then "Reveal…", "Message…" and "Done"
 * (the page's accent when `accent`), which keep their places. With no row picked yet it reads the check's own words
 * for a hit, or says no row is picked, with "Roll…" where the hit's tables can open. A camp's night hit keeps "Who is awake…" (its watches, as chips, in a sheet).
 */
function EncounterOneCard({
  card,
  tables,
  statBlock,
  accent,
  watchChoices,
  onWatch,
  onChange,
  onReveal,
  onMessage,
  onRoll,
  onDone,
  note,
}: {
  card: EncounterCard;
  tables: ReadonlyMap<string, ReadTable>;
  statBlock: (id: string) => StatBlockRef | null;
  accent: boolean;
  watchChoices?: (card: EncounterCard) => string[] | null;
  onWatch?: (card: EncounterCard, watch: string) => void;
  /** "Change…" tapped: the table's pop-up opens with this row ticked. */
  onChange: (() => void) | null;
  onReveal?: () => void;
  onMessage?: (words: string) => void;
  onRoll: (() => void) | null;
  onDone: () => void;
  /** The check's own words for its hit, which stand in for a row not picked (as the hit's card had them). */
  note: string | null;
}) {
  const [asking, setAsking] = useState(false);
  const { hit } = card;
  const watches = !card.encounter.watch ? (watchChoices?.(card) ?? []) : [];
  const found = rowOfHit(hit, tables);
  const words = hit.rowText ? rowWordsOf(hit.rowText, found?.table ?? null) : null;
  const blocks = found ? creatureLines(found.row, statBlock) : [];
  // What the list names in its place isn't said again in the row's own "Not in your packs" line.
  const inList = new Set(blocks.flatMap((b) => (b.missing !== undefined ? [b.missing] : [])));
  const missingElse = (found?.row.missing ?? []).filter((ref) => !inList.has(ref));
  return (
    <section className="scene-card waiting-encounter" aria-label={cardWords(card)}>
      <h3 className="waiting-encounter__title">An encounter</h3>
      <p className="waiting-encounter__line">{words ?? note ?? 'No row picked yet.'}</p>
      {found && rowCountShown(found.row) && <p className="scene-card__note">{`How many: ${found.row.count}`}</p>}
      {found?.row.note && <p className="scene-card__note">{found.row.note}</p>}
      {missingElse.length > 0 && <p className="scene-card__note">{missingWords(missingElse)}</p>}
      {card.encounter.watch && <p className="scene-card__note">{`Awake: ${shownWatch(card.encounter.watch)}`}</p>}
      <CreatureRows blocks={blocks} />
      {found && hit.roll ? (
        <div className="waiting-encounter__picked">
          <p className="scene-card__note">{pickedWords(found.table, hit.roll)}</p>
          {onChange && (
            <button type="button" className="button-secondary" aria-haspopup="dialog" aria-label={`Change…, ${found.table.name}`} onClick={onChange}>
              Change…
            </button>
          )}
        </div>
      ) : (
        !words &&
        onRoll && (
          <div className="waiting-encounter__picked">
            <button type="button" className="button-secondary" aria-haspopup="dialog" onClick={onRoll}>
              Roll…
            </button>
          </div>
        )
      )}
      {watches.length > 0 && (
        <button type="button" className="button-secondary waiting-encounter__awake" aria-haspopup="dialog" onClick={() => setAsking(true)}>
          Who is awake…
        </button>
      )}
      <StackedGroup>
        {onReveal && <StackedButton icon="eye" label="Reveal…" aria-haspopup="dialog" onClick={onReveal} />}
        {onMessage && <StackedButton icon="messages" label="Message…" aria-haspopup="dialog" onClick={() => onMessage(words ?? hit.name)} />}
        <StackedButton icon="check-mark" label="Done" variant={accent ? 'primary' : 'secondary'} onClick={onDone} />
      </StackedGroup>
      {asking && watches.length > 0 && (
        <Dialog label="Who is awake?" onClose={() => setAsking(false)}>
          <div role="group" aria-label="Which watch?">
            <p className="scene-card__note">Which watch?</p>
            <div className="scene-card__foot">
              {watches.map((w) => (
                <Chip
                  key={w}
                  onClick={() => {
                    setAsking(false);
                    onWatch?.(card, w);
                  }}
                >
                  {watchChipWords(w)}
                </Chip>
              ))}
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

/**
 * The encounters waiting as a source of "Waiting for you" (S8a; sceneWaiting.tsx): each one an item, marked by the
 * encounter's crossed swords and named by its row (or, with none, the check), whose row's button is Done and whose
 * open card is the one card above, whole. The open one's Done is the page's accent when `accent` says the waiting
 * panel holds it (accentOwner) and the panel's open item is this one. Where no panel shows (a town) they stand where
 * the strip draws this, as before; without a provider (the gallery, a test) the first card's Done is the accent when
 * `accent` asks (fl-2). Encounters that couldn't be read are one item saying so, so the panel never says "Nothing
 * waits." over a failed read (#857's review). "Change…" opens the table's pop-up (sf-5) with the picked row ticked
 * and the focus on it; a tap on a row is the answer, the X changes nothing.
 */
export function EncounterWaitingSource({
  cards,
  tables,
  statBlock,
  describe = () => null,
  onDone,
  onChange,
  onReveal,
  onMessage,
  rollFor,
  noteFor,
  watchChoices,
  onWatch,
  accent = false,
  lead = [],
}: EncounterWaitingProps) {
  const [changing, setChanging] = useState<EncounterCard | null>(null);
  const accentItem = useWaitingAccentItem();
  const unread: WaitingSourceItem[] = cards === null ? [{ id: 'encounter:unread', kind: 'encounter', title: "Couldn't load the waiting encounters", actions: [], card: <CardsUnread /> }] : [];
  const items: WaitingSourceItem[] = [...lead, ...unread, ...(cards ?? []).map((card, n): WaitingSourceItem => {
    const id = `encounter:${card.encounter.id}`;
    const table = card.hit.tableId ? (tables.get(card.hit.tableId) ?? null) : null;
    return {
      id,
      kind: 'encounter',
      // Named by what was rolled; with no row picked yet, "An encounter: <the check>", never the check's own name alone
      // (its line on the card may wait beside it under that name).
      title: card.hit.rowText ? rowWordsOf(card.hit.rowText, table) : `An encounter: ${card.hit.name}`,
      actions: [{ id: 'done', label: 'Done', icon: 'check-mark' }],
      onAction: (action) => (action === 'done' ? onDone(card) : undefined),
      card: (
        <EncounterOneCard
          card={card}
          tables={tables}
          statBlock={statBlock}
          accent={accent && (accentItem === undefined ? n === 0 : accentItem === id)}
          watchChoices={watchChoices}
          onWatch={onWatch}
          onChange={onChange && table ? () => setChanging(card) : null}
          onReveal={onReveal ? () => onReveal(card) : undefined}
          onMessage={onMessage ? (words) => onMessage(card, words) : undefined}
          onRoll={rollFor?.(card) ?? null}
          onDone={() => onDone(card)}
          note={noteFor?.(card) ?? null}
        />
      ),
    };
  })];
  const drawn = useWaitingSource('encounters', items);
  const changingTable = changing?.hit.tableId ? (tables.get(changing.hit.tableId) ?? null) : null;
  const picked = changingTable && changing?.hit.roll ? changingTable.rows.findIndex((r) => rowLabel(r) === changing.hit.roll) : -1;
  return (
    <>
      {drawn}
      {changing && changingTable && onChange && (
        <TableRollPopUp
          title={changingTable.name}
          table={changingTable}
          tables={tables}
          describe={describe}
          picked={picked >= 0 ? picked : null}
          onRow={(tap) => {
            setChanging(null);
            // The row already picked, tapped again: nothing changes.
            if (tap.table.id !== changing.hit.tableId || tap.roll !== changing.hit.roll) onChange(changing, tap);
          }}
          onClose={() => setChanging(null)}
        />
      )}
    </>
  );
}

/**
 * A watch choice as saved on the encounter ("2nd watch · Reed, Moss", the old format kept: the sweep's review, #561)
 * as a person reads it: "2nd watch: Reed, Moss".
 */
export const shownWatch = (watch: string): string => shownWords(watch.replace(/^(\S+ watch) · /, '$1: '));

/** A watch choice as its chip reads: "2nd: Reed, Moss" (from "2nd watch · Reed, Moss"; "2nd watch: …" reads the same). */
export const watchChipWords = (watch: string): string => {
  const parts = /^(\S+) watch(?:(?::| ·)( .*))?$/.exec(watch);
  return parts ? `${parts[1]!}${parts[2] ? `:${parts[2]}` : ''}` : watch;
};

/** A creature in the card's details: its stat block and count, or (`missing`) the link the packs don't have. */
export type CreatureLine = (StatBlockRef & { count: string | null; missing?: undefined }) | { missing: string; count: string | null };

/**
 * The stat blocks a row names, as the card's details list them: the row's own `statBlockId` first (its count is the
 * row's, shown as "How many"), then each creature of `statBlockIds` with its own count (pf-2). A listed creature the
 * packs don't have keeps its place, as its link (shown "Not in your packs: <link>", December 5c, frame 3).
 */
export function creatureLines(row: TableRow, statBlock: (id: string) => StatBlockRef | null): CreatureLine[] {
  const own = row.statBlockId ? statBlock(row.statBlockId) : null;
  const listed = (row.creatures ?? []).flatMap((c): CreatureLine[] => {
    const block = c.statBlockId ? statBlock(c.statBlockId) : null;
    return block ? [{ ...block, count: c.count }] : c.statBlockId ? [] : [{ missing: c.ref, count: c.count }];
  });
  return [...(own ? [{ ...own, count: null }] : []), ...listed];
}

/** A creature's detail row (sf-6a): its stat block in full, or, from an older caller with none, its description. */
export const creatureDetail = (block: StatBlockRef & { count: string | null }): BookDetail => ({
  name: block.name,
  count: block.count,
  shown: block.full?.shown ?? { notes: block.description ? [block.description] : [], descriptor: null, groups: [], abilities: [], rest: [], line: [] },
  source: block.full?.source ?? null,
});

/**
 * The creatures a row names, in the card's details (sf-6a; page 44, EN1 B): each one a detail row, its tap the one
 * pop-up; one the packs don't have says so in its place, by name. Nothing when there are none.
 */
export function CreatureRows({ blocks }: { blocks: CreatureLine[] }) {
  if (blocks.length === 0) return null;
  return (
    <ul className="book-detail__list" aria-label="Stat blocks">
      {blocks.map((block, i) => (
        <li key={i}>
          {block.missing !== undefined ? (
            <span className="book-detail__missing">{countedName(missingWords([block.missing]), block.count)}</span>
          ) : (
            <BookDetailRow detail={creatureDetail(block)} />
          )}
        </li>
      ))}
    </ul>
  );
}
