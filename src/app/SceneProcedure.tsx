// Where the procedure is, at a glance (M5 step 6; docs/05 "Exploration modes", "Exploration follow-ups" X-1; docs/06
// "Explore, exploration modes", "Hour track").
//   * HourTrack (turn modes): one row of pips, one per turn in the hour, the current one filled, with symbols on the
//     future pips for what's coming (checks, rest, effects ending, the first light out). Players see only the public
//     ones.
//   * ProcedureStrip (the GM's Scene, every state; dec-9 S7): the procedure in force as circles with icons, no state.
//   * ProcedureList: the whole procedure, one tap away (the GM's checklist, with each check's chance and modifiers
//     and what was recorded this time; players get the same list as reference, without the GM's numbers).
import { Fragment } from 'react';
import { modifierWords, type CardLine } from '../modules/expedition/card.ts';
import type { Pip } from '../modules/expedition/hourTrack.ts';
import type { Mode } from '../modules/expedition/modes.ts';
import { chanceWords } from '../modules/expedition/play.ts';
import type { StripStep } from '../modules/expedition/stripSteps.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon, packIconOf, StepIcon } from '../ui/icons.tsx';
import { StepSymbol } from '../ui/parts.tsx';
import { checkWords } from './ReminderCard.tsx';
import './SceneExplore.css';

/** The symbols a wandering check sits on the track with (the step's, or a GM reminder marked Encounter check). */
const CHECK_SYMBOLS = new Set(['encounter', 'monster']);

/**
 * `onCheckNow` (the GM's, DG3): the next wandering check's marker is a button, "Encounter check" ("Check now" until
 * the M5 gate, B12), for an ad-hoc check; the schedule carries on. Only the first pip with one gets it. A `next` pip
 * (the next hour's first turn; B8 follow-up, ruled 2026-11-01) sits past a rule at the track's edge, on the hour's
 * last turn only, for what falls due as the hour turns over.
 */
export function HourTrack({ pips, stepWord, onCheckNow }: { pips: Pip[]; stepWord: string; onCheckNow?: () => void }) {
  const marker = onCheckNow ? pips.findIndex((p) => p.events.some((e) => CHECK_SYMBOLS.has(e.symbol))) : -1;
  const inHour = pips.filter((p) => !p.next).length;
  return (
    <ol className="hour-track" aria-label="This hour">
      {pips.map((pip, index) => {
        const what = pip.events.map((e) => e.label).join(', ');
        const where = pip.next ? `Next hour, ${stepWord.toLowerCase()} ${pip.turn}` : `${stepWord} ${pip.turn} of ${inHour}`;
        const said = `${where}${pip.current ? ', now' : pip.done ? ', done' : ''}${what ? `: ${what}` : ''}`;
        const symbols = pip.events.slice(0, 2).map((e, i) => <StepSymbol key={`${i}-${e.label}`} symbol={e.symbol} label={e.label} small />);
        const state = pip.next ? ' hour-track__pip--next' : pip.current ? ' hour-track__pip--current' : pip.done ? ' hour-track__pip--done' : '';
        return (
          <li key={pip.next ? 'next' : pip.turn} className={`hour-track__pip${state}`} aria-label={said}>
            <span className="hour-track__dot" aria-hidden="true" />
            {marker === index ? (
              <button type="button" className="hour-track__check" aria-label="Encounter check" onClick={onCheckNow}>
                <span className="hour-track__events" aria-hidden="true">
                  {symbols}
                </span>
              </button>
            ) : (
              <span className="hour-track__events" aria-hidden="true">
                {symbols}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The strip (plan dec-9-the-whole-scene S7; mc-53 to mc-56, mc-60, ds-11; page 16, T1, T2, T8; frame R1): the procedure
 * in force as circles with icons, a reminder and not a process: no heading (its name is a screen reader's), no state
 * (nothing marks a step current, done or due), centred, its dotted links stretched a little. The words show under each
 * circle on a tablet and not on a phone, where each circle stays named for a screen reader (mc-56). A step's icon is
 * the pack's name for it (pf-12c): a set icon, else a step symbol's drawing, else its number (mc-60). A step is a tap
 * only where its pack carries text for it (mc-55), opening that text; any other step is no button.
 */
export function ProcedureStrip({ steps, onOpen }: { steps: readonly StripStep[]; onOpen: (step: StripStep) => void }) {
  if (steps.length === 0) return null;
  return (
    <div className="procedure-strip" role="group" aria-label="Sequence of play">
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 && <span className="procedure-strip__link" aria-hidden="true" />}
          {step.text !== null ? (
            <button type="button" className="procedure-strip__step procedure-strip__step--tap" aria-label={`${step.name}: read it`} aria-haspopup="dialog" onClick={() => onOpen(step)}>
              <StripMark step={step} number={index + 1} />
            </button>
          ) : (
            <span className="procedure-strip__step" role="img" aria-label={step.name}>
              <StripMark step={step} number={index + 1} />
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function StripMark({ step, number }: { step: StripStep; number: number }) {
  const icon = packIconOf(step.icon, 'step');
  const mark =
    icon?.from === 'set' ? (
      <Icon name={icon.name} size={32} />
    ) : icon?.from === 'step' && icon.drawn ? (
      <StepIcon name={icon.name} size={32} />
    ) : (
      <span className="procedure-strip__number">{number}</span>
    );
  return (
    <>
      <span className="procedure-strip__circle" aria-hidden="true">
        {mark}
      </span>
      <span className="procedure-strip__name" aria-hidden="true">
        {step.name}
      </span>
    </>
  );
}

/**
 * The whole procedure as a list (the checklist button). Each step says what it does in the pack's own words (its
 * note; M5 gate B14: never "A check", "A reminder" or "Done by the app"). The GM sees each check's chance with its
 * modifiers, from this step's card when it's there, and what was recorded this time; players (`gm` false) see the
 * steps and notes.
 */
export function ProcedureList({
  mode,
  card,
  recorded,
  gm,
  onClose,
}: {
  mode: Mode;
  card: readonly CardLine[];
  /** What was recorded for each check this time, by its card key ("Hit · Bog lurkers · 1d4"). */
  recorded: ReadonlyMap<string, string>;
  gm: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog label={`${mode.name}: the procedure`} onClose={onClose}>
      {mode.procedure.length === 0 ? (
        <p className="scene-card__note">This mode has no steps of its own: the clock moves, and reminders come due.</p>
      ) : (
        <ol className="procedure-list">
          {mode.procedure.map((step) => {
            const line = gm ? card.find((l) => l.stepId === step.id) : undefined;
            const check = step.kind === 'check' ? mode.checks.find((c) => c.id === step.checkId) : undefined;
            const key = check ? `check:mode:${check.id}` : null;
            return (
              <li key={step.id} className="procedure-list__step">
                <StepSymbol symbol={step.icon} label={step.name} />
                <div className="procedure-list__words">
                  <span className="procedure-list__name">{step.name}</span>
                  {step.note && <span className="scene-card__note">{step.note}</span>}
                  {gm && check && <span className="scene-card__note">{line ? checkWords(line) : chanceWords(check.chance)}</span>}
                  {gm && line?.check?.modifiers.map((m, i) => (
                    <span key={`${i}-${m.label}`} className="scene-card__note">
                      {m.kind === 'trait' ? modifierWords(m) : m.add !== null ? `${m.add > 0 ? '+' : '−'}${Math.abs(m.add)}, ${m.label}` : m.label}
                    </span>
                  ))}
                  {gm && key && recorded.get(key) && <span className="procedure-list__recorded">{recorded.get(key)}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Dialog>
  );
}
