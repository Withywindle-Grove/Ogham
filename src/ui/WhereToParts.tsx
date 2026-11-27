// A player's Where to?: the parts that stand beside its destination rows (plan dec-9-the-players-scene, row P2;
// page 18 of the December mockups, PL2 and PL9, approved 2026-11-14, ap-10; d5-2). The rows themselves and the list's
// heading are MoveOnParts' (`WhereTo`, `DestinationRow`, `WayLine`, `AreaRows`). Callbacks and props only.
//
// - `WhereToLine`: one quiet line under the heading in place of rows (PL2: none to choose from yet).
// - `RefreshFailedRow`: a read that failed, said in a row of its own above the list it kept (PL9), the warning sign, the
//   words and "Try again" as a stacked button.
// - `EndExpeditionRow`: the last row at a way out (d5-2: the GM's row of page 24, WY1d: the door mark, the words, the
//   chevron); a tap opens what the caller gives.
import type { ReactNode } from 'react';
import { Icon } from './icons.tsx';
import { ListRow, StackedButton, WarningSign } from './parts.tsx';
import './WhereToParts.css';

/** PL2's quiet line under "Where to?" (before anything of the place is shown). */
export function WhereToLine({ children }: { children: ReactNode }) {
  return <p className="where-to__line">{children}</p>;
}

/**
 * PL9: the ways didn't refresh (or didn't load), in a row of its own: the warning sign, the words, "Try again". Never
 * colour alone: the sign and the words say it. Read out as it appears (role="status").
 */
export function RefreshFailedRow({ words, onRetry }: { words: string; onRetry: () => void }) {
  return (
    <div className="refresh-failed" role="status">
      <span className="refresh-failed__sign" aria-hidden="true">
        <WarningSign />
      </span>
      <p className="refresh-failed__words">{words}</p>
      <StackedButton icon="refresh" label="Try again" onClick={onRetry} />
    </div>
  );
}

/** The "End expedition" row (d5-2; page 24, WY1d's row): the door mark, the words, the chevron. */
export function EndExpeditionRow({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="where-to__end">
      <ListRow title="End expedition" icon={<Icon name="exit-door" size={24} />} onOpen={onOpen} />
    </div>
  );
}
