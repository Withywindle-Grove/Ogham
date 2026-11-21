// Rest as a shared flow on screen (M5b step g6; ruled 2026-11-01, M5 gate B5; docs/05 "Rest"; docs/06 "Rest flow";
// mockup docs/design/mockups/m5-gate/b5-rest-flow.html). Replaces M5 step 9's Rest this turn / Rest today and the
// GM's Rested / Push on. Four parts:
//   RestMarker: the strip's marker, counting down in words ("Rest in 2", "Rest due"; "Rest day…" in day modes), lit
//     (the pressed outline) when due; "Rest due · you pushed on" for a player whose character pushed on; the GM's
//     minimised panel reads "Rest due · 2 of 4" and reopens on a tap. Otherwise a tap explains the rule.
//   RestPrompt: the player's prompt in the table view's slot: Rest (the screen's one accent) / Push on / ⓘ, one line
//     per character they play; folds to "Resting this turn · Change" once answered.
//   RestPanel: the GM's working panel "Rest due · N of M answered": one row per character (☾ Resting · → Pushing on ·
//     … waiting), a tap flips it; Everyone rests / No one rests; Minimise. No Done: Next turn applies.
//   RestRule: the rule in the pack's words (ⓘ).
import { useState } from 'react';
import { Dialog } from '../ui/Dialog.tsx';
import { InfoButton, StepSymbol } from '../ui/parts.tsx';
import { ANSWER_WORDS, type RestAnswer, type RestFlow } from '../modules/expedition/restFlow.ts';
import './Statuses.css';

/** The rest rule in the pack's words (ⓘ on the rest marker), for the GM and players alike. */
export function RestRule({ words, head = null, onClose }: { words: string[]; head?: string | null; onClose: () => void }) {
  return (
    <Dialog label="Rest" onClose={onClose}>
      {/* The Rest fact's whole words, which its tile may cut (tv-1). */}
      {head && <p className="rest-prompt__note">{head}</p>}
      {words.map((line) => (
        <p key={line} className="rest-prompt__note">
          {line}
        </p>
      ))}
    </Dialog>
  );
}

/** One character's line in a prompt or panel. */
export interface RestLine {
  id: string;
  name: string;
  answer: RestAnswer;
  /** Their statuses in words ("Weary ×1"), shown beside the name on the GM's rows. */
  statuses?: string;
  /** Who answers for them, when it isn't the GM's own row to tap ("Tam answers"). */
  note?: string | null;
}

/**
 * The player's prompt (B5): "Rest due · this turn" with the rule's short words, then Rest (accent) / Push on / ⓘ for
 * each character they play; an answered line folds to "Resting this turn · Change".
 */
