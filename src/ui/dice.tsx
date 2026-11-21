// The die glyphs and the Roll row (docs/06 Components; plan m5b-creation-final-drafts A2, A3; mockups
// creation/final, paths from final/final.js). The app never rolls: these only say which die the player rolls at the
// table. Each die is a solid's projection, the outline 2 px and the inner edges 1 px, nothing inside, in its own colour
// from the palette (d4 info, d6 ink, d8 accent, d10 the lit-light glow, d12 danger, d20 warning); d100 is two d10s.
import type { ReactNode } from 'react';
import { Breakdown } from './parts.tsx';
import './dice.css';

export type DieSize = 4 | 6 | 8 | 10 | 12 | 20 | 100;

const OUTLINE: Record<Exclude<DieSize, 100>, string> = {
  4: 'M12 2.5L21.5 20.5H2.5z',
  6: 'M12 2L21 7V17L12 22L3 17V7z',
  8: 'M12 2L21 7V17L12 22L3 17V7z',
  10: 'M12 2L21 9L17 20H7L3 9z',
  12: 'M12 2L18 4.5L22 9.5L21 16L16.5 21H7.5L3 16L2 9.5L6 4.5z',
  20: 'M12 2L21 7V17L12 22L3 17V7z',
};

const INNER: Record<Exclude<DieSize, 100>, string> = {
  4: 'M12 2.5L11 13.5M11 13.5L2.5 20.5M11 13.5L21.5 20.5',
  6: 'M12 12L3 7M12 12L21 7M12 12V22',
  8: 'M3 7H21L12 22z',
  10: 'M12 2L8 10M12 2L16 10M8 10L3 9M16 10L21 9M8 10L12 13L16 10M12 13L7 20M12 13L17 20',
  12: 'M12 8L16.5 11L15 16H9L7.5 11zM12 8V2M16.5 11L22 9.5M15 16L16.5 21M9 16L7.5 21M7.5 11L2 9.5M18 4.5L16.5 11M6 4.5L7.5 11',
  20: 'M12 5L19 16H5zM12 2V5M3 7L5 16M21 7L19 16M3 17L5 16M21 17L19 16M12 22L5 16M12 22L19 16M12 5L3 7M12 5L21 7',
};

const SIZES: readonly DieSize[] = [4, 6, 8, 10, 12, 20, 100];

/** Whether a number is a die the app draws. */
export function isDieSize(n: number): n is DieSize {
  return (SIZES as readonly number[]).includes(n);
}

/**
 * The die a roll's words name: "3d6 x 10 gp" → 6, "d100" → 100, "1d8" → 8; the first die when there are several; null
 * when the words name no die the app draws (a d3 or a plain number).
 */
export function dieOf(expression: string): DieSize | null {
  const m = /(?:^|[^a-z0-9])\d*d(\d+)/i.exec(` ${expression}`);
  if (!m) return null;
  const n = Number(m[1]);
  return isDieSize(n) ? n : null;
}

/** One piece of a line of text: plain words, or a named die ("d6", "3d6", "2 in 6") and the die it names. */
export type DicePart = { kind: 'words'; text: string } | { kind: 'die'; text: string; die: DieSize };

/**
 * Cuts a line into words and named dice (ds-3): "dN" (with any count before it, "3d6") and "N in M" (a chance on an M-sided
 * die) in the form rule text uses for a chance: at the end of the line or followed by punctuation ("2 in 6.", "2 in 6,
 * every turn"), never followed by a word ("1 in 4 doors" is a count, not a die). Only dice the app draws count: an
 * unknown size ("d7", "2 in 3") stays words, and a line that names no die is one piece of words. The pieces join back
 * into the line exactly as it was.
 */
