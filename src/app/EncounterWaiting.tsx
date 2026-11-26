// Encounter waiting cards on the GM console (M5b step 2; docs/05 "Encounter waiting", ruled 2026-10-30, D11 and S2-4;
// docs/06 Components "Encounter waiting card"). One card per hit of an encounter check, newest first; nothing when
// none wait. Each card: Start, View (its details, no change) and Dismiss (Undo from the toast). Fewer links (fl-2,
// 2026-11-03): Start is the accent when the console shows no other (`accent`; only the first card's, one per screen),
// else secondary; View and Dismiss are small secondary buttons; Which watch? is chips ("1st · Reed, Moss").
// Start in M5b (ruled 2026-11-03): the row's full text and the stat blocks it names, read-only; M6 turns it into a
// fight. Built from the scene card's parts and the Dialog; one style of its own (the small View stays its own width).
import { useState } from 'react';
import { shownWords } from '../core/storedWords.ts';
import { cardWords, rowOfHit, type EncounterCard } from '../modules/expedition/encounterPlay.ts';
import { missingWords } from '../modules/expedition/rowLinks.ts';
import { rowCountShown, type ReadTable, type TableRow } from '../modules/expedition/tables.ts';
import { Dialog } from '../ui/Dialog.tsx';
import type { StatBlockShown } from '../modules/library/statBlockLayout.ts';
import { BookDetailRow, countedName, type BookDetail } from './BookDetail.tsx';
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
  /** When the hit fell, in words ("Turn 12"). */
  when: (atSeconds: number) => string | null;
  /** Resolves true when the card was started (its details then open). */
  onStart: (card: EncounterCard) => Promise<boolean>;
  onDismiss: (card: EncounterCard) => void;
  /**
   * Which watch? (M5b step 4, D18): for a night hit in camp, the watches to pick from ("2nd watch · Reed, Moss"); null
   * or empty for any other hit (no question).
   */
  watchChoices?: (card: EncounterCard) => string[] | null;
  onWatch?: (card: EncounterCard, watch: string) => void;
  /** No other accent shows on the console: the first card's Start is the screen's accent (fl-2). */
  accent?: boolean;
  /** Items that stand before the cards, in the same source (the hit just rolled, S8b): their order kept. */
  lead?: readonly WaitingSourceItem[];
}

const CardsUnread = () => <p className="scene-card__note">Couldn't load the waiting encounters. They'll show when the connection is back.</p>;

/**
 * One encounter waiting, whole, as page 16's T2 draws it (S8b): "An encounter waits"; its line, the check and when,
 * then what was rolled as a link that opens the encounter's pop-up without starting anything (06-03; the lead's ruling
 * for S8b: the View button goes); who was awake; and its answers as stacked buttons with their icons (stk-1): Start
 * (the page's accent when `accent`), Dismiss, and "Who is awake…" where the hit fell in a camp's night (its watches,
 * as chips, in a sheet).
 */
