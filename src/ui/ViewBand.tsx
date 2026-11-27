// The View band (page 32, M3c, M3d, M3j, M3k; pg32-2, pg32-7c, pg32-8, approved 2026-11-21): under the top row on
// every tab of the GM's view as the player, whose view it is. The eye, "Sam's view of Wren" and "What you do here is
// logged as yours."; on the GM's own character one line, "Your view of Ash". Two lines at most on every width: the
// name line is cut with "…" on screen and read whole by a screen reader (the band's name).
import { Icon } from './icons.tsx';
import './ViewBand.css';
import { possessive } from '../core/nameWords.ts';

/** The band's words: the name line, and the logged line (none on the GM's own character). */
export function viewBandWords(player: string | null, character: string): { name: string; logged: string | null } {
  return player === null ? { name: `Your view of ${character}`, logged: null } : { name: `${possessive(player)} view of ${character}`, logged: 'What you do here is logged as yours.' };
}

export function ViewBand({ player, character }: { player: string | null; character: string }) {
  const { name, logged } = viewBandWords(player, character);
  return (
    <div className="view-band" role="note" aria-label={logged ? `${name}. ${logged}` : name}>
      <span className="view-band__eye">
        <Icon name="eye" />
      </span>
      <span className="view-band__words" aria-hidden="true">
        <span className="view-band__name">{name}</span>
        {logged && <span className="view-band__logged">{logged}</span>}
      </span>
    </div>
  );
}
