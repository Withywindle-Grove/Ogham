import type { ReactNode } from 'react';
import type { CurrentUser } from '../../core/commands.ts';
import type { MyCharacter } from '../../core/myCharacters.ts';
import type { Db } from '../../core/supabase.ts';
import { CastingStatusView, type CastingNow } from '../EquipWarning.tsx';
import { PortraitTap } from '../PortraitSheet.tsx';
import { CharacterStatuses, type StatusBook } from '../Statuses.tsx';

/**
 * "the Hornkin, Shieldbearer" (ps-3, ps-5): "the" and the kindred, then the title; either alone; empty with neither.
 * The title is the class's level title from the pack, overridable, hidden when there is none (05).
 */
export function kindredAndTitle(kindred: string | null | undefined, title: string | null | undefined): string {
  const k = kindred?.trim() ?? '';
  const t = title?.trim() ?? '';
  return [k && `the ${k}`, t].filter(Boolean).join(', ');
}

/**
 * The bar's title on a tablet (frame P1): "Brannoch the Hornkin, Shieldbearer"; with no kindred, "Brannoch,
 * Shieldbearer"; with neither, the name alone.
 */
export function nameKindredTitle(name: string, kindred: string | null | undefined, title: string | null | undefined): string {
  const words = kindredAndTitle(kindred, title);
  if (!words) return name;
  return `${name}${nameSeparator(words)}${words}`;
}

/** What joins the name to the words after it: a space before "the" kindred, a comma before a title alone. */
function nameSeparator(words: string): string {
  return words.startsWith('the ') ? ' ' : ', ';
}

/**
 * The Player screen's head (dec-13 C2, ps-5; frames P1 and P2 of december/14, approved ps-9; the portrait at 96 px,
 * page M1, approved 2026-11-19): the larger portrait (its tap the portrait sheet), and the statuses as rings: up to
 * four in view, the rest one tap away ("+N"); a tap on a ring opens that status. With one or two, each ring's name and
 * time sit in words beside it. On a tablet in two columns (`fixed`) the head is the portrait and the rings at its
 * right, one row 96 px tall, so the first row of score boxes at the right can start level with the hit points box (the
 * aligned top); the name, "the" kindred and the title are the bar's. In one column (a phone, a portrait tablet) the
 * bar keeps a name that fits (a cut one leads the head's line instead); beside the portrait the head's first line, `line`, gives the rest ("the Hornkin,
 * Shieldbearer") with the notices box under it, and the rings take their own row under the portrait (frame M1c).
 */
export function PlayerHead({
  db,
  user,
  character,
  line,
  fixed,
  phone,
  book,
  onStatusesChanged,
  casting,
  onPortraitSaved,
  onOpenLog,
  notices,
}: {
  db: Db;
  user: CurrentUser;
  character: MyCharacter;
  /** The head's first line beside the portrait: "the Hornkin, Shieldbearer", or the card line the GM's fields make. */
  line: string;
  /** Two columns (a landscape tablet) and no line: one row of a fixed height. With a line (no class) the head grows. */
  fixed: boolean;
  /** A phone: three rings in view before "+N", so the row fits 375 px. */
  phone: boolean;
  book: StatusBook | null | 'error';
  onStatusesChanged: () => void;
  casting: CastingNow;
  onPortraitSaved?: (() => void) | undefined;
  onOpenLog: () => void;
  /**
   * In one column (a phone, a portrait tablet), the place for the notices box, under the head's line (row C1; frames
   * M1c, M1f); the rings then take their own row under the portrait. Beside, the box is the right column's.
   */
  notices?: ReactNode;
}): ReactNode {
  const rings = (
    <CharacterStatuses
      db={db}
      user={user}
      book={book}
      character={character}
      onChanged={onStatusesChanged}
      rings
      inView={phone ? 3 : 4}
      extra={casting ? (layout) => <CastingStatusView status={casting} ring layout={layout} /> : undefined}
      onOpenLog={onOpenLog}
    />
  );
  return (
    <div className={fixed ? 'player-head player-head--fixed' : 'player-head'}>
      <PortraitTap db={db} user={user} character={character} onSaved={onPortraitSaved} size="head" />
      <div className="player-head__side">
        {notices ? (
          // In one column, a tablet held upright (dec-14 row 3, frame 38-3; ruled 2026-11-24, 2 and 8) or a phone
          // (pss-14, frame 47-1, A1: p47-1): while the bar's title is cut the name leaves the bar and leads the head's
          // line, whole and wrapping, before "the" kindred and the title (PlayerScreen.css), so it shows once; the
          // bar's title keeps its box, unseen, so the bar does not move. A short name stays the bar's (frame P2).
          <div className="player-head__words">
            <h1 className="player-head__name visually-hidden">{character.name}</h1>
            {line && (
              <>
                <span className="player-head__sep visually-hidden" aria-hidden="true">
                  {nameSeparator(line)}
                </span>
                <p className="player-head__line">{line}</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* The name is the bar's title (here for screen readers only). */}
            <h1 className="visually-hidden">{character.name}</h1>
            {line && <p className="player-head__line">{line}</p>}
          </>
        )}
        {notices ?? rings}
      </div>
      {notices && <div className="player-head__rings">{rings}</div>}
    </div>
  );
}
