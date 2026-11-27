// The reminder card and what a hit opens (M5 step 6; docs/05 "The reminder card", "Hit in M5"; docs/06 "The
// reminder card", Modifier line, words guide). One card for everything that came due: procedure steps, then lights,
// then rest, then the GM's reminders; 4 lines, then "N more". A check shows its chance with the modifiers counted
// and each modifier with its source, and Hit / Miss (+ Modifier for the GM's own); a check already run this period
// reads "Checked this turn" (turn modes) or "Checked today" (day modes) with an optional Check again (ruled
// 2026-10-29 and 2026-10-30). A weather line with no season picks its table. Other lines have Done; a timed
// recharge has its one-tap Recharge. All done clears what needs no decision. A hit opens the encounter tables full
// screen (M5 gate B2, EncounterTables.tsx); the hit card keeps what was rolled, with Reveal and Send. Everything here
// is the GM's: players never see the card.
import { useState } from 'react';
import { cardView, checkedWords, modifierWords, type CardLine } from '../modules/expedition/card.ts';
import { elapsedSteps } from '../modules/expedition/clock.ts';
import { chanceWords } from '../modules/expedition/play.ts';
import type { ReadTable, TableRow } from '../modules/expedition/tables.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { DiceWords } from '../ui/dice.tsx';
import type { SetIconName } from '../ui/iconSet.ts';
import { StackedButton, StepSymbol } from '../ui/parts.tsx';
import { TableRollPopUp, type TableTap } from './EncounterTables.tsx';
import './SceneExplore.css';

/** What the GM did with one of a line's count. */
export interface CardActions {
  onHit: (line: CardLine) => void;
  onMiss: (line: CardLine) => void;
  onDone: (line: CardLine) => void;
  onAllDone: () => void;
  onModifier: (line: CardLine, label: string, add: number) => void;
  onRecharge: (line: CardLine) => void;
  /** A roll step's table, to read a row from (nothing is kept). */
  onRoll: (line: CardLine) => void;
  /** "Check again" on a check already run this period: it becomes a check with Hit / Miss. */
  onCheckAgain: (line: CardLine) => void;
  /**
   * Roll… on a check that is a roll on its table (p2p-19, B9; sf-5, page 44 EN2): its table opens in a pop-up. Without
   * it (or with no table to open, `CardRoll`), Roll… takes the hit's way, the tables full screen.
   */
  onRollCheck?: (line: CardLine) => void;
  /** The GM tapped the rolled row in that pop-up: the check's result, recorded by the caller (its hit and its row). */
  onRollRow?: (line: CardLine, tap: TableTap) => void;
  /** "Dismiss" on a check that is a roll on its table (sf-4; page 44, EN1 A and F): the line goes, Undo brings it back. */
  onDismissCheck?: (line: CardLine) => void;
}

/** What the card needs to open a check's table in its pop-up (sf-5; page 44, EN2). */
export interface CardRoll {
  /** The line whose table's pop-up is open; null when none is. */
  openKey: string | null;
  /** The pop-up's X: nothing recorded, and the check waits on its card. */
  onClose: () => void;
  /** The setting's tables, by id. */
  tables: ReadonlyMap<string, ReadTable>;
  /** A row's one-line description (its note, or its stat block's). */
  describe: (row: TableRow) => string | null;
}

/**
 * A check that is a roll on its table (p2p-19; `rollsItsTable` in placeRules.ts, as a card line has it): a check with no
 * chance, not ruled out, whose hit names a table. It has nothing to hit or miss and no modifier: one Roll….
 */
export function rollsTable(line: CardLine): boolean {
  return line.decision === 'check' && !!line.check && line.check.always && !line.check.ruledOut && line.check.hit.tables.length > 0;
}

/** A check's result card's title: "<name>: hit", or the name alone for a roll on its table (p2p-19: no hit there). */
export function hitTitle(line: CardLine): string {
  return rollsTable(line) ? line.name : `${line.name}: hit`;
}

