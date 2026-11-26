// The creation step shell and its parts (docs/06 Components: Creation step shell, Option row pick variant, Score
// tiles, Adjust tiles, Scores strip, Fit line; design/rulings/m5b-0c-creation-rebuild-2026-11-01.md cr-1, cr-2, cr-5,
// cr-9, cr-10, cr-11; mockups creation/00–03). Every creation step is built from these and never rebuilds one.
//   CreationStep: in character creation (cw-11, mockup creation/12) Leave (a worded button) · "Step N of M" over the
//     title; elsewhere (New campaign) ‹ Back · the title · the counter, as before. Then the why-line with Help me
//     choose · an optional scores strip · the content · a foot in the page's flow with Decide later (absent when
//     required) · the hint · Back · Next (the one accent, always tappable: the step's validator says what's wrong).
//   PickRow: the row's text opens the entry (name · blurb · fit line · source and page); PickButton at its end reads
//     Pick, then Picked ✓ (ct-1); its pick-twice variant (`pickedLabel`, ct-8) reads Specialised ✓✓ on a second Pick.
//     PickTick, the older ✓ slot, is campaign set-up's Pack row lead only.
//   EntryPanel: the entry's full rules under small-caps headings, bullet lines and chips (ct-2), a book's spells one row
//     each (ct-7), with Pick <name> / Picked ✓ at its foot; a sheet on a phone, a panel beside the list on a wide
//     screen (the step lays it out).
//   ScoreTile / AdjustTile: an ability's tile (Adjust: only the rule's button, ct-3); TradeChips: the trades, each ✕
//     undoing that one; ScoresStrip: the scores under the title from the race step on.
//   StartOverCallout: the setting's start-over rule, offered, never forced. FoldedGroup: "Not open to … · N" with a
//     plus or minus square at its end (cw-11). CreationLeave: the Leave a creation host hands its steps.
//   DerivedFields: the layout's `fill` fields, read-only, in a FoldedGroup (cr-12). StepField: a labelled input.
//   PickGroup: a heading with its count over pick rows (First spells, Gear, Languages, Weapon skills). OtherRow: Other…, a
//   typed entry the list doesn't have, with an optional note (cr-15, cr-17). ReviewSections: the review's read-only
//   cards, each with a small Change button back to its step (cr-18, cw-11).
import { createContext, Fragment, useCallback, useContext, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { BookPopUpScope, BookTypeScope, Dialog, SheetScope } from './Dialog.tsx';
import { DiceWords, DieGlyph, dieOf, RollRow } from './dice.tsx';
import { Icon } from './icons.tsx';
import { MenuItem } from './MoreMenu.tsx';
import { ButtonRow, CloseButton, GuidedInstruction, HelpMeChoose, OptionRow, SkeletonRows, StackedButton, StatTile, StepCounter, TapValue, TypedStepper, WarningLine } from './parts.tsx';
import type { SetIconName } from './iconSet.ts';
import { useToast } from './ToastHost.tsx';
import { nameFromWords } from '../modules/library/namesakes.ts';
import type { RuleTextBlocks } from '../modules/library/ruleText.ts';
import { RuleText } from './RuleText.tsx';
import './creation.css';

export interface FitPart {
  text: string;
  strong?: boolean;
  /** A warning (plan final drafts A4): the warning sign and the words, bold in the warning colour, on a line of its own. */
  warn?: boolean;
}

/**
 * Leave (cw-11): character creation's host hands its steps the way out of creation, and every step's shell shows a
 * worded **Leave** at its top instead of ‹ (Back is in the foot). Without it (New campaign's steps) the shell keeps
 * its ‹ Back: the "‹ ›" removal outside creation waits for its own mockup (the plan's scope checks).
 */
const LeaveContext = createContext<(() => void) | null>(null);
/**
 * The top button's word (follow-up E, nit 4, cw-13): "Leave" until the draft exists, then "Save and leave" (the
 * review's own Save and leave goes: one exit button). The host's steps set it with `useLeaveWord`.
 */
const LeaveWordContext = createContext<{ word: string; claim: (on: boolean) => () => void }>({ word: 'Leave', claim: () => () => {} });

/**
 * The app's own ⋯ items (final draft 9, 2026-11-07): the host hands them in (`ShellMenuItems`), and creation's ⋯ sheet
 * shows them first. `away` marks a leave that goes somewhere else (an item of that menu): the picks are kept through
 * the same path as Save and leave, then the item goes where it goes instead of the host's Leave.
 */
const MenuContext = createContext<{ items: ReactNode; leaveElsewhere: (leave: () => void) => void }>({ items: null, leaveElsewhere: () => {} });

/**
 * The foot's Back word (P22, 2026-11-06): "Back to review" on a step opened from the review, else "Back". The host's
 * steps set it with `useBackWord`; null is the plain "Back".
 */
const BackWordContext = createContext<{ word: string | null; setWord: (word: string | null) => void }>({ word: null, setWord: () => {} });

/**
 * The book's type (dec-10 S2; cs-1, ts-1 to ts-3): what it holds, and the pop-ups opened from it, are drawn in the
 * book's faces (`.book-type`, creation.css). Creation's host (`CreationLeave`) uses it; so do the gallery's creation
 * specimens drawn without the host. It adds no box of its own. With `popUps` (the Player tab; tfb-1, row C8) every
 * pop-up opened from it is one of the book's pop-ups too (`BookPopUpScope`): the red heading over its own buttons.
 */
export function BookType({ children, popUps = false }: { children: ReactNode; popUps?: boolean }) {
  const host = (
    <BookTypeScope.Provider value>
      <div className="book-type book-type--host">{children}</div>
    </BookTypeScope.Provider>
  );
  return popUps ? <BookPopUpScope.Provider value>{host}</BookPopUpScope.Provider> : host;
}

export function CreationLeave({ onLeave, menu = null, children }: { onLeave: () => void; menu?: ReactNode; children: ReactNode }) {
  // "Save and leave" while any step claims something is kept (a draft, or picks on this device); else "Leave". One
  // item, never both (final draft 9).
  const [claims, setClaims] = useState(0);
  const [backWord, setBackWord] = useState<string | null>(null);
  const away = useRef(false);
  const claim = useCallback((on: boolean) => {
    if (!on) return () => {};
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);
  /** Runs a step's leave (it keeps the picks) with the host's navigation skipped: the menu item goes elsewhere. */
  const leaveElsewhere = useCallback((stepLeave: () => void) => {
    away.current = true;
    try {
      stepLeave();
    } finally {
      away.current = false;
    }
  }, []);
  // The host's Leave, skipped when the leave goes elsewhere (an item of the app's menu, which navigates itself).
  const leave = () => {
    if (away.current) {
      away.current = false;
      return;
    }
    onLeave();
  };
  return (
    <LeaveContext.Provider value={leave}>
      <MenuContext.Provider value={{ items: menu, leaveElsewhere }}>
      <LeaveWordContext.Provider value={{ word: claims > 0 ? 'Save and leave' : 'Leave', claim }}>
        <BackWordContext.Provider value={{ word: backWord, setWord: setBackWord }}>
          {/* Every pop-up in creation is a Sheet (final drafts A7), and creation is drawn in the book's type (dec-10 S2). */}
          <SheetScope.Provider value>
            <BookType>{children}</BookType>
          </SheetScope.Provider>
        </BackWordContext.Provider>
      </LeaveWordContext.Provider>
      </MenuContext.Provider>
    </LeaveContext.Provider>
  );
}

/**
 * Claims "Save and leave" while the caller is on screen and has something kept (the draft exists, or guided creation
 * kept a pick on this device); with no claim the word is "Leave".
 */
export function useLeaveWord(word: string) {
  const { claim } = useContext(LeaveWordContext);
  useEffect(() => claim(word === 'Save and leave'), [word, claim]);
}

/** Sets the foot's Back word while the caller is on screen ("Back to review", P22); back to plain "Back" when it goes. */
export function useBackWord(word: string | null) {
  const { setWord } = useContext(BackWordContext);
  useEffect(() => {
    setWord(word);
    return () => setWord(null);
  }, [word, setWord]);
}

/** The host's Leave, for a step that does something first (guided creation keeps its picks, cw-13). */
export function useCreationLeave(): (() => void) | null {
  return useContext(LeaveContext);
}

/** The shell. The foot's Next is always tappable; `onNext` runs the step's check and says what's wrong. */
export function CreationStep({
  title,
  counter,
  why,
  help,
  helpChoices,
  helpExtra,
  onBack,
  strip,
  panel,
  children,
  decideLater,
  footExtra,
  hint,
  nextLabel = 'Next',
  onNext,
  busy,
  wide,
  backOnFirst = false,
  backInFoot = false,
  onLeave,
  stop = false,
  nextAccent = true,
  footQuiet,
  unchanged = false,
  waitsOnline = false,
  roll,
}: {
  title: string;
  /** "Step N of M"; left out where the step opens on its own (the review's Gear, m5b-0c slice 5; the To finish card). */
  /** `of` null: no total yet ("Step 2"; ruled B 2026-11-05: none before the class is picked). */
  counter?: { at: number; of: number | null; note?: string };
  /** The step's one line; Adjust scores' lead names the prime in bold (final draft 1). */
  why: ReactNode;
  /** The step's Roll row (final drafts A2), between the line and Help me choose (final draft 1). */
  roll?: ReactNode;
  /** The pack's help, else the app's own (cr-6); null hides the link (only when there are no choices either). */
  help: string | null;
  helpChoices?: { name: string; blurb: string }[];
  /** Inside Help me choose, after its words (R3-7: the prime experience table). */
  helpExtra?: ReactNode;
  onBack: () => void;
  /** The scores strip (cr-10), from the race step on. */
  strip?: ReactNode;
  /** An entry's full rules beside the list on a wide screen (an EntryPanel). */
  panel?: ReactNode;
  children: ReactNode;
  /** Decide later (quiet); absent when the step is required or the choice decides the steps. */
  decideLater?: { label?: string; onPick: () => void };
  /** Quiet actions in the foot before the hint (set-up: Import a file…, Reset to the books' defaults; lr-5, lr-6). */
  footExtra?: ReactNode;
  /** What's picked, or what Next needs: "Bog folk picked", "CHA is missing". */
  hint: ReactNode;
  /**
   * The hint says what stops Next (proposal mockup creation/13, the footer's unmet line): "▲" before it, in the warning
   * colour and bold, so it reads by shape and words, never colour alone. Next stays tappable.
   */
  stop?: boolean;
  nextLabel?: string;
  onNext: () => void;
  busy?: boolean;
  /** The Scores step: wide enough for three roomy score tiles on an iPad's landscape row (3 + 3, ct3-2). */
  wide?: boolean;
  /** Back in the foot on the first step too: a step opened from the review (its Back returns there). */
  backOnFirst?: boolean;
  /**
   * Back in the foot outside creation too, beside Next: a step opened in a pop-up of its own (the Expertise pop-up from
   * To finish and the GM's Move points; mockup december/29 X5, G-208 flag 2, Francis 2026-11-20). It is the bar's ‹:
   * onBack closes without saving.
   */
  backInFoot?: boolean;
  /** Leave with something done first (guided creation keeps its picks on the device, cw-13); only inside creation. */
  onLeave?: () => void;
  /**
   * The accent follows the ask (final drafts A8): false while the step's one ask is a Pick not yet made (the default
   * Pick carries the accent then); Next is plain until it moves the player on.
   */
  nextAccent?: boolean;
  /**
   * The review's foot (final drafts D, mockup creation/final/07): quiet buttons under Next (Save and leave, Start
   * over). The foot stacks on a phone (Next full width, these side by side) and the foot's Back is left to the bar's ←.
   */
  footQuiet?: ReactNode;
  /** A step opened from the review with nothing changed (P22): Next reads Back to review too. */
  unchanged?: boolean;
  /**
   * The step's Next saves to the campaign (final drafts F, mockup creation/final/08): offline, a line at the top with
   * the sign says so, and Next is plain and repeats it when tapped (never disabled). Steps kept on the device leave it out.
   */
  waitsOnline?: boolean;
}) {
  const id = useId();
  const hostLeave = useContext(LeaveContext);
  const leave = hostLeave ? (onLeave ?? hostLeave) : null;
  const leaveWord = useContext(LeaveWordContext).word;
  const shell = useContext(MenuContext);
  const [menuOpen, setMenuOpen] = useState(false);
  /**
   * A tap inside creation's ⋯ sheet (final draft 9): a setting that stays on screen (theme, text size: pressed
   * buttons) leaves it open; any other item leaves creation, so the picks are kept first through Save and leave's own
   * path (the step's leave), then the item goes where it goes.
   */
  const onMenuTap = (event: MouseEvent<HTMLDivElement>) => {
    const tapped = (event.target as HTMLElement).closest('button');
    if (!tapped || tapped.hasAttribute('aria-pressed') || tapped.hasAttribute('data-close') || tapped.closest('.creation-menu__leave')) return;
    if (leave) shell.leaveElsewhere(leave);
    setMenuOpen(false);
  };
  // "Back to review" on a step opened from the review (P22); else "Back", read as "Back to the step before".
  const backWord = useContext(BackWordContext).word;
  // The foot's Back: on every step after the first; in creation also on a step with no counter (opened on its own from
  // the review or the sheet) and where asked, since the top row has no ‹ any more (cw-11).
  const footBack = !footQuiet && (backInFoot || (counter ? counter.at > 1 : !!leave) || (!!leave && backOnFirst));
  // A step opened from the review says so where the counter would be (final drafts D, P22).
  const fromReview = !counter && backWord === 'Back to review';
  const count = counter ? (
    <StepCounter>
      {counter.of === null ? `Step ${Math.max(counter.at, 1)}` : `Step ${Math.min(Math.max(counter.at, 1), counter.of)} of ${counter.of}`}
      {counter.note ? `, ${counter.note}` : ''}
    </StepCounter>
  ) : fromReview ? (
    <StepCounter>From the review</StepCounter>
  ) : null;
  const nextWords = fromReview && unchanged ? 'Back to review' : nextLabel;
  // Opened from the review and nothing changed (22-G4, a fix): one "Back to review", not two; it is Next's (the step
  // finishes as it always did, then the review), and the bar's arrow is still the way back without it. The foot says
  // "Nothing changed".
  const oneWayBack = fromReview && unchanged;
  const online = useOnline();
  const offline = waitsOnline && !online;
  const toast = useToast();
  // Each step opens at its top (the second test, 2026-11-02): a long step scrolled down must not leave the next one
  // opening half-way. Runs when the step appears and whenever the shell is reused for another step.
  const at = counter?.at;
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [title, at]);
  // The foot's line: what is left, or why Next waits.
  const footHint = (
    <p className={`creation-step__hint${(stop || offline) && !busy ? ' creation-step__hint--stop' : ''}`} role="status" aria-label="Step status">
      {busy ? 'Saving…' : offline ? <WarningLine>Offline. Next waits for the connection</WarningLine> : stop ? <WarningLine>{hint}</WarningLine> : oneWayBack ? 'Nothing changed' : hint}
    </p>
  );

  return (
    // data-creation marks character creation on screen (after-test A12): the app holds a new version until it's closed.
    <section className={`creation-step${panel ? ' creation-step--split' : wide ? ' creation-step--wide' : ''}`} aria-labelledby={`${id}-title`} data-creation={leave ? 'open' : undefined}>
      {leave ? (
        // Creation's app bar (final drafts A1): ← Back at the left (on the first step it leaves, as the foot's Leave
        // does), the title centred, ⋯ at the right holding Leave; the counter under the bar. No ‹ or ›.
        <>
          <header className="creation-step__bar creation-step__bar--app">
            <button type="button" className="creation-step__icon" aria-label="Back" onClick={footBack || footQuiet ? onBack : leave}>
              <Icon name="back" />
            </button>
            <h1 id={`${id}-title`} className="creation-step__title creation-step__title--centred">
              {title}
            </h1>
            {/* ⋯ opens a Sheet (final draft 9, pattern 13): the app's menu, a divider, then Leave or Save and leave. */}
            <button type="button" className="creation-step__icon" aria-label="More" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <span aria-hidden="true" className="creation-step__more">
                ⋯
              </span>
            </button>
          </header>
          {count}
          {menuOpen && (
            <Dialog label="More" onClose={() => setMenuOpen(false)}>
              <div className="creation-menu" onClickCapture={onMenuTap}>
                {shell.items}
                <div className="more-menu__section more-menu__section--items creation-menu__leave">
                  <MenuItem
                    icon="sign-out"
                    sub={leaveWord === 'Save and leave' ? 'Your picks are kept on this device' : undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      leave();
                    }}
                  >
                    {leaveWord}
                  </MenuItem>
                </div>
              </div>
            </Dialog>
          )}
        </>
      ) : (
        <header className="creation-step__bar">
          <button type="button" className="button-quiet creation-step__back" aria-label="Back" onClick={onBack}>
            <span aria-hidden="true">‹</span>
          </button>
          <h1 id={`${id}-title`} className="creation-step__title">
            {title}
          </h1>
          {count}
        </header>
      )}
      {offline && (
        // Offline (final drafts F): the first thing on the screen, the sign and what it means; the screen stays usable.
        <div className="creation-offline" role="status">
          <WarningLine>You're offline</WarningLine>
          <span className="creation-offline__line">{OFFLINE_LINE}</span>
        </div>
      )}
      {strip}
      <div className="creation-step__why">
        {/* No empty line (a trait list without notes has only its Roll row; Design on #570). */}
        {why ? <GuidedInstruction>{why}</GuidedInstruction> : null}
        {roll}
        <HelpMeChoose help={help} choices={helpChoices} extra={helpExtra} />
      </div>
      <div className="creation-step__main">
        <div className="creation-step__content">{children}</div>
        {panel && <div className="creation-step__side">{panel}</div>}
      </div>
      {/* The foot (ex-4, ex-9; G-208, Francis 2026-11-20): what is left on its own line, then Decide later, Back and
          Next on one line, never staggered. The review's stacked foot keeps its own (cs-36). A foot with an extra
          button (the New campaign steps) keeps the older order: the extra, the hint, then Back and Next (ex-9 rules on
          creation steps only; #1093 review, 3). */}
      <div className={`creation-step__foot${footQuiet ? ' creation-step__foot--stacked' : ''}${footExtra ? ' creation-step__foot--extra' : ''}`}>
        {!footExtra && footHint}
        {decideLater && (
          <button type="button" className="button-secondary button-secondary--small creation-step__later" onClick={decideLater.onPick}>
            {decideLater.label ?? 'Decide later'}
          </button>
        )}
        {footExtra}
        {footExtra && footHint}
        {/* Back beside Next on every step after the first (ct3-5); one height for the pair. */}
        <div className="creation-step__actions">
          {footBack && !oneWayBack && (
            <button type="button" className="button-secondary creation-step__foot-back" aria-label={backWord ?? (backInFoot && !leave ? 'Back' : 'Back to the step before')} onClick={onBack}>
              {backWord ?? 'Back'}
            </button>
          )}
          {/* The review's quiet pair before its accent (cs-36): Start over and Save and leave, then Send outermost. */}
          {footQuiet && <div className="creation-step__quiet">{footQuiet}</div>}
          {/* The first step's Back reads Leave and does what Leave does (final drafts A1, cw-13). */}
          {!footBack && !footQuiet && leave && (
            <button type="button" className="button-secondary creation-step__foot-back creation-step__foot-leave" onClick={leave}>
              {leaveWord}
            </button>
          )}
          <button type="button" className={`${nextAccent && !offline && !oneWayBack ? 'button-primary' : 'button-secondary'} creation-step__next`} onClick={offline ? () => toast({ text: OFFLINE_LINE }) : onNext}>
            {nextWords}
          </button>
        </div>
      </div>
    </section>
  );
}

