// First spells (M5b step 0c, slice 4; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md cr-13; mockup
// creation/05-first-spells), on the creation step shell: the Spell picker's groups (docs/06 Components) as pick rows:
// Given by your class (ticked, a tap says why it can't be unticked) · Pick N from the class list · Roll dN at the table
// (ranges first, tapped, never rolled here; a duplicate says "already yours · roll again") · Cantrips (the class's
// `known` block; named by the class's list for powers or runes, F45) · Learned at level N (dec-1b: a character made above level 1, one group per level of the class's
// `learnByLevel`, the same pick rows and counts). A row opens the spell's full rules with Pick / Unpick. Next checks every count; Decide later puts
// First spells on the To finish card. Next writes the spell book (creation.spellBook.set). A list only: prepare and
// cast are M7's.
import { useId, useState, type ReactNode } from 'react';
import {
  allGiven,
  bookOf,
  emptyLevel,
  EMPTY_LEVEL_WORDS,
  firstSpellsHint,
  firstSpellsProblem,
  fromWords,
  groupCount,
  knownGroupTitle,
  knownShortWhat,
  learnedAllYours,
  learnedOptions,
  learnedWanted,
  learnedTitle,
  LEARNED_ALL_YOURS_WORDS,
  learnKey,
  rollRows,
  rowAlreadyYours,
  shortLevelWords,
  spellBookEntry,
  tapProblem,
  tapped,
  type FirstSpellsPicks,
  type FirstSpellsPlan,
  type LearnKey,
  type RollGroup,
  type RollRow,
  type SpellChoice,
} from '../modules/characters/firstSpells.ts';
import { BookTapTable, CreationStep, EntryPanel, PickGroup, PickRow, type BookTapRow } from '../ui/creation.tsx';
import { dieOf, RollRow as DieRoll } from '../ui/dice.tsx';
import { useToast } from '../ui/ToastHost.tsx';

type Group = 'given' | 'choose' | 'roll' | 'cantrips' | LearnKey;
/** A group the player picks from by ticking spells: Pick N, the cantrips, a Learned at level N. */
type PickKey = 'choose' | 'cantrips' | LearnKey;

/** Above this many rows a group gets a search field (mockup creation/05). */
const SEARCH_ABOVE = 12;