const times = (count: number) => (count > 1 ? ` ×${count}` : '');

/** A check that rolls its table, as one encounter's card (sf-4; page 44, EN1 A): titled by the table's name, else its own. */
export function rollTitle(line: CardLine, tables: ReadonlyMap<string, ReadTable> | undefined): string {
  return `${tables?.get(line.check?.hit.tables[0] ?? '')?.name ?? line.name}${times(line.count)}`;
}

/** "Roll 1d6 · on 1–2", "Roll the table", "Not this time", or the GM's call. */
export function checkWords(line: CardLine): string {
  const check = line.check;
  if (!check) return '';
  if (check.ruledOut) return 'Not this time';
  if (check.always) return 'Roll the table';
  return chanceWords(check.chance);
}

/**
 * A line's first answer, which is its row's one button in "Waiting for you" and, while it is open, the page's accent
 * (S8b): Hit on a check, Check again, Recharge, Roll… on a roll on its table, Enter roll… on a step's roll with a table,
 * else Done. Each with its icon (S17): ic-6's (page 21, SI2); the rolling dice and the tick as page 16 draws them (T2).
 */
export function firstAnswer(line: CardLine): { id: 'hit' | 'rollCheck' | 'again' | 'recharge' | 'roll' | 'done'; label: string; icon: SetIconName } {
  // A check that is a roll on its table (p2p-19; sf-5, page 44 EN1 A, finding 7): Roll…, with the rolling dice.
  if (rollsTable(line)) return { id: 'rollCheck', label: 'Roll…', icon: ANSWER_ICON.roll };
  if (line.decision === 'check') return { id: 'hit', label: 'Hit', icon: ANSWER_ICON.hit };
  if (line.decision === 'again') return { id: 'again', label: 'Check again', icon: ANSWER_ICON.again };
  if (line.decision === 'recharge') return { id: 'recharge', label: 'Recharge', icon: ANSWER_ICON.recharge };
  if (line.decision === 'roll' && (line.tableId || (line.tableChoices?.length ?? 0) > 0)) return { id: 'roll', label: 'Enter roll…', icon: ANSWER_ICON.roll };
  return { id: 'done', label: 'Done', icon: ANSWER_ICON.done };
}

/** A line's answers' icons (S17): ic-6 (page 21, SI2) for Hit, Miss, Check again and Recharge; page 16 (T2) for the rest. */
export const ANSWER_ICON = {
  hit: 'bullseye',
  miss: 'shield-bounces',
  again: 'rolling-dice-cup',
  recharge: 'crystal-wand',
  roll: 'rolling-dices',
  done: 'check-mark',
} as const satisfies Record<string, SetIconName>;

