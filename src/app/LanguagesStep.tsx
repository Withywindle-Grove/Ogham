// The Languages step on the creation step shell (M5b step 0c, slice 6; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md
// cr-15; mockup creation/07; 05 "Guided creation, rebuilt"): Yours already (the common tongue(s), the alignment tongue,
// the race's and the class's: ticked, not untickable; a tap says where it comes from) · Pick N more from the setting's
// list, N from the score's `extraLanguages` (the count stops extra picks and says so) · Other… (a typed language) ·
// the derived line for literacy. Next checks the count; Decide later puts Languages on To finish unless the pack
// requires it. The step is skipped by its caller when there is nothing to pick. The same step opens from the To
// finish card (no counter there). Nothing takes focus by itself (A4).
import { useId, useState } from 'react';
import {
  addOther,
  languageHeadings,
  languagesHint,
  languagesOfPlan,
  languagesProblem,
  numberedBlurb,
  rangeInWords,
  tapLanguage,
  type LanguagePicks,
  type LanguagesPlan,
} from '../modules/characters/languagesStep.ts';
import { SPECIAL_NOTE } from '../modules/characters/creationSteps.ts';
import { ApprovalFold, BookTapTable, CreationStep, languageFoldLabel, EntryPanel, OtherRow, PickGroup, PickRow, type BookTapRow } from '../ui/creation.tsx';
import { dieOf, RollRow } from '../ui/dice.tsx';
import { useToast } from '../ui/ToastHost.tsx';

/** Above this many rows the list gets a search field (mockup creation/07). */
const SEARCH_ABOVE = 12;

