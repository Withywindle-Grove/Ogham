import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import type { MyCharacter } from '../core/myCharacters.ts';
import type { Db } from '../core/supabase.ts';
import { attackFigures } from '../modules/characters/sheetCombat.ts';
import { cardLine, shortLabel, type FieldDefinition } from '../modules/characters/fields.ts';
import { downAtOf } from '../modules/characters/hp.ts';
import { combatFields, skillsOf } from '../modules/characters/play.ts';
import { CentredPopUpScope, SheetScope } from '../ui/Dialog.tsx';
import { limitedAbilities, loadCharacterPlay, pinnedNames, powersWithUses, type CharacterPlay, type LimitedAbility } from '../modules/characters/playState.ts';
import { SectionNav } from '../ui/SectionNav.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { useNavCollapsed } from '../ui/navCollapsed.ts';
import { DividerHandle } from '../ui/DividerHandle.tsx';
import { CompanyPage } from './CompanyPage.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { LogSheet, useLogVersion } from './campaignLog.tsx';
import { usePhone } from './useWide.ts';
import { phoneTabs, playerTabs, type PlayerTab } from './navTabs.ts';
import { noteTab, tabRestored, tabToRestore } from './placeOnReload.ts';
import { hasSpells, MagicTab } from './MagicTab.tsx';
import { choicesInPlay, forgetCampaignSetting, loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { weaponDamageRule } from '../modules/characters/weaponDamage.ts';
import { layoutHints, pickedTraitAbilities, traitListsOf, traitLookup, traitSteps } from '../modules/characters/traitLists.ts';
import { campaignChoices } from './weaponSetup.ts';
import { acStyleOf, attackStyleOption, characterFigures } from './fromSetting.ts';
import { LogView } from './LogView.tsx';
import { PackScreen } from './PackScreen.tsx';
import { PartyGroups } from './PartyGroups.tsx';
import { loadCarriedItemIds } from '../modules/expedition/activityPlay.ts';
import { SceneTime } from './SceneTime.tsx';
import { RetiredBanner } from './Retired.tsx';
import { TopRow } from './TopRow.tsx';
import './PlayerScreen.css';
import { useCastingStatus, useWornGear } from './EquipWarning.tsx';
import { useCharacterLight } from './LightSection.tsx';
import { Darkness, useNoLight } from './Darkness.tsx';
import { noLightNotice } from './player/PlayerNotices.tsx';
import { useStatusBook } from './Statuses.tsx';
import { MessageCard, useMessaging } from './Messages.tsx';
import { PlayerRequests } from './RequestCard.tsx';
import { fieldsInPlay, fieldsOffFor } from '../modules/library/optionGate.ts';
import { CharacterSheet, type SheetPins } from './CharacterSheet.tsx';
import { BookType } from '../ui/creation.tsx';
import { kindredAndTitle, nameKindredTitle, PlayerHead } from './player/PlayerHead.tsx';
import { PlayerVitals } from './player/PlayerVitals.tsx';
import { PlayerAtHand } from './player/PlayerAtHand.tsx';
import { EntryPinStar, movePinTo, PinMoves, PlayerTraits, traitsWithUses } from './player/PlayerTraits.tsx';
import { PlayerSheetParts } from './player/PlayerSheetParts.tsx';
import { playerFigures } from './player/playerFigures.ts';
import { PlayerStateLine } from './player/PlayerStates.tsx';
import { usePlayerView } from './playerView.ts';

type Tab = Exclude<PlayerTab, 'log'>;

// How many log lines Scene shows; the whole log opens from the top row.
const RECENT_LINES = 5;

// The Player screen (dec-13 C1: ps-2, ps-2a, ps-4): what a player glances at between turns, in two columns on a
// landscape tablet. The left, for now: the head and statuses, the vitals (HP with its bar, AC and attack), Light and
// At hand, the level block, Details. The right, for reference: Scores, Saves, Movement and load, Traits (with uses),
// Skills, Languages, then the rest of the full sheet's rows, with no heading and no Edit (tfr-4, tfr-5). One column
// below 1024 px, the saves under the vitals and the same rows last. The sheet's parts are hosted (player/PlayerSheetParts.tsx); each part shows only when the
// character has it. No party list and no marching order (ps-4). A character with spells has a Magic tab, and the
// Player screen no Spells section (mp-20; dec-8 B).
/**
 * The Player tab's pop-ups, in both columns: the book's (tfb-1, row C8: the red heading over their own buttons) and, on
 * a tablet either way up, centred on the screen and fitted to their content (fb7-1 to fb7-6; page 31, approved
 * 2026-11-20). Every pop-up opened from the tab, or from inside one of its pop-ups, takes both.
 */
function TabPopUps({ children }: { children: ReactNode }) {
  return (
    <CentredPopUpScope.Provider value>
      <BookType popUps>{children}</BookType>
    </CentredPopUpScope.Provider>
  );
}

export function PlayerScreen({
  db,
  user,
  campaign,
  character,
  fieldDefs: campaignFields,
  companyOpen = false,
  onCompanyDone = () => undefined,
  onBack,
  onHpChange,
  onDataChange,
  wide = false,
  sheetRefresh = 0,
  onSheetSaved,
  startTab,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  character: MyCharacter;
  fieldDefs: FieldDefinition[];
  /** The Company page (ruled 2026-10-24): from ⋯ until M5's party sigil on Scene; not offered with companies off. */
  companyOpen?: boolean;
  onCompanyDone?: () => void;
  onBack: () => void;
  /** Saved HP changed (so the sheet beside it can refresh). */
  onHpChange?: () => void;
  /** Something changed elsewhere (an undo in the log), so the character should be reloaded. */
  onDataChange?: () => void;
  /** A landscape tablet (dec-13 C1, ps-2): two columns, the left for now and the right for reference. */
  wide?: boolean;
  /** Changes when the hit points were saved here, so the sheet's parts read again. */
  sheetRefresh?: number;
  /** The sheet beside saved something (its Edit). */
  onSheetSaved?: () => void;
  /** The GM's view as the player (page 32): the tab its door opens (View sheet, Pack, Magic, Scene; tfg-1). */
  startTab?: Tab;
}) {
  // The GM's view as the player (page 32): whose view this is, or null on the player's own screen.
  const view = usePlayerView();
  // After a reload into a new version, the tab the player was on (placeOnReload.ts). The GM's view neither restores
  // nor notes one, so it never changes the tab the GM's own sections or a player's device come back to (C15b).
  const [tab, setTab] = useState<Tab>(() => (view ? (startTab ?? 'player') : (tabToRestore<Tab>(campaign.id, ['player', 'scene', 'pack', 'magic']) ?? 'player')));
  useEffect(() => {
    if (!view) tabRestored(campaign.id);
  }, [view, campaign.id]);
  useEffect(() => {
    if (!view) noteTab(campaign.id, tab);
  }, [view, campaign.id, tab]);
  const phone = usePhone();
  const messaging = useMessaging();
  const waiting = messaging && messaging.user.roles[campaign.id] !== 'gm' ? messaging.unread : 0;
  // Log in a phone's tab bar (slice E) opens the whole log full screen, as the top row's Log does elsewhere (06: full
  // screen on every device); closing it comes back to the tab you were on, focus on Log.
  const [logOpen, setLogOpen] = useState(false);
  const logOpener = useRef<HTMLElement | null>(null);
  const select = (next: PlayerTab) => {
    if (next !== 'log') return setTab(next);
    logOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLogOpen(true);
  };
  // B15 (M5 gate): on a landscape tablet the left column folds to icons, remembered on this device.
  const [navCollapsed, setNavFolded] = useNavCollapsed();
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  // A field whose option is off, or not for this class or kindred (cs-3), is hidden here too; its value stays saved (of-9).
  const fieldDefs = fieldsInPlay(campaignFields, fieldsOffFor(setting, character));
  // What's ready and cast (the Magic tab) and which limited uses are spent (Traits).
  const [play, setPlay] = useState<CharacterPlay | null>(null);
  const [playVersion, setPlayVersion] = useState(0);
  // The pack items the character carries (M5b step 3: an activity's `requires.item`).
  const [carried, setCarried] = useState<Set<string>>(new Set());
  // An undo from the log (open over this screen) shows the saved hit points again.
  const logVersion = useLogVersion();
  // On a landscape tablet the Pack tab uses the right-hand column too (Add item opens there).
  const [packSide, setPackSide] = useState<HTMLElement | null>(null);
  // Where the full sheet's parts go in the two columns (dec-13 C1; player/PlayerSheetParts.tsx).
  const [savesSlot, setSavesSlot] = useState<HTMLElement | null>(null);
  const [levelSlot, setLevelSlot] = useState<HTMLElement | null>(null);
  const [detailsSlot, setDetailsSlot] = useState<HTMLElement | null>(null);
  const [topSlot, setTopSlot] = useState<HTMLElement | null>(null);
  const [moreSlot, setMoreSlot] = useState<HTMLElement | null>(null);
  const [traitsSlot, setTraitsSlot] = useState<HTMLElement | null>(null);
  const toastMove = useToast();
  // The notices box's place (row C1): the right column's top beside, under the head's line in one column.
  const [noticesSlot, setNoticesSlot] = useState<HTMLElement | null>(null);
  // The screen's one loading state (dec-13 C11): where each read the Player tab is drawn from stands. Until the first
  // open, the tab shows one "Opening…" and none of its parts, so nothing jumps under a finger as each arrives; after it,
  // a read again (a refresh, the way back to the tab) never blanks the screen.
  const [settingRead, setSettingRead] = useState<'reading' | 'failed' | 'read'>('reading');
  const [playFailed, setPlayFailed] = useState(false);
  const [sheetPhase, setSheetPhase] = useState<'opening' | 'error' | 'ready'>('opening');
  const [packRead, setPackRead] = useState(false);
  const [opened, setOpened] = useState(false);
  const [readAgain, setReadAgain] = useState(0);
  const onPackRead = useCallback(() => setPackRead(true), []);

  useEffect(() => {
    let current = true;
    // A read that throws counts as one that failed (C11's review): the error with Try again, never Opening… for ever.
    void loadCampaignSetting(db, user.id, campaign.id).then(
      (found) => {
        if (!current) return;
        setSetting(found);
        setSettingRead(found ? 'read' : 'failed');
      },
      () => current && setSettingRead('failed'),
    );
    return () => {
      current = false;
    };
  }, [db, user.id, campaign.id, readAgain]);

  useEffect(() => {
    let current = true;
    void loadCharacterPlay(db, character.id).then(
      (found) => {
        if (!current) return;
        setPlay(found);
        setPlayFailed(found === null);
      },
      () => current && setPlayFailed(true),
    );
    return () => {
      current = false;
    };
  }, [db, character.id, logVersion, playVersion, readAgain]);
  const failed = !opened && (settingRead === 'failed' || playFailed);
  const opening = !opened && !failed && (settingRead === 'reading' || play === null || sheetPhase === 'opening' || !packRead);
  // Opened once every read is in: kept from then on (set while rendering, React's way to adjust state to what changed).
  if (!opened && !failed && !opening) setOpened(true);
  /**
   * Try again (C11): every read the tab waits for, afresh, past the device's kept copy of the rules: the rules and the
   * play state here, and At hand's pack and the hosted sheet, which read the rules too (mounted again by `readAgain`).
   */
  const tryAgain = () => {
    forgetCampaignSetting(campaign.id);
    setSettingRead('reading');
    setPlayFailed(false);
    setPackRead(false);
    setSheetPhase('opening');
    setReadAgain((n) => n + 1);
  };
  useEffect(() => {
    let current = true;
    void loadCarriedItemIds(db, character.id).then((found) => current && setCarried(found));
    return () => {
      current = false;
    };
  }, [db, character.id, logVersion]);
  // The armour and shields worn: AC is worked out from them (ruled 2026-10-29, B9); read again on the way back here.
  const worn = useWornGear(db, campaign.id, character.id, `${logVersion}:${tab}`, setting);
  // A rule that sets every weapon's die (of-8): At hand names it after the damage ("d6 · All weapons d6").
  const damageReason = setting ? (weaponDamageRule(setting.rulesSets, setting.all, choicesInPlay(setting))?.reason ?? null) : null;
  // The character's light (M5 step 7): read for the whole screen, so its burnout toast reaches the player on any tab.
  const lightView = useCharacterLight({
    db,
    user,
    carrier: { id: character.id, campaignId: character.campaignId, ownerUserId: character.ownerUserId, archived: character.archived, level: character.level },
    setting,
    refresh: logVersion,
  });

  // No light (DG7): read here for the Player tab, where it is a notice in the box (row C1, tfn-2); the Scene has its
  // own, in the prompt slot. Not shown on the Pack and Magic tabs (d5-20, ruled 2026-11-20).
  const noLight = useNoLight({ db, campaignId: character.campaignId, characterId: character.id, setting: tab === 'scene' ? null : setting, light: lightView, refresh: logVersion });

  // The character's statuses (M5 step 9): symbols beside the name, each with its details; + Status for its player.
  const statuses = useStatusBook(db, user, campaign.id, logVersion);
  // The derived casting status (B25) joins the Statuses row as a ring (plan m5b-creation-retest-3 F).
  const casting = useCastingStatus(db, user.id, character.campaignId, character.id, logVersion);

  // The single top row: the campaign's sigil and name back to Your campaigns; the ⋯ holds the campaign's items
  // (Your characters, Full character sheet, Company, Setting rules), the same on every screen in the campaign (N17).
  // On a phone the campaign's name sits beside ≡, which opens the drawer, and Log is a tab (slice E).
  // Beside ≡ the character's name on Player, "<name>’s pack" on Pack, the campaign's on Scene (Design on #549, mockup 17).
  // On Player, in two columns, the bar reads the name, "the" kindred and the title (dec-13 C2, frame P1).
  const topRow = (playerTitle: string) => {
    const title = tab === 'scene' ? (phone ? undefined : '') : tab === 'pack' ? `${character.name}’s pack` : playerTitle;
    // The GM's view (page 32, M3c, M3j): "‹ Players" at the left (in ≡'s place on a phone), the same title, and the
    // GM's own Log, ✉ and Reference; the band sits under the row (its host's BelowTopRowProvider).
    if (view) return <TopRow back="Players" named onBack={onBack} menuLabel="Character options" title={title ?? ''} logTab standard />;
    // Creation's standard (plan m5b-players-screens-standard A1): the title centred, ⋯ a sheet; the same bar on every tab
    // so it never jumps between them.
    return <TopRow campaign={{ db, campaign }} onBack={onBack} menuLabel="Character options" drawer={campaign.name} title={title} logTab standard />;
  };

  if (companyOpen) {
    return (
      <section className="player">
        {topRow(character.name)}
        <CompanyPage db={db} user={user} campaign={campaign} character={character} onDone={onCompanyDone} />
      </section>
    );
  }

  const figures = characterFigures(setting, character, fieldDefs);
  // The Magic tab (mp-20, mm-2; dec-8 B): for a character with spells. Should they go (a level lost), Player shows.
  const magic = !!setting && !!play && hasSpells(figures, play);
  const current: Tab = tab === 'magic' && !magic ? 'player' : tab;
  // The picked trait-list entries' powers with uses (07 entries[].abilities, G-213; retest 4 T9): Traits rows with dots.
  // The same reading as the full sheet's foot (`powersWithUses`), so the rows the foot leaves out are always here.
  const traitPowers: LimitedAbility[] = setting
    ? powersWithUses(
        pickedTraitAbilities(
          traitSteps(fieldDefs, traitListsOf(setting.all), { layout: layoutHints(setting.all), raceId: character.raceRef, choices: campaignChoices(setting) }),
          character.fields && typeof character.fields === 'object' && !Array.isArray(character.fields) ? (character.fields as Record<string, unknown>) : {},
          new Set(limitedAbilities(figures.klass, figures.race, character.level).map((a) => a.name)),
        ),
      )
    : [];
  // The pack's names and notation, everyone's skills first (sr-2).
  const skills = skillsOf(figures.filled, figures.klass, figures.notes, setting?.rulesSets ?? [], { race: figures.race, raceRef: character.raceRef });
  // The attack figure in the campaign's AC style (A4, bq3-13), with the sheet's breakdown (sr-8).
  const attackField = combatFields(fieldDefs).attack;
  const typedFields = character.fields && typeof character.fields === 'object' && !Array.isArray(character.fields) ? (character.fields as Record<string, unknown>) : {};
  const typedAttack = attackField ? typedFields[attackField.key] : undefined;
  const attack = attackFigures({
    filled: figures.filled,
    direction: figures.acDirectionStated,
    rulesSets: setting?.rulesSets ?? [],
    chosenStyle: setting ? acStyleOf(setting) : null,
    fieldLabel: attackField ? shortLabel(attackField.label) : null,
    typed: typeof typedAttack === 'string' || typeof typedAttack === 'number' ? String(typedAttack) : null,
    shortName: (k) => figures.abilityName(k).short,
    klassName: figures.className,
    level: character.level,
    styleOption: setting ? attackStyleOption(setting) : null,
  });
  // At hand's weapon figures and what the activity buttons need (moved to player/playerFigures.ts, dec-13 C1).
  const { weaponLine, weaponParts, weaponRolls: weaponRollsOf, actorFacts } = playerFigures({ setting, character, figures, targetLabel: attack.label, damageReason, skills, carried });
  const sourceOf = (kind: string, ref: string | null) => {
    const entry = ref ? setting?.all.find((e) => e.kind === kind && e.packEntryId === ref) : undefined;
    return entry ? (setting?.packs.find((p) => p.packId === entry.packId)?.shortName ?? null) : null;
  };
  // The head's words (dec-13 C2, ps-3, ps-5): the name, "the" kindred, the title. For race-as-class the kindred is the
  // one the class names (ruled 2026-10-29). The class and level are the level block's (C3). Without a class, the card
  // line the GM's fields make, as before. In two columns the bar reads them all (frame P1); in one, the bar keeps the
  // name and the head's first line gives the rest (frame P2).
  const title = typeof figures.filled.title === 'string' ? figures.filled.title.trim() : '';
  const kindred = kindredAndTitle(figures.shownRace, title);
  const cardWords = figures.className ? '' : cardLine(fieldDefs, character.fields, character.level, traitLookup(traitListsOf(setting?.all ?? [])));
  const headLine = wide ? cardWords : kindred || cardWords;
  // In the GM's view the Scene is its player's (C15f, pg32-5): whose group, requests and Rest it shows.
  const scenePlayer = view ? (character.ownerUserId ?? user.id) : undefined;
  const top = topRow(wide && current === 'player' ? nameKindredTitle(character.name, figures.shownRace, title) : character.name);

  // The right column's list, Abilities and traits (row P3; page 28): the pinned ones first, in the player's order, then
  // the unpinned traits with uses. Nothing pinned joins At hand any more (euf-3).
  const traitsProps = play && {
    db,
    user,
    character,
    figures,
    play,
    onChanged: () => setPlayVersion((v) => v + 1),
    source: (from: 'class' | 'race') => (from === 'class' ? sourceOf('class', character.classRef) : sourceOf('race', character.raceRef)),
    more: traitPowers,
  };

  // The pins for the hosted sheet (row P3; pg28-3, pg28-7): the pinned names leave the foot's rows' lines, and a pinned
  // one's own pop-up (its entry) ends with Move up and Move down.
  const sheetPins: SheetPins | undefined = play
    ? {
        names: play.pins.filter((p) => p.kind === 'trait').map((p) => p.key),
        star: (name) => <EntryPinStar db={db} user={user} character={character} name={name} pins={play.pins} onChanged={() => setPlayVersion((v) => v + 1)} />,
        moves: (name, names) => {
          const live = pinnedNames(play.pins, [...names, ...traitsWithUses(figures, character.level, traitPowers).map((a) => a.name)]);
          return (
            <PinMoves
              name={name}
              live={live}
              onMove={(from, to) =>
                void movePinTo(db, user, character, play.pins, live, from, to).then((result) => (result.ok ? setPlayVersion((v) => v + 1) : toastMove({ text: result.message, error: true })))
              }
            />
          );
        },
      }
    : undefined;

  // The right column (dec-13 C1, ps-2): the sheet's scores, saves (beside only), movement and load; the traits with
  // uses; the sheet's skills and languages; then the rest of the sheet's rows, on a phone too (tfr-5).
  const rightColumn = (
    <>
      {/* Beside, the notices box at the top, over Scores (frame M1a). */}
      {wide && <div className="player__notices" ref={setNoticesSlot} />}
      <div className="player__slot" ref={setTopSlot} />
      <div className="player__slot" ref={setTraitsSlot} />
      <div className="player__slot" ref={setMoreSlot} />
    </>
  );

  return (
    <section className={wide ? (tab === 'scene' ? 'player player--wide player--solo' : current === 'player' ? 'player player--wide player--play' : 'player player--wide') : 'player'}>
      {top}
      {wide ? (
        // On a landscape tablet the sections are a column whose right edge is the fold's handle (lr-4).
        <div className="player__side">
          <SectionNav label="Main" tabs={playerTabs(magic)} current={current} onSelect={select} collapsed={navCollapsed} />
          <DividerHandle collapsed={navCollapsed} onToggle={setNavFolded} />
        </div>
      ) : (
        <SectionNav label="Main" tabs={phone ? phoneTabs(waiting, magic) : playerTabs(magic)} current={current} onSelect={select} />
      )}
      {logOpen && (
        <LogSheet
          onClose={() => {
            setLogOpen(false);
            logOpener.current?.focus({ preventScroll: true });
          }}
        />
      )}
      {/* Every pop-up on Player and Pack is a Sheet (plan m5b-players-screens-standard A4); Scene keeps its own until
          the sweep. */}
      <SheetScope.Provider value={tab !== 'scene'}>
      <div className={current === 'player' ? 'player__pane player__pane--play' : 'player__pane'}>
        <RetiredBanner db={db} user={user} campaign={campaign} />
        {current === 'player' ? (
          // The left column (dec-13 C1, ps-2): the head, hit points, armour class and attack, At hand (the weapon in
          // hand first), the level block, Details. In one column (a phone, a portrait tablet) the saves sit directly
          // under hit points and armour class (ps-2a), and the right column follows. No party list here (ps-4).
          <>
          {/* The screen's one loading state, or its one error with Try again (dec-13 C11). */}
          {opening && <PlayerStateLine state={{ kind: 'opening' }} />}
          {failed && <PlayerStateLine state={{ kind: 'failed', onTryAgain: tryAgain }} />}
          {/* Every part stays mounted, so its read runs, and hidden until the first open. */}
          <div className="player__opened" hidden={!opened}>
          {/* Offline on the device's stored copy of the rules (ruled 2026-11-07, ⚑ 4 B). */}
          {setting?.asOf && <PlayerStateLine state={{ kind: 'offline', asOf: setting.asOf }} />}
          <TabPopUps>
            <PlayerHead
              db={db}
              user={user}
              character={character}
              line={headLine}
              fixed={wide && !headLine}
              phone={phone}
              book={statuses.book}
              onStatusesChanged={statuses.reload}
              casting={casting}
              onPortraitSaved={onDataChange}
              onOpenLog={() => select('log')}
              notices={wide ? undefined : <div className="player-head__notices" ref={setNoticesSlot} />}
            />
            <PlayerVitals
              db={db}
              user={user}
              character={character}
              fieldDefs={fieldDefs}
              figures={figures}
              attack={attack}
              worn={worn}
              acOverride={play?.acOverride ?? null}
              downAt={downAtOf(setting?.rulesSets ?? [])}
              onSaved={onHpChange}
              onMaxSaved={onDataChange}
              onAcSaved={() => setPlayVersion((v) => v + 1)}
            />
            {!wide && <div className="player__slot" ref={setSavesSlot} />}
            <PlayerAtHand
              key={`at-hand-${readAgain}`}
              db={db}
              user={user}
              campaign={campaign}
              carrierId={character.id}
              light={lightView}
              onChanged={onDataChange}
              weaponLine={weaponLine}
              weaponBreakdown={weaponParts}
              weaponRolls={weaponRollsOf}
              onRead={onPackRead}
            />
            <div className="player__slot" ref={setLevelSlot} />
            <div className="player__slot" ref={setDetailsSlot} />
            {!wide && rightColumn}
            <PlayerSheetParts
              key={`sheet-${readAgain}`}
              db={db}
              user={user}
              characterId={character.id}
              campaignId={character.campaignId}
              notices={noLight ? [noLightNotice(noLight)] : []}
              refreshKey={sheetRefresh}
              onSaved={onSheetSaved}
              beside={wide}
              onPhase={setSheetPhase}
              slots={{ saves: savesSlot, level: levelSlot, details: detailsSlot, top: topSlot, traits: traitsSlot, more: moreSlot, notices: noticesSlot }}
              traits={traitsProps ? (pinnable) => <PlayerTraits {...traitsProps} pinnable={pinnable} /> : undefined}
              pins={sheetPins}
            />
          </TabPopUps>
          </div>
          </>
        ) : current === 'magic' && setting && play ? (
          <MagicTab db={db} user={user} character={character} setting={setting} figures={figures} play={play} onChanged={() => setPlayVersion((v) => v + 1)} />
        ) : tab === 'scene' ? (
          // The players' live table view (B18, M5 gate): the time band, the prompt slot (the rest prompt, a request, a
          // message from the GM: the silent card, B3; No light; the weather), the marching order as tiles with Rest
          // under it (their own group's after a split), then the place; then its few recent log lines.
          // In the GM's view (C15f, pg32-5; M3i) it is the player's Scene: their group, their requests, their Rest.
          <>
            <SceneTime
              db={db}
              user={user}
              campaign={campaign}
              player={scenePlayer}
              tableView={{
                prompts: [
                  <PlayerRequests key="requests" db={db} user={user} campaign={campaign} setting={setting} player={scenePlayer} />,
                  <MessageCard key="message" />,
                  <Darkness key="dark" db={db} campaignId={character.campaignId} characterId={character.id} setting={setting} light={lightView} refresh={logVersion} />,
                ],
                body: (restButton, dark) => <PartyGroups db={db} user={user} campaign={campaign} restButton={restButton} dark={dark} actor={actorFacts} player={scenePlayer} />,
              }}
            />
            <LogView db={db} user={user} campaignId={character.campaignId} recent={RECENT_LINES} />
          </>
        ) : (
          <PackScreen
            db={db}
            user={user}
            campaign={campaign}
            carrierId={character.id}
            light={lightView}
            inBar
            onChanged={onDataChange}
            side={wide ? packSide : null}
            weaponLine={weaponLine}
            weaponBreakdown={weaponParts}
            weaponRolls={weaponRollsOf}
          />
        )}
      </div>
      {/* The right column, for reference (dec-13 C1, ps-2); its pop-ups are Sheets too. */}
      {wide && current === 'player' && (
        <div className="player__aside player__right">
          {/* Hidden with the left until the first open (C11). */}
          <div className="player__opened" hidden={!opened}>
            <TabPopUps>{rightColumn}</TabPopUps>
          </div>
        </div>
      )}
      </SheetScope.Provider>
      {/* The full sheet beside Magic (mockup magic/04, the tablet frame). */}
      {wide && current === 'magic' && (
        <SheetScope.Provider value>
          <div className="player__aside">
            <CharacterSheet db={db} user={user} characterId={character.id} refreshKey={sheetRefresh} {...(onSheetSaved ? { onSaved: onSheetSaved } : {})} />
          </div>
        </SheetScope.Provider>
      )}
      {wide && tab === 'pack' && <div className="player__aside" ref={setPackSide} />}
    </section>
  );
}
