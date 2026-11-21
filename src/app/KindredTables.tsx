// A kindred's creation tables on screen (cs-1, design/rulings/m5b-0c-creation-survey-2026-11-03.md; mockups
// creation/11 and 12, cw-11): the Name field's tables (one row each with Open, its columns each tapped), the optional
// Details step (age, height and weight as steppers from the kindred's usual, each detail table opened and a row tapped,
// the growth for its kindred only; Next on an untouched step saves the averages, flagged so, and never blocks Send), and the table sheet they share. The app never
// rolls: the player rolls at the table and taps the row, or types the number on a long table.
import { useContext, useState } from 'react';
import {
  cleanDetails,
  detailsCount,
  fromLabel,
  kindredTables,
  nameColumns,
  nameFromLine,
  nameSheetRollWords,
  nameTableLine,
  physicalOf,
  pickedNameLine,
  rolledName,
  readUsual,
  usualBox,
  usualDiceLine,
  usualWords,
  rangeOf,
  rollWords,
  rowOf,
  shortTableName,
  LONG_ROWS,
  rowBands,
  typedRow,
  type CharacterDetails,
  type CreationTable,
  type KindredTables,
  type PhysicalField,
  type PhysicalKey,
  type Usual,
} from '../modules/characters/kindredTables.ts';
import { AVERAGE_LINE, BookTapHead, CreationStep, rangeWidthOf, DetailRow, LongRows, PickGroup, StepField, TableSheet, type LongTable, type TableSheetRow } from '../ui/creation.tsx';
import { BookTypeScope, Dialog } from '../ui/Dialog.tsx';
import { DiceWords, DieGlyph, dieOf, RollRow } from '../ui/dice.tsx';
import { ButtonRow, CloseButton, OptionRow, TypedStepper } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { raceAsPlayed } from '../modules/characters/creation.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { stackOrder, type ResolvedEntry } from '../modules/library/stack.ts';
import type { CampaignSetting } from './campaignSetting.ts';

/**
 * A kindred's creation tables in this campaign (cs-1), with what the attached packs offer for the slots it doesn't fill
 * (ct-5): the tables in play, the packs in the GM's order (top first), by their short names.
 */
export function creationTablesOf(setting: Pick<CampaignSetting, 'all' | 'packs'>, kindred: { data: Record<string, unknown> } | null | undefined): KindredTables {
  return kindredTables(
    kindred,
    entriesInPlay(setting.all).filter((e) => e.kind === 'table'),
    stackOrder(setting.packs).map((p) => ({ packId: p.packId, name: p.shortName || p.name })),
  );
}

/**
 * A saved character's kindred as they play it (cs-4) and its creation tables, for the sheet: the Name roll in Edit, the
 * details shown and changed. Null without a kindred or a setting.
 */
export function kindredOfCharacter(setting: CampaignSetting | null, raceRef: string | null, classRef: string | null): { kindred: ResolvedEntry; tables: KindredTables; physical: ReturnType<typeof physicalOf> } | null {
  if (!setting) return null;
  const race = raceRef ? (setting.all.find((e) => e.kind === 'race' && e.packEntryId === raceRef) ?? null) : null;
  const klass = classRef ? (setting.all.find((e) => e.kind === 'class' && e.packEntryId === classRef) ?? null) : null;
  const kindred = raceAsPlayed(race, klass);
  if (!kindred) return null;
  return { kindred, tables: creationTablesOf(setting, kindred), physical: physicalOf(kindred) };
}

/**
 * A table sheet's body with the typed roll and the bar (m5b-long-tables; Design's rounds 2 and 3 on #571): the rows
 * the sheet draws (`rowAt` gives row n's, or null when this view has none: a name part with no cell there), in bands
 * when the table has 50 rows or more (`rowBands`), two columns on a tablet from 24 rows, and the typed roll on any
 * table with a die. Undefined for a short table with no die (the plain list).
 */
