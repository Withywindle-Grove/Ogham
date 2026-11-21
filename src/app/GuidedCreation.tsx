// Guided character creation, the first steps, rebuilt on the creation step shell (M5b step 0c, slice 2;
// design/rulings/m5b-0c-creation-rebuild-2026-11-01.md cr-1 … cr-11; docs/05 "Guided creation, rebuilt"; mockups
// creation/00–03): Method (only when the player has a path to choose), Scores (tiles from the dice average), Race and
// Class (pick rows with fit lines, the scores strip, the entry's full rules with Pick / Unpick, the folded "Not open
// to …" group), Adjust scores (the rule's buttons, the bank, Undo per trade; absent without the rule as data). Back
// keeps every value; Next checks and says what's wrong, never disabled. The app never rolls: scores are rolled at
// the table and typed in. What's chosen then fills "Who are they?" (Characters.tsx).
import { packAndPage } from '../modules/library/sourceTitles.ts';
import { stackOrder } from '../modules/library/stack.ts';
import { alphabetical } from '../modules/characters/creationOrder.ts';
import { useEffect, useId, useRef, useState } from 'react';
import { abilityDescription, abilityKeys, abilityNote, classesFor, classKindredId, creationMethods, defaultRace, kindredOf, methodsToPick, offeredToKindred, raceAsPlayed, raceStep, readScore, withRace, type CreationMethod } from '../modules/characters/creation.ts';
import { adjustmentRule, scoresRule, startOverTriggered } from '../modules/characters/creationRules.ts';
import {
  adjustLead,
  adjustProblem,
  ASK_GM_NOTE,
  closedClassNote,
  whyNotOpen,
  adjustStepExists,
  adjustTileWords,
  APP_HELP,
  bankOf,
  canLower,
  canRaise,
  classFit,
  classHeadings,
  keptLine,
  methodHint,
  methodLeavesOut,
  modifierWords,
  pickProblem,
  primesOf,
  primeXpBands,
  primeXpLine,
  raceHeadings,
  requirementFit,
  scoresProblem,
  specialApprovalOf,
  SPECIAL_NOTE,
  STEP_TITLES,
  thresholdLine,
  tradeableScores,
  tradeChips,
  tradedScores,
  tradesHint,
  tradeToast,
  loweredToast,
  withoutChip,
  type Fit,
  type SpecialApproval,
  type Trade,
} from '../modules/characters/creationSteps.ts';
import { APP_WHY, blurbOf, descriptionOf, scoresWhy, stepGuide, stepTitle, type GuideStep } from '../modules/characters/creationGuide.ts';
import { scoreRange } from '../modules/library/fills.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { namesakeSource } from '../modules/library/namesakes.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { classLevelTable, classXpTable } from '../modules/characters/startingXp.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { dieOf, RollRow } from '../ui/dice.tsx';
import { forgetKept, keepPicks, type KeptPicks } from './keptCreation.ts';
import { useBackWord, useCreationLeave, useLeaveWord } from '../ui/creation.tsx';
import { Note, WarningLine } from '../ui/parts.tsx';
import { AdjustTile, ApprovalFold, BookTable, CreationStep, EntryPanel, PickRow, PrimeXpTable, ScoresStrip, ScoreTile, ScoreTiles, StartOverCallout, TradeChips } from '../ui/creation.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { choiceInPlay, groupChoice, type CampaignSetting } from './campaignSetting.ts';
import { offeredPatronApproval, patronClosedEntry, patronClosedPickLine, patronEntry, patronFitTo, patronNotOpen, patronRowLine, patronsFor } from '../modules/characters/patrons.ts';
import { useCreationSplit } from './useWide.ts';

export interface GuidedChoice {
  method: string | null;
  race: ResolvedEntry | null;
  klass: ResolvedEntry;
  /** As rolled at the table. */
  rolled: Record<string, number>;
  /** After the race's changes and the player's trades. */
  scores: Record<string, number>;
  /** Kept for older records; the rebuilt steps never ask it. */
  reason?: string;
  /** Picks whose requirement isn't met (ruled 2026-11-02): kept on the creation record for the GM's approval view. */
  special?: SpecialApproval[];
  /**
   * The scores left at the dice average, never touched (final drafts A5, slice B): the review and the GM's card say
   * "the average, not rolled". A flag per score, never a comparison of values.
   */
  scoresAverage?: string[];
  /**
   * The patron picked on the Patron step (the #636 rework, pt-10, 2026-11-12): for a class a patron in play names;
   * null for none (a class with none, or not picked yet). Absent on older records.
   */
  patron?: { id: string; name: string } | null;
  /** The patron put off with Decide later (the lead's ruling A, 2026-11-11): "patron" goes on the To finish list. */
  patronLater?: boolean;
}

export type GuidedStep = 'method' | 'scores' | 'race' | 'class' | 'patron' | 'adjust';
type Step = GuidedStep;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The creation methods the player picks among (one or none means no method step). */
function methodsOf(setting: CampaignSetting): CreationMethod[] {
  // The creation-method group's winner (one choice per ruleKey group, 07), not the first pack found.
  const winner = groupChoice(setting, 'creation-method');
  const methods = creationMethods(
    setting.all.filter((e) => e.kind === 'option' && (!winner || (e.packEntryId === winner.optionId && e.packId === winner.packId))),
    (optionId) => (winner && optionId === winner.optionId ? winner.choiceId : choiceInPlay(setting, optionId)),
  );
  return methodsToPick(methods);
}

/**
 * How many steps guided creation's first part has for this character: the method only when there's a choice, the
 * scores, the race only when the method asks for one, the class, and Adjust scores only when it showed for this
 * character: the setting has the trade as data and the class and scores leave a trade to make (cr-3, cr-11). Counting
 * Adjust from the rule alone numbered the steps after it past one that never showed (gate walk 2026-11-05).
 */
export function guidedStepCount(setting: CampaignSetting, choice: GuidedChoice | null, alignmentNames: readonly string[] = []): number {
  const picks = methodsOf(setting);
  const method = picks.find((m) => m.id === choice?.method) ?? (picks.length === 1 ? picks[0]! : null);
  const races = entriesInPlay(setting.all).filter((e) => e.kind === 'race');
  const mode = raceStep(method, races, defaultRace(setting.rulesSets, races) !== null);
  return (picks.length > 1 ? 1 : 0) + 1 + (mode === 'none' ? 0 : 1) + 1 + (choice && patronStepShown(setting, choice.klass.packEntryId, alignmentNames) ? 1 : 0) + (adjustShown(setting, choice) ? 1 : 0);
}

/** The class's alignment limit crossed with its patrons (fix-patron-class-alignment), with the campaign's alignment names (Who they are's rows). */
export const patronFitOf = (setting: CampaignSetting, classId: string, alignmentNames: readonly string[] = []) =>
  patronFitTo(setting.all.find((e) => e.kind === 'class' && e.packEntryId === classId)?.data, alignmentNames);

/**
 * The patrons a class is offered (pt-10): those in play whose followers name it, with their pack when two share a name,
 * each with how it sits with the class's alignment limit (fix-patron-class-alignment: ok, soft or closed).
 */
export const patronsOffered = (setting: CampaignSetting, classId: string, alignmentNames: readonly string[] = []) =>
  patronsFor(setting.all.filter((e) => e.kind === 'patron'), classId, setting.packs, patronFitOf(setting, classId, alignmentNames));

/**
 * Whether the Patron step shows for a class (pt-10, mockup creation/final/14-08): straight after Class, only when a
 * patron in play names the class among its followers and the class may follow it (one its alignment limit closes
 * doesn't count: fix-patron-class-alignment). Without one (a class no patron names, every patron's option off, or every
 * patron closed to it) there is no step, no count for it and nothing marking its absence.
 */
export const patronStepShown = (setting: CampaignSetting, classId: string, alignmentNames: readonly string[] = []): boolean => patronsOffered(setting, classId, alignmentNames).some((o) => o.fit !== 'closed');

/** "A Marsh Chaplain follows a patron." (14-05): the class's own name, with a or an. */
const aClass = (name: string) => `${/^[aeiou]/i.test(name.trim()) ? 'An' : 'A'} ${name.trim()}`;

/**
 * Whether the Adjust scores step counts for this choice (cr-3): the rule as data, and a trade the class and the scores
 * (as rolled, with the kindred's changes) leave open. Before the class is picked it may show, so it counts.
 */
export function adjustShown(setting: CampaignSetting, choice: GuidedChoice | null): boolean {
  const rule = adjustmentRule(setting.rulesSets);
  if (!rule) return false;
  if (!choice) return true;
  return adjustStepExists(rule, choice.klass, abilityKeys(setting.rulesSets), withRace(choice.rolled, raceAsPlayed(choice.race, choice.klass)), (key) => key);
}