export function FirstSpellsStep({
  plan,
  picks,
  onPicks,
  title,
  counter,
  why,
  help,
  level,
  onBack,
  onSave,
  onLater,
  onReturn,
}: {
  plan: FirstSpellsPlan;
  /** The picks, kept by the caller so Back keeps them. */
  picks: FirstSpellsPicks;
  onPicks: (picks: FirstSpellsPicks) => void;
  title: string;
  /** Left out when the step opens from the review (m5b-0c slice 7). */
  counter?: { at: number; of: number };
  why: string;
  help: string | null;
  /** The character's level, for durations worked out from it. */
  level: number;
  onBack: () => void;
  /** Writes the book (the ids in order); resolves false when it couldn't (the caller says why). */
  onSave: (book: string[]) => Promise<boolean>;
  /** Decide later: writes what's picked so far and puts First spells on the To finish card; left out when required. */
  onLater?: (book: string[]) => Promise<void>;
  /**
   * The Undo of a Pick that moved on (ct-1, a rolled book): the caller shows this step again. Left out, a Pick never
   * moves on (the step waits for Next).
   */
  onReturn?: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // The open entry; `spell`: one spell of a roll row's book, opened from the book's rows (ct-7).
  const [opened, setOpened] = useState<{ group: Group; key: string; spell?: string } | null>(null);
  const [query, setQuery] = useState<Record<string, string>>({});
  const keys = [plan.classId];
  const rows = rollRows(plan);
  // The known group's shortfall line (F45: powers and runes count by their list, sp-2: "Only 3 at this level in your
  // setting"; a level counts in the list's word for it, else "level 0 spell", lv-1).
  const knownWord = knownShortWhat(plan);

  /** What a pick group holds now: Pick N's, the cantrips', or a learned level's (dec-1b). */
  const pickedIn = (group: PickKey): string[] => (group === 'choose' ? picks.chosen : group === 'cantrips' ? picks.cantrips : (picks.learned?.[plan.learned.find((g) => learnKey(g.level) === group)?.level ?? -1] ?? []));
  const isPicked = (group: Group, key: string) => (group === 'given' ? true : group === 'roll' ? rows.some((r) => r.key === key && picks.rolled[r.tableId] === key) : pickedIn(group).includes(key));

  // One roll is the step's only choice (a rolled book, ct-1): a Pick there is one-of-many and moves on at once.
  const readable = plan.rolls.filter((g) => !g.unreadable && g.rows.length > 0);
  const oneOfMany = !!onReturn && readable.length === 1 && !plan.choose && !plan.cantrips && plan.learned.length === 0;

  function tap(group: Group, key: string) {
    const problem = tapProblem(plan, picks, group, key);
    if (problem) return toast({ text: problem });
    if (group === 'given') return;
    const next = tapped(picks, group, key);
    onPicks(next);
    // Pick → Next (ct-1): the book is written and the walk goes on, with "<row> picked · Undo".
    if (oneOfMany && group === 'roll' && next.rolled[readable[0]!.tableId] === key && !firstSpellsProblem(plan, next) && !busy) {
      const row = rows.find((r) => r.key === key);
      const was = picks;
      setOpened(null);
      setBusy(true);
      void onSave(bookOf(plan, next)).then((saved) => {
        setBusy(false);
        if (saved)
          toast({
            text: `${row ? rowName(row) : 'Your roll'} picked`,
            onUndo: () => {
              onPicks(was);
              onReturn?.();
            },
          });
      });
    }
  }

  async function next() {
    if (busy) return;
    const problem = firstSpellsProblem(plan, picks);
    if (problem) return toast({ text: onLater ? `${problem}, or Decide later` : problem });
    setBusy(true);
    await onSave(bookOf(plan, picks));
    setBusy(false);
  }

  async function later() {
    if (busy || !onLater) return;
    setBusy(true);
    await onLater(bookOf(plan, picks));
    setBusy(false);
  }

  // The open entry: a spell's full rules, or a roll row's spells.
  const openSpell = (group: Group, key: string): SpellChoice | undefined =>
    group === 'given'
      ? allGiven(plan).find((s) => s.id === key)
      : group === 'choose'
        ? plan.choose?.options.find((s) => s.id === key)
        : group === 'cantrips'
          ? plan.cantrips?.options.find((s) => s.id === key)
          : group === 'roll'
            ? undefined
            : plan.learned.find((g) => learnKey(g.level) === group)?.options.find((s) => s.id === key);
  const openRow = opened?.group === 'roll' ? rows.find((r) => r.key === opened.key) : undefined;
  // A roll row's book (ct-7): one row per spell; a spell row opens that spell's full rules, ✕ back to the book.
  const bookSpell = openRow && opened?.spell ? openRow.spells.find((s) => s.id === opened.spell) : undefined;
  const shownSpell = opened && opened.group !== 'roll' ? openSpell(opened.group, opened.key) : (bookSpell ?? (openRow?.spells.length === 1 ? openRow.spells[0] : undefined));
  const asBook = !!openRow && !shownSpell;
  const spellBook = shownSpell ? spellBookEntry(shownSpell, keys, level) : null;
  const panel = opened ? (
    <EntryPanel
      name={bookSpell ? bookSpell.name : openRow ? rowName(openRow) : (shownSpell?.name ?? opened.key)}
      meta={shownSpell?.line}
      // The book format (dec-10 S3, E2): the facts as labelled lines, the spell's text its paragraph, the page last.
      headings={spellBook?.headings ?? []}
      description={spellBook?.description}
      source={spellBook?.source ?? ''}
      list={asBook ? openRow.spells.map((s) => ({ key: s.id, name: s.name, line: s.blurb, facts: s.line, onOpen: () => setOpened({ group: 'roll', key: openRow.key, spell: s.id }) })) : undefined}
      // A spell opened from its book reads only: the pick is the book's.
      picked={isPicked(opened.group, opened.key)}
      onPick={bookSpell ? undefined : () => {
        tap(opened.group, opened.key);
        setOpened(null);
      }}
      onClose={() => setOpened(bookSpell ? { group: 'roll', key: opened.key } : null)}
      backTo={bookSpell && openRow ? rowName(openRow) : undefined}
      asSheet
    />
  ) : null;

  const row = (group: Group, s: SpellChoice) => (
    <PickRow
      key={`${group}:${s.id}`}
      name={s.name}
      blurb={s.blurb}
      source={s.line}
      picked={isPicked(group, s.id)}
      // What the class or kindred gives (final drafts D): marked Given, no button.
      given={group === 'given'}
      onPick={() => tap(group, s.id)}
      onOpen={() => setOpened(opened?.group === group && opened.key === s.id ? null : { group, key: s.id })}
    />
  );

  // A rolled table's row (dec-10 E; pictures 20-E1, 20-E2): the result, its line, and the reason it can't be taken;
  // every row stays a tap (a closed one's tap says why, through tapProblem).
  const tableRow = (tableId: string, r: RollRow): BookTapRow => {
    const mine = picks.rolled[tableId] === r.key;
    return {
      key: r.key,
      range: r.range,
      name: r.result || r.spells.map((s) => s.name).join(', '),
      line: rowAlreadyYours(plan, picks, r) && !mine ? 'Already yours: roll again' : r.spells.length === 1 ? r.spells[0]!.blurb : r.spells.length > 1 ? r.spells.map((s) => s.name).join(', ') : undefined,
      warn: r.spells.length === 0 ? "Not among your setting's spells" : undefined,
      picked: mine,
      onPick: () => tap('roll', r.key),
      // The build's ⓘ stays (cs-30): the row's spell, or its book of spells.
      onOpen: r.spells.length > 0 ? () => setOpened({ group: 'roll', key: r.key }) : undefined,
    };
  };

  // A group's rows, filtered by its search field when it has one.
  const searched = (group: PickKey, options: SpellChoice[]): ReactNode => {
    const q = (query[group] ?? '').trim().toLowerCase();
    const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q) || isPicked(group, o.id)) : options;
    return (
      <>
        {options.length > SEARCH_ABOVE && (
          <div className="field pick-group__search">
            <label className="label" htmlFor={`${id}-${group}-search`}>
              Search spells
            </label>
            <input id={`${id}-${group}-search`} className="field__input" type="search" autoComplete="off" value={query[group] ?? ''} onChange={(e) => setQuery({ ...query, [group]: e.target.value })} />
          </div>
        )}
        {shown.length === 0 && <p className="creation-group__line">No spell by that name.</p>}
        {shown.map((s) => row(group, s))}
      </>
    );
  };

  return (
    <CreationStep
      title={title}
      counter={counter}
      why={why}
      help={help}
      onBack={onBack}
      decideLater={onLater ? { onPick: () => void later() } : undefined}
      hint={firstSpellsHint(plan, picks)}
      busy={busy}
      waitsOnline
      onNext={() => void next()}
    >
      {plan.note && <p className="creation-group__line">{plan.note}</p>}
      {plan.kindredNote && <p className="creation-group__line">{plan.kindredNote}</p>}
      {plan.given.length > 0 && (
        <PickGroup title="From your class" meta={plan.magic ? 'always yours' : 'always in your book'}>
          {plan.given.map((s) => row('given', s))}
        </PickGroup>
      )}
      {plan.kindredGiven.length > 0 && (
        <PickGroup title="From your kindred" meta={plan.magic ? 'always yours' : 'always in your book'}>
          {plan.kindredGiven.map((s) => row('given', s))}
        </PickGroup>
      )}
      {plan.choose && (
        // An empty list level asks for nothing (of-2): the group says so and Next goes on.
        <PickGroup title={fromWords(plan, 'class', emptyLevel(plan.choose) ? 'Spells' : `Pick ${plan.choose.count}`)} meta={emptyLevel(plan.choose) ? undefined : groupCount(picks.chosen.length, plan.choose.count)}>
          {/* A level with fewer spells than the count asks for what's there (bq3-15) and says so. */}
          {emptyLevel(plan.choose) ? <p className="creation-group__line">{EMPTY_LEVEL_WORDS}</p> : <>{shortLevelWords(plan.choose) && <p className="creation-group__line">{shortLevelWords(plan.choose)}</p>}{searched('choose', plan.choose.options)}</>}
        </PickGroup>
      )}
      {plan.rolls.map((g) =>
        g.unreadable ? (
          // The pack names a table this setting doesn't share with players (fs-1: a table players read says "gmOnly": false).
          <PickGroup key={`roll:${g.tableId}`} title={fromWords(plan, g.from, 'Rolled at the table')} meta="not shared with players">
            <p className="creation-group__line">Your {g.from} rolls for a first spell on a table this setting doesn't share with players ("{g.table}"). Roll it with your GM at the table; it can't be recorded on this step until the pack opens the table.</p>
          </PickGroup>
        ) : (
          g.rows.length > 0 && <RolledTable key={`roll:${g.tableId}`} heading={plan.fromKindred ? `From your ${g.from}` : null} group={g} rows={g.rows.map((r) => tableRow(g.tableId, r))} />
        ),
      )}
      {plan.cantrips && (
        <PickGroup title={fromWords(plan, 'class', knownGroupTitle(plan, title))} meta={emptyLevel(plan.cantrips) ? undefined : groupCount(picks.cantrips.length, plan.cantrips.count)}>
          {emptyLevel(plan.cantrips) ? <p className="creation-group__line">{EMPTY_LEVEL_WORDS}</p> : <>{shortLevelWords(plan.cantrips, knownWord) && <p className="creation-group__line">{shortLevelWords(plan.cantrips, knownWord)}</p>}{searched('cantrips', plan.cantrips.options)}</>}
        </PickGroup>
      )}
      {/* Learned at level N (dec-1b): after the first spells' picks, one group per level, the same rows as Pick N. */}
      {plan.learned.map((g) => {
        // A spell already in the book from elsewhere isn't listed again; with none left, only the sentence (#633 picture review).
        const allYours = learnedAllYours(plan, picks, g);
        const meta = emptyLevel(g) || allYours ? undefined : groupCount(picks.learned?.[g.level]?.length ?? 0, learnedWanted(plan, picks, g));
        return (
          <PickGroup key={learnKey(g.level)} title={fromWords(plan, 'class', learnedTitle(g, allYours))} meta={meta}>
            {emptyLevel(g) ? (
              <p className="creation-group__line">{EMPTY_LEVEL_WORDS}</p>
            ) : allYours ? (
              <p className="creation-group__line">{LEARNED_ALL_YOURS_WORDS}</p>
            ) : (
              <>
                {shortLevelWords(g) && <p className="creation-group__line">{shortLevelWords(g)}</p>}
                {searched(learnKey(g.level), learnedOptions(plan, picks, g))}
              </>
            )}
          </PickGroup>
        );
      })}
      {panel}
    </CreationStep>
  );
}

/** "1–2 · Glimmer": the range first (cr-13). */
const rowName = (r: RollRow) => [r.range, r.result || r.spells.map((s) => s.name).join(', ')].filter(Boolean).join(': ');

/**
 * A rolled group (dec-10 E; pictures 20-E1, 20-E2): whose it is when a kindred grants magic ("From your kindred"; the
 * table's own name is on its bar, so it is not said twice), the Roll row, then the table in the book's style.
 */
function RolledTable({ heading, group, rows }: { heading: string | null; group: RollGroup & { unreadable?: false; die: string; name: string; column: string }; rows: BookTapRow[] }) {
  const body = (
    <>
      <DieRoll die={dieOf(group.die)}>{`Roll ${group.die || 'the dice'}, then tap the row.`}</DieRoll>
      <BookTapTable title={group.name} die={group.die} column={group.column} label={group.name} rows={rows} />
    </>
  );
  return heading ? <PickGroup title={heading}>{body}</PickGroup> : <div className="pick-group">{body}</div>;
}
