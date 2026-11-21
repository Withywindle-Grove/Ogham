// The hit points box (06 Components, new 2026-11-08; mockup players/04-hit-points-inline, alternative C): the label,
// then "8 of 8" at the left (the screen's one 48 px figure; its tap types a value) and the − and + squares (56 px,
// 8 px apart) together at the right, then the segmented bar. Each square applies at once; the screen folds the taps
// and shows the toast. With no hit points yet the figure reads "—, tap to set" and the squares don't draw. The
// squares always draw for a character the viewer can't change: their tap says who may (never a greyed button).
import { HpBar } from './parts.tsx';
import './HpBox.css';

export function HpBox({
  hp,
  max,
  fills,
  figureLabel,
  onFigure,
  onStep,
}: {
  /** The hit points shown (null: none set yet). */
  hp: number | null;
  max: number | null;
  /** The bar's segments (`hpSegments`). */
  fills: number[];
  /** What a screen reader hears for the figure ("Hit points 5 of 8. Type a value"). */
  figureLabel: string;
  onFigure: () => void;
  /** − (−1) or + (+1). */
  onStep: (step: 1 | -1) => void;
}) {
  return (
    <div className="hp-box" role="group" aria-label="Hit points">
      <span className="stat-tile__label">hit points</span>
      <div className="hp-box__row">
        <button type="button" className="hp-box__figure" aria-label={figureLabel} onClick={onFigure}>
          <span className="hp__number">{hp === null ? '—' : hp}</span>
          {hp !== null && max !== null && <span className="hp__of">of {max}</span>}
          {hp === null && <span className="hp__of">tap to set</span>}
        </button>
        {hp !== null && (
          <span className="hp-box__steps">
            <button type="button" className="hp-box__step" aria-label="Take 1 damage" onClick={() => onStep(-1)}>
              −
            </button>
            <button type="button" className="hp-box__step" aria-label="Heal 1" onClick={() => onStep(1)}>
              +
            </button>
          </span>
        )}
      </div>
      <HpBar fills={fills} />
      {hp !== null && max !== null && hp > max && <span className="hp__over">over max</span>}
    </div>
  );
}