export function ReminderCard({
  title,
  card,
  stepSeconds,
  startedAt,
  stepWord,
  pace,
  single = null,
  roll = null,
  ...actions
}: CardActions & {
  /** The tables a check that is a roll on its table opens in its pop-up (EN2); null: Roll… takes the hit's way. */
  roll?: CardRoll | null;
  /**
   * One line of the card as an item of "Waiting for you" (S8b): its `accent` (the open item's first answer is the
   * page's accent), a Done on a line that needs nothing (so it can leave the list), and All done when anything on the
   * whole card needs no decision (`clearable`).
   */
  single?: { accent: boolean; clearable: boolean } | null;
  /** The mode's pace: "Checked this turn" in turn modes, "Checked today" in day modes (ruled 2026-10-30). */
  pace: 'turn' | 'day';
  /** What brought it: "Next turn", "3 turns", "1 week"; null after a reload. */
  title: string | null;
  card: CardLine[];
  /** For "next at turn 16" (an expedition under way). */
  stepSeconds: number | null;
  startedAt: number | null;
  stepWord: string;
}) {
  const [all, setAll] = useState(false);
  const [modifying, setModifying] = useState<CardLine | null>(null);
  const { onDismissCheck } = actions;
  if (card.length === 0) {
    return title ? (
      <p className="scene-card__empty" role="status">
        {`${title}, nothing due`}
      </p>
    ) : null;
  }
  const { lines, more } = cardView(card, all ? card.length : 4);
  const clearable = single ? single.clearable : card.some((l) => l.decision !== 'check' && l.decision !== 'recharge');
  const cls = (line: CardLine, id: ReturnType<typeof firstAnswer>['id']) => (single?.accent && firstAnswer(line).id === id ? 'primary' : 'secondary');
  // Counted as the time strip counts ("Turn 3" is the strip's turn 3; fixed 2026-11-03, m5b-2 Departures item 9).
  const nextWords = (line: CardLine) =>
    line.nextAt !== null && stepSeconds && startedAt !== null ? `next at ${stepWord} ${elapsedSteps(line.nextAt, startedAt, stepSeconds)}` : null;

  // In "Waiting for you" a check that rolls its table is one encounter's card (EN1 A): the panel's crossed swords and the
  // table's name as its heading, no "Due now" and no line head.
  const encounter = single && card.length === 1 && rollsTable(card[0]!) ? rollTitle(card[0]!, roll?.tables) : null;

  return (
    <section className="scene-card" aria-label="Due">
      {/* B8 (M5 gate): what an advance brought due is due now, on the turn being played (never "Due · Next turn"). */}
      <h3 className={encounter ? 'waiting-encounter__title' : 'label scene-card__title'}>{encounter ?? (title ? 'Due now' : 'Due')}</h3>
      <ul className="scene-card__lines">
        {lines.map((line) => (
          <li key={line.key} className="scene-card__line">
            {!encounter && (
              <div className="scene-card__head">
                <StepSymbol symbol={line.icon} label={line.icon} small />
                <span className="scene-card__name">{`${line.name}${times(line.count)}`}</span>
              </div>
            )}
            {rollsTable(line) ? (
              <RollOnTable
                line={line}
                accent={cls(line, 'rollCheck') === 'primary'}
                roll={roll}
                onOpen={() => (actions.onRollCheck ? actions.onRollCheck(line) : actions.onHit(line))}
                onHit={() => actions.onHit(line)}
                onRow={(tap) => (actions.onRollRow ? actions.onRollRow(line, tap) : actions.onHit(line))}
                onDismiss={onDismissCheck ? () => onDismissCheck(line) : undefined}
              />
            ) : (
              <>
            {/* Once per period (ruled 2026-10-29): a check already run says so in the mode's step, with one optional tap. */}
            {line.decision === 'again' && <p className="scene-card__chance">{checkedWords(pace)}</p>}
            {line.check && line.decision !== 'again' && <p className="scene-card__chance">{checkWords(line)}</p>}
            {line.check && line.decision !== 'again' && line.check.modifiers.length > 0 && (
              <ul className="scene-card__modifiers" aria-label={`Modifiers for ${line.name}`}>
                {line.check.modifiers.map((m, i) => (
                  <li key={`${i}-${m.label}`}>{modifierWords(m)}</li>
                ))}
              </ul>
            )}
            {line.note && <p className="scene-card__note">{line.note}</p>}
            {line.decision === 'check' && nextWords(line) && <p className="scene-card__note">{nextWords(line)}</p>}
            {line.decision === 'check' && (
              <>
                {/* The answers are stacked buttons with their icons (S17; ic-6, page 21 SI2), on a row of their own; ±1 and
                    + Modifier keep their words on the row below (the approval's fix 2, 2026-11-18). Each row's buttons
                    share one height. */}
                <div className="scene-card__buttons scene-card__answers" role="group" aria-label={`Answer, ${line.name}`}>
                  <StackedButton icon={ANSWER_ICON.hit} label="Hit" variant={cls(line, 'hit')} aria-label={`Hit, ${line.name}`} onClick={() => actions.onHit(line)} />
                  <StackedButton icon={ANSWER_ICON.miss} label="Miss" aria-label={`Miss, ${line.name}`} onClick={() => actions.onMiss(line)} />
                </div>
                <div className="scene-card__buttons scene-card__faces" role="group" aria-label={`Change the chance, ${line.name}`}>
                  {/* One tap applies ±1 (ruled 2026-10-29: journey 3 is Next turn → +1 → outcome). */}
                  <button type="button" className="button-secondary" aria-label={`−1 face, ${line.name}`} onClick={() => actions.onModifier(line, '', -1)}>
                    −1
                  </button>
                  <button type="button" className="button-secondary" aria-label={`+1 face, ${line.name}`} onClick={() => actions.onModifier(line, '', 1)}>
                    +1
                  </button>
                  <button type="button" className="button-secondary button-secondary--small" aria-label={`+ Modifier, ${line.name}`} onClick={() => setModifying(line)}>
                    + Modifier
                  </button>
                </div>
              </>
            )}
              </>
            )}
            {line.decision !== 'check' && (
            <div className="scene-card__buttons">
              {line.decision === 'again' && (
                <StackedButton icon={ANSWER_ICON.again} label="Check again" variant={cls(line, 'again')} aria-label={`Check again, ${line.name}`} onClick={() => actions.onCheckAgain(line)} />
              )}
              {line.decision === 'recharge' && (
                <StackedButton icon={ANSWER_ICON.recharge} label="Recharge" variant={cls(line, 'recharge')} aria-label={`Recharge, ${line.name}`} onClick={() => actions.onRecharge(line)} />
              )}
              {line.decision === 'roll' && (line.tableId || (line.tableChoices?.length ?? 0) > 0) && (
                <StackedButton icon={ANSWER_ICON.roll} label="Enter roll…" variant={cls(line, 'roll')} aria-label={`Enter roll, ${line.name}`} onClick={() => actions.onRoll(line)} />
              )}
              {(line.decision === 'done' || line.decision === 'roll' || (single && line.decision === 'info')) && (
                <StackedButton icon={ANSWER_ICON.done} label="Done" variant={cls(line, 'done')} aria-label={`Done, ${line.name}`} onClick={() => actions.onDone(line)} />
              )}
            </div>
            )}
          </li>
        ))}
      </ul>
      <div className="scene-card__foot">
        {more > 0 && (
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setAll(true)}>
            {`${more} more`}
          </button>
        )}
        {clearable && (
          <button type="button" className="button-secondary" onClick={actions.onAllDone}>
            All done
          </button>
        )}
      </div>
      {modifying && (
        <ModifierDialog
          line={modifying}
          onClose={() => setModifying(null)}
          onAdd={(label, add) => {
            setModifying(null);
            actions.onModifier(modifying, label, add);
          }}
        />
      )}
    </section>
  );
}