function longOf(table: CreationTable, rowAt: (n: number) => TableSheetRow | null, startRolled?: string): LongTable | undefined {
  const bands = rowBands(table);
  const long = table.rows.length >= LONG_ROWS;
  if (!table.die && !long) return undefined;
  const all = table.rows.map((_, n) => n);
  return {
    ranges: (bands ?? [{ heading: 'rows', rows: all }]).map((b) => ({ heading: b.heading, rows: b.rows.flatMap((n) => rowAt(n) ?? []) })).filter((b) => b.rows.length > 0),
    bar: !!bands,
    columns: long,
    typed: table.die
      ? (text) => {
          const found = typedRow(table, text);
          const row = found.row === null ? null : rowAt(found.row);
          if (found.row !== null && !row) return { key: null, line: `No row has ${Number(text.trim())}.` };
          return { key: row ? row.key : null, line: found.line };
        }
      : undefined,
    startRolled,
  };
}

/** "Bog folk names · Fen rules p. 8": the table's source line for the sheet, after "Optional · from <pack>" when another pack offered it (ct-6). */
const metaOf = (table: CreationTable) => [fromLabel(table), table.source].filter(Boolean).join(', ') || undefined;

/**
 * One table opened to mark a row: the book's table, a tap marks, **Take it** at the foot's right takes it (cts-2,
 * cts-8: every table of Looks and manner, the trinket's and a kindred's roll at a level, whatever their length; mockup
 * creation/final 24, frames TS5 to TS8, approved 2026-11-19). Nothing is taken on a tap and the ✕ closes with nothing
 * taken (cs-15). A table with a die has "What you rolled"; a long one (past a d20) the range bar from 50 rows and two
 * columns on a tablet from 24 (m5b-long-tables). On a table that takes the player's own words ("Or type your own",
 * final drafts D) the words are the marked answer once typed and wait for Take it too (cts-4); latest wins between the
 * words and a row (cts-9). `picked` is what was taken (a row's words, or typed words), `onPick` gets the words and the
 * row's low end, or null for Clear. `preview` and `startRolled` are the gallery's.
 */
