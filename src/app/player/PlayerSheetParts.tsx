import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { CharacterSheet, type PinnableRow, type SheetPins } from '../CharacterSheet.tsx';
import { BookPopUpScope } from '../../ui/Dialog.tsx';
import { PlayerDetails } from './PlayerDetails.tsx';
import { PlayerLevel } from './PlayerLevel.tsx';
import { PlayerNotices, type NoticesHeld } from './PlayerNotices.tsx';
import type { HeldRoll } from '../WeatherCard.tsx';
import type { Notice } from './NoticesSheet.tsx';

/** Where the Player screen takes the sheet's parts: empty places in its columns, filled here (null until drawn). */
export type PlayerSlots = {
  /** On a phone or a portrait tablet: the saves, directly under hit points and armour class (ps-2a). */
  saves: HTMLElement | null;
  /** The level block, on the left above Details (ps-8). */
  level: HTMLElement | null;
  /** Details, last on the left (ps-3). */
  details: HTMLElement | null;
  /** The right's top: the scores, the saves (beside only), movement and load. */
  top: HTMLElement | null;
  /**
   * The notices box (row C1; page M1): beside, the top of the right column over Scores (frame M1a); in one column, under
   * the head's line (frames M1c, M1f). Without it (or a campaign) no box is drawn.
   */
  notices?: HTMLElement | null;
  /**
   * The right column's list, "Abilities and traits" (row P3), between Movement and Skills: drawn with the sheet's foot
   * rows (`traits`), so a pinned ability without uses can stand in it.
   */
  traits?: HTMLElement | null;
  /** The right after the abilities and traits: skills, languages and, beside, the full character sheet's section. */
  more: HTMLElement | null;
};

/**
 * The full sheet's parts on the Player screen (dec-13 C1, ps-2, ps-2a): the sheet is read once, as beside it before,
 * and its blocks (scores, saves, movement and load, skills, languages, the level block, Details) are placed into the
 * screen's columns, hosted and never rebuilt. A part the character doesn't have is left out, as on the sheet. The rest
 * of the sheet's rows follow skills and languages, with no heading and no Edit, in one column as beside (tfr-4, tfr-5).
 */
export function PlayerSheetParts({
  db,
  user,
  characterId,
  campaignId,
  refreshKey,
  onSaved,
  beside,
  slots,
  notices = [],
  onPhase,
  pins,
  traits,
}: {
  /** The pins (row P3): a pinned ability or trait leaves the foot's rows' lines, and its pop-up ends with Move up and Move down. */
  pins?: SheetPins | undefined;
  /** The right column's list, given the sheet's foot rows (none while it opens): placed in `slots.traits`. */
  traits?: ((pinnable: readonly PinnableRow[]) => ReactNode) | undefined;
  db: Db;
  user: CurrentUser;
  characterId: string;
  /** The character's campaign: the notices box reads its other urgent sources by it. */
  campaignId?: string;
  /** The screen's own notices for the box ("No light", the weather), before the sheet's. */
  notices?: readonly Notice[];
  /** Changes when something outside the sheet (the HP buttons) saved new values. */
  refreshKey: number;
  onSaved?: (() => void) | undefined;
  /** Two columns (a landscape tablet): the saves sit on the right. */
  beside: boolean;
  slots: PlayerSlots;
  /** Told where the sheet's read stands (opening, failed, ready): the screen's one loading state waits for it (C11). */
  onPhase?: ((phase: 'opening' | 'error' | 'ready') => void) | undefined;
}) {
  // Held here, above the box's portal: turning a tablet moves the box's place and draws the box afresh, and an open
  // Notices sheet or a half-typed weather roll must survive that.
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [roll, setRoll] = useState<HeldRoll | null>(null);
  const held: NoticesHeld = { open: noticesOpen, setOpen: setNoticesOpen, roll, setRoll };
  return (
    <CharacterSheet
      db={db}
      user={user}
      characterId={characterId}
      refreshKey={refreshKey}
      {...(onSaved ? { onSaved } : {})}
      {...(pins ? { pins } : {})}
      host={({ parts, fullSheet, notices: sheetNotices, status, phase }) => (
        <>
          <Phase phase={phase} onPhase={onPhase} />
          {/* The notices box (row C1, tfn-2): the screen's notices, then the sheet's (its changes, "To finish"). */}
          {slots.notices &&
            campaignId &&
            createPortal(<PlayerNotices db={db} user={user} notices={notices} sheetNotices={sheetNotices} characterId={characterId} campaignId={campaignId} low={!beside} held={held} />, slots.notices)}
          {/* In one column the sheet's "Opening…", or its error with Try again, stands where the saves will be: beside,
              the full sheet's own section says it. */}
          {!beside && slots.saves && createPortal(parts ? parts.saves : status, slots.saves)}
          {slots.level && createPortal(<PlayerLevel part={parts?.level} />, slots.level)}
          {slots.details && createPortal(<PlayerDetails part={parts?.details} characterId={characterId} />, slots.details)}
          {slots.top &&
            createPortal(
              <>
                {parts?.scores}
                {beside && parts?.saves}
                {parts?.movement}
              </>,
              slots.top,
            )}
          {slots.traits && traits && createPortal(traits(parts?.pinnable ?? []), slots.traits)}
          {slots.more &&
            createPortal(
              <>
                {parts?.skills}
                {parts?.languages}
                {/* In one column the section waits for the sheet: its "Opening…" already stands where the saves go.
                    Beside the tab, the sheet's edit form is not one of the tab's book pop-ups (tfb-1; the review of
                    #1079): while editing, its pop-ups keep the Sheet's own heading. Its rest (Notes, the lists) keeps
                    the book's. */}
                {(beside || parts) &&
                  (parts ? fullSheet : <BookPopUpScope.Provider value={false}>{fullSheet}</BookPopUpScope.Provider>)}
              </>,
              slots.more,
            )}
        </>
      )}
    />
  );
}

/** Reports where the sheet's read stands up to the screen when it changes (nothing drawn). */
function Phase({ phase, onPhase }: { phase: 'opening' | 'error' | 'ready'; onPhase: ((phase: 'opening' | 'error' | 'ready') => void) | undefined }) {
  useEffect(() => {
    onPhase?.(phase);
  }, [phase, onPhase]);
  return null;
}
