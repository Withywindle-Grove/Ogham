import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { loadCampaignSettings, loadNewCharacterRules, setActiveCharacter } from '../core/campaignCommands.ts';
import { hpRequiredOf, joinsAtOnce, startLevelFixedOf, startLevelLimit, startLevelOf } from '../core/campaignSettings.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadActiveCharacterId, loadMyCharacters, loadSentBackBy, parseHpMax, type MyCharacter } from '../core/myCharacters.ts';
import { loadSavedExpertise } from '../core/characterSheet.ts';
import { whenWords } from './SheetParts.tsx';
import type { Db } from '../core/supabase.ts';
import { classXpTable, startingXp } from '../modules/characters/startingXp.ts';
import { createCharacter, deleteCharacter, editCharacter, resubmitCharacter, sendCharacter } from '../modules/characters/commands.ts';
import { speedMarks } from '../modules/characters/movement.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { companiesOn, loadCompanies, type Company } from '../core/companies.ts';
import { CampaignFields, type FieldHelp } from './CampaignFields.tsx';
import { alignmentAbout, extraLanguagesHint, hpModifierOf, hpPromptLine, literacyAbout, startingLanguages } from '../modules/characters/guidance.ts';
import { CharacterSheet } from './CharacterSheet.tsx';
import { CampaignHeading } from './CampaignHeading.tsx';
import { PartyList } from './PartyList.tsx';
import { PlayerScreen } from './PlayerScreen.tsx';
import { useWide } from './useWide.ts';
import { DownloadCopyButton, RemoveCharacter } from './RemoveCharacter.tsx';
import { PhotoError, shrinkImage } from './image.ts';
import { Portrait, PortraitPicker, type PortraitChoice } from './Portrait.tsx';
import { applyPortrait } from './PortraitSheet.tsx';
import type { CharacterRef } from '../modules/characters/commands.ts';
import {
  fieldInputsFrom,
  fieldSummary,
  loadFieldDefinitions,
  readFieldInputs,
  type FieldDefinition,
  type FieldInputs,
  type FieldValue,
} from '../modules/characters/fields.ts';
import { RetiredBanner } from './Retired.tsx';
import { aClass, GuidedCreation, guidedStepCount, optionOn, type GuidedChoice, type GuidedStep } from './GuidedCreation.tsx';
import { loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { characterAcBonuses, creationAcLines, creationAcParts, creationExplainer, scoresOf, settingFills, withCreationAc } from './fromSetting.ts';
import { draftRollLabel, recordRoll } from '../core/rolls.ts';
import { StartingGear } from './StartingGear.tsx';
import { LanguagesStep } from './LanguagesStep.tsx';
import { WeaponSkillsStep, weaponSkillsWhy } from './WeaponSkillsStep.tsx';
import { packAndPage } from '../modules/library/sourceTitles.ts';
import { ExpertiseStep, expertiseReviewLine, expertiseSetup, pointWords, sameExpertise } from './ExpertiseStep.tsx';
import { pointsAllowed, pointsSpent, readExpertise, type Expertise } from '../modules/characters/expertise.ts';
import { campaignChoices, weaponSetup } from './weaponSetup.ts';
import { FirstSpellsStep } from './FirstSpellsStep.tsx';
import { NO_PICKS, cleanPicks, firstSpellsPlan, firstSpellsProblem, picksFromBook, spellsStepTitle, type FirstSpellsPicks, type FirstSpellsPlan } from '../modules/characters/firstSpells.ts';
import { setSpellBook, spellBookOf } from '../modules/characters/spellBook.ts';
import { TraitListStep } from './TraitListStep.tsx';
import { layoutHelp, layoutHints, notAskedAtCreation, ownedByTraitList, traitListsOf, pickedGearEntry, traitLookup, traitPickName, traitPicksOf, traitRequired, traitSteps, traitHelp, traitValue, traitValues, traitLines, type TraitList, type TraitPick } from '../modules/characters/traitLists.ts';
import { saveToFinish } from './toFinish.ts';
import { languageApprovals, languageDerived, languagesLine, languagesOfPlan, languagesPlan, languagesProblem, languagesStepExists, picksFromSaved, type LanguagePicks } from '../modules/characters/languagesStep.ts';
import { raceOrClassChanged, redoCreation } from '../modules/characters/redo.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { ownedByWeaponSkills, picksUsed, weaponApprovals, weaponSkillsOf, type WeaponSkill } from '../modules/characters/weaponSkills.ts';
import { grantedWords, grantTraitGear, traitUnchanged, undoTraitGear } from './traitGear.ts';
import { entryRollPlan, rolledSpellOf, rolledSpellReview, type RolledSpell } from '../modules/characters/traitSpellRoll.ts';
import { creationTablesOf, DetailsStep, OneTableSheet, useNameRoll } from './KindredTables.tsx';
import { detailLines, detailsOf, detailsStepExists, isLong, nameTablesOf, NO_TABLES, physicalOf, rangeOf, rollWords, rowOf, rowWords, type CharacterDetails } from '../modules/characters/kindredTables.ts';
import { APP_WHY, languageText, laterSteps, packWhy, requiredSteps, settingLanguages, stepGuide, toFinishName, toFinishOf, type GuideStep } from '../modules/characters/creationGuide.ts';
import { abilityNames, classKindredId, classLevelCap, classRace, holdsAbility, kindredAndClassNamed, raceAsPlayed } from '../modules/characters/creation.ts';
import { kindredItems } from '../modules/characters/startingGear.ts';
import { GEAR_TITLE, coinsOf, kitsOffered, startingEquipment, startingPicks } from '../modules/characters/startingGear.ts';
import { CreationReview, SEND_OFFLINE, type ReviewBuilt, type ReviewData } from './CreationReview.tsx';
import { averageScoresLine, cantUseLine, exceptionsPart, firstProblem, gearGroups, moneyOf, scoresLine, spellSources, type StepCheck } from './creationReview.ts';
import { carriedLoad, toLoadLine } from '../modules/inventory/encumbrance.ts';
import { isSeparate } from '../modules/inventory/packView.ts';
import { tierWords } from './packHelpers.ts';
import { showFilled } from '../modules/library/fills.ts';
import { entriesInPlay, fieldsInPlay, fieldsOffFor, type FieldFor } from '../modules/library/optionGate.ts';
import { nameFromWords, namesakeSource } from '../modules/library/namesakes.ts';
import { CampaignRules } from './RulesBrowser.tsx';
import { registry } from './services.ts';
import { TopRow } from './TopRow.tsx';
import { CampaignMenuProvider, ShellMenuItems } from './shellMenu.tsx';
import { MenuItem } from '../ui/MoreMenu.tsx';
import './Characters.css';
import { useLogVersion } from './campaignLog.tsx';
import { CastingStatus, equipCheckWith } from './EquipWarning.tsx';
import { StatusMarks, useStatusBook } from './Statuses.tsx';
import { Breakdown, ChoiceCard, StackedButton, Stepper } from '../ui/parts.tsx';
import { dieOf, RollRow } from '../ui/dice.tsx';
import { forgetKept, keptWhen, keptWords, readKept, type KeptPicks } from './keptCreation.ts';
import { AVERAGE_LINE, ApprovalFold, AverageStepper, BookType, CreationLeave, CreationLoading, CreationStep, useBackWord, useCreationLeave, useLeaveWord, DerivedFields, DetailRow, EntryPanel, PickGroup, PickRow, StartOverCallout, TableFold, type ReviewPart, type ReviewValue } from '../ui/creation.tsx';
import { alignmentEntry, fieldEntries, languageEntries, type EntryContext } from '../modules/characters/listEntries.ts';
import { languageList } from '../modules/characters/creationGuide.ts';
import { useFoldOpen } from './packOpen.ts';
import { classListOf, creationShown, patronGarbFor, patronInSetting } from './patronGarb.ts';
import { GARB_SWAP_FAILED, swapPatronGarb } from './patronGarbSwap.ts';
import { alignmentClosedReason, alignmentLine, alignmentNamed, alignmentNamesOf, alignmentOffer, alignmentOfferSet, alignmentProblem, alignmentRequirement, alignmentRows, alignmentSetBy, alignmentSetProblem, alsoFillsField, derivedRows, diceRange, filledAt, hpAskLine, hpAverageLine, hpFromRoll, hpMinimum, hpProblem, hpReroll, hpWorkedLine, mayAlsoFill, rerollOffered, tableAlsoFills, tableFields, tablePickToast, whoHint, type HpRoll } from '../modules/characters/whoTheyAre.ts';
import { alignmentVisibility, diceAverage, languageNamer } from '../modules/characters/creationRules.ts';
import { patronAskedIn, patronProblemIn, patronNameOf, patronAlignmentChange, patronAlignmentOffer, patronAlignmentProblem, offeredPatronApproval, patronFitTo, patronPickToast, patronsFor, type Patron } from '../modules/characters/patrons.ts';
import { APP_HELP, ASK_GM_NOTE, SPECIAL_NOTE, STEP_TITLES, withStepApprovals, type SpecialApproval } from '../modules/characters/creationSteps.ts';
import { alignmentFit, classAlignmentLimit } from '../modules/library/classLimits.ts';
import { stepTitle as guideTitle } from '../modules/characters/creationGuide.ts';

import { Dialog } from '../ui/Dialog.tsx';
import { PinnedNote, ReviewScreen } from '../ui/organisms.tsx';
import { ErrorToast, NoticeToast, useErrorToast, useToast, type ToastRequest } from '../ui/ToastHost.tsx';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { reviewDetails } from './reviewDetails.ts';
import { fromGmWords, givenToMe } from '../modules/characters/giving.ts';
import { FIXABLE, isReviewStep, reviewSections, SHOPPING, stepTitle, stillToDo, type ReviewStep, type StillToDo } from './reviewSections.ts';
import { possessive } from '../core/nameWords.ts';

/** The spells step's name (cs-2): Magic for glamours, runes and knacks, else the pack's, else "First spells". */
const spellsTitle = (rulesSets: readonly Record<string, unknown>[], plan: FirstSpellsPlan | null) => spellsStepTitle(plan, guideTitle(rulesSets, 'spells', STEP_TITLES.spells));

const HP_HINT = 'Roll for your level at the table and type it, or leave it for your GM.';

/**
 * A card that opens its character from a tap anywhere on it, not only on the name (M4b re-test: it took several
 * taps). Its own controls (the portrait, Remove…) keep their taps; keyboards and screen readers use the Open button.
 */
const opensOnTap = (open?: () => void) =>
  open
    ? {
        'data-opens': '',
        onClick: (event: MouseEvent<HTMLDivElement>) => {
          if (!(event.target as HTMLElement).closest('button, a, input, label, select, textarea, summary, [role="dialog"]')) open();
        },
      }
    : {};
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
const HP_ERROR = 'HP max must be a whole number of at least 1, or left empty.';
const asRecord = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
/** A character's saved values for the fields left off a form (`off`), to send back unchanged so they stay saved (of-9, cs-3). */
const keptValues = (fields: unknown, off: ReadonlySet<string> | undefined): Record<string, FieldValue> =>
  off && off.size > 0 ? (Object.fromEntries(Object.entries(asRecord(fields)).filter(([key, value]) => off.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))) as Record<string, FieldValue>) : {};
const refOf = (c: MyCharacter): CharacterRef => ({ id: c.id, campaignId: c.campaignId, ownerType: c.ownerType, ownerUserId: c.ownerUserId, approval: c.approval, archived: c.archived });
/** What a race or class change clears (cf-7), said in the toast with Undo. */
const CLEARED_WORDS = 'the spells, gear, languages, weapon skills and traits after it are cleared';
/** A class change also clears the hit points (ruled B, amended 2026-11-02: the hit die is the class's). */
const CLASS_CLEARED_WORDS = 'the hit points, spells, gear, languages, weapon skills and traits after it are cleared';

/** The patron a creation record keeps (pt-10), as the guided choice carries it: picked, or put off with Decide later. */
function patronChoiceOf(creation: unknown): Pick<GuidedChoice, 'patron' | 'patronLater'> {
  const record = asRecord(creation);
  const saved = asRecord(record.patron);
  const patron = typeof saved.id === 'string' && saved.id ? { id: saved.id, name: typeof saved.name === 'string' ? saved.name : saved.id } : null;
  return { patron, ...(!patron && toFinishOf(record).includes('patron') ? { patronLater: true } : {}) };
}

/** Name, starting level, HP max and backstory: the freeform character fields (shared by making and editing). */
function CharacterFields({
  name,
  level,
  hp,
  backstory,
  onName,
  onLevel,
  onHp,
  onBackstory,
  fieldDefs,
  fieldInputs,
  onField,
  afterName,
  levels,
  hpAsk,
  help,
  hide,
  traitLists,
  only,
  namePlaceholder,
  nameAction,
  nameNote,
}: {
  name: string;
  level: number;
  hp: string;
  backstory: string;
  onName: (value: string) => void;
  onLevel: (value: number) => void;
  onHp: (value: string) => void;
  onBackstory: (value: string) => void;
  fieldDefs: FieldDefinition[];
  fieldInputs: FieldInputs;
  onField: (key: string, value: string | boolean) => void;
  /** Shown right under the name (the portrait picker). */
  afterName?: ReactNode;
  /** The campaign's limit on a new character's level, and what the hint says. */
  levels?: { max: number | null; hint: string };
  /** Creation asks for HP only when a sheet layout says so (null: not asked); left out, it's optional as before. */
  hpAsk?: { hint: string } | null;
  help?: Record<string, FieldHelp>;
  hide?: (field: FieldDefinition) => boolean;
  /** The setting's trait lists, for a list field fed by one (M5b step 0b). */
  traitLists?: TraitList[];
  /** Only one review step's inputs (a sent-back character, B18); all of them when left out. */
  only?: 'who' | 'hp' | 'details' | 'story';
  /** The Name field's placeholder (R3-1: "Type a name, or roll for one" when there are tables). */
  namePlaceholder?: string;
  /** Beside the Name field where the row has room, else under it (R3-1: Roll for a name). */
  nameAction?: ReactNode;
  /** Under the Name field (R3-1: "From <table>, rolled 3 and 14…"). */
  nameNote?: ReactNode;
}) {
  const shows = (part: 'who' | 'hp' | 'details' | 'story') => !only || only === part;
  // Set by the campaign unless the player proposes (B21): a set level shows as words, a proposal as a stepper.
  const setLevel = levels?.max ?? null;
  return (
    <>
      {shows('who') && (
      <>
      <div className="field">
        <label className="label" htmlFor="character-name">
          Name
        </label>
        {(() => {
          const input = (
            <input
              id="character-name"
              className="field__input field__input--name"
              type="text"
              autoComplete="off"
              maxLength={80}
              placeholder={namePlaceholder}
              value={name}
              onChange={(event) => onName(event.target.value)}
            />
          );
          return nameAction ? (
            <div className="name-roll">
              {input}
              {nameAction}
            </div>
          ) : (
            input
          );
        })()}
        {nameNote}
      </div>
      {afterName}
      <div className="field" role="group" aria-labelledby="character-level-label">
        <span id="character-level-label" className="label">
          Starting level
        </span>
        {setLevel !== null ? (
          <p className="character-level">You start at level {setLevel}.</p>
        ) : (
          <Stepper label="starting level" value={level} min={1} max={LEVELS[LEVELS.length - 1]!} onChange={onLevel} />
        )}
        <p className="auth__meta">{levels?.hint ?? "Your GM approves it. Ask them if you're not sure."}</p>
      </div>
      </>
      )}
      {shows('hp') && hpAsk !== null && (
        <div className="field">
          <label className="label" htmlFor="character-hp">
            {hpAsk ? 'Hit points' : 'HP max (optional)'}
          </label>
          <input
            id="character-hp"
            className="field__input field__input--short"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={hp}
            onChange={(event) => onHp(event.target.value)}
            aria-describedby="character-hp-hint"
          />
          <p id="character-hp-hint" className="auth__meta">
            {hpAsk ? hpAsk.hint : HP_HINT}
          </p>
        </div>
      )}
      {shows('story') && (
      <div className="field">
        <label className="label" htmlFor="character-backstory">
          Backstory (optional)
        </label>
        <textarea
          id="character-backstory"
          className="field__input field__textarea"
          rows={4}
          maxLength={4000}
          value={backstory}
          onChange={(event) => onBackstory(event.target.value)}
        />
      </div>
      )}
      {shows('details') && <CampaignFields fields={fieldDefs} inputs={fieldInputs} onField={onField} help={help} hide={hide} traitLists={traitLists} />}
    </>
  );
}

/** The dice for starting HP: the class's hit dice at this level (filled), or its hit die. */
function hitDiceFor(setting: CampaignSetting, choice: GuidedChoice, level: number, fieldDefs: FieldDefinition[]): string | null {
  const { filled } = settingFills(setting, { level, scores: choice.scores, classRef: choice.klass.packEntryId, raceRef: choice.race?.packEntryId ?? null }, fieldDefs);
  if (typeof filled.hitDice === 'string' && filled.hitDice.trim()) return filled.hitDice.trim();
  const die = choice.klass.data.hitDie;
  return typeof die === 'string' && die.trim() ? die.trim() : null;
}

/** The setting's starting money roll (rules set startingMoney, the top one that says), as text; '' when none. */
function startingMoneyOf(rulesSets: readonly Record<string, unknown>[]): string {
  for (const rules of [...rulesSets].reverse()) if (typeof rules.startingMoney === 'string' && rules.startingMoney.trim()) return rules.startingMoney.trim();
  return '';
}

/** The race's and class's languages, once each, for an empty languages field; one named after a field follows it (N7). */
function languagesOf(choice: GuidedChoice, fieldDefs: readonly FieldDefinition[], inputs: FieldInputs, rulesSets: readonly Record<string, unknown>[]): string {
  return startingLanguages([choice.race?.data.languages, choice.klass.data.languages], fieldDefs, inputs, languageNamer(rulesSets));
}

/**
 * A new character's starting level from the campaign's setting (B21, ruled 2026-10-25): set by the campaign
 * ("You start at level N") or proposed by the player with a stepper, and what the line under it says.
 */
function levelChoice(settings: Record<string, unknown>, lowest: number, level: number): { max: number | null; hint: string } {
  const start = startLevelOf(settings);
  const max = startLevelLimit(start, lowest, startLevelFixedOf(settings));
  const then = !joinsAtOnce(settings, level, lowest) ? ' Your GM approves it.' : '';
  if (start === 'one') return { max, hint: `Everyone starts at the beginning.${then}` };
  if (start === 'lowest') return { max, hint: `The level of the lowest active character.${then}` };
  if (start === 'fixed') return { max, hint: `The level set for this campaign.${then}` };
  return { max, hint: `The party's lowest is level ${lowest}. Propose another and your GM decides.` };
}

/**
 * The toast when a character joins the party at once (walk fix, ruled 2026-11-12). Only a player's first approved
 * character becomes active by itself (05); when they already play another, the toast offers "Play as <name>": the
 * same switch as Your characters, with its rules, its result shown as a toast. Nothing changes until it's tapped.
 */
async function joinedToast(db: Db, user: CurrentUser, campaignId: string, character: { id: string; name: string }, show: (toast: ToastRequest) => void): Promise<ToastRequest> {
  const text = `${character.name} has joined the party.`;
  const active = await loadActiveCharacterId(db, campaignId, user.id);
  if (!active || active === character.id) return { text };
  const playAs = async () => {
    const target = { id: character.id, ownerUserId: user.id, approval: 'approved', archived: false };
    const result = await runCommand(registry, db, user, setActiveCharacter, { campaignId, character: target });
    show(result.ok ? { text: `${character.name} is now your active character.` } : { text: result.message, error: true });
  };
  return { text, action: { label: `Play as ${character.name}`, run: () => void playAs() } };
}

// "Who are they?": with setting rules that have classes, Guided (scores, race, class, adjustments, then this form,
// filled in) or Freeform first (ruled 2026-10-25); without, freeform only. Then "… is ready". Every creation step's
// Leave (cw-11) goes where Save and leave goes.
export function CreateCharacter(props: Omit<Parameters<typeof CreateCharacterSteps>[0], 'onStartOver'>) {
  // Start over (final drafts D): the draft is deleted, and creation begins again at step 1, nothing kept.
  const [round, setRound] = useState(0);
  return (
    // Creation's ⋯ carries the app's own menu (final draft 9): on a phone the app's row hides while creating.
    <CreationLeave onLeave={props.onLeave ?? props.onDone} menu={<ShellMenuItems />}>
      <CreateCharacterSteps key={round} {...props} draft={round === 0 ? props.draft : undefined} onStartOver={() => setRound((n) => n + 1)} />
    </CreationLeave>
  );
}

