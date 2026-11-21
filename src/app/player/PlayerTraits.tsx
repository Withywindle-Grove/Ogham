import { useState } from 'react';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import type { Db } from '../../core/supabase.ts';
import { pinToAtHand } from '../../modules/characters/pins.ts';
import { pinnedTraits, traitsWithUsesOf, useAbility, type CharacterPlay, type LimitedAbility } from '../../modules/characters/playState.ts';
import { Dialog } from '../../ui/Dialog.tsx';
import { ListRow, PinnedName, PinStar, RowList, SourceLine, UseDots, UsePips } from '../../ui/parts.tsx';
import { useToast } from '../../ui/ToastHost.tsx';
import type { characterFigures } from '../fromSetting.ts';
import { registry } from '../services.ts';
import { SheetSection } from '../SheetSection.tsx';

/** One rules pop-up's ending: who says so. */
const sourceLine = (source: string | null) => (source ? <SourceLine>From your setting: {source}</SourceLine> : null);

/** The character's traits with uses: the class's and race's, then the picked trait-list entries' (G-213). */
export function traitsWithUses(figures: ReturnType<typeof characterFigures>, level: number, more: readonly LimitedAbility[] = []): LimitedAbility[] {
  return traitsWithUsesOf(figures.klass, figures.race, level, more);
}

/**
 * Traits with uses (ruled 2026-10-26 as "Abilities"; headed "Traits" from 2026-11-05, docs PR #485): each limited-use
 * power from the class or race. Its row (plan m5b-players-screens-standard B, the mockup's Abilities): the name, how
 * many are left and when they come back, and **Use**, which marks one at once with Undo in the toast; with none left
 * Use stays tappable and says so. The name opens its sheet: what it does, and the uses as dots (tap a spent one to
 * give it back). Shown only when there's one.
 *
 * Pins (dec-13 C8, pin-2; frame P1): the sheet's head has the pin star. A pinned trait leaves this list and shows in
 * At hand instead (`place` "atHand": its rows alone, no heading, each name led by the small filled star, frame P1), so
 * each thing shows once; the same row, the same Use, the same sheet.
 */