/**
 * A check that is a roll on its table (p2p-19, B9; sf-5, sf-4, page 44 EN1 A and EN2): the pack's sentence with its die,
 * Roll… (the rolling dice) and Dismiss; no Hit, Miss, ±1 or Modifier. Roll… opens the table's pop-up (`TableRollPopUp`);
 * a tap on the rolled row is the answer, the X records nothing. With no table to open, Roll… takes the hit's way.
 */
function RollOnTable({
  line,
  accent,
  roll,
  onOpen,
  onHit,
  onRow,
  onDismiss,
}: {
  line: CardLine;
  accent: boolean;
  roll: CardRoll | null;
  onOpen: () => void;
  onHit: () => void;
  onRow: (tap: TableTap) => void;
  onDismiss?: () => void;
}) {
  const tableId = line.check?.hit.tables[0] ?? null;
  const table = roll && tableId ? (roll.tables.get(tableId) ?? null) : null;
  return (
    <>
      {line.note && (
        <p className="scene-card__note">
          <DiceWords>{line.note}</DiceWords>
        </p>
      )}
      <div className="scene-card__buttons scene-card__answers" role="group" aria-label={`Answer, ${line.name}`}>
        <StackedButton icon={ANSWER_ICON.roll} label="Roll…" variant={accent ? 'primary' : 'secondary'} aria-label={`Roll, ${line.name}`} onClick={table ? onOpen : onHit} />
        {onDismiss && <StackedButton icon="cancel" label="Dismiss" aria-label={`Dismiss, ${line.name}`} onClick={onDismiss} />}
      </div>
      {table && roll?.openKey === line.key && <TableRollPopUp title={line.name} table={table} tables={roll.tables} describe={roll.describe} onRow={onRow} onClose={roll.onClose} />}
    </>
  );
}

