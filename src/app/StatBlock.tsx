// The stat block (December 5c; mockup docs/design/mockups/december/06-stat-block, frames 1 to 6): one part, drawn once,
// used by the detail row's pop-up (BookDetail.tsx) and by the Rules browser for a stat block. In order: the
// description, the descriptor line in small capitals, the figures as compact pairs (each label, in the book-label
// colour at the regular weight, cr-c2, followed at once by its value; several to a line) in the groups the pack
// declares (pf-13) with a dotted rule between, the abilities as paragraphs with a bold lead-in, anything else the block
// holds as lines, and the source line. The name is the caller's heading, with `STAT_BLOCK_NAME`. Book text in its own
// faces (Bitter; the descriptor in Alegreya Sans SC), never the app's body token. The stat line (`StatLine`) is the
// detail row's run-on line of the first group. A die named in a value carries its glyph (ds-3).
import type { ReactNode } from 'react';
import type { Figure, StatBlockShown } from '../modules/library/statBlockLayout.ts';
import { DieGlyph, isDieSize } from '../ui/dice.tsx';
import { SourceLine } from '../ui/parts.tsx';
import { Lines } from './RulesBrowser.tsx';
import './StatBlock.css';

/** The class a stat block's name takes (Bitter at 700), wherever its heading is. */
export const STAT_BLOCK_NAME = 'stat-block__name';

// "1d6", "2d8", "d20", and "2 in 6": a die the app draws gets its glyph before it; one it has none for (d3) none. An
// average after it ("2d8 (9)") stays with it on its line (finding 12, page 44).
const DIE = /(\b\d*d(\d+)\b(?: \(\d+\))?|\b\d+ in (\d+)\b)/g;

/**
 * Words with a die's glyph before each die they name, at text size. A local helper for the stat block: the shared one
 * comes with piece 1 and replaces it (docs/plans/dec-5-encounters.md, Departures, 5c).
 */
export function WordsWithDice({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(DIE)) {
    const size = Number(match[2] ?? match[3]);
    if (!isDieSize(size)) continue;
    if (match.index > at) out.push(text.slice(at, match.index));
    out.push(
      <span key={match.index} className="stat-block__die">
        <DieGlyph die={size} size={16} />
        {match[0]}
      </span>,
    );
    at = match.index + match[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/** One label and its value; a short pair never breaks inside itself, a long one (an attacks line) wraps. */
function Pair({ figure }: { figure: Figure }) {
  const short = figure.label.length + figure.value.length < 30;
  return (
    <span className={short ? 'stat-block__pair stat-block__pair--short' : 'stat-block__pair'}>
      <span className="stat-block__label">{figure.label}</span> <WordsWithDice text={figure.value} />
    </span>
  );
}

function PairLine({ figures, className, Tag = 'p' }: { figures: Figure[]; className: string; Tag?: 'p' | 'span' }) {
  return (
    <Tag className={className}>
      {figures.map((figure, i) => (
        <span key={`${figure.label}-${i}`}>
          {i > 0 && ' '}
          <Pair figure={figure} />
        </span>
      ))}
    </Tag>
  );
}

/** A stat block's body, laid out by its pack (pf-13). Nothing is drawn empty: no descriptor, rule or abilities without content. */
export function StatBlock({ shown, source }: { shown: StatBlockShown; source: string | null }) {
  return (
    <div className="stat-block">
      {shown.notes.map((note, i) => (
        <p key={i} className="stat-block__text">
          {note}
        </p>
      ))}
      {(shown.descriptor || shown.groups.length > 0) && (
        <div className="stat-block__figures">
          {shown.descriptor && <p className="stat-block__descriptor">{shown.descriptor}</p>}
          {shown.groups.map((group, g) => (
            <div key={g} className="stat-block__group">
              {g > 0 && <hr className="stat-block__rule" />}
              {group.map((line, l) => (
                <PairLine key={l} figures={line} className="stat-block__line" />
              ))}
            </div>
          ))}
        </div>
      )}
      {shown.abilities.map((ability, i) => (
        <p key={i} className="stat-block__ability">
          {ability.name && <strong className="stat-block__lead">{`${ability.name}:`}</strong>}
          {ability.name && ability.note ? ' ' : null}
          <WordsWithDice text={ability.note} />
        </p>
      ))}
      {shown.rest.length > 0 && <Lines lines={shown.rest} />}
      {source && <SourceLine>{source}</SourceLine>}
    </div>
  );
}

/** The detail row's stat line (BookDetail.tsx): the figures run on as one wrapping line at the small size; a span, inside the row's button. */
export function StatLine({ figures }: { figures: Figure[] }) {
  if (figures.length === 0) return null;
  return <PairLine figures={figures} className="stat-block stat-line" Tag="span" />;
}
