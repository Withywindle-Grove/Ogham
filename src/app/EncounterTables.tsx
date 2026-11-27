// Encounter tables, full screen (M5b step g3; docs/05 "Encounter tables, full screen", M5 gate B2, ruled 2026-11-01;
// docs/06 "Encounter tables (full screen)"; mockup design/mockups/m5-gate/b2-encounter-tables.html). The GM's alone:
// tables never reach players' devices.
//   * EncounterTables: two full screens. "Which table?" is one flat list, the row is the target (pins for this
//     session, then the hit's candidates with the likely one first, then the rest, then All N tables ›). "The table":
//     the die in the header, rows as range · result with a one-line description at every level; the GM taps the
//     rolled row and that's the result (the caller logs it, with Undo); a row leading to another table opens it next
//     ("Abbey › Mortal"), the current terrain's when the row splits by terrain (ga-2), the others as chips at the
//     top for the GM to pick instead; Go to number on long tables; column chips only when the table has columns, the route's
//     column picked to start. No Enter roll anywhere; the app never rolls.
//   * EncounterTablesRow: Explore's one row, "Encounter tables · Abbey likely · 1 pinned ›".
//   * TablesLibrary: "Table library ›", the table library full screen, the only place the pin button shows (prep); a table
//     opened there is for reading (nothing is recorded).
//   * TableRoll: a typed roll reads the row, for the tables that aren't encounter tables (a procedure step's roll,
//     the weather, an escape roll).
//   * TableRollPopUp: "Roll…" on a check that is a roll on its table (sf-5; page 44, EN2, EN4 B, EN7 D to F): the table in
//     a pop-up, a tap on a row the answer; opened again from "Change…" with the picked row ticked.
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { tableTag, tablesRowWords, type TableListRow } from '../modules/expedition/tableList.ts';
import { missingWords } from '../modules/expedition/rowLinks.ts';
import { linkedTables, pickColumns, resultWords, rowCountShown, rowFor, rowLabel, rowLeadsTo, rowNextChoices, rowText, tableLookup, type ReadTable, type RowReading, type TableRow, type TerrainKey } from '../modules/expedition/tables.ts';
import { BookTapTable, BookType, CreationLoading } from '../ui/creation.tsx';
import { CentredPopUpScope, Dialog, SheetScope } from '../ui/Dialog.tsx';
import { DiceWords, RollRow, dieOf } from '../ui/dice.tsx';
import { Chip } from '../ui/parts.tsx';
import './SceneExplore.css';
import './EncounterTables.css';

/** Type the roll, read the row. Says plainly when the roll doesn't fit the table. */
export function TableRoll({
  table,
  column,
  onRead,
}: {
  table: ReadTable;
  column: string | null;
  onRead: (reading: Extract<RowReading, { ok: true }>, typed: string) => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const reading = rowFor(table, typed, column);
    if (!reading.ok) {
      setShown(null);
      return setProblem(reading.message);
    }
    setProblem(null);
    setShown(resultWords(reading.result, rowCountShown(reading.row) ? reading.count : null));
    onRead(reading, typed.trim());
  }

  return (
    <form className="table-roll" onSubmit={submit}>
      <label className="label" htmlFor={id}>
        {table.die ? `${table.name} (${table.die}): enter the roll` : `${table.name}: enter the roll`}
      </label>
      <div className="table-roll__row">
        <input
          id={id}
          className="field__input field__input--short"
          type="text"
          inputMode={table.composite ? 'text' : 'numeric'}
          autoComplete="off"
          maxLength={7}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
        <button type="submit" className="button-secondary">
          Read the row
        </button>
      </div>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
      {shown && (
        <p className="table-roll__result" role="status">
          {shown}
        </p>
      )}
    </form>
  );
}