/** What being offline means on a step that saves (final drafts F, mockup creation/final/08). */
export const OFFLINE_LINE = "Nothing is saved until you're back: keep this screen open, then try again.";

/** Whether the device is online, following the browser's online and offline events (final drafts F). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** How long a load may take before its skeleton shows (final drafts F): a quick load never flashes one. */
export const LOADING_DELAY_MS = 300;

/**
 * Loading a step (final drafts F, mockup creation/final/08): a line saying what's loading, then skeleton rows in the
 * list's shape (hidden from a screen reader, which hears the line). Both wait `delay` ms (300 by default; the creation
 * follow-up): until then the space stays empty and busy, so a quick load shows nothing at all.
 */
export function CreationLoading({ line, delay = LOADING_DELAY_MS }: { line: string; delay?: number }) {
  const [shown, setShown] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  if (!shown) return <section className="creation-step creation-loading" aria-busy="true" />;
  // In the book's type, as the steps are (cs-48).
  return (
    <BookType>
      <section className="creation-step creation-loading" aria-busy="true">
        <p className="creation-loading__line" role="status">
          {line}
        </p>
        <div aria-hidden="true">
          <SkeletonRows rows={4} label={line} />
        </div>
      </section>
    </BookType>
  );
}

/** The line under an untouched average stepper (final drafts A5, mockup creation/final/01). */
/** Under an untouched stepper (ruled 2026-11-12, A3): the one word, the figure muted until the player enters their own. */
export const AVERAGE_LINE = 'Average';

/**
 * An average stepper's state (final drafts A5): the text in the box, and whether the player has **touched** it. It
 * starts at the average (a value the dice can make) and untouched; any step or typing touches it for good, even back
 * to the average (a flag, never a comparison of values). `step` is the dice's multiplier (10 for "3d6 x 10").
 */
export function useAverageField({ average, step = 1, text: startText, touched: startTouched = false }: { average: number; step?: number; text?: string; touched?: boolean }) {
  const [text, setText] = useState(startText ?? String(average));
  const [touched, setTouched] = useState(startTouched);
  const value = /^\s*-?\d+\s*$/.test(text) ? Number.parseInt(text, 10) : null;
  return {
    text,
    touched,
    value,
    onChange: (next: string) => {
      setTouched(true);
      setText(next);
    },
    onStep: (by: 1 | -1) => {
      setTouched(true);
      setText(String((value ?? average) + by * step));
    },
  };
}

/**
 * The average stepper (final drafts A5): a typed stepper prefilled with the average; untouched, the number in the
 * lighter weight with the line "Average"; touched, full weight and the field's own
 * caption. The caller keeps the state (`useAverageField`) and the record's touched flag, which the review and the GM's
 * card read ("the average, not rolled").
 */
export function AverageStepper({
  id,
  label,
  text,
  touched,
  caption,
  onChange,
  onStep,
  wide = false,
  untouchedLine = AVERAGE_LINE,
}: {
  id: string;
  label: string;
  text: string;
  touched: boolean;
  /** The line while untouched: the average line, with what it gives after it when the field has a sum (hit points). */
  untouchedLine?: ReactNode;
  /** The field's caption once touched ("+1 to hit and damage up close"); '' for none. */
  caption: ReactNode;
  onChange: (text: string) => void;
  onStep: (by: 1 | -1) => void;
  wide?: boolean;
}) {
  return (
    <span className="average-stepper">
      <TypedStepper id={id} label={label} value={text} onChange={onChange} onStep={onStep} describedBy={`${id}-line`} wide={wide} average={!touched} />
      <span id={`${id}-line`} className="average-stepper__line">
        {touched ? caption : untouchedLine}
      </span>
    </span>
  );
}

/** The fit line's words, the unmet number set apart in bold (never colour alone). */
export function FitLine({ parts }: { parts: FitPart[] }) {
  if (parts.length === 0) return null;
  return (
    <span className="pick-row__fit">
      {parts.map((p, n) =>
        p.warn ? (
          <span key={n} className="pick-row__warn">
            <WarningLine>{p.text}</WarningLine>
          </span>
        ) : p.strong ? (
          <strong key={n}>{p.text}</strong>
        ) : (
          // A die the line names carries its glyph (ds-3; cs-5: "Might 15, d8, +5% experience").
          <DiceWords key={n}>{p.text}</DiceWords>
        ),
      )}
    </span>
  );
}

/**
 * The ✓ slot (cr-5): a 44 px checkbox that picks in one tap. Kept for campaign set-up's Pack row `lead` (lr-5);
 * creation's pick rows use PickButton since the second test (ct-1).
 */
export function PickTick({ name, picked, onPick }: { name: string; picked: boolean; onPick: () => void }) {
  return (
    <button type="button" className={`pick-row__tick${picked ? ' pick-row__tick--on' : ''}`} role="checkbox" aria-checked={picked} aria-label={`Pick ${name}`} onClick={onPick}>
      <span aria-hidden="true">{picked ? '✓' : ''}</span>
    </button>
  );
}

/**
 * The pick on a row (ct-1, ruled 2026-11-02): a 44 px button reading Pick, then Picked ✓ with the pressed look (ink
 * fill). With the row's tinted band and ink edge that makes three cues, never colour alone. A screen reader hears
 * "Pick <name>" and its state as a checkbox's; with `pickedSpoken` (the twice-picked mark, 2026-11-13) it hears
 * "Pick <name>, picked twice" once picked.
 */
export function PickButton({
  name,
  picked,
  pickedLabel,
  pickedSpoken,
  onPick,
  again = false,
}: {
  name: string;
  picked: boolean;
  pickedLabel?: string;
  /** Said after the name once picked, for a mark a screen reader can't read ("picked twice" for ✓✓). */
  pickedSpoken?: string;
  onPick: () => void;
  again?: boolean;
}) {
  return (
    // Never the accent (R3-9, 2026-11-08: plain Pick on every row, Next the screen's one accent). A row that can be
    // picked again (R3-8) says so to a screen reader once picked: "Pick another <name>".
    <button type="button" className="button-secondary pick-row__pick" role="checkbox" aria-checked={picked} aria-label={`Pick ${again && picked ? 'another ' : ''}${name}${picked && pickedSpoken ? `, ${pickedSpoken}` : ''}`} onClick={onPick}>
      {picked ? (pickedLabel ?? 'Picked ✓') : 'Pick'}
    </button>
  );
}

