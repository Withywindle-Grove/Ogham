import { useState } from 'react';
import { runCommand, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import type { Db } from '../../core/supabase.ts';
import { movePin, pinToAtHand } from '../../modules/characters/pins.ts';
import { PIN_LIMIT, PIN_LIMIT_WORDS, pinnedNames, pinnedTraits, traitsWithUsesOf, useAbility, type CharacterPlay, type LimitedAbility, type Pin } from '../../modules/characters/playState.ts';
import { useBlockedSheet } from '../../ui/BlockedSheet.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { ListRow, PinnedBox, PinnedName, PinStar, RowList, SourceLine, UseDots, UsePips } from '../../ui/parts.tsx';
import { moved, SortableList } from '../../ui/SortableList.tsx';
import { useToast } from '../../ui/ToastHost.tsx';
import type { PinnableRow } from '../CharacterSheet.tsx';
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
 * Move a pinned ability or trait from one place to another in the player's order (euf-4, pg28-7; `character.movePin`,
 * the detailed log): `live` is the order shown (`pinnedNames`), `from` and `to` places in it. The command's `at` is the
 * place in the stored list of the one it lands beside, so a pin whose thing is gone, or a spell's, keeps its own place.
 */
export async function movePinTo(db: Db, user: CurrentUser, character: MyCharacter, pins: readonly Pin[], live: readonly string[], from: number, to: number): Promise<CommandResult<Pin[]>> {
  const key = live[from]!;
  const at = pins.findIndex((p) => p.kind === 'trait' && p.key === live[to]);
  return runCommand(registry, db, user, movePin, { character, key, at });
}

/**
 * Move up and Move down at the foot of a pinned one's own pop-up (pg28-7, frame M4e): each moves it at once and the
 * pop-up stays open; the first has no Move up, the last no Move down. Nothing when it isn't pinned or is the only one.
 */
export function PinMoves({ name, live, onMove }: { name: string; live: readonly string[]; onMove: (from: number, to: number) => void }) {
  const at = live.indexOf(name);
  if (at < 0 || live.length < 2) return null;
  return (
    <RowList label={`Move ${name}`}>
      {at > 0 && <ListRow title="Move up" chevron={false} onOpen={() => onMove(at, at - 1)} />}
      {at < live.length - 1 && <ListRow title="Move down" chevron={false} onOpen={() => onMove(at, at + 1)} />}
    </RowList>
  );
}

/**
 * The **Pin star** on an ability's or a trait's entry, beside its ✕ (row P4 of plans/test-feedback-2026-11-19; euf-2;
 * page 26's fix 1, drawn on page 28's frame M4e): pin or unpin at once, Undo in the toast (06: undo over confirm), the
 * entry staying open. At 24 pins it stays a button and says why (pg28-5).
 */
export function EntryPinStar({ db, user, character, name, pins, onChanged }: { db: Db; user: CurrentUser; character: MyCharacter; name: string; pins: readonly Pin[]; onChanged: () => void }) {
  const toast = useToast();
  const blocked = useBlockedSheet();
  const pinned = pins.some((p) => p.kind === 'trait' && p.key === name);
  async function pin(next: boolean, undo = false, at?: number) {
    if (next && !undo && pins.length >= PIN_LIMIT) return blocked.explain(`Can't pin ${name}`, PIN_LIMIT_WORDS);
    const was = pins.findIndex((p) => p.kind === 'trait' && p.key === name);
    const result = await runCommand(registry, db, user, pinToAtHand, { character, kind: 'trait', key: name, pinned: next, ...(at === undefined ? {} : { at }) });
    if (!result.ok) return toast({ text: result.message, error: true });
    onChanged();
    if (!undo) toast({ text: next ? `${name} pinned to the top` : `${name} unpinned`, onUndo: () => void pin(!next, true, !next && was >= 0 ? was : undefined) });
  }
  return (
    <>
      <PinStar pinned={pinned} onToggle={() => void pin(!pinned)} />
      {blocked.sheet}
    </>
  );
}

