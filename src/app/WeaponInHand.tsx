// The weapon in hand's roll lines (dec-13 C14; ps-2, ps-9, frames P1 and P2 of december/14, approved 2026-11-14): under
// the weapon's name, the roll to hit and the damage, each its die's glyph, the die and what the line adds in bold, and a
// small muted word ("d20 +2 to hit", "d8 +1 damage"). The sum is the Attack sheet's own (weaponRolls' `adds`), never added
// again here. The block itself is ItemRow's `inHand` variant ("the weapon in hand", 06's inventory).
import type { AttackRoll } from '../modules/characters/play.ts';
import { DieGlyph, dieOf, type DieSize } from '../ui/dice.tsx';
import './WeaponInHand.css';

export interface RollFace {
  die: DieSize | null;
  /** The die without a leading 1, then the sum, signed with the true minus: "d20 +2", "d8", "2d4 −1". */
  figure: string;
  /** "to hit" or "damage", with the kind when the weapon has both ("to hit, in melee"); empty for a to-hit read from a target. */
  label: string;
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
const WHICH = { melee: ', in melee', missile: ', as a missile' } as const;

/**
 * How one roll reads in the block (frame P1). The to-hit always says its sum, a zero too ("d20 +0", P2 and P5b); a
 * damage that adds nothing is the die alone ("d6", P5b). A to-hit read against a target figure (descending AC) has no
 * "to hit" beside it (as-1: never roll-high-and-add), and no note under the lines (tfw-2, 2026-11-19).
 */
export function rollFace(roll: AttackRoll): RollFace {
  const dice = roll.dice.replace(/^1(?=d\d)/i, '');
  const adds = roll.roll === 'hit' || roll.adds !== 0 ? ` ${signed(roll.adds)}` : '';
  const which = roll.which ? WHICH[roll.which] : '';
  const label = roll.roll === 'damage' ? `damage${which}` : roll.againstTarget ? '' : `to hit${which}`;
  return { die: dieOf(roll.dice), figure: `${dice}${adds}`, label };
}

/**
 * The roll lines' short variant (frame P1's At hand: a weapon pinned but not in hand reads "d20 +0  d6" under its
 * name): each roll its die's glyph and its figure, side by side on one line, without the words. Spans only, as it sits
 * inside the row's button; the Attack sheet keeps the words and any note.
 */
export function RollFigures({ rolls }: { rolls: readonly AttackRoll[] }) {
  if (rolls.length === 0) return null;
  return (
    <span className="roll-figures">
      {rolls.map((r) => {
        const face = rollFace(r);
        return (
          <span key={r.line} className="roll-figures__roll">
            {face.die && <DieGlyph die={face.die} size={16} />}
            {face.figure}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Dice written in a pack ("d6+2", "1d4 - 1") as a roll line reads them: the die without a leading 1, the sum signed with
 * the true minus ("d6 +2", "d4 −1"), and the words beside. The pinned spell's block's roll (frame M4g, "d6 +2 turns").
 */
export function diceFace(dice: string, label: string): RollFace {
  const m = /^\s*(\d*d\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(dice);
  if (!m) return { die: dieOf(dice), figure: dice.trim(), label };
  const adds = m[2] ? ` ${m[2] === '-' ? '−' : '+'}${m[3]}` : '';
  return { die: dieOf(dice), figure: `${m[1]!.replace(/^1(?=d\d)/i, '')}${adds}`, label };
}

/**
 * The roll lines, to hit first (weaponRolls' order). No note under them: the one there was, on who reads a hit made
 * against a target, went with tfw-2 (2026-11-19).
 */
export function RollLines({ rolls }: { rolls: readonly AttackRoll[] }) {
  return <FaceLines faces={rolls.map((r) => ({ key: r.line, face: rollFace(r) }))} />;
}

/**
 * The roll lines from their faces: each the die's glyph (none for a figure that is no roll, the spell's range), the
 * figure in bold and the small word. `stacked` puts each on its own line, as the pinned spell's block draws its roll and
 * its range (frame M4g); the weapon's sit side by side. Nothing at all with no line.
 */
export function FaceLines({ faces, stacked = false }: { faces: readonly { key: string; face: RollFace }[]; stacked?: boolean }) {
  if (faces.length === 0) return null;
  return (
    <div className="weapon-in-hand__rolls">
      <ul className={stacked ? 'weapon-in-hand__roll-list weapon-in-hand__roll-list--stacked' : 'weapon-in-hand__roll-list'}>
        {faces.map(({ key, face }) => (
          <li key={key} className="weapon-in-hand__roll">
            {face.die && <DieGlyph die={face.die} size={20} />}
            <b className="weapon-in-hand__figure">{face.figure}</b>
            {face.label && <span className="weapon-in-hand__label"> {face.label}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