function CreateCharacterSteps({
  db,
  user,
  campaign,
  draft,
  onDone,
  onLeave = onDone,
  onStartOver,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** A guided draft reopened from Your characters (m5b-0c slice 7): it opens on its review, every step as saved. */
  draft?: MyCharacter;
  onDone: () => void;
  /** After Start over deleted the draft (final drafts D): creation again from step 1. */
  onStartOver: () => void;
  /** Save and leave on the review (defaults to onDone). */
  onLeave?: () => void;
}) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState('');
  // Whether the hit points' average stepper was touched (final drafts A5, C): untouched, the average stands and the
  // draft says so ("the average, not rolled"). A flag, never a comparison of values.
  const [hpTouched, setHpTouched] = useState(false);
  /** Back to the untouched average (a new class's die, a roll kept on the draft, Roll again). */
  const resetHp = () => {
    setHp('');
    setHpTouched(false);
  };
  // The roll the player chose to keep after the re-roll callout (cf-1): the callout stays hidden for it.
  const [keptRoll, setKeptRoll] = useState<string | null>(null);
  // A derived field tapped on Who they are (bq-2): its breakdown.
  const [breakdown, setBreakdown] = useState<{ title: string; lines: string[] } | null>(null);
  const [backstory, setBackstory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Who they are's send that failed (follow-up E, mockup creation/13): on the foot's ▲ line, Next the retry; offline
  // says so in its own words.
  const [sendFailed, setSendFailed] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [campaignFields, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [fieldInputs, setFieldInputs] = useState<FieldInputs>({});
  const [portrait, setPortraitChoice] = useState<PortraitChoice>(null);
  const setSentNote = useErrorToast();
  const [joined, setJoined] = useState(false);
  const [rules, setRules] = useState<{ settings: Record<string, unknown>; lowest: number } | null>(null);
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  const [path, setPath] = useState<'start' | 'guided' | 'form' | null>(null);
  // Picks this player left in this campaign on this device (cw-13), offered before anything else; never for a draft.
  const [keptPicks, setKeptPicks] = useState<KeptPicks | null>(() => (draft ? null : readKept(user.id, campaign.id)));
  const [continueKept, setContinueKept] = useState(false);
  // Continue's sheet closed with ✕ (final drafts F): the start screen, the picks still kept.
  const [keptAside, setKeptAside] = useState(false);
  const [chosen, setChosen] = useState<GuidedChoice | null>(null);
  // A field whose option is off isn't asked (of-9), nor one not for the class or kindred picked (cs-3, `forClasses`,
  // `forRaces`); the values of both stay in the inputs and are sent back as they were, so they stay saved.
  const fieldsOffNow = fieldsOffFor(setting, chosen ? { classRef: chosen.klass.packEntryId, raceRef: chosen.race?.packEntryId ?? null } : null);
  const fieldDefs = fieldsInPlay(campaignFields, fieldsOffNow);
  /** The values of the fields hidden for this character (as typed or saved), to keep them saved. */
  const hiddenValues = (inputs: FieldInputs) => {
    const read = fieldsOffNow && fieldsOffNow.size > 0 ? readFieldInputs(campaignFields.filter((f) => fieldsOffNow.has(f.key)), inputs) : null;
    return read?.ok ? read.values : {};
  };
  // A field fed by a table opened on Who they are (the knight's liege, cs-3), by key.
  const [tableOpen, setTableOpen] = useState<string | null>(null);
  // A table field's row opened to read (cw-5: a liege's house, its entry with Pick at its foot).
  const [tableRowOpen, setTableRowOpen] = useState<{ key: string; at: number } | null>(null);
  // Going back into the guided steps from "Who are they?" (Back: the adjustments; Change: the class), with what was chosen.
  const [resumeAt, setResumeAt] = useState<GuidedStep | null>(null);
  // The Undo of a class Pick that moved on to "Who are they?" (ct-1): the class step again with nothing picked.
  const [resumeUnpick, setResumeUnpick] = useState(false);
  // What the setting filled into linked fields last, so a value the player changed is kept (and marked edited).
  const [filledInputs, setFilledInputs] = useState<Record<string, string>>({});
  const [money, setMoney] = useState('');
  // After a guided character is made (a draft): the steps that follow "Who are they?" in the pack's order (ruled
  // 2026-11-01, ⚑ 2): its starting gear (ruled 2026-10-25) and its languages (M5b step 0); then the review.
  // The steps after "Who are they?": a guide step, or one trait list ("trait:<list id>"; M5b step 0b).
  // `review`: the step was opened from the review (Change ›, Do it now ›): no counter, and Next or Back returns there.
  // `back`: reached by Back (final drafts F): a step with nothing to ask says why instead of moving on.
  const [later, setLater] = useState<{ character: CharacterRef; creation: Record<string, unknown>; steps: string[]; at: number; review?: boolean; back?: boolean } | null>(null);
  // First spells' picks (m5b-0c slice 4), kept here so Back keeps them.
  const [spellPicks, setSpellPicks] = useState<FirstSpellsPicks>(NO_PICKS);
  // A guided character is a draft until it's sent from the review, after the gear (ruled 2026-10-26).
  const [drafted, setDrafted] = useState<string | null>(draft?.id ?? null);
  // The review (cr-18, m5b-0c slice 7): the draft, re-read after each change; Who they are changed from it edits the
  // draft instead of making one (`whoChange`); a reopened draft's hit points stay as saved until a new roll is typed.
  const [draftRef, setDraftRef] = useState<CharacterRef | null>(draft ? refOf(draft) : null);
  // One exit button (follow-up E, nit 4): once the draft exists the top button reads "Save and leave".
  useLeaveWord(draftRef ? 'Save and leave' : 'Leave');
  const hostLeave = useCreationLeave();
  const [whoChange, setWhoChange] = useState(false);
  const [keptHp, setKeptHp] = useState<number | null>(null);
  const [savedPortrait, setSavedPortrait] = useState<string | null>(draft?.portraitAssetId ?? null);
  const [reviewVersion, setReviewVersion] = useState(0);
  // An alignment row's entry, opened from its text on Who they are (ct3-11).
  const [alignmentOpen, setAlignmentOpen] = useState<string | null>(null);
  // A closed alignment row's explanation (cw-8).
  const [alignmentClosed, setAlignmentClosed] = useState<string | null>(null);
  // A closed alignment asked for with Ask the GM to allow it (final drafts C, ⚑3): picked and flagged.
  const [alignmentAsked, setAlignmentAsked] = useState<string | null>(null);
  // Derived fields on Who they are start folded on every width; this device remembers how they were left (cw-7).
  const [derivedOpen, setDerivedOpen] = useFoldOpen('derived');
  const [resumed, setResumed] = useState(!draft);
  // Change › on Scores, Race or Class from the review (cf-7, follow-up C): the draft being redone, as saved when the
  // step was opened; the re-walk runs on the guided steps with every value kept, then `creation.redo` writes it.
  const [redo, setRedo] = useState<{ ref: CharacterRef; character: MyCharacter } | null>(null);
  // After a race or class change (ruled B, 2026-11-02): Who they are first, for the new hit-point roll, then these steps.
  const [afterWho, setAfterWho] = useState<{ character: CharacterRef; creation: Record<string, unknown>; steps: string[] } | null>(null);
  // Walking back before the review (ct3-5): Back from the first step after Who they are reopens it on the draft, and
  // its Back the guided steps (as a redo); going forward again picks up the same steps, every pick kept.
  const [walkBack, setWalkBack] = useState(false);
  // The one place the walk back ends (cs-39a, #750 review round 2): whenever the review is on screen, by whatever road
  // (Next from the last step, Back and forward again, Change and its finish, a changed kindred or class or its Undo, a
  // setting with nothing after Who they are), nothing is being walked back any more, so a step the review's Change opens
  // is one again. The same condition the review is drawn under (below, "the review comes last"). Start over remounts
  // these steps (CreateCharacter's key), which starts the flag afresh.
  const reviewShown = !!(drafted && chosen && setting && draftRef && !whoChange && !later && !redo);
  // Set during render, not in an effect (React's "adjusting state when something changes"): the review never draws a
  // frame with the flag still set, and nothing cascades.
  if (reviewShown && walkBack) setWalkBack(false);
  // A step opened from the review (Change, Do it now) says where its Back goes: "Back to review" (P22, 2026-11-06).
  // The guided steps' redo says it itself (GuidedCreation).
  useBackWord(!!later?.review || (whoChange && !walkBack) ? 'Back to review' : null);
  const toast = useToast();

  // What a step after "Who are they?" has picked but not saved yet, so Back keeps it (cr-2; m5b-0c slice 6).
  const [stepPicks, setStepPicks] = useState<{ languages?: LanguagePicks; weaponSkills?: WeaponSkill[]; expertise?: Expertise; traits?: Record<string, TraitPick[]>; traitSpells?: Record<string, RolledSpell | null>; details?: CharacterDetails }>({});
  // A draft reopened (m5b-0c slice 7): the choice, the values and the picks as saved, so every step and the review
  // read them as if the walk had just ended. Without its class in the setting it stays on the older review (below).
  function resumeDraft(found: MyCharacter, setting: CampaignSetting, fieldDefs: FieldDefinition[]) {
    setResumed(true);
    const creation = asRecord(found.creation);
    const klass = setting.all.find((e) => e.kind === 'class' && e.packEntryId === found.classRef);
    if (!klass) return;
    const race = found.raceRef ? (setting.all.find((e) => e.kind === 'race' && e.packEntryId === found.raceRef) ?? null) : null;
    const numbers = (value: unknown) => Object.fromEntries(Object.entries(asRecord(value)).filter((pair): pair is [string, number] => typeof pair[1] === 'number'));
    const choice: GuidedChoice = {
      method: typeof creation.method === 'string' ? creation.method : null,
      race,
      klass,
      rolled: numbers(creation.rolled),
      scores: numbers(creation.scores),
      ...(Array.isArray(creation.scoresAverage) ? { scoresAverage: creation.scoresAverage.filter((k): k is string => typeof k === 'string') } : {}),
      ...(Array.isArray(creation.specialApprovals) ? { special: creation.specialApprovals as SpecialApproval[] } : {}),
      ...(typeof creation.overrideReason === 'string' ? { reason: creation.overrideReason } : {}),
      ...patronChoiceOf(creation),
    };
    setChosen(choice);
    setName(found.name);
    setLevel(found.level);
    setBackstory(found.backstory);
    setKeptHp(found.hpMax);
    // What the setting fills now, so a value the player changed is still told apart (keep-or-use, edited fields).
    const { filled, links } = settingFills(setting, { level: found.level, scores: choice.scores, classRef: klass.packEntryId, raceRef: race?.packEntryId ?? null }, fieldDefs);
    const fills: Record<string, string> = {};
    for (const def of fieldDefs) {
      const link = links.get(def.key);
      const value = link ? filledAt(filled, link) : undefined;
      if (value !== undefined) fills[def.key] = showFilled(value);
    }
    setFilledInputs(fills);
    setFieldInputs(fieldInputsFrom(fieldDefs, found.fields));
    if (typeof creation.startingMoney === 'number') setMoney(String(creation.startingMoney));
    setStepPicks({ weaponSkills: weaponSkillsOf(found.weaponSkills), expertise: readExpertise(found.expertise), details: detailsOf(found.fields) });
    const plan = firstSpellsPlan(klass, found.level, { spells: setting.all.filter((e) => e.kind === 'spell'), lists: entriesInPlay(setting.all).filter((e) => e.kind === 'spellList'), tables: entriesInPlay(setting.all).filter((e) => e.kind === 'table'), choices: campaignChoices(setting) }, raceAsPlayed(race, klass), patronInSetting(setting, found.creation), classListOf(setting));
    if (plan) setSpellPicks(picksFromBook(plan, spellBookOf(found.spellBook)));
    setPath('form');
  }

  useEffect(() => {
    let current = true;
    loadFieldDefinitions(db, campaign.id).then(
      (found) => current && found && setFieldDefs(found),
      () => undefined,
    );
    // The campaign's new-character settings; a new character starts at the most it may (ruled 2026-10-25).
    void loadNewCharacterRules(db, campaign.id).then((found) => {
      if (!current || !found) return;
      setRules(found);
      setLevel(startLevelLimit(startLevelOf(found.settings), found.lowest, startLevelFixedOf(found.settings)) ?? found.lowest);
    });
    // Guided is offered when the setting rules have classes; until they're read (or without them), freeform.
    void loadCampaignSetting(db, user.id, campaign.id).then((found) => {
      if (!current) return;
      setSetting(found);
      setPath((was) => was ?? (found?.all.some((e) => e.kind === 'class') ? 'start' : 'form'));
    });
    // A draft reopened: its values once the setting and the fields are both in.
    if (draft) {
      void Promise.all([loadFieldDefinitions(db, campaign.id).catch(() => null), loadCampaignSetting(db, user.id, campaign.id)]).then(([defs, found]) => {
        if (!current) return;
        if (found) resumeDraft(draft, found, defs ?? []);
        else setResumed(true);
      });
    }
    return () => {
      current = false;
    };
    // Once per campaign (a reopened draft is read once, as it opens).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, campaign.id, user.id]);
  // The setting's fills for the guided choice at a level: linked fields follow until the player edits them.
  function refill(choice: GuidedChoice, atLevel: number, base: FieldInputs) {
    if (!setting) return base;
    const { filled, links } = settingFills(setting, { level: atLevel, scores: choice.scores, classRef: choice.klass.packEntryId, raceRef: choice.race?.packEntryId ?? null }, fieldDefs);
    const next: Record<string, string> = {};
    for (const def of fieldDefs) {
      const name = links.get(def.key);
      // A fill name may reach into a row ("abilityModifiers.WIT.literacy"): filledAt finds it (m5b-0c slice 3).
      const value = name ? filledAt(filled, name) : undefined;
      if (value !== undefined) next[def.key] = showFilled(value);
    }
    const updated = { ...base };
    for (const [key, value] of Object.entries(next)) if (base[key] === undefined || base[key] === '' || base[key] === filledInputs[key]) updated[key] = value;
    setFilledInputs(next);
    setFieldInputs(updated);
    return updated;
  }
  const changeLevel = (value: number) => {
    setLevel(value);
    if (chosen) refill(chosen, value, fieldInputs);
  };
  // A set starting level is capped at the class's highest (B21; the race may lower it).
  const cap = chosen ? classLevelCap(chosen.klass, raceAsPlayed(chosen.race ?? null, chosen.klass)) : null;
  const setLevels = rules ? levelChoice(rules.settings, rules.lowest, level) : undefined;
  const levels = setLevels && setLevels.max !== null && cap !== null && cap < setLevels.max ? { ...setLevels, max: cap } : setLevels;
  const atOnce = rules ? joinsAtOnce(rules.settings, level, rules.lowest) : false;
  // HP only when a sheet layout asks (ruled 2026-10-24): the dice from the class at this level, rolled at the table.
  const hitDice = chosen && setting ? hitDiceFor(setting, chosen, level, fieldDefs) : null;
  // What the setting fills for this choice at this level (A5): the HP line's modifier, the language hint.
  // The expertise points picked so far (G-208): the class skills' figures follow them.
  const settingFilled = chosen && setting ? settingFills(setting, { level, scores: chosen.scores, classRef: chosen.klass.packEntryId, raceRef: chosen.race?.packEntryId ?? null, ...(stepPicks.expertise ? { expertise: stepPicks.expertise } : {}) }, fieldDefs) : null;
  const baseFills = settingFilled?.filled ?? {};
  // The kindred's and class's AC bonuses (cs-7): those that count unarmoured join creation's AC and its parts.
  const acBonuses = chosen && setting ? characterAcBonuses(setting, { level, classRef: chosen.klass.packEntryId, raceRef: chosen.race?.packEntryId ?? null }) : [];
  const guidedFills = chosen && setting ? withCreationAc(setting, baseFills, fieldDefs, acBonuses) : {};
  // AC's parts beside it on Derived fields (ct-5), when the AC is the unarmoured one worked out at creation.
  const acParts = setting && baseFills.ac === undefined && guidedFills.ac !== undefined ? creationAcParts(setting, guidedFills, (key) => abilityNames(setting.rulesSets, fieldDefs)(key).long, acBonuses) : null;
  // And what the race says beside a figure (a save's bonus by CON, a skill target in a situation; fills.ts raceNotes).
  const derivedNotes: Record<string, string> = { ...(settingFilled?.notes ?? {}), ...(acParts ? { ac: acParts } : {}) };
  // A derived field's breakdown (bq-2: every worked-out figure tappable wherever it appears): the full sheet's words,
  // from the draft's picks; AC worked out at creation reads as the AC tile's pop-up, nothing worn yet.
  const explainDraft = chosen && setting ? creationExplainer(setting, { level, scores: chosen.scores, classRef: chosen.klass.packEntryId, raceRef: chosen.race?.packEntryId ?? null }, guidedFills, settingFilled, fieldDefs) : null;
  const derivedBreakdown = (key: string, label: string): { title: string; lines: string[] } | null => {
    const fill = fieldDefs.find((f) => f.key === key)?.fill?.trim();
    if (!fill || !explainDraft || !setting) return null;
    return { title: label, lines: fill === 'ac' && acParts ? creationAcLines(setting, baseFills, fieldDefs, acBonuses) : explainDraft(fill) };
  };
  // The HP prompt says what to roll and what to add (A6; words batch 1, §2).
  const hpAsk = rules && hpRequiredOf(rules.settings)
    ? { hint: chosen ? hpPromptLine({ hitDice, level, modifier: hpModifierOf(guidedFills) }) : hitDice ? `Roll ${hitDice} at the table and type the total.` : 'Roll them at the table and type the total.' }
    : null;
  // Who they are (cr-12): the roll typed, the class's dice and the HP modifier shown, the pack's minimum applied.
  // The modifier's ability by its full name ("for your Grit", after-test A7/A9).
  const hpModifier = hitDice ? hpModifierOf(guidedFills) : null;
  const hpRule: HpRoll | null =
    chosen && setting && hpAsk
      ? {
          dice: hitDice ?? '',
          modifier: hpModifier && { ...hpModifier, ability: abilityNames(setting.rulesSets, fieldDefs)(hpModifier.ability).long, ...(typeof chosen.scores[hpModifier.ability] === 'number' ? { score: chosen.scores[hpModifier.ability] } : {}) },
          minimum: hitDice ? hpMinimum(setting.rulesSets) : null,
        }
      : null;
  // The die's average, prefilled in the stepper until touched (final drafts A5, C); null without dice.
  const hpAverage = hpRule?.dice ? diceAverage(hpRule.dice) : null;
  // A reopened draft keeps its saved hit points while nothing new is entered (m5b-0c slice 7).
  const hpKeptNow = whoChange && hp.trim() === '' && keptHp !== null;
  // The average left as it was: it counts as the roll, flagged on the draft.
  const hpLeftAverage = !hpTouched && hpAverage !== null && !hpKeptNow;
  // The roll that counts: what was entered, else the average while untouched.
  const hpText = hpLeftAverage ? String(hpAverage) : hp;
  // The alignment as option rows with the pack's notes (cr-12), when the campaign keeps one and the setting names them.
  const alignmentField = fieldDefs.find((def) => def.key.toLowerCase() === 'alignment' && !def.hidden) ?? null;
  const alignments = chosen && setting && alignmentField ? alignmentRows(alignmentField.choices, setting.rulesSets) : [];
  // Their names, before a class is chosen too: the Patron step crosses each patron with the class's limit against them (fix-patron-class-alignment).
  const alignmentNames = setting ? alignmentNamesOf(fieldDefs, setting.rulesSets) : [];
  // The class's alignment limit (cs-3, rc-5): a hard one leaves the others out with a line; a soft one flags them.
  const alignmentLimit = chosen ? classAlignmentLimit(chosen.klass.data) : null;
  const klassWord = chosen?.klass.name.toLowerCase() ?? '';
  const alignmentOffered = alignmentOffer(alignments, alignmentLimit, klassWord);
  const alignmentPicked = (inputs: FieldInputs) => (alignmentField && typeof inputs[alignmentField.key] === 'string' ? String(inputs[alignmentField.key]) : '');
  /**
   * A closed alignment taken by Ask the GM to allow it (final drafts C, ⚑3): asked here, or flagged on the draft
   * already (a reopened draft). It stays flagged for the GM instead of blocking Next.
   */
  const alignmentAskedFor = (value: string) => !!value && (alignmentAsked === value || (chosen?.special ?? []).some((s) => s.step === 'alignment' && s.name === value));
  // The patron (December 1a), picked on the Patron step after Class (pt-10, 2026-11-12) and carried on the guided
  // choice: the one picked while the class is offered it (its own option on, its followers naming the class). Who they
  // are reads it for the alignment it sets or narrows.
  // Each with how it sits with the class's alignment limit (fix-patron-class-alignment): a closed one isn't on offer.
  const patronFit = chosen ? patronFitTo(chosen.klass.data, alignmentNames) : undefined;
  const patronsOffered = chosen && setting ? patronsFor(setting.all.filter((e) => e.kind === 'patron'), chosen.klass.packEntryId, setting.packs, patronFit) : [];
  const patronOffer = patronsOffered.find((o) => o.patron.id === chosen?.patron?.id) ?? null;
  const patron = patronOffer?.patron ?? null;
  // Put off (Decide later): only while a patron the class may follow is on offer and none is picked.
  const patronPutOff = patronsOffered.some((o) => o.fit !== 'closed') && !patron && !!chosen?.patronLater;
  /**
   * What a patron does to Who they are's fields (pt-3, pt-7; picked on its own step now, pt-10): it sets the alignment
   * when its followers have one, clears one they can't have, and fills the Affiliation field while that is empty or
   * still holds the last patron's name (`previous`). The fields it changes, and what it did, for the toast.
   */
  function patronFills(choice: GuidedChoice, inputs: FieldInputs, previous: string) {
    const next: Patron | null = choice.patron && setting ? (patronsFor(setting.all.filter((e) => e.kind === 'patron'), choice.klass.packEntryId, setting.packs).find((o) => o.patron.id === choice.patron!.id)?.patron ?? null) : null;
    const str = (key: string) => (typeof inputs[key] === 'string' ? String(inputs[key]) : '');
    const rows = alignmentField && setting ? alignmentRows(alignmentField.choices, setting.rulesSets) : [];
    const wasAlignment = alignmentField ? str(alignmentField.key) : '';
    const change = next && alignmentField && rows.length > 0 ? patronAlignmentChange(next, wasAlignment, rows) : null;
    const also = alsoFillsField(fieldDefs, 'affiliation');
    const alsoWas = also ? str(also.key) : '';
    const writeAlso = !!also && mayAlsoFill(alsoWas, previous) && alsoWas !== (next?.name ?? '') && (!!next || !!alsoWas);
    const fields: FieldInputs = {};
    if (change && alignmentField) fields[alignmentField.key] = 'set' in change ? change.set : '';
    if (writeAlso && also) fields[also.key] = next?.name ?? '';
    return { patron: next, fields, change, wasAlignment, also: writeAlso ? also : null };
  }
  /** The picks the GM approves specially: the race's and class's, a patron marked for the GM's approval, and the alignment when a soft limit leaves it out or it was asked for. */
  const specialWith = (inputs: FieldInputs): SpecialApproval[] => {
    const value = alignmentPicked(inputs);
    const flaggedPatron = offeredPatronApproval(patronOffer, patronFit, klassWord);
    const own = [...(chosen?.special ?? []).filter((s) => s.step !== 'alignment' && s.step !== 'patron'), ...(flaggedPatron ? [flaggedPatron] : [])];
    const fit = alignmentLimit && alignments.length > 0 ? alignmentFit(alignmentLimit, value) : 'ok';
    if (fit === 'soft' && alignmentLimit) return [...own, { step: 'alignment', entryId: value, name: value, requirement: alignmentRequirement(alignmentLimit, klassWord) }];
    if (fit === 'closed' && alignmentAskedFor(value)) return [...own, { step: 'alignment', entryId: value, name: value, requirement: alignmentClosedReason(klassWord, value).replace(/\.$/, '') }];
    return own;
  };
  // Guided creation explains alignment and literacy, names extra languages, and hides what the setting fills in (A5).
  const guidedHelp: Record<string, FieldHelp> = {};
  if (chosen && setting) {
    for (const def of fieldDefs) {
      const key = def.key.toLowerCase();
      if (key === 'alignment') guidedHelp[def.key] = { about: alignmentAbout(setting.rulesSets) };
      if (key === 'literacy') guidedHelp[def.key] = { about: literacyAbout(setting.rulesSets) };
      if (key === 'languages') guidedHelp[def.key] = { hint: extraLanguagesHint(guidedFills) ?? 'Your race and class languages are filled in; your scores add none.' };
    }
  }
  // The fields the sheet layout leaves to play (`atCreation: false`, ct3-3 ruled B 2026-11-03): no step asks them.
  const notAsked = setting ? notAskedAtCreation(setting.all) : new Set<string>();
  // What the setting decides is filled in and not asked (05: defence, saves, attack, movement, race, title); literacy
  // is filled too but stays, with its ⓘ, because 05 has it explained. The ability scores were set in the steps
  // before, so they're kept but not shown again: they appear on the character screen (ruled 2026-10-26).
  const hideFilled = (def: FieldDefinition) =>
    !!chosen &&
    ((!!languagePlan && def.key === languagesField?.key) ||
      // The weapon skills step owns its sheet field, as the languages step owns languages.
      ownedByWeaponSkills(def.key, !!weapons) ||
      traits.some((t) => t.field.key === def.key) ||
      // A list's field the character doesn't take (ct3-4b: the list leaves out their race, or its option is off) is
      // never asked; one the sheet layout marks `atCreation: false` (ct3-3, ruled B 2026-11-03) stays for the sheet.
      ownedByTraitList(def, lists, layout) ||
      notAsked.has(def.key) ||
      !!def.fill ||
      (alignments.length > 0 && def.key === alignmentField?.key) ||
      def.key.toLowerCase() === 'race' ||
      Object.keys(chosen.scores).some((k) => holdsAbility(def.key, k)));
  // Starting money (ruled 2026-10-25, until purses in M7): the setting's roll, entered; saved for the shopping and M7.
  const moneyRoll = chosen && setting ? startingMoneyOf(setting.rulesSets) : '';
  // The languages step (N13, M5b step 0; on the shell, m5b-0c slice 6, cr-15): when the setting names languages and
  // the campaign keeps them in a text field. Given + Pick N more; skipped when there is nothing to pick, the given ones
  // then going straight to the sheet. The field belongs to the step either way (never asked on Who they are).
  const languagesField = fieldDefs.find((def) => def.key.toLowerCase() === 'languages' && !def.hidden && !notAsked.has(def.key) && (def.type === 'text' || def.type === 'longtext')) ?? null;
  const offeredLanguages = setting ? settingLanguages(setting.all.filter((e) => e.kind === 'race' || e.kind === 'class'), fieldDefs.map((f) => f.label), languageNamer(setting.rulesSets)) : [];
  // Trait lists (M5b step 0b): one step per list a sheet field points at, when the setting has the list.
  // On the shell (m5b-0c slice 6, cr-17): an option-gated list is absent when off; a per-race list follows the race.
  const lists = setting ? traitListsOf(setting.all) : [];
  const layout = setting ? layoutHints(setting.all) : new Map<string, never>();
  /**
   * The steps after "Who are they?" for a choice at a level (the ones present, in the pack's order), with what each
   * reads: worked out for the choice made, and again for a new one when Change › redoes the race or class (cf-7).
   * Gear (cr-14, m5b-0c slice 5): when the setting rolls starting money, gives everyone starting equipment (cf-4), or
   * has kits for the class. First spells (cr-13): only for a class whose firstSpells or known gives something at this level.
   * Weapon skills (M5b-0b): only while the setting's weapon proficiency is on for the class.
   */
  const plannedFor = (choice: GuidedChoice | null, atLevel: number) => {
    const rs = setting?.rulesSets ?? [];
    // The fields for THIS choice's class and kindred (after-test A3): a class changed from the review is planned with
    // the new class's fields (its combat talents), not those of the class picked before.
    const defs = fieldsInPlay(campaignFields, fieldsOffFor(setting, choice ? { classRef: choice.klass.packEntryId, raceRef: choice.race?.packEntryId ?? null } : null));
    // The kindred's starting items (cs-2) give the step too, as the class plays the kindred (cs-4).
    // A kindred's trinket table (cs-1) gives the step too: the trinket is rolled with the kit rolls.
    const trinketHere = !!setting && !!choice && creationTablesOf(setting, raceAsPlayed(choice.race, choice.klass)).trinket !== null;
    const gearHere = !!setting && (trinketHere || !!startingMoneyOf(rs) || startingEquipment(rs).length > 0 || startingPicks(rs).length > 0 || (!!choice && kindredItems(raceAsPlayed(choice.race, choice.klass)?.data).length > 0) || (!!choice && kitsOffered(entriesInPlay(setting.all).filter((e) => e.kind === 'startingKit'), choice.klass.packEntryId).kits.length > 0));
    const languagePlan =
      choice && setting && languagesField
        ? languagesPlan({
            rulesSets: rs,
            race: choice.race,
            klass: choice.klass,
            scores: choice.scores,
            alignment: alignmentField && typeof fieldInputs[alignmentField.key] === 'string' ? String(fieldInputs[alignmentField.key]) : null,
            fields: defs,
            legacy: offeredLanguages,
            // Who may learn each language (cs-6): the kindred's creature type, which a kindred-class keeps (cs-4).
            creatureType: typeof choice.race?.data.creatureType === 'string' ? choice.race.data.creatureType : '',
          })
        : null;
    const languagesStep = !!languagePlan && languagesStepExists(languagePlan);
    const languagesHere = choice ? languagesStep : !!languagesField && offeredLanguages.length > 0;
    const weapons = choice ? weaponSetup(setting, choice.klass.packEntryId, atLevel) : null;
    // Expertise (G-208, ex-3, ct-10): only while the class's points are in force (its option on).
    const expertise = choice ? expertiseSetup(choice.klass.data, rs) : null;
    const raceId = choice && setting ? (choice.race?.packEntryId ?? classRace(choice.klass.data, setting.all.filter((e) => e.kind === 'race'))?.packEntryId ?? null) : null;
    const traits = traitSteps(defs.filter((def) => !notAsked.has(def.key)), lists, setting ? { layout: layoutHints(setting.all), raceId, choices: campaignChoices(setting) } : {});
    const spellPlan =
      choice && setting
        ? firstSpellsPlan(choice.klass, atLevel, {
            // Every spell, those switched off marked: the plan keeps only those in play (of-2).
            spells: setting.all.filter((e) => e.kind === 'spell'),
            lists: entriesInPlay(setting.all).filter((e) => e.kind === 'spellList'),
            tables: entriesInPlay(setting.all).filter((e) => e.kind === 'table'),
            choices: campaignChoices(setting),
          }, raceAsPlayed(choice.race, choice.klass), patronsFor(setting.all.filter((e) => e.kind === 'patron'), choice.klass.packEntryId).find((o) => o.patron.id === choice.patron?.id)?.patron ?? null, classListOf(setting))
        : null;
    const expand = (steps: readonly GuideStep[]): string[] => steps.flatMap((s) => (s === 'traits' ? traits.map((t) => `trait:${t.id}`) : [s]));
    // Details (cs-1): optional, always last before the review, when the kindred (as played) has tables or dice for it.
    const kindredPlayed = choice ? raceAsPlayed(choice.race, choice.klass) : null;
    const details: string[] = setting && kindredPlayed && detailsStepExists(kindredPlayed, creationTablesOf(setting, kindredPlayed)) ? ['details'] : [];
    const present = (languagesIn: boolean): GuideStep[] => [...(spellPlan ? (['spells'] as const) : []), ...(gearHere ? (['gear'] as const) : []), ...(languagesIn ? (['languages'] as const) : []), ...(weapons ? (['weaponSkills'] as const) : []), ...(expertise ? (['expertise'] as const) : []), ...(traits.length > 0 ? (['traits'] as const) : [])];
    return {
      gearHere,
      languagePlan,
      languagesStep,
      weapons,
      expertise,
      raceId,
      traits,
      spellPlan,
      // For the step counter: those present, then the review (freeform counts the legacy languages field).
      steps: setting ? [...expand(laterSteps(rs, present(languagesHere))), ...details] : [],
      // What's walked once the draft is made (the languages only as a step with something to pick).
      walked: setting ? [...expand(laterSteps(rs, present(languagesStep))), ...details] : [],
    };
  };
  // The kindred as the character plays it (cs-4: a kindred-class keeps its kindred's tables) and its creation tables
  // (cs-1): the Name field's roll and the Details step read them.
  const kindredNow = chosen ? raceAsPlayed(chosen.race, chosen.klass) : null;
  const kindredTablesNow = setting && kindredNow ? creationTablesOf(setting, kindredNow) : NO_TABLES;
  // The Name field's tables on Who they are (final drafts C): the rows under the field, the open table as a sheet.
  const nameRoll = useNameRoll({ tables: nameTablesOf(kindredTablesNow), name, onName: setName });
  const planned = plannedFor(chosen, level);
  const { languagePlan, weapons, traits, spellPlan } = planned;
  // Skipped with nothing to pick (cr-15), or put off: the given languages are the sheet's from the start.
  const withGivenLanguages = (inputs: FieldInputs): FieldInputs => (languagePlan && languagesField ? { ...inputs, [languagesField.key]: languageText(languagePlan.given.map((g) => g.name)) } : inputs);
  const required = setting ? requiredSteps(setting.rulesSets) : new Set<string>();
  const laterPlanned = planned.steps;
  const ownSteps = setting ? guidedStepCount(setting, chosen ?? null, alignmentNames) : 0;
  const totalSteps = ownSteps + 1 + laterPlanned.length + 1;

  /**
   * The draft's creation record with its alignment approval (step "alignment") replaced by this one, if any, and the
   * hit points' average flag set (`hpAverage`: true, false, or null to keep it); null when unchanged or unread.
   */
  async function draftCreationWith(id: string, special: readonly SpecialApproval[], hpAverage: boolean | null = null): Promise<Record<string, unknown> | null> {
    const mine = await loadMyCharacters(db, campaign.id, user.id);
    const saved = mine?.find((c) => c.id === id);
    if (!saved) return null;
    const record = asRecord(saved.creation);
    const was = Array.isArray(record.specialApprovals) ? (record.specialApprovals as SpecialApproval[]) : [];
    // Who they are owns the alignment's approval (cs-3); the patron's is the Patron step's (pt-10), kept as saved.
    const whos = (s: SpecialApproval) => s.step === 'alignment';
    const next = [...was.filter((s) => !whos(s)), ...special.filter(whos)];
    const averageWas = record.hpAverage === true;
    if (JSON.stringify(next) === JSON.stringify(was) && (hpAverage === null || hpAverage === averageWas)) return null;
    const rest = { ...record };
    delete rest.specialApprovals;
    if (hpAverage !== null) {
      delete rest.hpAverage;
      if (hpAverage) rest.hpAverage = true;
    }
    return next.length > 0 ? { ...rest, specialApprovals: next } : rest;
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const special = specialWith(fieldInputs);
    if (busy) return;
    if (!name.trim()) return setError('Give your character a name.');
    // Guided: the roll typed gives the hit points (cr-12); freeform: the number typed. A reopened draft keeps its saved
    // hit points until a new roll is typed (m5b-0c slice 7).
    const kept = hpKeptNow;
    const hpMax = kept ? keptHp : hpRule ? (hpRule.dice ? (hpFromRoll(hpText, hpRule) ?? undefined) : parseHpMax(hpText)) : parseHpMax(hp);
    if (hpMax === null) return setError(HP_ERROR);
    if (hpAsk && hpMax === undefined) return setError(hpRule ? (hpProblem(hpText, hpRule) ?? 'Type the hit points you rolled.') : 'Type the hit points you rolled.');
    // The average left untouched is no roll: nothing is logged, and the draft is flagged (final drafts A5, C).
    const hpRolled = !!hpAsk && !!hitDice && !!hpMax && !hpLeftAverage;
    // Starting money is typed on the Gear step (cr-14); freeform has none. Changed from the review, the languages
    // picked since stay (the given ones are only filled in when the draft is made).
    const inputs = whoChange ? fieldInputs : withGivenLanguages(fieldInputs);
    const fields = readFieldInputs(fieldDefs, inputs, { creating: true });
    if (!fields.ok) return setError(fields.message);
    setBusy(true);
    setError(null);
    setSendFailed(null);
    // A send that didn't go: the guided steps say it on the foot's ▲ line (Next tries again); freeform as before.
    const failed = (message: string) => (chosen || whoChange ? setSendFailed(typeof navigator !== 'undefined' && navigator.onLine === false ? SEND_OFFLINE : message) : setError(message));
    // A filled field the player changed keeps their value, and the GM sees it was edited (keep-or-use later). A speed
    // typed by hand is marked too, guided or freeform; one the fill gave is stored unmarked and follows the rules (mv-2).
    const editedFields = speedMarks(fieldDefs, Object.keys(filledInputs).filter((key) => String(fieldInputs[key] ?? '') !== filledInputs[key]), fieldInputs, filledInputs);
    // Who they are changed from the review (cr-18): the draft is edited, then the review again.
    if (whoChange && draftRef) {
      // An alignment a soft limit leaves out is flagged for the GM (cs-3): the draft's record says so, or no longer does.
      const creation = alignmentLimit || !kept ? await draftCreationWith(draftRef.id, special, kept ? null : hpLeftAverage) : null;
      const edited = await runCommand(registry, db, user, editCharacter, {
        character: draftRef,
        changes: { name, level, hpMax: hpMax ?? null, hpCurrent: hpMax ?? null, backstory: backstory.trim(), fields: { ...hiddenValues(fieldInputs), ...fields.values }, editedFields, ...(creation ? { creation } : {}) },
      });
      if (edited.ok) {
        const problem = await applyPortrait(db, user, draftRef, portrait);
        if (problem) setSentNote(`The portrait didn't upload: ${problem} You can add it from your campaign page.`);
        else setPortraitChoice(null);
        // A new roll is kept (docs/05, Dice entry), labelled with the draft (ruled 2026-10-26).
        if (!kept && hpRolled && hitDice && hpMax) await runCommand(registry, db, user, recordRoll, { campaignId: campaign.id, expression: hitDice, result: hpRule ? Number(hpText.trim()) : hpMax, purpose: 'hp', gmOnly: false, label: draftRollLabel(name) });
        if (hpMax) setKeptHp(hpMax);
      }
      setBusy(false);
      if (!edited.ok) return failed(edited.message);
      setWhoChange(false);
      // The new roll after a race or class change (ruled B), or a walk back (ct3-5): on to the steps after it, else the review.
      if (afterWho) {
        setAfterWho(null);
        setWalkBack(false);
        if (afterWho.steps.length > 0) return setLater({ ...afterWho, at: 0 });
      }
      setReviewVersion((v) => v + 1);
      return;
    }
    // Made above level 1, the class's minimum experience for the level (cs-13), from its own pack's table (or the nearest below).
    const xp = chosen && setting ? startingXp(level, classXpTable(chosen.klass, setting.xpTables ?? [], setting.packs)) : 0;
    const result = await runCommand(registry, db, user, createCharacter, {
      campaignId: campaign.id,
      kind: 'pc' as const,
      name,
      level,
      hpMax,
      backstory,
      fields: { ...hiddenValues(fieldInputs), ...fields.values },
      editedFields,
      ...(chosen
        ? {
            classRef: chosen.klass.packEntryId,
            raceRef: chosen.race?.packEntryId ?? null,
            ...(xp > 0 ? { xp } : {}),
            creation: { method: chosen.method, rolled: chosen.rolled, scores: chosen.scores, ...(chosen.scoresAverage?.length ? { scoresAverage: chosen.scoresAverage } : {}), ...(special.length ? { specialApprovals: special } : {}), ...(chosen.reason ? { overrideReason: chosen.reason } : {}), ...(hpLeftAverage ? { hpAverage: true } : {}), ...(patron ? { patron: { id: patron.id, name: patron.name } } : {}), ...(patronPutOff ? { toFinish: ['patron'] } : {}) },
            draft: true,
          }
        : {}),
    });
    if (result.ok) {
      const problem = await applyPortrait(db, user, result.value, portrait);
      if (problem) setSentNote(`The portrait didn't upload: ${problem} You can add it from your campaign page.`);
      // Every roll typed in is kept (docs/05, Dice entry): the HP here, the starting money on the Gear step.
      const rolls = [
        // Guided keeps the roll as the dice showed it (cr-12); freeform the total typed.
        ...(hpRolled && hitDice && hpMax ? [{ expression: hitDice, result: hpRule ? Number(hpText.trim()) : hpMax, purpose: 'hp' as const }] : []),
      ];
      // A guided character is a draft: its rolls carry its name for the GM (ruled 2026-10-26).
      const label = chosen ? draftRollLabel(name) : '';
      for (const roll of rolls) await runCommand(registry, db, user, recordRoll, { campaignId: campaign.id, ...roll, gmOnly: false, label });
    }
    setBusy(false);
    if (result.ok) {
      setJoined(result.value.approval === 'approved');
      if (chosen) setDraftRef(result.value);
      // The given languages are the draft's now (F22): a later step that saves the fields (a trait list) keeps them.
      if (chosen) setFieldInputs(inputs);
      const steps = planned.walked;
      if (chosen && steps.length > 0) {
        const creation = { method: chosen.method, rolled: chosen.rolled, scores: chosen.scores, ...(chosen.scoresAverage?.length ? { scoresAverage: chosen.scoresAverage } : {}), ...(special.length ? { specialApprovals: special } : {}), ...(chosen.reason ? { overrideReason: chosen.reason } : {}), ...(hpLeftAverage ? { hpAverage: true } : {}), ...(patron ? { patron: { id: patron.id, name: patron.name } } : {}), ...(patronPutOff ? { toFinish: ['patron'] } : {}) };
        setLater({ character: result.value, creation, steps, at: 0 });
      } else if (chosen) setDrafted(result.value.id);
      else setSent(name.trim());
    } else failed(result.message);
  }

  // A draft reopened: wait for its values before showing a step.
  if (draft && !resumed) return <CreationLoading line="Opening your character…" />;

  // The review (cr-18; m5b-0c slice 7; mockup creation/09): a step opened from it (Change ›, Do it now ›) comes back.
  // Steps before the draft (scores, race, class) can't change yet (scope check 1).
  const openFromReview = (step: string, data: ReviewData) => {
    const c = data.character;
    const ref = refOf(c);
    setDraftRef(ref);
    // A step opened from the review starts from what's saved (another device may have changed it since); the hidden
    // fields' values too, so they're kept (cs-3).
    setFieldInputs(fieldInputsFrom(campaignFields, c.fields));
    setStepPicks({ weaponSkills: weaponSkillsOf(c.weaponSkills), expertise: readExpertise(c.expertise), details: detailsOf(c.fields) });
    if (spellPlan) setSpellPicks(picksFromBook(spellPlan, spellBookOf(c.spellBook)));
    const saved = asRecord(c.creation);
    // The patron as saved (another device may have changed it): the Patron step and Who they are read it from the choice.
    setChosen((was) => (was ? { ...was, ...patronChoiceOf(saved) } : was));
    setMoney(typeof saved.startingMoney === 'number' ? String(saved.startingMoney) : '');
    if (step === 'who') {
      setName(c.name);
      setLevel(c.level);
      setBackstory(c.backstory);
      if (c.hpMax !== null && c.hpMax !== keptHp) {
        setKeptHp(c.hpMax);
        resetHp();
      }
      setSavedPortrait(data.character.portraitAssetId);
      setPortraitChoice(null);
      setError(null);
      setWhoChange(true);
      return;
    }
    // Scores, race and class (cf-7): the guided steps again, from the one tapped, with every value kept; the end of
    // the walk writes the choice through creation.redo (finishRedo).
    // A patron put off is finished where it is picked: on the Patron step (pt-10), a guided step like the class.
    if (step === 'method' || step === 'scores' || step === 'race' || step === 'class' || step === 'patron' || step === 'adjust') {
      setRedo({ ref, character: c });
      setResumeAt(step);
      setResumeUnpick(false);
      setPath('guided');
      return;
    }
    // A trait list is listed to finish under its own id, and walked as "trait:<id>".
    const walked = traits.some((t) => t.id === step) ? `trait:${step}` : step;
    if (laterPlanned.includes(walked)) return setLater({ character: ref, creation: asRecord(data.character.creation), steps: [walked], at: 0, review: true });
    toast({ text: `${toFinishName(step)} can't be changed here. Ask your GM.` });
  };
  // What each section says and every step's check, from the draft as saved.
  const buildReview = (data: ReviewData): ReviewBuilt => {
    const c = data.character;
    const rs = setting?.rulesSets ?? [];
    const creation = asRecord(c.creation);
    const values = asRecord(c.fields);
    const putOffs = toFinishOf(creation);
    const putOff = (step: string) => (putOffs.includes(step) ? 'to finish' : undefined);
    const open = (step: string) => () => openFromReview(step, data);
    const text = (value: unknown) => (value === undefined || value === null ? '' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value).trim());
    // Full names wherever an ability is named (Francis via Design, 2026-11-06): "Strength 13 · Intelligence 9 · …".
    const label = (key: string) => abilityNames(rs, fieldDefs)(key).long;
    // Every pack-list value opens its entry (ct3-11): the kindred, the calling, the alignment, a trait, each language.
    const entryCtx: EntryContext | null = setting
      ? {
          all: setting.all,
          rulesSets: rs,
          packName: (id) => {
            const pack = setting.packs.find((p) => p.packId === id);
            return pack?.shortName ?? pack?.name ?? '';
          },
          packTitles: (id) => setting.packs.find((p) => p.packId === id)?.sourceTitles ?? {},
          scores: scoresOf(setting, c.fields, c.creation),
          label,
          raceRef: c.raceRef,
          classRef: c.classRef,
          creation,
        }
      : null;
    const fieldValues = (def: FieldDefinition, value: unknown): ReviewValue[] => (entryCtx ? fieldEntries(entryCtx, def, value, fieldDefs).map((e) => ({ text: e.name, entry: e })) : []);
    /** "Leaning: [Reed]"; languages the list doesn't have stay words after the tappable ones. Without an entry, words. */
    const listedLine = (lineLabel: string, def: FieldDefinition, raw: unknown, words: string): ReviewPart['lines'][number] => {
      // Languages one by one, in their order; one the list doesn't have stays words.
      const found: ReviewValue[] =
        def.key.toLowerCase() === 'languages' && entryCtx
          ? languageList(raw).map((n) => {
              const entry = languageEntries(entryCtx, def.key, n)[0];
              return entry ? { text: entry.name, entry } : { text: n };
            })
          : fieldValues(def, raw);
      if (!found.some((v) => v.entry)) return { text: lineLabel ? `${lineLabel}: ${words}` : words };
      return { text: lineLabel ? `${lineLabel}:` : '', values: found, joiner: ', ' };
    };
    const parts: ReviewPart[] = [];
    const checks: StepCheck[] = [];
    if (chosen) {
      const raceTitle = guideTitle(rs, 'race', STEP_TITLES.race);
      const classTitle = guideTitle(rs, 'class', STEP_TITLES.class);
      // "Lantern Warden (from Fen rules)" when another pack has one of the same name (sn-1, plan dec-1 1d); else the name.
      const fromOf = setting && entryCtx ? namesakeSource(entriesInPlay(setting.all), entryCtx.packName, setting.packs) : () => null;
      const fromWords = (entry: { kind: string; name: string; packId?: string; packEntryId: string }) => nameFromWords(fromOf(entry));
      const named = (entry: { kind: string; name: string; packId?: string; packEntryId: string }) => `${entry.name}${fromWords(entry)}`;
      // The patron (pt-10; mockup creation/final/14-09b, ruling B): a third line in this card with its own Change, which
      // opens the Patron step; the heading then names it. One put off reads "Not picked yet", to finish. A patron its
      // option switches off is hidden (pt-9), kept on the record; one whose pack is detached is still named.
      const patronName = patronNameOf(creationShown(setting, creation));
      // Asked only when a patron is open to the class (review of #665, nit 2): the same fit rule as Send's check.
      const patronAsked = !!setting && patronAskedIn(setting.all, chosen.klass.packEntryId, alignmentNames);
      const patronLine = patronName
        ? [{ text: `Patron: ${patronName}`, onChange: open('patron'), changeLabel: 'Change patron' }]
        : patronAsked && putOffs.includes('patron')
          ? [{ text: 'Patron: Not picked yet', why: putOff('patron'), onChange: open('patron'), changeLabel: 'Change patron' }]
          : [];
      const title = patronLine.length > 0 ? `${raceTitle}, ${classTitle.toLowerCase()} and patron` : `${raceTitle} and ${classTitle.toLowerCase()}`;
      // A kindred-class reads once (1c); each name read keeps its " (from <pack>)" when it has a namesake (1d).
      const oneLine = `${kindredAndClassNamed(chosen.race, chosen.klass, fromWords)}, level ${c.level}`;
      // Two lines, each with its own Change (cw-11, Design 2026-11-06): the kindred's opens Kindred (a changed one walks
      // on through Class), the class's opens Class. A kindred-class (one pick) or no kindred: one line, one Change.
      // Plain text, no chips (R3-6, mockup creation/final/12): "Kindred: Stone kin".
      if (chosen.race && !classKindredId(chosen.klass.data)) {
        parts.push({
          id: 'class',
          title,
          lines: [
            { text: `${raceTitle}: ${named(chosen.race)}`, onChange: open('race'), changeLabel: `Change ${raceTitle}` },
            { text: `${classTitle}: ${named(chosen.klass)}, level ${c.level}`, onChange: open('class'), changeLabel: `Change ${classTitle}` },
            ...patronLine,
          ],
        });
      } else if (patronLine.length > 0) {
        // One pick and a patron: a Change on each line.
        parts.push({
          id: 'class',
          title,
          lines: [{ text: oneLine, onChange: open('class'), changeLabel: `Change ${classTitle}` }, ...patronLine],
        });
      } else {
        parts.push({
          id: 'class',
          title,
          lines: [{ text: oneLine }],
          onChange: open('class'),
        });
      }
      const scores = scoresLine(creation, label);
      // The scores left at the average (A5) on a line of their own: "Wit 10, Lore 10: the average, not rolled".
      const average = averageScoresLine(creation, label);
      if (scores) parts.push({ id: 'scores', title: guideTitle(rs, 'scores', STEP_TITLES.scores), lines: [{ text: scores }, ...(average ? [{ text: average }] : [])], onChange: open('scores') });
    }
    // Who they are: what was typed or picked there (the fields other steps own, or the rules fill, are left out).
    const alignmentValue = alignmentField ? text(values[alignmentField.key]) : '';
    const shown = fieldDefs.filter((def) => !def.hidden && !hideFilled(def) && def.key !== alignmentField?.key && text(values[def.key]) !== '');
    parts.push({
      id: 'who',
      title: guideTitle(rs, 'who', STEP_TITLES.who),
      lines: [
        { text: c.name },
        ...(c.hpMax !== null ? [{ text: `${c.hpMax} hp` }] : hpRule ? [{ text: 'Hit points not typed yet' }] : []),
        // Plain text (R3-6): "Alignment: Reed".
        ...(alignmentField && alignmentValue ? [{ text: `${alignmentField.label}: ${alignmentValue}` }] : []),
        ...shown.map((def) => listedLine(def.label, def, values[def.key], text(values[def.key]))),
        ...(c.backstory.trim() ? [{ text: `Backstory: ${c.backstory.trim()}` }] : []),
        ...(c.portraitAssetId ? [{ text: 'Portrait chosen' }] : []),
      ],
      onChange: open('who'),
    });
    const alignmentMissing = !!alignmentField?.required && alignments.length > 0 && !alignmentValue;
    const whoFields = readFieldInputs(fieldDefs, fieldInputsFrom(fieldDefs, c.fields), { creating: true });
    checks.push({
      step: 'who',
      problem: !c.name.trim()
        ? 'Give your character a name.'
        : hpRule && c.hpMax === null
          ? 'Type the hit points you rolled.'
          : alignmentMissing
            ? `Pick your ${(alignmentField?.label ?? 'alignment').toLowerCase()}.`
            : whoFields.ok
              ? null
              : whoFields.message,
    });
    // A patron left on Decide later must not reach approval unfinished (the lead's ruling, 2026-11-11): Send to the GM
    // stays tappable, says why, and opens the Patron step (pt-10). So must a closed one kept from before (nit 1 of #665).
    checks.push({ step: 'patron', problem: patronProblemIn(setting?.all ?? [], c.classRef, creation, alignmentNames) });
    // Only the fields with a value (ct-5): no "—".
    const derived = derivedRows(fieldDefs, guidedFills, derivedNotes).filter((r) => r.value !== '');
    // Each one opens its breakdown (bq-2).
    if (derived.length > 0) {
      // Tiles (R3-6, mockup creation/final/12): the Score tile with the name, the figure and its parts under, no
      // separators between; the saves their own group under "Saves". Each opens its breakdown (bq-2).
      const tileOf = (r: (typeof derived)[number]) => ({ key: r.key, label: r.label, value: r.value, ...(r.note ? { caption: r.note.replace(/ · /g, ', ') } : {}), ...(derivedBreakdown(r.key, r.label) ? { breakdown: derivedBreakdown(r.key, r.label)! } : {}) });
      const isSave = (r: (typeof derived)[number]) => {
        const def = fieldDefs.find((f) => f.key === r.key);
        return !!def && (/^saves(\.|$)/.test(def.fill ?? '') || /^saves?$/i.test(def.group ?? ''));
      };
      const others = derived.filter((r) => !isSave(r)).map(tileOf);
      const saves = derived.filter(isSave).map(tileOf);
      // Folded under its plain name (cw-7, cw-11), each figure a tap.
      parts.push({
        id: 'derived',
        title: 'Derived values',
        // "8 figures" (cs-23): the fold says how many; a tile is still a tap.
        note: `${derived.length} ${derived.length === 1 ? 'figure' : 'figures'}`,
        folded: true,
        lines: [...(others.length > 0 ? [{ text: '', tiles: { items: others } }] : []), ...(saves.length > 0 ? [{ text: '', tiles: { label: 'Saves', saves: true, items: saves } }] : [])],
      });
    }
    // The steps after Who they are, in the order walked.
    for (const step of laterPlanned) {
      if (step === 'spells' && spellPlan) {
        const book = spellBookOf(c.spellBook);
        const nameOf = (id: string) => setting?.all.find((e) => e.kind === 'spell' && e.packEntryId === id)?.name ?? id;
        // By source (cw-11): each spell over "From your kindred" or "From your class".
        const kindred = { given: spellPlan.kindredGiven, rolled: spellPlan.rolls.flatMap((g) => (g.from === 'kindred' && !g.unreadable ? g.rows.flatMap((r) => r.spells) : [])) };
        const bySource = spellSources(book, kindred).map((s) => ({ text: nameOf(s.id), sub: s.from }));
        parts.push({ id: 'spells', title: spellsTitle(rs, spellPlan), lines: bySource.length > 0 ? bySource.map((l, n) => (n === 0 && putOff('spells') ? { ...l, why: putOff('spells') } : l)) : [{ text: 'None yet', why: putOff('spells') }], onChange: open('spells') });
        if (!putOffs.includes('spells')) {
          const problem = firstSpellsProblem(spellPlan, picksFromBook(spellPlan, book));
          checks.push({ step, problem: problem ? `${problem}.` : null });
        }
      } else if (step === 'gear') {
        const rules = setting?.encumbrance;
        const load = rules ? carriedLoad(data.lines.filter((l) => l.approval === 'approved' && !isSeparate(l, rules)).map(toLoadLine), rules, data.mode) : null;
        // The coin's "from …" names the pick that added it (cw-11, rc-2).
        const pickName = (listId: string) => {
          const trait = traits.find((t) => t.id === listId);
          const value = trait ? text(values[trait.field.key]) : '';
          return trait && value ? (traitLookup(lists)(trait.field, value) ?? value) : null;
        };
        const money = moneyOf(creation, coinsOf(rs), pickName);
        // Gear as lines (cw-11): each kit with what it gave, each pick's things, the given gear folded, the count and load.
        const gear = gearGroups(creation, data.lines, load && load.mode !== 'none' ? tierWords(load) : '', (listId) => lists.find((l) => l.id === listId)?.name ?? 'From a pick', (tableId) => setting?.all.find((e) => e.kind === 'table' && e.packEntryId === tableId)?.name ?? tableId);
        parts.push({
          id: 'gear',
          title: guideTitle(rs, 'gear', GEAR_TITLE),
          lines: [
            // A kit's thing its class can't wear or use says so (cw-11, Design 2026-11-06: "▲ Ring coat: a Reed Witch can't wear it; carried").
            ...gear.rows.map((r) => {
              if (!r.kit) return { text: r.label, sub: r.items };
              const warn = r.ids.flatMap((id) => {
                const line = data.lines.find((l) => l.id === id);
                if (!line || !(typeof line.details.slot === 'string' || !!line.details.weapon)) return [];
                return equipCheckWith(data.equip, line, []).blocked.length > 0 ? [cantUseLine(line.name, chosen?.klass.name ?? '', !!line.details.weapon && typeof line.details.slot !== 'string')] : [];
              });
              return { text: r.label, sub: r.items, ...(warn.length > 0 ? { warn } : {}) };
            }),
            ...(gear.given.length > 0 ? [{ text: 'Given', fold: { note: gear.givenCount, items: gear.given } }] : []),
            { text: gear.summary, why: putOff('gear') },
            // Over the coin it says "…: 2 gp over." in this line (cs-44, cs-45); Send lands on Gear with the check's message.
            { text: 'Starting coin', sub: money.text },
          ],
          onChange: open('gear'),
        });
        if (!putOffs.includes('gear')) checks.push({ step, problem: money.problem });
      } else if (step === 'languages' && languagesField && languagePlan) {
        parts.push({ id: 'languages', title: guideTitle(rs, 'languages', 'Languages'), lines: [text(values[languagesField.key]) ? { ...listedLine('', languagesField, values[languagesField.key], text(values[languagesField.key])), why: putOff('languages') } : { text: 'None yet', why: putOff('languages') }], onChange: open('languages') });
        if (!putOffs.includes('languages')) checks.push({ step, problem: languagesProblem(languagePlan, picksFromSaved(languagePlan, values[languagesField.key]), false) });
      } else if (step === 'weaponSkills' && weapons) {
        const picks = weaponSkillsOf(c.weaponSkills);
        const named = (itemId: string) => setting?.items.find((i) => i.packEntryId === itemId)?.name ?? itemId;
        parts.push({
          id: 'weaponSkills',
          title: guideTitle(rs, 'weaponSkills', 'Weapon skills'),
          lines: [{ text: picks.length > 0 ? picks.map((p) => `${named(p.itemId)}${p.specialised ? ' (specialised)' : ''}`).join(', ') : 'None yet', why: putOff('weaponSkills') }],
          onChange: open('weaponSkills'),
        });
        const left = weapons.allowed - picksUsed(picks, weapons.proficiency);
        if (!putOffs.includes('weaponSkills')) checks.push({ step, problem: left > 0 ? `Pick ${left} more.` : null });
      } else if (step === 'expertise' && planned.expertise) {
        // One card with Change (ex-7, X7): the skills with points and their figures, "The rest 1-in-6"; put off, what waits.
        const setup = planned.expertise;
        const points = readExpertise(c.expertise);
        parts.push({ id: 'expertise', title: guideTitle(rs, 'expertise', setup.rule.name), lines: [{ text: expertiseReviewLine(setup, points, c.level, putOffs.includes('expertise')) }], onChange: open('expertise') });
        const left = pointsAllowed(setup.rule, c.level) - pointsSpent(points, setup.skills.map((s) => s.code));
        if (!putOffs.includes('expertise')) checks.push({ step, problem: left > 0 ? `Spend ${pointWords(left)}.` : null });
      } else if (step.startsWith('trait:')) {
        const trait = traits.find((t) => `trait:${t.id}` === step);
        if (!trait) continue;
        const value = text(values[trait.field.key]);
        const picks = value ? traitPicksOf(trait, value) : [];
        const many = trait.list.rolls > 1;
        const shownValue = value ? (many ? picks.map((p) => traitPickName(trait.list, p)).join(', ') : (traitLookup(lists)(trait.field, value) ?? value)) : 'Not picked yet';
        // A picked entry's spell roll (bq3-18): the spell rolled under the pick (the first that has one), or that it's still to roll.
        const pickedEntries = picks.flatMap((p) => ('entryId' in p ? trait.list.entries.filter((e) => e.id === p.entryId) : []));
        const entry = pickedEntries.find((e) => e.spellRoll) ?? pickedEntries[0];
        const roll = entry && setting ? rolledSpellReview(entryRollPlan(entry.spellRoll, setting.all), rolledSpellOf(creation, trait.id, entry.id)) : null;
        // N picks (pf-16): every pick in its order, each list entry tappable, a typed one as words.
        const found = many && value ? fieldValues(trait.field, value) : [];
        const manyLine = many && picks.length > 0 ? { text: '', values: picks.map((p) => ('entryId' in p ? (found.find((v) => v.entry && v.text === traitPickName(trait.list, p)) ?? { text: traitPickName(trait.list, p) }) : { text: traitValue(trait, p) })), joiner: ', ' } : null;
        parts.push({
          id: step,
          title: trait.list.name,
          lines: [{ ...(manyLine ?? (value ? listedLine('', trait.field, value, shownValue) : { text: shownValue })), why: putOff(trait.id) }, ...(roll ? [{ text: roll.text, strong: roll.strong }] : [])],
          onChange: open(trait.id),
        });
        const left = trait.list.rolls - picks.length;
        if (!putOffs.includes(trait.id)) checks.push({ step, problem: !value ? `Pick ${many ? trait.list.rolls : 'one'} from ${trait.list.name}.` : left > 0 ? `Pick ${left} more from ${trait.list.name}.` : (roll?.problem ?? null) });
      } else if (step === 'details' && kindredNow) {
        // Details (cs-1): optional, so never a check; what's filled in, or that it was left blank.
        const lines = detailLines(detailsOf(c.fields), kindredTablesNow, physicalOf(kindredNow), kindredNow.name);
        parts.push({ id: 'details', title: guideTitle(rs, 'details', STEP_TITLES.details), lines: lines.length > 0 ? lines.map((l) => ({ text: `${l.label}: ${l.value}` })) : [{ text: 'Left blank (optional)' }], onChange: open('details') });
      }
    }
    // Languages given with nothing to pick (cr-15): on the sheet, nothing to change here.
    if (languagesField && !laterPlanned.includes('languages') && text(values[languagesField.key])) {
      parts.push({ id: 'languages', title: guideTitle(rs, 'languages', 'Languages'), note: 'given', lines: [listedLine('', languagesField, values[languagesField.key], text(values[languagesField.key]))] });
    }
    // Every exception called out before sending (final drafts D): first, above the step cards, with the sign (clo-1, 22-G2).
    const exceptions = exceptionsPart(creationShown(setting, creation));
    if (exceptions) parts.unshift(exceptions);
    return {
      parts,
      toFinish: putOffs.map((id) => ({ id, name: lists.find((l) => l.id === id)?.name ?? (id === 'expertise' && planned.expertise ? planned.expertise.rule.name : toFinishName(id)) })),
      problem: firstProblem(checks),
    };
  };
  const reviewScreen = () =>
    draftRef && drafted ? (
      <CreationReview
        key={drafted}
        db={db}
        user={user}
        campaignId={campaign.id}
        characterId={drafted}
        version={reviewVersion}
        counter={draft ? undefined : { at: totalSteps, of: totalSteps }}
        build={buildReview}
        onOpen={openFromReview}
        // Back (cs-39a): the last step walked, opened as an ordinary step of the walk, not as Change › opens it: its Back
        // goes on to the step before it, and its Next returns here. With none after Who they are, Who they are, walked
        // back to in the same way. Change › (onOpen) still opens a step that returns to the review.
        onBack={(data) => {
          const last = laterPlanned.at(-1);
          openFromReview(last?.replace(/^trait:/, '') ?? 'who', data);
          if (last) setLater({ character: refOf(data.character), creation: asRecord(data.character.creation), steps: laterPlanned, at: laterPlanned.length - 1 });
          else {
            // Walked back to, with no steps after it: Who they are's Next clears both and returns to the review (#750 review).
            setAfterWho({ character: refOf(data.character), creation: asRecord(data.character.creation), steps: [] });
            setWalkBack(true);
          }
        }}
        onSend={async (data) => {
          const sent = await runCommand(registry, db, user, sendCharacter, { character: refOf(data.character) });
          if (!sent.ok) {
            toast({ text: sent.message });
            return false;
          }
          // The player lands on the campaign after sending (A6).
          toast(sent.value.approval === 'approved' ? await joinedToast(db, user, campaign.id, data.character, toast) : { text: `Sent ${data.character.name} to your GM.` });
          onDone();
          return true;
        }}
        onLeave={() => {
          toast({ text: `${name.trim() || 'Your character'} is saved. Carry on from Your characters.` });
          // Through the host's Leave, so a leave to an item of the app's menu goes there instead (final draft 9).
          (hostLeave ?? onLeave)();
        }}
        // Start over (final drafts D): a draft never sent is deleted by its owner (hard rule 4's first exception), the
        // picks kept on this device are forgotten, and creation opens again at step 1.
        onStartOver={async (data) => {
          const gone = await runCommand(registry, db, user, deleteCharacter, { character: refOf(data.character) });
          if (!gone.ok) {
            toast({ text: gone.message });
            return false;
          }
          forgetKept(user.id, campaign.id);
          toast({ text: 'Started over: creation begins again at step 1.' });
          onStartOver();
          return true;
        }}
        // No approval needed (cs-24): "Add to the party".
        sendLabel={atOnce ? 'Add to the party' : 'Send to the GM'}
        sendHint={atOnce ? 'Joins the party at once' : 'Goes to the GM for approval'}
      />
    ) : null;

  // Guided: the review comes last, with Send to the GM; then the player lands on the campaign (A6).
  if (reviewShown) return reviewScreen();
  if (drafted && !whoChange && !later && !redo) {
    // Without the class in the setting (a pack taken off), the older review still opens the draft.
    return (
      <DraftReview
        db={db}
        user={user}
        campaign={campaign}
        characterId={drafted}
        fieldDefs={fieldDefs}
        off={fieldsOffNow}
        onSent={(sent) => {
          toast(sent);
          onDone();
        }}
      />
    );
  }

  if (later && chosen && setting) {
    const step = later.steps[later.at];
    const advance = (creation = later.creation) => {
      if (later.at + 1 < later.steps.length) setLater({ ...later, creation, at: later.at + 1, back: false });
      else {
        // The last step walked, or a step opened from the review (cr-18): the review, read again.
        setLater(null);
        setDrafted(later.character.id);
        setReviewVersion((v) => v + 1);
      }
    };
    // Back from a step after "Who are they?": the step before it; from the first, Who they are again on the draft
    // (ct3-5), its Next coming back to these steps. A step opened from the review goes back there, as saved. A step that
    // saved the record (Gear) passes it: Who they are's Next walks on with it, so the given gear isn't given again.
    const back = (creation: Record<string, unknown> = later.creation) => {
      if (later.review) return setLater(null);
      if (later.at > 0) return setLater({ ...later, at: later.at - 1, back: true });
      // The roll typed is the draft's hit points now: kept, so going forward again doesn't log it twice.
      const typedHp = hpRule ? (hpRule.dice ? hpFromRoll(hpText, hpRule) : parseHpMax(hpText)) : null;
      if (hpText.trim() !== '' && typeof typedHp === 'number') {
        setKeptHp(typedHp);
        resetHp();
      }
      setDrafted(later.character.id);
      setDraftRef(later.character);
      setAfterWho({ character: later.character, creation, steps: later.steps });
      setWalkBack(true);
      setWhoChange(true);
      setLater(null);
    };
    // No counter on a step opened from the review (its Next comes back).
    const shellAt = later.review ? undefined : { at: ownSteps + 2 + later.at, of: ownSteps + 2 + later.steps.length };
    if (step === 'spells' && spellPlan) {
      const guide = stepGuide(setting.rulesSets, 'spells');
      const character = { ...later.character, toFinish: toFinishOf(later.creation) };
      return (
        <FirstSpellsStep
          key="spells"
          plan={spellPlan}
          picks={cleanPicks(spellPlan, spellPicks)}
          onPicks={setSpellPicks}
          title={spellsTitle(setting.rulesSets, spellPlan)}
          counter={shellAt}
          why={guide.why}
          help={guide.help ?? APP_HELP.spells ?? null}
          level={level}
          onBack={() => back()}
          // The Undo of a rolled book's Pick that moved on (ct-1): this step again (the book is written again at its Next).
          onReturn={() => setLater(later)}
          onSave={async (book) => {
            const saved = await runCommand(registry, db, user, setSpellBook, { character, spellIds: book });
            if (!saved.ok) {
              toast({ text: saved.message });
              return false;
            }
            const done = await saveToFinish(db, user, later.character, 'spells', false);
            advance(done.ok ? done.creation : later.creation);
            return true;
          }}
          onLater={
            required.has('spells')
              ? undefined
              : async (book) => {
                  // What's picked so far goes in the book; First spells goes on the To finish card.
                  const saved = await runCommand(registry, db, user, setSpellBook, { character, spellIds: book });
                  if (!saved.ok) return toast({ text: saved.message });
                  const listed = await saveToFinish(db, user, later.character, 'spells', true);
                  if (!listed.ok) return toast({ text: listed.message });
                  advance(listed.creation);
                }
          }
        />
      );
    }
    if (step === 'gear') {
      // Gear (cr-14, m5b-0c slice 5): the money roll, kits, the shop and the load, on the shell.
      const guide = stepGuide(setting.rulesSets, 'gear');
      return (
        <StartingGear
          key="gear"
          db={db}
          user={user}
          setting={setting}
          character={later.character}
          name={name.trim()}
          classRef={chosen.klass.packEntryId}
          raceRef={chosen.race?.packEntryId ?? null}
          patronGarb={patronGarbFor(setting, later.creation, { level, classRef: chosen.klass.packEntryId, raceRef: chosen.race?.packEntryId ?? null }, fieldDefs)}
          moneyRoll={moneyRoll}
          money={money}
          onMoney={setMoney}
          creation={later.creation}
          title={guideTitle(setting.rulesSets, 'gear', GEAR_TITLE)}
          counter={shellAt}
          why={guide.why}
          help={guide.help ?? null}
          onBack={(creation) => (later.at > 0 ? setLater({ ...later, creation, at: later.at - 1, back: true }) : back(creation))}
          onDone={(creation) => advance(creation)}
          // Next's take undone after the walk went on (cs-42): keep the record it saved, and read the review again.
          onUndone={(creation) => {
            setLater((l) => (l ? { ...l, creation } : l));
            setReviewVersion((v) => v + 1);
          }}
          onLater={
            required.has('gear')
              ? undefined
              : async () => {
                  const listed = await saveToFinish(db, user, later.character, 'gear', true);
                  if (!listed.ok) return toast({ text: listed.message });
                  advance(listed.creation);
                }
          }
        />
      );
    }
    // Languages, weapon skills and trait lists on the creation step shell (m5b-0c slice 6, cr-15 … cr-17).
    if (step === 'languages' && languagesField && languagePlan) {
      const guide = stepGuide(setting.rulesSets, 'languages');
      return (
        <LanguagesStep
          key="languages"
          plan={languagePlan}
          initial={stepPicks.languages ?? picksFromSaved(languagePlan, fieldInputs[languagesField.key])}
          onPicks={(picks) => setStepPicks((was) => ({ ...was, languages: picks }))}
          title={guideTitle(setting.rulesSets, 'languages', 'Languages')}
          // The app's line, then the score's extra tongues as a fact (cs-2); a pack's own line stands as written.
          why={guide.why === APP_WHY.languages ? languagesLine(guide.why, languagePlan, abilityNames(setting.rulesSets, fieldDefs)(languagePlan.ability).long) : guide.why}
          help={guide.help ?? APP_HELP.languages ?? null}
          counter={shellAt}
          derived={languageDerived(fieldDefs, derivedRows(fieldDefs, guidedFills, derivedNotes), languagePlan.ability)}
          onBack={() => back()}
          onSave={async (list, picks) => {
            const next = { ...fieldInputs, [languagesField.key]: languageText(list) };
            const fields = readFieldInputs(fieldDefs, next, { creating: true });
            if (!fields.ok) {
              toast({ text: fields.message });
              return false;
            }
            const saved = await runCommand(registry, db, user, editCharacter, { character: later.character, changes: { fields: fields.values } });
            if (!saved.ok) {
              toast({ text: saved.message });
              return false;
            }
            setFieldInputs(next);
            // Done now: off the To finish list, if it was put there before; a language learnt with the GM's leave
            // (cs-6) is flagged for the GM beside the race's and class's.
            const done = await saveToFinish(db, user, later.character, 'languages', false, (record) => withStepApprovals(record, 'languages', languageApprovals(languagePlan, picks)));
            advance(done.ok ? done.creation : later.creation);
            return true;
          }}
          onLater={
            required.has('languages')
              ? undefined
              : () =>
                  void saveToFinish(db, user, later.character, 'languages', true).then((saved) => {
                    if (!saved.ok) return toast({ text: saved.message });
                    advance(saved.creation);
                  })
          }
        />
      );
    }
    if (step === 'weaponSkills' && weapons) {
      return (
        <WeaponSkillsStep
          key="weaponSkills"
          groups={weapons.groups}
          restricted={weapons.restricted}
          proficiency={weapons.proficiency}
          allowed={weapons.allowed}
          damageRule={weapons.damage}
          chosen={stepPicks.weaponSkills ?? []}
          onPicks={(picks) => setStepPicks((was) => ({ ...was, weaponSkills: picks }))}
          carried={[]}
          title={guideTitle(setting.rulesSets, 'weaponSkills', 'Weapon skills')}
          why={weaponSkillsWhy(packWhy(setting.rulesSets, 'weaponSkills'), weapons.proficiency)}
          help={stepGuide(setting.rulesSets, 'weaponSkills').help ?? APP_HELP.weaponSkills ?? null}
          counter={shellAt}
          onBack={() => back()}
          onSave={async (picks) => {
            const saved = await runCommand(registry, db, user, editCharacter, { character: later.character, changes: { weaponSkills: picks } });
            if (!saved.ok) {
              toast({ text: saved.message });
              return false;
            }
            // A weapon not the class's (R3-5) is flagged for the GM, as a closed class is.
            const done = await saveToFinish(db, user, later.character, 'weaponSkills', false, (record) => withStepApprovals(record, 'weaponSkills', weaponApprovals(picks, weapons.restricted, weapons.proficiency)));
            advance(done.ok ? done.creation : later.creation);
            return true;
          }}
          onLater={
            required.has('weaponSkills')
              ? undefined
              : () =>
                  void saveToFinish(db, user, later.character, 'weaponSkills', true).then((saved) => {
                    if (!saved.ok) return toast({ text: saved.message });
                    advance(saved.creation);
                  })
          }
        />
      );
    }
    if (step === 'expertise' && planned.expertise) {
      const setup = planned.expertise;
      // The skills' pack and page under a skill's words (X4): the class's.
      const klassPack = setting.packs.find((p) => p.packId === chosen.klass.packId);
      const classPage = packAndPage(klassPack?.shortName ?? klassPack?.name ?? '', typeof chosen.klass.data.source === 'string' ? chosen.klass.data.source.trim() : '', klassPack?.sourceTitles);
      return (
        <ExpertiseStep
          key="expertise"
          setup={setup}
          level={level}
          saved={{}}
          chosen={stepPicks.expertise ?? {}}
          who={{ gm: false, approved: false }}
          onPicks={(points) => setStepPicks((was) => ({ ...was, expertise: points }))}
          title={guideTitle(setting.rulesSets, 'expertise', setup.rule.name)}
          why={stepGuide(setting.rulesSets, 'expertise').why}
          help={stepGuide(setting.rulesSets, 'expertise').help}
          source={classPage || undefined}
          counter={shellAt}
          onBack={() => back()}
          onSave={async (points) => {
            const saved = await runCommand(registry, db, user, editCharacter, { character: later.character, changes: { expertise: points } });
            if (!saved.ok) {
              toast({ text: saved.message });
              return false;
            }
            const done = await saveToFinish(db, user, later.character, 'expertise', false);
            advance(done.ok ? done.creation : later.creation);
            return true;
          }}
          onLater={
            required.has('expertise')
              ? undefined
              : () =>
                  void (async () => {
                    // The points spent so far are kept (as a trait list's picks are, pf-16); the rest wait on To finish.
                    // Written whenever they differ from what's saved, a full take-back too (#1093 review, 2).
                    const points = stepPicks.expertise ?? {};
                    const before = await loadSavedExpertise(db, later.character.id);
                    if (!before || !sameExpertise(points, readExpertise(before.expertise))) {
                      const kept = await runCommand(registry, db, user, editCharacter, { character: later.character, changes: { expertise: points } });
                      if (!kept.ok) return toast({ text: kept.message });
                    }
                    const listed = await saveToFinish(db, user, later.character, 'expertise', true);
                    if (!listed.ok) return toast({ text: listed.message });
                    advance(listed.creation);
                  })()
          }
        />
      );
    }
    const trait = step?.startsWith('trait:') ? traits.find((t) => t.id === step.slice('trait:'.length)) : undefined;
    if (trait) {
      const kept = stepPicks.traits?.[trait.id];
      const pickNow = kept !== undefined ? kept : traitPicksOf(trait, fieldInputs[trait.field.key]);
      const keptRoll = stepPicks.traitSpells?.[trait.id];
      // Saves the picks on the field and fills the gear they grant (cr-17), with Undo; an earlier pick's gear goes back
      // out. Next saves all N; Decide later saves the ones made so far (pf-16) and the step goes on To finish.
      const savePicks = async (picks: readonly TraitPick[], rolled: RolledSpell | null): Promise<boolean> => {
        const next = { ...fieldInputs, [trait.field.key]: traitValues(trait, picks) };
        const fields = readFieldInputs(fieldDefs, next, { creating: true });
        if (!fields.ok) {
          toast({ text: fields.message });
          return false;
        }
        const saved = await runCommand(registry, db, user, editCharacter, { character: later.character, changes: { fields: fields.values } });
        if (!saved.ok) {
          toast({ text: saved.message });
          return false;
        }
        setFieldInputs(next);
        const gear = await grantTraitGear(db, user, setting, later.character, trait.id, pickedGearEntry(trait.list, picks), rolled);
        if (!gear.ok) toast({ text: gear.message });
        else if (grantedWords(gear))
          toast({
            text: grantedWords(gear),
            ...(gear.added.length > 0 ? { onUndo: () => void undoTraitGear(db, user, later.character, trait.id).then((undone) => !undone.ok && toast({ text: undone.message })) } : {}),
          });
        return true;
      };
      return (
        <TraitListStep
          key={step}
          list={trait.list}
          chosen={pickNow}
          rollPlan={(entry) => entryRollPlan(entry.spellRoll, setting.all)}
          rolled={keptRoll !== undefined ? keptRoll : rolledSpellOf(later.creation, trait.id, pickNow.flatMap((p) => ('entryId' in p ? [p.entryId] : [])).find((id) => trait.list.entries.find((e) => e.id === id)?.spellRoll) ?? null)}
          onPicks={(picks, rolled) => setStepPicks((was) => ({ ...was, traits: { ...was.traits, [trait.id]: picks }, traitSpells: { ...was.traitSpells, [trait.id]: rolled } }))}
          {...traitLines(trait.list)}
          help={traitHelp(trait.list)}
          counter={shellAt}
          itemName={(itemId) => setting.items.find((i) => i.packEntryId === itemId)?.name}
          onBack={() => back()}
          onSave={async (picks, rolled) => {
            if (!(await savePicks(picks, rolled))) return false;
            const done = await saveToFinish(db, user, later.character, trait.id, false);
            advance(done.ok ? done.creation : later.creation);
            return true;
          }}
          onLater={
            traitRequired(required, trait.id)
              ? undefined
              : (picks, rolled) =>
                  void (async () => {
                    // Some picked (pf-16): kept with the spell rolled under one, and the step goes on To finish for
                    // the rest. Nothing changed since the last save (look-back review of #663): nothing is written
                    // beyond putting it on To finish.
                    const saved = traitPicksOf(trait, fieldInputs[trait.field.key]);
                    const unchanged = traitUnchanged(trait, saved, picks, later.creation, rolled);
                    if (unchanged && toFinishOf(later.creation).includes(trait.id)) return advance(later.creation);
                    if (trait.list.rolls > 1 && picks.length > 0 && !unchanged && !(await savePicks(picks, rolled))) return;
                    const done = await saveToFinish(db, user, later.character, trait.id, true);
                    if (!done.ok) return toast({ text: done.message });
                    advance(done.creation);
                  })()
          }
        />
      );
    }
    // Details (cs-1; mockup creation/11): optional, skipped in one tap, never blocking Send; saved on the fields.
    if (step === 'details' && kindredNow) {
      const guide = stepGuide(setting.rulesSets, 'details');
      return (
        <DetailsStep
          key="details"
          tables={kindredTablesNow}
          kindred={kindredNow.name}
          physical={physicalOf(kindredNow)}
          details={stepPicks.details ?? detailsOf(null)}
          onDraft={(details) => setStepPicks((was) => ({ ...was, details }))}
          title={guideTitle(setting.rulesSets, 'details', STEP_TITLES.details)}
          why={guide.why}
          help={guide.help ?? APP_HELP.details ?? null}
          counter={shellAt}
          onBack={() => back()}
          onSave={async (details) => {
            const saved = await runCommand(registry, db, user, editCharacter, { character: later.character, changes: { details } });
            // A failed save stays on the step, said on the foot's ▲ line (after-test A11); offline in its own words.
            if (!saved.ok) return typeof navigator !== 'undefined' && navigator.onLine === false ? SEND_OFFLINE : saved.message;
            advance();
            return null;
          }}
        />
      );
    }
    // A step with nothing to show now (the steps were set when the draft was made; a level changed on Who they are since
    // can leave the class nothing there): straight on; reached by Back, its line says why (clo-5, final drafts F).
    if (later.back) {
      return (
        <SkippedStep
          key={`${later.at}-${step ?? ''}`}
          title={guideTitle(setting.rulesSets, (step ?? 'details') as GuideStep, toFinishName(step ?? ''))}
          counter={shellAt}
          why={skippedWhy(step ?? '', chosen?.klass.name ?? '')}
          onBack={() => back()}
          onNext={() => advance()}
        />
      );
    }
    return <SkipStep key={`${later.at}-${step ?? ''}`} onSkip={() => advance()} />;
  }

  if (sent) {
    return (
      <section className="auth auth--centred">
        <h1 className="auth__title">{sent} is ready</h1>
        <p className="auth__meta">{joined ? 'They’ve joined the party.' : 'Sent to the GM for approval.'}</p>
        <button type="button" className="button-quiet" onClick={onDone}>
          Back to {campaign.name}
        </button>
      </section>
    );
  }

  if (path === null) return <CreationLoading line="Loading your setting's rules…" />;

  // Coming back after Leave (cw-13; final drafts F, mockup creation/final/08): Continue where you left off as a sheet,
  // naming what was kept, where and when; Continue carries the accent. ✕ leaves the picks kept and shows the start.
  if (path === 'start' && keptPicks && !continueKept && !keptAside) {
    const when = keptWhen(keptPicks.savedAt);
    return (
      <section className="auth" aria-labelledby="new-character-kept">
        <p className="auth__meta">New character in {campaign.name}</p>
        <h1 id="new-character-kept" className="auth__title">
          A new character
        </h1>
        <Dialog label="Continue where you left off?" onClose={() => setKeptAside(true)}>
          <p className="reading">{`You left a character on this device${when ? ` ${when}` : ''}: ${keptWords(keptPicks) || 'your first steps'}.`}</p>
          {/* The quiet line keeps its first sentence (dec-10 B, cs-6). */}
          <p className="auth__meta">Kept on this device only.</p>
          <div className="dialog__actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setContinueKept(true);
                setPath('guided');
              }}
            >
              Continue
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                forgetKept(user.id, campaign.id);
                setKeptPicks(null);
              }}
            >
              Start again
            </button>
          </div>
        </Dialog>
      </section>
    );
  }

  if (path === 'start') {
    return (
      <section className="auth" aria-labelledby="new-character-way">
        <p className="auth__meta">New character in {campaign.name}</p>
        <h1 id="new-character-way" className="auth__title">
          How do you want to make them?
        </h1>
        <p className="guided-instruction">Choose how to make this character: step by step, or freeform.</p>
        <div className="guided__choices">
          <ChoiceCard title="Guided" summary="Step by step, from your setting." onChoose={() => setPath('guided')} />
          <ChoiceCard title="Freeform" summary="Type in what you rolled." onChoose={() => setPath('form')} />
        </div>
        {/* Back on the first step leaves (N9: no Later button). */}
        <button type="button" className="button-quiet" onClick={onDone}>
          Back
        </button>
      </section>
    );
  }

  /** Back off a redo (its first step's Back): the review again, nothing written. */
  const cancelRedo = () => {
    setRedo(null);
    setResumeAt(null);
    setPath('form');
  };
  /**
   * The re-walk's end (cf-7): the choice goes onto the draft through creation.redo. The fields that hold the scores
   * and the race follow, and the rules' fills with them (as at the first walk). A changed race or class clears the
   * later steps' picks: here each trait field and the languages the old race or class gave (the player's own picks
   * stay, re-counted when the step is walked again); the command clears the book, the gear and the weapon skills. A
   * toast says so, with Undo (the log's, as one change); then those steps are walked again, to the review.
   */
  async function finishRedo(choice: GuidedChoice) {
    if (!redo || !setting || busy) return;
    const c = redo.character;
    const was = chosen;
    const changed = raceOrClassChanged({ classRef: c.classRef, raceRef: c.raceRef }, { classRef: choice.klass.packEntryId, raceRef: choice.race?.packEntryId ?? null });
    const highest = classLevelCap(choice.klass, raceAsPlayed(choice.race ?? null, choice.klass));
    const atLevel = highest !== null && c.level > highest ? highest : c.level;
    const next = plannedFor(choice, atLevel);
    // Every field's saved value, those the new class or kindred hides too (cs-3: kept, shown again on a change back).
    const base = fieldInputsFrom(campaignFields, c.fields);
    const filled: FieldInputs = {};
    for (const def of fieldDefs) {
      const ability = Object.keys(choice.scores).find((k) => holdsAbility(def.key, k));
      if (ability) filled[def.key] = String(choice.scores[ability]);
      if (def.key.toLowerCase() === 'race') filled[def.key] = choice.race?.name ?? classRace(choice.klass.data, setting.all.filter((e) => e.kind === 'race'))?.name ?? '';
    }
    if (changed) {
      for (const t of [...traits, ...next.traits]) filled[t.field.key] = '';
      if (languagesField && next.languagePlan) {
        const picks = languagePlan ? picksFromSaved(languagePlan, base[languagesField.key]) : { chosen: [], others: [] };
        const kept = picks.chosen.filter((id) => next.languagePlan!.offered.some((o) => o.id === id));
        filled[languagesField.key] = languageText(languagesOfPlan(next.languagePlan, { chosen: kept, others: picks.others }));
      }
    }
    // The patron changed on its step (pt-10): the alignment and affiliation it sets follow, written with the redo.
    const savedPatron = patronChoiceOf(c.creation);
    const patronChanged = (savedPatron.patron?.id ?? null) !== (choice.patron?.id ?? null) || !!savedPatron.patronLater !== !!choice.patronLater;
    const byPatron = patronChanged ? patronFills(choice, base, savedPatron.patron?.name ?? '') : null;
    if (byPatron) Object.assign(filled, byPatron.fields);
    const updated = refill(choice, atLevel, { ...base, ...filled });
    // Only what this changes goes to the command: the fields above and the rules' fills; a field given as '' is cleared.
    const keys = new Set([...Object.keys(filled), ...fieldDefs.filter((def) => def.fill).map((def) => def.key)]);
    const fields = Object.fromEntries([...keys].map((key) => [key, typeof updated[key] === 'boolean' ? updated[key] : String(updated[key] ?? '')]));
    setBusy(true);
    const done = await runCommand(registry, db, user, redoCreation, {
      character: redo.ref,
      choice: { classRef: choice.klass.packEntryId, raceRef: choice.race?.packEntryId ?? null, method: choice.method, rolled: choice.rolled, scores: choice.scores, ...(choice.special?.length ? { specialApprovals: choice.special } : {}), ...(choice.scoresAverage?.length ? { scoresAverage: choice.scoresAverage } : {}), patron: choice.patron ?? null, patronLater: !!choice.patronLater },
      level: atLevel,
      fields,
    });
    // The patron changed alone (pt-6, pt-11; Francis's report, 2026-11-12): its garb follows it in the pack now, not
    // only when the Gear step next opens, which a change from the review never reaches. Change patron and Next with
    // the same patron runs it too: that is how a swap that failed is tried again (gs-5); with the garb already right
    // it does nothing.
    const garbSwap = done.ok && !done.value.changed && (patronChanged || resumeAt === 'patron') ? await swapPatronGarb(db, user, setting, done.value.character, { level: atLevel, classRef: choice.klass.packEntryId, raceRef: choice.race?.packEntryId ?? null }, fieldDefs, next.gearHere) : null;
    const garbFailed = !!garbSwap && !garbSwap.ok;
    setBusy(false);
    if (!done.ok) return toast({ text: done.message });
    // The record as the swap left it, failed or not, so Gear on a walk back never takes the old garb out twice.
    const redone = garbSwap?.creation ?? done.value.creation;
    setRedo(null);
    setResumeAt(null);
    setChosen(choice);
    setLevel(atLevel);
    setDraftRef(done.value.character);
    setFieldInputs(updated);
    setPath('form');
    if (!done.value.changed) {
      // Walking back (ct3-5): forward again to Who they are, then the same steps, every pick kept.
      if (walkBack) {
        setAfterWho({ character: done.value.character, creation: redone, steps: next.walked });
        setWhoChange(true);
        if (garbFailed) toast({ text: GARB_SWAP_FAILED, error: true });
        return;
      }
      // A patron changed (pt-10) says what it changed, as its pick did on Who they are (pt-7); garb that couldn't
      // follow it says so first, in the same toast, an error toast (gs-5a; the toast part holds no line break, so two
      // sentences). A try of the garb again (the patron unchanged, the swap run) names the patron, never "Scores
      // saved.", which nothing here saved (#727 review).
      const retried = !patronChanged && !!garbSwap && (garbFailed || (garbSwap.ok && garbSwap.creation !== null));
      const said = byPatron?.patron
        ? patronPickToast({
            name: byPatron.patron.name,
            alignment: byPatron.change && 'set' in byPatron.change ? { word: (alignmentField?.label ?? 'alignment').toLowerCase(), name: byPatron.change.set } : null,
            cleared: byPatron.change && 'clear' in byPatron.change ? { word: (alignmentField?.label ?? 'alignment').toLowerCase(), name: byPatron.wasAlignment } : null,
            also: byPatron.also?.label ?? null,
          })
        : retried && choice.patron
          ? patronPickToast({ name: choice.patron.name })
          : patronChanged || retried
            ? choice.patronLater
              ? 'Patron put off: it stays on your To finish list.'
              : 'Patron taken off.'
            : 'Scores saved.';
      toast(garbFailed ? { text: `${GARB_SWAP_FAILED} ${said}`, error: true } : { text: said });
      setReviewVersion((v) => v + 1);
      return;
    }
    setSpellPicks(NO_PICKS);
    // A class change clears the expertise points (redo.ts); a changed kindred alone keeps them.
    setStepPicks((was) => ({ weaponSkills: [], ...(!done.value.classChanged && was.expertise ? { expertise: was.expertise } : {}) }));
    const what = c.classRef !== choice.klass.packEntryId ? (c.raceRef !== (choice.race?.packEntryId ?? null) ? 'Race and class' : 'Class') : 'Race';
    toast({
      text: `${what} changed: ${done.value.classChanged ? CLASS_CLEARED_WORDS : CLEARED_WORDS}.`,
      onUndo: () => {
        void (async () => {
          const eventId = await latestChange(db, campaign.id, 'creation.redo', user.id);
          const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
          if (!undone?.ok) return toast({ text: undone?.message ?? "Couldn't undo that. Check your connection and try again." });
          // Back to the draft as it was: the old choice, the review read again.
          if (was) setChosen(was);
          setLater(null);
          setAfterWho(null);
          setWhoChange(false);
          setKeptHp(c.hpMax);
          setFieldInputs(base);
          setReviewVersion((v) => v + 1);
          toast({ text: 'Put back as it was.' });
        })();
      },
    });
    // On a class change the hit points went with the old die (ruled B, amended: not on a race change alone): Who they
    // are first for the new roll when the campaign asks one (the name, alignment and the rest kept), then the cleared
    // steps; otherwise straight to those.
    if (hpAsk && done.value.classChanged) {
      setName(c.name);
      setLevel(atLevel);
      setBackstory(c.backstory);
      setKeptHp(null);
      resetHp();
      setKeptRoll(null);
      setSavedPortrait(c.portraitAssetId);
      setPortraitChoice(null);
      setError(null);
      setAfterWho({ character: done.value.character, creation: done.value.creation, steps: next.walked });
      setWhoChange(true);
    } else if (next.walked.length > 0) setLater({ character: done.value.character, creation: done.value.creation, steps: next.walked, at: 0 });
    else setReviewVersion((v) => v + 1);
  }

  if (path === 'guided' && setting) {
    return (
      <GuidedCreation
        key={`${resumeAt ?? 'start'}${resumeUnpick ? ':unpick' : ''}`}
        setting={setting}
        // An ability's name: the GM's own field label, else the setting's, else the key (ruled 2026-10-29, B6).
        labels={(key) => abilityNames(setting.rulesSets, fieldDefs)(key).short}
        // The full name on the Scores step (cw-11).
        names={(key) => abilityNames(setting.rulesSets, fieldDefs)(key).long}
        onBack={() => (redo ? cancelRedo() : setPath('start'))}
        // A redo from the review (cr-18): Back on its first step returns to the review (the top row has Leave, cw-11).
        backOnFirst={!!redo}
        // Leave keeps the picks on this device (cw-13); Continue brings them back. Not on a redo: the draft holds them.
        keep={redo ? undefined : { userId: user.id, campaignId: campaign.id }}
        kept={continueKept && !redo ? keptPicks : null}
        // Back from the step Change opened, with nothing changed, returns to the review too (cw-11); not on a walk back (ct3-5).
        reviewBack={!!redo && !walkBack}
        resume={chosen && resumeAt ? { choice: chosen, step: resumeAt, unpick: resumeUnpick } : undefined}
        stepsAfter={1 + laterPlanned.length + 1}
        // The counter's total once the class is picked (ruled B 2026-11-05): Who they are, the later steps for that class, the review.
        stepsAfterFor={(choice) => 1 + plannedFor(choice, level).steps.length + 1}
        alignmentNames={alignmentNames}
        // A redo's end writes the change (cf-7): there the class's Pick waits for Next.
        finishOnPick={!redo}
        onDone={(choice, picked) => {
          if (redo) return void finishRedo(choice);
          // The draft takes over from the kept picks (cw-13; GuidedCreation forgot them on the device).
          setKeptPicks(null);
          setContinueKept(false);
          setResumeAt(null);
          setResumeUnpick(false);
          setChosen(choice);
          // The class's Pick moved on (ct-1): say so, with Undo back to the class step, nothing picked.
          if (picked)
            toast({
              text: `${choice.klass.name} picked${choice.special?.some((s) => s.step === 'class') ? ': needs the GM’s special approval' : ''}`,
              onUndo: () => {
                setResumeAt('class');
                setResumeUnpick(true);
                setPath('guided');
              },
            });
          // The scores fill the campaign's fields that have their names (a sheet layout's STR, say).
          const filled: FieldInputs = {};
          for (const def of fieldDefs) {
            const ability = Object.keys(choice.scores).find((k) => holdsAbility(def.key, k));
            if (ability) filled[def.key] = String(choice.scores[ability]);
            if (def.key === 'languages' && !fieldInputs[def.key]) filled[def.key] = languagesOf(choice, fieldDefs, fieldInputs, setting.rulesSets);
            // A campaign field for the race (an older sheet layout added one) shows the race chosen (M4b re-test).
            // With no race picked (the class is the race), the race the class names, else none (ruled 2026-10-29, B10).
            if (def.key.toLowerCase() === 'race')
              filled[def.key] = choice.race?.name ?? classRace(choice.klass.data, setting.all.filter((e) => e.kind === 'race'))?.name ?? '';
          }
          const highest = classLevelCap(choice.klass, raceAsPlayed(choice.race ?? null, choice.klass));
          const atLevel = highest !== null && level > highest ? highest : level;
          setLevel(atLevel);
          // The patron picked on its step (pt-10) sets or narrows the alignment and fills the affiliation (pt-3, pt-7);
          // Who they are's alignment line says why.
          const base = { ...fieldInputs, ...filled };
          refill(choice, atLevel, { ...base, ...patronFills(choice, base, chosen?.patron?.name ?? '').fields });
          setPath('form');
        }}
      />
    );
  }

  // A field change; a language named after a field (an "Alignment" tongue) follows it until the player changes the list (N7).
  const setField = (key: string, value: string | boolean) =>
    setFieldInputs((inputs) => {
      const next = { ...inputs, [key]: value };
      if (chosen && key !== 'languages' && typeof inputs.languages === 'string' && inputs.languages === languagesOf(chosen, fieldDefs, inputs, setting?.rulesSets ?? [])) {
        next.languages = languagesOf(chosen, fieldDefs, next, setting?.rulesSets ?? []);
      }
      return next;
    });

  // Who they are (cr-12; mockup creation/04), on the creation step shell: only what nothing else fills (the name, the
  // hit points rolled, the alignment, a portrait, the layout's free fields), then the Derived fields, read-only.
  if (chosen && setting) {
    const guide = stepGuide(setting.rulesSets, 'who');
    const alignmentKey = alignmentField?.key ?? '';
    // A reopened draft keeps its saved hit points while nothing new is entered (m5b-0c slice 7).
    const hpKept = hpKeptNow;
    const hpState = hpRule ? (hpKept ? { typed: true, problem: null } : { typed: hpText.trim() !== '', problem: hpRule.dice ? hpProblem(hpText, hpRule) : parseHpMax(hpText) ? null : hpText.trim() ? HP_ERROR : 'Type the hit points your GM gives you.' }) : null;
    const alignmentWord = (alignmentField?.label ?? 'alignment').toLowerCase();
    // Fields fed by a table (the knight's liege, cs-3, G-89): the table opens, the row tapped is saved; a row carrying
    // an alignment sets the character's, and the alignment group then offers only it, with a line saying why.
    const fromTables = tableFields(fieldDefs, new Map([...layout].map(([key, hint]) => [key, hint.from])), entriesInPlay(setting.all).filter((e) => e.kind === 'table'));
    const tableKeys = new Set(fromTables.map((f) => f.key));
    const setBy = alignmentSetBy(fromTables, fieldInputs);
    // A patron picked leaves only the alignments its followers may have (pt-3), after the liege's.
    const offered = patronAlignmentOffer(alignmentOfferSet(alignmentOffered, alignments.length > 0 ? setBy : null, klassWord, alignmentWord), alignments.length > 0 ? patron : null, alignmentWord);
    // A pick from a table (cw-5, cw-12; Design's answers 2026-11-06): the field gets the row's plain name (else its
    // words); a row carrying an alignment sets the character's; the layout's `alsoFills` field (the knight's
    // affiliation) gets the same name while it's empty or still holds what the previous pick wrote. The toast says what
    // changed, and its Undo puts all three back.
    const alsoFills = tableAlsoFills(setting.all);
    const pickFromTable = (key: string, words: string | null) => {
      const field = fromTables.find((f) => f.key === key);
      if (!field) return;
      const str = (k: string) => (typeof fieldInputs[k] === 'string' ? String(fieldInputs[k]) : '');
      const previous = str(key);
      const previousAt = rowOf(field.table, previous);
      const previousWords = previousAt >= 0 ? rowWords(field.table.rows[previousAt]!) : previous;
      const at = words === null ? -1 : rowOf(field.table, words);
      const row = at >= 0 ? field.table.rows[at] : undefined;
      const value = row ? rowWords(row) : (words ?? '');
      const also = alsoFillsField(fieldDefs, alsoFills.get(key));
      const was = { value: previous, alignment: str(alignmentKey), also: also ? str(also.key) : '' };
      const writeAlso = !!also && was.also !== value && mayAlsoFill(was.also, previousWords);
      const sets = row?.alignment && alignmentField ? alignmentNamed(alignments, row.alignment) : undefined;
      setField(key, value);
      if (writeAlso) setField(also.key, value);
      if (sets) setField(alignmentKey, sets.name);
      const alignmentChanged = !!sets && was.alignment !== sets.name;
      const undo = () => {
        setField(key, was.value);
        if (writeAlso) setField(also.key, was.also);
        if (alignmentChanged) setField(alignmentKey, was.alignment);
      };
      if (value)
        toast({
          text: tablePickToast({ label: field.label, picked: value, alignment: alignmentChanged ? { word: alignmentWord, name: sets.name } : null, also: writeAlso ? also.label : null }),
          onUndo: undo,
        });
      // Taken off: the alsoFills field it wrote goes with it, and the toast says so.
      else if (writeAlso) toast({ text: `${field.label} taken off, and your ${also.label.toLowerCase()} with it.`, onUndo: undo });
    };
    const whoCheck = whoHint({
      name,
      hp: hpState,
      alignment:
        alignments.length > 0
          ? {
              set: typeof fieldInputs[alignmentKey] === 'string' && fieldInputs[alignmentKey] !== '',
              required: !!alignmentField?.required,
              label: alignmentField?.label ?? 'alignment',
              problem: (alignmentAskedFor(alignmentPicked(fieldInputs)) ? null : alignmentProblem(alignmentLimit, alignmentPicked(fieldInputs), klassWord, alignmentWord)) ?? alignmentSetProblem(setBy, alignmentPicked(fieldInputs), alignments, klassWord, alignmentWord) ?? patronAlignmentProblem(patron, alignmentPicked(fieldInputs), alignments, alignmentWord),
            }
          : null,
    });
    const check = whoCheck;
    // A table row's entry (cw-5): the house's name, its alignment and source, its note; Pick at its foot. A sheet on a
    // phone, beside the step from 700 px (final drafts C).
    const rowEntry = (asSheet: boolean) => {
      const field = tableRowOpen ? fromTables.find((f) => f.key === tableRowOpen.key) : undefined;
      const row = field && tableRowOpen ? field.table.rows[tableRowOpen.at] : undefined;
      if (!field || !row || !tableRowOpen) return null;
      const picked = rowOf(field.table, typeof fieldInputs[field.key] === 'string' ? String(fieldInputs[field.key]) : '') === tableRowOpen.at;
      return (
        <EntryPanel
          name={rowWords(row)}
          meta={field.table.source || undefined}
          // The book format (dec-10 S3): the book alone is the last line; the alignment its own line, in the pack's word.
          source={field.table.source ?? ''}
          lead={row.note ?? (row.name && row.name !== row.text ? row.text : undefined)}
          headings={row.alignment ? [{ label: alignmentField?.label ?? 'Alignment', text: row.alignment }] : []}
          picked={picked}
          onPick={() => {
            pickFromTable(field.key, picked ? null : row.text);
            setTableRowOpen(null);
          }}
          onClose={() => setTableRowOpen(null)}
          asSheet={asSheet}
        />
      );
    };
    const derived = derivedRows(fieldDefs, guidedFills, derivedNotes);
    const derivedValues = (
      <DerivedFields
        rows={derived}
        open={derivedOpen ?? false}
        onToggle={setDerivedOpen}
        onExplain={(row) => setBreakdown(derivedBreakdown(row.key, row.label) ?? { title: row.label, lines: [`${row.label} is worked out by your setting's rules from your picks. It changes when they do.`] })}
      />
    );
    const worked = hpKept ? `Now ${keptHp} hit points. Enter a new roll to change it.` : hpRule?.dice ? hpWorkedLine(hpText, hpRule) : '';
    // The setting's re-roll (cf-1): offered, never forced, when its option is on and the die showed its number or less.
    const reroll = hpReroll(setting.rulesSets);
    // Only for a roll entered: the untouched average is no roll.
    const offerReroll = !!hpRule && !hpKept && hpTouched && keptRoll !== hp.trim() && rerollOffered(hp, hpRule, reroll, (optionId) => optionOn(setting, optionId));
    return (
      <CreationStep
        title={guideTitle(setting.rulesSets, 'who', STEP_TITLES.who)}
        counter={whoChange && !walkBack ? undefined : { at: ownSteps + 1, of: totalSteps }}
        why={guide.why}
        help={guide.help ?? APP_HELP.who ?? null}
        onBack={() => {
          // Walking back (ct3-5): the draft is made, so the guided steps open as a redo of it, every value kept.
          if (walkBack && draftRef) {
            const ref = draftRef;
            return void loadMyCharacters(db, campaign.id, user.id).then((mine) => {
              const c = mine?.find((x) => x.id === ref.id);
              if (!c) return toast({ text: "Couldn't open the earlier steps. Check your connection and try again." });
              setRedo({ ref, character: c });
              setResumeAt('adjust');
              setResumeUnpick(false);
              setWhoChange(false);
              setError(null);
              setPath('guided');
            });
          }
          // Changed from the review (cr-18): back to it, as saved.
          if (whoChange) return void (setWhoChange(false), setAfterWho(null), setError(null));
          // Back to the adjustments (or the class, without them), with everything here kept.
          setResumeAt('adjust');
          setResumeUnpick(false);
          setPath('guided');
        }}
        hint={sendFailed ?? check.hint}
        stop={!!sendFailed}
        busy={busy}
        onNext={() => (check.problem ? toast({ text: check.problem }) : void send())}
      >
        <CharacterFields
          name={name}
          level={level}
          hp={hp}
          backstory={backstory}
          onName={setName}
          onLevel={changeLevel}
          onHp={setHp}
          onBackstory={setBackstory}
          fieldDefs={fieldDefs}
          fieldInputs={fieldInputs}
          onField={setField}
          levels={levels}
          only="who"
          // The kindred's name tables (cs-1; R3-1): Roll for a name beside or under the field, where the name came from under it.
          nameAction={nameRoll.button ?? undefined}
          nameNote={nameRoll.fromLine ?? undefined}
          namePlaceholder={nameRoll.has ? 'Type a name, or roll for one' : undefined}
        />
        {hpRule && (
          // Hit points (final drafts C, mockup creation/final/03): the Roll row with the class's die, then the average
          // stepper holding the die roll (the average prefilled); the app adds the score's bonus and shows the sum,
          // never below 1. Without dice (the GM gives them) a plain stepper.
          <PickGroup title="Hit points">
            {hpRule.dice ? <RollRow die={dieOf(hpRule.dice)}>{hpAskLine(hpRule)}</RollRow> : <p className="creation-group__line">Enter the hit points your GM gives you.</p>}
            {/* The group's heading names it (final drafts C): the stepper sits under the Roll row with no second label. */}
            <div className="hp-roll">
              <AverageStepper
                id="character-hp"
                label="Hit points"
                text={hpKept ? '' : hpText}
                touched={!hpLeftAverage}
                caption={worked}
                untouchedLine={[AVERAGE_LINE, hpAverage !== null && hpRule ? hpAverageLine(hpAverage, hpRule) : ''].filter(Boolean).join('. ')}
                onChange={(text) => {
                  setHpTouched(true);
                  setHp(text);
                }}
                onStep={(by) => {
                  const range = (hpRule.dice ? diceRange(hpRule.dice) : null) ?? { min: 1, max: 999 };
                  const now = /^\s*\d+\s*$/.test(hpText) ? Number(hpText.trim()) : null;
                  const next = now === null ? (hpAverage ?? range.min) : now + by;
                  setHpTouched(true);
                  if (next < range.min || next > range.max)
                    return toast({ text: hpRule.dice ? `${hpRule.dice} gives ${range.min}–${range.max}.` : `Hit points run from ${range.min} to ${range.max}.` });
                  setHp(String(next));
                }}
              />
            </div>
          </PickGroup>
        )}
        {offerReroll && reroll && (
          <StartOverCallout
            text={reroll.note || 'By this setting’s rule you may roll the hit points again.'}
            startOverLabel="Roll again"
            keepLabel="Keep it"
            onStartOver={() => {
              const was = hp;
              resetHp();
              toast({
                text: 'Roll again at the table and type the new number.',
                onUndo: () => {
                  setHpTouched(true);
                  setHp(was);
                },
              });
            }}
            onKeep={() => setKeptRoll(hp.trim())}
          />
        )}
        {fromTables.map((field) => {
          const value = typeof fieldInputs[field.key] === 'string' ? String(fieldInputs[field.key]) : '';
          const help = layoutHelp(setting.all).get(field.key);
          const setsAlignment = alignments.length > 0 && field.table.rows.some((r) => r.alignment);
          const pickedAt = rowOf(field.table, value);
          return (
            <PickGroup key={field.key} title={field.label}>
              {/* Every table's roll in a Roll row above its rows (creation follow-up; retest 2's audit: the long table and a
                  table without a die had none). No die in the pack: the row without a glyph, "Roll on the table". A row
                  that sets the alignment says so in the Roll row, not the heading (Design, gallery review of #555):
                  "Roll d8 for your liege, then tap the row; it sets your alignment.", the die, the field and the
                  alignment's word all the pack's. The pack's help line stays under it. */}
              <RollRow die={dieOf(field.table.die)}>
                {setsAlignment
                  ? help
                    ? // The pack's own line says what the pick is: the Roll row is cut to the act and its consequence (cs-8, dec-10 D).
                      `${rollWords(field.table)}, then tap the row. It sets your ${alignmentWord}.`
                    : `${rollWords(field.table)} for your ${field.label.toLowerCase()}, then tap the row; it sets your ${alignmentWord}.`
                  : isLong(field.table)
                    ? `${rollWords(field.table)}, then tap the row.`
                    : `${rollWords(field.table)}, or choose.`}
              </RollRow>
              {help && <p className="creation-group__line">{help}</p>}
              {isLong(field.table) ? (
                // A long table (a d100) keeps its one row and the table sheet (its rows under tens headings; the row is the tap).
                <DetailRow label={field.label} value={value} roll={rollWords(field.table)} onOpen={() => setTableOpen(field.key)} />
              ) : (
                // A short one is pick rows like any other (cw-5): the name opens the row's entry, Pick picks; the
                // second line carries the alignment and the roll that lands on it. Folded under one row (R3-4: every
                // describing table starts collapsed), open from the start only with the pick inside.
                <TableFold count={field.table.rows.length} picked={pickedAt >= 0 ? rowWords(field.table.rows[pickedAt]!) : null}>
                  {field.table.rows.map((row, at) => (
                    <PickRow
                      key={at}
                      name={rowWords(row)}
                      blurb={[row.alignment, `${rangeOf(row)} on the ${field.table.die || 'die'}`].filter(Boolean).join(', ')}
                      picked={at === pickedAt}
                      onPick={() => pickFromTable(field.key, at === pickedAt ? null : row.text)}
                      onOpen={() => setTableRowOpen({ key: field.key, at })}
                    />
                  ))}
                </TableFold>
              )}
            </PickGroup>
          );
        })}
        {rowEntry(true)}
        {(() => {
          const field = fromTables.find((f) => f.key === tableOpen);
          if (!field) return null;
          const value = typeof fieldInputs[field.key] === 'string' ? String(fieldInputs[field.key]) : undefined;
          return (
            <OneTableSheet
              table={field.table}
              // A long table's sheet says what is picked (cs-15): the field's own name.
              title={field.label}
              picked={value}
              onPick={(words) => {
                pickFromTable(field.key, words);
                if (words && !isLong(field.table)) setTableOpen(null);
              }}
              onClose={() => setTableOpen(null)}
            />
          );
        })()}
        {alignments.length > 0 && alignmentField && (
          <div className="field" role="group" aria-label={alignmentField.label}>
            <p className="label">{alignmentField.label}</p>
            {alignmentLine(setting.rulesSets) && <p className="creation-group__line">{alignmentLine(setting.rulesSets)}</p>}
            {alignmentVisibility(setting.rulesSets) === 'owner' && <p className="creation-group__line">Only you and your GM see it.</p>}
            {offered.line && <p className="creation-group__line">{offered.line}</p>}
            {(() => {
              // Open rows first; those needing the GM's approval fold after them (Francis, retest 2, 2026-11-07).
              const needsGm = (row: (typeof offered.rows)[number]) => !!row.closed || !!row.special;
              const free = offered.rows.filter((row) => !needsGm(row));
              const gm = offered.rows.filter(needsGm);
              const alignmentRow = (row: (typeof offered.rows)[number]) => {
                const picked = fieldInputs[alignmentKey] === row.name;
                // Asked for (final drafts C): flagged for the GM, and Picked ✓ shows so it can be taken off.
                const asked = !!row.closed && picked;
                return (
                  // The row's text opens its entry (ct3-11), as every pack-list row does; Pick at its foot. Outside a soft
                  // limit, the row says it needs the GM's special approval (cs-3).
                  <PickRow
                    key={row.name}
                    name={row.name}
                    blurb={row.blurb}
                    {...(row.special || asked ? { fit: [{ text: SPECIAL_NOTE, warn: true }] } : {})}
                    {...(row.closed && !asked ? { fit: [{ text: `Not open to ${klassWord}`, warn: true }], closed: true } : {})}
                    picked={picked}
                    onPick={() => setField(alignmentKey, picked ? '' : row.name)}
                    // A closed row (cw-8) has no Pick: the row's text explains why in a sheet, which offers Ask the GM to allow it.
                    onOpen={() => (row.closed && !asked ? setAlignmentClosed(row.name) : setAlignmentOpen(row.name))}
                  />
                );
              };
              return (
                <>
                  {free.map(alignmentRow)}
                  <ApprovalFold count={gm.length} more={free.length > 0} holdsPick={gm.some((row) => fieldInputs[alignmentKey] === row.name)}>
                    {gm.map(alignmentRow)}
                  </ApprovalFold>
                </>
              );
            })()}
          </div>
        )}
        {alignmentClosed && (
          <EntryPanel
            name={alignmentClosed}
            headings={[]}
            closed={{
              why: `Not open to ${klassWord}`,
              note: `${alignmentClosedReason(klassWord, alignmentClosed)} ${ASK_GM_NOTE}`,
              onAsk: () => {
                const was = alignmentPicked(fieldInputs);
                const name = alignmentClosed;
                setAlignmentAsked(name);
                setField(alignmentKey, name);
                setAlignmentClosed(null);
                toast({ text: `${name} picked: needs the GM’s special approval`, onUndo: () => setField(alignmentKey, was) });
              },
            }}
            onClose={() => setAlignmentClosed(null)}
            asSheet
          />
        )}
        {(() => {
          const opened = alignmentOpen && alignmentField ? alignmentEntry({ all: setting.all, rulesSets: setting.rulesSets, packName: () => '', scores: {}, label: (k) => k, raceRef: null, classRef: null }, alignmentField, alignmentOpen) : null;
          return opened ? (
            <EntryPanel
              name={opened.name}
              meta={opened.meta}
              lead={opened.lead}
              headings={opened.headings}
              picked={fieldInputs[alignmentKey] === opened.name}
              onPick={() => {
                setField(alignmentKey, fieldInputs[alignmentKey] === opened.name ? '' : opened.name);
                setAlignmentOpen(null);
              }}
              onClose={() => setAlignmentOpen(null)}
              asSheet
            />
          ) : null;
        })()}
        <PortraitPicker db={db} campaignId={campaign.id} name={name} currentAssetId={whoChange ? savedPortrait : null} choice={portrait} onChoice={setPortraitChoice} />
        <CharacterFields
          name={name}
          level={level}
          hp={hp}
          backstory={backstory}
          onName={setName}
          onLevel={changeLevel}
          onHp={setHp}
          onBackstory={setBackstory}
          fieldDefs={fieldDefs}
          fieldInputs={fieldInputs}
          onField={setField}
          help={guidedHelp}
          // A field fed by a table has its own group above (cs-3).
          hide={(def) => hideFilled(def) || tableKeys.has(def.key)}
          traitLists={lists}
          only="details"
        />
        <CharacterFields
          name={name}
          level={level}
          hp={hp}
          backstory={backstory}
          onName={setName}
          onLevel={changeLevel}
          onHp={setHp}
          onBackstory={setBackstory}
          fieldDefs={fieldDefs}
          fieldInputs={fieldInputs}
          onField={setField}
          only="story"
        />
        {/* One column at every width (Francis, retest 2, 2026-11-07): what the rules work out sits under the fields
            the player fills, at the end of the step, never beside them. The open name table is a sheet. */}
        {derivedValues}
        {nameRoll.sheet(true)}
        {breakdown && (
          <Dialog label={breakdown.title} onClose={() => setBreakdown(null)}>
            <Breakdown lines={breakdown.lines} />
            <div className="dialog__actions">
              <button type="button" className="button-primary" onClick={() => setBreakdown(null)}>
                Got it
              </button>
            </div>
          </Dialog>
        )}
        <ErrorToast message={error} />
      </CreationStep>
    );
  }

  // Freeform (or a setting without classes): one form, sent to the GM (or made at once).
  return (
    <form className="auth" onSubmit={send} noValidate>
      <p className="auth__meta">New character in {campaign.name}</p>
      <h1 className="auth__title">Who are they?</h1>
      <CharacterFields
        name={name}
        level={level}
        hp={hp}
        backstory={backstory}
        onName={setName}
        onLevel={changeLevel}
        onHp={setHp}
        onBackstory={setBackstory}
        fieldDefs={fieldDefs}
        fieldInputs={fieldInputs}
        onField={setField}
        afterName={<PortraitPicker db={db} campaignId={campaign.id} name={name} currentAssetId={null} choice={portrait} onChoice={setPortraitChoice} />}
        levels={levels}
        hpAsk={hpAsk}
        traitLists={lists}
      />
      <ErrorToast message={error} />
      <div className="footer-buttons">
        {/* Back to "How do you want to make them?" when the setting offers Guided. */}
        {setting?.all.some((e) => e.kind === 'class') && (
          <button type="button" className="button-quiet" onClick={() => setPath('start')}>
            Back
          </button>
        )}
        <button type="submit" className="button-primary" aria-busy={busy}>
          {busy ? 'Sending…' : atOnce ? 'Add to the party' : 'Send to the GM'}
        </button>
      </div>
    </form>
  );
}