/** The chosen choice of an option, as the campaign set it (else the option's default). */
const optionChoice = (setting: CampaignSetting, optionId: string): string | undefined => choiceInPlay(setting, optionId);

/**
 * Whether a rule gated by an option applies (a start-over or re-roll rule's `option`, read from the pack): on unless
 * the campaign's choice (else the default) is off, no or false; an option the campaign doesn't have counts as on.
 */
export function optionOn(setting: CampaignSetting, optionId: string): boolean {
  return !['off', 'no', 'false'].includes(String(optionChoice(setting, optionId) ?? 'on').toLowerCase());
}

export function GuidedCreation({
  setting,
  labels,
  names,
  onDone,
  onBack,
  backOnFirst = false,
  keep,
  kept,
  reviewBack = false,
  resume,
  stepsAfter = 0,
  stepsAfterFor,
  finishOnPick = true,
  alignmentNames = [],
}: {
  setting: CampaignSetting;
  /**
   * The names of the alignment rows Who they are offers (the campaign's alignment field, else the setting's list): the
   * Patron step crosses each patron's followers with the class's alignment limit against them (fix-patron-class-alignment).
   */
  alignmentNames?: readonly string[];
  /** A friendly name for an ability key (from the campaign's fields), when there is one. */
  labels: (key: string) => string | undefined;
  /** An ability's full name (cw-11: shown on the Scores step), when there is one; else the short name. */
  names?: (key: string) => string | undefined;
  /** `picked`: the class's Pick ended these steps (ct-1, Pick → Next); the caller says so with Undo. */
  onDone: (choice: GuidedChoice, picked?: boolean) => void;
  onBack: () => void;
  /** Back in the foot on the first of these steps too (a redo from the review: its Back returns there; cw-11). */
  backOnFirst?: boolean;
  /** A redo from the review (cw-11): Back on the step it opened on, with nothing changed, returns there (`onBack`). */
  reviewBack?: boolean;
  /**
   * Whose picks Leave keeps on this device (cw-13): the signed-in player and the campaign. Left out (a redo from the
   * review: the draft holds them), Leave keeps nothing. Reaching Who they are forgets them.
   */
  keep?: { userId: string; campaignId: string };
  /** Picks kept from an earlier Leave (Continue where you left off): every value back, editable. */
  kept?: KeptPicks | null;
  /**
   * Back from "Who are they?" (the adjustments) or Change beside the class (the class), with what was chosen.
   * `unpick`: the Undo of a class Pick that moved on (ct-1): the class step again, nothing picked on it.
   */
  resume?: { choice: GuidedChoice; step: GuidedStep; unpick?: boolean };
  /** How many steps come after these (Who are they?, gear, languages…, the review), before a class is picked: the Method hint's count. */
  stepsAfter?: number;
  /**
   * How many steps come after these for a choice (its class decides the later steps): the counter's total from the
   * step after the class pick (ruled B 2026-11-05). Without it, `stepsAfter`.
   */
  stepsAfterFor?: (choice: GuidedChoice) => number;
  /**
   * Whether a Pick on the last of these steps ends them (ct-1). Off for a redo from the review (cf-7), whose end writes
   * the change: there the step stays until Next.
   */
  finishOnPick?: boolean;
}) {
  const id = useId();
  // The entry beside the list from 700 px (final drafts A10).
  const wide = useCreationSplit();
  const toast = useToast();
  const picks = methodsOf(setting);
  const races = entriesInPlay(setting.all).filter((e) => e.kind === 'race');
  // The packs in stack order: between two rows of one name on Kindred and Class, the higher pack's first (cs-38).
  const packOrder = stackOrder(setting.packs).map((p) => p.packId);
  // A class gated by an optional rule that's off isn't offered at all (kindred-as-class classes; ct-10; of-3).
  const everyClass = setting.all.filter((e) => e.kind === 'class');
  const classes = entriesInPlay(everyClass);
  const keys = abilityKeys(setting.rulesSets);
  const rule = scoresRule(setting.rulesSets);
  const adjust = adjustmentRule(setting.rulesSets);
  const label = (key: string) => labels(key) ?? key;
  const fullName = (key: string) => names?.(key) ?? label(key);
  // A class's level table in its entry (dec-10 C, cs-16): its titles, its own pack's experience and its hit dice by
  // level, in the book's table style; nothing when the class carries none of them.
  const levelTableOf = (k: ResolvedEntry) => {
    const table = classLevelTable(k.data, classXpTable(k, setting.xpTables ?? [], setting.packs));
    return table ? <BookTable title={`${k.name} by level`} head={table.head} rows={table.rows} wordsColumn={table.head.indexOf('Title')} /> : undefined;
  };

  // Picks kept on this device from an earlier Leave (cw-13), read once: a pick the packs no longer have is dropped, and
  // the walk lands on its step, which says so.
  const [restored] = useState(() => (!resume && kept ? restoreKept(kept, picks, races, classes, setting.rulesSets, !!adjust) : null));
  // Back from "Who are they?" lands on the adjustments, or on the class when the setting has no trade as data.
  const [stepAsked, setStep] = useState<Step>(restored ? restored.step : resume ? resumedStep(resume, setting, !!adjust, alignmentNames) : picks.length > 1 ? 'method' : 'scores');
  const [method, setMethod] = useState<CreationMethod | null>(restored ? restored.method : ((resume && picks.find((m) => m.id === resume.choice.method)) ?? (picks.length === 1 ? picks[0]! : null)));
  // The tiles start at the dice average (cr-9); a resumed character shows what was typed.
  const [typed, setTyped] = useState<Record<string, string>>(() =>
    restored
      ? { ...Object.fromEntries(keys.map((k) => [k, rule ? String(rule.average) : ''])), ...restored.typed }
      : resume
        ? Object.fromEntries(Object.entries(resume.choice.rolled).map(([k, v]) => [k, String(v)]))
        : Object.fromEntries(keys.map((k) => [k, rule ? String(rule.average) : ''])),
  );
  // Which scores the player has touched (final drafts A5): any step or typing, for good, even back to the average.
  // Untouched, a tile shows the average in the lighter weight with its line. A resumed character's record says which
  // were left at the average (`scoresAverage`); one without the list was rolled throughout.
  const [touched, setTouched] = useState<string[]>(() =>
    restored ? (restored.touched ?? keys) : resume ? keys.filter((k) => !(resume.choice.scoresAverage ?? []).includes(k)) : [],
  );
  const touch = (key: string) => setTouched((was) => (was.includes(key) ? was : [...was, key]));
  // The kindred picked on the Kindred step; on the kindred-as-class path there is none (the class sets it, cs-4).
  const [race, setRace] = useState<ResolvedEntry | null>(() => {
    if (restored) return restored.race;
    const resumed = (resume && picks.find((m) => m.id === resume.choice.method)) ?? (picks.length === 1 ? picks[0]! : null);
    return resume && raceStep(resumed, races, defaultRace(setting.rulesSets, races) !== null) !== 'none' ? resume.choice.race : null;
  });
  const [klass, setKlass] = useState<ResolvedEntry | null>(restored ? restored.klass : resume && !resume.unpick ? resume.choice.klass : null);
  // A class opened from a race's Open classes chip (ct-2): its entry, to read only.
  const [chipClass, setChipClass] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>(() => (restored ? restored.trades : resume && adjust ? tradesFrom(resume.choice, adjust, race !== null) : []));
  // The patron (pt-10): picked on its own step after Class, by id; put off with Decide later; the class it was picked
  // under (a change of class clears it, mockup 14-07); the one whose entry is open; the pop-up of Next with none (14-05).
  const [patronId, setPatronId] = useState<string | null>(restored ? (restored.patron?.id ?? null) : (resume?.choice.patron?.id ?? null));
  const [patronLater, setPatronLater] = useState<boolean>(restored ? restored.patronLater : !!resume?.choice.patronLater);
  const [patronClass, setPatronClass] = useState<string | null>(restored ? (restored.klass?.packEntryId ?? null) : (resume?.choice.klass.packEntryId ?? null));
  const [patronOpen, setPatronOpen] = useState<string | null>(null);
  const [patronAsk, setPatronAsk] = useState(false);
  /**
   * The patron's part of the choice for a class (pt-10): the one picked while the class is offered it, else null, and
   * Decide later only while none is. `later` overrides the state (Decide later's own tap, before the state is read again).
   */
  function patronOf(c: ResolvedEntry, later = patronLater): Pick<GuidedChoice, 'patron' | 'patronLater'> {
    const offered = patronsOffered(setting, c.packEntryId, alignmentNames);
    const picked = offered.find((o) => o.patron.id === patronId)?.patron ?? null;
    return { patron: picked ? { id: picked.id, name: picked.name } : null, ...(!picked && offered.some((o) => o.fit !== 'closed') && later ? { patronLater: true } : {}) };
  }
  /** The patron as Leave keeps it on the device (cw-13). */
  function keptPatron(): Pick<KeptPicks, 'patron' | 'patronLater'> {
    const picked = klass ? patronsOffered(setting, klass.packEntryId, alignmentNames).find((o) => o.patron.id === patronId)?.patron : undefined;
    return { patron: picked ? { id: picked.id, name: picked.name } : null, patronLater };
  }
  // What a kept pick the packs dropped says on its step's status line (cw-13), until something is picked there.
  const notice = restored?.notice ?? null;
  const hostLeave = useCreationLeave();
  /** Leave (cw-13): the picks so far stay on this device, keyed by player and campaign; then out, as the host says. */
  const leaveHere = keep
    ? () => {
        const saved = keepPicks(keep.userId, keep.campaignId, {
          step,
          method: method?.id ?? null,
          typed,
          race: race ? { id: race.packEntryId, name: race.name } : null,
          klass: klass ? { id: klass.packEntryId, name: klass.name } : null,
          trades,
          touched,
          ...keptPatron(),
        });
        if (saved) toast({ text: 'Kept on this device. Pick it up again from Create.' });
        hostLeave?.();
      }
    : undefined;
  /** On to Who they are: the draft takes over, so the kept picks go (cw-13), and no later pick is kept again (A12). */
  const finished = useRef(false);
  const done = (choice: GuidedChoice, picked?: boolean) => {
    finished.current = true;
    if (keep) forgetKept(keep.userId, keep.campaignId);
    onDone(choice, picked);
  };
  // The entry whose full rules are open (a panel beside the list, or a sheet).
  const [opened, setOpened] = useState<string | null>(null);
  // The start-over callout, once answered with Keep them.
  const [keptWeak, setKeptWeak] = useState(false);
  // Changing the class away from a kindred-class reopens the Kindred step once (cs-4): its traits are back.
  const [kindredReopened, setKindredReopened] = useState(false);
  // The ability whose name was tapped on Scores (cw-11): what it does, then what its number does.
  const [explained, setExplained] = useState<string | null>(null);

  const rolled = Object.fromEntries(keys.flatMap((k) => (readScore(typed[k] ?? '') === null ? [] : [[k, readScore(typed[k]!)!]])));
  const usual = defaultRace(setting.rulesSets, races);
  const raceMode = raceStep(method, races, usual !== null);
  // A step with nothing to ask is skipped, never shown empty (mockup creation/13): Scores when the setting lists no
  // ability scores goes straight on to the Kindred step (or the Class), and Back from there skips it too.
  const noScores = keys.length === 0;
  const step: Step = stepAsked === 'scores' && noScores ? (raceMode === 'none' ? 'class' : 'race') : stepAsked;
  // Every pick before Who they are is kept on this device as it's made (after-test A12), not only on Leave: an app
  // update, a closed tab or a flat battery loses nothing. The opening state isn't kept (nothing picked yet); reaching
  // Who they are forgets them (done, above). Compared by value, so a double mount (React's strict mode) keeps nothing.
  const openedAs = useRef<string | null>(null);
  // Something is kept on this device (a pick made here, or picks continued from before): creation's ⋯ then reads
  // "Save and leave", else "Leave" (final draft 9).
  const pickedNow = JSON.stringify({ step, method: method?.id ?? null, typed, race: race?.packEntryId ?? null, klass: klass?.packEntryId ?? null, trades, touched, patronId, patronLater });
  const [pickedAtOpen] = useState(pickedNow);
  const keptHere = !!restored || pickedNow !== pickedAtOpen;
  useLeaveWord(keep && keptHere ? 'Save and leave' : 'Leave');
  const keepUser = keep?.userId;
  const keepCampaign = keep?.campaignId;
  useEffect(() => {
    if (!keepUser || !keepCampaign || finished.current) return;
    const now: KeptPicks = {
      step,
      method: method?.id ?? null,
      typed,
      race: race ? { id: race.packEntryId, name: race.name } : null,
      klass: klass ? { id: klass.packEntryId, name: klass.name } : null,
      trades,
      touched,
      ...keptPatron(),
    };
    const said = JSON.stringify(now);
    if (openedAs.current === null) openedAs.current = said;
    if (said === openedAs.current) return;
    keepPicks(keepUser, keepCampaign, now);
    // keptPatron reads the patron's state, listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepUser, keepCampaign, step, method, typed, race, klass, trades, touched, patronId, patronLater]);
  const toScores = () => (!noScores ? setStep('scores') : picks.length > 1 ? setStep('method') : onBack());
  // "Fen rules · p. 12": the pack's short name and the entry's page (cr-1: source and page on every row).
  const sourceOf = (entry: ResolvedEntry) => {
    const pack = setting.packs.find((p) => p.packId === entry.packId);
    const page = typeof entry.data.source === 'string' ? entry.data.source.trim() : '';
    // The page alone when it names its book already (07 meta.sourceTitles, retest 4 T6).
    return packAndPage(pack?.shortName ?? pack?.name ?? '', page, pack?.sourceTitles);
  };
  // "From Fen rules" under a race's or class's name, only when another pack has one of the same name (sn-1, plan dec-1 1d).
  const fromOf = namesakeSource(entriesInPlay(setting.all), (packId) => {
    const pack = setting.packs.find((p) => p.packId === packId);
    return pack?.shortName ?? pack?.name ?? '';
  }, setting.packs);
  const classNameOf = (packEntryId: string) => everyClass.find((c) => c.packEntryId === packEntryId)?.name;
  const classOffered = (packEntryId: string) => !everyClass.some((c) => c.packEntryId === packEntryId) || classes.some((c) => c.packEntryId === packEntryId);
  // The scores after the kindred's changes, as the class plays the kindred (a kindred-class replaces them, cs-4).
  const afterRace = withRace(rolled, raceAsPlayed(race, klass));
  const scoresWith = (c: ResolvedEntry) => withRace(rolled, raceAsPlayed(race, c));
  // The kindred the character has (cs-4): a kindred-class sets its own.
  const kindredWith = (c: ResolvedEntry) => kindredOf(c.data, race, races);
  const scores = adjust ? tradedScores(afterRace, trades, adjust) : afterRace;
  // A redo from the review (cw-11): the step it opened on and what was chosen then. Back there with nothing changed
  // goes back to the review (Kindred and Class each have their own Change, Design 2026-11-06); anything changed, or
  // another step: the step before, as usual.
  const now = JSON.stringify([method?.id ?? null, typed, race?.packEntryId ?? null, klass?.packEntryId ?? null, trades, touched, patronId, patronLater]);
  const [opened0] = useState({ step, now });
  const toReview = reviewBack && now === opened0.now && step === opened0.step;
  const back = (before: () => void) => () => (toReview ? onBack() : before());
  // Back from that step says where it goes (P22, 2026-11-06).
  useBackWord(toReview ? 'Back to review' : null);

  // The step counter counts only this character's steps (cr-3).
  // Adjust scores: counted while the class isn't picked yet (it may show), then only when the class leaves a trade.
  const adjustCounted = !!adjust && (!klass || adjustStepExists(adjust, klass, keys, afterRace, label));
  // The Patron step (pt-10): straight after Class, counted once the class picked is offered a patron.
  const patronCounted = (!!klass && patronStepShown(setting, klass.packEntryId, alignmentNames)) || step === 'patron';
  const mine: Step[] = [...(picks.length > 1 ? (['method'] as const) : []), ...(noScores ? [] : (['scores'] as const)), ...(raceMode === 'none' ? [] : (['race'] as const)), 'class', ...(patronCounted ? (['patron'] as const) : []), ...(adjustCounted || step === 'adjust' ? (['adjust'] as const) : [])];
  // No total until the class is picked (ruled B 2026-11-05): "Step 3" on Class; from the step after the pick (Adjust
  // scores here, else Who they are) "Step 4 of N", N worked out for the class picked.
  const after = (c: ResolvedEntry) => (stepsAfterFor ? stepsAfterFor({ method: method?.id ?? null, race: kindredWith(c), klass: c, rolled, scores: scoresWith(c), ...patronOf(c) }) : stepsAfter);
  const counter = { at: mine.indexOf(step) + 1, of: (step === 'adjust' || step === 'patron') && klass ? mine.length + after(klass) : null };
  const guideOf = (key: GuideStep | 'adjust') => {
    const guide = stepGuide(setting.rulesSets, key);
    return { why: guide.why, help: guide.help ?? APP_HELP[key] ?? null };
  };
  const optionData = (methodId: string) => setting.all.find((e) => e.kind === 'option' && e.packEntryId === methodId)?.data ?? {};

  /** The picks flagged for the GM (ruled 2026-11-02): a race or class whose requirement the scores don't meet. */
  const specials = (): SpecialApproval[] =>
    [
      race && specialApprovalOf('race', race, requirementFit(race, rolled, fullName)),
      klass && specialApprovalOf('class', klass, classFit(klass, race, method, afterRace, setting.rulesSets, fullName)),
      // A patron marked for the GM (`approval: "gm"`), or outside a soft alignment limit (fix-patron-class-alignment): flagged, from the Patron step (pt-10).
      klass && offeredPatronApproval(patronsOffered(setting, klass.packEntryId, alignmentNames).find((o) => o.patron.id === patronId), patronFitOf(setting, klass.packEntryId, alignmentNames), klass.name.toLowerCase()),
    ].filter((s): s is SpecialApproval => !!s);
  // The scores left at the average (A5): on the record, so the review and the GM's card can say so.
  const averaged = () => {
    const left = keys.filter((k) => !touched.includes(k));
    return left.length > 0 ? { scoresAverage: left } : {};
  };
  const finish = (withTrades: Trade[], later = patronLater) => klass && done({ method: method?.id ?? null, race: kindredWith(klass), klass, rolled, scores: adjust ? tradedScores(afterRace, withTrades, adjust) : afterRace, special: specials(), ...averaged(), ...patronOf(klass, later) });
  /**
   * Whether this class, picked on a redo, moves the player back to the Kindred step first (cs-4): the class it replaces
   * was a kindred-class and this one isn't, on a path with a Kindred step, not yet reopened.
   */
  const reopensKindred = (c: ResolvedEntry) => !!resume && !kindredReopened && raceMode !== 'none' && !!classKindredId(resume.choice.klass.data) && !classKindredId(c.data);
  const reopenKindred = (c: ResolvedEntry) => {
    setKindredReopened(true);
    setStep('race');
    toast({ text: `${c.name} picked. Your kindred’s own traits are back: check your kindred, then Next.` });
  };
  /** "Bog folk picked · Undo" (ct-1): the toast after a Pick moved on; its Undo returns to the step with the pick undone. */
  const pickedToast = (name: string, special: boolean, undo: () => void) => toast({ text: `${name} picked${special ? ': needs the GM’s special approval' : ''}`, onUndo: undo });

  // Method (cr-8): only with a player-chosen path; the hint says how many steps the pick gives; no Decide later.
  if (step === 'method') {
    const stepsWith = (m: CreationMethod) => {
      const mode = raceStep(m, races, usual !== null);
      return 1 + 1 + (mode === 'none' ? 0 : 1) + 1 + (adjustCounted ? 1 : 0) + stepsAfter;
    };
    const guide = guideOf('method');
    return (
      <CreationStep
        onLeave={leaveHere}
        title={stepTitle(setting.rulesSets, 'method', STEP_TITLES.method)}
        counter={counter}
        why={guide.why}
        help={guide.help}
        helpChoices={picks.map((m) => ({ name: m.name, blurb: blurbOf(optionData(m.id)) }))}
        onBack={onBack}
        backOnFirst={backOnFirst}
        hint={methodHint(method, method ? stepsWith(method) : 0)}
        onNext={() => (method ? setStep('scores') : toast({ text: 'Pick one first.' }))}
      >
        <div role="group" aria-label="Methods">
          {picks.map((m) => {
            const option = setting.all.find((e) => e.kind === 'option' && e.packEntryId === m.id);
            const isOpen = opened === m.id;
            return (
              <div key={m.id}>
                <PickRow
                  name={m.name}
                  blurb={blurbOf(optionData(m.id))}
                  // A method that leaves classes out says so before it is picked (dec-10 B, cs-6).
                  fit={[{ text: `about ${stepsWith(m)} steps` }, ...((leaves) => (leaves ? [{ text: leaves, warn: true }] : []))(methodLeavesOut(m, classes))]}
                  source={option ? sourceOf(option) : undefined}
                  picked={method?.id === m.id}
                  onPick={() => setMethod(method?.id === m.id ? null : m)}
                  onOpen={() => setOpened(isOpen ? null : m.id)}
                />
                {isOpen && (
                  <EntryPanel
                    name={m.name}
                    meta={option ? sourceOf(option) : undefined}
                    headings={[{ label: 'What it means', text: typeof optionData(m.id).notes === 'string' ? String(optionData(m.id).notes) : blurbOf(optionData(m.id)) || `${stepsWith(m)} steps.` }]}
                    picked={method?.id === m.id}
                    onPick={() => {
                      setMethod(method?.id === m.id ? null : m);
                      setOpened(null);
                    }}
                    onClose={() => setOpened(null)}
                    asSheet
                  />
                )}
              </div>
            );
          })}
        </div>
      </CreationStep>
    );
  }

  // Scores (cr-9): tiles from the dice average, the modifier and what it affects live, the start-over rule offered.
  if (step === 'scores') {
    const guide = guideOf('scores');
    const values = Object.fromEntries(keys.map((k) => [k, readScore(typed[k] ?? '')]));
    const problem = scoresProblem(keys, values, rule, fullName, (k) => scoreRange(setting.rulesSets, k));
    const entered = keys.filter((k) => values[k] !== null).length;
    const weak = !keptWeak && entered === keys.length && keys.length > 0 && startOverTriggered(rule, rolled, (optionId) => optionOn(setting, optionId));
    const stepBy = (key: string, by: 1 | -1) => {
      const now = readScore(typed[key] ?? '') ?? rule?.average ?? 10;
      touch(key);
      setTyped({ ...typed, [key]: String(Math.max(1, Math.min(99, now + by))) });
    };
    const rolledCount = keys.filter((k) => touched.includes(k)).length;
    // What a number changes (cw-11): the modifier's words; blank where the setting's table gives none at that number
    // (P4, 2026-11-06: the "No change" label is dropped, on a tablet tile as on a phone row).
    const wordsOf = (key: string) => modifierWords(setting.rulesSets, key, values[key] ?? null);
    const explainedKey = explained && keys.includes(explained) ? explained : null;
    return (
      <CreationStep
        onLeave={leaveHere}
        title={stepTitle(setting.rulesSets, 'scores', STEP_TITLES.scores)}
        counter={counter}
        wide
        // One line of what the step is (final draft 1); the dice are in the Roll row under it.
        why={guide.why === APP_WHY.scores && keys.length > 0 ? scoresWhy(keys.length) : guide.why}
        // The dice in a Roll row, out of the title (final drafts A2, A9), between the line and Help me choose.
        roll={rule && keys.length > 0 ? <RollRow die={dieOf(rule.dice)}>{`Roll ${rule.dice} at the table for each score, then enter what you rolled.`}</RollRow> : undefined}
        help={guide.help}
        onBack={back(() => (picks.length > 1 ? setStep('method') : onBack()))}
        backOnFirst={backOnFirst}
        // "3 of 6 rolled" (final draft 1): the scores touched, a flag each (A5).
        hint={problem ?? (keys.length === 0 ? 'Nothing to enter' : `${rolledCount} of ${keys.length} rolled`)}
        stop={!!problem}
        onNext={() => {
          if (problem) return toast({ text: problem });
          setStep(raceMode === 'none' ? 'class' : 'race');
        }}
      >
        {keys.length === 0 && <p className="auth__meta">Your setting doesn’t list ability scores, so there’s nothing to enter here.</p>}
        <ScoreTiles>
          {keys.map((key) => (
            <ScoreTile
              key={key}
              id={`${id}-${key}`}
              label={fullName(key)}
              long={fullName(key)}
              value={typed[key] ?? ''}
              onChange={(text) => {
                touch(key);
                setTyped({ ...typed, [key]: text });
              }}
              onStep={(by) => stepBy(key, by)}
              // Untouched (A5): the average in the lighter weight and "Average".
              average={!touched.includes(key)}
              words={wordsOf(key)}
              onExplain={() => setExplained(key)}
            />
          ))}
        </ScoreTiles>
        {explainedKey && (
          <AbilityExplained
            name={fullName(explainedKey)}
            description={abilityDescription(setting.rulesSets, explainedKey)}
            note={abilityNote(setting.rulesSets, explainedKey)}
            value={values[explainedKey] ?? null}
            words={modifierWords(setting.rulesSets, explainedKey, values[explainedKey] ?? null)}
            onClose={() => setExplained(null)}
          />
        )}
        {weak && rule?.startOver && (
          <StartOverCallout
            text={rule.startOver.note || 'By this setting’s rule you may start over.'}
            onStartOver={() => {
              const was = { typed, touched };
              // Back to the dice average, as the step first opened (ct3-1): never empty tiles, and untouched (A5).
              setTyped(Object.fromEntries(keys.map((k) => [k, rule ? String(rule.average) : ''])));
              setTouched([]);
              setKeptWeak(false);
              toast({
                text: 'Started over: the scores are back at the average.',
                onUndo: () => {
                  setTyped(was.typed);
                  setTouched(was.touched);
                },
              });
            }}
            onKeep={() => setKeptWeak(true)}
          />
        )}
      </CreationStep>
    );
  }

  const stripScores = (changes: ResolvedEntry | null) =>
    keys.map((k) => {
      const base = rolled[k];
      const after = withRace(rolled, changes)[k];
      const delta = changes && isRecord(changes.data.abilityModifiers) ? changes.data.abilityModifiers[k] : undefined;
      return {
        label: label(k),
        value: after === undefined ? '—' : String(after),
        was: base === undefined ? undefined : String(base),
        why: typeof delta === 'number' && delta !== 0 && changes ? `${changes.name.toLowerCase()} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}` : undefined,
      };
    });

  // Race (cr-10): the strip with racial changes live, fit lines, the entry's six headings, Ask the GM on an unmet pick.
  if (step === 'race') {
    const guide = guideOf('race');
    const fits = new Map<string, Fit>(races.map((r) => [r.packEntryId, requirementFit(r, rolled, fullName)]));
    const pickedFit = race ? { fit: fits.get(race.packEntryId)! } : null;
    const problem = raceMode === 'optional' && !race && usual ? null : pickProblem('race', pickedFit, false);
    // Pick → Next (ct-1): a pick moves to the class at once with "<name> picked · Undo"; Picked ✓ tapped unpicks and stays.
    const pickRace = (r: ResolvedEntry) => {
      setOpened(null);
      setChipClass(null);
      if (race?.packEntryId === r.packEntryId) return setRace(null);
      const was = { race, klass };
      setRace(r);
      // A kindred-class belongs to its own kindred only (cs-4): another kindred unpicks it.
      if (klass && !offeredToKindred(klass, r)) setKlass(null);
      setStep('class');
      pickedToast(r.name, !!fits.get(r.packEntryId)?.problem, () => {
        setRace(was.race);
        setKlass(was.klass);
        setStep('race');
      });
    };
    const openEntry = races.find((r) => r.packEntryId === opened) ?? null;
    const chipEntry = chipClass ? (everyClass.find((c) => c.packEntryId === chipClass) ?? null) : null;
    const panel = chipEntry ? (
      // A class from Open classes (ct-2), to read: picked on the next step.
      <EntryPanel
        name={chipEntry.name}
        meta={sourceOf(chipEntry)}
        lead={blurbOf(chipEntry.data)}
        description={descriptionOf(chipEntry.data)}
        headings={classHeadings(chipEntry, openEntry, withRace(rolled, openEntry), setting.rulesSets, fullName, races, stepTitle(setting.rulesSets, 'race', STEP_TITLES.race))}
        extra={levelTableOf(chipEntry)}
        onClose={() => setChipClass(null)}
        backTo={openEntry ? openEntry.name : undefined}
        asSheet={!wide}
      />
    ) : openEntry ? (
      <EntryPanel
        name={openEntry.name}
        meta={sourceOf(openEntry)}
        lead={blurbOf(openEntry.data)}
        description={descriptionOf(openEntry.data)}
        headings={raceHeadings(openEntry, rolled, fullName, classNameOf, classOffered, setting.rulesSets)}
        picked={race?.packEntryId === openEntry.packEntryId}
        onPick={() => pickRace(openEntry)}
        onChip={setChipClass}
        onClose={() => setOpened(null)}
        asSheet={!wide}
      />
    ) : null;
    // Rows needing the GM's special approval fold after the open ones (Francis, retest 2, 2026-11-07).
    const needsGm = (r: ResolvedEntry) => !!fits.get(r.packEntryId)?.problem || !!fits.get(r.packEntryId)?.blocked;
    // Each group in alphabetical order, whatever pack each comes from (cs-38).
    const openRaces = alphabetical(races.filter((r) => !needsGm(r)), packOrder);
    const gmRaces = alphabetical(races.filter(needsGm), packOrder);
    const raceRow = (r: ResolvedEntry) => (
      <PickRow
        key={r.packEntryId}
        name={r.name}
        blurb={blurbOf(r.data)}
        fit={fits.get(r.packEntryId)!.parts}
        source={sourceOf(r)}
        from={fromOf(r)}
        picked={race?.packEntryId === r.packEntryId}
        onPick={() => pickRace(r)}
        onOpen={() => {
          setChipClass(null);
          setOpened(opened === r.packEntryId ? null : r.packEntryId);
        }}
      />
    );
    return (
      <CreationStep
        onLeave={leaveHere}
        title={stepTitle(setting.rulesSets, 'race', STEP_TITLES.race)}
        counter={counter}
        why={guide.why}
        help={guide.help}
        helpChoices={races.map((r) => ({ name: r.name, blurb: blurbOf(r.data) }))}
        onBack={back(toScores)}
        strip={<ScoresStrip scores={stripScores(race)} />}
        panel={wide ? panel : undefined}
        decideLater={raceMode === 'optional' && usual ? { label: `Use ${usual.name}`, onPick: () => { setRace(usual); setStep('class'); } } : undefined}
        hint={race ? `${race.name} picked${pickedFit?.fit.problem ? ': needs the GM’s special approval' : ''}` : (problem ?? `Pick one, or use ${usual?.name ?? 'the default'}`)}
        stop={!race && !!problem}
        onNext={() => {
          if (problem) return toast({ text: problem });
          if (!race && usual) setRace(usual);
          setStep('class');
        }}
      >
        {notice?.step === 'race' && !race && <Note tone="info">{notice.text}</Note>}
        <div role="group" aria-label="Races">
          {openRaces.map(raceRow)}
          <ApprovalFold key="race-approval" count={gmRaces.length} more={openRaces.length > 0} holdsPick={!!race && gmRaces.includes(race)}>
            {gmRaces.map(raceRow)}
          </ApprovalFold>
        </div>
        {!wide && panel}
      </CreationStep>
    );
  }

  // Class (cr-10, cr-7): open classes first, the rest in a folded "Not open to …" group, never hidden.
  if (step === 'class') {
    const guide = guideOf('class');
    // A kindred-class is listed under its own kindred only (cs-4), neither open nor "Not open to …" for another.
    const listed = classes.filter((c) => offeredToKindred(c, race));
    const open = classesFor(listed, method, race, afterRace).map((o) => o.entry);
    const closed = listed.filter((c) => !open.some((o) => o.packEntryId === c.packEntryId));
    const fitOf = (c: ResolvedEntry) => classFit(c, race, method, afterRace, setting.rulesSets, fullName);
    // Open rows first; the ones needing the GM's special approval (closed, or open with an unmet need) fold after them
    // (Francis, retest 2, 2026-11-07).
    // Alphabetical within each place, the closed ones still last (cs-38).
    const freeClasses = alphabetical(open.filter((c) => !fitOf(c).problem && !fitOf(c).blocked), packOrder);
    const gmClasses = [...alphabetical(open.filter((c) => !freeClasses.includes(c)), packOrder), ...alphabetical(closed, packOrder)];
    // A closed class is picked only by asking the GM (final drafts C, ⚑3): once picked it's flagged, not blocked.
    const pickedFit = klass ? { fit: { ...fitOf(klass), blocked: null } } : null;
    const problem = pickProblem('class', pickedFit, false);
    // Pick → Next (ct-1): a pick moves on at once (Adjust scores, else Who they are) with "<name> picked, Undo".
    // `asked`: Ask the GM to allow it on a closed class's entry: taken all the same, flagged for the GM's approval.
    const pickClass = (c: ResolvedEntry, asked = false) => {
      setOpened(null);
      if (klass?.packEntryId === c.packEntryId) return setKlass(null);
      // A hard limit (cs-3): only asking takes it; a stray tap says why instead of picking it.
      const blocked = fitOf(c).blocked;
      if (blocked && !asked) return toast({ text: blocked });
      const was = { klass, trades, patronId, patronLater, patronClass };
      setKlass(c);
      setTrades([]);
      // A change of class clears the patron picked under the old one (mockup 14-07), said in the toast with Undo.
      const cleared = (!!patronId || patronLater) && patronClass !== null && patronClass !== c.packEntryId;
      if (cleared) {
        setPatronId(null);
        setPatronLater(false);
      }
      setPatronClass(c.packEntryId);
      const undo = () => {
        setKlass(was.klass);
        setTrades(was.trades);
        setPatronId(was.patronId);
        setPatronLater(was.patronLater);
        setPatronClass(was.patronClass);
        setStep('class');
      };
      const say = () => (cleared ? toast({ text: 'Class changed. Your patron was cleared.', onUndo: undo }) : pickedToast(c.name, !!fitOf(c).problem, undo));
      if (reopensKindred(c)) return reopenKindred(c);
      if (patronStepShown(setting, c.packEntryId, alignmentNames)) {
        // The Patron step comes straight after Class (pt-10).
        setStep('patron');
        say();
      } else if (adjustStepExists(adjust, c, keys, scoresWith(c), label)) {
        setStep('adjust');
        say();
      } else if (finishOnPick && !cleared) {
        // The last of these steps: the caller moves on and says so with Undo. A patron cleared by the change stays here
        // with its own toast and Undo instead (14-07), and Next moves on.
        done({ method: method?.id ?? null, race: kindredWith(c), klass: c, rolled, scores: scoresWith(c), ...averaged(), patron: null, special: [race && specialApprovalOf('race', race, requirementFit(race, rolled, fullName)), specialApprovalOf('class', c, fitOf(c))].filter((s): s is SpecialApproval => !!s) }, true);
      } else if (cleared) say();
    };
    const openEntry = classes.find((c) => c.packEntryId === opened) ?? null;
    const openPicked = !!openEntry && klass?.packEntryId === openEntry.packEntryId;
    // Closed and not yet asked for: the sign and why, the rule in words, and Ask the GM to allow it (final drafts C).
    const openBlocked = openEntry && !openPicked ? fitOf(openEntry).blocked : null;
    const openKindred = openEntry ? raceAsPlayed(race, openEntry) : null;
    const panel = openEntry ? (
      <EntryPanel
        name={openEntry.name}
        meta={sourceOf(openEntry)}
        lead={blurbOf(openEntry.data)}
        description={descriptionOf(openEntry.data)}
        headings={classHeadings(openEntry, race, afterRace, setting.rulesSets, fullName, races, stepTitle(setting.rulesSets, 'race', STEP_TITLES.race))}
        extra={levelTableOf(openEntry)}
        picked={openPicked}
        onPick={openBlocked ? undefined : () => pickClass(openEntry)}
        onClose={() => setOpened(null)}
        closed={
          openBlocked
            ? {
                why: whyNotOpen(openEntry, method, openKindred) ?? openBlocked,
                note: closedClassNote(openEntry, race, openKindred ? sourceOf(openKindred) : '') || `${openBlocked} ${ASK_GM_NOTE}`,
                onAsk: () => pickClass(openEntry, true),
              }
            : undefined
        }
        asSheet={!wide}
      />
    ) : null;
    // A class the kindred's hard limit rules out (cs-3) is a not-allowed row (cw-8, cw-11): ▲ and why at full contrast, no
    // Pick; its text opens the entry, which says why at its top and has no Pick either.
    const row = (c: ResolvedEntry) => {
      const fit = fitOf(c);
      const parts = fit.blocked ? fit.parts.map((p, n) => (n === 0 ? { ...p, warn: true } : p)) : fit.parts;
      const picked = klass?.packEntryId === c.packEntryId;
      return (
        <PickRow
          key={c.packEntryId}
          name={c.name}
          blurb={blurbOf(c.data)}
          fit={parts}
          source={sourceOf(c)}
          from={fromOf(c)}
          picked={picked}
          // Asked for and picked (final drafts C): Picked ✓ shows, so it can be taken off like any pick.
          closed={!!fit.blocked && !picked}
          onPick={() => pickClass(c)}
          onOpen={() => setOpened(opened === c.packEntryId ? null : c.packEntryId)}
        />
      );
    };
    return (
      <CreationStep
        onLeave={leaveHere}
        title={stepTitle(setting.rulesSets, 'class', STEP_TITLES.class)}
        counter={counter}
        why={guide.why}
        help={guide.help}
        helpChoices={open.map((c) => ({ name: c.name, blurb: blurbOf(c.data) }))}
        // The prime experience table (R3-7), marked for the class picked; the rows' fit lines keep the experience now.
        helpExtra={<PrimeXpTable bands={primeXpBands(setting.rulesSets, klass, afterRace)} prime={primesOf(klass).length === 1 ? fullName(primesOf(klass)[0]!) : undefined} />}
        onBack={back(() => (raceMode === 'none' ? toScores() : setStep('race')))}
        strip={<ScoresStrip lead={race?.name} scores={stripScores(raceAsPlayed(race, klass))} />}
        panel={wide ? panel : undefined}
        hint={klass ? `${klass.name} picked${pickedFit?.fit.problem ? ': needs the GM’s special approval' : ''}` : (problem ?? '')}
        stop={!klass && !!problem}
        onNext={() => {
          if (problem) return toast({ text: problem });
          if (!klass) return;
          if (reopensKindred(klass)) return reopenKindred(klass);
          if (patronStepShown(setting, klass.packEntryId, alignmentNames)) setStep('patron');
          else if (adjustStepExists(adjust, klass, keys, afterRace, label)) setStep('adjust');
          else finish([]);
        }}
      >
        {notice?.step === 'class' && !klass && <Note tone="info">{notice.text}</Note>}
        {classes.length === 0 && <p className="auth__meta">Your setting has no classes to pick from.</p>}
        {open.length === 0 && classes.length > 0 && <p className="auth__meta">No class is open to this pick. Go back and change it, or ask your GM.</p>}
        {/* The classes needing the GM's approval fold after the open ones (retest 2), each with the sign and why; a
            closed one's tap opens its entry, which offers Ask the GM to allow it (final drafts C). */}
        <div role="group" aria-label="Classes">
          {freeClasses.map(row)}
          <ApprovalFold key="class-approval" count={gmClasses.length} more={freeClasses.length > 0} holdsPick={!!klass && gmClasses.some((c) => c.packEntryId === klass.packEntryId)}>
            {gmClasses.map(row)}
          </ApprovalFold>
        </div>
        {!wide && panel}
      </CreationStep>
    );
  }

  // Patron (pt-10; mockups creation/final/14-01 … 14-07): its own step straight after Class, for a class a patron in play
  // names. Pick rows (the ⓘ opens the patron's entry), the ones needing the GM's approval folded after the rest, the
  // pick kept on the step with a toast and Undo; Next with none picked opens a pop-up (14-05), never disabled.
  if (step === 'patron' && klass) {
    const offered = patronsOffered(setting, klass.packEntryId, alignmentNames);
    const picked = offered.find((o) => o.patron.id === patronId)?.patron ?? null;
    const pickedOffer = offered.find((o) => o.patron.id === picked?.id) ?? null;
    // The class's alignment limit crossed with each patron's followers (fix-patron-class-alignment): one outside a soft
    // limit needs the GM's special approval, as one marked `approval: "gm"` does; one outside a hard limit is closed: a
    // not-allowed row (cw-8), folded with the approval ones as closed alignments are, unless it's the one picked (a pick
    // kept from before), which keeps its Picked ✓ so it can be taken off.
    const special = (o: (typeof offered)[number]) => o.patron.needsGm || o.fit === 'soft';
    const shut = (o: (typeof offered)[number]) => o.fit === 'closed' && o.patron.id !== picked?.id;
    const free = offered.filter((o) => !special(o) && !shut(o));
    const gm = offered.filter((o) => special(o) && !shut(o));
    const closed = offered.filter(shut);
    const fitTo = patronFitOf(setting, klass.packEntryId, alignmentNames);
    const klassWord = klass.name.toLowerCase();
    const narrows = offered.some((o) => !shut(o) && o.patron.alignments.length > 0);
    // A closed patron kept from before (review of #665, nit 1): its row keeps Picked ✓ (to take it off) with the ▲ line,
    // and Next holds with the line Send to the GM uses, as a kept closed alignment holds Who they are.
    const anyOpen = offered.some((o) => o.fit !== 'closed');
    const keptClosed = pickedOffer?.fit === 'closed' ? patronClosedPickLine(klassWord, pickedOffer.patron.name, offered.some((o) => o !== pickedOffer && o.fit !== 'closed')) : null;
    /** On from the Patron step: Adjust scores when the class leaves a trade, else Who they are. */
    // Change Patron from the review (a redo opened here): straight back, the scores and trades untouched.
    const onward = (later = patronLater) => (adjustStepExists(adjust, klass, keys, afterRace, label) && !(!finishOnPick && opened0.step === 'patron') ? setStep('adjust') : finish(trades, later));
    const pickPatron = (id: string) => {
      setPatronOpen(null);
      const was = { id: patronId, later: patronLater };
      const undo = () => {
        setPatronId(was.id);
        setPatronLater(was.later);
      };
      if (picked?.id === id) {
        // Picked ✓ tapped: taken off, with Undo.
        setPatronId(null);
        return toast({ text: 'Patron taken off.', onUndo: undo });
      }
      const o = offered.find((x) => x.patron.id === id);
      // A closed patron has no Pick (its row and its entry say why); nothing picks it.
      if (!o || o.fit === 'closed') return;
      setPatronId(id);
      setPatronClass(klass.packEntryId);
      setPatronLater(false);
      pickedToast(o.patron.name, special(o), undo);
    };
    const row = (o: (typeof offered)[number]) => {
      const { patron: p, label: name } = o;
      return (
        <PickRow
          key={p.id}
          name={name}
          blurb={patronRowLine(p)}
          {...(special(o) && !shut(o) ? { fit: [{ text: SPECIAL_NOTE, warn: true }] } : {})}
          // A class whose hard alignment limit its followers don't meet (fix-patron-class-alignment): the build's closed-row words (cw-8).
          {...(o.fit === 'closed' ? { fit: [{ text: patronNotOpen(klassWord), warn: true }], ...(shut(o) ? { closed: true } : {}) } : {})}
          picked={p.id === picked?.id}
          onPick={() => pickPatron(p.id)}
          onOpen={() => setPatronOpen(p.id)}
        />
      );
    };
    const open = offered.find((o) => o.patron.id === patronOpen) ?? null;
    const names = {
      spell: (spellId: string) => setting.all.find((e) => e.kind === 'spell' && e.packEntryId === spellId)?.name,
      klass: (classId: string) => everyClass.find((c) => c.packEntryId === classId)?.name,
    };
    // The ⓘ entry as #636 built it (picture 15; Francis, 2026-11-12: it stays as built).
    const entry = open ? patronEntry(open.patron, names, setting.packs.find((pk) => pk.packId === open.patron.packId)?.name ?? '') : null;
    return (
      <CreationStep
        onLeave={leaveHere}
        title={STEP_TITLES.patron}
        counter={counter}
        // One sentence under the count (14-01), because it carries a consequence: only when a patron here does narrow it.
        why={narrows ? 'Your patron sets or narrows your alignment.' : null}
        help={null}
        onBack={back(() => setStep('class'))}
        // Decide later (the lead's ruling A): the patron goes on the To finish list; it can't reach approval without one.
        decideLater={
          picked
            ? undefined
            : {
                onPick: () => {
                  setPatronLater(true);
                  onward(true);
                },
              }
        }
        hint={keptClosed ?? (picked ? `${picked.name} picked${pickedOffer && special(pickedOffer) ? '. Your GM decides on the review' : ''}` : patronLater ? 'Put off: on your To finish list' : 'No patron yet')}
        stop={!!keptClosed}
        // Nothing open to pick (every patron closed, a kept one taken off): on, with no pop-up asking for one.
        onNext={() => (keptClosed ? toast({ text: keptClosed }) : picked || patronLater || !anyOpen ? onward() : setPatronAsk(true))}
      >
        {/* Every patron needs the GM's approval (14-07): their rows under one line, no fold. */}
        <div role="group" aria-label="Patrons">
          {/* Closed patrons fold after the rest, as closed alignment rows do (cw-8; retest 2, 2026-11-07). */}
          {free.length === 0 ? (
            <>
              {gm.length > 0 && <p className="creation-group__line">Every patron here needs the GM’s approval.</p>}
              {gm.map(row)}
              <ApprovalFold key="patron-closed" count={closed.length} more={gm.length > 0}>
                {closed.map(row)}
              </ApprovalFold>
            </>
          ) : (
            <>
              {free.map(row)}
              <ApprovalFold key="patron-approval" count={gm.length + closed.length} more holdsPick={!!pickedOffer && gm.includes(pickedOffer)}>
                {gm.map(row)}
                {closed.map(row)}
              </ApprovalFold>
            </>
          )}
        </div>
        {open && entry && (
          // The ⓘ: the patron's entry as a sheet (as built in #636: its line, the description, then its headings); Pick at the foot.
          <EntryPanel
            name={open.label}
            meta={entry.meta || undefined}
            tagline={entry.tagline || undefined}
            source={entry.source}
            lead={entry.lead || undefined}
            description={entry.description}
            // A closed patron's entry (cp-1): one ▲ line in the row's words, the why plain under it, no heading of its
            // own, and no Pick at its foot (a kept one keeps Picked ✓ to take it off); it closes by its ✕ only.
            headings={entry.headings}
            {...(open.fit === 'closed' ? { closed: patronClosedEntry(open.patron, fitTo.limit, klassWord) } : {})}
            picked={open.patron.id === picked?.id}
            {...(shut(open) ? {} : { onPick: () => pickPatron(open.patron.id) })}
            onClose={() => setPatronOpen(null)}
            asSheet
          />
        )}
        {patronAsk && (
          // Next with none picked (14-05): why the step can't be passed, and the two ways out.
          <PatronFirstDialog
            className={klass.name}
            classStep={stepTitle(setting.rulesSets, 'class', STEP_TITLES.class)}
            onBack={() => {
              setPatronAsk(false);
              setStep('class');
            }}
            onChoose={() => setPatronAsk(false)}
          />
        )}
      </CreationStep>
    );
  }

  // Adjust scores (cr-11): the rule's buttons only, the bank, Undo per trade; a forbidden tap answers in a line.
  if (!adjust || !klass) {
    // Without the rule as data (or a class) there's no step: back to the class.
    return (
      <CreationStep onLeave={leaveHere} title={STEP_TITLES.adjust} counter={counter} why={guideOf('adjust').why} help={null} onBack={() => setStep('class')} hint="Your setting has no trade rule as data" onNext={() => (klass ? finish([]) : setStep('class'))}>
        <p className="auth__meta">Your setting has no adjustment rule as data, so there’s nothing to trade here.</p>
      </CreationStep>
    );
  }
  const guide = guideOf('adjust');
  const bank = bankOf(trades);
  const primes = primesOf(klass);
  const problem = adjustProblem(trades);
  const answer = (why: string) => toast({ text: why });
  // Option C (ct-3): only the tradeable scores have tiles; a line names the ones kept as rolled.
  const tradeable = tradeableScores(adjust, keys, klass, label);
  const keptAsRolled = keptLine(tradeable.kept, fullName);
  // The lead names the prime(s) and the rule in one breath (final draft 1, P8; two primes: the pack's line, P10).
  const lead = adjustLead(adjust, klass, setting.rulesSets, fullName);
  // The rule's own note moves behind Help me choose, with its source.
  const ruleNote = adjust.note ? `${adjust.note}${adjust.source ? ` ${adjust.source}` : ''}` : null;
  /**
   * A lowering (Design on #544, 2026-11-07): reversible at once, so its own toast with Undo, "Charm 11 → 9: now raise
   * Might by 1"; the raise's toast replaces it.
   */
  const lowerScore = (key: string) => {
    const next = [...trades, { kind: 'lower' as const, key }];
    setTrades(next);
    toast({ text: loweredToast(key, tradedScores(afterRace, next, adjust), primes, adjust, fullName), onUndo: () => setTrades(trades) });
  };
  /** A trade's raise (final draft 1): the toast names both scores; Undo takes that lowering and this raise back. */
  const raise = (key: string) => {
    const next = [...trades, { kind: 'raise' as const, key }];
    const index = next.filter((t) => t.kind === 'raise').length - 1;
    const lowered = next.filter((t) => t.kind === 'lower')[index]?.key;
    setTrades(next);
    if (lowered) toast({ text: tradeToast(lowered, key, tradedScores(afterRace, next, adjust), adjust, fullName), onUndo: () => setTrades(withoutChip(next, index)) });
  };
  return (
    <CreationStep
      onLeave={leaveHere}
      title={STEP_TITLES.adjust}
      counter={counter}
      wide
      why={
        <>
          <b>{lead.bold}</b>
          {lead.rest}
        </>
      }
      help={ruleNote ?? guide.help}
      // The prime experience table inside Help me choose (R3-7), the character's band marked; the pack's prose stays the lead.
      helpExtra={<PrimeXpTable bands={primeXpBands(setting.rulesSets, klass, scores)} prime={primesOf(klass).length === 1 ? fullName(primesOf(klass)[0]!) : undefined} />}
      onBack={back(() => {
        // Back to Class resets every trade (cr-11), with Undo.
        if (trades.length > 0) {
          const was = trades;
          setTrades([]);
          toast({ text: 'Trades reset.', onUndo: () => setTrades(was) });
        }
        setStep(patronStepShown(setting, klass.packEntryId, alignmentNames) ? 'patron' : 'class');
      })}
      // No scores strip on Adjust (Francis, retest 2, 2026-11-07): the full tiles are the scores here; the strip stays on
      // Kindred and Class (cr-10).
      hint={problem ?? tradesHint(trades)}
      stop={!!problem}
      onNext={() => (problem ? toast({ text: problem }) : finish(trades))}
    >
      {keptAsRolled && <p className="creation-group__line">{keptAsRolled}, so it isn’t shown here</p>}
      <ScoreTiles adjust>
        {keys
          .filter((key) => tradeable.lowerable.includes(key) || tradeable.raisable.includes(key))
          .map((key) => {
            const now = scores[key] ?? 0;
            const prime = primes.includes(key);
            const lower = canLower(adjust, key, now, klass, fullName);
            const raiseOk = canRaise(adjust, key, now, klass, bank, fullName);
            // Only the control the rule allows (final draft 1, Francis 2026-11-07): + on a prime, − on the others, none
            // at or under the floor, with the reason in the tile.
            const lowers = !prime && tradeable.lowerable.includes(key);
            const atFloor = lowers && now <= adjust.floor;
            // The threshold in the direction the tile's control allows (Design on #544): up for a prime's +, down for
            // a −, "now" only for a tile with none.
            // A prime shows its experience instead (Design / Francis, 2026-11-07); its modifier only when the class's
            // experience doesn't say.
            const line = (prime ? primeXpLine(klass, key, setting.rulesSets, scores) : '') || thresholdLine(setting.rulesSets, key, now, prime ? 'up' : lowers && !atFloor ? 'down' : 'none');
            const words = adjustTileWords(line, atFloor ? (now < adjust.floor ? 'under' : 'at') : null, adjust.floor);
            return (
              <AdjustTile
                key={key}
                label={fullName(key)}
                long={fullName(key)}
                onExplain={() => setExplained(key)}
                value={now}
                // A traded score says what it was (Design on #555: the strip is gone from Adjust).
                was={afterRace[key]}
                words={words.warn ? <WarningLine>{words.text}</WarningLine> : words.text}
                prime={prime}
                // A shown control with nothing banked, or one the rule can't take now, answers why (never disabled).
                lower={lowers && !atFloor ? { label: `−${adjust.lowerBy}`, aria: `Lower ${fullName(key)} by ${adjust.lowerBy}`, onTap: () => (lower.ok ? lowerScore(key) : answer(lower.why)) } : undefined}
                raise={prime ? { label: `+${adjust.raiseBy}`, aria: `Raise ${fullName(key)} by ${adjust.raiseBy}`, onTap: () => (raiseOk.ok ? raise(key) : answer(raiseOk.why)) } : undefined}
              />
            );
          })}
      </ScoreTiles>
      {explained && keys.includes(explained) && (
        <AbilityExplained
          name={fullName(explained)}
          description={abilityDescription(setting.rulesSets, explained)}
          note={abilityNote(setting.rulesSets, explained)}
          value={scores[explained] ?? null}
          words={modifierWords(setting.rulesSets, explained, scores[explained] ?? null)}
          onClose={() => setExplained(null)}
        />
      )}
      {/* The trade chips keep the short names ("WIT −2"): many to a row (Design, 2026-11-06); each ✕ undoes its trade. */}
      <TradeChips chips={tradeChips(trades, adjust, label)} onUndo={(n) => setTrades(withoutChip(trades, n))} />
    </CreationStep>
  );
}

/**
 * Picks kept on the device (cw-13), read against the campaign's packs as they are now: the method, kindred and class by
 * id; one the packs no longer have is dropped, and the walk lands on its step with a line saying so. Otherwise it
 * lands where the player left, or on the first pick still missing before it.
 */
function restoreKept(kept: KeptPicks, picks: CreationMethod[], races: ResolvedEntry[], classes: ResolvedEntry[], rulesSets: CampaignSetting['rulesSets'], hasAdjust: boolean) {
  const method = picks.find((m) => m.id === kept.method) ?? (picks.length === 1 ? picks[0]! : null);
  const mode = raceStep(method, races, defaultRace(rulesSets, races) !== null);
  const race = kept.race && mode !== 'none' ? (races.find((r) => r.packEntryId === kept.race!.id) ?? null) : null;
  const klass = kept.klass ? (classes.find((c) => c.packEntryId === kept.klass!.id) ?? null) : null;
  const gone = (name: string) => `${name} isn't in this campaign's rules any more. Pick again.`;
  let step: GuidedStep = kept.step;
  let notice: { step: 'race' | 'class'; text: string } | null = null;
  if (picks.length > 1 && !method) step = 'method';
  else if (kept.race && mode !== 'none' && !race) {
    step = 'race';
    notice = { step: 'race', text: gone(kept.race.name) };
  } else if (kept.klass && !klass) {
    step = 'class';
    notice = { step: 'class', text: gone(kept.klass.name) };
  } else if (step === 'method' && picks.length <= 1) step = 'scores';
  else if (step === 'race' && mode === 'none') step = 'class';
  else if (step === 'adjust' && (!hasAdjust || !klass)) step = 'class';
  else if (step === 'patron' && !klass) step = 'class';
  const klassKept = notice?.step === 'race' ? null : klass;
  return {
    step,
    method,
    race,
    klass: klassKept,
    typed: kept.typed,
    touched: kept.touched,
    trades: klass && notice === null ? kept.trades : [],
    notice,
    // The patron kept with its class (pt-10); one the class isn't offered any more reads as none on the step.
    patron: klassKept ? (kept.patron ?? null) : null,
    patronLater: !!klassKept && !!kept.patronLater,
  };
}

/**
 * The step a resumed walk opens on: Back from Who they are asks for the adjustments; without a trade to make there (no
 * trade rule, or none this class and these scores leave open, as Next decides: cr-3), the Patron step when the class
 * has one (pt-10), else the class. A Patron step for a class with no patron: the class.
 */
function resumedStep(resume: { choice: GuidedChoice; step: GuidedStep }, setting: CampaignSetting, hasAdjust: boolean, alignmentNames: readonly string[] = []): GuidedStep {
  const patronHere = patronStepShown(setting, resume.choice.klass.packEntryId, alignmentNames);
  // A closed patron kept from before opens its step too, for a class whose every patron is closed: it is taken off there.
  const keptHere = !!resume.choice.patron && patronsOffered(setting, resume.choice.klass.packEntryId, alignmentNames).some((o) => o.patron.id === resume.choice.patron?.id);
  if (resume.step === 'patron') return patronHere || keptHere ? 'patron' : 'class';
  if (resume.step !== 'adjust') return resume.step;
  const rule = adjustmentRule(setting.rulesSets);
  const trade = hasAdjust && adjustStepExists(rule, resume.choice.klass, abilityKeys(setting.rulesSets), withRace(resume.choice.rolled, raceAsPlayed(resume.choice.race, resume.choice.klass)), (key) => key);
  if (trade) return 'adjust';
  // No trade to make: Next went past Adjust scores (cr-3), so Back does too (fix-adjust-scores-skipped, 2026-11-13).
  return patronHere ? 'patron' : 'class';
}

/** The trades a resumed character's scores imply, so Back to the adjustments shows them (lowerings first, then raises). */
function tradesFrom(choice: GuidedChoice, rule: { lowerBy: number; raiseBy: number }, kindredPicked: boolean): Trade[] {
  // The race's changes only when it was picked on the Kindred step (the kindred-as-class path sets it from the class).
  const base = withRace(choice.rolled, kindredPicked ? raceAsPlayed(choice.race, choice.klass) : null);
  const trades: Trade[] = [];
  for (const [key, after] of Object.entries(choice.scores)) {
    const before = base[key];
    if (before === undefined || after === before) continue;
    if (after < before) for (let n = 0; n < Math.round((before - after) / rule.lowerBy); n++) trades.push({ kind: 'lower', key });
  }
  for (const [key, after] of Object.entries(choice.scores)) {
    const before = base[key];
    if (before === undefined || after <= before) continue;
    for (let n = 0; n < Math.round((after - before) / rule.raiseBy); n++) trades.push({ kind: 'raise', key });
  }
  return trades;
}

/**
 * What a score does (cw-11, mockup creation/12 "A tap on Might"): the full name as the pop-up's title, what the ability
 * is in plain words (the pack's `description`, else its `blurb`), what this number does ("At 13: +1 melee, open
 * doors."), then the setting's rules note on it. Read only; ✕ closes.
 */
function AbilityExplained({ name, description, note, value, words, onClose }: { name: string; description: string; note: string; value: number | null; words: string; onClose: () => void }) {
  return (
    <Dialog label={name} onClose={onClose}>
      {description && <p className="reading">{description}</p>}
      {value !== null && <p className="reading">{words ? `At ${value}: ${words}.` : `At ${value}, nothing changes in play.`}</p>}
      {note && <p className="reading ability-explained__note">{note}</p>}
      {!description && !note && <p className="reading">Your setting says nothing more about {name}.</p>}
    </Dialog>
  );
}

/**
 * "Pick a patron first" (14-05; cs-27, cs-50, picture creation/final 23-H5): Next on the Patron step with none picked.
 * One sentence why, and the two ways out as buttons, the accent outermost: back to the class step (as the pack names
 * it), or choose a patron. A dialog with buttons has no X.
 */
export function PatronFirstDialog({ className, classStep, onBack, onChoose, preview = false }: { className: string; classStep: string; onBack: () => void; onChoose: () => void; preview?: boolean }) {
  return (
    <Dialog label="Pick a patron first" onClose={onChoose} preview={preview} noClose>
      <p className="reading">{`${aClass(className)} follows a patron.`}</p>
      <div className="dialog__actions">
        <button type="button" className="button-secondary" onClick={onBack}>
          {`Back to ${classStep}`}
        </button>
        <button type="button" className="button-primary" onClick={onChoose}>
          Choose a patron
        </button>
      </div>
    </Dialog>
  );
}