/** A name longer than this lets the Pick button wrap under it (after-test A6); a shorter one keeps it beside the name. */
export const LONG_PICK_NAME = 32;

/** Option row, pick variant (ct-1): the row's text opens the entry; the Pick button at the end picks. */
export function PickRow({
  name,
  blurb,
  fit,
  source,
  from,
  picked,
  pickedLabel,
  pickedSpoken,
  onPick,
  onOpen,
  closed,
  given = false,
  times = 0,
  onPutBack,
  price,
  plain = false,
}: {
  name: string;
  blurb?: string;
  /** A kit's price, at the right of the blurb's first line (cs-22, picture creation/final 21-F1): "20 silver", "Free". */
  price?: string;
  /**
   * The **count** variant (R3-8, a pick-up-to-N table): how many times the row is picked. Past one the button reads
   * "Picked ×2" (×3…) and Pick adds one more; with `onPutBack`, a − square beside it puts one back.
   */
  times?: number;
  /** The count variant's − square: puts one back. */
  onPutBack?: () => void;
  fit?: FitPart[];
  /** "Fen rules · p. 12". */
  source?: string;
  /**
   * The pack's short name as the row's quiet last line, after the description ("From Fen rules"), only when another pack has an entry of the
   * same kind and name (sn-1, plan dec-1-creation 1d as the lead corrected it; `namesakeSource`). Left out: as ever.
   */
  from?: string | null;
  picked: boolean;
  /** The picked button's words when not "Picked ✓": the pick-twice variant's "Specialised ✓✓" (ct-8). */
  pickedLabel?: string;
  /** Said after the name once picked (`PickButton`): the twice-picked mark's "picked twice" (pf-16, 2026-11-13). */
  pickedSpoken?: string;
  /** The Pick button: picks, or unpicks when picked. */
  onPick: () => void;
  /** The row's text: opens the entry's full rules (the same button at its foot). Left out (an alignment, with no entry), the text picks too. */
  onOpen?: () => void;
  /** Not allowed (cw-8): full contrast, no Pick button; the row's text taps through to `onOpen ?? onPick`, which explains. */
  closed?: boolean;
  /**
   * Given (final drafts D, mockup creation/final/04): what the kindred or class gives, marked by the Selected wash and
   * the word **Given** where the Pick would be; no button. The text still opens the entry (or says where it comes from).
   */
  given?: boolean;
  /**
   * The **plain** variant (C3; page M2, frame M2o, approved 2026-11-19; Francis on #1069's ⚑ 2, 2026-11-19: "go with
   * approved"): no box, a dotted rule under each row, the name with its line under it and the button at the right,
   * beside even a long name. Picked, only the button is washed ("Picked ✓"); the row has no wash and no edge. Only the
   * mode sheet whose modes draw from a stack (a Quiver, a Pouch) uses it; a Grip and a Stance keep the boxed rows.
   */
  plain?: boolean;
}) {
  // A same-named entry's source names it to a screen reader's Pick (sn-1): "Pick Lantern Warden (from Fen rules)".
  const fullName = `${name}${nameFromWords(from)}`;
  // Inside creation (dec-10 A; cs-3, cs-5) the row's short lines run under it at its full width, outside the name's
  // button but said with it, and a tap on them opens the entry as the name does; elsewhere they stay in the button.
  const creation = useContext(BookTypeScope);
  const linesId = useId();
  const lines = (
    <>
      {(blurb || price) && (
        <span className="pick-row__blurb">
          {price && <span className="pick-row__price">{price}</span>}
          {blurb}
        </span>
      )}
      {fit && fit.length > 0 && <FitLine parts={fit} />}
      {source && <span className="pick-row__source">{source}</span>}
      {/* The row's last line, in the smallest size (Francis, from the picture, 2026-11-12). */}
      {from && <span className="pick-row__from">From {from}</span>}
    </>
  );
  const hasLines = !!(blurb || price || (fit && fit.length > 0) || source || from);
  const open = onOpen ?? onPick;
  // The name's button and the Pick: Pick sits beside the name (after-test A6); a row with the takes mark (`pickedSpoken`,
  // ✓✓✓…) lets it drop under the name, at the right, only once its ticks no longer leave the name room (pick-row--takes;
  // pf-16, as #671 approved). Outside creation a long name also lets it wrap under.
  const head = (
    <>
      {/* Without an entry the text is a second target for the same pick: hidden from a screen reader (the button names it). */}
      <button
        type="button"
        className="pick-row__body"
        onClick={open}
        {...(onOpen ? {} : { tabIndex: -1, 'aria-hidden': true })}
        {...(creation && hasLines && onOpen ? { 'aria-describedby': linesId } : {})}
      >
        <span className="pick-row__name">
          {/* ⓘ marks a name that opens its entry (cw-11); a row with no entry has none. */}
          {onOpen && <Icon name="info" size={20} />}
          {name}
        </span>
        {!creation && lines}
      </button>
      {given ? (
        <span className="pick-row__given">Given</span>
      ) : (
        !closed && (
          <span className="pick-row__picks">
            {picked && onPutBack && (
              <button type="button" className="button-secondary pick-row__less" aria-label={`Put back one ${fullName}`} onClick={onPutBack}>
                <Icon name="minus" size={20} />
              </button>
            )}
            <PickButton name={fullName} picked={picked} pickedLabel={times > 1 ? `Picked ×${times}` : pickedLabel} pickedSpoken={pickedSpoken} onPick={onPick} again={!!onPutBack} />
          </span>
        )
      )}
    </>
  );
  return (
    <div className={`pick-row${creation ? ' pick-row--lines' : ''}${picked || given ? ' pick-row--picked' : ''}${closed ? ' pick-row--closed' : ''}${given ? ' pick-row--given' : ''}${name.length > LONG_PICK_NAME ? ' pick-row--long' : ''}${picked && pickedSpoken ? ' pick-row--takes' : ''}${plain ? ' pick-row--plain' : ''}`}>
      {creation ? (
        <>
          {/* Inside creation (dec-10 A; cs-3, cs-5): the name and Pick on a line of their own, the short lines under it. */}
          <div className="pick-row__top">{head}</div>
          {hasLines && (
            // The lines under the row (cs-5); a tap on them is the name's tap (cs-3). The name's button is the keyboard's way.
            <span className="pick-row__lines" id={linesId} onClick={open}>
              {lines}
            </span>
          )}
        </>
      ) : (
        head
      )}
    </div>
  );
}

/** One heading of an entry (ct-2): its words, bullet lines "name — effect", or chips that open another entry. */
export interface EntrySection {
  label: string;
  text?: string;
  /** The text is a warning (A4): drawn with the warning sign, bold in the warning colour. */
  warn?: boolean;
  bullets?: { name: string; effect: string }[];
  /**
   * In the book format, the bullets are a ladder of labelled lines under this one (a patron's garb and marks, a tier a
   * line; C3) rather than a list under a sub-heading.
   */
  lines?: boolean;
  chips?: { id: string; name: string }[];
}

/** An entry's lead: its one line in words, or a trait's note in pf-18's blocks (tfb-5). */
export type EntryLead = string | RuleTextBlocks;

/** A list item's lead-in in the book's style (A2): bold, closed by a full stop unless it already ends in punctuation. */
function leadIn(name: string): string {
  return /[.!?…:;)"”’]$/.test(name.trim()) ? name.trim() : `${name.trim()}.`;
}

/**
 * The entry's body in the book format (dec-10 S3; cs-4, pictures creation/final 16-A2, 18-C3, 20-E2, 21-F6): the
 * small-capitals line, the paragraphs, the labelled lines (a label in the book's label colour, the value on its line;
 * gathered before the lists, ruled with A2), then each list under its sub-heading with bold lead-ins, chips under theirs.
 */
