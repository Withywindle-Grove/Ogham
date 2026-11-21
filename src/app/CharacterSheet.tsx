import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  loadCharacterSheet,
  type SheetCharacter,
} from "../core/characterSheet.ts";
import { isGm, runCommand, type CurrentUser } from "../core/commands.ts";
import { loadCompanies } from "../core/companies.ts";
import type { Db } from "../core/supabase.ts";
import { gmRuling } from "../modules/characters/commands.ts";
import {
  cardLine,
  loadFieldDefinitions,
  sheetSections,
  shortLabel,
  type FieldDefinition,
} from "../modules/characters/fields.ts";
import { ExpertisePopUp, FinishCreation, finishSteps, WeaponSkillsLine } from "./FinishCreation.tsx";
import { baseAndBest, expertiseSetup, pointWords } from "./ExpertiseStep.tsx";
import { readExpertise } from "../modules/characters/expertise.ts";
import { HpInPlace } from "./HpInPlace.tsx";
import { PortraitTap } from "./PortraitSheet.tsx";
import { SheetEdit } from "./SheetEdit.tsx";
import {
  DetailsLedger,
  LanguageBoxes,
  PatronLadderView,
  SheetChangeLines,
  SheetNotes,
  whenWords,
} from "./SheetParts.tsx";
import {
  NOT_ATTACHED,
  patronEntry,
  patronKept,
  patronLadder,
  patronNameOf,
  topSpellLevel,
} from "../modules/characters/patrons.ts";
import { classListOf, patronInSetting } from "./patronGarb.ts";
import {
  answerWords,
  changeWords,
  loadSheetChanges,
  newlyAnswered,
  takeBackSheetChange,
  type SheetChange,
} from "../modules/characters/sheetChanges.ts";
import { downAtOf } from "../modules/characters/hp.ts";
import { LoadSummary } from "./LoadSummary.tsx";
import { PrimeXpTable } from "../ui/creation.tsx";
import { primeXpBands } from "../modules/characters/creationSteps.ts";
import { Portrait } from "./Portrait.tsx";
import { registry } from "./services.ts";
import { TopRow } from "./TopRow.tsx";
import "./CharacterSheet.css";
import { useLogVersion } from "./campaignLog.tsx";
import {
  loadCampaignSetting,
  type CampaignSetting,
} from "./campaignSetting.ts";
import {
  fieldsListLeavesOut,
  layoutHints,
  pickedTraitAbilities,
  traitListsOf,
  traitLookup,
  traitSteps,
} from "../modules/characters/traitLists.ts";
import {
  characterFigures,
  scoresOf,
  unclaimed,
  withNote,
} from "./fromSetting.ts";
import {
  abilityBlurb,
  abilityKeys,
  holdsAbility,
  raceAsPlayed,
} from "../modules/characters/creation.ts";
import {
  explainAttack,
  explainLevel,
  skillRollOf,
} from "../modules/characters/explain.ts";
import { columnKinds } from "../modules/characters/modifierColumns.ts";
import {
  classEntry,
  fieldEntries,
  languageEntries,
  raceEntry,
  traitEntry,
  type EntryContext,
  type ValueEntry,
} from "../modules/characters/listEntries.ts";
import { traitsOf } from "../modules/characters/bonuses.ts";
import {
  chipLabel,
  traitGroups,
  usesWords,
} from "../modules/characters/traitChips.ts";
import {
  ADVANCEMENT_FILLS,
  advancementOf,
} from "../modules/characters/advancement.ts";
import { campaignChoices, weaponSetup } from "./weaponSetup.ts";
import { ownedByWeaponSkills } from "../modules/characters/weaponSkills.ts";
import { languageList } from "../modules/characters/creationGuide.ts";
import { EntryPanel, useOnline } from "../ui/creation.tsx";
import {
  acLines,
  acShown,
  classSkillsNote,
  combatFields,
  saveModifierLines,
  saveRules,
  savesOf,
  skillsOf,
  type Skill,
  type WornGear,
} from "../modules/characters/play.ts";
import {
  acTileCaption,
  attackFigures,
  levelExperience,
} from "../modules/characters/sheetCombat.ts";
import {
  columnWords,
  modifierEffects,
} from "../modules/characters/creationSteps.ts";
import { movementOf } from "../modules/characters/movement.ts";
import {
  loadSpeed,
  type CarriedLoad,
} from "../modules/inventory/encumbrance.ts";
import { SheetScope } from "../ui/Dialog.tsx";
import {
  ListRow,
  NameFrom,
  PinnedMark,
  RowList,
  ScoreRow,
  StatRow,
  StatTile,
  TapValue,
  WarningLine,
} from "../ui/parts.tsx";
import { namesakeSource } from "../modules/library/namesakes.ts";
import { BreakdownSheet } from "../ui/BreakdownSheet.tsx";
import { DieGlyph, isDieSize } from "../ui/dice.tsx";
import {
  modifierCells,
  signedNumber,
} from "../modules/characters/modifierColumns.ts";
import { ALIGNMENT_KEY } from "../core/alignments.ts";
import { SaveTiles, SkillSheet } from "./FigureSheets.tsx";
import { savesLine, scoresLine, skillsLine } from "../modules/library/rolls.ts";
import { targetFigure } from "../modules/characters/skillOdds.ts";
import { usePhone } from "./useWide.ts";
import { useCarriedLoad } from "./useCarriedLoad.ts";
import { SheetSection } from "./SheetSection.tsx";
import { magicSummary, summaryLine } from "../modules/characters/sheetSummaries.ts";
import { acStyleOf, attackStyleOption } from "./fromSetting.ts";
import { useToast } from "../ui/ToastHost.tsx";
import {
  limitedAbilities,
  loadCharacterPlay,
  powersWithUses,
  setAc,
  shownAbove,
  slotsOf,
  traitsWithUsesOf,
  type PreparedSpell,
} from "../modules/characters/playState.ts";
import {
  besidePlayColumn,
  magicOf,
  type MagicRow,
} from "../modules/characters/magic.ts";
import { spellHeadings } from "../modules/characters/firstSpells.ts";
import { spellBookOf } from "../modules/characters/spellBook.ts";
import { MagicBlock } from "../ui/MagicBlock.tsx";
import { kindredOfCharacter } from "./KindredTables.tsx";
import { detailLines, detailsOf } from "../modules/characters/kindredTables.ts";
import { stepTitle } from "../modules/characters/creationGuide.ts";
import { STEP_TITLES } from "../modules/characters/creationSteps.ts";
import { useWornGear } from "./EquipWarning.tsx";
import { FormSwitch } from "./FormSwitch.tsx";
import {
  entriesInPlay,
  entryOptionSpec,
  fieldsInPlay,
  fieldsOffFor,
  optionSpecOn,
} from "../modules/library/optionGate.ts";

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The level as the Player screen's level block reads it (dec-13 C3, ps-8). */
export type LevelFigures = {
  /** The class's name as the sheet shows it; '' for none. */
  className: string;
  level: number;
  /** "2,400 of 4,000 experience", or '' when none is recorded. */
  experience: string;
  /** How far to the next level, 0 to 1; null for no bar (no experience, no next level). */
  fraction: number | null;
  /** The character's company; null or '' for none. */
  company: string | null;
  /** Opens how the level is worked out (the sheet's own explain sheet). */
  onOpen: () => void;
  /** The class form switch (eq-8), or null. */
  formSwitch: ReactNode;
};

/**
 * The sheet's parts, handed by name to the Player screen, which places them in its own two columns (dec-13 C1, ps-2,
 * ps-2a: hosted, never rebuilt). Each is the block the full sheet shows, or nothing when the character has none.
 */
export type SheetParts = {
  /**
   * The level's figures, handed over as data (dec-13 C3; the cloud review of #909): the Player screen draws them as its
   * level block (player/PlayerLevel.tsx), so the shared sheet imports nothing from the Player screen.
   */
  level: LevelFigures;
  saves: ReactNode;
  scores: ReactNode;
  /** Movement and the load with its bar. */
  movement: ReactNode;
  languages: ReactNode;
  skills: ReactNode;
  /**
   * Details and backstory, as data (dec-13 C4): the Player screen draws them as the book's labelled lines that open in
   * place. The full sheet's own "Details and backstory" block is unchanged.
   */
  details: SheetDetails;
  /** The rest of the full sheet, in its order: Abilities, Traits, Patron, Magic, Notes. */
  rest: ReactNode[];
  /**
   * Every row of the foot's Abilities and Traits (row P3 of plans/test-feedback-2026-11-19; euf-2): what can be pinned
   * to the Player tab's list, each with the tap that opens its own pop-up (its entry, or how it's worked out).
   */
  pinnable: PinnableRow[];
};

/** An ability or a trait on the foot's rows (euf-2): its row's key, its name (its pin key) and what opens it. */
export type PinnableRow = { key: string; name: string; onOpen?: () => void };

/**
 * The pins the Player tab hands its hosted sheet (row P3; page 28, approved 2026-11-20): the names pinned, which leave
 * the foot's rows' lines (pg28-3), and the Move up and Move down rows for a pinned one's own pop-up (pg28-7), given the
 * names of every ability and trait the sheet has.
 */
export type SheetPins = {
  names: readonly string[];
  moves: (name: string, all: readonly string[]) => ReactNode;
};

/**
 * Details' lines, in the sheet's order (the kindred's tables, then the layout's fields), and the backstory; then the
 * GM's hidden fields as their own group, drawn under their "Hidden fields" heading (empty for anyone but the GM: the
 * sheet reads them only with showHidden; the review of #910).
 */
export type SheetDetails = {
  rows: { key: string; label: string; value: ReactNode }[];
  story: string;
  hidden?: {
    label: string;
    rows: { key: string; label: string; value: ReactNode }[];
  } | null;
};

/**
 * One notice the hosted sheet hands the Player tab's notices box (row C1): its bold line, the words under it, and its
 * own button or rows (Take back, OK, the steps of "To finish"). The box's own type has the same shape.
 */
export type SheetNotice = {
  key: string;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
};

/**
 * What the Player screen gets from a hosted sheet: the parts (null while the sheet opens or fails) and the section with
 * the rest of the sheet's rows (or the loading line). The section has no "Full character sheet" heading and no Edit:
 * Edit is on each card of Your characters (tfr-4); the rows stay, on a phone too (tfr-5).
 */
export type SheetHost = (view: {
  parts: SheetParts | null;
  fullSheet: ReactNode;
  /**
   * What the sheet has for the Player tab's notices box (row C1, tfn-2; page M1): each change waiting for the GM and
   * each refusal not yet put away, oldest first, then the "To finish" card while it has a step. Empty while it opens.
   */
  notices: SheetNotice[];
  /** While the sheet opens or after it failed: "Opening…", or the error with Try again (also inside the section). */
  status: ReactNode;
  /** Where the read stands, for a host that waits for it (the Player screen's one loading state, dec-13 C11). */
  phase: "opening" | "error" | "ready";
}) => ReactNode;

/**
 * The fields the sheet leaves out for this character (sr-6): their option is off (of-9), they're not for the class or
 * kindred (cs-3), or a trait list owns them that the character never takes (ct3-4b). Their values stay saved.
 */
function sheetFieldsOff(
  setting: CampaignSetting | null,
  fields: readonly FieldDefinition[],
  character: SheetCharacter | null,
): ReadonlySet<string> | undefined {
  const off = fieldsOffFor(setting, character);
  if (!setting || !character) return off;
  const values = isPlainRecord(character.fields) ? character.fields : {};
  const listed = fieldsListLeavesOut(
    fields,
    traitListsOf(setting.all),
    layoutHints(setting.all),
    { raceRef: character.raceRef, values },
    campaignChoices(setting),
  );
  return listed.size === 0 ? off : new Set([...(off ?? []), ...listed]);
}