/**
 * + Modifier (GM only; ruled 2026-10-29: −1 / +1 chips with an optional note, one tap applies; logged with the
 * check's result). Tap again for more.
 */
function ModifierDialog({ line, onClose, onAdd }: { line: CardLine; onClose: () => void; onAdd: (label: string, add: number) => void }) {
  const [label, setLabel] = useState('');
  return (
    <Dialog label={`Modifier for ${line.name}`} onClose={onClose}>
      <label className="field">
        <span className="label">Note (optional)</span>
        <input className="field__input" value={label} maxLength={80} placeholder="Noisy armour" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <div className="scene-card__buttons" role="group" aria-label="Faces">
        <button type="button" className="button-secondary" aria-label="−1 face" onClick={() => onAdd(label.trim(), -1)}>
          −1
        </button>
        <button type="button" className="button-secondary" aria-label="+1 face" onClick={() => onAdd(label.trim(), 1)}>
          +1
        </button>
      </div>
    </Dialog>
  );
}

/**
 * The hit card (05 "After Hit"; M5 gate B2): the tables open full screen on a hit (Which table?); this card stays on
 * the console with what was rolled, Encounter tables › to open them again, Reveal and Message…. With no table, the
 * check's note (skippable).
 */
export function HitPanel({
  line,
  rowText,
  onTables,
  onClose,
  hidden,
  onReveal,
  onSend,
  accent = false,
}: {
  line: CardLine;
  /** What the tapped row read ("Abbey › Mortal: Pilgrims"), once rolled. */
  rowText: string | null;
  /** Opens the encounter tables again; absent when the setting has none. */
  onTables?: () => void;
  /** Message… (M5 gate B3): the result's words go into a new message to chosen characters, editable. */
  onSend?: (words: string) => void;
  /** The result is secret and not yet revealed: players see it at Downtime, or now with Reveal (ruled 2026-10-29). */
  hidden: boolean;
  onReveal: () => void;
  /** Its Done is the page's accent (the open item of "Waiting for you", S8b). */
  accent?: boolean;
  onClose: () => void;
}) {
  const hit = line.check?.hit;
  return (
    <section className="scene-card scene-card--hit" aria-label={hitTitle(line)}>
      <h3 className="label scene-card__title">{hitTitle(line)}</h3>
      {hit?.note && <p className="scene-card__note">{hit.note}</p>}
      {rowText ? (
        <p className="scene-card__note" role="status">{`Rolled: ${rowText}`}</p>
      ) : (
        !onTables && !hit?.note && <p className="scene-card__note">No table for this check. Say what happens.</p>
      )}
      {hit?.swap && <p className="scene-card__note">{`${hit.swap.season}: on ${hit.swap.chance.on.join(', ')} roll its table instead.`}</p>}
      {onTables && (
        <button type="button" className="button-secondary" onClick={onTables}>
          Encounter tables ›
        </button>
      )}
      <div className="scene-card__foot">
        <button type="button" className={accent ? 'button-primary' : 'button-secondary'} onClick={onClose}>
          Done
        </button>
        {hidden ? (
          <button type="button" className="button-secondary button-secondary--small" onClick={onReveal}>
            Reveal to players
          </button>
        ) : (
          <span className="scene-card__note">Players see this result.</span>
        )}
        {onSend && (
          <button type="button" className="button-secondary button-secondary--small" onClick={() => onSend(rowText ?? (rollsTable(line) ? line.name : `${line.name}: a hit`))}>
            Message…
          </button>
        )}
      </div>
    </section>
  );
}