export function OneTableSheet({
  table,
  kindred,
  title,
  picked,
  onPick,
  onClose,
  own = false,
  preview = false,
  startRolled,
}: {
  table: CreationTable;
  kindred?: string;
  /** What is picked, as the sheet's title ("Trinket"); the table's own name goes on its bar. Left out, the table's short name. */
  title?: string;
  picked: string | undefined;
  onPick: (words: string | null, rolled?: number) => void;
  onClose: () => void;
  /** The player's own words at the sheet's foot (final drafts D: a describing table); left out, rows only. */
  own?: boolean;
  preview?: boolean;
  startRolled?: string;
}) {
  const toast = useToast();
  const at = rowOf(table, picked);
  // What was taken as typed words (no row holds them): the box starts with them, marked (cts-4, frame TS6).
  const takenWords = own && at < 0 ? (picked ?? '') : '';
  // What is marked: a row's index, OWN for the typed words, or −1 for nothing (cs-15, cts-9).
  const firstMark = at >= 0 ? at : takenWords ? OWN : -1;
  const [marked, setMarked] = useState(firstMark);
  const [typed, setTyped] = useState(takenWords);
  // What is taken changed (Clear, or the caller's own change): the mark follows it, never a stale ✓ (#786's review);
  // typed words taken off by Clear leave the box with them (cts-9: Clear takes off a typed answer as it does a row).
  const [seen, setSeen] = useState(picked);
  if (seen !== picked) {
    const before = own && rowOf(table, seen) < 0 ? (seen ?? '') : '';
    setSeen(picked);
    setMarked(firstMark);
    if (before || takenWords) setTyped(takenWords);
  }
  const label = title ?? shortTableName(table.name, kindred);
  // One width for the range column, the table's widest (the lead on #786): the results line up down the table.
  const rangeWidth = rangeWidthOf(table.rows.map((row) => rangeOf(row)));
  // A tap marks the row (again, unmarks it); the typed words stay in the box, unmarked (cts-9).
  const rows: TableSheetRow[] = table.rows.map((row, n) => ({
    key: String(n),
    range: rangeOf(row),
    text: row.text,
    picked: n === marked,
    onPick: () => setMarked(n === marked ? -1 : n),
  }));
  const words = typed.trim();
  const ownMarked = marked === OWN && !!words;
  const take = () => {
    if (ownMarked) {
      // The words already taken: nothing to take again, so no event; the sheet closes.
      if (words !== picked) onPick(words);
      return onClose();
    }
    const row = marked >= 0 ? table.rows[marked] : undefined;
    // Never a disabled Take it: with nothing marked it says what to do (cts-5 b).
    if (!row) return toast({ text: own ? 'Mark a row or type your own first.' : 'Mark a row first.' });
    // The row already taken: nothing to take again, so no event (#786's review); the sheet closes.
    if (marked !== at) onPick(row.text, row.min);
    onClose();
  };
  return (
    <TableSheet
      // The title is what is picked (or the table alone); the Roll row under it owns the die (Design on #571).
      label={label}
      meta={metaOf(table)}
      lead={table.description || undefined}
      groups={[{ rows }]}
      long={longOf(table, (n) => rows[n] ?? null, startRolled)}
      preview={preview}
      // Always a Roll row (retest 2's audit): a table without a die reads "Roll on the table", with no glyph. The
      // pack's own prompt when it has one (R3-2).
      roll={{ die: table.die, words: table.rollPrompt ?? `${rollWords(table)}, then mark your row.${own ? ' Or type your own below.' : ''}` }}
      own={
        own
          ? {
              value: typed,
              marked: ownMarked,
              // Typing marks the words; tapping the box marks them again when it holds any (cts-9: latest wins).
              onChange: (text) => {
                setTyped(text);
                setMarked(OWN);
              },
              onMark: () => {
                if (words) setMarked(OWN);
              },
            }
          : undefined
      }
      // The book's tapped table (dec-10 E's part): the table's name on its bar, the die over what is picked.
      head={<BookTapHead title={table.name} die={table.die} column={table.columns[table.columns.length - 1] || label} />}
      rowOf={(row: TableSheetRow) => <OptionRow key={row.key} compact range={(row.range ?? '').replace('–', ' to ')} rangeWidth={rangeWidth} name={row.text} summary="" selected={row.picked} onPick={row.onPick} />}
      take={{ marked: marked >= 0 || ownMarked, onTake: take }}
      // Clear only takes off what was taken before, a row or typed words; with nothing taken the X is the way out.
      onClear={at >= 0 || takenWords ? () => onPick(null) : undefined}
      onDone={onClose}
    />
  );
}

/** The mark on the player's own words in a table's sheet (cts-4), beside the rows' indices. */
const OWN = -2;

/**
 * What a describing table's row says once filled (final drafts D, mockup creation/final/06): "Rolled 7: a scar
 * through one eyebrow" for a row's words, "Typed: speaks only when sure" for the player's own.
 */
export function filledWords(table: CreationTable, words: string): string {
  const at = rowOf(table, words);
  return at >= 0 ? `Rolled ${rangeOf(table.rows[at]!)}: ${words}` : `Typed: ${words}`;
}

/**
 * One name table opened (R2-8; R3-1, mockup creation/final/10): its first line the pack's roll prompt (R3-2, else
 * "Roll d20, then tap the rows."), one tab per part of the name, then that part's rows (a long table of 24 rows or
 * more with the typed roll and the range bar, `LongRows`, as every table sheet; m5b-long-tables round 2). A tapped row only marks ✓ (tapped again, it's taken off) and moves to the next part's tab; the foot
 * says what's picked and what's still to roll; **Use this name** (the sheet's one accent) hands the name up. ← goes
 * back to the list of tables when there are several. A sheet on a phone; beside the step on a tablet (`asSheet` false).
 */