/** A line's parts joined by commas, never a middle dot (plan m5b-players-screens-standard A2): "1d8, CON +0". */
const commas = (text: string) => text.replace(/ · /g, ", ");

// A score's pop-up says each thing once (fix-score-popup-repeats): a line equal to an earlier one, or only the start of
// a longer one ending at a word's end ("Hit points" before "Hit points: …", not "Haul" before "Hauling"), goes; the
// fullest line stays where it was. Used by the score pop-up only.
function withoutRepeats(lines: readonly string[]): string[] {
  const key = lines.map((line) => line.trim());
  return lines.filter((line, i) => {
    const mine = line.trim();
    return !key.some((other, j) => {
      if (j === i) return false;
      if (other === mine) return j < i;
      return (
        other.length > mine.length &&
        other.startsWith(mine) &&
        !/[\p{L}\p{N}]/u.test(other.charAt(mine.length))
      );
    });
  });
}

/** Where this device keeps the refusals its player put away (OK on the refused line). */
const DISMISSED_KEY = "grimoire.sheetChanges.dismissed";

/** The refusals put away on this device. */
function dismissedRefusals(): ReadonlySet<string> {
  try {
    const saved: unknown = JSON.parse(
      globalThis.localStorage?.getItem(DISMISSED_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Puts a refusal away on this device, and gives back all of them (the newest 200). */
function dismissRefusal(id: string): ReadonlySet<string> {
  const all = [...dismissedRefusals(), id].slice(-200);
  try {
    globalThis.localStorage?.setItem(DISMISSED_KEY, JSON.stringify(all));
  } catch {
    // A private window without storage: put away until the sheet is opened again.
  }
  return new Set(all);
}

// The full character sheet, for its owner (from the Player screen, or beside it on a landscape tablet) or the GM
// (View sheet). Both can edit it;
// once a character is approved only the GM changes its level. Sections from packs (abilities, saves, languages…)
// come later; until then the GM's fields stand in.
export function CharacterSheet({
  db,
  user,
  characterId,
  backLabel,
  onBack,
  refreshKey = 0,
  onSaved,
  host,
  onEdited,
  pins,
}: {
  /** On the Player tab (hosted): the pins, for the foot's rows and a pinned one's pop-up (row P3). */
  pins?: SheetPins;
  db: Db;
  user: CurrentUser;
  characterId: string;
  /** Where the top row's "‹" goes. Left out beside the Player screen, which then shows the name instead. */
  backLabel?: string;
  onBack?: () => void;
  /** Changes when something outside the sheet (the HP buttons) saved new values. */
  refreshKey?: number;
  onSaved?: () => void;
  /** Hosted by the Player screen (dec-13 C1): beside it, its parts placed by the screen. */
  host?: SheetHost;
  /**
   * Opened from Edit on a card of Your characters (tfr-4): the sheet opens on its form, and Save or Cancel hands back
   * the line to show ("Saved.", "Sent to your GM.", or null), instead of showing the sheet.
   */
  onEdited?: (message: string | null) => void;
}) {
  const beside = !onBack;
  const [character, setCharacter] = useState<SheetCharacter | null | "error">(
    null,
  );
  const [campaignFields, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  // A field whose option is off, or that isn't for this character's class or kindred (cs-3), is hidden everywhere on
  // the sheet; its value stays saved (of-9).
  // A field a trait list owns that the character never takes (sr-6, ct3-4b: the list leaves out their kindred) too.
  const fieldsOff = sheetFieldsOff(
    setting,
    campaignFields,
    character && character !== "error" ? character : null,
  );
  // The weapon proficiencies field is the Weapon skills line's while the weapon setup applies (after-test A13): the
  // sheet shows that line, not an empty tile beside it (the same check creation's Who they are makes).
  const sheetOf = character && character !== "error" ? character : null;
  // Expertise points in force for the class (G-208): the GM's Move points opens the step (ex-6).
  const [movingPoints, setMovingPoints] = useState(false);
  const expertiseHere = sheetOf
    ? expertiseSetup(
        setting?.all.find((e) => e.kind === "class" && e.packEntryId === sheetOf.classRef)?.data,
        setting?.rulesSets ?? [],
      )
    : null;
  const weaponsApply =
    !!sheetOf && !!weaponSetup(setting, sheetOf.classRef, sheetOf.level);
  const fieldDefs = fieldsInPlay(campaignFields, fieldsOff).filter(
    (f) => !ownedByWeaponSkills(f.key, weaponsApply),
  );
  const [version, setVersion] = useState(0);
  // An undo from the log reloads this in place.
  const logVersion = useLogVersion();
  const [editing, setEditing] = useState(!!onEdited);
  const [notice, setNotice] = useState<string | null>(null);
  // The sheet changes waiting for the GM, and a refusal not yet put away (plan B6): the GM and the player read them.
  const [changes, setChanges] = useState<SheetChange[]>([]);
  const [changesVersion, setChangesVersion] = useState(0);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() =>
    dismissedRefusals(),
  );
  // The armour and shields worn: AC is worked out from them (ruled 2026-10-29, B9).
  const campaignId =
    character && character !== "error" ? character.campaignId : "";
  const worn = useWornGear(
    db,
    campaignId,
    characterId,
    `${version}:${refreshKey}:${logVersion}`,
    setting,
  );
  // What they carry, for Movement: the same speed as travel (bq-5, sr-1).
  // The same read fills the Pack load section (sr-9).
  const carried = useCarriedLoad(
    db,
    campaignId,
    characterId,
    setting?.encumbrance ?? null,
    `${version}:${refreshKey}:${logVersion}`,
  );
  const load = carried && carried !== "error" ? carried.load : null;
  // The AC set by hand (Set AC, ruled 2026-10-29), kept with the character's play state.
  const [acOverride, setAcOverride] = useState<number | null>(null);
  // The class form the character is in (eq-8), kept with the play state too; null reads as the first form.
  const [formId, setFormId] = useState<string | null>(null);
  const [acVersion, setAcVersion] = useState(0);
  // The uses spent (the Player screen's use dots), shown as rings on the trait chips (tc-2).
  const [usesSpent, setUsesSpent] = useState<Record<string, number>>({});
  // What's prepared (the Magic tab's Prepare), for the Magic section's Prepared tab (sr-4).
  const [prepared, setPrepared] = useState<PreparedSpell[]>([]);
  const toast = useToast();
  useEffect(() => {
    let live = true;
    void loadCharacterPlay(db, characterId).then((found) => {
      if (!live) return;
      setAcOverride(found?.acOverride ?? null);
      setUsesSpent(found?.usesSpent ?? {});
      setPrepared(found?.prepared ?? []);
      setFormId(found?.formId ?? null);
    });
    return () => {
      live = false;
    };
  }, [db, characterId, version, refreshKey, logVersion, acVersion]);

  useEffect(() => {
    let current = true;
    loadCharacterSheet(db, characterId).then(
      async (found) => {
        if (!current) return;
        if (!found) return setCharacter("error");
        // A read that throws counts as one that failed (dec-13 C11's review): the sheet says so, with Try again,
        // rather than opening for ever.
        let read;
        try {
          read = await Promise.all([
            loadFieldDefinitions(db, found.campaignId),
            loadCompanies(db, found.campaignId),
            loadCampaignSetting(db, user.id, found.campaignId),
          ]);
        } catch {
          if (current) setCharacter("error");
          return;
        }
        const [fields, companies, rules] = read;
        if (!current) return;
        setFieldDefs(fields ?? []);
        setSetting(rules);
        setCompanyName(
          companies?.find((c) => c.id === found.companyId)?.name ?? null,
        );
        setCharacter(found);
      },
      () => current && setCharacter("error"),
    );
    return () => {
      current = false;
    };
  }, [db, user.id, characterId, version, refreshKey, logVersion]);

  // The character's sheet changes, read again with every log line (an answer from the GM arrives as one); a change
  // that waited and is answered now says so in a toast (plan B6: "Approved or refused: a toast for the player").
  const seenChanges = useRef<SheetChange[] | null>(null);
  useEffect(() => {
    if (!campaignId) return;
    let live = true;
    void loadSheetChanges(db, campaignId, { actorId: characterId }).then(
      (found) => {
        if (!live || !found) return;
        const before = seenChanges.current;
        seenChanges.current = found;
        setChanges(found);
        const answered = before ? newlyAnswered(before, found) : null;
        if (answered && answered.requesterId === user.id)
          toast({ text: answerWords(answered) });
      },
    );
    return () => {
      live = false;
    };
  }, [
    db,
    campaignId,
    characterId,
    user.id,
    logVersion,
    refreshKey,
    changesVersion,
    version,
    toast,
  ]);

  const gm =
    character !== null &&
    character !== "error" &&
    isGm(user, character.campaignId);
  const canEdit =
    character !== null &&
    character !== "error" &&
    !character.archived &&
    (gm || character.ownerUserId === user.id);

  // Clear in AC's pop-up (ruled 2026-10-29): the worked-out AC comes back, with Undo.
  async function saveAc(next: number | null): Promise<boolean> {
    if (character === null || character === "error") return false;
    const result = await runCommand(registry, db, user, setAc, {
      character,
      ac: next,
    });
    if (!result.ok) {
      toast({ text: result.message, error: true });
      return false;
    }
    setAcVersion((v) => v + 1);
    return true;
  }
  async function clearAc() {
    const before = acOverride;
    if (before === null || !(await saveAc(null))) return;
    toast({
      text: "AC set by hand cleared",
      onUndo: () => void saveAc(before),
    });
  }

  // The class form switch (eq-8): shown only for a class with forms, in the Combat block; a switch reloads the play
  // state here and tells the parent (the Pack re-reads its equip check).
  const classData =
    character !== null && character !== "error"
      ? (setting?.all.find(
          (e) => e.kind === "class" && e.packEntryId === character.classRef,
        )?.data ?? null)
      : null;
  const formSwitch =
    character !== null && character !== "error" && classData ? (
      <FormSwitch
        db={db}
        user={user}
        character={{
          id: character.id,
          campaignId: character.campaignId,
          ownerUserId: character.ownerUserId,
          name: character.name,
        }}
        klass={classData as Parameters<typeof FormSwitch>[0]["klass"]}
        formId={formId}
        canSwitch={canEdit}
        onSwitched={() => {
          setAcVersion((v) => v + 1);
          onSaved?.();
        }}
      />
    ) : null;

  const editButton = canEdit && !editing && (
    <button
      type="button"
      className="button-secondary"
      onClick={() => {
        setNotice(null);
        setEditing(true);
      }}
    >
      Edit
    </button>
  );
  const online = useOnline();
  const viewing = character !== null && character !== "error" && !editing;
  // The avatar is the tap for the portrait sheet (#566); the HP box is the Player screen's (hit points in place).
  const portrait = sheetOf ? (
    <PortraitTap
      db={db}
      user={user}
      character={sheetOf}
      onSaved={() => setVersion((v) => v + 1)}
    />
  ) : null;
  const hpBox = sheetOf ? (
    <HpInPlace
      key={`hp-${sheetOf.id}`}
      db={db}
      user={user}
      character={sheetOf}
      downAt={downAtOf(setting?.rulesSets ?? [])}
      onSaved={onSaved}
      onMaxSaved={() => setVersion((v) => v + 1)}
    />
  ) : null;
  const waiting = changes.filter((c) => c.status === "waiting");
  // A refusal shows until its player puts it away (OK), kept on this device; only the newest per figure.
  const refused = changes.filter(
    (c, n) =>
      c.status === "refused" &&
      !dismissed.has(c.id) &&
      changes.findIndex((o) => o.field === c.field) === n,
  );
  async function takeBack(change: SheetChange) {
    const result = await runCommand(registry, db, user, takeBackSheetChange, {
      change,
    });
    if (!result.ok) return toast({ text: result.message, error: true });
    setChangesVersion((v) => v + 1);
    toast({ text: `Took back ${changeWords(change)}.` });
  }
  const mine = sheetOf?.ownerUserId === user.id;
  const changeLines = (
    <SheetChangeLines
      changes={[...waiting, ...(mine ? refused : [])]}
      {...(mine
        ? {
            onTakeBack: (c: SheetChange) => void takeBack(c),
            onDismiss: (c: SheetChange) => setDismissed(dismissRefusal(c.id)),
          }
        : {})}
    />
  );
  // The same changes as the Player tab's notices (row C1, tfn-2; page M1, frame M1e): one each, oldest first, in today's
  // words; the buttons only for the character's own player, as on the sheet.
  const changeNotices: SheetNotice[] = [...waiting, ...(mine ? refused : [])]
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    .map((c) =>
      c.status === "waiting"
        ? {
            key: `change-${c.id}`,
            title: `Waiting for your GM: ${changeWords(c)}`,
            body: `Sent ${whenWords(c.createdAt)}. The sheet shows the old figure until it is approved.`,
            ...(mine
              ? {
                  action: (
                    <button type="button" className="button-secondary" aria-label={`Take back ${changeWords(c)}`} onClick={() => void takeBack(c)}>
                      Take back
                    </button>
                  ),
                }
              : {}),
          }
        : {
            key: `change-${c.id}`,
            title: `Your GM refused ${changeWords(c)}`,
            ...(c.reason ? { body: `“${c.reason}”` } : {}),
            ...(mine
              ? {
                  action: (
                    <button type="button" className="button-secondary" aria-label={`Put away the refusal of ${changeWords(c)}`} onClick={() => setDismissed(dismissRefusal(c.id))}>
                      OK
                    </button>
                  ),
                }
              : {}),
          },
    );
  const notes = sheetOf ? (
    <SheetNotes
      key="notes"
      asRow={!!host}
      db={db}
      user={user}
      campaignId={sheetOf.campaignId}
      characterId={sheetOf.id}
      sheetNotes={sheetOf.notes}
    />
  ) : null;

  // The editor and the sheet itself (hosted or not), once each.
  const sheetEdit = sheetOf && (
    <SheetEdit
      db={db}
      user={user}
      character={sheetOf}
      fieldDefs={fieldDefs}
      fieldsOff={fieldsOff}
      setting={setting}
      canChangeLevel={gm || sheetOf.approval !== "approved"}
      ruling={gmRuling(user, sheetOf)}
      waiting={waiting}
      onDetailSaved={() => {
        setVersion((v) => v + 1);
        onSaved?.();
      }}
      onDone={(message) => {
        if (onEdited) {
          // From a card's Edit: back where it was opened, with the line (tfr-4).
          if (message) onSaved?.();
          return onEdited(message);
        }
        setEditing(false);
        if (message) {
          setNotice(message);
          setVersion((v) => v + 1);
          setChangesVersion((v) => v + 1);
          onSaved?.();
        }
      }}
    />
  );
  const sheetView = (hosted?: (parts: SheetParts) => ReactNode) =>
    sheetOf && (
      <SheetView
        character={sheetOf}
        fieldDefs={fieldDefs}
        showHidden={gm}
        setting={setting}
        beside={beside}
        worn={worn}
        load={load}
        acOverride={acOverride}
        usesSpent={usesSpent}
        prepared={prepared}
        formSwitch={formSwitch}
        onClearAc={
          canEdit && acOverride !== null ? () => void clearAc() : undefined
        }
        portrait={portrait}
        hpBox={hpBox}
        companyName={companyName}
        changeLines={changeLines}
        notes={notes}
        {...(gm && expertiseHere ? { onMovePoints: () => setMovingPoints(true) } : {})}
        {...(hosted ? { hosted } : {})}
        {...(hosted && pins ? { pins } : {})}
      />
    );

  // To finish (M5b step 0), for those who may change the sheet, while it isn't being edited.
  const finishCard = sheetOf && canEdit && !editing && (
    <FinishCreation
      db={db}
      user={user}
      character={sheetOf}
      fields={sheetOf.fields}
      creation={sheetOf.creation}
      classRef={sheetOf.classRef}
      raceRef={sheetOf.raceRef}
      fieldDefs={fieldDefs}
      setting={setting}
      level={sheetOf.level}
      approved={sheetOf.approval === "approved"}
      gm={gm}
      weaponSkills={sheetOf.weaponSkills}
      expertise={sheetOf.expertise}
      onSaved={() => setVersion((v) => v + 1)}
      notice={!!host}
    />
  );

  // "To finish" in the notices box while it has a step (row C1, tfn-2): the card itself, whose rows open the steps.
  const finishNotice: SheetNotice[] =
    finishCard && finishSteps({ creation: sheetOf.creation, classRef: sheetOf.classRef, raceRef: sheetOf.raceRef, fieldDefs, setting, level: sheetOf.level, weaponSkills: sheetOf.weaponSkills, expertise: sheetOf.expertise }).length > 0
      ? [{ key: "to-finish", title: "To finish", body: finishCard }]
      : [];

  // While the sheet opens, or when it couldn't be read: the line that says so, and Try again.
  const status =
    character === null ? (
      <p role="status">Opening…</p>
    ) : character === "error" ? (
      <>
        <p className="form-error" role="alert">
          Couldn't load this character. Check your connection and try again.
        </p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => setVersion((v) => v + 1)}
        >
          Try again
        </button>
      </>
    ) : null;
  // The sheet's page (or, hosted, the section with the rest of its rows), around what it holds.
  const page = (content: ReactNode) => (
    <section
      className={beside ? "sheet sheet--beside" : "sheet"}
      aria-label={beside && !host ? "Full character sheet" : undefined}
    >
      {onBack ? (
        // Creation's standard bar (A1): ← (a sub-screen), "Full sheet" centred, ⋯ as a sheet. Edit is the foot's (D).
        <TopRow back={backLabel} onBack={onBack} title="Full sheet" standard />
      ) : host ? null : (
        // On the Player tab the rows stand without a heading and Edit is on Your characters' cards (tfr-4, tfr-5);
        // the sheet beside Magic keeps its heading and Edit.
        <div className="sheet__top">
          <h2 className="sheet__pane-title">Full character sheet</h2>
          {editButton}
        </div>
      )}

      {status}

      {character !== null && character !== "error" && (
        <>
          {/* While editing, the name heads the form; the sheet itself heads with its identity line (SheetView). */}
          {!beside && !viewing && (
            <div className="sheet__heading">
              <Portrait
                db={db}
                campaignId={character.campaignId}
                assetId={character.portraitAssetId}
                name={character.name}
              />
              <div className="sheet__heading-text">
                <h1 className="sheet__name">{character.name}</h1>
                {companyName && <p className="auth__meta">{companyName}</p>}
              </div>
            </div>
          )}
          {/* On the sub-screen the foot's status line says it (D); beside the Player screen, here. */}
          {notice && !onBack && (
            <p className="sheet__notice" role="status">
              {notice}
            </p>
          )}
          {/* To finish (M5b step 0): the creation steps left with Decide later; the card goes with the last. Hosted,
              it is a notice in the Player tab's notices box (row C1, tfn-2). */}
          {!host && finishCard}
          {/* The GM's Move points (G-208, ex-6): the Expertise step with − and + free, logged as the GM's. */}
          {movingPoints && gm && setting && expertiseHere && (
            <ExpertisePopUp
              db={db}
              user={user}
              character={character}
              setting={setting}
              setup={expertiseHere}
              level={character.level}
              expertise={readExpertise(character.expertise)}
              creation={character.creation}
              who={{ gm: true, approved: character.approval === "approved" }}
              onClose={() => setMovingPoints(false)}
              onSaved={() => setVersion((v) => v + 1)}
            />
          )}
          {!editing && (
            <WeaponSkillsLine
              asRow={!!host}
              setting={setting}
              classRef={character.classRef}
              level={character.level}
              weaponSkills={character.weaponSkills}
            />
          )}
          {content}
        </>
      )}
      {onBack && viewing && (
        // The foot (plan m5b-players-screens-standard D): the status line, then Back and Edit, both plain (no accent:
        // nothing is asked). Edit only for those who may change the sheet.
        <div className="sheet__foot">
          <p
            className="sheet__foot-status"
            role="status"
            aria-label="Sheet status"
          >
            {online ? (
              (notice ?? "Up to date")
            ) : (
              <WarningLine>Offline. Saved on this device</WarningLine>
            )}
          </p>
          <div className="sheet__foot-actions">
            <button type="button" className="button-secondary" onClick={onBack}>
              Back
            </button>
            {editButton}
          </div>
        </div>
      )}
    </section>
  );

  // Hosted by the Player screen (dec-13 C1): its parts by name, and this section with the rest.
  if (host) {
    return (
      <SheetScope.Provider value>
        {viewing
          ? sheetView((parts) =>
              host({ parts, fullSheet: page(parts.rest), notices: [...changeNotices, ...finishNotice], status: null, phase: "ready" }),
            )
          : host({
              parts: null,
              fullSheet: page(editing ? sheetEdit : null),
              notices: [],
              status,
              phase: character === null ? "opening" : character === "error" ? "error" : "ready",
            })}
      </SheetScope.Provider>
    );
  }
  return (
    // Every pop-up on the sheet is a Sheet (plan m5b-players-screens-standard A4).
    <SheetScope.Provider value>
      {page(editing ? sheetEdit : sheetView())}
    </SheetScope.Provider>
  );
}

/**
 * The full sheet (plan m5b-sheet-revised A, mockup players/05, approved 2026-11-08 after Francis's iPad test): on a
 * tablet two columns, on a phone one, the left above the right. The left column is who and how hurt: the avatar (the
 * tap for the portrait sheet), the name and "<Title>, <Class> <level>, <Kindred>", the HP box, AC and Attack, and
 * "Tap a figure for where it comes from"; nothing else. The right column, in order: Level with the experience bar,
 * Saves with the rule's one line, Scores with plain modifiers, Movement (the speeds, and the load tier with its bar),
 * Languages as boxes with one literacy line, Skills, Abilities (the experience bonus inside) and Traits as one column
 * of Sheet rows, Magic, Details and backstory (look A), then Notes. Beside the Player screen (a landscape tablet) the
 * play column is the left column, so the sheet is the right column only. Every figure opens its breakdown; every
 * value from a pack list opens its entry (ct3-9, ct3-11).
 */
function SheetView({
  character,
  fieldDefs,
  showHidden,
  setting,
  beside = false,
  worn = null,
  load = null,
  acOverride = null,
  usesSpent = {},
  prepared = [],
  formSwitch = null,
  onClearAc,
  portrait = null,
  hpBox = null,
  companyName = null,
  changeLines = null,
  notes = null,
  hosted,
  pins,
  onMovePoints,
}: {
  /** Hosted on the Player tab: the pins (row P3). */
  pins?: SheetPins;
  /** The GM's Move points on a class skill's sheet (G-208, ex-6). */
  onMovePoints?: () => void;
  /** Hosted by the Player screen (dec-13 C1): the parts go to it by name, and it places them; no columns here. */
  hosted?: (parts: SheetParts) => ReactNode;
  /** The avatar, the tap for the portrait sheet (#566), at the head of the left column. */
  portrait?: ReactNode;
  /** The HP box (hit points in place), under the name. */
  hpBox?: ReactNode;
  /** The character's company, under the identity line. */
  companyName?: string | null;
  /** What they carry, in the campaign's encumbrance mode (null until known): Movement's speed and its load card. */
  load?: CarriedLoad | null;
  /** The class form switch (eq-8), for a class with forms; under Level. */
  formSwitch?: ReactNode;
  character: SheetCharacter;
  fieldDefs: FieldDefinition[];
  showHidden: boolean;
  setting: CampaignSetting | null;
  /** Beside the Player screen's play column (landscape tablet; ruled 2026-10-26): the right column only. */
  beside?: boolean;
  /** The armour and shields worn (null until known): AC is worked out from them (ruled 2026-10-29, B9). */
  worn?: WornGear[] | null;
  /** The AC set by hand (Set AC, ruled 2026-10-29); null when the worked-out AC shows. */
  acOverride?: number | null;
  /** Clear the AC set by hand (only for those who may: the owner or the GM). */
  onClearAc?: () => void;
  /** The uses spent by ability name (the play state), in words on its row. */
  usesSpent?: Readonly<Record<string, number>>;
  /** The spells prepared (the play state), for the Magic section's Prepared tab (sr-4). */
  prepared?: readonly PreparedSpell[];
  /** The waiting lines, at the top of the sheet above both columns. */
  changeLines?: ReactNode;
  /** The Notes button and its line, last. */
  notes?: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // A skill tapped: its breakdown sheet, the Player screen's (FigureSheets.tsx).
  const [openSkill, setOpenSkill] = useState<Skill | null>(null);
  const phone = usePhone();
  const figures = characterFigures(setting, character, fieldDefs);
  const { raceName, className, values, explaining, abilityName, hideRace } =
    figures;
  // A class skill's Expertise line (G-208, ex-6; X6): its points, where every skill starts and its best.
  const expertise = expertiseSetup(figures.klass, setting?.rulesSets ?? []);
  const skillExpertise = (code: string) => {
    if (!expertise || !expertise.skills.some((s) => s.code === code)) return null;
    const on = readExpertise(character.expertise)[code] ?? 0;
    const { base, best } = baseAndBest(expertise);
    return { label: expertise.rule.name, words: `${on > 0 ? pointWords(on) : "No points"}. Every skill starts at ${base}; at best ${best}` };
  };
  const rulesSets = setting?.rulesSets ?? [];
  const scores = setting
    ? scoresOf(setting, character.fields, character.creation)
    : {};
  // Filled values no field shows (ruled 2026-10-25): their breakdowns stay one tap away from the figures that use them.
  const filledRows =
    setting && character.classRef
      ? unclaimed(
          setting,
          {
            level: character.level,
            scores,
            classRef: character.classRef,
            raceRef: character.raceRef,
          },
          fieldDefs,
        )
      : [];
  // A value from a pack list opens its entry (ct3-11): the kindred, the calling, the alignment, each language, a trait.
  const [entry, setEntry] = useState<ValueEntry | null>(null);
  const entryCtx: EntryContext | null = setting
    ? {
        all: setting.all,
        rulesSets,
        packName: (id) => {
          const pack = setting.packs.find((p) => p.packId === id);
          return pack?.shortName ?? pack?.name ?? "";
        },
        packTitles: (id) =>
          setting.packs.find((p) => p.packId === id)?.sourceTitles ?? {},
        scores,
        label: (k) => abilityName(k).short,
        raceRef: character.raceRef,
        classRef: character.classRef,
        creation: character.creation,
      }
    : null;
  const { explain } = figures;
  const abilities = setting ? abilityKeys(setting.rulesSets) : [];
  const abilityField = (key: string) =>
    fieldDefs.find((f) => !f.hidden && holdsAbility(f.key, key));
  const abilityFields = new Set(
    abilities.flatMap((k) => (abilityField(k) ? [abilityField(k)!.key] : [])),
  );
  // A score shows as its tile whether a campaign field holds it or only the creation record does (retest 4 T8: a
  // campaign on an overlay's sheet layout has no score fields, and the sheet fell back to bare rows).
  const shownAbilities = abilities.filter(
    (k) => abilityField(k) || scores[k] !== undefined,
  );
  const captionOf = (key: string) => {
    for (const rules of [...rulesSets].reverse()) {
      const affects = rules.abilityAffects;
      if (
        affects &&
        typeof affects === "object" &&
        typeof (affects as Record<string, unknown>)[key] === "string"
      )
        return String((affects as Record<string, unknown>)[key]);
    }
    return undefined;
  };
  const noteOf = (key: string) => {
    for (const rules of [...rulesSets].reverse()) {
      const notes = rules.abilityModifierNotes;
      if (
        notes &&
        typeof notes === "object" &&
        typeof (notes as Record<string, unknown>)[key] === "string"
      )
        return String((notes as Record<string, unknown>)[key]);
    }
    return "";
  };
  // Combat: the fields that read as AC and the attack figure (a sheet layout's AC, or one linked to the attack fill).
  const { ac: acField, attack: attackField } = combatFields(fieldDefs);
  const shown = (key: string | undefined) => {
    const v = key ? values[key] : undefined;
    return v === undefined || v === null || v === "" ? "—" : String(v);
  };
  // Movement and skills have their own sections (sr-1, sr-2): never raw rows in Details.
  const ownSection = (name: string) =>
    /^(movement|skills)(\.|$)/.test(name.trim());
  // The XP bonus and the title have their own places (the Abilities row, the identity line), wherever the layout put them.
  const inAdvancement = (fill: string) =>
    (ADVANCEMENT_FILLS as readonly string[]).includes(fill.trim());
  // Magic (sr-4): spells a day as pips, a tab per kind of magic; none for a character with no magic.
  const classEntryFound =
    setting?.all.find(
      (e) => e.kind === "class" && e.packEntryId === character.classRef,
    ) ?? null;
  const raceEntryFound =
    setting?.all.find(
      (e) => e.kind === "race" && e.packEntryId === character.raceRef,
    ) ?? null;
  const magicAll = setting
    ? magicOf({
        klass: classEntryFound,
        race: raceAsPlayed(raceEntryFound, classEntryFound),
        level: character.level,
        book: spellBookOf(character.spellBook),
        prepared,
        slots: slotsOf(figures.filled),
        spells: setting.all.filter((e) => e.kind === "spell"),
        lists: entriesInPlay(setting.all).filter((e) => e.kind === "spellList"),
      })
    : null;
  // Beside the play column (a landscape tablet) the Magic section has no Prepared tab: the Magic tab is one column away
  // (mp-21); with nothing else in it, no section at all.
  const magic = magicAll && beside ? besidePlayColumn(magicAll) : magicAll;
  const inMagic = (fill: string) =>
    magic !== null && fill.trim() === "spellSlots";
  // AC as players use it: set by hand, else worked out with the ability modifier, else "—" (ruled 2026-10-29, B9).
  // The GM sees the true AC, hidden magic bonuses included (ruled 2026-10-29).
  const acWorked = figures.ac(worn, showHidden);
  const acTyped =
    acField && shown(acField.key) !== "—" ? shown(acField.key) : null;
  const acValue = acShown(acTyped, acWorked, acOverride) ?? "—";
  const typedValues: Record<string, unknown> = isPlainRecord(character.fields)
    ? character.fields
    : {};
  const typedAttack = attackField ? typedValues[attackField.key] : undefined;
  const short = (k: string) => abilityName(k).short;
  const attack = attackFigures({
    filled: figures.filled,
    direction: figures.acDirectionStated,
    rulesSets,
    chosenStyle: setting ? acStyleOf(setting) : null,
    fieldLabel: attackField ? shortLabel(attackField.label) : null,
    typed:
      typeof typedAttack === "string" || typeof typedAttack === "number"
        ? String(typedAttack)
        : null,
    shortName: short,
    klassName: className,
    level: character.level,
    styleOption: setting ? attackStyleOption(setting) : null,
  });
  const attackLabel = attack.label;
  const attackValue = attack.value ?? "—";
  const explained: Record<string, { title: string; lines: string[] }> = {
    "explain:ac": {
      title: "Armour class",
      lines: acLines(acTyped, acWorked, acOverride),
    },
    "explain:attack": {
      title: attack.value ? `${attackLabel} ${attack.value}` : attackLabel,
      lines:
        attack.rows.length > 0 ? [] : explainAttack(explaining, attackLabel),
    },
    "explain:level": { title: "Level", lines: explainLevel(explaining) },
  };
  // One Movement section in the pack's words, from the same speed as travel (sr-1, bq-5).
  const movementFields = fieldDefs.filter(
    (f) => !f.hidden && /^movement(\.|$)/.test(f.fill?.trim() ?? ""),
  );
  const movement = movementOf({
    rulesSets,
    race: figures.race,
    raceName,
    filled: figures.filled,
    load: load ? loadSpeed(load) : null,
    fields: movementFields,
    typed: typedValues,
    edited: character.editedFields ?? [],
  });
  const speeds = movement.rows.filter((r) => r.value !== "—");
  for (const row of movement.rows)
    explained[`movement:${row.key}`] = {
      title: row.label,
      lines: [
        ...row.lines,
        // On the Player screen the card says only the fight's figure (dec-13 C10), so the speed's sheet names the rest.
        ...(row === movement.rows[0] && hosted
          ? speeds
              .slice(1)
              .filter((r) => r.key !== "movement.combat")
              .map((r) => `${r.label}: ${r.value}.`)
          : []),
        ...(row === movement.rows[0]
          ? movement.more.flatMap((m) => [`${m.label}: ${m.value}`])
          : []),
      ],
    };
  // Skills in one place (sr-2): everyone's, then the class's own, each the pack's way; a kindred's change in words.
  const skills = skillsOf(
    figures.filled,
    figures.klass,
    figures.notes,
    rulesSets,
    { race: figures.race, raceRef: character.raceRef },
  );
  const raceWord = stepTitle(rulesSets, "race", STEP_TITLES.race).toLowerCase();
  // A figure field shows its breakdown (its `fill`); a number written on the sheet by hand says so first.
  for (const f of fieldDefs) {
    if (!f.fill?.trim()) continue;
    const own = typedValues[f.key];
    const handWritten = own !== undefined && own !== null && own !== "";
    explained[`figure:${f.key}`] = {
      title: f.label,
      lines: [
        ...(handWritten ? [`${String(own)} is written on the sheet.`] : []),
        ...explain(f.fill.trim()),
      ],
    };
  }
  for (const r of filledRows)
    explained[`figure:${r.name}`] = { title: r.label, lines: explain(r.name) };
  // A detail's value: a figure opens its breakdown; a pack-list value its entry; else the words.
  const cellValue = (key: string, label: string, value: string): ReactNode => {
    if (value === "—") return value;
    if (explained[`figure:${key}`]) {
      return (
        <TapValue
          label={`${label} ${value}: how it's worked out`}
          onTap={() => setOpen(`figure:${key}`)}
        >
          {value}
        </TapValue>
      );
    }
    const field = fieldDefs.find((f) => f.key === key);
    if (!field || !entryCtx) return value;
    const found = fieldEntries(
      entryCtx,
      field,
      values[field.key],
      fieldDefs,
    )[0];
    if (!found) return value;
    const tapValue = (
      <TapValue
        label={`${value}: open its entry`}
        onTap={() => setEntry(found)}
      >
        {value}
      </TapValue>
    );
    // A background's rolled spell shows beside it (bq3-18).
    return found.rolled ? (
      <span>
        {tapValue}, {found.rolled}
      </span>
    ) : (
      tapValue
    );
  };
  // Every kindred and class trait, each opening its entry (cs-7); a trait whose option is off is left out (optionGate.ts).
  const choices = setting ? campaignChoices(setting) : {};
  const packOf = (kind: string, ref: string | null) => {
    const found = setting?.all.find(
      (e) => e.kind === kind && e.packEntryId === ref,
    );
    return found && entryCtx ? entryCtx.packName(found.packId) : "";
  };
  const traits = traitsOf(
    figures.race,
    figures.klass,
    (t) => !entryOptionSpec(t) || optionSpecOn(entryOptionSpec(t), choices),
  );
  const traitEntryOf = (key: string) => {
    const t = traits.find((x) => x.key === key);
    return t
      ? traitEntry(
          t,
          t.from === "class"
            ? packOf("class", character.classRef)
            : packOf("race", character.raceRef),
        )
      : null;
  };
  const traitChipGroups = traitGroups(traits, {
    level: character.level,
    race: figures.race,
    klass: figures.klass,
    raceTitle: stepTitle(rulesSets, "race", STEP_TITLES.race),
    classTitle: stepTitle(rulesSets, "class", STEP_TITLES.class),
    usesSpent,
  });
  // A trait row's figure: what's in the chip besides its name (its uses, a drawback, a later level), in words.
  const traitFigure = (
    chip: (typeof traitChipGroups)[number]["chips"][number],
  ) => {
    const left =
      chip.spent > 0
        ? `${chip.uses - chip.spent} of ${chip.uses} left`
        : chip.usesWords;
    return [
      left,
      chip.drawback ? "drawback" : "",
      // tfw-5 (2026-11-19): the lists say "at level 3"; the chip's spoken name (`chipLabel`) is creation's, unchanged.
      chip.laterLevel !== null ? `at level ${chip.laterLevel}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  };
  const traitRows = (ids: readonly string[]) =>
    traitChipGroups
      .filter((g) => ids.includes(g.id))
      .flatMap((g) => g.chips)
      .map((chip) => ({
        key: `trait:${chip.key}`,
        name: chip.name,
        figure: traitFigure(chip),
        said: chipLabel(chip),
        onOpen: () => setEntry(traitEntryOf(chip.key)),
      }));
  // Advancement (sr-5): the experience bar under Level, the prime bonus as an Abilities row, the title by the name.
  const advancement = advancementOf({
    xp: character.xp ?? null,
    level: character.level,
    xpTable: explaining.xpTable,
    klass: figures.klass,
    rulesSets,
    scores,
    shortName: short,
    title: figures.filled.title,
  });
  const titleField = fieldDefs.find(
    (f) => !f.hidden && f.fill?.trim() === "title",
  );
  const titleKey = titleField ? `figure:${titleField.key}` : "figure:title";
  if (advancement.bonus)
    explained["explain:xpBonus"] = {
      title: "Experience bonus",
      lines: [
        `Your ${advancement.bonus.reason.replace(/^prime /, "prime requisite ")} gives ${advancement.bonus.value} to the experience you earn.`,
      ],
    };
  // A spell's entry (its rules), as creation's First spells opens it.
  const spellEntry = (row: MagicRow): ValueEntry => ({
    key: `spell:${row.choice.id}`,
    name: row.choice.name,
    meta: row.choice.line,
    lead: "",
    headings: spellHeadings(row.choice, row.keys, character.level),
  });
  const race = entryCtx ? raceEntry(entryCtx, character.raceRef) : null;
  const klass = entryCtx ? classEntry(entryCtx, character.classRef) : null;
  const tap = (key: string, name: string, value: string | number) => ({
    onTap: () => setOpen(key),
    tapLabel: `${name} ${value}: how it's worked out`,
  });
  const combatKeys = new Set(
    [acField?.key, attackField?.key].filter(Boolean) as string[],
  );
  const saves = savesOf(figures.filled, rulesSets, figures.notes);
  const inSaveTiles = (f: FieldDefinition) =>
    saves.length > 0 &&
    (/^saves(\.|$)/.test(f.fill ?? "") || /^saves$/i.test(f.group ?? ""));
  // Languages is its own section (boxes): the languages field leaves its group.
  const languagesField = fieldDefs.find(
    (f) =>
      !f.hidden &&
      f.key.toLowerCase() === "languages" &&
      !abilityFields.has(f.key),
  );
  // Literacy is one line under the languages, in the pack's words for the level the character has (plan A2); a pack
  // with no literacy rule draws no line, and the figure stays a detail.
  const literacyField = fieldDefs.find(
    (f) =>
      !f.hidden &&
      (/\.literacy$/.test(f.fill?.trim() ?? "") || /^literacy$/i.test(f.key)),
  );
  // dec-13 C4: with no such rule, the literacy the character has, in the pack's words ("Reads and writes.", "Cannot
  // read."), is that line, and Literacy leaves Details: only for a text field holding words (the review of #910). A
  // checkbox or a number, or a pack with a rule whose level isn't matched, draws no line and keeps the Details line.
  const literacy = literacyField
    ? hasLiteracyRule(rulesSets)
      ? literacyLine(rulesSets, shown(literacyField.key))
      : literacyField.type === "text"
        ? literacySentence(values[literacyField.key])
        : ""
    : "";
  // The secondary skill (where the pack has one) is an Abilities row; the alignment a Traits row.
  const secondaryField = fieldDefs.find(
    (f) =>
      !f.hidden &&
      /^secondary[ _-]?skill/i.test(f.key + " " + f.label) &&
      !abilityFields.has(f.key),
  );
  const alignmentField = fieldDefs.find(
    (f) => f.key === ALIGNMENT_KEY && !f.hidden,
  );
  const rowOwned = (f: FieldDefinition) =>
    f === languagesField ||
    f === secondaryField ||
    f === alignmentField ||
    // Its sentence is drawn only inside Languages: with no Languages field, Literacy stays a Details line.
    (f === literacyField && literacy !== "" && languagesField !== undefined);
  // The class is the race and names none: no Race row rather than a guess (ruled 2026-10-29, B10).
  const raceRowLeftOut = (f: FieldDefinition) =>
    hideRace &&
    /^race$/i.test(f.key) &&
    (values[f.key] === undefined ||
      values[f.key] === null ||
      values[f.key] === "");
  // A figure the race qualifies shows it beside the number: "12 (+3 to the roll vs poison)".
  const noted: Record<string, unknown> = { ...values };
  for (const [key, note] of Object.entries(figures.fieldNotes))
    if (shown(key) !== "—") noted[key] = withNote(shown(key), note);
  const allSections = sheetSections(
    fieldDefs.filter(
      (f) =>
        !abilityFields.has(f.key) &&
        !combatKeys.has(f.key) &&
        !ownSection(f.fill ?? "") &&
        !inAdvancement(f.fill ?? "") &&
        !inMagic(f.fill ?? "") &&
        !inSaveTiles(f) &&
        !rowOwned(f) &&
        !raceRowLeftOut(f),
    ),
    noted,
    {
      includeHidden: showHidden,
      lookup: traitLookup(traitListsOf(setting?.all ?? [])),
    },
  );
  // The details from the kindred's tables (cs-1) lead Details and backstory, then the layout's own fields.
  const played = kindredOfCharacter(
    setting,
    character.raceRef,
    character.classRef,
  );
  const detailRows = played
    ? detailLines(
        detailsOf(character.fields),
        played.tables,
        played.physical,
        played.kindred.name,
      ).map((l) => ({
        key: `detail:${l.key}`,
        label: l.label,
        value: l.value as ReactNode,
      }))
    : [];
  const isSaves = (s: { name: string }) => /^saves?$/i.test(s.name.trim());
  const isAbilities = (s: { name: string }) =>
    /^abilities$/i.test(s.name.trim());
  const savesSections = sections(allSections).filter(isSaves);
  const abilitySections = sections(allSections).filter(isAbilities);
  const hiddenSection = allSections.find((s) => s.name === "Hidden fields");
  const ledgerRows = (rows: { key: string; label: string; value: string }[]) =>
    rows.map((r) => ({
      key: r.key,
      label: r.label,
      value: cellValue(r.key, r.label, commas(r.value)),
    }));
  // A layout group named Abilities sits under the Score tiles; with no scores to sit under, it reads as details.
  const detailFieldRows = sections(allSections)
    .filter(
      (s) =>
        !isSaves(s) &&
        (!isAbilities(s) || shownAbilities.length === 0) &&
        s.name !== "Hidden fields",
    )
    .flatMap((s) => s.rows);
  // A score's modifier under its tile (D; Design's answer 5, 2026-11-07): the first modifier its row gives, "+0" where
  // it is nothing (tfr-3, 19 Nov 2026, which reversed dec-13 C15's "none"), none without a modifier table. The
  // breakdown names each.
  const kinds = columnKinds(rulesSets);
  const modifierOf = (key: string): { shown: string; said: string } => {
    const row = figures.filled[`abilityModifiers.${key}`];
    if (!row || typeof row !== "object" || Array.isArray(row))
      return { shown: "", said: "" };
    const numbered = Object.entries(row).some(
      ([column, value]) =>
        column !== "range" &&
        typeof value === "number" &&
        (kinds[column] ?? "modifier") === "modifier",
    );
    if (!numbered) return { shown: "", said: "" };
    const first = modifierCells(row, kinds).find(
      (c) => c.kind === "modifier" && typeof c.value === "number",
    );
    // A score that changes nothing reads "+0", on the Player tab and the full sheet's page alike (tfr-3; page M1), and
    // is heard with its first modifier column's words, as the others are ("+0 save bonus").
    if (!first) {
      const zero = Object.keys(row).find(
        (column) =>
          column !== "range" &&
          typeof (row as Record<string, unknown>)[column] === "number" &&
          (kinds[column] ?? "modifier") === "modifier",
      );
      const shownZero = signedNumber(0);
      return {
        shown: shownZero,
        said: zero ? `${shownZero} ${columnWords(zero)}` : shownZero,
      };
    }
    const shownMod = signedNumber(first.value as number);
    return {
      shown: shownMod,
      said: `${shownMod} ${columnWords(first.column)}`,
    };
  };
  const scoreValue = (k: string) => {
    const field = abilityField(k);
    return field
      ? shown(field.key)
      : scores[k] !== undefined
        ? String(scores[k])
        : "—";
  };
  const classSource = packOf("class", character.classRef) || null;
  const raceShown = figures.shownRace ?? raceName;
  // The class's and kindred's pack after their names, only when another pack has one of the same name (sn-1, plan dec-1 1d).
  const fromOf = (kind: "class" | "race", ref: string | null) => {
    const found =
      setting && ref
        ? setting.all.find((e) => e.kind === kind && e.packEntryId === ref)
        : undefined;
    return found && setting && entryCtx
      ? namesakeSource(
          entriesInPlay(setting.all),
          entryCtx.packName,
          setting.packs,
        )(found)
      : null;
  };

  // Who they are (A1): "<Title>, <Class> <level>, <Kindred>", in the pack's words; the title opens its breakdown, the
  // class and the kindred their entries (ct3-11). Without a class, the card line the GM's fields make.
  const identity: ReactNode[] = [];
  if (advancement.title) {
    identity.push(
      explained[titleKey] ? (
        <TapValue
          key="title"
          label={`${titleField?.label ?? "Title"} ${advancement.title}: how it's worked out`}
          onTap={() => setOpen(titleKey)}
        >
          {advancement.title}
        </TapValue>
      ) : (
        <span key="title">{advancement.title}</span>
      ),
    );
  }
  if (className) {
    identity.push(
      <span key="class">
        {klass ? (
          <TapValue
            label={`${klass.name}: open its entry`}
            onTap={() => setEntry(klass)}
          >
            {klass.name}
          </TapValue>
        ) : (
          className
        )}{" "}
        {character.level}
        <NameFrom from={fromOf("class", character.classRef)} />
      </span>,
    );
    if (race) {
      identity.push(
        <Fragment key="race">
          <TapValue
            label={`${race.name}: open its entry`}
            onTap={() => setEntry(race)}
          >
            {race.name}
          </TapValue>
          <NameFrom from={fromOf("race", character.raceRef)} />
        </Fragment>,
      );
    } else if (raceShown) identity.push(raceShown);
  } else if (character.classRef && setting) {
    // A class the setting rules don't have (retest 4 T8): said, never the bare line of a character with no class.
    identity.push("Class not in this campaign’s setting rules");
  } else {
    identity.push(
      commas(
        cardLine(
          fieldDefs,
          character.fields,
          character.level,
          traitLookup(traitListsOf(setting?.all ?? [])),
        ),
      ),
    );
  }
  // The left column (A1): nothing else.
  const leftColumn = (
    <div key="left" className="sheet__vitals">
      <div className="sheet__heading">
        {portrait}
        <div className="sheet__heading-text">
          <h1 className="sheet__name">{character.name}</h1>
          <p className="sheet__identity">
            {identity.map((part, n) => (
              <Fragment key={n}>
                {n > 0 && ", "}
                {part}
              </Fragment>
            ))}
          </p>
          {companyName && <p className="auth__meta">{companyName}</p>}
        </div>
      </div>
      {hpBox}
      <StatRow>
        <StatTile
          label={acField ? shortLabel(acField.label) : "ac"}
          value={acValue}
          caption={
            commas(
              acTyped === null
                ? acTileCaption(
                    worn,
                    figures.filled,
                    short,
                    figures.acDirection,
                    acOverride !== null,
                  )
                : "",
            ) || undefined
          }
          {...tap("explain:ac", "Armour class", acValue)}
        />
        <StatTile
          label={attackLabel.toLowerCase()}
          value={attackValue}
          caption={commas(attack.caption) || undefined}
          {...tap("explain:attack", attackLabel, attackValue)}
        />
      </StatRow>
      <p className="auth__meta vitals__hint">
        Tap a figure for where it comes from
      </p>
    </div>
  );

  // The level's figures for the Player screen, which draws them as frame P1 does (dec-13 C3, ps-8): the class beside the
  // level, the experience and its bar, the company. The sheet's own page keeps its form below.
  const levelFigures: LevelFigures = {
    className: className ?? "",
    level: character.level,
    experience: levelExperience(
      character.xp ?? null,
      character.level,
      explaining.xpTable,
    ),
    fraction: advancement.fraction,
    company: companyName,
    onOpen: () => setOpen("explain:level"),
    formSwitch,
  };
  const levelBlock = (
    <section
      key="level"
      className="sheet__section sheet__block"
      aria-label="Level"
    >
      <RowList>
        <ListRow
          title={`Level ${character.level}`}
          sub={
            levelExperience(
              character.xp ?? null,
              character.level,
              explaining.xpTable,
            ) || undefined
          }
          openLabel={`Level ${character.level}: how it's worked out`}
          onOpen={() => setOpen("explain:level")}
        />
      </RowList>
      {advancement.fraction !== null && (
        <span className="advancement__bar" aria-hidden="true">
          <span
            className="advancement__fill"
            style={{ inlineSize: `${Math.round(advancement.fraction * 100)}%` }}
          />
        </span>
      )}
      {formSwitch}
    </section>
  );
  // The Saves line with its d20 in the heading's own row (sv-1, sv-3; plan dec-13 C5), built from the rules set's
  // `rolls.save`; it replaces the rule's first sentence that sat here (A2). The tiles don't draw it again.
  const savesBlock =
    saves.length > 0 ? (
      <SheetSection key="saves" label="Saves" labelLine={savesLine(rulesSets)}>
        <SaveTiles
          saves={saves}
          rules={saveRules(rulesSets, { scoresApart: true })}
          rulesSets={rulesSets}
          modifiers={(s) =>
            saveModifierLines(s.key, {
              filled: figures.filled,
              rulesSets,
              race: figures.race,
              raceName,
              klass: figures.klass,
              className,
              scores,
              label: (k) => abilityName(k).long,
            })
          }
          source={classSource}
          lineInHeading
        />
      </SheetSection>
    ) : (
      savesSections.map((s) => (
        <SheetSection key="saves" label={s.name}>
          <DetailsLedger rows={ledgerRows(s.rows)} story="" />
        </SheetSection>
      ))
    );
  const scoresBlock = shownAbilities.length > 0 && (
    // Six tiles in two rows of three: the pack's short name, the score, the plain modifier under. A score with a change
    // waiting for the GM keeps its old figure and its modifier and says nothing of the change, which the waiting line at
    // the top says: on the Player tab (page M1, frame M1g: Francis's fix of 19 Nov 2026; ⚑ 6 (c)) and on the full
    // sheet's page alike (of-3, ruled 2026-11-20).
    // The scores' line in the heading's row (sv-3; plan dec-13 C5): "Roll d20: your score or lower succeeds." from the
    // rules set's `rolls.abilityCheck`; a setting with no such check shows the heading alone.
    <SheetSection key="scores" label="Scores" labelLine={scoresLine(rulesSets)}>
      <ScoreRow
        scores={shownAbilities.map((k) => {
          const modifier =
            scoreValue(k) === "—" ? { shown: "", said: "" } : modifierOf(k);
          return {
            key: k,
            name: abilityName(k).long,
            value: scoreValue(k),
            modifier: modifier.shown,
            modifierSaid: modifier.said,
          };
        })}
        onOpen={(k) => setOpen(k)}
      />
      {!hosted && (
        <p className="auth__meta">Tap a score for everything it changes</p>
      )}
      {abilitySections.map((s) => (
        <DetailsLedger key={s.name} rows={ledgerRows(s.rows)} story="" />
      ))}
    </SheetSection>
  );
  // Movement (A2): two cards side by side, the speeds (a tap for the rest) and the load tier with its bar.
  const showLoad = !!load && load.mode !== "none" && !!setting?.encumbrance;
  const movementBlock = (speeds.length > 0 || showLoad) && (
    <SheetSection key="movement" label="Movement">
      <div className="sheet__pair">
        {speeds.length > 0 && (
          <button
            type="button"
            className="sheet__card sheet__card--tap"
            aria-label={`${speeds.map((r) => `${r.label} ${r.value}`).join(", ")}: how it's worked out`}
            onClick={() => setOpen(`movement:${speeds[0]!.key}`)}
          >
            <b className="sheet__card-figure">
              {hosted && movement.unit && /^\d+$/.test(speeds[0]!.value)
                ? `${speeds[0]!.value} ${movement.unit}`
                : speeds[0]!.value}
            </b>
            <span className="auth__meta">
              {hosted
                ? // The Player screen (dec-13 C10, frame P1; Francis's fix 5 of 19 Nov 2026): the speed's name, then the
                  // fight's figure, one short line ("Speed, 40 paces in a fight"); the rest is a tap away.
                  [
                    speeds[0]!.label,
                    ...speeds
                      .filter((r) => r.key === "movement.combat")
                      .map(
                        (r) =>
                          `${r.value} ${r.label.charAt(0).toLowerCase()}${r.label.slice(1)}`,
                      ),
                  ].join(", ")
                : [
                    speeds[0]!.label,
                    ...speeds.slice(1).map((r) => `${r.label} ${r.value}`),
                  ].join(", ")}
            </span>
          </button>
        )}
        {showLoad && (
          <div className="sheet__card">
            <LoadSummary
              load={load!}
              rules={setting!.encumbrance!}
              from={setting!.encumbranceFrom ?? []}
              // The Player screen says the speed once, on the speed card (dec-13 C10): the load's "speed said once".
              speedOnce={!!hosted && speeds.length > 0}
              // A tap on the burden opens its levels in a pop-up, on the Player tab and the full sheet (tfb-4, frame M2h).
              levelsPopUp
            />
          </div>
        )}
      </div>
    </SheetSection>
  );
  const languageNames =
    languagesField && shown(languagesField.key) !== "—"
      ? languageList(values[languagesField.key])
      : [];
  const languagesBlock = languagesField && (
    <SheetSection key="languages" label={languagesField.label}>
      {languageNames.length === 0 ? (
        <p className="auth__meta">None written yet.</p>
      ) : (
        <LanguageBoxes
          languages={languageNames.map((n) => {
            const found = entryCtx
              ? languageEntries(entryCtx, languagesField.key, n)[0]
              : undefined;
            return {
              key: n,
              name: found?.name ?? n,
              ...(found ? { onOpen: () => setEntry(found) } : {}),
            };
          })}
        />
      )}
      {literacy && <p className="auth__meta">{literacy}</p>}
    </SheetSection>
  );
  // The class's note on its skills under the heading: the full sheet's own page only. The Player screen has none
  // (ps-7, plan dec-13 row C5; plan test-feedback-2026-11-19 row A8): the skill's own sheet says it.
  const skillsNote = hosted ? "" : classSkillsNote(figures.klass);
  // The Skills line with its die in the heading's own row (tfs-2; plan test-feedback-2026-11-19 row C13, page M1),
  // built from the rules set's `rolls.skill` as the Saves line is from `rolls.save`; a setting with no such roll shows
  // the heading alone.
  const skillsBlock = skills.length > 0 && (
    <SheetSection key="skills" label="Skills" labelLine={skillsLine(rulesSets)}>
      {skillsNote && <p className="reading auth__meta">{skillsNote}</p>}
      <RowList dotted>
        {skills.map((s) => {
          const tag = s.byRace ? raceWord : s.raceNote || undefined;
          // ch-1 (frame P1 of december/14): the chevron, as the row opens the skill's sheet, and the die's glyph
          // beside the odds when the odds say which die (2-in-6 on a d6; a percentage on d100). A skill rolled the
          // target or higher on one die reads "5+ on", the glyph, "d6", the glyph inside the figure (tfs-3; row C14).
          const sides = s.chance?.sides;
          const target = targetFigure(s.shown, sides);
          return (
            <ListRow
              key={s.code}
              figure
              title={s.name}
              sub={tag}
              {...(target
                ? {
                    valueLead: <DieGlyph die={target.sides} size={16} />,
                    valueMarkAt: target.markAt,
                  }
                : sides !== undefined && isDieSize(sides)
                  ? { valueLead: <DieGlyph die={sides} size={16} /> }
                  : {})}
              value={target ? target.words : s.shown}
              openLabel={`${s.name}${tag ? `, ${tag}` : ""} ${target ? target.words : s.shown}: where it comes from`}
              onOpen={() => setOpenSkill(s)}
            />
          );
        })}
      </RowList>
    </SheetSection>
  );
  function secondaryOpen(field: FieldDefinition): (() => void) | undefined {
    const found = entryCtx
      ? fieldEntries(entryCtx, field, values[field.key], fieldDefs)[0]
      : undefined;
    if (found) return () => setEntry(found);
    return explained[`figure:${field.key}`]
      ? () => setOpen(`figure:${field.key}`)
      : undefined;
  }
  // A worked-out figure the pack defines that no section shows (Design on #567, ⚑ 2): an Abilities row, its breakdown on
  // tap. Not the hit dice or a derived save (the plan took those off), nor a save's modifier ("<score> vs magic": off
  // the sheet since 2026-11-08; plan test-feedback-2026-11-19 row A7), nor what another section or tile already shows.
  const VITALS = new Set(["attack", "ac", "hp", "level", "title"]);
  const figureRows = filledRows
    .filter(
      (r) =>
        !abilities.includes(r.label) &&
        !ownSection(r.name) &&
        !inAdvancement(r.name) &&
        !inMagic(r.name),
    )
    .filter(
      (r) =>
        r.name !== "hitDice" &&
        !/^(saves|saveModifiers|abilityModifiers)(\.|$)/.test(r.name) &&
        !VITALS.has(r.name.toLowerCase()) &&
        !VITALS.has(r.label.toLowerCase()),
    )
    .filter((r) => r.value.trim() !== "" && r.value !== "—")
    .map((r) => ({
      key: `figure:${r.name}`,
      name: r.label,
      figure: commas(r.value),
      said: `${r.label} ${commas(r.value)}: how it's worked out`,
      onOpen: () => setOpen(`figure:${r.name}`),
    }));
  // The powers of the trait-list entries picked or rolled (07 entries[].abilities, G-213; retest 4 T9): an Abilities
  // row each, its uses in words (the dots are the Player screen's); one with uses named like a class or race power
  // stays with the class or race. Its spell resolves in any attached pack.
  const traitPowers = setting
    ? pickedTraitAbilities(
        traitSteps(fieldDefs, traitListsOf(setting.all), {
          layout: layoutHints(setting.all),
          raceId: character.raceRef,
          choices,
        }),
        isPlainRecord(character.fields) ? character.fields : {},
        new Set(
          limitedAbilities(figures.klass, figures.race, character.level).map(
            (a) => a.name,
          ),
        ),
      )
    : [];
  const traitPowerRows = traitPowers.map((p) => {
    const key = `trait-power:${p.list.id}:${p.entry.id}:${p.name}`;
    const spent = p.uses ? Math.min(p.uses.count, usesSpent[p.name] ?? 0) : 0;
    const figure = p.uses
      ? spent > 0
        ? `${p.uses.count - spent} of ${p.uses.count} left`
        : usesWords(p.uses.count, p.uses.per)
      : "";
    const spell = p.spellId
      ? setting?.all.find(
          (e) => e.kind === "spell" && e.packEntryId === p.spellId,
        )
      : undefined;
    const opened: ValueEntry = {
      key,
      name: p.name,
      meta: `${p.entry.name}, ${p.list.name}`,
      lead: p.note,
      headings: [
        ...(p.uses
          ? [{ label: "Uses", text: usesWords(p.uses.count, p.uses.per) }]
          : []),
        ...(p.spellId
          ? [
              {
                label: "Casts",
                text: spell?.name ?? "A spell not in these setting rules",
              },
            ]
          : []),
      ],
    };
    return {
      key,
      name: p.name,
      figure,
      said: [p.name, figure].filter(Boolean).join(", "),
      onOpen: () => setEntry(opened),
    };
  });
  // Abilities (A2): the class's abilities (and those from options), the experience bonus, the secondary skill.
  const abilityRows = [
    ...traitRows(["class", "options"]),
    ...traitPowerRows,
    ...figureRows,
    ...(advancement.bonus
      ? [
          {
            key: "xp-bonus",
            name: "Experience bonus",
            figure: advancement.bonus.value.replace(/%$/, " %"),
            said: `Experience bonus ${advancement.bonus.value}: how it's worked out`,
            onOpen: () => setOpen("explain:xpBonus"),
          },
        ]
      : []),
    ...(secondaryField && shown(secondaryField.key) !== "—"
      ? [
          {
            key: "secondary",
            name: secondaryField.label,
            figure: shown(secondaryField.key),
            said: `${secondaryField.label} ${shown(secondaryField.key)}`,
            onOpen: secondaryOpen(secondaryField),
          },
        ]
      : []),
  ];
  // On the Player screen a trait with uses has its own row in the Traits section, with Use (dec-13 C12, frame P1); the
  // foot's rows leave it out, so each thing shows once (Francis's fix 9 of 19 Nov 2026: Steady flame was listed twice).
  // Only a row whose name is in the list the Traits rows are drawn from (`traitsWithUsesOf`, the automatic review's
  // nit), so a trait with uses never vanishes from both.
  const withUses = shownAbove(
    [
      ...traitChipGroups
        .flatMap((g) => g.chips)
        .map((chip) => ({
          key: `trait:${chip.key}`,
          name: chip.name,
          uses: chip.uses,
        })),
      ...traitPowers.map((p) => ({
        key: `trait-power:${p.list.id}:${p.entry.id}:${p.name}`,
        name: p.name,
        uses: p.uses?.count ?? 0,
      })),
    ],
    traitsWithUsesOf(
      figures.klass,
      figures.race,
      character.level,
      powersWithUses(traitPowers),
    ),
  );
  const onFoot = <R extends { key: string }>(rows: R[]) =>
    hosted ? rows.filter((r) => !withUses.has(r.key)) : rows;
  const alignmentValue = alignmentField ? shown(alignmentField.key) : "—";
  const alignmentEntry =
    alignmentField && entryCtx && alignmentValue !== "—"
      ? fieldEntries(
          entryCtx,
          alignmentField,
          values[alignmentField.key],
          fieldDefs,
        )[0]
      : undefined;
  const traitsRows = [
    ...traitRows(["kindred"]),
    ...(alignmentField && alignmentValue !== "—"
      ? [
          {
            key: "alignment",
            name: alignmentField.label,
            figure: alignmentValue,
            said: `${alignmentField.label} ${alignmentValue}`,
            onOpen: alignmentEntry ? () => setEntry(alignmentEntry) : undefined,
          },
        ]
      : []),
  ];
  // On the Player tab a pinned ability or trait is in the right column's list (row P3; pg28-3, ⚑ 26): it leaves its
  // foot row's line, so each thing shows once; the row still opens every one, a pinned one with the Pinned mark.
  const pinnedHere = new Set(hosted && pins ? pins.names : []);
  const footLine = (rows: readonly { name: string }[]) => {
    const left = rows.filter((r) => !pinnedHere.has(r.name));
    return left.length > 0 ? summaryLine(left.map((r) => r.name)) : "All pinned: they are in the list above";
  };
  const rowsOf = (rows: typeof abilityRows) => (
    <RowList dotted>
      {rows.map((r) => (
        <ListRow
          key={r.key}
          figure
          {...(pinnedHere.has(r.name) ? { lead: <PinnedMark /> } : {})}
          title={r.name}
          value={r.figure || undefined}
          openLabel={pinnedHere.has(r.name) ? `${r.said}, pinned` : r.said}
          {...(r.onOpen ? { onOpen: r.onOpen } : {})}
        />
      ))}
    </RowList>
  );
  const abilityFoot = onFoot(abilityRows);
  const traitsFoot = onFoot(traitsRows);
  const abilitiesBlock = abilityFoot.length > 0 && (
    <SheetSection
      key="abilities"
      label="Abilities"
      {...(hosted
        ? { row: true, summary: footLine(abilityFoot) }
        : {})}
    >
      {rowsOf(abilityFoot)}
    </SheetSection>
  );
  const traitsBlock = traitsFoot.length > 0 && (
    <SheetSection
      key="traits"
      label="Traits"
      {...(hosted
        ? { row: true, summary: footLine(traitsFoot) }
        : {})}
    >
      {rowsOf(traitsFoot)}
      {!hosted && <p className="auth__meta">Tap a row for the full rule</p>}
    </SheetSection>
  );
  // The patron (December 1a; pt-7, the lead's "done properly"): its name opens its entry (the whole ladder); under it,
  // what it gives this character now: the holy symbol, the garb of every tier reached, the prayer, the strictures, the
  // swapped spells and a line for each mark reached. Only for a character with a patron an attached pack still has.
  const patron = setting ? patronInSetting(setting, character.creation) : null;
  const patronNames = {
    spell: (id: string) =>
      setting?.all.find((e) => e.kind === "spell" && e.packEntryId === id)
        ?.name,
    klass: (id: string) =>
      setting?.all.find((e) => e.kind === "class" && e.packEntryId === id)
        ?.name,
  };
  // A patron whose pack is no longer attached is still named, from the character's own record (the review of #636).
  // One whose option is off is hidden instead, kept on the record (pt-9, 2026-11-12): no section at all.
  const patronHidden =
    !!setting &&
    !!patronKept(
      character.creation,
      setting.all.filter((e) => e.kind === "patron"),
    );
  const patronGone =
    !patron && !patronHidden && patronNameOf(character.creation)
      ? `${patronNameOf(character.creation)} (${NOT_ATTACHED})`
      : "";
  // The patron's name beside the section's heading opens its entry; under it the book's whole ladder (Francis, 2026-11-12).
  const openPatron = () => {
    if (!patron) return;
    const opened = patronEntry(
      patron,
      patronNames,
      entryCtx ? entryCtx.packName(patron.packId) : "",
    );
    setEntry({
      key: `patron:${patron.id}`,
      name: opened.name,
      meta: opened.meta,
      lead: opened.lead,
      description: opened.description,
      headings: opened.headings,
    });
  };
  const patronLadderBlock = patron ? (
    <PatronLadderView
      ladder={patronLadder(
        patron,
        topSpellLevel(slotsOf(figures.filled)),
        character.classRef ?? "",
        patronNames,
        classListOf(setting ?? { all: [] }),
      )}
    />
  ) : null;
  const patronBlock = patron ? (
    hosted ? (
      // Beside the Player screen (dec-13 C12): a row, the patron's name in its line; it opens the ladder, with the
      // patron's own entry one row away (nothing the sheet showed is lost).
      <SheetSection key="patron" label="Patron" row summary={patron.name}>
        <RowList>
          <ListRow
            title={patron.name}
            openLabel={`Patron ${patron.name}: open its entry`}
            onOpen={openPatron}
          />
        </RowList>
        {patronLadderBlock}
      </SheetSection>
    ) : (
      <SheetSection
        key="patron"
        label="Patron"
        labelAction={{
          text: patron.name,
          label: `Patron ${patron.name}: open its entry`,
          onTap: openPatron,
        }}
      >
        {patronLadderBlock}
      </SheetSection>
    )
  ) : patronGone ? (
    <SheetSection
      key="patron"
      label="Patron"
      {...(hosted ? { row: true, summary: patronGone } : {})}
    >
      <DetailsLedger
        rows={[{ key: "patron", label: "Patron", value: patronGone }]}
        story=""
      />
    </SheetSection>
  ) : null;
  const magicTabs = magic
    ? magic.tabs.map((t) => ({
        title: t.title,
        count: t.rows.reduce((sum, r) => sum + r.times, 0),
      }))
    : [];
  const magicBlock = magic && (
    <SheetSection
      key="magic"
      label="Magic"
      summary={magicSummary(magicTabs)}
      {...(hosted ? { row: true } : {})}
    >
      <MagicBlock magic={magic} onOpen={(row) => setEntry(spellEntry(row))} />
    </SheetSection>
  );
  const detailsBlock = (
    <SheetSection key="details" label="Details and backstory">
      <DetailsLedger
        rows={[...detailRows, ...ledgerRows(detailFieldRows)]}
        story={character.backstory}
      />
      {hiddenSection && hiddenSection.rows.length > 0 && (
        <>
          <h3 className="sheet__group-title">{hiddenSection.name}</h3>
          <DetailsLedger rows={ledgerRows(hiddenSection.rows)} story="" />
        </>
      )}
    </SheetSection>
  );
  const rightColumn = [
    levelBlock,
    savesBlock,
    scoresBlock,
    movementBlock,
    languagesBlock,
    skillsBlock,
    abilitiesBlock,
    traitsBlock,
    patronBlock,
    magicBlock,
    detailsBlock,
    notes,
  ];
  const columns: ReactNode[][] = beside
    ? [rightColumn]
    : phone
      ? [[leftColumn, ...rightColumn]]
      : [[leftColumn], rightColumn];

  // The figure tapped, as the breakdown sheet (D: every pop-up on the sheet is a Sheet): the figure's parts, the
  // setting's words; a score's blurb and everything it changes (ruled 2026-10-26, 2026-10-29), with the full name.
  // Every figure's sheet the character sheet opens ends with its source line (sv-2a; plan dec-player-figure-sheet piece 1; plan
  // test-feedback-2026-11-19 rows A7 and H2), by the one rule the Player tab's own sheets use (`figureSourceOf`).
  const figureSource = (key: string): string | null => {
    const kind = key.slice(0, Math.max(0, key.indexOf(":")));
    const rest = key.slice(key.indexOf(":") + 1);
    const fill =
      kind === "figure"
        ? (fieldDefs.find((f) => f.key === rest)?.fill?.trim() ?? rest)
        : rest;
    return figureSourceOf(setting, fill, character.classRef);
  };
  const breakdown = (key: string) => {
    if (key === "explain:attack" && attack.rows.length > 0) {
      // Attack's breakdown (sr-8): the class figure, melee and missile, the to-hit row under descending AC.
      return (
        <BreakdownSheet
          title={attackLabel}
          figure={attackValue}
          figureHead
          rows={attack.rows.map((r) => ({
            label: commas(r.label),
            value: r.value,
          }))}
          toHit={attack.toHit}
          {...(attack.ending ? { ending: commas(attack.ending) } : {})}
          source={figureSource(key)}
          onClose={() => setOpen(null)}
        />
      );
    }
    if (explained[key]) {
      // Armour class and attack are figure sheets: the number in the head (the Figure head), so the title is the name
      // alone. A figure that is not a roll (Level, the Experience bonus, a movement speed, a field's figure, the title)
      // is not repeated: its pop-up starts with its sentence, "Level 2 Warden." (tfb-3, 2026-11-19; plan
      // test-feedback-2026-11-19 row C4; mockup december/26 frame M2e).
      const figure =
        key === "explain:ac"
          ? acValue
          : key === "explain:attack"
            ? attackValue
            : undefined;
      const figureHead = key === "explain:ac" || key === "explain:attack";
      const title =
        key === "explain:attack" ? attackLabel : explained[key].title;
      return (
        <BreakdownSheet
          title={title}
          figure={figure}
          figureHead={figureHead}
          lines={explained[key].lines.map(commas)}
          source={figureSource(key)}
          onClose={() => setOpen(null)}
        >
          {key === "explain:xpBonus" && (
            <PrimeXpTable
              bands={
                classEntryFound
                  ? primeXpBands(rulesSets, classEntryFound, scores)
                  : null
              }
            />
          )}
          {key === "explain:ac" && onClearAc && (
            <RowList>
              <ListRow
                title="Clear the AC set by hand"
                sub="The worked-out AC comes back. Undo from the toast"
                chevron={false}
                onOpen={() => {
                  setOpen(null);
                  onClearAc();
                }}
              />
            </RowList>
          )}
        </BreakdownSheet>
      );
    }
    // A score (sv-2a; plan dec-player-figure-sheet piece 2, mockup 14 frame P7b): under "Modifiers", each thing its row
    // changes, once, with what it gives, one that gives nothing still listed ("Open doors: no change."); then, with no
    // heading, the setting's words on the ability (its blurb, its note). What it affects ("Melee, doors") would name
    // the effects twice, so it shows only where the setting has no modifier table for the score.
    const blurb = abilityBlurb(rulesSets, key);
    const row = figures.filled[`abilityModifiers.${key}`];
    const score = scores[key];
    const effects = modifierEffects(
      rulesSets,
      key,
      typeof score === "number" ? score : null,
      row,
    );
    const affects = effects.length === 0 ? captionOf(key) : undefined;
    const others =
      effects.length === 0 && row === undefined
        ? filledRows.filter((r) => r.label === key).map((r) => r.value)
        : [];
    const rule = withoutRepeats([
      ...(blurb ? [blurb] : []),
      ...(affects ? [affects] : []),
      ...(noteOf(key) ? [noteOf(key)] : []),
      ...others,
    ]);
    // The source line, as on a save's sheet (the lead's ruling, P7b): the pack whose rules set gives this score's table or words.
    const ruleEntry = setting?.all.find(
      (e) =>
        e.kind === "rulesSet" &&
        isPlainRecord(e.data) &&
        [e.data.abilityModifiers, e.data.abilityModifierNotes].some(
          (m) => isPlainRecord(m) && m[key] !== undefined,
        ),
    );
    const scoreSource =
      ruleEntry && entryCtx
        ? entryCtx.packName(ruleEntry.packId) || null
        : null;
    return (
      <BreakdownSheet
        title={abilityName(key).long}
        figure={scoreValue(key)}
        figureHead
        modifiers={effects.map(commas)}
        rule={rule.map(commas)}
        source={scoreSource}
        onClose={() => setOpen(null)}
      />
    );
  };

  // Hosted (dec-13 C1): the same blocks, placed by the Player screen; the sheets they open stay here.
  const body = hosted ? (
    hosted({
      level: levelFigures,
      saves: savesBlock,
      scores: scoresBlock,
      movement: movementBlock,
      languages: languagesBlock,
      skills: skillsBlock,
      details: {
        rows: [...detailRows, ...ledgerRows(detailFieldRows)],
        story: character.backstory ?? "",
        hidden:
          hiddenSection && hiddenSection.rows.length > 0
            ? {
                label: hiddenSection.name,
                rows: ledgerRows(hiddenSection.rows),
              }
            : null,
      },
      rest: [abilitiesBlock, traitsBlock, patronBlock, magicBlock, notes],
      pinnable: [...abilityRows, ...traitsRows].map((r) => ({
        key: r.key,
        name: r.name,
        ...(r.onOpen ? { onOpen: r.onOpen } : {}),
      })),
    })
  ) : (
    <>
      {changeLines}
      <div className="sheet__layout">
        <div
          className={
            columns.length > 1
              ? "sheet__columns sheet__columns--split"
              : "sheet__columns"
          }
        >
          {columns.map((column, n) => (
            <div key={n} className="sheet__column">
              {column}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      {body}
      {entry && (
        // The entry, to read (ct3-11): the creation step's entry, without its Pick; an open class's chip opens that class.
        <EntryPanel
          name={entry.name}
          meta={entry.meta}
          lead={entry.lead}
          description={entry.description}
          headings={entry.headings}
          onChip={(id) => entryCtx && setEntry(classEntry(entryCtx, id))}
          onClose={() => setEntry(null)}
          backLabel="Got it"
          asSheet
          // A pinned one's own pop-up ends with Move up and Move down (pg28-7, frame M4e).
          {...(pins && pinnedHere.has(entry.name)
            ? { extra: pins.moves(entry.name, [...abilityRows, ...traitsRows].map((r) => r.name)) }
            : {})}
        />
      )}
      {open && breakdown(open)}
      {openSkill && (
        <SkillSheet
          skill={openSkill}
          roll={skillRollOf(openSkill.code, explaining, rulesSets)}
          source={classSource}
          expertise={skillExpertise(openSkill.code)}
          {...(onMovePoints && skillExpertise(openSkill.code)
            ? {
                onMovePoints: () => {
                  setOpenSkill(null);
                  onMovePoints();
                },
              }
            : {})}
          onClose={() => setOpenSkill(null)}
        />
      )}
    </>
  );
}

/**
 * The sections a layout's groups make. The Combat and Advancement groups have no block of their own any more: what
 * the sheet shows elsewhere (AC, the attack, movement, the title, the bonus) is already left out of them, so what's
 * left (a typed weapon proficiencies field) reads as a detail.
 */
function sections<T extends { name: string }>(all: readonly T[]): T[] {
  return [...all];
}

/** Figures worked from both the class and the rules set: the class's figure, read with the rules set's table or style. */
const FROM_CLASS_AND_RULES = new Set(["attack"]);

/**
 * The pack a figure's sheet names in its source line (sv-2a; plan test-feedback-2026-11-19 rows A7 and H2), on the
 * full sheet and the Player tab's own Armour class and Attack sheets alike. `fill` is the figure's fill ("attack",
 * "ac", "movement.walk", "saveModifiers.spell-ward"). A figure worked from both the class and the rules set (Attack)
 * names the class's pack (H2, Francis: "Class's pack", 2026-11-19); one the rules set alone gives (a save's modifier, a
 * movement mode) names the rules set's pack; anything else the class's pack. Null when no pack is known.
 */
export function figureSourceOf(
  setting: Pick<CampaignSetting, "all" | "packs"> | null,
  fill: string,
  classRef: string | null,
): string | null {
  if (!setting) return null;
  const packName = (id: string) => {
    const pack = setting.packs.find((p) => p.packId === id);
    return pack?.shortName ?? pack?.name ?? "";
  };
  const classEntry = classRef
    ? setting.all.find((e) => e.kind === "class" && e.packEntryId === classRef)
    : undefined;
  const fromClass = classEntry ? packName(classEntry.packId) : "";
  const head = fill.split(".")[0] ?? "";
  const rulesEntry = head
    ? setting.all.find(
        (e) =>
          e.kind === "rulesSet" &&
          isPlainRecord(e.data) &&
          e.data[head] !== undefined,
      )
    : undefined;
  const fromRules = rulesEntry ? packName(rulesEntry.packId) : "";
  if (FROM_CLASS_AND_RULES.has(head)) return fromClass || fromRules || null;
  return fromRules || fromClass || null;
}

/** The first sentence of a rule's text ("Roll d20, equal or over the number."). */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const end = trimmed.search(/[.!?](\s|$)/);
  return end < 0 ? `${trimmed}.` : trimmed.slice(0, end + 1);
}

/**
 * The literacy a character has, as the line under the languages when the pack gives no literacy rule (dec-13 C4): the
 * pack's own word for it as a sentence ("Reads and writes." from "Reads and writes"); '' when nothing is written.
 */
export function literacySentence(value: unknown): string {
  // Words only: a checkbox's true or a number is no sentence (the review of #910).
  if (typeof value !== "string") return "";
  const words = value.trim();
  if (!words || words === "—" || !/\p{L}/u.test(words)) return "";
  const capital = words.charAt(0).toUpperCase() + words.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

/** Whether the pack has a literacy rule (a rules set's `literacyNote`): then only its words make the line. */
export function hasLiteracyRule(
  rulesSets: readonly Record<string, unknown>[],
): boolean {
  return rulesSets.some((rules) => rules.literacyNote !== undefined);
}

/**
 * Literacy's one line under the languages (plan A2), in the pack's words: the rules set's `literacyNote` for the level
 * the character has ("Literacy: Literate, reads and writes the languages above."), or its one text; '' when the
 * character has no level written or the pack has no literacy rule (no app wording).
 */
export function literacyLine(
  rulesSets: readonly Record<string, unknown>[],
  value: string,
): string {
  if (!value || value === "—") return "";
  let note: unknown;
  for (const rules of [...rulesSets].reverse()) {
    if (rules.literacyNote !== undefined) {
      note = rules.literacyNote;
      break;
    }
  }
  let words = "";
  if (isPlainRecord(note)) {
    const found = Object.entries(note).find(
      ([k, v]) =>
        k.trim().toLowerCase() === value.trim().toLowerCase() &&
        typeof v === "string",
    );
    words = found ? String(found[1]).trim() : "";
  } else if (typeof note === "string") words = note.trim();
  if (!words) return "";
  const sentence = firstSentence(words);
  return `Literacy: ${value}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}