export function splitDice(line: string): DicePart[] {
  const parts: DicePart[] = [];
  const words = (text: string) => {
    if (!text) return;
    const last = parts.at(-1);
    if (last?.kind === 'words') last.text += text;
    else parts.push({ kind: 'words', text });
  };
  let at = 0;
  for (const m of line.matchAll(/\b\d+ in (\d+)(?=\s*(?:$|[.,;:!?()[\]—–]))|\b\d*[dD](\d+)\b/g)) {
    const n = Number(m[1] ?? m[2]);
    if (!isDieSize(n)) continue;
    words(line.slice(at, m.index));
    parts.push({ kind: 'die', text: m[0], die: n });
    at = m.index + m[0].length;
  }
  words(line.slice(at));
  return parts;
}

function Solid({ die }: { die: Exclude<DieSize, 100> }) {
  return (
    <>
      <path d={OUTLINE[die]} strokeWidth={2} />
      <path d={INNER[die]} strokeWidth={1} strokeLinecap="round" />
    </>
  );
}

/** One die, drawn at `size` px tall (24 by default); d100 is twice as wide. Decorative: the words beside it name the roll. */
export function DieGlyph({ die, size = 24 }: { die: DieSize; size?: number }) {
  const wide = die === 100;
  return (
    <svg
      className={`die-glyph die-glyph--d${die}`}
      viewBox={wide ? '0 0 48 24' : '0 0 24 24'}
      width={wide ? size * 2 : size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-die={die}
    >
      {wide ? (
        <>
          <Solid die={10} />
          <g transform="translate(24 0)">
            <Solid die={10} />
          </g>
        </>
      ) : (
        <Solid die={die} />
      )}
    </svg>
  );
}

/**
 * A line of words with the matching Die glyph before each named die or chance (ds-3): "Roll a d6: the door opens on a
 * 1 or a 2", "2 in 6". The words stay verbatim; the glyph takes the text's size, and on an accent fill the text's colour;
 * no glyph where no die is named. Decorative glyphs: the words name the die for a screen reader.
 */
export function DiceWords({ children }: { children: string }) {
  return (
    <span className="dice-words">
      {splitDice(children).map((part, i) =>
        part.kind === 'words' ? (
          part.text
        ) : (
          <span key={i} className="dice-words__roll">
            <DieGlyph die={part.die} />
            {part.text}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * The Roll row (plan A2): the die's glyph, then the instruction in bold at body size, never a caption ("Roll 3d6 at
 * the table for each score, then enter what you rolled."). One per thing to roll, placed above its field or list. With
 * no die the app draws, the words stand alone.
 * Variant **heading** (sv-3; frames P1, P2 of december/14): the rule line in a section heading's row, in ink at 14 px
 * with a 16 px glyph, beside the heading (`RuleHeading`).
 */
export function RollRow({ die, children, heading = false }: { die: DieSize | null; children: ReactNode; heading?: boolean }) {
  return (
    <p className={heading ? 'roll-row roll-row--heading' : 'roll-row'}>
      {die && <DieGlyph die={die} size={heading ? 16 : 24} />}
      <span className="roll-row__words">{children}</span>
    </p>
  );
}

/**
 * The Roll card (the Roll row's card variant; ruling m5b-attack-sheet-clarity as-1, layout B): a quiet card holding one
 * roll's Roll row (its die's glyph, the plain line carrying the sum), a note in words under it where the roll is read
 * some other way, the roll's parts as Breakdown rows, each with its own figure, never a running total, and under them
 * notes the sum leaves out (a bonus against a kind of foe; the GM's ammunition note).
 */
export function RollCard({
  dice,
  line,
  lineNote = null,
  notes = [],
  parts,
}: {
  dice: string;
  line: string;
  lineNote?: string | null;
  notes?: readonly string[];
  parts: readonly { label: string; value: string }[];
}) {
  return (
    <section className="roll-card" aria-label={line}>
      <RollRow die={dieOf(dice)}>{line}</RollRow>
      {lineNote && <p className="roll-card__note">{lineNote}</p>}
      {parts.length > 0 && <Breakdown rows={[...parts]} />}
      {notes.map((n) => (
        <p key={n} className="roll-card__note">
          {n}
        </p>
      ))}
    </section>
  );
}