export function NameTableSheet({
  table,
  tapped,
  onTap,
  onUse,
  onClose,
  onBack,
  asSheet,
}: {
  table: CreationTable;
  tapped: readonly (string | undefined)[];
  onTap: (part: number, text: string) => void;
  /** Use this name: the name the tapped parts make, in the pack's part order. */
  onUse: () => void;
  onClose: () => void;
  /** Several tables: back to their list. */
  onBack?: () => void;
  asSheet: boolean;
}) {
  const parts = nameColumns(table);
  const [tab, setTab] = useState(0);
  // Use this name with nothing tapped says why, in the foot's line (never a disabled button).
  const [said, setSaid] = useState<string | null>(null);
  const at = Math.min(tab, parts.length - 1);
  const part = parts[at]!;
  // Each of this part's cells as a table row: its roll, its words, ✓ when tapped; a tap marks it and moves on a part.
  const cellRow = (cell: { row: number; text: string }): TableSheetRow => ({
    key: `${at}-${cell.row}`,
    range: rangeOf(table.rows[cell.row]!),
    text: cell.text,
    picked: tapped[at] === cell.text,
    onPick: () => {
      setSaid(null);
      onTap(at, cell.text);
      if (tapped[at] !== cell.text && at < parts.length - 1) setTab(at + 1);
    },
  });
  const drawRow = (row: TableSheetRow) => <OptionRow key={row.key} compact range={row.range} name={row.text} summary="" selected={row.picked} onPick={row.onPick} />;
  const byRow = new Map(part.cells.map((cell) => [cell.row, cellRow(cell)]));
  const long = longOf(table, (n) => byRow.get(n) ?? null);
  const anyTapped = tapped.some(Boolean);
  const book = useContext(BookTypeScope);
  // The table in the book's style (cs-7; 19-D2): the part's title bar, a head row naming the die over a strong rule,
  // after the typed-roll strip and right over the rows.
  const head = book && <BookTapHead title={part.heading} die={table.die} column="Name" />;
  const body = (
    <>
      <RollRow die={dieOf(table.die)}>{nameSheetRollWords(table)}</RollRow>
      {table.description && <p className="entry-panel__lead">{table.description}</p>}
      {/* In creation the parts are the two-sided switch (cs-7, ds-1d). */}
      {parts.length > 1 && <ButtonRow label="Parts of the name" options={parts.map((p, n) => ({ value: String(n), label: p.heading }))} value={String(at)} onChange={(v) => setTab(Number(v))} sides={book} />}
      {long ? (
        <LongRows label={part.heading} long={long} rowOf={drawRow} role="radiogroup" head={head} />
      ) : (
        <>
          {head}
          <div className="table-sheet__rows" role="radiogroup" aria-label={part.heading}>
            {part.cells.map((cell) => drawRow(cellRow(cell)))}
          </div>
        </>
      )}
      <p className="creation-group__line name-sheet__picked" aria-live="polite">
        {/* Another pack's table says so first, before what is picked (ct-6; mockup creation/final/10). */}
        {fromLabel(table) && `${fromLabel(table)}. `}
        {said ?? pickedNameLine(table, tapped)}
      </p>
      <div className="dialog__actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (!anyTapped) return setSaid('Tap a row first: Use this name puts it in the Name field.');
            onUse();
          }}
        >
          Use this name
        </button>
      </div>
    </>
  );
  if (asSheet) {
    return (
      <Dialog label={table.name} meta={metaOf(table)} onClose={onClose} onBack={onBack} table>
        {body}
      </Dialog>
    );
  }
  return (
    <aside className="entry-panel" aria-label={table.name}>
      <div className="entry-panel__head">
        <h2 className="entry-panel__name">{table.name}</h2>
        {metaOf(table) && <p className="entry-panel__meta">{metaOf(table)}</p>}
        <CloseButton className="entry-panel__close" onClose={onClose} />
      </div>
      {body}
    </aside>
  );
}

/**
 * Roll for a name (R3-1, mockup creation/final/10; replaces the "Name tables: N" fold): one plain button under the
 * Name field (beside it on a tablet, where the row has room) with the die of the table it opens (the first table's
 * with several). One table: its sheet opens at once. Several: a sheet listing them (name, pack, dice) with Open; ← in
 * a table's sheet comes back to the list. Use this name fills the field from that one table and closes; under the
 * field "From <table>, rolled 3 and 14" while the field still holds that name (editing it takes the line off). No
 * table: no button. A hook so Who they are can put the button beside the field: `button`, `fromLine`, `sheet(asSheet)`.
 */