/**
 * The right column's list, **Abilities and traits** (pg28-1; row P3 of plans/test-feedback-2026-11-19; page 28, frames
 * M4a to M4i, approved 2026-11-20). First the pinned abilities and traits, in the player's own order (euf-3, euf-4),
 * each led by the small filled star: one with uses is a **Pinned block** (its name, Use, the pips and how many are
 * left), one with only something to read a **Pinned row** (its name and a chevron, a tap opening its text, the sheet's
 * own pop-up: `pinnable`). Hold one to move it (the Reorder list; the heading's ⓘ says so), or use Move up and Move
 * down in its pop-up. Then the unpinned traits with uses, each the row it was (pg28-4): the name, how many are left and
 * when they come back, and **Use**, which marks one at once with Undo in the toast; with none left Use stays tappable
 * and says so. A trait's name opens its sheet: what it does, the uses as dots (tap a spent one to give it back), and
 * the pin star in its head. Nothing pinned At hand any more (euf-3). Shown only when there's one.
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
  pinnable = [],
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
  /** The sheet's foot rows (`SheetParts.pinnable`): a pinned one without uses is drawn from these, opening its own pop-up. */
  pinnable?: readonly PinnableRow[];
}) {
  const toast = useToast();
  const blocked = useBlockedSheet();
  const [open, setOpen] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  // A move shows at once, the list in its new order, until the pins read back (or the save fails).
  const pinsKey = play.pins.map((p) => `${p.kind}:${p.key}`).join('|');
  const [moving, setMoving] = useState<{ order: string[]; from: string } | null>(null);
  // Once the stored order arrives (any change to the pins), the move shown at once gives way to it, so an old order
  // never shows again when the pins come back to how they were (an Undo from the log; the review's finding 4 on #23).
  if (moving && moving.from !== pinsKey) setMoving(null);

  const all = traitsWithUses(figures, character.level, more);
  // Each trait's own key: two may share a name (a class's and a kindred's), each with its own words. Its place in the
  // character's list, so it stays the same when the pins move.
  const keyed = all.map((a, i) => ({ a, key: `${a.from}:${i}:${a.name}` }));
  const withUses = new Set(all.map((a) => a.name));
  // A thing with uses is drawn from the traits with uses (a block); the rest of the sheet's rows are the plain ones.
  const plain = pinnable.filter((r) => !withUses.has(r.name));
  const live = pinnedNames(play.pins, [...all.map((a) => a.name), ...plain.map((r) => r.name)]);
  const shownOrder = moving && moving.from === pinsKey ? moving.order : live;
  const rest = pinnedTraits(keyed.map((k) => ({ ...k, name: k.a.name })), play.pins).rest;
  if (shownOrder.length === 0 && rest.length === 0) return null;
  const shown = keyed.find((k) => k.key === open);
  const pinnedNow = (name: string) => live.includes(name);
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
   * closes. Undo of an unpin puts the pin back in its place among the pins (`at`). At the limit the star stays a button
   * and says why (pg28-5, frame M4i).
   */
  async function pin(name: string, pinned: boolean, undo = false, at?: number) {
    if (pinned && !undo && play.pins.length >= PIN_LIMIT) return blocked.explain(`Can't pin ${name}`, PIN_LIMIT_WORDS);
    const was = play.pins.findIndex((p) => p.kind === 'trait' && p.key === name);
    const result = await runCommand(registry, db, user, pinToAtHand, { character, kind: 'trait', key: name, pinned, ...(at === undefined ? {} : { at }) });
    if (!result.ok) return toast({ text: result.message, error: true });
    setOpen(null);
    onChanged();
    if (!undo) toast({ text: pinned ? `${name} pinned to the top` : `${name} unpinned`, onUndo: () => void pin(name, !pinned, true, !pinned && was >= 0 ? was : undefined) });
  }

  /** A move in the player's order, at once (hold to move, Move up, Move down); a failed save puts the list back. */
  async function move(from: number, to: number) {
    if (from === to) return;
    setMoving({ order: moved(shownOrder, from, to), from: pinsKey });
    const result = await movePinTo(db, user, character, play.pins, shownOrder, from, to);
    if (!result.ok) {
      setMoving(null);
      return toast({ text: result.message, error: true });
    }
    onChanged();
  }

  // A trait with uses as a row (unpinned) or inside its block (pinned): the same name, line, Use and sheet.
  const traitRow = ({ a, key }: { a: LimitedAbility; key: string }, pinned: boolean) => {
    const left = a.uses - spentOf(a);
    const sub = `${left === 0 ? 'None' : left} of ${a.uses} left${a.refill ? `, back each ${a.refill}` : ''}`;
    return (
      <ListRow
        key={key}
        title={pinned ? <PinnedName>{a.name}</PinnedName> : a.name}
        // The pips before "1 of 1 left" (frame P1; Francis's fix 8 of 19 Nov 2026): the uses left filled, the spent ones
        // rings, in ink as P1 draws them (the ink pips), hidden from screen readers, which hear the words. In a block,
        // each pip up to ten and none past (pg28-8).
        sub={
          <>
            <UsePips uses={a.uses} spent={spentOf(a)} ink block={pinned} /> {sub}
          </>
        }
        onOpen={() => setOpen(key)}
        action="Use"
        // The stacked button with the pointing hand (dec-13 C6; sb-2, ic-3).
        actionIcon="pointing"
        actionLabel={`Use ${a.name}`}
        onAction={() => void use(a)}
      />
    );
  };

  const pinnedList = shownOrder.length > 0 && (
    <div className="pinned-list">
      <SortableList
        items={shownOrder.map((name) => ({ key: name, label: name }))}
        label="Pinned abilities and traits"
        landingBox
        onMove={(from, to) => void move(from, to)}
        render={({ key: name }) => {
          const blocks = keyed.filter((k) => k.a.name === name);
          if (blocks.length > 0) {
            return blocks.map((k) => (
              <PinnedBox key={k.key} block>
                {traitRow(k, true)}
              </PinnedBox>
            ));
          }
          // Only something to read: a row, its own pop-up the sheet's (its entry, with Move up and Move down).
          const row = plain.find((r) => r.name === name);
          return (
            <PinnedBox>
              <ListRow title={<PinnedName>{name}</PinnedName>} openLabel={`${name}, pinned`} {...(row?.onOpen ? { onOpen: row.onOpen } : {})} />
            </PinnedBox>
          );
        }}
      />
    </div>
  );

  const sheet = shown && (
    <Dialog label={shown.a.name} onClose={() => setOpen(null)} headAction={<PinStar pinned={pinnedNow(shown.a.name)} onToggle={() => void pin(shown.a.name, !pinnedNow(shown.a.name))} />}>
      {shown.a.note ? <p className="reading">{shown.a.note}</p> : <p className="reading auth__meta">Your setting doesn't describe this ability.</p>}
      <p className="reading">
        {shown.a.uses === 1 ? '1 use' : `${shown.a.uses} uses`}
        {shown.a.refill ? `, back each ${shown.a.refill}.` : '. Your GM says when they come back.'}
      </p>
      {/* The dots stay here: tap a filled one to mark a use, a spent one to give it back (ruled 2026-10-26). */}
      <UseDots name={shown.a.name} uses={shown.a.uses} spent={spentOf(shown.a)} onChange={(spent) => void mark(shown.a.name, spent, shown.a.uses)} />
      {shown.a.from !== 'trait' && sourceLine(source(shown.a.from))}
      <PinMoves name={shown.a.name} live={shownOrder} onMove={(from, to) => void move(from, to)} />
    </Dialog>
  );

  return (
    // Headed "Abilities and traits" now that it holds abilities too (pg28-1, ⚑ 24), in the section heading Scores and
    // Saves wear; the ⓘ in its row says how to move a pinned one (pg28-7), while there is one.
    <SheetSection label="Abilities and traits" {...(shownOrder.length > 0 ? { labelInfo: { label: 'moving pinned ones', onOpen: () => setAbout(true) } } : {})}>
      {pinnedList}
      {rest.length > 0 && <RowList>{rest.map((k) => traitRow(k, false))}</RowList>}
      {sheet}
      {about && (
        <Dialog label="Hold to move" onClose={() => setAbout(false)}>
          <p className="reading">Hold a pinned one for half a second, then drag it up or down. The others make room.</p>
          <p className="reading">A tap opens it, as before.</p>
          <div className="dialog__actions">
            <button type="button" className="button-secondary" onClick={() => setAbout(false)}>
              Got it
            </button>
          </div>
        </Dialog>
      )}
      {blocked.sheet}
    </SheetSection>
  );
}
