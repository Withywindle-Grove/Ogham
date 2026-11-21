import type { ReactNode } from 'react';
import { ListRow, RowList } from '../../ui/parts.tsx';
import type { LevelFigures } from '../CharacterSheet.tsx';

/**
 * The level block on the Player screen's left, directly above Details (dec-13 C1, ps-2, ps-8): the hosted sheet hands
 * over the level's figures (`SheetParts.level`) and this draws them as `PlayerLevelBlock` below (C3), so the shared
 * sheet imports nothing from the Player screen (the cloud review of #909).
 */
export function PlayerLevel({ part }: { part: LevelFigures | null | undefined }) {
  return part ? <PlayerLevelBlock {...part} /> : null;
}

/** "Fighter, level 2"; with no class shown, "Level 2" (frame P1's level line). */
export const levelTitle = (className: string, level: number): string => (className.trim() ? `${className.trim()}, level ${level}` : `Level ${level}`);

/**
 * The level block as frame P1 draws it (dec-13 C3, ps-8; approved ps-9, 2026-11-14), without its chevron (tfr-2; page
 * M1, approved 2026-11-19): one row whose tap opens how the level is worked out, reading the class beside the level ("Fighter, level 2"), the experience under it
 * ("2,400 of 4,000 experience"), the experience bar, and the company, muted, last. Each part shows only when the
 * character has it. The class form switch (eq-8) stays under the row, as on the sheet. The **Level block** variant of
 * the List row (06): `ListRow` with its line made of these parts. From a tablet's width up the experience sits on the
 * title's line, after it, as P1 draws it; on a phone it sits under the title, as P2 draws it (PlayerScreen.css; the
 * lead's ruling, 2026-11-15).
 */
export function PlayerLevelBlock({
  className,
  level,
  experience,
  fraction,
  company,
  onOpen,
  formSwitch = null,
}: {
  /** The class's name as the sheet shows it; '' for none. */
  className: string;
  level: number;
  /** "2,400 of 4,000 experience", or '' when none is recorded. */
  experience: string;
  /** How far to the next level, 0 to 1; null for no bar (no experience, no next level). */
  fraction: number | null;
  /** The character's company; null or '' for none. */
  company: string | null;
  onOpen: () => void;
  formSwitch?: ReactNode;
}) {
  // A fraction that isn't a number draws no bar (never `NaN%`).
  const title = levelTitle(className, level);
  const width = fraction === null || !Number.isFinite(fraction) ? null : Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const line =
    experience || width !== null || company ? (
      <>
        {experience && <span className="player-level__line">{experience}</span>}
        {width !== null && (
          <span className="advancement__bar player-level__bar" aria-hidden="true">
            <span className="advancement__fill" style={{ inlineSize: `${width}%` }} />
          </span>
        )}
        {company && <span className="player-level__line player-level__company">{company}</span>}
      </>
    ) : undefined;
  return (
    <section className="sheet__section sheet__block player-level" aria-label="Level">
      <RowList>
        {/* The company stays in what a screen reader hears: the label replaces the row's words, so leaving it out would
            hide it (the cloud review of #909 asked; kept on purpose). */}
        {/* No chevron (tfr-2, page M1): the row is a figure, like the tiles, and keeps its tap. */}
        <ListRow title={title} sub={line} openLabel={`${[title, experience, company].filter(Boolean).join(', ')}: how it's worked out`} onOpen={onOpen} chevron={false} />
      </RowList>
      {formSwitch}
    </section>
  );
}