export function useNameRoll({ tables, name, onName }: { tables: readonly CreationTable[]; name: string; onName: (name: string) => void }) {
  // What's tapped, per table and part (kept while the step is open, so a re-roll starts from the marks).
  const [parts, setParts] = useState<Record<string, (string | undefined)[]>>({});
  // 'list' for the list of tables, a table's id for its sheet, null for none.
  const [openId, setOpenId] = useState<string | null>(null);
  // The name Use this name wrote and where it came from, for the line under the field.
  const [came, setCame] = useState<{ name: string; line: string } | null>(null);
  const open = tables.find((t) => t.id === openId) ?? null;
  const several = tables.length > 1;
  const tap = (t: CreationTable, c: number, cell: string) => {
    const own = nameColumns(t).map((_, i) => parts[t.id]?.[i]);
    own[c] = own[c] === cell ? undefined : cell;
    setParts({ ...parts, [t.id]: own });
  };
  const use = (t: CreationTable) => {
    const made = rolledName(t, parts[t.id] ?? []);
    if (!made.name) return;
    onName(made.name);
    setCame({ name: made.name, line: nameFromLine(t.name, made.rolled, made.left) });
    setOpenId(null);
  };
  const first = tables[0];
  const button = first ? (
    <button type="button" className="button-secondary name-roll__button" onClick={() => setOpenId(several ? 'list' : first.id)}>
      <DieGlyphOf die={first.die} />
      Roll for a name
    </button>
  ) : null;
  const fromLine = came && came.name === name ? <p className="creation-group__line name-roll__from">{came.line}</p> : null;
  const list =
    openId === 'list' ? (
      <Dialog label="Roll for a name" onClose={() => setOpenId(null)}>
        <p className="creation-group__line">{`${countWord(tables.length)} tables give names: open one.`}</p>
        <div role="group" aria-label="Name tables">
          {tables.map((t) => (
            <DetailRow key={t.id} label={t.name} note={nameTableLine(t)} action="Open" onOpen={() => setOpenId(t.id)} />
          ))}
        </div>
      </Dialog>
    ) : null;
  return {
    /** Whether the kindred has any name table (no table, no button). */
    has: tables.length > 0,
    button,
    fromLine,
    open,
    sheet: (asSheet: boolean) =>
      list ??
      (open ? (
        <NameTableSheet
          key={open.id}
          table={open}
          tapped={parts[open.id] ?? []}
          onTap={(c, cell) => tap(open, c, cell)}
          onUse={() => use(open)}
          onClose={() => setOpenId(null)}
          onBack={several ? () => setOpenId('list') : undefined}
          asSheet={asSheet}
        />
      ) : null),
  };
}

/** "Two", "Three" … "Ten" (Design on #564: a number word at the start of a line); past ten, the figure. */
const countWord = (n: number) => ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n] ?? String(n);

/** A table's die glyph in the Roll for a name button; none when the pack names no die the app draws. */
function DieGlyphOf({ die }: { die: string }) {
  const size = dieOf(die);
  return size ? <DieGlyph die={size} size={20} /> : null;
}

/** The Name field's Roll for a name, its line and its sheet (the full sheet's Edit; the gallery). */
export function NameRoll({ table, tables, name, onName }: { table?: CreationTable; tables?: readonly CreationTable[]; kindred?: string; name: string; onName: (name: string) => void }) {
  const roll = useNameRoll({ tables: tables ?? (table ? [table] : []), name, onName });
  if (!roll.has) return null;
  return (
    <>
      <div className="name-roll">{roll.button}</div>
      {roll.fromLine}
      {roll.sheet(true)}
    </>
  );
}

/** A body measure's caption (D4): its dice once stepped; untouched, "Average." first, a sentence even with no dice. */
export function usualCaption(diceLine: string, touched: boolean): string {
  if (touched) return diceLine;
  return diceLine ? `${AVERAGE_LINE}. ${diceLine}` : `${AVERAGE_LINE}.`;
}

/**
 * One of age, height and weight with the kindred's usual (Design's answers, 2026-11-06): a typed stepper that starts at
 * the usual and steps by its step; the box takes typing ("5 7", "5'7" or inches for a height). What's kept is the number
 * in the unit; the pack's words are its caption. Below the step the − explains instead of going on.
 */
