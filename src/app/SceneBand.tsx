// The Scene's band and facts row (plan docs/plans/dec-9-the-whole-scene.md rows S1, S4 and S9; page 16 of the
// December mockups, approved 2026-11-14, st-1 to st-8). Parts only: they draw what they're given and say what was
// tapped; SceneTime decides the words (sceneTop.ts) and the accent (sceneWaiting.tsx, accentOwner).
//   SceneBand: the session line in small capitals, the heading (the one heading that opens the procedure, fl-5), the
//     date line (the season's icon, the date in small capitals, the light left; itself the tap while the date is
//     unset, st-2), an optional quiet line under it ("Resumed: …"), then `actions` (S2's icon buttons and Next turn,
//     or Start / Resume session) and `menu` (⋯, S3's) at its right. On a phone the actions drop under the date.
//     `fold` (p2p-20; page 24, TF1, TF1b): the fold mark, a framed square with − open and + folded, between Next turn
//     and the menu button, the menu last (F3 a, Francis 2026-11-25; plan dec-scene-quickfix Q3; on a phone at the
//     heading's right, as TF1b); folded, each due fact is one small line under the date.
//   NextTurnButton: the hourglass and the mode's one unit ("Next turn"; mc-57).
//   SessionButton: Start or Resume (the session) in Next turn's place, with the campfire (ic-4, S17).
//   FactsRow: Weather, Light, Rest, Encounter check (S4), four across, two by two on a phone; a fact's value keeps to
//     one line (mc-39b; tv-1 as corrected by the lead, 2026-11-15): one step smaller where it would overrun its tile
//     (never under 16), then cut with an ellipsis; its small line is one line, cut the same way; the whole of both is
//     in the tile's accessible name and its sheet. Due takes the warm edge, a Light fact in the dark the cool glow and
//     the warning sign (st-5); a tap opens the fact (its rule or its sheet). No row with no facts (before the first
//     session).
//   FactSheet: a player's tap on a fact (plan dec-9-the-players-scene P10; page 18, PL8, approved 2026-11-14, ap-10):
//     the fact's own state as labelled lines, then "The rule" in the book's format with its source, where the
//     player's copy of the setting has words for it; nothing to run.
// Nothing here is the GM's alone: the players' top (S15) uses the same parts with the facts it may read.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { RuleBlock } from '../modules/expedition/placeRules.ts';
import type { Fact, FactLine } from '../modules/expedition/sceneTop.ts';
import type { SetIconName } from '../ui/iconSet.ts';
import { BookFacesScope, Dialog } from '../ui/Dialog.tsx';
import { DiceWords, DieGlyph, dieOf } from '../ui/dice.tsx';
import { Icon, StepIcon } from '../ui/icons.tsx';
import { WarningSign } from '../ui/parts.tsx';
import { RuleText } from '../ui/RuleText.tsx';
import './SceneBand.css';

export interface DateLine {
  /** The season's icon from the set, or none. */
  icon: SetIconName | null;
  /** "14 Reedmonth", or "Day 14". */
  words: string;
  /** The season's word, said after the date (", spring") on a tablet; a phone leaves it to the icon (T8a). */
  season?: string | null;
  /** "2 hours of light left.", or none (no daylight rule). */
  light: string | null;
  /** While the date is unset (st-2): the whole line is the tap, "Day 1. Set the date". */
  onSet?: () => void;
}

/**
 * The top's fold (p2p-20; page 24, TF1 and TF1b, approved 2026-11-18 with the fix: a framed square like the band's
 * other buttons, keeping − and +). The caller hides what folds (the facts, the strip, the encounter tables' row); the
 * band itself never folds. `due`: the facts that still show, one line each, while folded.
 */
export interface TopFold {
  open: boolean;
  onToggle: () => void;
  due: readonly Fact[];
}

