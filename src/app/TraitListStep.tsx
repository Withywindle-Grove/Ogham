// A trait-list step on the creation step shell (M5b step 0c, slice 6; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md
// cr-17; mockup creation/08 §2; first built in M5b step 0b): one step per trait list the sheet fields point at
// (backgrounds, signs…). The list's name is the title, its notes the why-line; with a die, "roll, then tap — or pick"
// and each row's range first. Pick rows: the ✓ picks (one pick), the row opens the entry's full notes and the gear it
// grants, with Pick / Unpick. Other… takes a typed entry with an optional note. Decide later unless the pack requires
// the step. The same step opens from the To finish card (no counter there).
// A list rolled more than once (07 `rolls`, pf-16, ruled 2026-11-13) asks for N picks: the fold's line reads "1 of 2
// picked", Next waits for N, a tap past N says so; without `distinct` an entry may be taken twice or more (its Pick reads "Picked ✓✓", one tick a take),
// with it a second take is refused. Decide later keeps the picks made so far.
// An entry with a spell roll (rc-2 `spells.roll`; bq3-18 A, 2026-11-04) opens the roll under its pick: "From <entry> ·
// roll d12 for one cantrip", the list level's spells numbered for the die, tapped or typed in What you rolled; Next
// asks for it while the level has spells. With N picks, the roll is the first picked entry's that has one.
import { Fragment, useState, type ReactNode } from 'react';
import { EMPTY_LEVEL_WORDS, spellBookEntry } from '../modules/characters/firstSpells.ts';
import {
  addTraitOther,
  tapTraitPick,
  takesOf,
  traitCountLine,
  traitHeadings,
  traitPickName,
  traitPicksOnce,
  traitPicksProblem,
  traitRowName,
  takesLabel,
  takesSpoken,
  takesTicks,
  withoutTake,
  type TraitEntry,
  type TraitList,
  type TraitPick,
} from '../modules/characters/traitLists.ts';
import { rollTyped, spellRollHeading, spellRollProblem, type RolledSpell, type SpellRollPlan } from '../modules/characters/traitSpellRoll.ts';
import { CreationStep, EntryPanel, OtherRow, PickGroup, PickRow, RolledNumber, TableFold } from '../ui/creation.tsx';
import { dieOf, RollRow } from '../ui/dice.tsx';
import { useToast } from '../ui/ToastHost.tsx';