function UsualStepper({ field, value, touched, onChange }: { field: PhysicalField & { usual: Usual }; value: string; touched: boolean; onChange: (text: string) => void }) {
  const toast = useToast();
  const [typing, setTyping] = useState<string | null>(null);
  const kept = readUsual(field.key, value);
  const { step } = field.usual;
  const id = `details-${field.key}`;
  // The card names its own dice, from the pack's usual (final drafts D); untouched, the average stepper's line first.
  const diceLine = usualDiceLine(field.key, field.usual);
  return (
    <div className={`physical-row physical-row--${field.key}`}>
      <span className="physical-row__text">
        <span className="label" id={`${id}-label`}>
          {field.label}
        </span>
        <span className="physical-row__caption" id={`${id}-hint`}>
          {/* "Average." and the dice with their glyph (D4); the unit is beside the stepper. */}
          <DiceWords>{usualCaption(diceLine, touched)}</DiceWords>
        </span>
      </span>
      {/* Back to the number's own words when the box is left (a height typed "5 7" reads "5 ft 7 in"). */}
      <span className="physical-row__control" onBlur={() => setTyping(null)}>
        <TypedStepper
          id={id}
          label={field.label}
          describedBy={`${id}-hint`}
          value={typing ?? (kept === null ? value : usualBox(field.key, kept))}
          wide={field.key === 'height'}
          average={!touched}
          onChange={(text) => {
            setTyping(text);
            const n = readUsual(field.key, text);
            if (n !== null) onChange(String(n));
            else if (!text.trim()) onChange('');
          }}
          onStep={(by) => {
            setTyping(null);
            const from = kept ?? field.usual.start;
            const next = kept === null ? from : from + by * step;
            if (next < step) return toast({ text: `${field.label} can't go below ${usualWords(field.key, step)}.` });
            onChange(String(next));
          }}
        />
        {/* The unit after the box (a height says its own in the box): one width, so the three steppers line up. */}
        <span className="physical-row__unit" aria-hidden={field.key === 'height'}>
          {field.key === 'height' ? '' : field.usual.unit}
        </span>
      </span>
    </div>
  );
}

/**
 * The Details step (cs-1; mockups creation/11 and 12): age, height and weight first (a stepper starting at the kindred's
 * usual where the pack gives one, else the typed box with the dice under it), then "Looks and manner": each detail table
 * one row (its die and Open, then what was taken with Change), and the growth. **Every table is shown**, in the pack's
 * order, whatever their number, with no "N more tables" fold (Francis, 2026-11-18: "I want all 8 tables on this screen
 * displayed together, no need to divide by two"; this overrules mockup creation/12's "6 more tables"). Optional: Next
 * (or Done from the sheet) saves what's filled in. Never blocks anything.
 */