export function SceneBand({
  over,
  heading,
  onHeading,
  date,
  under = null,
  actions,
  menu = null,
  fold = null,
}: {
  over: string;
  heading: string;
  /** Opens the procedure (fl-5): the heading is then a button. */
  onHeading?: () => void;
  date: DateLine;
  under?: string | null;
  actions: ReactNode;
  menu?: ReactNode;
  /** The fold mark, between the actions and the menu button (on a phone at the heading's right), or none. */
  fold?: TopFold | null;
}) {
  const due = fold && !fold.open ? fold.due.filter(isDue) : [];
  const line = (
    <>
      <span className="scene-band__date">
        {date.icon && <Icon name={date.icon} size={18} />}
        {date.season ? (
          <>
            {/* The date whole on a tablet; on a phone the icon carries the season (T8a): one of the two shows. */}
            <span className="scene-band__date-whole">{`${date.words}, ${date.season}`}</span>
            <span className="scene-band__date-short">{date.words}</span>
          </>
        ) : (
          date.words
        )}
      </span>
      {date.onSet ? <span className="scene-band__set">. Set the date</span> : date.light && <span className="scene-band__light">{date.light}</span>}
    </>
  );
  return (
    <div className="scene-band">
      <div className="scene-band__words">
        <p className="scene-band__over">{over}</p>
        <h2 className="scene-band__heading">
          {onHeading ? (
            <button type="button" className="scene-band__heading-button" aria-haspopup="dialog" onClick={onHeading}>
              {heading}
            </button>
          ) : (
            heading
          )}
        </h2>
        {date.onSet ? (
          <button type="button" className="scene-band__date-line scene-band__date-line--tap" onClick={date.onSet}>
            {line}
          </button>
        ) : (
          <p className="scene-band__date-line">{line}</p>
        )}
        {/* TF1 C, TF1b C: folded, a due fact still shows, one small line each under the date (and the light). */}
        {due.length > 0 && (
          // Plain text, not a live region: it appears already filled when the GM folds, where a live region would often
          // say nothing (the review of #1048); the fold mark's expanded state is announced.
          <div className="scene-band__due">
            {due.map((f) => (
              <p key={f.id} className="scene-band__due-line">
                {f.warn && <WarningSign size={16} />}
                {dueWords(f)}
              </p>
            ))}
          </div>
        )}
        {under && <p className="scene-band__under">{under}</p>}
      </div>
      <div className="scene-band__actions">
        {actions}
        {!fold && menu}
      </div>
      {/* Q3 (F3 a): with the fold mark, the menu stands after it, the band's last button, in the eye's order and the
          Tab key's. */}
      {fold && (
        <button
          type="button"
          className="button-secondary scene-band__fold"
          aria-expanded={fold.open}
          aria-label={fold.open ? 'Fold the top away' : 'Show the top'}
          title={fold.open ? 'Fold the top away' : 'Show the top'}
          onClick={fold.onToggle}
        >
          <Icon name={fold.open ? 'minus' : 'plus'} size={24} />
        </button>
      )}
      {fold && menu && <div className="scene-band__menu">{menu}</div>}
    </div>
  );
}

/** A fact that needs the GM: due (the warm edge) or a Light fact in the dark (st-5). */
export function isDue(fact: Fact): boolean {
  return fact.state !== 'quiet';
}

/** The values that already name their fact (sceneTop.ts: lightFact, restFact), by the fact's id. */
const NAMES_ITS_FACT: Partial<Record<Fact['id'], readonly string[]>> = { light: ['No light'], rest: ['Rest due', 'Rest day'] };

/**
 * A due fact's one line in the folded band (TF1 C; the words ruled by Francis, 2026-11-19: "Yes, those words"): the
 * value alone where it is one that names its fact ("No light", "Rest due", "Rest day"), else the label first
 * ("Weather: To roll", "Light: Group 2 dark", "Rest: Group 1 due"). Decided by the fact's id and these known values,
 * never by the value's words, so a group named "Lightfoot" still reads "Light: Lightfoot dark".
 */
