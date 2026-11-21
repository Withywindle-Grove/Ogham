// The rule line in a heading's row (sv-3, ps-7, pf-20; plan dec-13 row C5; frames P1 and P2 of december/14, approved
// ps-9 2026-11-14): a section's heading at the left and, in the same row at the right, the rule for the roll its tiles
// are read with, the die's glyph and one line ("Roll d20: your save's number or higher succeeds."). Where the row is
// too narrow the line wraps under the heading, above the tiles. A setting with no such roll shows the heading alone.
// The line is built from the rules set's `rolls` (library/rolls.ts) and from nothing else: this part only draws it.
// One part, hosted by whichever section owns the heading (the Player screen's Saves and Scores, the full sheet's); the
// line itself is the Roll row's heading variant, so every roll the app asks for stays in a Roll row.
import type { ReactNode } from 'react';
import type { RollLine } from '../modules/library/rolls.ts';
import { RollRow } from './dice.tsx';
import './RuleHeading.css';

/**
 * A heading's row with its rule line. `heading` is the section's own heading element (its level, id and class stay
 * the host's, so a screen reader's outline doesn't change); `line` the rule, or null for the heading alone.
 */
export function RuleHeading({ heading, line }: { heading: ReactNode; line: RollLine | null }) {
  if (!line) return <>{heading}</>;
  return (
    <div className="rule-heading">
      {heading}
      <RollRow die={line.sides} heading>
        {line.words}
      </RollRow>
    </div>
  );
}