function BookBody({ tagline, lead, description, headings, onChip }: { tagline?: string; lead?: EntryLead; description?: readonly string[]; headings: readonly EntrySection[]; onChip?: (id: string) => void }) {
  const isList = (h: EntrySection) => !h.lines && ((h.bullets?.length ?? 0) > 0 || (h.chips?.length ?? 0) > 0);
  const warns = headings.filter((h) => h.warn && h.text);
  const lines = headings.filter((h) => !(h.warn && h.text) && !isList(h));
  const lists = headings.filter((h) => !(h.warn && h.text) && isList(h));
  return (
    <>
      {tagline && <p className="book-tagline">{tagline}</p>}
      {warns.map((h) => (
        <WarningLine key={h.label}>{h.text}</WarningLine>
      ))}
      {typeof lead === 'string' ? lead && <p className="book-paragraph">{lead}</p> : lead && <RuleText text={lead} className="rule-text--book" />}
      {description?.map((paragraph, n) => (
        <p key={n} className="book-paragraph">
          {paragraph}
        </p>
      ))}
      {lines.map((h) => (
        <Fragment key={h.label}>
          {(h.text || h.lines) && (
            <p className="book-line">
              <span className="book-label">{h.label}</span> {h.text}
            </p>
          )}
          {h.lines &&
            h.bullets?.map((b, n) => (
              <p key={n} className="book-line book-line--sub">
                <span className="book-label">{b.name}</span> {b.effect}
              </p>
            ))}
        </Fragment>
      ))}
      {lists.map((h) => (
        <Fragment key={h.label}>
          <h3 className="book-subhead">{h.label}</h3>
          {h.text && <p className="book-paragraph">{h.text}</p>}
          {h.bullets && h.bullets.length > 0 && (
            <ul className="book-list">
              {h.bullets.map((b, n) => (
                <li key={n}>
                  <b>{leadIn(b.name)}</b>
                  {b.effect ? ` ${b.effect}` : ''}
                </li>
              ))}
            </ul>
          )}
          {h.chips && h.chips.length > 0 && (
            <span className="entry-panel__chips">
              {h.chips.map((c) => (
                <button key={c.id} type="button" className="chip" onClick={() => onChip?.(c.id)}>
                  {c.name}
                </button>
              ))}
            </span>
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * A table in the book's style (ds-8, dec-10 S3): a filled title bar with the table's name, a head row over a rule, the
 * rows banded. It reads as one table to a screen reader, named by its title.
 */
export function BookTable({
  title,
  head,
  rows,
  marked,
  markedSpoken,
  wordsColumn,
  titleStart = false,
}: {
  title: string;
  head: readonly string[];
  rows: readonly (readonly string[])[];
  /**
   * Variant "title at the start": the title bar's words left-aligned, as frame M2h draws the Burden pop-up's tables
   * (tfb-4; Francis's fix of 2026-11-20). Off, the title stays centred as creation's tables draw it.
   */
  titleStart?: boolean;
  /** A row drawn in bold (the character's own band, B4); `markedSpoken` is said after its first cell, not shown. */
  marked?: number;
  markedSpoken?: string;
  /** A table's one column of words (a level table's titles), the only one that wraps; every other column stays on one
   * line, and a table of figures alone (no words column) keeps every cell on one line (cs-40a, F8: a cell never wraps
   * its value); its box scrolls sideways when it cannot fit. */
  wordsColumn?: number;
}) {
  return (
    // Its own box scrolls sideways when the table truly cannot fit (the largest text size), never the page.
    <div className="book-table__box" role="region" aria-label={title} tabIndex={0}>
      <table className={titleStart ? 'book-table book-table--title-start' : 'book-table'}>
        <caption>{title}</caption>
        <thead>
          <tr>
            {head.map((cell, m) => (
              <th key={cell} scope="col" className={m !== wordsColumn ? 'book-table__figure' : undefined}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, n) => (
            <tr key={n} className={n === marked ? 'book-table__marked' : undefined}>
              {row.map((cell, m) => (
                <td key={m} className={m !== wordsColumn ? 'book-table__figure' : undefined}>
                  {cell}
                  {n === marked && m === 0 && markedSpoken && <span className="visually-hidden">{markedSpoken}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One row of a list inside an entry (ct-7, a spell book's spells): the name, the line under it, the facts small. */
export interface EntryListRow {
  key: string;
  name: string;
  line?: string;
  facts?: string;
  /** A quiet tag beside the name, in words ("given", sr-4). */
  tag?: string;
  onOpen: () => void;
}

/**
 * A list of entries, one row each, the row opening its entry (ct-7: a spell book's spells inside an entry; sr-4: a tab
 * of the full sheet's Magic section): the name with a quiet tag in words ("given"), the line under it, the facts small.
 */
export function EntryList({ label, rows }: { label: string; rows: readonly EntryListRow[] }) {
  return (
    <ul className="entry-panel__book" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <button type="button" className="entry-panel__book-row" onClick={row.onOpen}>
            <span className="entry-panel__book-name">
              {row.name}
              {row.tag && <span className="entry-panel__book-tag">{row.tag}</span>}
            </span>
            {row.line && <span className="entry-panel__book-line">{row.line}</span>}
            {row.facts && <span className="entry-panel__book-facts">{row.facts}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The entry's full rules (ct-2): small-caps headings, advantages and disadvantages as bullet lines, open classes as
 * chips; a spell book's spells one row each (ct-7). The foot's button reads like the row's: "Pick <name>", then
 * "Picked ✓" pressed. Without `onPick` the entry is only to read (a class opened from a chip). The step decides where
 * it shows: a sheet on a phone (the pick is its accent), a panel beside the list on a wide screen (Next keeps it).
 */
export function EntryPanel({
  name,
  meta,
  lead,
  description,
  headings,
  list,
  picked = false,
  pickedLabel,
  pickedSpoken,
  onPick,
  onChip,
  onClose,
  backLabel,
  asSheet,
  closed,
  extra,
  tagline,
  source,
  preview = false,
  backTo,
  action,
  backIcon,
  headAction,
}: {
  /**
   * A button beside ✕ in the sheet's head (the Player tab's Pin star on an ability's or trait's entry, row P4 of plan
   * test-feedback-2026-11-19; euf-2, page 26's fix 1). Only as a sheet.
   */
  headAction?: ReactNode;
  /**
   * An entry read in play with its own act at the foot, plain (the **act** variant; mockup magic/04, a spell's rules
   * with Cast): the foot's one button, in place of the way back (the sheet's ✕ closes it). Not with `onPick`.
   */
  action?: { label: string; spoken?: string; /** Its icon above the word (ic-2; the shared `StackedButton`). */ icon?: SetIconName; onAction: () => void };
  /** The way out's icon above `backLabel` (ic-2: "Got it" with the tick); without, the plain word button. */
  backIcon?: SetIconName;
  name: string;
  /** The source line: "Fen rules · p. 12". */
  meta?: string;
  /** In the book format (inside creation's book type): the small-capitals line under the name (a patron's title, C3). */
  tagline?: string;
  /**
   * In the book format: the book and page for the last line, "From your setting's rules: <source>." Without it the
   * `meta` is the source; an empty string draws no source line.
   */
  source?: string;
  /** The sheet drawn in place, open (the component gallery; Dialog's preview variant). */
  preview?: boolean;
  /**
   * An entry opened from another to read (a class from a kindred's chip, a spell of a book): the other entry's name. Its
   * way back reads "Back to <name>": in the book format at the top, fl-1's quiet link (C3); elsewhere at the foot.
   */
  backTo?: string;
  /**
   * The entry's one line under the name (its blurb). A trait's note written in blocks (tfb-5) is set out block by
   * block, each on its own line, by `RuleText`; plain words read as before.
   */
  lead?: EntryLead;
  /** The book's descriptive paragraphs after the blurb (a class's or kindred's `description`), as plain text. */
  description?: readonly string[];
  headings: EntrySection[];
  /** Rows after the headings (a spell book's spells), each opening its own entry. */
  list?: EntryListRow[];
  picked?: boolean;
  /** The picked button's words when not "Picked ✓" (the pick-twice variant: "Specialised ✓✓", ct-8). */
  pickedLabel?: string;
  /** Said with the name once picked, as on its row (`PickButton`): the takes mark's "picked twice" (2026-11-13). */
  pickedSpoken?: string;
  onPick?: () => void;
  /** A chip tapped (an open class): the step opens that entry. */
  onChip?: (id: string) => void;
  onClose: () => void;
  /** An entry to read in a sheet: its foot button's words ("Back to Bog folk"); without, only the sheet's ✕. */
  backLabel?: string;
  /** A sheet (phone) rather than a panel beside the list (wide screen). */
  asSheet: boolean;
  /**
   * A closed entry (final drafts C, ⚑3; mockup creation/final/02): the sign and why under the name, the rule in words,
   * and at the foot **Ask the GM to allow it**, which takes the pick, flagged for the GM's approval. No Pick. Without
   * `onAsk` (a closed patron, cp-1: approval can't open it) no foot button; the entry closes by its ✕.
   */
  closed?: { why: string; note: string; onAsk?: () => void };
  /** A part after the headings (a kit's rolled picks, each with its own Change: `RolledPicks`). */
  extra?: ReactNode;
}) {
  // Inside creation's book type the entry reads as the book prints it (dec-10 S3; cs-4); elsewhere, as before.
  const book = useContext(BookTypeScope);
  const sourceWords = (source ?? meta ?? '').trim();
  const pickButton = onPick && (
    <button
      type="button"
      className={picked || !asSheet ? 'button-secondary' : 'button-primary'}
      aria-pressed={picked}
      aria-label={picked ? (pickedSpoken ? `Pick ${name}, ${pickedSpoken}` : `Picked ${name}`) : book ? `Pick ${name}` : undefined}
      onClick={onPick}
    >
      {picked ? (pickedLabel ?? 'Picked ✓') : book ? 'Pick' : `Pick ${name}`}
    </button>
  );
  // A way back to another entry sits at the top in the book format (C3); any other way out (the review's "Got it")
  // keeps the foot.
  const backTop = !onPick && asSheet && backTo ? backTo : null;
  // The act variant's button takes the foot; the sheet's ✕ is then the way out (no Close beside an X, 2026-11-12).
  const act = !onPick && action ? action : null;
  const footWord = act ? undefined : (backLabel ?? (backTo ? `Back to ${backTo}` : undefined));
  const actButton = act && (
    <div className={book ? 'entry-panel__foot book-foot' : 'entry-panel__foot'}>
      {act.icon ? (
        <StackedButton icon={act.icon} label={act.label} aria-label={act.spoken} onClick={act.onAction} />
      ) : (
        <button type="button" className="button-secondary" aria-label={act.spoken} onClick={act.onAction}>
          {act.label}
        </button>
      )}
    </div>
  );
  // The way out by its word ("Got it"), its icon above the word where one is given (ic-2).
  const wayOut = (word: string) =>
    backIcon && word === backLabel ? (
      <StackedButton icon={backIcon} label={word} onClick={onClose} />
    ) : (
      <button type="button" className="button-secondary" onClick={onClose}>
        {word}
      </button>
    );
  const bookBody = (
    <>
      {backTop && (
        // An entry to read (a chip's class, a spell of a book): its way back, a quiet link (fl-1 allows "Back to").
        <button type="button" className="button-quiet book-back" onClick={onClose}>
          Back to {backTop}
        </button>
      )}
      {closed && (
        <div className="entry-panel__closed">
          <WarningLine>{closed.why}</WarningLine>
          <p className="book-paragraph">{closed.note}</p>
        </div>
      )}
      <BookBody tagline={tagline} lead={lead} description={description} headings={headings} onChip={onChip} />
      {headings.length === 0 && !list?.length && !lead && !description?.length && <p className="entry-panel__empty">Your setting says nothing more about {name}.</p>}
      {extra}
      {list && list.length > 0 && <EntryList label={`In ${name}`} rows={list} />}
      {sourceWords && <p className="book-source">{`From your setting\u2019s rules: ${sourceWords}${/[.!?]$/.test(sourceWords) ? '' : '.'}`}</p>}
      {!onPick && asSheet && backLabel && !backTop && !act && (
        <div className="entry-panel__foot book-foot">{wayOut(backLabel)}</div>
      )}
      {closed?.onAsk && !onPick && (
        <div className="entry-panel__foot book-foot">
          <button type="button" className="button-secondary" onClick={closed.onAsk}>
            Ask the GM to allow it
          </button>
        </div>
      )}
      {actButton}
      {/* One button at the right (cs-4): in a sheet the sheet's one accent; beside the list, Next keeps it (R3-9). */}
      {pickButton && <div className="entry-panel__foot book-foot">{pickButton}</div>}
    </>
  );
  const body = book ? (
    bookBody
  ) : (
    <>
      {closed && (
        <div className="entry-panel__closed">
          <WarningLine>{closed.why}</WarningLine>
          <p className="entry-panel__lead">{closed.note}</p>
        </div>
      )}
      {typeof lead === 'string' ? lead && <p className="entry-panel__lead">{lead}</p> : lead && <RuleText text={lead} />}
      {description?.map((paragraph, n) => (
        <p key={n} className="entry-panel__lead entry-panel__description">
          {paragraph}
        </p>
      ))}
      {headings.length === 0 && !list?.length && !lead && !description?.length &&<p className="entry-panel__empty">Your setting says nothing more about {name}.</p>}
      {headings.length > 0 && (
        <dl className="entry-panel__list">
          {headings.map((h) => (
            <div key={h.label} className="entry-panel__row">
              <dt>{h.label}</dt>
              <dd>
                {h.warn && h.text ? <WarningLine>{h.text}</WarningLine> : h.text}
                {h.bullets && h.bullets.length > 0 && (
                  <ul className="entry-panel__bullets">
                    {h.bullets.map((b, n) => (
                      <li key={n}>
                        <b>{b.name}</b>
                        {b.effect ? ` — ${b.effect}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {h.chips && h.chips.length > 0 && (
                  <span className="entry-panel__chips">
                    {h.chips.map((c) => (
                      <button key={c.id} type="button" className="chip" onClick={() => onChip?.(c.id)}>
                        {c.name}
                      </button>
                    ))}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {extra}
      {list && list.length > 0 && <EntryList label={`In ${name}`} rows={list} />}
      {!onPick && asSheet && footWord && (
        // An entry to read (a chip's class, a spell of a book) in a sheet: its way back (the sheet's ✕ closes it).
        <div className="entry-panel__foot">{wayOut(footWord)}</div>
      )}
      {closed?.onAsk && !onPick && (
        <div className="entry-panel__foot">
          <button type="button" className="button-secondary" onClick={closed.onAsk}>
            Ask the GM to allow it
          </button>
        </div>
      )}
      {actButton}
      {/* In a sheet the pick is the one accent; beside the list, Next is the screen's one accent (R3-9). Picked: pressed. */}
      {pickButton && <div className="entry-panel__foot">{pickButton}</div>}
    </>
  );
  if (asSheet) {
    return (
      <Dialog label={name} meta={book ? undefined : meta} bookHeading={book} preview={preview} onClose={onClose} {...(headAction ? { headAction } : {})}>
        {body}
      </Dialog>
    );
  }
  return (
    <aside className="entry-panel" aria-label={name}>
      <div className="entry-panel__head">
        <h2 className={`entry-panel__name${book ? ' book-heading' : ''}`}>{name}</h2>
        {meta && !book && <p className="entry-panel__meta">{meta}</p>}
        <CloseButton className="entry-panel__close" onClose={onClose} />
      </div>
      {body}
    </aside>
  );
}

/**
 * A score (cr-9; reworked cw-11, mockup creation/12): the ability's full name, marked ⓘ, opens what the score does
 * (`onExplain`); the typed stepper (− / + around a number typed on tap) beside it on a phone, under it and centred in a
 * tile on a wider screen; what the number changes under them.
 */
export function ScoreTile({
  id,
  label,
  long,
  value,
  onChange,
  onStep,
  words,
  onExplain,
  average = false,
}: {
  id: string;
  /** Untouched (final drafts A5): the average in the lighter weight and the line "Average". */
  average?: boolean;
  /** The name shown: the full name where the setting has one (cw-11). */
  label: string;
  /** The name a screen reader hears for the field and its − / +. */
  long: string;
  value: string;
  onChange: (text: string) => void;
  onStep: (by: 1 | -1) => void;
  /** "+1 melee, open doors", or '' where the number changes nothing or none is in (P4). */
  words: string;
  /** The name tapped: what the score does, then what this number does. */
  onExplain?: () => void;
}) {
  return (
    <div className="score-tile" role="group" aria-label={`${long} score`}>
      {onExplain ? (
        <button type="button" className="score-tile__key score-tile__name" aria-label={`${label}: what it does`} onClick={onExplain}>
          <Icon name="info" size={20} />
          {label}
        </button>
      ) : (
        <p className="score-tile__key">{label}</p>
      )}
      <div className="score-tile__value">
        <TypedStepper id={id} label={long} value={value} onChange={onChange} onStep={onStep} placeholder="type" describedBy={`${id}-words`} average={average} />
      </div>
      <p className="score-tile__words" id={`${id}-words`}>
        {average ? AVERAGE_LINE : words}
      </p>
    </div>
  );
}

/** A tap the rule's button makes. When the rule can't take it now (the floor, nothing banked) it answers why; never disabled. */
export interface TileTap {
  label: string;
  aria: string;
  onTap: () => void;
}

/**
 * The Adjust variant (ct-3, option C; final draft 1): only a tradeable score has a tile, with only the control the
 * rule allows: − left of the number on a lowerable score above the floor, + right of it on a prime, none at or under
 * the floor. Under it the modifier now and the nearest thresholds, or the reason there's no control (the sign with it
 * when the score is already under the floor); the prime tagged "Prime" and a darker edge.
 */
export function AdjustTile({
  label,
  long,
  value,
  words,
  prime,
  lower,
  raise,
  onExplain,
  was,
}: {
  label: string;
  long: string;
  value: number;
  /** A traded score's number before the trade (Design on #555): "was 12", the quiet line under the value. */
  was?: number;
  /** "+1 now, +2 at 16, +5% experience", or why it can't be lowered (a WarningLine under the floor). */
  words: ReactNode;
  prime: boolean;
  lower?: TileTap;
  raise?: TileTap;
  /** The full name tapped (Design, 2026-11-06): what the score does, as on Scores. */
  onExplain?: () => void;
}) {
  const tap = (t: TileTap) => (
    <button type="button" className="button-secondary score-tile__step" aria-label={t.aria} onClick={t.onTap}>
      {t.label}
    </button>
  );
  return (
    <div className={`score-tile score-tile--adjust${prime ? ' score-tile--prime' : ''}`} role="group" aria-label={`${long} score`}>
      {onExplain ? (
        <button type="button" className="score-tile__key score-tile__name" aria-label={`${label}${prime ? ', prime' : ''}: what it does`} onClick={onExplain}>
          <Icon name="info" size={20} />
          {label}
          {prime && <span className="score-tile__prime">Prime</span>}
        </button>
      ) : (
        <p className="score-tile__key">
          {label}
          {prime && <span className="score-tile__prime">Prime</span>}
        </p>
      )}
      <div className="score-tile__value">
        {lower && tap(lower)}
        <span className="score-tile__number">
          <span className="score-tile__now">{value}</span>
        </span>
        {raise && tap(raise)}
      </div>
      {was !== undefined && was !== value && <p className="score-tile__was">was {was}</p>}
      <div className="score-tile__words">{words}</div>
    </div>
  );
}

/**
 * The prime experience table (R3-7, mockup creation/final/11), inside Help me choose on Adjust scores and on Class: two
 * columns, the prime score's range and its experience, the pack's rows; the character's band washed and marked "you"
 * in words (never colour alone). Nothing drawn without rows.
 */
export function PrimeXpTable({ bands, caption = 'Prime score and experience', prime }: { bands: readonly { range: string; xp: string; you: boolean }[] | null; caption?: string; prime?: string }) {
  const book = useContext(BookTypeScope);
  if (!bands || bands.length === 0) return null;
  // Inside creation, the book's table (dec-10 B, ds-8; picture 17-B4): the prime's name over its column, the
  // character's band in bold, "you" said, not shown.
  if (book)
    return (
      <BookTable
        title="Experience by prime score"
        head={[prime ?? 'Prime score', 'Experience']}
        rows={bands.map((b) => [b.range, b.xp])}
        marked={bands.findIndex((b) => b.you)}
        markedSpoken=", you"
      />
    );
  return (
    <table className="prime-xp" aria-label={caption}>
      <caption className="prime-xp__caption">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Prime score</th>
          <th scope="col">Experience</th>
        </tr>
      </thead>
      <tbody>
        {bands.map((b) => (
          <tr key={b.range} className={b.you ? 'prime-xp__you' : undefined}>
            <td>
              {b.range}
              {b.you && <span className="prime-xp__mark">, you</span>}
            </td>
            <td>{b.xp}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The trades as chips under the Adjust tiles (ct-3): "WIS −2 → STR +1 ✕"; the ✕ undoes that trade only. */
export function TradeChips({ chips, onUndo }: { chips: { key: string; text: string }[]; onUndo: (index: number) => void }) {
  const id = useId();
  if (chips.length === 0) return null;
  return (
    <div className="trade-chips" role="group" aria-labelledby={id}>
      <h2 id={id} className="trade-chips__head">
        Your trades
      </h2>
      <div className="trade-chips__list">
        {chips.map((c, n) => (
          <button key={c.key} type="button" className="chip trade-chips__chip" aria-label={`Undo the trade ${c.text}`} onClick={() => onUndo(n)}>
            {c.text} <span aria-hidden="true">✕</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The tiles' grid: six on a tablet row, two columns on a phone. */
export function ScoreTiles({ children, adjust }: { children: ReactNode; adjust?: boolean }) {
  return <div className={`score-tiles${adjust ? ' score-tiles--adjust' : ''}`}>{children}</div>;
}

/** The scores strip under the title (cr-10): the race's name first, then each score, with a racial change live. */
export function ScoresStrip({ lead, scores }: { lead?: string; scores: { label: string; value: string; was?: string; why?: string }[] }) {
  return (
    <ul className="scores-strip" aria-label="Your scores">
      {lead && <li className="scores-strip__lead">{lead}</li>}
      {scores.map((s) => (
        <li key={s.label}>
          {s.label}{' '}
          <b>
            {s.was !== undefined && s.was !== s.value ? `${s.was} → ${s.value}` : s.value}
          </b>
          {s.why && <span className="scores-strip__why"> {s.why}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * The setting's start-over rule, offered in a callout when it triggers (cr-9): Start over / Keep them. The re-roll
 * variant on Who they are (cf-1) names its own buttons: Roll again / Keep it.
 */
export function StartOverCallout({
  text,
  source,
  onStartOver,
  onKeep,
  startOverLabel = 'Start over',
  keepLabel = 'Keep them',
}: {
  text: string;
  source?: string;
  onStartOver: () => void;
  onKeep: () => void;
  startOverLabel?: string;
  keepLabel?: string;
}) {
  return (
    <div className="creation-callout" role="group" aria-label="Weak roll">
      <p className="creation-callout__text">
        <b>Weak roll.</b> {text}
        {source && <span className="creation-callout__meta"> {source}</span>}
      </p>
      <div className="creation-callout__actions">
        <button type="button" className="button-secondary" onClick={onStartOver}>
          {startOverLabel}
        </button>
        <button type="button" className="button-secondary button-secondary--small" onClick={onKeep}>
          {keepLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * A folded group ("Not open to bog folk · 5"), never hidden (cr-7); `open` starts it unfolded. The whole row unfolds
 * it; a square at its end shows + while folded and − while open (cw-11: no "›"), the shape carrying the state.
 */
export function FoldedGroup({
  label,
  note,
  detail,
  children,
  open,
  onToggle,
  square = false,
}: {
  label: string;
  note?: string;
  /** A second quiet line under the note (the Pack's "Not counted for speed"; Design on #552), never run into it. */
  detail?: string;
  children: ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /**
   * The + / − square inside the book's type too (the **Square in the book's type** variant: Prepare's fold, as frame 06
   * draws it; pl-1 as amended 2026-11-18). Creation's own folds keep the chevron until the app-wide change.
   */
  square?: boolean;
}) {
  const [shown, setShown] = useState(!!open);
  // One fold mark in creation (cs-9): the chevron, down folded and up open; "+" means add. Elsewhere the +/− square.
  const creation = useContext(BookTypeScope) && !square;
  return (
    <details
      className="creation-fold"
      open={open}
      onToggle={(event) => {
        setShown(event.currentTarget.open);
        onToggle?.(event.currentTarget.open);
      }}
    >
      <summary className="creation-fold__summary">
        <span className="creation-fold__text">
          <span className="creation-fold__label">{label}</span>
          {note && <span className="creation-fold__note">{note}</span>}
          {detail && <span className="creation-fold__note creation-fold__detail">{detail}</span>}
        </span>
        {creation ? (
          <span className={`creation-fold__mark${shown ? ' creation-fold__mark--open' : ''}`} aria-hidden="true">
            <Icon name="chevron" size={20} />
          </span>
        ) : (
          <span className="creation-fold__square" aria-hidden="true">
            <Icon name={shown ? 'minus' : 'plus'} size={20} />
          </span>
        )}
      </summary>
      <div className="creation-fold__rows">{children}</div>
    </details>
  );
}

/**
 * A describing table's rows folded on a step (FoldedGroup's variant; R3-4, 2026-11-08: every describing table starts
 * collapsed, its row opens it): "8 to choose from", the pick or "Nothing picked yet" under it. FoldedGroup itself with
 * these words passed in; no markup or style of its own. Read once as the step opens:
 * it starts open with a pick inside, so a pick is never hidden, and a tap inside never folds it shut. `alone`: the
 * step holds only this one list (a trait-list step: backgrounds, a sign), so it starts open, never collapsed
 * (m5b-one-table-open, Francis via Design, 2026-11-09); a table beside other content (Who they are, Gear) stays folded.
 */
export function TableFold({ count, picked, note, alone, children }: { count: number; picked: string | null; note?: string; alone?: boolean; children: ReactNode }) {
  const [startOpen] = useState(!!alone || !!picked);
  return (
    <FoldedGroup label={`${count} to choose from`} note={note ?? (picked ? `Picked: ${picked}` : 'Nothing picked yet')} open={startOpen}>
      {children}
    </FoldedGroup>
  );
}

/** The approval fold's words: "3 more need the GM's approval"; with no open rows before it, "2 need the GM's approval". */
export function approvalFoldLabel(count: number, more: boolean): string {
  return `${count} ${more ? 'more ' : ''}${count === 1 ? 'needs' : 'need'} the GM's approval`;
}

/**
 * Languages' fold (Design on #555): the never-learnable rows fold with the approval ones, under one row that names
 * both: "3 more: not open to your kind, or need the GM's approval"; only one kind, its own words.
 */
export function languageFoldLabel(count: number, more: boolean, closed: number, leave: number): string {
  if (closed === 0) return approvalFoldLabel(count, more);
  const lead = `${count}${more ? ' more' : ''}`;
  return leave === 0 ? `${lead}: not open to your kind` : `${lead}: not open to your kind, or need the GM's approval`;
}

/**
 * The approval fold (FoldedGroup's variant; Francis, retest 2, 2026-11-07): on every pick step the rows needing the
 * GM's special approval follow the open rows, folded under one row, "N more need the GM's approval", with + at its
 * right edge. Folded on every visit; it starts open only when the player's own pick is inside, so a pick is never
 * hidden. Nothing to fold: nothing drawn. `label` for a step whose fold holds more than approvals (Languages: "N more:
 * not open to your kind, or need the GM's approval", `languageFoldLabel`).
 */
export function ApprovalFold({ count, more = true, holdsPick = false, label, children }: { count: number; more?: boolean; holdsPick?: boolean; label?: string; children: ReactNode }) {
  // Read once, as the step opens: a tap inside the fold never folds it shut under the player's finger.
  const [startOpen] = useState(holdsPick);
  if (count === 0) return null;
  return (
    <FoldedGroup label={label ?? approvalFoldLabel(count, more)} open={startOpen}>
      {children}
    </FoldedGroup>
  );
}

/** A group of pick rows: its heading and count (never colour alone: the ✓ plus the words), then its rows. */
export function PickGroup({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="pick-group" role="group" aria-labelledby={id}>
      <h2 id={id} className="pick-group__head">
        <span className="pick-group__title">{title}</span>
        {/* The meta beside the title, set apart by space and type (no middle dot, final drafts A9); a reader hears a comma. */}
        {meta && <span className="visually-hidden">,</span>}
        {meta && ' '}
        {meta && <span className="pick-group__meta">{meta}</span>}
      </h2>
      {children}
    </div>
  );
}

/**
 * A tapped table's head in the book's style (cs-7, dec-10 D and E; pictures creation/final 19-D2, 20-E1, 20-E3): the
 * table's name as the filled title bar (left out when the pack names none; nothing invented), then a head row naming the
 * die, with its glyph, and the column over a strong rule. Read aloud by the rows' group, so hidden from a screen reader.
 */
export function BookTapHead({ title, die, column, aside }: { title?: string; die: string; column: string; aside?: ReactNode }) {
  const glyph = dieOf(die);
  return (
    <div className="book-tap-head" aria-hidden="true">
      {title && <p className="book-tap-head__bar">{title}</p>}
      <p className="book-tap-head__row">
        <span className="book-tap-head__die">
          {glyph && <DieGlyph die={glyph} />}
          {die}
        </span>
        <span>{column}</span>
        {/* A last column's head at the row's end (the rumour table's crossed eye and "Truth", dec-12 E). */}
        {aside && <span className="book-tap-head__aside">{aside}</span>}
      </p>
    </div>
  );
}

/** A row of a tapped table (`BookTapTable`). */
export interface BookTapRow {
  key: string;
  /** The die's numbers for it ("1", "2–3"); said in words ("2 to 3"). */
  range: string;
  name: string;
  /** Its line under the name (a blurb, "Already yours: roll again"). */
  line?: string;
  /** A ▲ line: why it is closed ("Not open to Stone kin"), or what picking it needs ("Needs the GM's special approval"). */
  warn?: string;
  picked: boolean;
  /** A tap: picks, or, for a closed row, says why it can't be taken (the caller's toast). Every row stays a tap. */
  onPick: () => void;
  /** Opens the row's entry (a rolled spell's rules; the build's ⓘ, kept under cs-30): a 44 px ⓘ beside the row. */
  onOpen?: () => void;
  /**
   * How many times it is taken or marked (a kit's roll made twice, a pick-up-to-N table; R3-8): one ✓ each (✓✓), the
   * count said aloud only; with `onPutBack`, the 44 px − square beside the row puts one back (dec-10 F-a, picture 21-F3;
   * the caller gives it from the count it wants the square at).
   */
  times?: number;
  onPutBack?: () => void;
}

/**
 * The range column's width for a whole table, in characters (dec-10 F-a, the lead on #786): its widest range in words
 * ("11 to 12"), so every row's words start at one place; the column's own least width (6ch) below that.
 */
export function rangeWidthOf(ranges: readonly string[]): number | undefined {
  const widest = Math.max(0, ...ranges.map((range) => range.replace('–', ' to ').length));
  return widest > 6 ? widest : undefined;
}

/**
 * A table the player rolls on at the table and taps, in the book's style (dec-10 E; pictures creation/final 20-E1,
 * 20-E2, 20-E3): `BookTapHead`, then one row per number of the die, the range in its own column, the name and its line,
 * ✓ when picked; a closed row stays in its place with its ▲ reason and its tap explains. The rows are radios (one pick)
 * or checkboxes with `multiple` (a list where more than one is taken), in a named group (a plain group, since a row's ⓘ
 * sits beside it and a radio group holds only radios); every row is a 44 px tap and says its state. The banding, the rules and the picked row's wash come from creation's book rows (`.table-sheet__rows`).
 */
export function BookTapTable({ title, die, column, label, rows, multiple = false }: { title?: string; die: string; column: string; label: string; rows: readonly BookTapRow[]; multiple?: boolean }) {
  const rangeWidth = rangeWidthOf(rows.map((row) => row.range));
  return (
    <div className="book-tap-table">
      <BookTapHead title={title} die={die} column={column} />
      <div className="table-sheet__rows" role="group" aria-label={label}>
        {rows.map((row) => (
          <BookTapCell key={row.key} row={row} rangeWidth={rangeWidth} multiple={multiple} />
        ))}
      </div>
    </div>
  );
}

/**
 * One row of a tapped table (`BookTapTable`, and the Table sheet's Pick table variant, `PickTableSheet`): the book's
 * compact row, ✓ a time it is taken or marked (the count said aloud only), with its − square and ⓘ beside it when it
 * has them. Built once, drawn by both.
 */
export function BookTapCell({ row, rangeWidth, multiple }: { row: BookTapRow; rangeWidth: number | undefined; multiple: boolean }) {
  const range = row.range.replace('–', ' to ');
  const times = row.times ?? 0;
  // Taken more than once: one ✓ a time, the count read aloud only ("1 to 2 Eel knife, picked twice").
  const spoken = times > 1 ? [`${range} ${row.name}, picked ${timesInWords(times)}`, row.line].filter(Boolean).join(', ') : undefined;
  const option = <OptionRow compact range={range} rangeWidth={rangeWidth} name={row.name} summary={row.line ?? ''} notAllowed={row.warn} notAllowedLabel="" selected={row.picked} checks={Math.max(times, 1)} label={spoken} multiple={multiple} onPick={row.onPick} />;
  const less = times >= 1 && row.onPutBack;
  if (!row.onOpen && !less) return option;
  return (
    <div className="book-tap-table__cell">
      {option}
      {less && (
        <button type="button" className="button-secondary pick-row__less" aria-label={`Put back one ${row.range ? `${range}: ` : ''}${row.name}`} onClick={row.onPutBack}>
          <Icon name="minus" size={20} />
        </button>
      )}
      {row.onOpen && (
        <button type="button" className="book-tap-table__open" aria-label={`${row.name}: read it`} onClick={row.onOpen}>
          <Icon name="info" size={20} />
        </button>
      )}
    </div>
  );
}

/**
 * Gear's pick-up-to-N table in its sheet, the Table sheet's **Pick table** variant (cts-1, cts-5 a, cts-7; mockup
 * creation/final 24, frames TS2, TS3 and TS4, approved 2026-11-19), whatever its length: titled with the table's name
 * and its count ("Travelling odds: pick up to 4"), the Roll row "Roll d20, then mark your row.", the typed-roll strip,
 * the rows as the **Tapped table** under its head (a tap marks, a tap again marks twice, the − square puts one back;
 * the caller's rows say what a tap past N answers), and a foot that stays in view while the rows scroll: what is
 * marked (`foot`, two lines at most, then "…") and **Take these** at the right (**Take it** on a pick-up-to-1 table,
 * `multiple` false; ⚑ 5), the accent once a row is marked (`marked`), always a tap. The ✕ calls `onClose`: nothing is
 * taken. `long` is the rows' blocks (the typed roll, the range bar from 50 rows, two columns on a tablet from 24), each
 * row's key its index in `rows`.
 */
export function PickTableSheet({
  label,
  die,
  title,
  rows,
  long,
  multiple,
  foot,
  marked,
  onTake,
  onClose,
  preview = false,
}: {
  label: string;
  die: string;
  /** The table's name, on its bar. */
  title: string;
  rows: readonly BookTapRow[];
  long: LongTable;
  multiple: boolean;
  foot: string;
  marked: boolean;
  onTake: () => void;
  onClose: () => void;
  preview?: boolean;
}) {
  const rangeWidth = rangeWidthOf(rows.map((row) => row.range));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return (
    <TableSheet
      label={label}
      groups={[]}
      long={long}
      roll={die ? { die, words: `Roll ${die}, then mark your row.` } : undefined}
      head={<BookTapHead title={title} die={die} column="Result" />}
      rowOf={(cell) => {
        const row = byKey.get(cell.key);
        return row ? <BookTapCell row={row} rangeWidth={rangeWidth} multiple={multiple} /> : null;
      }}
      pick={{ foot, marked, onTake, one: !multiple }}
      onDone={onClose}
      preview={preview}
    />
  );
}

/**
 * Other… (cr-15, cr-17): a row that opens a typed entry the list doesn't have ("A trade the list doesn't have"), with an
 * optional note when `withNote`. Add hands the words up; an empty name explains instead (never disabled).
 */
export function OtherRow({ label, blurb, withNote, max = 40, onAdd, onEmpty }: { label: string; blurb?: string; withNote?: boolean; max?: number; onAdd: (name: string, note: string) => void; onEmpty: () => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const add = () => {
    if (!name.trim()) return onEmpty();
    onAdd(name.trim().slice(0, max), note.trim().slice(0, 80));
    setName('');
    setNote('');
    setOpen(false);
  };
  return (
    <div className="other-row">
      <button type="button" className="other-row__open" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <span className="other-row__name">Other…</span>
          {blurb && <span className="other-row__blurb">{blurb}</span>}
        </span>
        <span className="creation-fold__square" aria-hidden="true">
          <Icon name={open ? 'minus' : 'plus'} size={20} />
        </span>
      </button>
      {open && (
        <div className="other-row__form">
          <div className="field">
            <label className="label" htmlFor={`${id}-name`}>
              {label}
            </label>
            <input
              id={`${id}-name`}
              className="field__input"
              type="text"
              autoComplete="off"
              maxLength={max}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </div>
          {withNote && (
            <div className="field">
              <label className="label" htmlFor={`${id}-note`}>
                A note (optional)
              </label>
              <input id={`${id}-note`} className="field__input" type="text" autoComplete="off" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          <div className="other-row__actions">
            <button type="button" className="button-secondary" onClick={add}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Derived fields (cr-12, cr-23, ct-5; mockups creation/04 and 10): the layout's `fill` fields that have a value,
 * read-only, live with the picks, in a folded group "Derived fields · N ›" (never a "—" tile; when some have none yet,
 * the note says more appear as gear is picked). A value's parts show beside it (AC: "unarmoured, DEX +0"); a tap on
 * the label says where it comes from. Never asked, never edited here.
 */
export function DerivedFields({
  rows,
  open,
  onToggle,
  onExplain,
}: {
  rows: { key: string; label: string; value: string; note?: string }[];
  open?: boolean;
  /** Opened or closed by a tap: the caller remembers it on the device (cw-7). */
  onToggle?: (open: boolean) => void;
  /** A row tapped: its breakdown opens (bq-2, the full sheet's words). */
  onExplain: (row: { key: string; label: string }) => void;
}) {
  const shown = rows.filter((r) => r.value.trim() !== '');
  if (shown.length === 0) return null;
  // "Derived values" (cw-11, P16; final drafts C, mockup creation/final/03): "6 figures the rules work out", and that
  // more come with gear when some have no value yet. Each figure's source is in words beside it (its note).
  const note = `${shown.length} ${shown.length === 1 ? 'figure' : 'figures'} the rules work out${shown.length < rows.length ? ', more as you pick gear' : ''}`;
  return (
    <FoldedGroup label="Derived values" note={note} open={open} onToggle={onToggle}>
      <dl className="derived-fields" aria-label="Derived values">
        {shown.map((r) => (
          <div key={r.key} className="derived-fields__row">
            <dt>
              <button type="button" className="derived-fields__label" onClick={() => onExplain(r)}>
                {r.label}
              </button>
            </dt>
            <dd>
              {r.value}
              {r.note && <span className="derived-fields__note">, {r.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </FoldedGroup>
  );
}

/** One card of the creation review (cr-18, cw-11): what a step decided, read-only; Change reopens the step. */
export interface ReviewPart {
  id: string;
  title: string;
  /**
   * `strong`: said in bold (a special approval, money over); never colour alone. `why`: a muted note after it.
   * `values`: pack-list values after the text, each opening its entry (ct3-11: the kindred, the calling, the
   * alignment, a trait, each language); `after`: plain words after them (" · level 1"). `sub`: a muted line under the
   * text (cw-11: a row's what-it-is, "Warden's kit" over what it gave, a spell over "From your class"). `fold`: a
   * folded row ("Given · 6 items", a + square), its items one per line once opened.
   */
  lines: { text: string; strong?: boolean; why?: string; values?: ReviewValue[]; joiner?: string; after?: string; sub?: string; fold?: { note?: string; items: string[] }; onChange?: () => void; changeLabel?: string; warn?: string[]; tiles?: ReviewTiles }[];
  /** After the title, muted ("given"). */
  note?: string;
  /** Left out where nothing is changed here (Derived values). */
  onChange?: () => void;
  /** The whole card folded under its title, `note` beside it (cw-7, cw-11: Derived values). */
  folded?: boolean;
  /** The title is a warning (final drafts D: the exceptions card): the sign before it, in the warning colour. */
  warn?: boolean;
}

/**
 * Worked-out figures as tiles on the review (R3-6, mockup creation/final/12): the Score tile (`StatTile` small) for
 * each, the name over the figure, its parts under; three across, four past 1000 px; `saves` the Saves group under its
 * `label`, three across on a phone, five on a tablet. A tile opens its breakdown.
 */
export interface ReviewTiles {
  label?: string;
  saves?: boolean;
  items: { key: string; label: string; value: string; caption?: string; breakdown?: { title: string; lines: string[] } }[];
}

/**
 * A value on the review (ct3-11): its words and the entry it opens; without one (a typed language), words only. A
 * worked-out figure (Derived values) carries its `breakdown` instead, the full sheet's words (bq-2).
 */
export interface ReviewValue {
  text: string;
  entry?: { name: string; meta?: string; lead?: EntryLead; description?: readonly string[]; headings: EntrySection[] };
  breakdown?: { title: string; lines: string[] };
}

/**
 * The review's cards (cr-18, cw-11; mockup creation/12): one per step walked, in the order walked; each a title with
 * **Change** at its top right (a small secondary button, 44 px, no "›"), the only way to change anything here, then its
 * lines. A pack-list value is a Tap value (ct3-11) that hands its entry to `onEntry`, which opens it to read. A folded
 * card (Derived values) or row (Given) unfolds in place with its + square (cw-11).
 */
export function ReviewSections({
  parts,
  onEntry,
  onBreakdown,
}: {
  parts: ReviewPart[];
  onEntry?: (entry: NonNullable<ReviewValue['entry']>) => void;
  onBreakdown?: (breakdown: NonNullable<ReviewValue['breakdown']>) => void;
}) {
  const id = useId();
  const lineOf = (line: ReviewPart['lines'][number], n: number) => {
    if (line.tiles) {
      const t = line.tiles;
      return (
        <div key={n} className="creation-review__tiles-block" role="group" aria-label={t.label ?? 'Figures'}>
          {t.label && <p className="creation-review__tiles-label">{t.label}</p>}
          <div className={`creation-review__tiles${t.saves ? ' creation-review__tiles--saves' : ''}`}>
            {t.items.map((tile) => (
              <StatTile
                key={tile.key}
                small
                label={tile.label}
                value={tile.value}
                caption={tile.caption}
                onTap={tile.breakdown && onBreakdown ? () => onBreakdown(tile.breakdown!) : undefined}
                tapLabel={`${tile.label} ${tile.value}${tile.caption ? `, ${tile.caption}` : ''}: how it's worked out`}
              />
            ))}
          </div>
        </div>
      );
    }
    if (line.fold) {
      return (
        <FoldedGroup key={n} label={line.text} note={line.fold.note}>
          {line.fold.items.map((item, i) => (
            <p key={i} className="creation-review__line">
              {item}
            </p>
          ))}
        </FoldedGroup>
      );
    }
    const words = (
      <>
        {line.strong ? <strong>{line.text}</strong> : line.text}
        {line.values?.map((v, i) => (
          <span key={i}>
            {i > 0 ? (line.joiner ?? ' ') : line.text ? ' ' : ''}
            {onEntry && v.entry ? (
              <TapValue pill label={`${v.text}: open its entry`} onTap={() => onEntry(v.entry!)}>
                {v.text}
              </TapValue>
            ) : onBreakdown && v.breakdown ? (
              <TapValue pill label={`${v.text}: how it's worked out`} onTap={() => onBreakdown(v.breakdown!)}>
                {v.text}
              </TapValue>
            ) : (
              v.text
            )}
          </span>
        ))}
        {line.after}
        {line.why && <span className="creation-review__why">, {line.why}</span>}
      </>
    );
    // A line with its own Change (the Kindred · Class card's two lines, cw-11): the words, then the small button.
    if (line.onChange) {
      return (
        <div key={n} className="creation-review__row creation-review__row--change">
          <div className="creation-review__row-text">
            <p className="creation-review__line">{words}</p>
            {line.sub !== undefined && <p className="creation-review__sub">{line.sub}</p>}
          </div>
          <button type="button" className="button-secondary button-secondary--small creation-review__change" aria-label={line.changeLabel ?? 'Change'} onClick={line.onChange}>
            Change
          </button>
        </div>
      );
    }
    if (line.sub === undefined) {
      return (
        <p key={n} className="creation-review__line">
          {words}
        </p>
      );
    }
    return (
      <div key={n} className="creation-review__row">
        <p className="creation-review__line">{words}</p>
        <p className="creation-review__sub">{line.sub}</p>
        {line.warn?.map((w, i) => (
          <p key={i} className="creation-review__warn">
            <WarningLine>{w}</WarningLine>
          </p>
        ))}
      </div>
    );
  };
  return (
    <div className="creation-review">
      {parts.map((part) =>
        part.folded ? (
          <section key={part.id} className="creation-review__part" aria-label={part.title}>
            <FoldedGroup label={part.title} note={part.note}>
              {part.lines.map(lineOf)}
            </FoldedGroup>
          </section>
        ) : (
          <section key={part.id} className="creation-review__part" aria-labelledby={`${id}-${part.id}`}>
            <div className="creation-review__head">
              <h2 id={`${id}-${part.id}`} className="creation-review__title">
                {part.warn ? <WarningLine>{part.title}</WarningLine> : part.title}
                {part.note && <span className="creation-review__note">, {part.note}</span>}
              </h2>
              {part.onChange && (
                <button type="button" className="button-secondary button-secondary--small creation-review__change" aria-label={`Change ${part.title}`} onClick={part.onChange}>
                  Change
                </button>
              )}
            </div>
            {part.lines.map(lineOf)}
          </section>
        ),
      )}
    </div>
  );
}

/** A labelled field on a creation step: the label, the input (children), and the line under it. */
export function StepField({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field creation-field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="auth__meta">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * "What you rolled" (cs-1, bq3-18): a short number box under a roll's rows; the number typed picks the row it lands on,
 * and the line under it says which ("37 · A thimble…", "No row has 140."). A trait entry's spell roll uses it (table
 * sheets have no typed number since 2026-11-07: the row is the tap). The app never rolls.
 */
export function RolledNumber({ value, onChange, line }: { value: string; onChange: (text: string) => void; line: string }) {
  const id = useId();
  return (
    <StepField id={`${id}-go`} label="What you rolled" hint={line}>
      <input
        id={`${id}-go`}
        className="field__input field__input--short"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-go-hint`}
      />
    </StepField>
  );
}

/** One row of a table opened at creation: its range, its words, whether it's the one tapped. */
export interface TableSheetRow {
  key: string;
  range?: string;
  text: string;
  picked: boolean;
  onPick: () => void;
}

/** A table sheet's rows with the typed roll and, when long, the range bar (TableSheet's long variant). */
export interface LongTable {
  /** The rows in blocks: one per band when there is a bar ("1–25" … "76–100"), else one block (its heading unused). */
  ranges: { heading: string; rows: TableSheetRow[] }[];
  /** The range bar over the rows (50 rows or more, #571's final round). */
  bar: boolean;
  /** Two columns on a tablet (24 rows or more). */
  columns: boolean;
  /** What a typed roll shows: the key of the one row it lands on (null: every row) and a line only for a problem. Left out (a table with no die): no box. */
  typed?: (text: string) => { key: string | null; line: string };
  /** The number already shown (the gallery's filtered and no-match states); empty when left out. */
  startRolled?: string;
}

/**
 * The scroll moved so `target`'s top sits just under the sticky strip: the sheet's own scroll (a Dialog), else the
 * page's (the name table beside the step). Measured against where the strip will stick (the scroll's top edge), not
 * where it stands now: before a scroll it may still be lower down.
 */
function scrollUnder(target: Element | null | undefined, strip: HTMLElement | null) {
  if (!target || !strip) return;
  const sheet = target.closest('.dialog');
  const scroller = sheet ?? document.scrollingElement;
  if (!scroller) return;
  const stuckBottom = (sheet ? sheet.getBoundingClientRect().top + sheet.clientTop : 0) + strip.offsetHeight;
  scroller.scrollTop += target.getBoundingClientRect().top - stuckBottom;
}

/**
 * The long variant's body, shared by every table sheet (m5b-long-tables; mockup creation/final/13, B with C's field;
 * Design's rounds 2 and 3 on #571, 2026-11-09). A sticky strip at the top of the scroll, one line each: the typed roll
 * ("What you rolled", a box two taps wide and **Show**; any table with a die) and the range bar (`ButtonRow`, one
 * line that scrolls sideways; 50 rows or more; a tap scrolls to the band, hiding nothing). Under the strip, only when
 * needed, the problem line ("Whole numbers only.", "No row has 140."). Then the rows: the one the shown number lands
 * on with **Show every row** under it, or every row, one block per band, two columns on a tablet from 24 rows. No
 * folds. Show only filters on the device and writes nothing, so it needs no busy check. `rowOf` draws a row (the name
 * sheet's compact Option rows; a `PickRow` when left out); `role` is each block's role (the name sheet's radiogroups);
 * `head` goes between the strip and the rows (the name table's title bar and head row, 19-D2).
 */
export function LongRows({ label, long, rowOf, role = 'group', head }: { label: string; long: LongTable; rowOf?: (row: TableSheetRow) => ReactNode; role?: 'group' | 'radiogroup'; head?: ReactNode }) {
  const boxId = useId();
  // What's in the box, and the number Show last showed (typing alone changes nothing).
  const [text, setText] = useState(long.startRolled ?? '');
  const [shown, setShown] = useState(long.startRolled ?? '');
  const [at, setAt] = useState<string | null>(null);
  // A band tapped: scrolled to after the render that brought every row back, so its rows are there.
  const [jump, setJump] = useState<{ heading: string } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const reading = long.typed ? long.typed(shown) : { key: null, line: '' };
  const only = reading.key === null ? null : (long.ranges.flatMap((r) => r.rows).find((row) => row.key === reading.key) ?? null);
  const draw = rowOf ?? ((row: TableSheetRow) => <PickRow name={row.range ? `${row.range}: ${row.text}` : row.text} picked={row.picked} onPick={row.onPick} />);
  const everyRow = () => {
    setText('');
    setShown('');
  };
  useEffect(() => {
    if (!jump) return;
    scrollUnder(body.current?.querySelector(`[data-range="${jump.heading}"]`), strip.current);
  }, [jump]);
  // Opened with a pick: the sheet starts at the picked row (the folds used to open its group).
  useEffect(() => {
    scrollUnder(body.current?.querySelector('[data-picked]'), strip.current);
  }, []);
  const blockClass = `table-sheet__long${long.columns ? ' table-sheet__long--columns' : ''}`;
  return (
    <>
      {(long.typed || long.bar) && (
        <div ref={strip} className="table-sheet__bar">
          {long.typed && (
            <form
              className="table-typed"
              onSubmit={(event) => {
                event.preventDefault();
                setShown(text);
              }}
            >
              <label className="label" htmlFor={boxId}>
                What you rolled
              </label>
              {/* The box and Show stay together on one line; only the label may go above them (Large text). */}
              <span className="table-typed__entry">
                <input id={boxId} className="field__input table-typed__box" inputMode="numeric" autoComplete="off" maxLength={4} value={text} onChange={(event) => setText(event.target.value)} />
                <button type="submit" className="button-secondary button-secondary--small">
                  Show
                </button>
              </span>
            </form>
          )}
          {long.bar && (
            <ButtonRow
              label="Go to rows"
              options={long.ranges.map((r) => ({ value: r.heading, label: r.heading }))}
              value={at}
              onChange={(heading) => {
                setAt(heading);
                // Every row again, so the band is there to scroll to; the box empties.
                everyRow();
                setJump({ heading });
              }}
            />
          )}
        </div>
      )}
      {reading.line && (
        <p className="table-typed__line" role="status">
          {reading.line}
        </p>
      )}
      {head}
      <div ref={body}>
        {only ? (
          <>
            <div className="table-sheet__rows" role={role} aria-label={`${label}, the row for ${shown.trim()}`}>
              <Fragment key={only.key}>{draw(only)}</Fragment>
            </div>
            <button type="button" className="button-secondary table-typed__all" onClick={everyRow}>
              Show every row
            </button>
          </>
        ) : (
          long.ranges.map((range) => (
            <div
              key={range.heading}
              className={blockClass}
              data-range={long.bar ? range.heading : undefined}
              role={role}
              aria-label={long.bar ? `${label}, ${range.heading}` : label}
            >
              {range.rows.map((row) => (
                <div key={row.key} className="table-sheet__cell" data-picked={row.picked ? '' : undefined}>
                  {draw(row)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

/**
 * A table opened at creation (cs-1; mockup creation/11 "A, the table opened"; the shared table pattern): "Looks · roll
 * d4", the source, the table's own line, then its rows, range first, tapped (the Selected wash and Picked ✓). A name
 * table has one group per column (first name · surname), a cell tapped in each. The row is the tap. A table with a
 * die, or of 24 rows or more, is the **long variant** (`long`, m5b-long-tables, replacing R3-4b's folds of 25): the
 * typed roll, the range bar from 50 rows, both sticky, and two columns on a tablet from 24 (`LongRows`, which the
 * name sheet shares). Clear leaves it blank; Done (the sheet's one accent) closes.
 * The app never rolls.
 */
export function TableSheet({
  label,
  meta,
  lead,
  groups,
  long,
  roll,
  own,
  onClear,
  onDone,
  take,
  pick,
  head,
  rowOf,
  preview = false,
}: {
  label: string;
  meta?: string;
  lead?: string;
  /** A heading's `meta` beside it ("tap one" when left out; '' for none). */
  groups: { heading?: string; meta?: string; rows: TableSheetRow[] }[];
  /** The long variant: drawn in place of `groups`. */
  long?: LongTable;
  /** The Roll row over the rows (final drafts D): the die and the words. */
  roll?: { die: string; words: string };
  /**
   * The typed variant (final drafts D, a describing table): "Or type your own" at the foot, the player's words. With
   * `take`, the words are an answer like a row (cts-4, frame TS6): `marked` draws the box as the marked row (the
   * selected edge, bold and a tick), and `onMark` hears a tap in the box (cts-9: latest wins).
   */
  own?: { value: string; onChange: (text: string) => void; marked?: boolean; onMark?: () => void };
  /** Clear; left out, no Clear (a long table with nothing taken yet: the X takes nothing). */
  onClear?: () => void;
  onDone: () => void;
  /**
   * Mark and confirm (cs-15, picture creation/final 21-F4): a tap only marks a row and **Take it** at the foot takes
   * it, the accent once a row is marked; the X closes with nothing taken. Left out, Done and Clear as before.
   */
  take?: { marked: boolean; onTake: () => void };
  /**
   * The Pick table variant's foot (cts-1; frames TS2 to TS4), in place of Take it, Done and Clear: what is marked
   * (`foot`, two lines at most) and **Take these** at the right (**Take it** with `one`), staying in view while the rows scroll; the accent once
   * a row is marked, always a tap (`PickTableSheet`).
   */
  pick?: { foot: string; marked: boolean; onTake: () => void; /** A pick-up-to-1 table: the button reads Take it. */ one?: boolean };
  /** Over the rows, after the typed-roll strip (the book's table head, `BookTapHead`). */
  head?: ReactNode;
  /** Draws a row (the book's compact rows); a `PickRow` when left out. */
  rowOf?: (row: TableSheetRow) => ReactNode;
  /** Drawn in place (the component gallery). */
  preview?: boolean;
}) {
  const ownId = useId();
  const draw = rowOf ?? ((row: TableSheetRow) => <PickRow key={row.key} name={row.range ? `${row.range}: ${row.text}` : row.text} picked={row.picked} onPick={row.onPick} />);
  const rowsOf = (rows: TableSheetRow[]) => rows.map((row) => <Fragment key={row.key}>{draw(row)}</Fragment>);
  return (
    <Dialog label={label} meta={meta} onClose={onDone} table preview={preview}>
      {lead && <p className="entry-panel__lead">{lead}</p>}
      {roll && <RollRow die={dieOf(roll.die)}>{roll.words}</RollRow>}
      {long && <LongRows label={label} long={long} rowOf={rowOf} head={head} />}
      {!long && head}
      {(long ? [] : groups).map((group, n) =>
        group.heading ? (
          <PickGroup key={n} title={group.heading} meta={group.meta ?? 'tap one'}>
            {rowsOf(group.rows)}
          </PickGroup>
        ) : (
          <div key={n} className="table-sheet__rows" role="group" aria-label={label}>
            {rowsOf(group.rows)}
          </div>
        ),
      )}
      {own && (
        <div className={`field table-sheet__own${own.marked ? ' table-sheet__own--marked' : ''}`}>
          <label className="label" htmlFor={ownId}>
            Or type your own
          </label>
          <span className="table-sheet__own-box">
            {/* A tap or typing moves the mark to the words; focus alone doesn't (Tab passing through keeps a marked row). */}
            <input
              id={ownId}
              className="field__input"
              type="text"
              autoComplete="off"
              maxLength={200}
              value={own.value}
              onChange={(event) => own.onChange(event.target.value)}
              onClick={own.onMark}
              aria-describedby={own.marked ? `${ownId}-marked` : undefined}
            />
            {/* The marked row's tick, on the box when the words are the answer Take it takes (TS6). */}
            {own.marked && (
              <span className="row-check" aria-hidden="true">
                ✓
              </span>
            )}
            {own.marked && (
              <span id={`${ownId}-marked`} className="visually-hidden">
                Marked
              </span>
            )}
          </span>
        </div>
      )}
      {pick ? (
        <div className="table-sheet__pick-foot">
          <p className="table-sheet__pick-line" role="status">
            {pick.foot}
          </p>
          {/* Plain until a row is marked, and always a tap: with none marked it says so (cts-5 b). Take it on a
              pick-up-to-1 table (⚑ 5, Francis 20 Nov: "Take it"). */}
          <button type="button" className={pick.marked ? 'button-primary' : 'button-secondary'} onClick={pick.onTake}>
            {pick.one ? 'Take it' : 'Take these'}
          </button>
        </div>
      ) : (
      <div className="dialog__actions">
        {take ? (
          // Plain until a row is marked, and always a tap: with none marked it says so (cs-15).
          <button type="button" className={take.marked ? 'button-primary' : 'button-secondary'} onClick={take.onTake}>
            Take it
          </button>
        ) : (
          <button type="button" className="button-primary" onClick={onDone}>
            Done
          </button>
        )}
        {onClear && (
          <button type="button" className="button-secondary" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      )}
    </Dialog>
  );
}

const COUNT_WORDS = ['', 'once', 'twice', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** How many times, in words: "once", "twice", "three times" … "ten times", then "11 times". */
export function timesInWords(n: number): string {
  if (n === 1 || n === 2) return COUNT_WORDS[n]!;
  return `${n > 2 && n < COUNT_WORDS.length ? COUNT_WORDS[n] : n} times`;
}

/** One row of a Roll sequence step: what it says, whether it's the one tapped, and a plain note under it ("Already rolled"). */
export interface RollSequenceRow {
  key: string;
  text: string;
  /** A roll step's row: the die's numbers for it, in its own column of the book's table ("1–2"). */
  range?: string;
  picked: boolean;
  /**
   * Plain words under the row, beside its ✓ ("Already rolled" on a taken row of a distinct roll): information, so no
   * warning sign (06 rule 12; Design, gallery review of #555). The row stays a tap (it takes the roll off).
   */
  taken?: string;
  /**
   * How many times this row was rolled (R3-8 on the kit's rolls, retest 4 T3): past one the row shows one ✓ per time
   * (✓✓ for twice, no count in words; Francis's phone test, 2026-11-09), a screen reader hearing "… picked twice"
   * (Design on #574), and a − square beside it (`onPutBack`) puts one back.
   */
  times?: number;
  onPutBack?: () => void;
  onPick: () => void;
}

/**
 * The Roll sequence (Dialog variant; cw-11, Design's answer 3, 2026-11-06; mockup creation/12 §3): a kit's rolls one
 * step at a time. The head is the kit's name and ✕; under it "Step 2 of 4 · Armour · roll d6 at the table, tap what
 * you rolled"; the step's rows (a tap picks one); the foot a status line, Back and the accent Next ("Done" on the last
 * step). The caller keeps the steps and the taps; ✕, Escape and a tap outside call `onClose`. Wide: the whole screen on
 * a phone, a card on a tablet. `preview` draws it in place for the gallery.
 */
export function RollSequence({
  label,
  line,
  roll,
  table,
  rows,
  status,
  last,
  onBack,
  onNext,
  onClose,
  preview = false,
  choice = false,
}: {
  label: string;
  line: string;
  /** A roll step's Roll row (creation follow-up, 2026-11-07, final draft 5): the die and the words, under the line. */
  roll?: { die: string; words: string };
  /**
   * A roll step's table in the book's style (dec-10 F-a, picture creation/final 21-F3): its bar names what is rolled
   * ("Tools"), the head row the die over the column's word.
   */
  table?: { title: string; column: string };
  rows: readonly RollSequenceRow[];
  /**
   * A "Choose one" step: pick rows with Pick. Otherwise a roll step (Design, 2026-11-06): compact rows, the whole row
   * the target ("1–2 · Eel knife"), tapped once, then the Selected wash and ✓; no Pick button.
   */
  choice?: boolean;
  /** What's tapped, or what Next needs ("Tap what you rolled"). */
  status: string;
  last: boolean;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
  preview?: boolean;
}) {
  return (
    <Dialog label={label} onClose={onClose} wide table preview={preview}>
      <p className="roll-sequence__line">{line}</p>
      {roll && <RollRow die={dieOf(roll.die)}>{roll.words}</RollRow>}
      {choice ? (
        <div className="table-sheet__rows" role="group" aria-label={line}>
          {rows.map((row) => (
            <PickRow
              key={row.key}
              name={row.text}
              picked={row.picked}
              onPick={row.onPick}
              {...(row.taken ? { fit: [{ text: row.taken }] } : {})}
            />
          ))}
        </div>
      ) : table && roll ? (
        // The book's tapped table (21-F3): a row per number, the range in words, ✓ once a time (✓✓) and − to put one back.
        <BookTapTable
          title={table.title}
          die={roll.die}
          column={table.column}
          label={table.title}
          rows={rows.map((row) => ({ key: row.key, range: row.range ?? '', name: row.text, ...(row.taken ? { line: row.taken } : {}), picked: row.picked, ...(row.times ? { times: row.times } : {}), ...(row.onPutBack ? { onPutBack: row.onPutBack } : {}), onPick: row.onPick }))}
        />
      ) : (
        <div className="table-sheet__rows" role="radiogroup" aria-label={line}>
          {rows.map((row) =>
            (row.times ?? 0) > 1 ? (
              // Rolled more than once (R3-8, T3; phone test, 2026-11-09): one ✓ per time (✓✓), no count in words,
              // and − to put one back.
              <div key={row.key} className="roll-sequence__counted">
                <OptionRow
                  compact
                  name={row.text}
                  summary={row.taken ?? ''}
                  selected={row.picked}
                  checks={row.times}
                  // The count read aloud only (Design on #574): "3: Bog sling picked twice"; nothing drawn.
                  label={[`${row.text} picked ${timesInWords(row.times ?? 0)}`, row.taken].filter(Boolean).join(', ')}
                  onPick={row.onPick}
                />
                {row.onPutBack && (
                  <button type="button" className="button-secondary pick-row__less" aria-label={`Put back one ${row.text}`} onClick={row.onPutBack}>
                    <Icon name="minus" size={20} />
                  </button>
                )}
              </div>
            ) : (
              <OptionRow key={row.key} compact name={row.text} summary={row.taken ?? ''} selected={row.picked} onPick={row.onPick} />
            ),
          )}
        </div>
      )}
      <div className="roll-sequence__foot">
        <p className="roll-sequence__status" role="status" aria-label="Roll status">
          {status}
        </p>
        <div className="creation-step__actions">
          <button type="button" className="button-secondary creation-step__foot-back" onClick={onBack}>
            Back
          </button>
          <button type="button" className="button-primary creation-step__next" onClick={onNext}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** One of a kit's picks in its entry: the roll (its die, or none for a choice), what it gave, and its own Change. */
export interface RolledPick {
  key: string;
  /** The roll's die ("d6"); left out for a choice ("Reed whistle or Eel hooks"), which has no Roll row. */
  die?: string;
  /** The roll's name, for its Change ("Change Tools"). */
  name: string;
  title: string;
  /** What was rolled or chosen ("Eel knife, Bog sling"); left out before the kit is taken. */
  result?: string;
  /** Reopens the Roll sequence at this roll alone (Francis, retest 2); left out when it can't be changed here. */
  onChange?: () => void;
}

/**
 * A kit's rolled picks in its entry (Entry's part; Francis, retest 2, 2026-11-07): under "Rolled at the table", each
 * roll with its Roll row (the die's glyph), what it gave, and its own **Change**, which reopens the sequence at that
 * roll only. Nothing to list: nothing drawn.
 */
export function RolledPicks({ label, picks }: { label: string; picks: readonly RolledPick[] }) {
  const id = useId();
  if (picks.length === 0) return null;
  return (
    <div className="rolled-picks" role="group" aria-labelledby={id}>
      <h3 id={id} className="rolled-picks__head">
        {label}
      </h3>
      {picks.map((pick) => (
        <div key={pick.key} className="rolled-picks__row">
          <div className="rolled-picks__text">
            {pick.die !== undefined ? <RollRow die={dieOf(pick.die)}>{pick.title}</RollRow> : <p className="rolled-picks__title">{pick.title}</p>}
            {pick.result !== undefined && <p className="rolled-picks__result">{pick.result}</p>}
          </div>
          {pick.onChange && (
            <button type="button" className="button-secondary button-secondary--small" aria-label={`Change ${pick.name}`} onClick={pick.onChange}>
              Change
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** A Detail row's "Roll d12" with the die's glyph before it (S1); the words alone for a die the app doesn't draw. */
function rollAction(roll: string | undefined): ReactNode {
  if (!roll) return null;
  const die = dieOf(roll);
  return (
    <>
      {die && <DieGlyph die={die} size={20} />}
      {roll}
    </>
  );
}

/**
 * A row on the Details step (cs-1; mockup creation/11): the table's short name, then what was tapped with Change, or
 * "Roll d12" while it's blank. The whole row opens the table (44 px and more); the words say which state it's in.
 * Its **open** variant (`action`, cw-11: a name table on Who they are) has no value: the table's name, its line, and
 * the action's word ("Open").
 */
export function DetailRow({
  label,
  note,
  value,
  roll,
  action,
  onOpen,
  picked = false,
  twoLines = false,
}: {
  label: string;
  note?: string;
  value?: string;
  roll?: string;
  action?: string;
  onOpen: () => void;
  /**
   * The one-row variant (Francis via Design, 2026-11-06; mockup creation/13): once picked, the row is only the picked
   * entry (its words as the row's name, the table's name and note under it) with Change; before, the table's row.
   */
  picked?: boolean;
  /**
   * The **pick table** variant (cts-3; frame TS1): with `action` ("Open", then "Change"), the note is what was taken by
   * name, kept to two lines on screen, then "…" (said whole aloud); plain words, no dice glyphs (a thing's name is not a
   * roll). No chevron: the row opens a sheet.
   */
  twoLines?: boolean;
}) {
  const named = note ? `${label} (${note})` : label;
  if (action) {
    return (
      <button type="button" className="detail-row detail-row--open" onClick={onOpen} aria-label={`${action} ${named}`}>
        <span className="detail-row__label">
          {label}
          {note &&
            (twoLines ? (
              <span className="detail-row__note detail-row__note--two-lines">{note}</span>
            ) : (
              <span className="detail-row__note">
                <DiceWords>{note}</DiceWords>
              </span>
            ))}
        </span>
        <span className="detail-row__action">{action}</span>
      </button>
    );
  }
  if (picked && value) {
    return (
      <button type="button" className="detail-row" onClick={onOpen} aria-label={`${named}: ${value}. Change`}>
        <span className="detail-row__label detail-row__label--picked">
          {value}
          <span className="detail-row__note">{note ? `${label}, ${note}` : label}</span>
        </span>
        <span className="detail-row__action">Change</span>
      </button>
    );
  }
  return (
    // Every row alike, the first ("Face") too (after-test A8): the label, the value or a dash under it, the button at the right.
    <button type="button" className="detail-row" onClick={onOpen} aria-label={value ? `${named}: ${value}. Change` : `${named}: ${roll ?? ''}`}>
      <span className="detail-row__text">
        <span className="detail-row__label">
          {label}
          {note && (
            <span className="detail-row__note">
              <DiceWords>{note}</DiceWords>
            </span>
          )}
        </span>
        <span className={value ? 'detail-row__value' : 'detail-row__value detail-row__value--blank'}>{value || '—'}</span>
      </span>
      {/* The roll's die beside its words (retest 4 S1: every roll with its glyph; a kindred's or class's table row). */}
      <span className="detail-row__action">{value ? 'Change' : rollAction(roll)}</span>
    </button>
  );
}