export function dueWords(fact: Fact): string {
  return NAMES_ITS_FACT[fact.id]?.includes(fact.value) ? fact.value : `${fact.label}: ${fact.value}`;
}

/** Next turn (mc-57): the hourglass and the mode's one unit; one tap, Undo in the toast. In town it reads "Advance time" (ic-5). */
export function NextTurnButton({ label, accent, onTap }: { label: string; accent: boolean; onTap: () => void }) {
  return (
    <button type="button" className={`${accent ? 'button-primary' : 'button-secondary'} scene-band__next`} onClick={onTap}>
      <Icon name="hourglass" size={24} />
      {label}
    </button>
  );
}

/**
 * Depart (S5, ic-5; page 16, T4): the journey icon; opens the Depart sheet. The accent in town, plain in downtime. Its
 * caller shows it only while a session runs (p2p-4; page 24, DP2): with none, or a paused one, Start or Resume alone.
 */
export function DepartButton({ label, accent, onTap }: { label: string; accent: boolean; onTap: () => void }) {
  return (
    <button type="button" className={`${accent ? 'button-primary' : 'button-secondary'} scene-band__next scene-band__depart`} aria-haspopup="dialog" onClick={onTap}>
      <Icon name="journey" size={24} />
      {label}
    </button>
  );
}

/**
 * The band's icon buttons (S2, st-4; page 16, T6b): Make camp, Encounter check, Leave the dungeon. The icon alone, read
 * aloud by its words; 44 px; never the accent. `BandTools` holds them left of Next turn on a tablet and on a row of
 * their own under the date on a phone (T8a). A blocked one stays tappable and says why (the caller's tap).
 */
export function BandTool({ label, icon, onTap }: { label: string; icon: ReactNode; onTap: () => void }) {
  return (
    <button type="button" className="button-secondary scene-band__tool" aria-label={label} title={label} onClick={onTap}>
      {icon}
    </button>
  );
}

/** The row of icon buttons; nothing at all with none to show. */
export function BandTools({ children }: { children: ReactNode }) {
  const shown = (Array.isArray(children) ? children : [children]).some(Boolean);
  if (!shown) return null;
  return (
    <div className="scene-band__tools" role="group" aria-label="Quick actions">
      {children}
    </div>
  );
}

/**
 * Start or Resume, in Next turn's place (st-2): the campfire beside the one word (ic-4; page 16, T3a, T3b, T8c; S17).
 * Read aloud by its whole name, "Start session" or "Resume session", which holds the word it shows.
 */
export function SessionButton({ resume, accent, onTap }: { resume: boolean; accent: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      className={`${accent ? 'button-primary' : 'button-secondary'} scene-band__next`}
      aria-label={resume ? 'Resume session' : 'Start session'}
      onClick={onTap}
    >
      <Icon name="campfire" size={24} />
      {resume ? 'Resume' : 'Start'}
    </button>
  );
}

const FACT_ICON: Record<Fact['id'], string> = { weather: 'weather', light: 'light', rest: 'rest', check: 'encounter', part: 'time' };

/** A fact's whole words, as its tile's accessible name: the tile may cut its value and small line (tv-1), this never does. */
export function factName(fact: Fact): string {
  return [`${fact.label}: ${fact.value}.`, fact.sub, fact.tap].filter(Boolean).join(' ');
}

/**
 * tv-1 (as corrected, 2026-11-15): whether the value overruns its one line at the tile's large size; where it does, the
 * value's words take `data-fit="smaller"` (one step down the type scale, set in SceneBand.css; never under 16). Past
 * that the line is cut with an ellipsis by the style alone. Measured again whenever the tile's size or the fonts change.
 */
function useOneLineFit(value: string) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const fit = () => {
      if (!live) return;
      delete el.dataset.fit;
      if (el.scrollWidth > el.clientWidth + 1) el.dataset.fit = 'smaller';
    };
    fit();
    const tile = el.closest('.scene-fact') ?? el;
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    watch?.observe(tile);
    void document.fonts?.ready.then(fit);
    return () => {
      live = false;
      watch?.disconnect();
    };
  }, [value]);
  return ref;
}

