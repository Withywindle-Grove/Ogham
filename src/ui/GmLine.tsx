// The GM's line (page 32, M3g, M3g2; pg32-4, approved 2026-11-21): on an item's sheet in the GM's view as the player,
// the one line only the GM sees, "Only you see this: …". The closed eye and the words carry it, not the colour; body
// size (16 px, fix 3 of the approval). It sits under the player's own words and never takes the place of a figure.
import { Icon } from './icons.tsx';
import './GmLine.css';

export function GmLine({ children }: { children: string }) {
  return (
    <p className="gm-line">
      <span className="gm-line__eye" aria-hidden="true">
        <Icon name="eye-shut" size={20} />
      </span>
      <span>{children}</span>
    </p>
  );
}
