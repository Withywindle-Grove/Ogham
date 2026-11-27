// The At hand weapon sheets (ruling m5b-at-hand-actions-2026-11-08; mockup players/06): the Attack sheet (ah-1: a sheet,
// not a roll, until the fight rules at M6), the mode sheet (ah-3: Quiver, Pouch, Grip or Stance as pick rows) and the
// blocked Attack's sheet when a mode's stack is spent. Each is a Sheet (Dialog inside SheetScope); the row decides which
// opens. Nothing here saves by itself: the row passes what a button does.
// The Player tab's **At hand pop-up** (tfh-1 to tfh-5, page M2 frames M2l to M2n, approved 2026-11-19) holds the Attack
// view (`AttackView`) for a weapon, or a thing's facts (`AtHandFacts`), at the top of the item's short sheet
// (ItemSheet's `atHand` variant).
import { useContext, useId, type ReactNode } from 'react';
import { BookPopUpScope, Dialog } from '../ui/Dialog.tsx';
import { RollCard } from '../ui/dice.tsx';
import { PickRow } from '../ui/creation.tsx';
import type { AttackRoll } from '../modules/characters/play.ts';
import { shownName } from '../modules/inventory/packView.ts';
import {
  carriedModes,
  MODE_BUTTON_WORDS,
  modeBlurb,
  modeIntro,
  noneCarriedWords,
  rangeBands,
  rangeHeading,
  spentWords,
  type InflictedCondition,
  type ModeState,
  type RangeWhere,
  type WeaponRange,
} from '../modules/inventory/weaponModes.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { leftWords, lightState, secondsLeft } from '../modules/expedition/lightPlay.ts';
import type { CharacterLightView } from './LightSection.tsx';
import { withThe } from '../core/nameWords.ts';

/** What the Attack view holds: the weapon's rolls and what bears on them (ah-1, as-1 … as-3). */
export interface AttackViewProps {
  /** What the attack inflicts (`applies.conditionId`; Design on #569): each condition's name, its brief effect under it. */
  inflicts?: readonly InflictedCondition[];
  /** The weapon's figure as its row shows it ("+2, 1d8"), for a weapon whose parts aren't known here. */
  figure: string | null;
  /** The rolls, to hit first (weaponRolls); none: the figure as a line. */
  rolls: readonly AttackRoll[];
  /** The range the attack uses (attackRange), or null. */
  range?: WeaponRange | null;
  /** Where the party is, for the range's unit (as-2); null: not known, both units named. */
  where?: RangeWhere;
  patchLines?: readonly string[];
  rules: readonly string[];
  /** The mode's use: its button's words and what it does; null when the mode draws nothing. */
  spend: { label: string; run: () => void } | null;
}

/**
 * The Attack view (ah-1, reordered by as-1 … as-3, ruling m5b-attack-sheet-clarity-2026-11-10): the two rolls first, to
 * hit then damage, each a Roll card (its die, the plain line with the sum, its parts as rows with their own figures); the
 * range under its own heading with its unit when the pack gives one (G-219; else the quality's text says it under the
 * rules); then the rules that bear, what it inflicts, and, with a mode that draws a stack, the spend of one use ("Fire
 * one, 17 left after"; `item.use`). It ends with its rows: no line about the fight rules (tfw-3, 2026-11-19). The Attack
 * sheet holds it alone; the Player tab's At hand pop-up holds all of it above the thing's rows (tfh-1, tfh-2; page M2,
 * frame M2l: "all of the Attack view stays").
 */