/** One fact: its icon, label, value and small line, each kept to one line (tv-1); the whole tile is the tap that opens it. */
function FactTile({ fact, onOpen }: { fact: Fact; onOpen: () => void }) {
  const die = fact.die ? dieOf(fact.die) : null;
  const valueRef = useOneLineFit(fact.value);
  return (
    <button
      type="button"
      className={`scene-fact scene-fact--${fact.state} scene-fact--${fact.id}`}
      // The whole value and small line, always (tv-1), and what the tap does where it opens something other than the
      // fact's own rule (the part of the day: Advance by…).
      aria-label={factName(fact)}
      onClick={onOpen}
    >
      <span className="scene-fact__icon">
        <StepIcon name={FACT_ICON[fact.id]} size={24} />
      </span>
      <span className="scene-fact__label label">{fact.label}</span>
      <span className="scene-fact__value">
        {fact.warn && (
          <span className="scene-fact__warn">
            <WarningSign size={20} />
          </span>
        )}
        <span ref={valueRef} className="scene-fact__value-text">
          {fact.value}
        </span>
      </span>
      {fact.sub && (
        <span className="scene-fact__sub">
          {die && <DieGlyph die={die} size={16} />}
          <span className="scene-fact__sub-text">{fact.sub}</span>
        </span>
      )}
    </button>
  );
}

/** The facts row (S4): nothing at all with no facts. */
export function FactsRow({ facts, onOpen, centred = false }: { facts: readonly Fact[]; onOpen: (id: Fact['id']) => void; centred?: boolean }) {
  if (facts.length === 0) return null;
  return (
    <div className={`scene-facts${centred ? ' scene-facts--centred' : ''}`} role="group" aria-label="Scene facts">
      {facts.map((f) => (
        <FactTile key={f.id} fact={f} onOpen={() => onOpen(f.id)} />
      ))}
    </div>
  );
}

/**
 * A player's tap on a fact (PL8): the app's centred pop-up in the book's faces, the fact's state as labelled lines (the
 * book's labelled line, as the Weather sheet's), then "The rule" in the book's format with its source. No rule where the
 * player's copy of the setting has no words for it (or keeps them for the GM): the state alone.
 */
export function FactSheet({
  title,
  lines,
  rule,
  onClose,
  foot = null,
  step = null,
}: {
  title: string;
  lines: readonly FactLine[];
  rule: readonly RuleBlock[];
  onClose: () => void;
  /** The pop-up's one act at its foot (Light's "Light", PL8). */
  foot?: ReactNode;
  /**
   * A step inside the same card (Light's "Which light?", the audit of #86): its title and body in place of the fact's,
   * with Back ‹ in the head; Back and Escape go back to the fact, the one ✕ closes the whole pop-up.
   */
  step?: { title: string; body: ReactNode; onBack: () => void } | null;
}) {
  if (step)
    return (
      <BookFacesScope.Provider value>
        <Dialog label={step.title} onClose={onClose} onBack={step.onBack} onEscape={step.onBack}>
          {step.body}
        </Dialog>
      </BookFacesScope.Provider>
    );
  return (
    <BookFacesScope.Provider value>
      <Dialog label={title} onClose={onClose}>
        <div className="fact-sheet">
          {lines.map((line, i) => (
            <p key={i} className="book-line">
              <span className="book-label">{line.label}</span>
              {line.words && <DiceWords>{line.words}</DiceWords>}
            </p>
          ))}
          {rule.length > 0 && (
            <>
              <h3 className="book-subhead">The rule</h3>
              <RuleText blocks={rule} />
            </>
          )}
        </div>
        {foot}
      </Dialog>
    </BookFacesScope.Provider>
  );
}