/** One table in a list: name · tag, its description under it, › at the end; the whole row is the target. */
export function TableListItem({ table, tag, onOpen, pin }: { table: ReadTable; tag: string; onOpen: () => void; pin?: { on: boolean; onToggle: () => void } }) {
  return (
    <div className="table-item">
      <button type="button" className="table-item__open" onClick={onOpen}>
        <span className="table-item__text">
          <span className="table-item__name">{table.name}</span>
          {/* A die named in the tag takes its glyph (ds-3, the #785 review): ", ⬡ d6". */}
          {tag && (
            <span className="table-item__tag">
              {', '}
              <DiceWords>{tag}</DiceWords>
            </span>
          )}
          {table.description && <span className="table-item__desc">{table.description}</span>}
        </span>
        <span className="table-item__chev" aria-hidden="true">
          ›
        </span>
      </button>
      {pin && (
        <button type="button" className={pin.on ? 'table-item__pin table-item__pin--on' : 'table-item__pin'} aria-pressed={pin.on} aria-label={pin.on ? `Unpin ${table.name}` : `Pin ${table.name}`} onClick={pin.onToggle}>
          {pin.on ? 'Pinned' : 'Pin'}
        </button>
      )}
    </div>
  );
}

/** What a tapped row recorded, for the caller to log: the tables it went through, the row's range and its words. */
export interface TableTap {
  table: ReadTable;
  /** The tables from the first to this one ("Abbey", "Mortal"). */
  trail: string[];
  row: TableRow;
  roll: string;
  words: string;
  /** "Abbey › Mortal: Pilgrims · 1d6". */
  rowText: string;
}

/**
 * What a tap on a row records (`TableTap`): the row's range, its words with the group's count where the row's count is
 * the group's (pf-2), and "Abbey › Mortal: Pilgrims · 1d6". One rule for every tapped table: the full screen's rows and
 * a check's table opened in its card (B9; page 24, WY1b).
 */
export function tapOf(table: ReadTable, trail: readonly string[], row: TableRow, column: string | null): TableTap {
  const words = resultWords(rowText(table, row, column), rowCountShown(row) ? row.count : null);
  return { table, trail: [...trail], row, roll: rowLabel(row) || '—', words, rowText: `${trail.join(' › ')}: ${words}` };
}