function EncounterWaitingCard({
  card,
  when,
  accent,
  watchChoices,
  onWatch,
  onStart,
  onView,
  onDismiss,
}: {
  card: EncounterCard;
  when: (atSeconds: number) => string | null;
  accent: boolean;
  watchChoices?: (card: EncounterCard) => string[] | null;
  onWatch?: (card: EncounterCard, watch: string) => void;
  onStart: () => void;
  /** What was rolled, tapped: the encounter's pop-up, nothing started. */
  onView: () => void;
  onDismiss: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const watches = !card.encounter.watch ? (watchChoices?.(card) ?? []) : [];
  const said = [card.hit.name, when(card.hit.atSeconds)].filter(Boolean).join(', ');
  return (
    <section className="scene-card waiting-encounter" aria-label={cardWords(card)}>
      <h3 className="waiting-encounter__title">An encounter waits</h3>
      <p className="waiting-encounter__line">
        {`${said}. `}
        {/* With no row picked yet there is nothing to open: plain words (the lead, #859). */}
        {card.hit.rowText ? (
          <button type="button" className="button-quiet waiting-encounter__link" aria-haspopup="dialog" onClick={onView}>
            {card.hit.rowText}
          </button>
        ) : (
          'No row picked yet.'
        )}
      </p>
      {card.encounter.watch && <p className="scene-card__note">{`Awake: ${shownWatch(card.encounter.watch)}`}</p>}
      <StackedGroup>
        <StackedButton icon="crossed-swords" label="Start" variant={accent ? 'primary' : 'secondary'} onClick={onStart} />
        <StackedButton icon="cancel" label="Dismiss" onClick={onDismiss} />
        {watches.length > 0 && <StackedButton icon="awareness" label="Who is awake…" onClick={() => setAsking(true)} />}
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
 * encounter's crossed swords and named by its row (or, with none, the check), whose row's button is Start and whose
 * open card is the card above, whole. The open one's Start is the page's accent when `accent` says the waiting panel
 * holds it (accentOwner) and the panel's open item is this one. Where no panel shows (a town) they stand where the
 * strip draws this, as before; without a provider (the gallery, a test) the first card's Start is the accent when
 * `accent` asks (fl-2). Encounters that couldn't be read are one item saying so, so the panel never says "Nothing
 * waits." over a failed read (#857's review).
 */
export function EncounterWaitingSource({
  cards,
  tables,
  statBlock,
  when,
  onStart,
  onDismiss,
  watchChoices,
  onWatch,
  accent = false,
  lead = [],
}: EncounterWaitingProps) {
  const [open, setOpen] = useState<{ card: EncounterCard; started: boolean } | null>(null);
  const accentItem = useWaitingAccentItem();
  // What was rolled, tapped (06-03): the encounter's details, each creature a detail row (sf-6a). Nothing is started.
  const view = (card: EncounterCard) => setOpen({ card, started: false });
  const start = async (card: EncounterCard) => {
    if (await onStart(card)) setOpen({ card, started: true });
  };
  const unread: WaitingSourceItem[] = cards === null ? [{ id: 'encounter:unread', kind: 'encounter', title: "Couldn't load the waiting encounters", actions: [], card: <CardsUnread /> }] : [];
  const items: WaitingSourceItem[] = [...lead, ...unread, ...(cards ?? []).map((card, n): WaitingSourceItem => {
    const id = `encounter:${card.encounter.id}`;
    return {
      id,
      kind: 'encounter',
      // Named by what was rolled; with no row picked yet, "An encounter: <the check>", never the check's own name alone
      // (its line on the card may wait beside it under that name).
      title: card.hit.rowText ?? `An encounter: ${card.hit.name}`,
      actions: [
        { id: 'start', label: 'Start', icon: 'crossed-swords' },
        { id: 'dismiss', label: 'Dismiss', icon: 'cancel' },
      ],
      onAction: (action) => (action === 'start' ? void start(card) : action === 'dismiss' ? onDismiss(card) : undefined),
      card: (
        <EncounterWaitingCard
          card={card}
          when={when}
          accent={accent && (accentItem === undefined ? n === 0 : accentItem === id)}
          watchChoices={watchChoices}
          onWatch={onWatch}
          onStart={() => void start(card)}
          onView={() => view(card)}
          onDismiss={() => onDismiss(card)}
        />
      ),
    };
  })];
  const drawn = useWaitingSource('encounters', items);
  return (
    <>
      {drawn}
      {open && <EncounterDetails card={open.card} started={open.started} tables={tables} statBlock={statBlock} when={when} onClose={() => setOpen(null)} />}
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

/** The card's details: the row's full text, its note and count, the stat blocks it names, and the check's modifiers. */
export function EncounterDetails({
  card,
  started,
  tables,
  statBlock,
  when,
  onClose,
}: {
  card: EncounterCard;
  /** Opened by Start (the card is started) rather than View (nothing changed). */
  started: boolean;
  tables: ReadonlyMap<string, ReadTable>;
  statBlock: (id: string) => StatBlockRef | null;
  when: (atSeconds: number) => string | null;
  onClose: () => void;
}) {
  const { hit } = card;
  const found = rowOfHit(hit, tables);
  // The row's stat block, then each creature it lists (pf-2, December 5b) with its count; one the packs don't have
  // is left out here and named under "Not in your packs".
  const blocks = found ? creatureLines(found.row, statBlock) : [];
  // What the list names in its place isn't said again in the row's own "Not in your packs" line.
  const inList = new Set(blocks.flatMap((b) => (b.missing !== undefined ? [b.missing] : [])));
  const missingElse = (found?.row.missing ?? []).filter((ref) => !inList.has(ref));
  const facts = [when(hit.atSeconds), card.encounter.watch ? `Awake: ${shownWatch(card.encounter.watch)}` : null, found ? `${found.table.name}, ${hit.roll}` : null].filter(Boolean).join(', ');
  return (
    <Dialog label={started ? `Started: ${hit.name}` : `Encounter waiting: ${hit.name}`} onClose={onClose}>
      {facts && <p className="scene-card__note">{facts}</p>}
      <p className="scene-card__chance">{hit.rowText ?? 'No row picked yet. Open the encounter tables from the hit to pick one, or say what happens.'}</p>
      {found && rowCountShown(found.row) && <p className="scene-card__note">{`How many: ${found.row.count}`}</p>}
      {found?.row.note && <p className="scene-card__note">{found.row.note}</p>}
      {missingElse.length > 0 && <p className="scene-card__note">{missingWords(missingElse)}</p>}
      <CreatureRows blocks={blocks} />
      {hit.modifiers.length > 0 && (
        <ul className="scene-card__modifiers" aria-label="Modifiers">
          {hit.modifiers.map((m, i) => (
            <li key={i}>{m.add ? `${m.label} ${m.add > 0 ? '+' : ''}${m.add}` : m.label}</li>
          ))}
        </ul>
      )}
      {started && <p className="scene-card__note">Run it at the table. Fights come in a later update.</p>}
    </Dialog>
  );
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