export function TraitListStep({
  list,
  chosen,
  why,
  roll = null,
  help,
  counter,
  itemName = () => undefined,
  rollPlan = () => null,
  rolled: rolledBefore = null,
  onPicks,
  onSave,
  onLater,
  onBack,
}: {
  list: TraitList;
  /** The picks so far (one on a list rolled once; up to its `rolls`, pf-16). */
  chosen: readonly TraitPick[];
  why: string;
  /** The step's Roll row words (traitLines; retest 4 S1), with the list's die; null for a list that is picked. */
  roll?: string | null;
  help: string | null;
  /** "Step 6 of 8" in creation; left out from the To finish card. */
  counter?: { at: number; of: number };
  /** An item's name in the setting, for the gear an entry grants. */
  itemName?: (itemId: string) => string | undefined;
  /** An entry's spell roll in the setting (bq3-18), or null when it has none. */
  rollPlan?: (entry: TraitEntry) => SpellRollPlan | null;
  /** The spell rolled so far for the pick, or null. */
  rolled?: RolledSpell | null;
  /** Told of every change, so Back keeps the picks and the roll (cr-2). */
  onPicks?: (picks: TraitPick[], rolled: RolledSpell | null) => void;
  /** Saves the picks and the spell rolled under one; resolves false when it couldn't (the caller says why). */
  onSave: (picks: TraitPick[], rolled: RolledSpell | null) => Promise<boolean>;
  /**
   * Decide later, with the picks made so far (pf-16: kept) and the spell rolled under one, as Next would save it (the
   * look-back review of #663: a roll handed back as none took the saved one off); left out when the step is required.
   */
  onLater?: (picks: TraitPick[], rolled: RolledSpell | null) => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [picks, setLocal] = useState<TraitPick[]>([...chosen]);
  const pickedIds = (all: readonly TraitPick[]) => all.flatMap((p) => ('entryId' in p ? [p.entryId] : []));
  const [rolled, setRolledLocal] = useState<RolledSpell | null>(rolledBefore && pickedIds(chosen).includes(rolledBefore.entryId) ? rolledBefore : null);
  const [typed, setTyped] = useState(rolled ? String(rolled.roll) : '');
  const setBoth = (next: TraitPick[], roll: RolledSpell | null) => {
    setLocal(next);
    setRolledLocal(roll);
    onPicks?.(next, roll);
  };
  // The entry whose spell roll opens under its row: the first pick that has one.
  const rollEntryOf = (all: readonly TraitPick[]) => pickedIds(all).map((id) => list.entries.find((e) => e.id === id)).find((e) => e?.spellRoll);
  // Another pick drops the roll when it was for an entry no longer the rolling one.
  const setPicks = (next: TraitPick[]) => {
    const keep = rolled && rollEntryOf(next)?.id === rolled.entryId ? rolled : null;
    if (!keep) setTyped('');
    setBoth(next, keep);
  };
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tap = (entryId: string) => {
    const out = tapTraitPick(list, picks, entryId);
    if ('problem' in out) return toast({ text: out.problem });
    setPicks(out.picks);
  };
  const pickedEntry = rollEntryOf(picks);
  const plan = pickedEntry?.spellRoll ? rollPlan(pickedEntry) : null;
  const rollDue = spellRollProblem(plan, rolled);
  // The roll saved with the picks (Next and Decide later): none when the level has no spells.
  const rollToSave = plan && plan.rows.length > 0 ? rolled : null;
  const tapSpell = (n: number, spellId: string) => {
    if (!pickedEntry) return;
    const again = rolled?.roll === n;
    setTyped(again ? '' : String(n));
    setBoth(picks, again ? null : { entryId: pickedEntry.id, spellId, roll: n });
  };
  const typeRoll = (text: string) => {
    setTyped(text);
    if (!plan || !pickedEntry) return;
    const row = rollTyped(plan, text).row;
    setBoth(picks, row ? { entryId: pickedEntry.id, spellId: row.spell.id, roll: row.n } : null);
  };

  async function next() {
    if (busy) return;
    // Next stays tappable and says what's missing (cr-2): one pick, or how many are left (pf-16).
    const missing = traitPicksProblem(list, picks, !!onLater);
    if (missing) return toast({ text: missing });
    if (rollDue) return toast({ text: rollDue });
    setBusy(true);
    await onSave(picks, rollToSave);
    setBusy(false);
  }

  // The open entry: one of the list's, or a spell of the roll ("spell:<id>").
  const openRollRow = opened?.startsWith('spell:') ? plan?.rows.find((r) => `spell:${r.spell.id}` === opened) : undefined;
  const open = opened && !openRollRow ? list.entries.find((e) => e.id === opened) : undefined;
  const rollSpell = openRollRow ? spellBookEntry(openRollRow.spell, [pickedEntry?.spellRoll?.listId ?? ''], 1) : null;
  const spellPanel = openRollRow ? (
    <EntryPanel
      name={openRollRow.spell.name}
      meta={openRollRow.spell.line}
      // The book format (dec-10 S3, E2), as on the First spells step.
      headings={rollSpell!.headings}
      description={rollSpell!.description}
      source={rollSpell!.source}
      picked={rolled?.roll === openRollRow.n}
      onPick={() => {
        tapSpell(openRollRow.n, openRollRow.spell.id);
        setOpened(null);
      }}
      onClose={() => setOpened(null)}
      asSheet
    />
  ) : null;
  // The takes mark on an entry's button, the same wherever that button is drawn: its row and its pop-up (ruled 2026-11-13).
  const takesMark = (takes: number) => (takes > 1 ? { pickedLabel: takesLabel(takes), pickedSpoken: takesSpoken(takes) } : {});
  // The pop-up says "Pick <name>, picked" at one take too, so its spoken form is the same at every count (#671 review).
  const panelMark = (takes: number) => (takes > 0 ? { pickedLabel: takesLabel(takes), pickedSpoken: takesSpoken(takes) } : {});
  const entryPanel = open ? (
    <EntryPanel
      name={open.name}
      meta={open.source || list.source || undefined}
      headings={traitHeadings(list, open, itemName, open.spellRoll ? rollPlan(open)?.what : undefined)}
      picked={takesOf(picks, open.id) > 0}
      {...panelMark(takesOf(picks, open.id))}
      onPick={() => {
        // Unpick takes one take off (pf-16); Pick is the ✓'s tap.
        if (takesOf(picks, open.id) > 0) setPicks(withoutTake(picks, open.id));
        else tap(open.id);
        setOpened(null);
      }}
      onClose={() => setOpened(null)}
      // A sheet at every width (retest 4 T7): the step is one column; only Race and Class keep the pair beside.
      asSheet
    />
  ) : null;
  const panel = spellPanel ?? entryPanel;
  // The fold's "Picked: …" names the list's own entries (a typed one shows in its own row below).
  const entryNames = picks.flatMap((p) => ('entryId' in p ? [traitPickName(list, p)] : []));
  // Each entry once, with its ticks when taken more than once, as on its row (ruled 2026-11-13); the ticks are hidden
  // from a screen reader, which hears the count instead ("Heron, picked twice, Frog in frost picked"); when the last
  // entry carries the count, the closing "picked" is not said again.
  const once = traitPicksOnce(list, picks);
  const lastTwice = (once.at(-1)?.takes ?? 0) > 1;
  const pickedWords: ReactNode =
    once.length > 0 ? (
      <>
        {once.map((p, at) => (
          <Fragment key={at}>
            {at > 0 && ', '}
            {p.name}
            {p.takes > 1 && (
              <>
                <span aria-hidden="true">{` ${takesTicks(p.takes)}`}</span>
                <span className="visually-hidden">{`, ${takesSpoken(p.takes)}`}</span>
              </>
            )}
          </Fragment>
        ))}
        {lastTwice ? <span aria-hidden="true"> picked</span> : ' picked'}
      </>
    ) : (
      ''
    );
  const countLine = traitCountLine(list, picks);
  const left = list.rolls - picks.length;
  const hint =
    list.rolls > 1 && left > 0
      ? `${countLine}. Pick ${left} more${onLater ? ', or Decide later' : ''}`
      : picks.length > 0
        ? rollDue && plan
          ? (
              <>
                {pickedWords}. Roll for your {plan.what}
              </>
            )
          : pickedWords
        : onLater
          ? 'Pick one, or Decide later'
          : 'Pick one';
  // The roll opens under the pick (bq3-18): its rows numbered for the die, or the empty level's line (of-2).
  const rollGroup =
    pickedEntry && plan ? (
      <PickGroup title={spellRollHeading(pickedEntry.name, plan)} meta={plan.rows.length === 0 || rolled ? undefined : 'at the table, then tap what it shows'}>
        {plan.rows.length === 0 ? (
          <p className="creation-group__line">{EMPTY_LEVEL_WORDS}</p>
        ) : (
          <>
            <RolledNumber value={typed} onChange={typeRoll} line={rollTyped(plan, typed).line} />
            {plan.rows.map((r) => (
              <PickRow
                key={r.spell.id}
                name={`${r.n}: ${r.spell.name}`}
                blurb={r.spell.blurb}
                source={r.spell.line}
                picked={rolled?.roll === r.n}
                onPick={() => tapSpell(r.n, r.spell.id)}
                onOpen={() => setOpened(opened === `spell:${r.spell.id}` ? null : `spell:${r.spell.id}`)}
              />
            ))}
          </>
        )}
      </PickGroup>
    ) : null;

  return (
    <CreationStep
      title={list.name}
      counter={counter}
      why={why}
      roll={roll ? <RollRow die={dieOf(list.die)}>{roll}</RollRow> : undefined}
      help={help}
      helpChoices={list.entries.map((e) => ({ name: e.name, blurb: e.blurb }))}
      onBack={onBack}
      decideLater={onLater ? { onPick: () => onLater(picks, rollToSave) } : undefined}
      hint={hint}
      busy={busy}
      onNext={() => void next()}
    >
      <div role="group" aria-label={list.name}>
        {/* The step's one list, so it starts open (m5b-one-table-open, 2026-11-09: a step that is only one table or
            trait list is never collapsed); its fold row names the count and the pick, or "1 of 2 picked" (pf-16). */}
        <TableFold alone count={list.entries.length} picked={entryNames.length > 0 ? entryNames.join(', ') : null} {...(countLine ? { note: countLine } : {})}>
        {list.entries.map((entry) => {
          const takes = takesOf(picks, entry.id);
          return (
            <Fragment key={entry.id}>
              <PickRow
                name={traitRowName(list, entry)}
                blurb={entry.blurb}
                fit={entry.items.length > 0 ? [{ text: `starts with ${entry.items.map((i) => itemName(i.itemId) ?? i.itemId).join(', ')}` }] : undefined}
                source={entry.source || undefined}
                picked={takes > 0}
                // The takes mark (no `distinct`, pf-16; the lead's rulings of 2026-11-13): one tick a take, Picked ✓✓,
                // ✓✓✓…, the shape of Weapon skills' Specialised ✓✓, heard as "picked twice"; the name stays bare.
                {...takesMark(takes)}
                onPick={() => tap(entry.id)}
                onOpen={() => setOpened(opened === entry.id ? null : entry.id)}
              />
              {pickedEntry?.id === entry.id && rollGroup}
            </Fragment>
          );
        })}
        </TableFold>
        {picks.map((p, at) =>
          'other' in p ? <PickRow key={`other-${at}`} name={p.other} blurb={p.note || 'Typed in by you'} picked onPick={() => setPicks(picks.filter((_, i) => i !== at))} /> : null,
        )}
        <OtherRow
          label={`Your own ${list.name.toLowerCase()}`}
          blurb="One the list doesn't have."
          withNote
          max={60}
          onAdd={(name, note) => {
            const out = addTraitOther(list, picks, name, note);
            if ('problem' in out) return toast({ text: out.problem });
            setPicks(out.picks);
          }}
          onEmpty={() => toast({ text: 'Type a name first, then tap Add.' })}
        />
      </div>
      {panel}
    </CreationStep>
  );
}