export function LanguagesStep({
  plan,
  initial,
  title,
  why,
  help,
  counter,
  derived = [],
  onPicks,
  onSave,
  onLater,
  onBack,
}: {
  plan: LanguagesPlan;
  /** The picks when the step opens (what the character has, else none). */
  initial: LanguagePicks;
  title: string;
  why: string;
  help: string | null;
  /** "Step 9 of 10" in creation; left out from the To finish card. */
  counter?: { at: number; of: number };
  /** Derived lines from the same score ("Literacy: Reads"). */
  derived?: { label: string; value: string }[];
  /** Told of every change, so Back keeps the picks (cr-2). */
  onPicks?: (picks: LanguagePicks) => void;
  /** Saves the whole list (names), with the picks (their special approvals, cs-6); resolves false when it couldn't (the caller says why). */
  onSave: (languages: string[], picks: LanguagePicks) => Promise<boolean>;
  /** Decide later; left out when the step is required. */
  onLater?: () => void;
  onBack: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const [picks, setLocal] = useState<LanguagePicks>(initial);
  // As the step opened, for From the review's Back to review while nothing changed (P22).
  const [openedWith] = useState(initial);
  const setPicks = (next: LanguagePicks) => {
    setLocal(next);
    onPicks?.(next);
  };
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const apply = (result: { picks: LanguagePicks } | { problem: string }) => ('problem' in result ? toast({ text: result.problem }) : setPicks(result.picks));

  async function next() {
    if (busy) return;
    // Next stays tappable and says what's missing (cr-2).
    const problem = languagesProblem(plan, picks, !!onLater);
    if (problem) return toast({ text: problem });
    setBusy(true);
    await onSave(languagesOfPlan(plan, picks), picks);
    setBusy(false);
  }

  const scoreWords = plan.score !== null ? `${plan.ability} ${plan.score}` : plan.ability;
  const pickTitle = plan.count === null ? 'Pick any your GM allows' : `Pick ${plan.count} more`;
  // The count beside the heading too (picture creation/final 20-E3), as Magic and Weapon skills carry theirs.
  const pickMeta = plan.count === null ? undefined : languagesHint(plan, picks);
  const q = query.trim().toLowerCase();
  const shown = q ? plan.offered.filter((o) => o.name.toLowerCase().includes(q) || picks.chosen.includes(o.id)) : plan.offered;
  // With a die (final drafts D, P30; dec-10 E, picture 20-E3): its rows in the die's order as the book's tapped table,
  // the left-out ones closed in their place; then the chosen-only ones under "Others you may choose". Without a die,
  // one list.
  type Offered = LanguagesPlan['offered'][number];
  type Closed = LanguagesPlan['closedRows'][number];
  type Row = { open: Offered; min: number } | { closed: Closed; min: number };
  const numbered: Row[] = [
    ...shown.filter((o) => o.range).map((open) => ({ open, min: Number.parseInt(open.range, 10) || 0 })),
    ...(q ? [] : plan.closedRows.filter((c) => c.range).map((closed) => ({ closed, min: closed.min }))),
  ].sort((a, b) => a.min - b.min);
  const chosenOnly: Row[] = (plan.die ? shown.filter((o) => !o.range) : shown).map((open) => ({ open, min: 0 }));
  // Left out without a number of the die: only counted (a closed row needs its number to say why it's there).
  const unnumbered = plan.die ? plan.closedRows.filter((c) => !c.range).length : plan.closed;
  const languageRow = (row: Row) => {
    if ('closed' in row) {
      const c = row.closed;
      return <PickRow key={`closed:${c.id}`} name={c.name} fit={[{ text: `${rangeInWords(c.range)}.` }, { text: c.reason, warn: true }]} picked={false} closed onPick={() => toast({ text: `${c.reason}: ${c.name} can’t be learnt. Roll again at the table, or choose.` })} />;
    }
    const o = row.open;
    return (
      <PickRow
        key={o.id}
        name={o.name}
        blurb={numberedBlurb(o.range, o.blurb)}
        // With the GM's leave (cs-6, a soft `learnableBy`): picked all the same, the sign on its own line (P31).
        fit={o.leave ? [{ text: SPECIAL_NOTE, warn: true }] : undefined}
        source={o.source || undefined}
        picked={picks.chosen.includes(o.id)}
        onPick={() => apply(tapLanguage(plan, picks, o.id))}
        onOpen={() => setOpened(opened === `list:${o.id}` ? null : `list:${o.id}`)}
      />
    );
  };
  // A numbered row in the table (dec-10 E): a closed one keeps its place and its ▲ reason, and its tap says why; one
  // needing the GM's leave is picked all the same, the sign its line. The build's ⓘ stays beside an open one (cs-30).
  const tableRow = (row: Row): BookTapRow => {
    if ('closed' in row) {
      const c = row.closed;
      return { key: `closed:${c.id}`, range: c.range, name: c.name, warn: c.reason, picked: false, onPick: () => toast({ text: `${c.reason}: ${c.name} can’t be learnt. Roll again at the table, or choose.` }) };
    }
    const o = row.open;
    return {
      key: o.id,
      range: o.range,
      name: o.name,
      line: o.blurb || undefined,
      warn: o.leave ? SPECIAL_NOTE : undefined,
      picked: picks.chosen.includes(o.id),
      onPick: () => apply(tapLanguage(plan, picks, o.id)),
      onOpen: () => setOpened(opened === `list:${o.id}` ? null : `list:${o.id}`),
    };
  };
  // Rows needing the GM's leave, and the never-learnable ones, fold after the open ones in each group, under one row
  // (Francis, retest 2; Design on #555): each row inside keeps its own reason.
  const needsGm = (row: Row) => 'closed' in row || !!row.open.leave;
  const folded = (rows: Row[]) => {
    const gm = rows.filter(needsGm);
    const free = rows.filter((row) => !needsGm(row));
    const closed = gm.filter((row) => 'closed' in row).length;
    return (
      <>
        {free.map(languageRow)}
        <ApprovalFold
          count={gm.length}
          more={free.length > 0}
          label={languageFoldLabel(gm.length, free.length > 0, closed, gm.length - closed)}
          holdsPick={gm.some((row) => 'open' in row && picks.chosen.includes(row.open.id))}
        >
          {gm.map(languageRow)}
        </ApprovalFold>
      </>
    );
  };
  const typedRows = picks.others.map((name) => <PickRow key={`other:${name}`} name={name} blurb="Typed in by you" picked onPick={() => setPicks({ ...picks, others: picks.others.filter((o) => o !== name) })} />);
  const other = <OtherRow label="Another language" blurb="A language the list doesn't have." onAdd={(name) => apply(addOther(plan, picks, name))} onEmpty={() => toast({ text: 'Type the language first, then tap Add.' })} />;

  // The open entry: a given language or one of the list.
  const openGiven = opened?.startsWith('given:') ? plan.given.find((g) => `given:${g.name}` === opened) : undefined;
  const openOffered = opened?.startsWith('list:') ? plan.offered.find((o) => `list:${o.id}` === opened) : undefined;
  const panel =
    openGiven || openOffered ? (
      <EntryPanel
        name={(openGiven ?? openOffered)!.name}
        meta={(openGiven ?? openOffered)!.source || undefined}
        headings={openGiven ? languageHeadings(openGiven) : languageHeadings(openOffered!, plan.die)}
        picked={openGiven ? true : picks.chosen.includes(openOffered!.id)}
        onPick={() => {
          if (openGiven) toast({ text: givenWords(openGiven.from) });
          else apply(tapLanguage(plan, picks, openOffered!.id));
          setOpened(null);
        }}
        onClose={() => setOpened(null)}
        asSheet
      />
    ) : null;

  // What the kindred and class give (final drafts D): marked Given, no button; the text opens the entry. From 700 px it
  // is the second column's job while no entry is open (final draft 4, the creation follow-up); else it heads the list.
  const youSpeak =
    plan.given.length > 0 ? (
      <PickGroup title="You speak">
        {plan.given.map((g) => (
          <PickRow
            key={`given:${g.name}`}
            name={g.name}
            blurb={g.blurb || givenFrom(g.from)}
            source={g.source || undefined}
            picked
            given
            onPick={() => toast({ text: givenWords(g.from) })}
            onOpen={() => setOpened(opened === `given:${g.name}` ? null : `given:${g.name}`)}
          />
        ))}
      </PickGroup>
    ) : null;

  return (
    <CreationStep
      title={title}
      counter={counter}
      why={why}
      help={help}
      helpChoices={plan.offered.map((o) => ({ name: o.name, blurb: o.blurb }))}
      onBack={onBack}
      decideLater={onLater ? { onPick: onLater } : undefined}
      hint={languagesHint(plan, picks)}
      busy={busy}
      waitsOnline
      unchanged={JSON.stringify(picks) === JSON.stringify(openedWith)}
      onNext={() => void next()}
    >
      {youSpeak}
      <PickGroup title={pickTitle} meta={pickMeta}>
        {/* The die in a Roll row (final drafts D; the ruled words, dec-10 E): then the table, every row a tap. */}
        {plan.die && <RollRow die={dieOf(plan.die)}>{`Roll ${plan.die}, or tap any row.`}</RollRow>}
        {plan.offered.length > SEARCH_ABOVE && (
          <div className="field pick-group__search">
            <label className="label" htmlFor={`${id}-search`}>
              Search languages
            </label>
            <input id={`${id}-search`} className="field__input" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
        {plan.offered.length === 0 && <p className="creation-group__line">Your setting lists no other language. Type one with Other…, or ask your GM.</p>}
        {unnumbered > 0 && (
          // A hard `learnableBy` (cs-6) leaves languages out: said once, so the list isn't a mystery.
          <p className="creation-group__line">{`${unnumbered} ${unnumbered === 1 ? 'language your kind can’t learn is' : 'languages your kind can’t learn are'} left out.`}</p>
        )}
        {plan.offered.length > 0 && shown.length === 0 && <p className="creation-group__line">No language by that name. Type it with Other…</p>}
        {plan.die ? numbered.length > 0 && <BookTapTable die={plan.die} column="Language" label={`Rolled on ${plan.die}`} rows={numbered.map(tableRow)} multiple={plan.count !== 1} /> : folded(chosenOnly)}
        {!plan.die && typedRows}
        {!plan.die && other}
      </PickGroup>
      {plan.die && (
        <PickGroup title="Others you may choose">
          {folded(chosenOnly)}
          {typedRows}
          {other}
        </PickGroup>
      )}
      {derived.map((d) => (
        <p key={d.label} className="derived-line">
          {d.label}: <b>{d.value}</b>, from {scoreWords} (Derived values)
        </p>
      ))}
      {panel}
    </CreationStep>
  );
}

/** A given language's line when it has no blurb: where it comes from ("From Stone kin"). */
function givenFrom(from: string): string {
  if (from === 'everyone') return 'Everyone speaks it';
  if (from === 'alignment') return 'The tongue of your alignment';
  return `From ${from}`;
}

/** A given language can't be unticked: where it comes from, in words. */
function givenWords(from: string): string {
  if (from === 'everyone') return 'Everyone speaks it: always yours.';
  if (from === 'alignment') return 'The tongue of your alignment: it follows your alignment.';
  return `Given by ${from}: always yours.`;
}