export function PlayerTraits({
  db,
  user,
  character,
  figures,
  play,
  onChanged,
  source,
  more = [],
  place = 'list',
}: {
  db: Db;
  user: CurrentUser;
  character: MyCharacter;
  figures: ReturnType<typeof characterFigures>;
  play: CharacterPlay;
  onChanged: () => void;
  source: (from: 'class' | 'race') => string | null;
  /** The picked trait-list entries' powers with uses (G-213; retest 4 T9): their dots too, after the class's and race's. */
  more?: readonly LimitedAbility[];
  /** The Traits list (the unpinned ones, headed), or At hand's rows (the pinned ones, in the order pinned). */
  place?: 'list' | 'atHand';
}) {
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const all = traitsWithUses(figures, character.level, more);
  const split = pinnedTraits(all, play.pins);
  const abilities = place === 'atHand' ? split.pinned : split.rest;
  if (abilities.length === 0) return null;
  // Each row's own key: two traits may share a name (a class's and a kindred's), each with its own words.
  const keyOf = (a: LimitedAbility, i: number) => `${a.from}:${i}:${a.name}`;
  const shown = abilities.find((a, i) => keyOf(a, i) === open);
  const pinnedNow = (name: string) => split.pinned.some((a) => a.name === name);
  const spentOf = (a: { name: string; uses: number }) => Math.min(a.uses, play.usesSpent[a.name] ?? 0);

  async function mark(name: string, spent: number, of: number): Promise<boolean> {
    const result = await runCommand(registry, db, user, useAbility, { character, ability: name, spent, of });
    if (!result.ok) {
      toast({ text: result.message, error: true });
      return false;
    }
    onChanged();
    return true;
  }

  /** Use: one more spent, at once, with Undo (06: undo over confirm). None left: it says so, and when they come back. */
  async function use(a: { name: string; uses: number; refill: string | null }) {
    const spent = spentOf(a);
    if (spent >= a.uses) return toast({ text: `No uses of ${a.name} left. ${a.refill ? `They come back each ${a.refill}.` : 'Your GM says when they come back.'}` });
    if (await mark(a.name, spent + 1, a.uses)) toast({ text: `Used ${a.name}, ${a.uses - spent - 1} of ${a.uses} left`, onUndo: () => void mark(a.name, spent, a.uses) });
  }

  /**
   * The sheet's star: pin or unpin at once, Undo in the toast (06: undo over confirm). The trait moves, so its sheet
   * closes. Undo of an unpin puts the pin back in its place among the pins (`at`).
   */
  async function pin(name: string, pinned: boolean, undo = false, at?: number) {
    const was = play.pins.findIndex((p) => p.kind === 'trait' && p.key === name);
    const result = await runCommand(registry, db, user, pinToAtHand, { character, kind: 'trait', key: name, pinned, ...(at === undefined ? {} : { at }) });
    if (!result.ok) return toast({ text: result.message, error: true });
    setOpen(null);
    onChanged();
    if (!undo) toast({ text: pinned ? `${name} pinned to the top` : `${name} unpinned`, onUndo: () => void pin(name, !pinned, true, !pinned && was >= 0 ? was : undefined) });
  }

  const rows = (
    <RowList>
      {abilities.map((a, i) => {
        const left = a.uses - spentOf(a);
        const sub = `${left === 0 ? 'None' : left} of ${a.uses} left${a.refill ? `, back each ${a.refill}` : ''}`;
        return (
          <ListRow
            key={keyOf(a, i)}
            // In At hand the star leads the name, as frame P1 draws "★ Horn charge" (the review's nit of 19 Nov 2026).
            title={place === 'atHand' ? <PinnedName>{a.name}</PinnedName> : a.name}
            // The pips before "1 of 1 left" (frame P1; Francis's fix 8 of 19 Nov 2026): the uses left filled, the spent ones
            // rings, in ink as P1 draws them (the ink pips), hidden from screen readers, which hear the words.
            sub={
              <>
                <UsePips uses={a.uses} spent={spentOf(a)} ink /> {sub}
              </>
            }
            onOpen={() => setOpen(keyOf(a, i))}
            action="Use"
            // The stacked button with the pointing hand (dec-13 C6; sb-2, ic-3), in At hand and the Traits section alike (frame P1).
            actionIcon="pointing"
            actionLabel={`Use ${a.name}`}
            onAction={() => void use(a)}
          />
        );
      })}
    </RowList>
  );
  const sheet = shown && (
    <Dialog label={shown.name} onClose={() => setOpen(null)} headAction={<PinStar pinned={pinnedNow(shown.name)} onToggle={() => void pin(shown.name, !pinnedNow(shown.name))} />}>
      {shown.note ? <p className="reading">{shown.note}</p> : <p className="reading auth__meta">Your setting doesn't describe this ability.</p>}
      <p className="reading">
        {shown.uses === 1 ? '1 use' : `${shown.uses} uses`}
        {shown.refill ? `, back each ${shown.refill}.` : '. Your GM says when they come back.'}
      </p>
      {/* The dots stay here: tap a filled one to mark a use, a spent one to give it back (ruled 2026-10-26). */}
      <UseDots name={shown.name} uses={shown.uses} spent={spentOf(shown)} onChange={(spent) => void mark(shown.name, spent, shown.uses)} />
      {shown.from !== 'trait' && sourceLine(source(shown.from))}
    </Dialog>
  );

  // In At hand: the rows alone, inside At hand's own section (PackScreen's "atHand" view, `extra`).
  if (place === 'atHand') {
    return (
      <>
        {rows}
        {sheet}
      </>
    );
  }
  return (
    // Headed "Traits", the full sheet's word for them (Francis, docs PR #485, 2026-11-05), in the section heading
    // Scores and Saves wear (the named part, the lead on #894, frame P1).
    <SheetSection label="Traits">
      {rows}
      {sheet}
    </SheetSection>
  );
}