export function DetailsStep({
  tables,
  kindred,
  physical,
  details,
  title,
  why,
  help,
  counter,
  onBack,
  onSave,
  onDraft,
  busy = false,
}: {
  /** Told of every change, so Back keeps what's filled in (cr-2). */
  onDraft?: (details: CharacterDetails) => void;
  tables: KindredTables;
  kindred: string;
  physical: PhysicalField[];
  details: CharacterDetails;
  title: string;
  why: string;
  help: string | null;
  /** "Step 9 of 10" in creation; left out from the review or the sheet (Done there). */
  counter?: { at: number; of: number };
  onBack: () => void;
  /** Saves; a message back (a failed save, after-test A11) shows on the foot's ▲ line, and Next tries again. */
  onSave: (details: CharacterDetails) => void | string | null | Promise<void | string | null>;
  busy?: boolean;
}) {
  // In creation, an age, height or weight not yet given starts at the kindred's usual (Design, 2026-11-06): what the
  // stepper shows is what Next saves. From the review or the sheet nothing is filled in for the player.
  const [draft, setLocal] = useState<CharacterDetails>(() => (counter ? withUsual(details, physical) : details));
  // Which of age, height and weight keep the typed box (decided when the step opens): no usual, or older free text that
  // doesn't read as a number in the unit, shown unchanged (Design, 2026-11-06).
  const [typedBox] = useState<Set<PhysicalKey>>(() => new Set(physical.filter((p) => !p.usual || (!!details[p.key]?.trim() && readUsual(p.key, details[p.key]!) === null)).map((p) => p.key)));
  // From event handlers only (one change per tap or keystroke), so the parent hears it outside a render.
  const setDraft = (change: (d: CharacterDetails) => CharacterDetails) => {
    const next = change(draft);
    setLocal(next);
    onDraft?.(next);
  };
  const [open, setOpen] = useState<string | null>(null);
  // As the step opened, for From the review's Back to review while nothing changed (P22).
  const [openedWith] = useState(draft);
  // A save that failed (after-test A11): on the foot's ▲ line, not a toast, until the next try.
  const [failed, setFailed] = useState<string | null>(null);
  /** Age, height or weight stepped or typed: no longer the average (a flag, never a comparison of values). */
  const touch = (key: PhysicalKey, text: string) => setDraft((d) => ({ ...d, [key]: text, averaged: (d.averaged ?? []).filter((k) => k !== key) }));
  const pick = (id: string, words: string | null) =>
    setDraft((d) => {
      const next = { ...d.tables };
      if (words) next[id] = words;
      else delete next[id];
      return { ...d, tables: next };
    });
  const count = detailsCount(draft, tables, physical);
  // One row per table (final drafts D): before, its name, whose table and its die with Open; after, what it gave with Change.
  const row = (t: CreationTable) => {
    const words = draft.tables[t.id] ?? '';
    const whose = fromLabel(t) || kindred;
    return words ? (
      <DetailRow key={t.id} picked label={shortTableName(t.name, kindred)} note={fromLabel(t) || undefined} value={filledWords(t, words)} onOpen={() => setOpen(t.id)} />
    ) : (
      <DetailRow key={t.id} label={shortTableName(t.name, kindred)} note={`${[whose, t.die].filter(Boolean).join(', ')}. Not rolled yet`} action="Open" onOpen={() => setOpen(t.id)} />
    );
  };
  // One Roll row over the tables (final drafts D): their die when they share one.
  const tableDice = [...new Set(tables.details.map((t) => t.die).filter(Boolean))];
  const bodyDie = physical.flatMap((p) => p.usual?.parts.flatMap((part) => (part.dice ? [part.dice] : [])) ?? [])[0] ?? '';
  // Every describing table, in the pack's order: none folded away (Francis, 2026-11-18).
  const shown = tables.details;
  const openTable = [...tables.details, ...(tables.growth ? [tables.growth] : [])].find((t) => t.id === open) ?? null;
  const growthWords = draft.growth?.[0] ?? '';
  return (
    <CreationStep
      title={title}
      counter={counter}
      why={why}
      help={help}
      onBack={onBack}
      // No "Skip, leave blank": it only moved on, as Next does (cs-11, dec-10 D).
      hint={failed ?? (count.of === 0 ? 'Nothing to fill in' : count.filled === 0 ? 'Nothing filled yet' : `${count.filled} of ${count.of} filled`)}
      stop={!!failed}
      busy={busy}
      waitsOnline
      unchanged={JSON.stringify(cleanDetails(draft)) === JSON.stringify(cleanDetails(openedWith))}
      nextLabel={counter ? 'Next' : 'Done'}
      onNext={() => {
        setFailed(null);
        void Promise.resolve(onSave(cleanDetails(draft))).then((problem) => {
          if (typeof problem === 'string' && problem) setFailed(problem);
        });
      }}
    >
      {count.of === 0 && <p className="creation-group__line">Your setting has no detail tables for {kindred.toLowerCase()}. Next goes on.</p>}
      {physical.length > 0 && (
        <PickGroup title="Body">
        {/* One Roll row for Body (final drafts D); each card names its own dice. */}
        <RollRow die={dieOf(bodyDie)}>Roll for each at the table, or type them.</RollRow>
        <div className={physical.some((p) => p.usual && !typedBox.has(p.key)) ? 'details-physical details-physical--rows' : 'details-physical'} role="group" aria-label={physical.map((p) => p.label).join(', ')}>
          {physical.map((p) =>
            p.usual && !typedBox.has(p.key) ? (
              <UsualStepper key={p.key} field={{ ...p, usual: p.usual }} value={draft[p.key] ?? ''} touched={!(draft.averaged ?? []).includes(p.key)} onChange={(text) => touch(p.key, text)} />
            ) : (
              // The dice under the box, never "Roll …" outside a Roll row (retest 4 S1): Body's Roll row says to roll.
              <StepField key={p.key} id={`details-${p.key}`} label={p.label} hint={`${p.dice} at the table`}>
                <input
                  id={`details-${p.key}`}
                  className="field__input"
                  type="text"
                  autoComplete="off"
                  maxLength={60}
                  value={draft[p.key] ?? ''}
                  onChange={(event) => setDraft((d) => ({ ...d, [p.key]: event.target.value }))}
                  aria-describedby={`details-${p.key}-hint`}
                />
              </StepField>
            ),
          )}
        </div>
        </PickGroup>
      )}
      {(shown.length > 0 || tables.growth) && (
        <PickGroup title="Looks and manner">
          {/* The die's glyph always (retest 4 S1): the shared die, else the first table's; each row names its own. */}
          {/* "then mark your row": each table's sheet marks, then Take it (cts-5 c, frame TS6). */}
          {shown.length > 0 && <RollRow die={tableDice.length > 0 ? dieOf(tableDice[0]!) : null}>{tableDice.length === 1 ? `Roll ${tableDice[0]} for each, then mark your row. Or type your own.` : 'Roll for each at the table, then mark your row. Or type your own.'}</RollRow>}
          {shown.length > 0 && <div role="group" aria-label="Detail tables">{shown.map(row)}</div>}
          {tables.growth && (
            // Growth (rolled at Level 1; at later levels in M7): for this kindred only. Its own Roll row (retest 2's audit).
            // Cut to the act (cs-8, D4): the row under it names the thing, its die and the level. Its sheet marks too (cts-8).
            <RollRow die={dieOf(tables.growth.die)}>{`${rollWords(tables.growth)}, then mark your row.`}</RollRow>
          )}
          {tables.growth && (
            // A roll at a level is a row like the others (D4): whose, its die and the level, then Open; once rolled, Change.
            growthWords ? (
              <DetailRow picked label={shortTableName(tables.growth.name, kindred)} value={growthWords} onOpen={() => setOpen(tables.growth!.id)} />
            ) : (
              <DetailRow label={shortTableName(tables.growth.name, kindred)} note={`${[kindred, tables.growth.die ? `${tables.growth.die} at level 1` : 'at level 1'].join(', ')}. Not rolled yet`} action="Open" onOpen={() => setOpen(tables.growth!.id)} />
            )
          )}
        </PickGroup>
      )}
      {openTable && (
        <OneTableSheet
          table={openTable}
          kindred={kindred}
          // A long table's sheet says what is picked (cs-15): the detail's own name, as its row shows it.
          title={shortTableName(openTable.name, kindred)}
          picked={openTable.id === tables.growth?.id ? growthWords : draft.tables[openTable.id]}
          // The player's own words at the foot of a describing table (final drafts D), kept on Take it (cts-4); a growth
          // is only rolled.
          own={openTable.id !== tables.growth?.id}
          // Take it closes the sheet itself; Clear leaves it open.
          onPick={(words) => {
            if (openTable.id === tables.growth?.id) setDraft((d) => ({ ...d, growth: words ? [words, ...(d.growth ?? []).slice(1)] : (d.growth ?? []).slice(1) }));
            else pick(openTable.id, words);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </CreationStep>
  );
}

/** The details with each age, height and weight not yet given set to the kindred's usual (Design, 2026-11-06). */
export function withUsual(details: CharacterDetails, physical: readonly PhysicalField[]): CharacterDetails {
  const out: CharacterDetails = { ...details, tables: { ...details.tables } };
  // Each one set here is the average until the player steps or types it (final drafts D, the touched flag).
  const averaged = new Set(details.averaged ?? []);
  for (const p of physical)
    if (p.usual && !details[p.key]?.trim()) {
      out[p.key] = String(p.usual.start);
      averaged.add(p.key);
    }
  if (averaged.size > 0) out.averaged = [...averaged];
  return out;
}