// A player's page for one campaign: the active character's Player screen, or (with none, or from
// ⋯ → Your characters) the list of their characters: switch, make another, portraits, archived.
export function PlayerCampaign({
  db,
  user,
  campaign,
  onCreate,
  onBack,
  opening,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onCreate: () => void;
  onBack: () => void;
  /** Opens on Your characters or Setting rules (an item of creation's ⋯, final draft 9). */
  opening?: 'list' | 'rules';
}) {
  const [characters, setCharacters] = useState<MyCharacter[] | null | 'error'>(null);
  const [version, setVersion] = useState(0);
  // An undo from the log reloads this in place.
  const logVersion = useLogVersion();
  const [showList, setShowList] = useState(opening === 'list');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(opening === 'rules');
  // On a landscape tablet the full sheet sits beside the Player screen; HP changes refresh it.
  const wide = useWide();
  const [sheetRefresh, setSheetRefresh] = useState(0);
  const [givenAt, setGivenAt] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let current = true;
    loadMyCharacters(db, campaign.id, user.id).then(
      (found) => {
        if (!current) return;
        setCharacters(found ?? 'error');
        // Page 13, G4: a character the GM gave this player says so ("From your GM, today").
        void givenToMe(db, user.id, (found ?? []).map((c) => c.id)).then((given) => current && setGivenAt(given));
      },
      () => current && setCharacters('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, user.id, version, logVersion]);
  const fromGm = (id: string) => {
    const at = givenAt.get(id);
    return at ? <span className="auth__meta character-card__line">{fromGmWords(at)}</span> : null;
  };

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaignFields, setFieldDefs] = useState<FieldDefinition[]>([]);
  // A field whose option is off isn't on the cards (of-9), nor one not for the character's class or kindred (cs-3).
  const [gates, setGates] = useState<{ fieldsOff?: ReadonlySet<string>; fieldsFor?: ReadonlyMap<string, FieldFor> } | null>(null);
  const fieldDefs = fieldsInPlay(campaignFields, gates?.fieldsOff);
  const offFor = (character: MyCharacter) => fieldsOffFor(gates, character);
  const fieldDefsFor = (character: MyCharacter) => fieldsInPlay(campaignFields, offFor(character));
  const [companies, setCompanies] = useState<Company[]>([]);
  // A sent-back character open full screen on its review (B18).
  const [reviewing, setReviewing] = useState<string | null>(null);
  // A character open on its sheet's form from Edit on its card (tfr-4).
  const [editingId, setEditingId] = useState<string | null>(null);
  // The Company page (ruled 2026-10-24): from ⋯ until M5's party sigil on Scene; not offered with companies off.
  const [companyOpen, setCompanyOpen] = useState(false);
  const [withCompanies, setWithCompanies] = useState(false);
  // The setting's trait lists, so a card's trait field shows the entry's name, not its id (M5b step 0b).
  const [lists, setLists] = useState<TraitList[]>([]);
  const lookup = traitLookup(lists);
  const toast = useToast();
  // Statuses on the cards (M5 step 9): the symbols, read only (tap the character to see them in play).
  const { book: statusBook } = useStatusBook(db, user, campaign.id, logVersion + version);

  useEffect(() => {
    let current = true;
    void loadCampaignSettings(db, campaign.id).then((found) => current && setWithCompanies(found !== null && companiesOn(found)));
    void loadCampaignSetting(db, user.id, campaign.id).then((found) => {
      if (!current) return;
      setLists(found ? traitListsOf(found.all) : []);
      setGates(found ? { fieldsOff: found.fieldsOff, fieldsFor: found.fieldsFor } : null);
    });
    return () => {
      current = false;
    };
  }, [db, user.id, campaign.id, logVersion]);

  useEffect(() => {
    let current = true;
    loadFieldDefinitions(db, campaign.id).then(
      (found) => current && found && setFieldDefs(found),
      () => undefined,
    );
    loadCompanies(db, campaign.id).then(
      (found) => current && found && setCompanies(found),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, version, logVersion]);
  const companyOf = (character: MyCharacter) => companies.find((c) => c.id === character.companyId)?.name ?? null;

  const onCard = (character: MyCharacter) => {
    const summary = fieldSummary(fieldDefsFor(character), character.fields, { onlyCard: true, lookup });
    return summary ? <p className="auth__meta">{summary}</p> : null;
  };

  const reload = (message?: string) => {
    setNotice(message ?? null);
    setVersion((v) => v + 1);
  };

  const list = Array.isArray(characters) ? characters : [];
  const current = list.filter((c) => !c.archived);
  const archived = list.filter((c) => c.archived);
  const active = current.find((c) => c.active);
  const others = current.filter((c) => !c.active);

  async function makeActive(character: MyCharacter) {
    setError(null);
    const result = await runCommand(registry, db, user, setActiveCharacter, { campaignId: campaign.id, character });
    // Making one active goes straight to its Player screen (A8, ruled 2026-10-25).
    if (result.ok) {
      reload(`${character.name} is now your active character.`);
      setShowList(false);
    } else setError(result.message);
  }

  const remove = (character: MyCharacter) => (
    <RemoveCharacter db={db} user={user} character={character} campaignName={campaign.name} onDone={reload} />
  );

  // One ⋯ menu everywhere in the campaign (N17, ruled 2026-10-28): the campaign's items on every screen here, the
  // sheet, Setting rules and the list included, below each screen's own actions. Most used first (ruled 2026-10-25
  // and 2026-10-26). Each goes straight to its screen from wherever you are.
  const go = (to: 'list' | 'sheet' | 'company' | 'rules' | null) => {
    setReviewing(null);
    setEditingId(null);
    setNotice(null);
    setShowList(to === 'list');
    setSheetOpen(to === 'sheet');
    setCompanyOpen(to === 'company');
    setRulesOpen(to === 'rules');
  };
  const yourCharacters = (
    <MenuItem icon="characters" onClick={() => go('list')}>
      Your characters
    </MenuItem>
  );
  // The phone's drawer lists the characters themselves (slice E): the active one marked, opening its Player screen;
  // another approved one made active as its card in the list does; any other opens the list, where it can be seen.
  const characterRows = current.map((character) => (
    <MenuItem
      key={character.id}
      avatar={character.name.trim().charAt(0).toUpperCase() || '?'}
      current={character.active}
      sub={{ approved: undefined, pending: 'Waiting for the GM', rejected: 'Sent back', draft: 'Not sent yet' }[character.approval]}
      onClick={() => (character.active ? go(null) : character.approval === 'approved' ? void makeActive(character) : go('list'))}
    >
      {character.name}
    </MenuItem>
  ));
  const campaignItems = (
    <>
      {active && !wide && (
        <MenuItem icon="sheet" onClick={() => go('sheet')}>
          Full character sheet
        </MenuItem>
      )}
      {active && withCompanies && active.approval === 'approved' && (
        <MenuItem icon="company" onClick={() => go('company')}>
          Company
        </MenuItem>
      )}
      <MenuItem icon="scales" onClick={() => go('rules')}>
        Setting rules
      </MenuItem>
    </>
  );
  const wrap = (screen: ReactNode) => (
    <CampaignMenuProvider items={campaignItems} characters={yourCharacters} characterRows={characterRows}>
      {screen}
    </CampaignMenuProvider>
  );

  // A sent-back character, or a draft not sent yet, opens on its review (B18; ruled 2026-10-26).
  const sentBack = current.find((c) => c.id === reviewing && (c.approval === 'rejected' || c.approval === 'draft'));
  // A guided draft reopens on the creation review (cr-18, m5b-0c slice 7), every step as saved.
  if (sentBack && sentBack.approval === 'draft' && sentBack.classRef) {
    const leave = () => {
      setReviewing(null);
      reload();
    };
    return wrap(
      <>
        <TopRow back="Your characters" onBack={leave} />
        <CreateCharacter key={sentBack.id} db={db} user={user} campaign={campaign} draft={sentBack} onLeave={leave} onDone={() => (leave(), setShowList(false))} />
      </>,
    );
  }
  if (sentBack) {
    return wrap(
      <section className="auth">
        <TopRow back="Your characters" onBack={() => setReviewing(null)} />
        <CharacterReview
          key={sentBack.id}
          db={db}
          user={user}
          character={sentBack}
          fieldDefs={fieldDefsFor(sentBack)}
          off={offFor(sentBack)}
          onBack={() => setReviewing(null)}
          onChanged={() => reload()}
          onSent={(sent) => {
            // The player lands on the campaign (their active character's screen, if any) with the toast (A6).
            setReviewing(null);
            setShowList(false);
            reload();
            toast(sent);
          }}
        />
      </section>,
    );
  }

  // Edit on a card (tfr-4): the sheet's form straight from the card, for a character the GM has approved or one waiting
  // for approval (M1's second frame, approved 2026-11-19); Save or Cancel comes back to the list with its line.
  const editing = current.find((c) => c.id === editingId && (c.approval === 'approved' || c.approval === 'pending'));
  if (editing) {
    const done = (message: string | null) => {
      setEditingId(null);
      reload(message ?? undefined);
    };
    return wrap(
      <CharacterSheet key={editing.id} db={db} user={user} characterId={editing.id} backLabel="Your characters" onBack={() => done(null)} onEdited={done} />,
    );
  }
  // Edit, with the quill, at the top right of an approved or waiting character's card (tfr-4; the stacked button the
  // Player tab had). The rest of the card still opens the character; the picture still changes it.
  const editOn = (character: MyCharacter) => (
    <StackedButton icon="quill-ink" label="Edit" aria-label={`Edit ${character.name}`} className="character-card__edit" onClick={() => setEditingId(character.id)} />
  );

  if (rulesOpen) {
    return wrap(
      <CampaignRules
        db={db}
        campaign={campaign}
        level={active?.level}
        backLabel={active && !showList ? active.name : 'Your characters'}
        onBack={() => setRulesOpen(false)}
      />,
    );
  }

  if (active && !showList && sheetOpen && !wide) {
    return wrap(
      <CharacterSheet
        db={db}
        user={user}
        characterId={active.id}
        backLabel={active.name}
        onBack={() => {
          setSheetOpen(false);
          reload();
        }}
      />,
    );
  }

  if (active && !showList) {
    return wrap(
      <PlayerScreen
        key={active.id}
        db={db}
        user={user}
        campaign={campaign}
        character={active}
        fieldDefs={fieldDefs}
        onHpChange={() => setSheetRefresh((n) => n + 1)}
        onDataChange={() => {
          reload();
          setSheetRefresh((n) => n + 1);
        }}
        // On a landscape tablet the two columns (dec-13 C1): the full sheet's parts sit in them, read once.
        wide={wide}
        sheetRefresh={sheetRefresh}
        onSheetSaved={() => reload()}
        companyOpen={companyOpen}
        onCompanyDone={() => setCompanyOpen(false)}
        onBack={onBack}
      />,
    );
  }

  return wrap(
    <section className="auth">
      {active ? (
        <TopRow back={`Back to ${active.name}`} onBack={() => setShowList(false)} />
      ) : (
        <TopRow campaign={{ db, campaign }} onBack={onBack} />
      )}
      <CampaignHeading db={db} user={user} campaign={campaign} editable={false} titleClassName="auth__title" />
      <RetiredBanner db={db} user={user} campaign={campaign} />
      <NoticeToast message={notice} />
      <ErrorToast message={error} />
      {characters === null && <p role="status">Opening…</p>}
      {characters === 'error' && (
        <>
          <p className="form-error" role="alert">
            Couldn't load your characters. Check your connection and try again.
          </p>
          <button type="button" className="button-secondary" onClick={() => reload()}>
            Try again
          </button>
        </>
      )}
      {Array.isArray(characters) && current.length === 0 && (
        <>
          <p>No one is in the ledger yet. Make your first character.</p>
          {!campaign.retiredAt && (
            <button type="button" className="button-primary" onClick={onCreate}>
              Create your character
            </button>
          )}
        </>
      )}
      {active && (
        <div className="character-card" {...opensOnTap(() => setShowList(false))}>
          <CardHeading db={db} user={user} character={active} company={companyOf(active)} onOpen={() => setShowList(false)} onPortrait={reload} action={editOn(active)}>
            <span className="auth__meta character-card__line">
              Playing, level {active.level}
              {active.hpMax !== null && `, ${active.hpMax} HP`}
            </span>
            {fromGm(active.id)}
          </CardHeading>
          <CastingStatus db={db} userId={user.id} campaignId={active.campaignId} actorId={active.id} />
          <StatusMarks book={statusBook} actorId={active.id} viewer="player" limit={6} />
          {onCard(active)}
          <div className="character-card__actions">{remove(active)}</div>
        </div>
      )}
      {others.map((character) =>
        character.approval === 'rejected' || character.approval === 'draft' ? (
          <div key={character.id} className={`character-card${character.approval === 'rejected' ? ' character-card--sent-back' : ''}`} {...opensOnTap(() => setReviewing(character.id))}>
            <CardHeading db={db} user={user} character={character} company={companyOf(character)} onOpen={() => setReviewing(character.id)} onPortrait={reload}>
              <span className="auth__meta character-card__line">
                {character.approval === 'draft' ? 'Not sent yet, tap to continue' : 'Your GM sent them back, tap to open'}
              </span>
            </CardHeading>
            <div className="character-card__actions">{remove(character)}</div>
          </div>
        ) : (
          <div key={character.id} className="character-card" {...opensOnTap(character.approval === 'approved' ? () => void makeActive(character) : undefined)}>
            <CardHeading
              db={db}
              user={user}
              character={character}
              company={companyOf(character)}
              onOpen={character.approval === 'approved' ? () => void makeActive(character) : undefined}
              onPortrait={reload}
              action={editOn(character)}
            >
              <span className="auth__meta character-card__line">
                {character.approval === 'pending'
                  ? `Level ${character.level}, waiting for your GM's approval.`
                  : `Not active, level ${character.level}, tap to play`}
              </span>
              {fromGm(character.id)}
            </CardHeading>
            <CastingStatus db={db} userId={user.id} campaignId={character.campaignId} actorId={character.id} />
            <StatusMarks book={statusBook} actorId={character.id} viewer="player" limit={6} />
            {onCard(character)}
            <div className="character-card__actions">{remove(character)}</div>
          </div>
        ),
      )}
      {current.length > 0 && !campaign.retiredAt && (
        <button type="button" className="picker__new" onClick={onCreate}>
          + Make another character
        </button>
      )}
      {Array.isArray(characters) && <PartyList db={db} user={user} campaignId={campaign.id} />}
      <button type="button" className="button-secondary button-secondary--small character-rules" onClick={() => setRulesOpen(true)}>
        Setting rules
      </button>
      {archived.length > 0 && (
        <details className="archived">
          <summary className="archived__summary">Archived characters ({archived.length})</summary>
          <p className="auth__meta">Kept but not in play. Ask your GM if you want one back, or delete it for good.</p>
          {archived.map((character) => (
            <div key={character.id} className="character-card">
              <CardHeading db={db} character={character} company={companyOf(character)}>
                <p className="auth__meta">
                  Archived, level {character.level}
                  {character.hpMax !== null && `, ${character.hpMax} HP`}
                </p>
              </CardHeading>
              {character.backstory && <p className="character-card__backstory">{character.backstory}</p>}
              <div className="character-card__actions">
                <DownloadCopyButton db={db} character={character} campaignName={campaign.name} />
                {remove(character)}
              </div>
            </div>
          ))}
        </details>
      )}
    </section>,
  );
}

/**
 * A character on its review screen (B18, ruled 2026-10-25): a draft not sent yet, or one the GM sent back. The
 * sections come in reading order, each opening its step; gear and starting money reopen the shopping with what was
 * bought (ruled 2026-10-26). Sent back, the GM's note is pinned until it's resent and the sections the GM ticked are
 * marked. Send stays tappable; while something is still to do (HP entered again, a ticked section changed, money
 * gone over) it explains in a pop-up and can send anyway (words batch 1, §8).
 */
function CharacterReview({
  db,
  user,
  character,
  fieldDefs,
  off,
  onChanged,
  onSent,
  onBack,
}: {
  db: Db;
  user: CurrentUser;
  character: MyCharacter;
  fieldDefs: FieldDefinition[];
  /** Sent back, the foot's Back (clo-2, 22-G5): as the top row's back, to Your characters. */
  onBack?: () => void;
  /** The fields left out of `fieldDefs` for this character (an option off, of-9; not for their class, cs-3): their values are kept. */
  off?: ReadonlySet<string>;
  /** The character changed in place (the shopping): load it again. */
  onChanged: () => void;
  /** What the toast says once it went (with Play as when a second character joined at once). */
  onSent: (sent: ToastRequest) => void;
}) {
  const draft = character.approval === 'draft';
  const [name, setName] = useState(character.name);
  const [level, setLevel] = useState(character.level);
  const startHp = character.hpMax === null ? '' : String(character.hpMax);
  const [hp, setHp] = useState(startHp);
  const [backstory, setBackstory] = useState(character.backstory);
  const startInputs = fieldInputsFrom(fieldDefs, character.fields);
  const [fieldInputs, setFieldInputs] = useState<FieldInputs>(() => fieldInputsFrom(fieldDefs, character.fields));
  const [portrait, setPortraitChoice] = useState<PortraitChoice>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ReviewStep | null>(null);
  const [asking, setAsking] = useState<StillToDo[] | null>(null);
  // Null until the player chooses: a draft that hasn't been through the shopping yet opens on it (below).
  const [shopChoice, setShopping] = useState<boolean | null>(null);
  const [shopped, setShopped] = useState(false);
  // Sent back: who sent it and when, for the note's author line (22-G5); null until read, or when the log has none.
  const [sentBy, setSentBy] = useState<{ name: string | null; at: string } | null>(null);
  useEffect(() => {
    if (draft) return;
    let current = true;
    void loadSentBackBy(db, character.id).then((found) => current && setSentBy(found));
    return () => {
      current = false;
    };
  }, [db, character.id, draft]);
  const toast = useToast();
  // Fill in inputs for fields that arrive after the screen first opened.
  const inputs = { ...startInputs, ...fieldInputs };
  // A guided character sent back (or asked for a different level, ruled 2026-10-25): the setting's filled values
  // follow the level in the fields the player didn't edit, and HP is asked when a sheet layout requires it.
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  const [rules, setRules] = useState<{ settings: Record<string, unknown>; lowest: number } | null>(null);
  const [gear, setGear] = useState<InventoryLine[]>([]);
  const [gearVersion, setGearVersion] = useState(0);
  // What the fill gave the fields as the screen opened: a speed typed over it is marked on Send (mv-2).
  const [filledNow, setFilledNow] = useState<FieldInputs>({});
  const refillAt = (found: CampaignSetting, atLevel: number, current: FieldInputs) => {
    if (!character.classRef) return;
    const { filled, links } = settingFills(found, { level: atLevel, scores: scoresOf(found, character.fields, character.creation), classRef: character.classRef, raceRef: character.raceRef }, fieldDefs);
    const gave: FieldInputs = {};
    for (const def of fieldDefs) {
      const name = links.get(def.key);
      if (name && filled[name] !== undefined && !character.editedFields.includes(def.key)) gave[def.key] = showFilled(filled[name]!);
    }
    const next = { ...current, ...gave };
    setFilledNow(gave);
    setFieldInputs(next);
  };
  useEffect(() => {
    let current = true;
    void Promise.all([loadCampaignSetting(db, user.id, character.campaignId), loadNewCharacterRules(db, character.campaignId)]).then(([found, newRules]) => {
      if (!current) return;
      setSetting(found);
      setRules(newRules);
      if (found) refillAt(found, character.level, { ...fieldInputsFrom(fieldDefs, character.fields) });
    });
    return () => {
      current = false;
    };
    // Once per character and campaign; refillAt reads the latest fields as it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user.id, character.id, character.campaignId]);
  useEffect(() => {
    let current = true;
    void loadInventory(db, character.campaignId).then((inventory) => current && setGear(inventory?.lines ?? []));
    return () => {
      current = false;
    };
  }, [db, character.campaignId, gearVersion]);
  const hpRequired = !!rules && hpRequiredOf(rules.settings);
  const hitDie = character.classRef && setting ? setting.all.find((e) => e.kind === 'class' && e.packEntryId === character.classRef)?.data.hitDie : undefined;
  const hpAsk = hpRequired ? { hint: typeof hitDie === 'string' ? `Roll for level ${level} (${hitDie} each) at the table and type the total.` : 'Roll them at the table and type the total.' } : undefined;

  // The shopping reopens for a guided character with starting money, with what was bought and spent.
  const creation = character.creation && typeof character.creation === 'object' && !Array.isArray(character.creation) ? (character.creation as Record<string, unknown>) : {};
  const moneyRoll = setting ? startingMoneyOf(setting.rulesSets) : '';
  // A guided character can shop again while unapproved; it opens as soon as the setting is read (a tap before that
  // used to say "can't be changed here", M4b re-test). The money is typed on the Gear step (m5b-0c slice 5), so a
  // draft left before it reopens there too.
  const canShop = !!character.classRef && (typeof creation.startingMoney === 'number' || !!moneyRoll);
  const [moneyTyped, setMoneyTyped] = useState(() => {
    const was = (character.creation as Record<string, unknown> | null)?.startingMoney;
    return typeof was === 'number' ? String(was) : '';
  });
  // A draft that hasn't been through the shopping yet (the app closed there) opens on it.
  const shopping = shopChoice ?? (draft && canShop && creation.gearDone !== true);

  const made = reviewDetails(setting, character, gear);
  const hpNow = parseHpMax(hp);
  const changed = new Set<string>();
  if (name.trim() !== character.name || level !== character.level || portrait !== null) changed.add('who');
  if (hp.trim() !== startHp) changed.add('hp');
  if (fieldDefs.some((f) => String(inputs[f.key] ?? '') !== String(startInputs[f.key] ?? ''))) changed.add('details');
  if (backstory.trim() !== character.backstory.trim()) changed.add('story');
  if (shopped) {
    changed.add('gear');
    changed.add('money');
  }
  const todo = stillToDo({ flagged: character.reviewSections, changed, hpAsked: hpRequired && character.hpMax === null, hpEntered: typeof hpNow === 'number', over: made.over, canShop });
  const typed = readFieldInputs(fieldDefs, inputs);
  const sections = reviewSections({
    name: name.trim() || character.name,
    level,
    hpMax: typeof hpNow === 'number' ? hpNow : null,
    backstory,
    fields: typed.ok ? typed.values : character.fields,
    fieldDefs,
    editedFields: character.editedFields,
    // A patron switched off by its option is hidden here, kept on the record (pt-9).
    creation: creationShown(setting, character.creation),
    made,
    flagged: character.reviewSections,
    abilityName: (key) => abilityNames(setting?.rulesSets ?? [], fieldDefs)(key).long,
    traitLists: traitListsOf(setting?.all ?? []),
    coins: coinsOf(setting?.rulesSets ?? []),
  });
  const atOnce = draft && !!rules && joinsAtOnce(rules.settings, level, rules.lowest);
  // The sent-back screen's words (cs-53, 22-G5): "Send to the GM" whether sent before or not; "Add to the party" (cs-24).
  const actionWords = atOnce && draft ? 'Add to the party' : 'Send to the GM';

  async function send() {
    if (busy) return;
    setAsking(null);
    if (!name.trim()) return (setEditing('who'), toast({ text: 'Give your character a name.' }));
    if (hpNow === null) return (setEditing('hp'), toast({ text: HP_ERROR }));
    // No patron yet (the lead's ruling, 2026-11-11), or a closed one kept from before: never sent so.
    const patronHeld = patronProblemIn(setting?.all ?? [], character.classRef, creation, alignmentNamesOf(fieldDefs, setting?.rulesSets ?? []));
    if (patronHeld) return toast({ text: patronHeld });
    const fields = readFieldInputs(fieldDefs, inputs);
    if (!fields.ok) return (setEditing('details'), toast({ text: fields.message }));
    setBusy(true);
    const edited = await runCommand(registry, db, user, editCharacter, {
      character,
      changes: {
        name,
        level,
        hpMax: hpNow ?? null,
        hpCurrent: hpNow ?? null,
        backstory: backstory.trim(),
        // The values of fields not on the form for this character are sent back as they are, so they stay saved.
        fields: { ...keptValues(character.fields, off), ...fields.values },
        // A speed typed here is marked as typed by hand; one left as the fill gave it stays unmarked (mv-2).
        editedFields: speedMarks(fieldDefs, character.editedFields, inputs, { ...fieldInputsFrom(fieldDefs, character.fields), ...filledNow }),
      },
    });
    const pictureProblem = edited.ok ? await applyPortrait(db, user, character, portrait) : null;
    if (pictureProblem) {
      setBusy(false);
      return toast({ text: pictureProblem });
    }
    const sent = edited.ok ? await runCommand(registry, db, user, draft ? sendCharacter : resubmitCharacter, { character }) : edited;
    setBusy(false);
    // The player lands on the campaign after sending (A6).
    if (!sent.ok) return toast({ text: sent.message });
    if (!draft) onSent({ text: `Sent ${name.trim()} to your GM again.` });
    else if (sent.value.approval === 'approved') onSent(await joinedToast(db, user, character.campaignId, { id: character.id, name: name.trim() }, toast));
    else onSent({ text: `Sent ${name.trim()} to your GM.` });
  }

  const openStep = (id: string) => {
    if (!isReviewStep(id)) return;
    if (FIXABLE.has(id)) setEditing(id);
    else if (SHOPPING.has(id) && canShop) setShopping(true);
    else toast({ text: `${stepTitle(id)} can't be changed here. Ask your GM if it needs to.` });
  };
  const firstFix = asking?.find((item) => item.fixable);
  const fix = (step: ReviewStep) => (SHOPPING.has(step) ? setShopping(true) : setEditing(step));

  if (shopping && setting && character.classRef && canShop) {
    const ref: CharacterRef = { id: character.id, campaignId: character.campaignId, ownerType: character.ownerType, ownerUserId: character.ownerUserId, approval: character.approval, archived: character.archived };
    return (
      <StartingGear
        db={db}
        user={user}
        setting={setting}
        character={ref}
        name={name.trim() || character.name}
        classRef={character.classRef}
        raceRef={character.raceRef}
        patronGarb={patronGarbFor(setting, creation, { level: character.level, classRef: character.classRef, raceRef: character.raceRef }, fieldDefs)}
        moneyRoll={moneyRoll}
        money={moneyTyped}
        onMoney={setMoneyTyped}
        creation={creation}
        title={guideTitle(setting.rulesSets, 'gear', GEAR_TITLE)}
        why={stepGuide(setting.rulesSets, 'gear').why}
        help={stepGuide(setting.rulesSets, 'gear').help ?? null}
        onBack={() => {
          setShopping(false);
          setGearVersion((v) => v + 1);
          onChanged();
        }}
        onDone={() => {
          setShopping(false);
          setShopped(true);
          setGearVersion((v) => v + 1);
          onChanged();
        }}
        onUndone={() => {
          setGearVersion((v) => v + 1);
          onChanged();
        }}
      />
    );
  }

  return (
    <>
      {/* In the book's type (cs-53), as the review is. */}
      <BookType>
      <ReviewScreen
        heading={name.trim() || character.name}
        note={
          draft ? (
            <p className="guided-instruction">Check each part, then send them to your GM.</p>
          ) : (
            // Sent back (clo-2, frame 22-G5; supersedes cs-53): "Your GM asks for a change", with the sign.
            // The author line (22-G5): "Maren, your GM, today"; a GM who never chose a name is "Your GM" (nm-1).
            <PinnedNote
              from="your GM"
              title="Your GM asks for a change"
              by={sentBy ? `${sentBy.name ? `${sentBy.name}, your GM` : 'Your GM'}${whenWords(sentBy.at) ? `, ${whenWords(sentBy.at)}` : ''}` : undefined}
            >
              {character.reviewNote ? <p>{character.reviewNote}</p> : <p>No note. Check with your GM, change what's needed, and send it again.</p>}
            </PinnedNote>
          )
        }
        sections={sections}
        action={busy ? 'Sending…' : actionWords}
        stillNeeded={todo.map((item) => item.text)}
        onOpenStep={openStep}
        onAction={() => void send()}
        onExplain={() => setAsking(todo)}
        // Sent back (clo-2, 22-G5): the foot, "1 part marked", Back and Send to the GM; no Start over here.
        onBack={draft ? undefined : onBack}
      />
      </BookType>
      {editing && (
        <Dialog label={stepTitle(editing)} onClose={() => setEditing(null)}>
          {editing === 'who' && (
            <p className="auth__meta">{made.kinds.length > 0 ? `${made.kinds.join(', ')}. ` : ''}Ask your GM to change the race or class.</p>
          )}
          <CharacterFields
            only={editing === 'who' || editing === 'hp' || editing === 'details' || editing === 'story' ? editing : undefined}
            name={name}
            level={level}
            hp={hp}
            backstory={backstory}
            onName={setName}
            onLevel={(value) => {
              setLevel(value);
              if (setting) refillAt(setting, value, inputs);
            }}
            hpAsk={hpAsk}
            onHp={setHp}
            onBackstory={setBackstory}
            fieldDefs={fieldDefs}
            fieldInputs={inputs}
            onField={(key, value) => setFieldInputs((current) => ({ ...current, [key]: value }))}
            afterName={
              <PortraitPicker
                db={db}
                campaignId={character.campaignId}
                name={name}
                currentAssetId={character.portraitAssetId}
                choice={portrait}
                onChoice={setPortraitChoice}
              />
            }
          />
          <div className="dialog__actions">
            <button type="button" className="button-primary" onClick={() => setEditing(null)}>
              Done
            </button>
          </div>
        </Dialog>
      )}
      {asking && (
        <Dialog label={`${asking.length} ${asking.length === 1 ? 'thing' : 'things'} still to do`} onClose={() => setAsking(null)}>
          <ul className="reading">
            {asking.map((item) => (
              <li key={item.text}>{item.text}</li>
            ))}
          </ul>
          <p className="reading">{draft ? 'You can send now; the GM will see these marked.' : 'You can resend now; the GM will see these marked.'}</p>
          <div className="dialog__actions">
            {firstFix && (
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setAsking(null);
                  fix(firstFix.step);
                }}
              >
                Fix {stepTitle(firstFix.step).toLowerCase()}
              </button>
            )}
            <button type="button" className={firstFix ? 'button-secondary button-secondary--small' : 'button-primary'} onClick={() => void send()}>
              Send anyway
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/** A step with nothing to show: moves straight on once drawn (a state change can't happen while drawing). */
function SkipStep({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    onSkip();
    // Once, when drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p role="status">Opening…</p>;
}

/** A draft just made in guided creation, on its review (ruled 2026-10-26): loads it, then hands over. */
function DraftReview({
  db,
  user,
  campaign,
  characterId,
  fieldDefs,
  off,
  onSent,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  characterId: string;
  fieldDefs: FieldDefinition[];
  /** The fields left out of `fieldDefs` for this character: their values are kept. */
  off?: ReadonlySet<string>;
  /** What the toast says once it went (with Play as when a second character joined at once). */
  onSent: (sent: ToastRequest) => void;
}) {
  const [character, setCharacter] = useState<MyCharacter | null | 'error'>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    loadMyCharacters(db, campaign.id, user.id).then(
      (found) => current && setCharacter(found?.find((c) => c.id === characterId) ?? 'error'),
      () => current && setCharacter('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, user.id, characterId, version]);
  if (character === 'error') {
    return (
      <section className="auth">
        <p className="form-error" role="alert">
          Couldn't open the review. They're saved: find them in Your characters.
        </p>
        <button type="button" className="button-secondary" onClick={() => setVersion((v) => v + 1)}>
          Try again
        </button>
      </section>
    );
  }
  if (!character) return <p role="status">Opening…</p>;
  return (
    <section className="auth">
      <CharacterReview key={character.id} db={db} user={user} character={character} fieldDefs={fieldDefs} off={off} onChanged={() => setVersion((v) => v + 1)} onSent={onSent} />
    </section>
  );
}

/**
 * A character card's top: picture, name, a line under it, and its company. A8 (ruled 2026-10-25): tapping the
 * picture changes it (when `user` and `onPortrait` are given), and tapping the rest opens the character (`onOpen`).
 */
function CardHeading({
  db,
  user,
  character,
  company,
  children,
  onOpen,
  onPortrait,
  action,
}: {
  db: Db;
  user?: CurrentUser;
  character: MyCharacter;
  /** The name of the company it's in, if any. */
  company: string | null;
  children: ReactNode;
  onOpen?: () => void;
  onPortrait?: (message: string) => void;
  /** The card's own button at its top right (Edit, tfr-4), beside the name and its lines. */
  action?: ReactNode;
}) {
  const picture = <Portrait db={db} campaignId={character.campaignId} assetId={character.portraitAssetId} name={character.name} />;
  const text = (
    <>
      <span className="character-card__name">{character.name}</span>
      {children}
      {company && <span className="auth__meta">{company}</span>}
    </>
  );
  return (
    <div className="character-card__heading">
      {user && onPortrait ? (
        <QuickPortrait db={db} user={user} character={character} onDone={onPortrait}>
          {picture}
        </QuickPortrait>
      ) : (
        picture
      )}
      {onOpen ? (
        <button type="button" className="character-card__open" aria-label={`Open ${character.name}`} onClick={onOpen}>
          {text}
        </button>
      ) : (
        <div className="character-card__heading-text">{text}</div>
      )}
      {action}
    </div>
  );
}

/** The card's picture as the way to add or change it (A8): choose a photo and it's uploaded straight away. */
function QuickPortrait({
  db,
  user,
  character,
  onDone,
  children,
}: {
  db: Db;
  user: CurrentUser;
  character: MyCharacter;
  onDone: (message: string) => void;
  /** The picture itself, which is what's tapped. */
  children: ReactNode;
}) {
  const id = `quick-portrait-${character.id}`;
  const PICTURE_WAITS = `${possessive(character.name)} last picture is still saving. Pick this one again in a moment.`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = useBlockedSheet();

  async function choose(file: File | undefined) {
    if (!file) return;
    // The busy guard covers buttons only: a picture picked while the last one saves waits, and says so (review, #561).
    if (busy) return blocked.explain('Still saving', PICTURE_WAITS);
    setBusy(true);
    setError(null);
    try {
      const image = await shrinkImage(file);
      const problem = await applyPortrait(db, user, character, { blob: image, previewUrl: '' });
      if (problem) setError(problem);
      else onDone(`${possessive(character.name)} portrait was saved.`);
    } catch (thrown) {
      setError(thrown instanceof PhotoError ? thrown.message : "Couldn't read that picture. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="quick-portrait">
      <label htmlFor={id} className="quick-portrait__label" title={busy ? 'Uploading…' : undefined}>
        {children}
        <span className="visually-hidden">{busy ? 'Uploading…' : character.portraitAssetId ? `Change ${possessive(character.name)} portrait` : `Add a portrait for ${character.name}`}</span>
      </label>
      <input
        id={id}
        className="portrait-picker__file"
        type="file"
        accept="image/*"
        aria-label={`${character.portraitAssetId ? 'Change' : 'Add a'} portrait for ${character.name}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void choose(file);
        }}
      />
      {blocked.sheet}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * A skipped step's why-line (clo-5, clo-17; 23-H3): made by the app from the class's name as the pack gives it, in the
 * singular; no pack field of its own. Only First spells has one (the plan's and clo-17's form); any other step, or no
 * class name, keeps an empty line (L5 ⚑ 2, Francis 2026-11-27: no sentence for Languages, Details or traits until after
 * 5 December).
 */
function skippedWhy(step: string, className: string): string {
  return step === 'spells' && className.trim() ? `${aClass(className)} has no spells to pick.` : '';
}

/**
 * A step skipped (it had nothing to show), reached by Back (final drafts F): its line says why (`skippedWhy`, clo-5) and
 * "Nothing to choose here" is said once, in the foot, as 23-H3 draws it (no "Skipped" row: L5 ⚑ 1, Francis 2026-11-27);
 * the shell's `skipped` sets the line in ink at body size and the hint beside Back and Next (L5's two fixes, 2026-11-27).
 */
export function SkippedStep({ title, counter, why, onBack, onNext }: { title: string; counter?: { at: number; of: number | null }; why: string; onBack: () => void; onNext: () => void }) {
  return (
    <CreationStep title={title} counter={counter} why={why} help={null} onBack={onBack} hint="Nothing to choose here" onNext={onNext} skipped>
      {null}
    </CreationStep>
  );
}