/** The table, full screen's body: chips, Go to number, then the rows; a tap on a row is the result (with onTap). */
export function TableRows({
  table,
  trail,
  context,
  column: startColumn,
  lit,
  describe,
  leadsTo,
  switchTable,
  onTap,
}: {
  table: ReadTable;
  trail: string[];
  /** Where it's open from ("Wandering beasts · Hit"), before the table's description. */
  context?: string | null;
  /** The route's column, picked to start (the first column without one). */
  column: string | null;
  /** The row tapped, lit. */
  lit: number | null;
  /** A row's one-line description: its note, or the stat block's description. */
  describe: (row: TableRow) => string | null;
  /** The name of the table a row leads to, if any. */
  leadsTo: (row: TableRow, column: string | null) => string | null;
  /** A row that splits by terrain opened this table (ga-2): the tables it may open, this one pressed; a tap opens another. */
  switchTable?: { choices: { id: string; name: string }[]; onPick: (id: string) => void };
  onTap?: (tap: TableTap, column: string | null) => void;
}) {
  const columns = pickColumns(table);
  const [column, setColumn] = useState<string | null>(columns.length ? (startColumn && columns.includes(startColumn) ? startColumn : columns[0]!) : (table.columns[0] ?? null));
  const rowRefs = useRef(new Map<number, HTMLElement>());
  // Go to number on long tables, when a number can find a row (a lookup's rows by key alone have none).
  const long = table.rows.length > 20 && findsByNumber(table);

  const lead = [context, table.description].filter(Boolean).join(', ');
  return (
    <div className="table-rows">
      {lead && <p className="table-rows__lead">{lead}</p>}
      {table.note && <p className="table-rows__lead">{table.note}</p>}
      {switchTable && switchTable.choices.length > 1 && (
        <div className="table-rows__chips" role="group" aria-label="Table by terrain">
          {switchTable.choices.map((c) => (
            <Chip key={c.id} pressed={c.id === table.id} onClick={() => c.id !== table.id && switchTable.onPick(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}
      {columns.length > 0 && (
        <div className="table-rows__chips" role="group" aria-label="Column">
          {columns.map((c) => (
            <Chip key={c} pressed={c === column} onClick={() => setColumn(c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}
      {long && (
        <GoToNumber
          table={table}
          column={column}
          onFound={(index) => {
            const el = rowRefs.current.get(index);
            el?.scrollIntoView?.({ block: 'center' });
            el?.focus({ preventScroll: true });
          }}
        />
      )}
      <ol className="table-rows__list" aria-label={trail.join(' › ')}>
        {table.rows.map((row, index) => {
          const result = rowText(table, row, column);
          const next = leadsTo(row, column);
          const desc = describe(row);
          const tag = [rowCountShown(row) ? row.count : null, next ? `opens ${next} ›` : null, index === lit ? 'rolled' : null].filter(Boolean).join(', ');
          const body = (
            <>
              <span className={row.label ? 'table-rows__range table-rows__range--key' : 'table-rows__range'}>{rowLabel(row)}</span>
              <span className="table-rows__text">
                <span className="table-rows__result">{result}</span>
                {tag && <span className="table-rows__tag">{`, ${tag}`}</span>}
                {desc && <span className="table-rows__desc">{desc}</span>}
                {row.missing && row.missing.length > 0 && <span className="table-rows__desc">{missingWords(row.missing)}</span>}
              </span>
            </>
          );
          const className = index === lit ? 'table-rows__row table-rows__row--lit' : 'table-rows__row';
          const keep = (el: HTMLElement | null) => {
            if (el) rowRefs.current.set(index, el);
            else rowRefs.current.delete(index);
          };
          return (
            <li key={index}>
              {onTap ? (
                <button
                  ref={keep}
                  type="button"
                  className={className}
                  aria-current={index === lit ? 'true' : undefined}
                  onClick={() => onTap(tapOf(table, trail, row, column), column)}
                >
                  {body}
                </button>
              ) : (
                <div ref={keep} className={className} tabIndex={-1}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A number can find a row of this table (a lookup's rows by key alone have none). */
function findsByNumber(table: ReadTable): boolean {
  return table.rows.some((r) => r.min !== null || r.key !== null);
}

/** Go to number (the tables' screen's form): a number typed finds its row; one that fits no row says why. */
function GoToNumber({ table, column, onFound }: { table: ReadTable; column: string | null; onFound: (index: number) => void }) {
  const goId = useId();
  const [goTo, setGoTo] = useState('');
  const [goProblem, setGoProblem] = useState<string | null>(null);
  function go(event: FormEvent) {
    event.preventDefault();
    const reading = rowFor(table, goTo, column);
    if (!reading.ok) return setGoProblem(reading.message);
    setGoProblem(null);
    onFound(reading.index);
  }
  return (
    <form className="table-rows__go" onSubmit={go}>
      <label className="label" htmlFor={goId}>
        Go to number
      </label>
      <div className="table-roll__row">
        <input
          id={goId}
          className="field__input field__input--short"
          type="text"
          inputMode={table.composite ? 'text' : 'numeric'}
          autoComplete="off"
          maxLength={7}
          value={goTo}
          onChange={(event) => setGoTo(event.target.value)}
        />
        <button type="submit" className="button-secondary">
          Go
        </button>
      </div>
      {goProblem && (
        <p className="form-error" role="alert">
          {goProblem}
        </p>
      )}
    </form>
  );
}

/**
 * "Roll…"'s pop-up (sf-5; page 44, EN2, EN4 B, EN7 D to F, approved 2026-11-26): the table's name and the X, "Roll d20,
 * then tap the row.", and the table in the book's tapped form. A tap on a row is the answer (`onRow`, once); the X
 * records nothing. `picked` (from "Change…") ticks the row picked before. A table with more numbers than 20 (a d100), or
 * more than 20 rows, has "Go to number": the row found comes to the top of the rows, marked by a rule (N2), not picked.
 * `table` null: still loading, nothing for 300 ms, then a line and skeleton rows. Centred on a tablet, fitted to its
 * table up to 720 px; a sheet from the foot on a phone; a tall table keeps its head and roll row while the rows scroll.
 */
export function TableRollPopUp({
  title,
  table,
  tables,
  describe,
  picked = null,
  onRow,
  onClose,
}: {
  title: string;
  table: ReadTable | null;
  tables: ReadonlyMap<string, ReadTable>;
  describe: (row: TableRow) => string | null;
  /** The row picked before (its index), ticked: opened from "Change…". */
  picked?: number | null;
  onRow: (tap: TableTap) => void;
  onClose: () => void;
}) {
  const [found, setFound] = useState<number | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const column = table ? (pickColumns(table)[0] ?? table.columns[0] ?? null) : null;
  const known = tableLookup(tables.keys());
  const lineOf = (row: TableRow) => {
    const id = table ? rowLeadsTo(table, row, column, known) : null;
    const next = id ? (tables.get(id)?.name ?? id) : null;
    return [next ? `opens ${next} ›` : null, describe(row)].filter(Boolean).join(' ') || null;
  };
  const die = table?.die ? dieOf(table.die) : null;
  const goes = !!table && findsByNumber(table) && (table.rows.length > 20 || (die ?? 0) > 20);
  // The row found comes first in the rows' own scroll, and takes focus so Enter taps it. After the render that marks it
  // (its row is drawn anew inside the found cell); each Go brings it up again, the same row too.
  const [going, setGoing] = useState(0);
  const bringUp = (index: number) => {
    setFound(index);
    setGoing((n) => n + 1);
  };
  // A row to the top of the rows' own scroll, its tap taking the focus (a button, never a field).
  const toTop = (index: number) => {
    const rows = body.current?.querySelector<HTMLElement>('.table-sheet__rows');
    const row = rows?.children[index] as HTMLElement | undefined;
    if (!rows || !row) return;
    rows.scrollTop += row.getBoundingClientRect().top - rows.getBoundingClientRect().top;
    (row.matches('[role="radio"]') ? row : row.querySelector<HTMLElement>('[role="radio"]'))?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (found !== null) toTop(found);
  }, [found, going]);
  // Opened from "Change…" (sf-4; #111's finding 1): the row picked before is in view and has the focus, after the
  // pop-up's own first focus (its effect runs after this one's, so this waits a tick).
  const ticked = useRef(picked);
  const loaded = table !== null;
  useEffect(() => {
    const at = ticked.current;
    if (!loaded || at === null) return;
    const timer = setTimeout(() => toTop(at));
    return () => clearTimeout(timer);
  }, [loaded]);
  return (
    <SheetScope.Provider value>
      <CentredPopUpScope.Provider value>
        <Dialog label={table?.name ?? title} onClose={onClose}>
          {table ? (
            <div ref={body} className="roll-pop">
              <RollRow die={die}>{table.die ? `Roll ${table.die}, then tap the row.` : 'Roll, then tap the row.'}</RollRow>
              {goes && <GoToNumber table={table} column={column} onFound={bringUp} />}
              <BookType>
                <BookTapTable
                  die={table.die ?? ''}
                  column={column ?? 'Encounter'}
                  label={table.name}
                  rows={table.rows.map((row, index) => ({
                    key: String(index),
                    range: rowLabel(row),
                    name: rowText(table, row, column),
                    ...(lineOf(row) ? { line: lineOf(row)! } : {}),
                    picked: index === picked,
                    found: index === found,
                    onPick: () => onRow(tapOf(table, [table.name], row, column)),
                  }))}
                />
              </BookType>
            </div>
          ) : (
            <CreationLoading line="Loading the table…" />
          )}
        </Dialog>
      </CentredPopUpScope.Provider>
    </SheetScope.Provider>
  );
}

/**
 * The two full screens a hit (or Explore's row) opens. `onTap` records the row (the caller logs it, shows the toast
 * with Undo, and calls `unlight` if it's undone); a row leading to another table then opens it.
 */
export function EncounterTables({
  title,
  meta,
  context,
  list,
  missing,
  tables,
  column,
  describe,
  terrain = null,
  onTap,
  onClose,
  library,
}: {
  /** Which table?'s title ("Wandering beasts · Hit", "Encounter tables"). */
  title: string;
  meta?: string;
  /** Where it's open from, for the table's lead line. */
  context?: string | null;
  list: TableListRow[];
  /** Candidates and pins the setting rules don't have. */
  missing: string[];
  tables: ReadonlyMap<string, ReadTable>;
  column: string | null;
  describe: (row: TableRow) => string | null;
  /** Where the party is: a row splitting by terrain opens this terrain's table (ga-2). */
  terrain?: TerrainKey | null;
  onTap: (tap: TableTap, unlight: () => void) => void;
  onClose: () => void;
  /**
   * The table library's way in ("Table library ›", `TablesLibrary`), at the list's foot, when opened from the band's row: the
   * band keeps one way to the tables during an expedition (the approval's fix 3, 2026-11-18), and the pins stay reachable.
   */
  library?: ReactNode;
}) {
  // Each table opened, with the tables the row that opened it could have opened (ga-2; empty unless it splits by terrain).
  const [steps, setSteps] = useState<{ id: string; choices: string[] }[]>([]);
  const path = steps.map((s) => s.id);
  const setPath = (ids: string[]) => setSteps(ids.map((id) => ({ id, choices: [] })));
  const [all, setAll] = useState(false);
  const [lit, setLit] = useState<Map<string, number>>(new Map());
  const known = tableLookup(tables.keys());
  const table = path.length ? (tables.get(path[path.length - 1]!) ?? null) : null;
  const trail = path.map((id) => tables.get(id)?.name ?? id);
  const leadsTo = (from: ReadTable) => (row: TableRow, col: string | null) => {
    const id = rowLeadsTo(from, row, col, known, terrain);
    return id ? (tables.get(id)?.name ?? id) : null;
  };
  const back = () => setSteps((p) => p.slice(0, -1));
  const step = steps[steps.length - 1];

  if (table) {
    const key = path.join('/');
    return (
      <Dialog key={key} full label={trail.join(' › ')} meta={table.die ? `Roll ${table.die}` : undefined} onBack={back} onClose={onClose}>
        <TableRows
          table={table}
          trail={trail}
          context={context}
          column={column}
          lit={lit.get(key) ?? null}
          describe={describe}
          leadsTo={leadsTo(table)}
          switchTable={
            step && step.choices.length > 1
              ? {
                  choices: step.choices.map((id) => ({ id, name: tables.get(id)?.name ?? id })),
                  onPick: (id) => setSteps((p) => [...p.slice(0, -1), { id, choices: step.choices }]),
                }
              : undefined
          }
          onTap={(tap, col) => {
            const index = table.rows.indexOf(tap.row);
            setLit((m) => new Map(m).set(key, index));
            onTap(tap, () =>
              setLit((m) => {
                const next = new Map(m);
                next.delete(key);
                return next;
              }),
            );
            const next = rowLeadsTo(table, tap.row, col, known, terrain);
            const choices = rowNextChoices(tap.row, terrain, known).filter((id) => !path.includes(id));
            if (next && !path.includes(next)) setSteps((p) => [...p, { id: next, choices }]);
          }}
        />
      </Dialog>
    );
  }

  const listed = new Set(list.map((r) => r.tableId));
  const others = [...tables.values()].filter((t) => !listed.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Dialog key="list" full label={title} meta={meta} onClose={onClose}>
      {tables.size === 0 ? (
        <p className="table-rows__lead">No encounter tables in this setting. A pack with tables adds them here.</p>
      ) : (
        <div className="table-list">
          {list.map((row) => {
            const t = tables.get(row.tableId)!;
            return <TableListItem key={row.tableId} table={t} tag={tableTag(row, t.die)} onOpen={() => setPath([row.tableId])} />;
          })}
          {all && others.map((t) => <TableListItem key={t.id} table={t} tag={t.die ?? ''} onOpen={() => setPath([t.id])} />)}
          {!all && others.length > 0 && (
            <button type="button" className="button-quiet table-list__all" onClick={() => setAll(true)}>
              {`All ${tables.size} tables ›`}
            </button>
          )}
          {missing.length > 0 && <p className="table-rows__lead">{`Not in your setting rules: ${missing.join(', ')}. Read ${missing.length === 1 ? 'it' : 'them'} from your book.`}</p>}
        </div>
      )}
      {library}
    </Dialog>
  );
}

/** Explore's row: "Encounter tables · Abbey likely · 1 pinned ›"; with no tables, says so. */
export function EncounterTablesRow({ likely, pins, none, onOpen }: { likely: string | null; pins: number; none: boolean; onOpen: () => void }) {
  if (none) return <p className="encounter-row__none">No encounter tables in this setting</p>;
  const words = tablesRowWords(likely, pins);
  return (
    <button type="button" className="encounter-row" onClick={onOpen}>
      <span className="encounter-row__text">
        <span className="encounter-row__name">Encounter tables</span>
        {words && <span className="encounter-row__tag">{`, ${words}`}</span>}
      </span>
      <span className="encounter-row__chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

/**
 * "Table library ›", the table library, full screen: every table of the setting rules by name (a Find box past 8), a pin
 * button on each (the only place it shows; pins belong to this session, or the next between sessions). A table
 * opened here is for reading: nothing is recorded.
 */
export function TablesLibrary({
  tables,
  pinned,
  onPin,
  describe,
  terrain = null,
}: {
  tables: ReadonlyMap<string, ReadTable>;
  /** The tables pinned now; null while they load (or can't be read: no pin buttons then). */
  pinned: ReadonlySet<string> | null;
  onPin?: (tableId: string, on: boolean) => void;
  describe: (row: TableRow) => string | null;
  /** Where the party is: a row splitting by terrain names this terrain's table (ga-2); all its tables are listed. */
  terrain?: TerrainKey | null;
}) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const findId = useId();
  const known = tableLookup(tables.keys());
  const list = [...tables.values()].sort((a, b) => a.name.localeCompare(b.name));
  const shown = list.filter((t) => t.name.toLowerCase().includes(find.trim().toLowerCase()));
  const table = path.length ? (tables.get(path[path.length - 1]!) ?? null) : null;
  const trail = path.map((id) => tables.get(id)?.name ?? id);
  const close = () => {
    setOpen(false);
    setPath([]);
  };
  return (
    <>
      <button type="button" className="button-quiet tables-link" onClick={() => setOpen(true)}>
        Table library ›
      </button>
      {open && table && (
        <Dialog key={path.join('/')} full label={trail.join(' › ')} meta={table.die ? `Roll ${table.die}` : undefined} onBack={() => setPath((p) => p.slice(0, -1))} onClose={close}>
          <TableRows
            table={table}
            trail={trail}
            column={null}
            lit={null}
            describe={describe}
            leadsTo={(row, col) => {
              const id = rowLeadsTo(table, row, col, known, terrain);
              return id ? (tables.get(id)?.name ?? id) : null;
            }}
          />
          <div className="table-list">
            {linkedTables(table, known, terrain)
              .filter((id) => !path.includes(id))
              .map((id) => (
                <TableListItem key={id} table={tables.get(id)!} tag={tables.get(id)!.die ?? ''} onOpen={() => setPath((p) => [...p, id])} />
              ))}
          </div>
        </Dialog>
      )}
      {open && !table && (
        <Dialog key="library" full label="Table library" meta={list.length === 1 ? '1 in this setting' : `${list.length} in this setting`} onClose={close}>
          {list.length === 0 ? (
            <p className="table-rows__lead">No tables in your setting rules yet. A pack with tables adds them here.</p>
          ) : (
            <div className="table-list">
              {list.length > 8 && (
                <label className="field" htmlFor={findId}>
                  <span className="label">Find a table</span>
                  <input id={findId} className="field__input" type="search" value={find} onChange={(e) => setFind(e.target.value)} />
                </label>
              )}
              {shown.length === 0 && <p className="table-rows__lead">{`No table's name has "${find.trim()}" in it.`}</p>}
              {shown.map((t) => (
                <TableListItem
                  key={t.id}
                  table={t}
                  tag={[t.die, pinned?.has(t.id) ? 'pinned' : null].filter(Boolean).join(', ')}
                  onOpen={() => setPath([t.id])}
                  pin={pinned && onPin ? { on: pinned.has(t.id), onToggle: () => onPin(t.id, !pinned.has(t.id)) } : undefined}
                />
              ))}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