export function AttackView({ figure, rolls, range = null, where = null, patchLines = [], rules, inflicts = [], spend }: AttackViewProps) {
  const headingId = useId();
  return (
    <div className="at-hand-sheet">
      {rolls.length > 0 ? rolls.map((r) => <RollCard key={r.line} dice={r.dice} line={r.line} notes={r.notes} parts={r.parts} />) : <p>{figure ?? 'This weapon has no figures in the setting rules.'}</p>}
      {patchLines.map((l, i) => (
        <p key={`${i}:${l}`} className="reading">
          {l}
        </p>
      ))}
      {range && (
        <section aria-labelledby={`${headingId}-range`}>
          <h3 id={`${headingId}-range`} className="at-hand-sheet__heading">
            {rangeHeading(range, where)}
          </h3>
          <ul className="at-hand-sheet__range">
            {rangeBands(range).map((b) => (
              <li key={b.name} className="at-hand-sheet__band">
                <span className="at-hand-sheet__band-name">{b.name}</span>
                <strong>{b.reach}</strong>
                <span>{b.effect}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rules.length > 0 && <FactLine label="Qualities">{rules.join(', ')}</FactLine>}
      {inflicts.map((c) => (
        // As a status shows its note (M5 gate B6): the name, then the brief effect, quiet, under it.
        <div key={c.name} className="at-hand-sheet__inflicts">
          <FactLine label="Inflicts">{c.name}</FactLine>
          {c.note && <p className="auth__meta">{c.note}</p>}
        </div>
      ))}
      {spend && (
        <button type="button" className="button-secondary at-hand-sheet__wide" onClick={spend.run}>
          {spend.label}
        </button>
      )}
    </div>
  );
}

/**
 * One labelled fact ("Qualities", "Charges"): on the Player tab, the book's labelled line, the label in the book
 * label's colour (tfb-1, row C8; page M2, frames M2l and M2n); elsewhere (the Pack tab) the bold label and a colon.
 */
function FactLine({ label, children }: { label: string; children: ReactNode }) {
  const book = useContext(BookPopUpScope);
  return book ? (
    <p className="book-line">
      <span className="book-label">{label}</span> {children}
    </p>
  ) : (
    <p>
      <strong>{label}:</strong> {children}
    </p>
  );
}

/** The Attack sheet (ah-1): the Attack view alone, titled with the weapon's name. The Pack tab's At hand opens it. */
export function AttackSheet({
  name,
  onClose,
  preview = false,
  ...view
}: AttackViewProps & {
  /** The gallery's picture: the sheet drawn in the page. */
  preview?: boolean;
  name: string;
  onClose: () => void;
}) {
  return (
    <Dialog label={shownName(name)} onClose={onClose} preview={preview}>
      <AttackView {...view} />
    </Dialog>
  );
}

/** One fact of a thing At hand: its label and what it is now ("Charges", "3 left"; "Light", "Lit, 4 turns left"). */
export interface AtHandFact {
  label: string;
  value: string;
}

/**
 * A burning light's facts for its pop-up (page M2, frame M2n): "Light", "Lit, 4 turns left", and where it can be
 * refilled "Refills", "3 left", the words of its rows At hand (LitLight); none for a line that isn't the light burning.
 */
export function lightFactsOf(view: CharacterLightView | null, lineId: string): AtHandFact[] {
  const light = view?.light;
  if (!view || !light || light === 'error' || light.lineId !== lineId) return [];
  const state = lightState(light, view.now);
  if (state !== 'lit' && state !== 'low') return [];
  const facts: AtHandFact[] = [{ label: 'Light', value: `Lit, ${leftWords(secondsLeft(light, view.now), view.unitOf(light.typeId))}` }];
  if (light.fuelItem && view.fuel.left > 0) facts.push({ label: 'Refills', value: `${view.fuel.left} left` });
  return facts;
}

/**
 * A thing's charges as the fact "Charges" holds them: the row's words (packHelpers' `chargeWords`) without the word the
 * label already says ("3 charges left" → "3 left"; "Charges: ?" → "?"; "Charges not set" → "Not set").
 */
export function chargeFact(words: string): string {
  const value = words.replace(/^Charges:? /, '').replace(/ charges? left/, ' left');
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * What a thing At hand does now (tfh-3; page M2, frame M2n): its uses or its light left, each a labelled line, at the
 * top of its short pop-up. Nothing when it has none. No pack facts (slot, value, weight).
 */
export function AtHandFacts({ facts }: { facts: readonly AtHandFact[] }) {
  if (facts.length === 0) return null;
  return (
    <div className="at-hand-sheet">
      {facts.map((f) => (
        <FactLine key={f.label} label={f.label}>
          {f.value}
        </FactLine>
      ))}
    </div>
  );
}

/**
 * The mode sheet (ah-3, mockup players/06): the modes as pick rows, the one in use Picked; a pick closes the sheet. A
 * Quiver or a Pouch lists only the kinds the character carries, with no line over or under them; with none carried,
 * one line says so and the sheet closes with ✕ alone (tfh-6, 2026-11-19; page M2, frame M2o).
 */
export function ModeSheet({
  weaponName,
  state,
  lines,
  actorId,
  weaponDamage,
  onPick,
  onClose,
  preview = false,
}: {
  preview?: boolean;
  weaponName: string;
  state: ModeState;
  lines: readonly InventoryLine[];
  actorId: string | null;
  weaponDamage: string | null;
  /** A mode tapped: the row chooses it, or explains why it can't (none in the pack). */
  onPick: (modeId: string) => void;
  onClose: () => void;
}) {
  const { modes } = state;
  const shown = carriedModes(modes, lines, actorId);
  const intro = modeIntro(modes.button, weaponName);
  // A Quiver or a Pouch (its modes draw from a stack) lists plain rows (page M2, frame M2o; Francis on #1069, 2026-11-19);
  // a Grip and a Stance draw nothing and keep the boxed pick rows (M2o: "A grip and a stance … do not change").
  const plain = modes.list.some((m) => m.draws !== null);
  return (
    <Dialog label={MODE_BUTTON_WORDS[modes.button]} onClose={onClose} preview={preview}>
      <div className="at-hand-sheet">
        {intro && <p className="auth__meta">{intro}</p>}
        {shown.length === 0 ? (
          <p>{noneCarriedWords(modes.button)}</p>
        ) : (
          <div role="group" aria-label={`${MODE_BUTTON_WORDS[modes.button]} of ${withThe(weaponName)}`}>
            {shown.map((m) => (
              <PickRow key={m.id} name={m.name} blurb={modeBlurb(m, modes, lines, actorId, weaponDamage)} picked={state.engaged && state.mode?.id === m.id} plain={plain} onPick={() => onPick(m.id)} />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** A blocked Attack (ah-3): the mode's stack is spent; why, and the way forward (opens the mode sheet). Never greyed. */
export function SpentSheet({
  weaponName,
  state,
  onOpenModes,
  onClose,
  preview = false,
}: {
  weaponName: string;
  state: ModeState;
  onOpenModes: () => void;
  onClose: () => void;
  preview?: boolean;
}) {
  const words = spentWords(state, weaponName);
  return (
    <Dialog label={words.title} onClose={onClose} preview={preview}>
      <div className="at-hand-sheet">
        <p className="blocked-sheet__why">{words.why}</p>
        <button type="button" className="button-primary at-hand-sheet__wide" onClick={onOpenModes}>
          {words.open}
        </button>
      </div>
    </Dialog>
  );
}