export function RestPrompt({
  lines,
  day,
  summary,
  called,
  onAnswer,
  onRule,
  promptId,
}: {
  /** Names this rest in the prompt slot (a rest called after a due one is a new prompt: it goes on top). */
  promptId?: string;
  lines: RestLine[];
  day: boolean;
  /** The rule in a few words ("One turn in six; pushing on marks Weary."). */
  summary: string | null;
  /** "Wren called a rest." when it was called out of turn. */
  called: string | null;
  onAnswer: (id: string, answer: 'rest' | 'push') => void;
  onRule: () => void;
}) {
  const [changing, setChanging] = useState<Set<string>>(new Set());
  if (lines.length === 0) return null;
  const when = day ? 'today' : 'this turn';
  const many = lines.length > 1;
  const answer = (id: string, value: 'rest' | 'push') => {
    setChanging((c) => {
      const next = new Set(c);
      next.delete(id);
      return next;
    });
    onAnswer(id, value);
  };
  const firstOpen = lines.find((l) => l.answer === 'waiting' || changing.has(l.id))?.id ?? null;
  return (
    <section className="rest-prompt prompt-card" aria-label={day ? 'Rest day' : 'Rest due'} data-prompt-id={promptId}>
      <p className="rest-prompt__due">
        <StepSymbol symbol="rest" label="Rest" small />
        <span>{`${day ? 'Rest day' : 'Rest due'}, ${when}`}</span>
      </p>
      {called && <p className="rest-prompt__note">{called}</p>}
      {summary && <p className="rest-prompt__note">{summary}</p>}
      {lines.map((line) =>
        line.answer !== 'waiting' && !changing.has(line.id) ? (
          <div key={line.id} className="rest-prompt__row">
            <span className="rest-prompt__note" role="status">{`${many ? `${line.name}: ` : ''}${line.answer === 'resting' ? `Resting ${when}` : 'Pushing on'}`}</span>
            <button type="button" className="button-secondary button-secondary--small" aria-label={`Change${many ? `, ${line.name}` : ''}`} onClick={() => setChanging((c) => new Set(c).add(line.id))}>
              Change
            </button>
          </div>
        ) : (
          <div key={line.id} className="rest-prompt__row" role="group" aria-label={many ? line.name : 'Your answer'}>
            {many && <span className="rest-prompt__who">{line.name}</span>}
            {/* The screen's one accent button is the first open Rest (B18: only a prompt carries it). */}
            <button type="button" className={line.id === firstOpen ? 'button-primary' : 'button-secondary'} aria-label={many ? `Rest, ${line.name}` : 'Rest'} onClick={() => answer(line.id, 'rest')}>
              Rest
            </button>
            <button type="button" className="button-secondary" aria-label={many ? `Push on, ${line.name}` : 'Push on'} onClick={() => answer(line.id, 'push')}>
              Push on
            </button>
            {!many && <InfoButton label="resting" onOpen={onRule} />}
          </div>
        ),
      )}
      {many && (
        <div className="rest-prompt__row">
          <InfoButton label="resting" onOpen={onRule} />
        </div>
      )}
    </section>
  );
}

/**
 * The GM's working panel (B5): "Rest due · N of M answered", one row per character (a tap flips it), Everyone rests
 * / No one rests, Minimise. Next turn applies the answers; unanswered count as Push on.
 */
export function RestPanel({
  flow,
  lines,
  group,
  day,
  called,
  onFlip,
  onAll,
  onMinimise,
  onRule,
}: {
  flow: RestFlow;
  lines: RestLine[];
  /** "Group 2" after a split; null for the whole party. */
  group: string | null;
  day: boolean;
  called: string | null;
  onFlip: (line: RestLine) => void;
  onAll: (answer: 'rest' | 'push') => void;
  /** Minimise, where the panel stands in the page (a town); absent in "Waiting for you" and its sheet (S8b). */
  onMinimise?: () => void;
  onRule: () => void;
}) {
  const title = `${group ? `${group}: ` : ''}${day ? 'Rest day' : 'Rest due'}, ${flow.answered} of ${flow.members.length} answered`;
  return (
    <section className="rest-panel" aria-label={title}>
      <div className="rest-panel__head">
        <h3 className="rest-panel__title">{title}</h3>
        <InfoButton label="resting" onOpen={onRule} />
        {onMinimise && (
          <button type="button" className="button-secondary button-secondary--small" onClick={onMinimise}>
            Minimise
          </button>
        )}
      </div>
      {called && <p className="rest-prompt__note">{called}</p>}
      <ul className="rest-panel__rows">
        {lines.map((line) => {
          const shown = ANSWER_WORDS[line.answer];
          return (
            <li key={line.id}>
              <button
                type="button"
                className="rest-panel__row"
                aria-label={`${line.name}: ${shown.words}. Tap to change`}
                onClick={() => onFlip(line)}
              >
                <span className="rest-panel__who">
                  {line.name}
                  {line.statuses ? `, ${line.statuses}` : ''}
                  {line.note ? `, ${line.note}` : ''}
                </span>
                <span className="rest-panel__answer" aria-hidden="true">
                  {`${shown.symbol} ${shown.words}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="rest-panel__actions">
        <button type="button" className="button-secondary" onClick={() => onAll('rest')}>
          Everyone rests
        </button>
        <button type="button" className="button-secondary" onClick={() => onAll('push')}>
          No one rests
        </button>
      </div>
      <p className="rest-prompt__note">{`Unanswered count as Push on when you tap ${day ? 'Next day' : 'Next turn'}.`}</p>
    </section>
  );
}
