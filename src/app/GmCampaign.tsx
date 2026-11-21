import { RulesForCampaign } from './RulesForCampaign.tsx';
import { loadCampaignSettings } from '../core/campaignCommands.ts';
import { companiesOn } from '../core/companies.ts';
import { countWaiting, WaitingForYou } from './WaitingForYou.tsx';
import { SheetChangeCard, type WaitingChange } from './SheetChangeCards.tsx';
import { loadSheetChanges, type SheetChange } from '../modules/characters/sheetChanges.ts';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { createInvite, revokeInvite } from '../core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import {
  characterLabel,
  loadGmCharacters,
  loadPlayers,
  loadPreparedIds,
  loadWaitingInvites,
  whoseIs,
  type GmCharacter,
  type Player,
  type PlayerCharacter,
  type WaitingInvite,
} from '../core/gmCampaign.ts';
import { inviteLink } from '../core/invites.ts';
import type { Db } from '../core/supabase.ts';
import { editCharacter, restoreCharacter, reviewCharacter } from '../modules/characters/commands.ts';
import { languageList, languageText } from '../modules/characters/creationGuide.ts';
import { exceptionsOf, withoutException } from './creationReview.ts';
import { creationShown } from './patronGarb.ts';
import { patronFirstForGm, patronNeededIn } from '../modules/characters/patrons.ts';
import { alignmentNamesOf } from '../modules/characters/whoTheyAre.ts';
import { fieldSummary, loadFieldDefinitions, type FieldDefinition, type FieldValues } from '../modules/characters/fields.ts';
import { CampaignHeading } from './CampaignHeading.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { canShare, copyText, shareLink } from './clipboard.ts';
import { CharacterSheet } from './CharacterSheet.tsx';
import { CompaniesEditor } from './CompaniesEditor.tsx';
import { PackScreen } from './PackScreen.tsx';
import { Portrait } from './Portrait.tsx';
import { RemoveCharacter } from './RemoveCharacter.tsx';
import { GiveCharacter } from './GiveCharacter.tsx';
import { RetireCampaign, RetiredBanner, RetiredRailMark } from './Retired.tsx';
import { SettingRules } from './SettingRules.tsx';
import { registry } from './services.ts';
import { BelowTopRowProvider, TopRow } from './TopRow.tsx';
import { CampaignMenuProvider } from './shellMenu.tsx';
import './GmCampaign.css';
import { LogSheet, useLogVersion } from './campaignLog.tsx';
import { usePhone, useWide } from './useWide.ts';
import { noteTab, tabRestored, tabToRestore } from './placeOnReload.ts';
import { gmPhoneTabs, gmTabs, type GmWaiting } from './navTabs.ts';
import { MenuItem, MenuItems, MoreMenu } from '../ui/MoreMenu.tsx';
import { SectionNav } from '../ui/SectionNav.tsx';
import { useNavCollapsed } from '../ui/navCollapsed.ts';
import { DividerHandle } from '../ui/DividerHandle.tsx';
import { loadCampaignSetting, type CampaignSetting } from './campaignSetting.ts';
import { traitListsOf, traitLookup } from '../modules/characters/traitLists.ts';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { reviewDetails } from './reviewDetails.ts';
import { campaignChoices } from './weaponSetup.ts';
import { penaltyWords, proficiencyFor, weaponSkillsOf } from '../modules/characters/weaponSkills.ts';
import { coinsOf } from '../modules/characters/startingGear.ts';
import { addTypedToHomebrew, typedOnCharacter } from './homebrewAdds.ts';
import { CastingStatus } from './EquipWarning.tsx';
import { ReviewScreen } from '../ui/organisms.tsx';
import { Chip } from '../ui/parts.tsx';
import { GmException } from './GmException.tsx';
import { reviewSections } from './reviewSections.ts';
import { abilityNames } from '../modules/characters/creation.ts';
import { ErrorToast, NoticeToast, useToast } from '../ui/ToastHost.tsx';
import { SkeletonRows } from '../ui/parts.tsx';
import { ViewBand } from '../ui/ViewBand.tsx';
import { loadCharacter, type MyCharacter } from '../core/myCharacters.ts';
import { fieldsInPlay, fieldsOffFor } from '../modules/library/optionGate.ts';
import { characterFigures } from './fromSetting.ts';
import { hasSpells } from './MagicTab.tsx';
import type { PlayerTab } from './navTabs.ts';
import { PlayerScreen } from './PlayerScreen.tsx';
import { PlayerViewContext } from './playerView.ts';
import { LogView } from './LogView.tsx';
import { PartyGroups } from './PartyGroups.tsx';
import { SceneCardProvider } from './sceneCard.tsx';
import { SceneMoveProvider } from './sceneMove.tsx';
import { SceneWaitingProvider } from './sceneWaiting.tsx';
import { SceneTime } from './SceneTime.tsx';
import { BookType } from '../ui/creation.tsx';

/** A tab of the GM's view as the player (page 32): what a row's View sheet, Pack, Magic or Scene opens. */
type ViewTab = Exclude<PlayerTab, 'log'>;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// The GM's Campaign screen: Players and characters, Companies, the Party stash, Setting rules (character fields) and
// the Log. More sections arrive later.
export function GmCampaign({
  db,
  user,
  campaign,
  onBack,
  onRetiredChange,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onBack: () => void;
  /** After retiring or bringing back the campaign: when it was retired, or null. */
  onRetiredChange?: (retiredAt: string | null) => void;
}) {
  const retired = !!campaign.retiredAt;
  const [invites, setInvites] = useState<WaitingInvite[] | null | 'error'>(null);
  const [players, setPlayers] = useState<Player[] | null | 'error'>(null);
  // The GM's own characters (the lead's ruling on #768): after the players' rows, "Yours".
  const [gmCharacters, setGmCharacters] = useState<GmCharacter[]>([]);
  const [version, setVersion] = useState(0);
  // An undo from the log reloads this in place.
  const logVersion = useLogVersion();
  // "Companies: On / Off" (ruled 2026-10-24): off hides the Companies section (nothing is deleted).
  const [withCompanies, setWithCompanies] = useState(true);
  // The setting: its trait lists, so a roster line's trait field shows the entry's name (M5b step 0b), and the classes,
  // so a row offers Magic only to a character with a Magic tab (tfg-2, pg32-1).
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  const traitLists = setting ? traitListsOf(setting.all) : [];
  useEffect(() => {
    let current = true;
    void loadCampaignSettings(db, campaign.id).then((found) => current && setWithCompanies(found === null || companiesOn(found)));
    void loadCampaignSetting(db, user.id, campaign.id).then((found) => current && setSetting(found));
    return () => {
      current = false;
    };
  }, [db, user.id, campaign.id, logVersion]);
  const [inviting, setInviting] = useState(false);
  // Setting rules' "Change rules for this campaign" opens the Optional rules group (ruled 2026-10-26).
  const [rulesFocus, setRulesFocus] = useState(0);
  // The ⋯'s Companies: the Players tab, scrolled to its Companies section.
  const [toCompanies, setToCompanies] = useState(0);
  useEffect(() => {
    if (toCompanies > 0) document.getElementById('gm-companies')?.scrollIntoView?.({ block: 'start' });
  }, [toCompanies]);
  const [reviewed, setReviewed] = useState<string | null>(null);
  // The GM's sections, the same on every device (ruled 2026-10-23): Scene · Players · Rules. The campaign opens on
  // Scene, the GM console (ruled 2026-10-29); Players is one tap away. Players' devices are unchanged.
  // After a reload into a new version, the section the GM was on (placeOnReload.ts).
  const [section, setSection] = useState<'scene' | 'players' | 'rules'>(
    () => tabToRestore<'scene' | 'players' | 'rules'>(campaign.id, ['scene', 'players', 'rules']) ?? 'scene',
  );
  useEffect(() => tabRestored(campaign.id), [campaign.id]);
  useEffect(() => noteTab(campaign.id, section), [campaign.id, section]);
  // B15 (M5 gate): the landscape left column folds to icons, remembered on this device.
  const [navCollapsed, setNavFolded] = useNavCollapsed();
  // The phone's tab bar (Design on #549): Scene, Players, Rules and Log, the waiting count a badge on Players; Log opens
  // the full-screen log, closing it comes back here with focus on Log.
  const phone = usePhone();
  const [logOpen, setLogOpen] = useState(false);
  const logOpener = useRef<HTMLElement | null>(null);
  // Scene's own top-row buttons (the checklist, Procedure, while an expedition is under way; M5 step 6).
  const [sceneActions, setSceneActions] = useState<ReactNode>(null);
  // Players → Party stash, opened like a character's pack.
  const [stashOpen, setStashOpen] = useState(false);
  // Bumped when setting rules add character fields, so the list below shows them.
  const [fieldsVersion, setFieldsVersion] = useState(0);
  // Bumped by the homebrew's "Edit character fields", which opens them in Rules for this campaign (N20).
  const [fieldsFocus, setFieldsFocus] = useState(0);
  // The full sheet: View sheet on a character with no Player tab yet (waiting, sent back, a draft; d5-22).
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  // The GM's view as the player (tfg-1; page 32): a row's View sheet, Pack, Magic or Scene opens it on that tab.
  const [viewing, setViewing] = useState<{ id: string; name: string; tab: ViewTab } | null>(null);
  // Edit in a row's ⋯ (pg32-1): the same Edit screen the player's Edit opens (⚑ 44, the driver's call).
  const [editFor, setEditFor] = useState<string | null>(null);
  // Give to a player… or Remove… chosen in a row's ⋯ (pg32-1): their own sheet and panel, as before.
  const [rowAct, setRowAct] = useState<{ id: string; act: 'give' | 'remove' } | null>(null);
  // Who has a spell prepared: with the class's casting, what gives a Magic tab (tfg-2).
  const [prepared, setPrepared] = useState<ReadonlySet<string>>(new Set());
  const wide = useWide();
  // Waiting for you (2026-10-23; M5 step 12; bq3-8): players' one-offs to approve, requests to answer, bases to pick.
  const [waitingList, setWaitingList] = useState({ oneOffs: 0, bases: 0, requests: 0 });
  const waitingItems = waitingList.oneOffs + waitingList.bases + waitingList.requests;
  // Players' sheet changes waiting for the GM (plan m5b-sheet-revised B6): a score or Max HP on an approved character.
  const [sheetChanges, setSheetChanges] = useState<SheetChange[]>([]);
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  // Whether the field list has loaded (review of #665, nit 4): until it has, no patron reads as closed, so Approve holds
  // (the Conductor's ruling, 2026-11-13: Approve never skips a check).
  const [fieldsLoaded, setFieldsLoaded] = useState(false);
  const reload = () => setVersion((v) => v + 1);
  const waiting = Array.isArray(players)
    ? players.flatMap((player) =>
        player.characters.filter((c) => c.approval === 'pending').map((character) => ({ player, character })),
      )
    : [];
  // Each waiting sheet change with its character's and player's names (from the Players list).
  const waitingChanges: WaitingChange[] = Array.isArray(players)
    ? sheetChanges.flatMap((change) => {
        const owner = players.find((p) => p.characters.some((c) => c.id === change.actorId));
        const character = owner?.characters.find((c) => c.id === change.actorId);
        return owner && character ? [{ change, character: character.name, player: owner.name }] : [];
      })
    : [];
  // What lights the Players tab (plan m5b-sheet-revised PR 2): worked out from what waits, whichever tab is open, so the
  // glow goes out when the lists empty and never on a visit.
  const gmWaiting: GmWaiting = {
    toApprove: waiting.length + waitingChanges.length + waitingList.oneOffs,
    toAnswer: waitingList.requests,
    toPick: waitingList.bases,
  };
  const archived = Array.isArray(players)
    ? players.flatMap((player) => player.characters.filter((c) => c.archived).map((character) => ({ player, character })))
    : [];
  const done = (message: string) => {
    setReviewed(message);
    reload();
  };

  /** Whether a character has a Magic tab (tfg-2), as its Player screen decides it (`hasSpells`). */
  const hasMagicTab = (character: PlayerCharacter | GmCharacter) =>
    !!setting && (prepared.has(character.id) || hasSpells(characterFigures(setting, character, fieldsInPlay(fieldDefs, fieldsOffFor(setting, character))), null));

  /**
   * One character's row on the Players page: a player's ("Sam, joined 12 Oct") or the GM's own ("Yours"). An approved
   * one (page 32, M3a, M3b; pg32-1): View sheet, Pack, Magic (only with a Magic tab) and Scene, each opening the GM's
   * view as the player on that tab, then ⋯ with Edit, Give to a player… and Remove…, ⋯ beside the last door. One with
   * no Player tab yet keeps today's row: View sheet opens the full sheet (d5-22), and Remove… (⚑ 43, not answered).
   */
  const characterRow = (character: PlayerCharacter | GmCharacter, meta: string, everyone: readonly Player[]) => {
    const summary = fieldSummary(fieldDefs, character.fields, { onlyCard: true, lookup: traitLookup(traitLists) });
    const open = character.approval === 'approved' && !character.archived;
    const acting = open && rowAct?.id === character.id ? rowAct.act : null;
    const door = (tab: ViewTab, words: string, label: string) => (
      <button type="button" className="button-secondary button-secondary--small" aria-label={label} onClick={() => setViewing({ id: character.id, name: character.name, tab })}>
        {words}
      </button>
    );
    return (
      <li key={character.id} className="gm__row gm__character-row">
        <Portrait db={db} campaignId={character.campaignId} assetId={character.portraitAssetId} name={character.name} size="small" />
        <span className="gm__row-main">
          <span>
            <span className="gm__row-name">{characterLabel(character)}</span>
            {summary && <span className="gm__meta">, {summary}</span>}
          </span>
          <span className="gm__meta">{meta}</span>
        </span>
        {open ? (
          <span className="gm__character-actions">
            {door('player', 'View sheet', `View ${character.name}'s sheet`)}
            {door('pack', 'Pack', `Open ${character.name}'s pack`)}
            {hasMagicTab(character) && door('magic', 'Magic', `Open ${character.name}'s magic`)}
            {/* At 375 px ⋯ never sits alone on a line: it stays beside the last door (pg32-1). */}
            <span className="gm__last-door">
              {door('scene', 'Scene', `Open ${character.name}'s scene`)}
              <MoreMenu label={`More for ${character.name}`}>
                <MenuItems>
                  <MenuItem icon="quill-ink" onClick={() => setEditFor(character.id)}>
                    Edit
                  </MenuItem>
                  <MenuItem icon="open-palm" onClick={() => setRowAct({ id: character.id, act: 'give' })}>
                    Give to a player…
                  </MenuItem>
                  <MenuItem icon="cancel" onClick={() => setRowAct({ id: character.id, act: 'remove' })}>
                    Remove…
                  </MenuItem>
                </MenuItems>
              </MoreMenu>
            </span>
          </span>
        ) : (
          <span className="gm__character-actions">
            <button type="button" className="button-secondary button-secondary--small" aria-label={`View ${character.name}'s sheet`} onClick={() => setSheetFor(character.id)}>
              View sheet
            </button>
            {character.approval !== 'pending' && <RemoveCharacter db={db} user={user} character={character} campaignName={campaign.name} onDone={done} />}
          </span>
        )}
        {acting === 'give' && (
          <GiveCharacter db={db} user={user} character={character} players={everyone} onChanged={reload} onInvite={() => setInviting(true)} open onClose={() => setRowAct(null)} />
        )}
        {acting === 'remove' && (
          <div className="gm__row-panel">
            <RemoveCharacter db={db} user={user} character={character} campaignName={campaign.name} onDone={done} open onClose={() => setRowAct(null)} />
          </div>
        )}
      </li>
    );
  };

  useEffect(() => {
    let current = true;
    void countWaiting(db, campaign.id).then((found) => current && setWaitingList(found));
    void loadSheetChanges(db, campaign.id, { waiting: true }).then((found) => current && setSheetChanges(found ?? []));
    void loadPreparedIds(db, campaign.id).then((found) => current && setPrepared(found));
    Promise.all([loadWaitingInvites(db, campaign.id), loadPlayers(db, campaign.id), loadFieldDefinitions(db, campaign.id), loadGmCharacters(db, campaign.id)]).then(
      ([foundInvites, foundPlayers, foundFields, foundGm]) => {
        if (!current) return;
        setInvites(foundInvites ?? 'error');
        setPlayers(foundPlayers ?? 'error');
        setGmCharacters(foundGm ?? []);
        setFieldDefs(foundFields ?? []);
        setFieldsLoaded(foundFields !== null);
      },
      () => {
        if (!current) return;
        setInvites('error');
        setPlayers('error');
      },
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, version, section, logVersion]);

  // The GM's campaign items in every ⋯ inside the campaign (N17, ruled 2026-10-28): only what isn't a tab (ruled
  // 2026-10-26): Companies, then This device. Handouts (M5) joins it when it's built, if it isn't a tab. From a
  // sub-screen (the stash, a pack, a sheet) Companies goes back to Players first.
  const campaignItems = withCompanies && (
    <MenuItem
      icon="company"
      onClick={() => {
        setStashOpen(false);
        setSheetFor(null);
        setViewing(null);
        setEditFor(null);
        setSection('players');
        setToCompanies((n) => n + 1);
      }}
    >
      Companies
    </MenuItem>
  );

  // The Compact time strip (DG2): under the top row on every GM screen but Scene (which has the whole strip), shown
  // only while an expedition is under way. Its "Scene ›" comes back to Scene.
  const onScene = section === 'scene' && !stashOpen && !sheetFor && !editFor;
  const compactStrip = onScene ? null : (
    <SceneTime
      db={db}
      user={user}
      campaign={campaign}
      compact
      onOpenScene={() => {
        setStashOpen(false);
        setSheetFor(null);
        setEditFor(null);
        setSection('scene');
      }}
    />
  );

  if (stashOpen) {
    return (
      <CampaignMenuProvider gm={campaignItems}>
      <BelowTopRowProvider below={compactStrip}>
        <section className="gm gm--sub">
          <TopRow back="Players" onBack={() => setStashOpen(false)} />
          {/* The GM's way to the Party stash (2026-10-23): see it, and add loot straight into it. */}
          <PackScreen db={db} user={user} campaign={campaign} carrierId={null} onChanged={reload} />
        </section>
            </BelowTopRowProvider>
    </CampaignMenuProvider>
    );
  }

  if (viewing) {
    // The GM's view as the player (tfg-1; page 32): the character's Player screen, the band under its top row.
    return (
      <CampaignMenuProvider gm={campaignItems}>
        <CharacterView
          db={db}
          user={user}
          campaign={campaign}
          characterId={viewing.id}
          name={viewing.name}
          startTab={viewing.tab}
          fieldDefs={fieldDefs}
          wide={wide}
          who={Array.isArray(players) ? whoseIs(viewing.id, players, gmCharacters) : null}
          onBack={() => {
            setViewing(null);
            reload();
          }}
        />
      </CampaignMenuProvider>
    );
  }

  if (editFor) {
    // Edit from a row's ⋯ (pg32-1; ⚑ 44, the driver's call): the sheet's form straight away, as the player's Edit on
    // Your characters opens it; Save or Cancel comes back to Players with its line.
    const back = (message: string | null) => {
      setEditFor(null);
      if (message) setReviewed(message);
      reload();
    };
    return (
      <CampaignMenuProvider gm={campaignItems}>
        <BelowTopRowProvider below={compactStrip}>
          <CharacterSheet key={editFor} db={db} user={user} characterId={editFor} backLabel="Players" onBack={() => back(null)} onEdited={back} />
        </BelowTopRowProvider>
      </CampaignMenuProvider>
    );
  }

  if (sheetFor) {
    return (
      <CampaignMenuProvider gm={campaignItems}>
      <BelowTopRowProvider below={compactStrip}>
        <CharacterSheet
          db={db}
          user={user}
          characterId={sheetFor}
          backLabel="Players"
          onBack={() => {
            setSheetFor(null);
            reload();
          }}
        />
            </BelowTopRowProvider>
    </CampaignMenuProvider>
    );
  }

  return (
    // The drawer's gear opens the campaign's settings, Rules for this campaign (Design on #549).
    <CampaignMenuProvider gm={campaignItems} settings={() => setSection('rules')}>
      <BelowTopRowProvider below={compactStrip}>
    <section className={navCollapsed ? 'gm gm--nav-collapsed' : 'gm'}>
      {/* The big heading below carries the campaign's name and the way into editing it (2026-10-23). */}
      <TopRow back="Your campaigns" backShort="Campaigns" onBack={onBack} actions={section === 'scene' ? sceneActions : undefined} drawer={campaign.name} logTab />
      <div className="gm__side">
        <CampaignHeading
          db={db}
          user={user}
          campaign={campaign}
          editable={!retired}
          titleClassName="gm__title"
          // Folded, the rail keeps the sigil, which opens the menu (mn-2, ap-17; mockup december/16, frame T13).
          {...(navCollapsed ? { onOpenMenu: () => setNavFolded(false) } : {})}
        />
        <RetiredBanner db={db} user={user} campaign={campaign} onChanged={onRetiredChange} />
        {/* Folded, a retired campaign's mark under the sigil: its words and Bring back in a pop-up (mn-2). */}
        {navCollapsed && <RetiredRailMark db={db} user={user} campaign={campaign} onChanged={onRetiredChange} className="gm__rail-mark" />}

        {/* Players carries a quiet count of what waits for the GM: one-off items and characters to approve. */}
        <SectionNav
          collapsed={navCollapsed}
          label="Campaign sections"
          tabs={phone ? gmPhoneTabs(gmWaiting) : gmTabs(gmWaiting)}
          current={section}
          onSelect={(next) => {
            if (next === 'log') {
              logOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setLogOpen(true);
              return;
            }
            // Leaving Players closes an open "Invite a player" (M4b re-test, 2026-10-26).
            if (next !== section) setInviting(false);
            setSection(next);
          }}
        />
        {logOpen && (
          <LogSheet
            onClose={() => {
              setLogOpen(false);
              logOpener.current?.focus({ preventScroll: true });
            }}
          />
        )}
        {/* The column's right edge folds it to icons (lr-4); only on a landscape tablet. */}
        <DividerHandle collapsed={navCollapsed} onToggle={setNavFolded} />
      </div>
      <div className="gm__main">
        {section === 'scene' ? (
          <>
            {/* The GM console's Explore, as far as M5 step 8 goes: the time strip with the reminder card, the
                encounter table and the reminders, the party's groups and marching order, then a few recent log
                lines. */}
            {/* The time strip leads the party's groups: in a wilderness day on a landscape tablet it heads the day
                controls on the left, beside the location view (M5b step 1 follow-up, build order 7). */}
            {/* A Move…'s checks (alsoWhen) go from the travel card to the time strip's card (build order 8). */}
            {/* Move on (5b-0) runs its moves through the time strip's advance; the GM's place page (5b) mounts it, and
                its "Waiting for you" holds the strip's encounter cards (sceneWaiting.tsx). */}
            <SceneCardProvider>
              <SceneMoveProvider>
                <SceneWaitingProvider>
                <PartyGroups
                  db={db}
                  user={user}
                  campaign={campaign}
                  lead={<SceneTime db={db} user={user} campaign={campaign} onTopActions={setSceneActions} />}
                />
                </SceneWaitingProvider>
              </SceneMoveProvider>
            </SceneCardProvider>
            <LogView db={db} user={user} campaignId={campaign.id} recent={5} />
          </>
        ) : section === 'rules' ? (
          <>
            {/* Rules for this campaign comes first in the Rules tab (B15, ruled 2026-10-25). */}
            {/* Character fields are a group inside it (N20, ruled 2026-10-28). */}
            {/* Retire campaign… sits at its foot (lr-8, ruled 2026-11-02; before: the foot of Setting rules). */}
            <RulesForCampaign
              db={db}
              user={user}
              campaign={campaign}
              focus={rulesFocus}
              fieldsVersion={fieldsVersion}
              fieldsFocus={fieldsFocus}
              foot={!retired && onRetiredChange && <RetireCampaign db={db} user={user} campaign={campaign} onRetired={onRetiredChange} />}
            />
            <h2 className="gm__section-title">Setting rules</h2>
            <SettingRules
              db={db}
              user={user}
              campaign={campaign}
              onFieldsChanged={() => setFieldsVersion((v) => v + 1)}
              onChangeOptions={() => setRulesFocus((n) => n + 1)}
              onEditFields={() => setFieldsFocus((n) => n + 1)}
            />
          </>
        ) : (
          <>
            {/* Players holds what waits for the GM (only when something does, first), players and characters,
                Companies, and the Party stash (2026-10-23). */}
            {waitingItems > 0 && <WaitingForYou db={db} user={user} campaign={campaign} onChanged={reload} />}
            <div className="gm__section-head">
              <h2 className="gm__section-title">Players and characters</h2>
              {!inviting && !retired && (
                <button type="button" className="button-primary" onClick={() => setInviting(true)}>
                  Invite a player
                </button>
              )}
            </div>

            {inviting && (
              <NewInvite
                db={db}
                user={user}
                campaign={campaign}
                onMade={reload}
                onDone={() => {
                  setInviting(false);
                  reload();
                }}
              />
            )}

            {(invites === 'error' || players === 'error') && (
              <>
                <p className="form-error" role="alert">
                  Couldn't load the players and invites. Check your connection and try again.
                </p>
                <button type="button" className="button-secondary" onClick={reload}>
                  Try again
                </button>
              </>
            )}
            {invites === null && players === null && <p role="status">Opening…</p>}

            <NoticeToast message={reviewed} />
            {/* What lit the Players tab leads it (plan m5b-sheet-revised PR 2, step 10): Waiting for you above, then
                Waiting for approval, before the invites not used yet. */}
            {(waiting.length > 0 || waitingChanges.length > 0) && (
              <div className="gm__block">
                <h3 className="label">Waiting for approval</h3>
                {waitingChanges.map((w) => (
                  <SheetChangeCard key={w.change.id} db={db} user={user} waiting={w} onAnswered={reload} />
                ))}
                {waiting.map(({ player, character }) => (
                  // The GM's approval card in the book's type (cs-47), its buttons both plain (cs-25).
                  <BookType key={character.id}>
                  <ApprovalRow
                    db={db}
                    user={user}
                    player={player}
                    character={character}
                    campaignName={campaign.name}
                    fieldDefs={fieldDefs}
                    fieldsLoaded={fieldsLoaded}
                    onReviewed={done}
                  />
                  </BookType>
                ))}
              </div>
            )}

            {Array.isArray(invites) && invites.length > 0 && (
              <WaitingInvites db={db} user={user} campaign={campaign} invites={invites} onChange={reload} />
            )}

            {Array.isArray(players) && (
              <div className="gm__block">
                <h3 className="label">Players</h3>
                {players.length === 0 && <p className="gm__meta">No players yet. Invite someone to get started.</p>}
                {(players.length > 0 || gmCharacters.length > 0) && (
                  <ul className="gm__list">
                    {/* One line per character, naming its player; no player column (ruled 2026-10-26). A player
                        without a character still gets a line, so the GM sees who has joined. */}
                    {players.map((player) => {
                      const shown = player.characters.filter((c) => !c.archived);
                      const joined = `${player.name}, joined ${shortDate(player.joinedAt)}`;
                      if (shown.length === 0)
                        return (
                          <li key={player.userId} className="gm__row">
                            <span className="gm__row-main">
                              <span className="gm__row-name">No character yet</span>
                              <span className="gm__meta">{joined}</span>
                            </span>
                          </li>
                        );
                      return shown.map((character) => characterRow(character, joined, players));
                    })}
                    {/* The GM's own characters, after the players' rows (the lead's ruling on #768): "Yours". */}
                    {gmCharacters.map((character) => characterRow(character, 'Yours', players))}
                  </ul>
                )}
              </div>
            )}

            {archived.length > 0 && (
              <div className="gm__block">
                <h3 className="label">Archived characters</h3>
                <ul className="gm__list">
                  {archived.map(({ player, character }) => (
                    <li key={character.id} className="gm__row">
                      <span className="gm__row-main">
                        <span className="gm__row-name">{character.name}</span>
                        <span className="gm__meta">
                          {player.name}, level {character.level}
                        </span>
                      </span>
                      <span className="gm__actions">
                        <RestoreButton db={db} user={user} character={character} onDone={done} />
                        <RemoveCharacter db={db} user={user} character={character} campaignName={campaign.name} onDone={done} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {withCompanies && (
              <div id="gm-companies">
                <CompaniesEditor db={db} user={user} campaign={campaign} />
              </div>
            )}
            {/* "Inventory" (renamed from "Party stash", ruled 2026-10-24): the Party stash first, then Whose pack. */}
            <button type="button" className="gm__stash-row" onClick={() => setStashOpen(true)}>
              <span className="gm__section-title">Inventory</span>
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>
    </section>
          </BelowTopRowProvider>
    </CampaignMenuProvider>
  );
}

/**
 * The GM's view as the player (page 32, M3c to M3k; tfg-1, pg32-2, pg32-7, pg32-8): the character's own Player screen,
 * hosted here, with the View band under the top row on every tab. Whose view it is comes at once from the Players list
 * (so the band and the top row show while the character reads), and follows it: given to another player while open,
 * the band follows with a toast; removed, a toast and back to Players. A read that fails says so with Try again, and
 * "‹ Players" still goes back.
 */
function CharacterView({
  db,
  user,
  campaign,
  characterId,
  name,
  startTab,
  fieldDefs,
  wide,
  who,
  onBack,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  characterId: string;
  /** The character's name from its row, until the character has read. */
  name: string;
  startTab: ViewTab;
  fieldDefs: FieldDefinition[];
  wide: boolean;
  /** Whose the character is now, from the Players list (null while it can't tell). */
  who: { player: string | null } | 'gone' | null;
  onBack: () => void;
}) {
  const logVersion = useLogVersion();
  const show = useToast();
  const [character, setCharacter] = useState<MyCharacter | null | 'error'>(null);
  const [version, setVersion] = useState(0);
  const [sheetRefresh, setSheetRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    // A later read that fails keeps what was read (offline: the tab reads as last loaded, M3k).
    const failed = () => current && setCharacter((was) => (was && was !== 'error' ? was : 'error'));
    void loadCharacter(db, characterId).then((found) => (found ? current && setCharacter(found) : failed()), failed);
    return () => {
      current = false;
    };
  }, [db, characterId, logVersion, version]);
  const shownName = character && character !== 'error' ? character.name : name;

  // Whose view the band names: the Players list's answer, kept while it can't tell; `moved` once it changed here.
  const [owner, setOwner] = useState<{ player: string | null; moved: boolean }>({ player: who && who !== 'gone' ? who.player : null, moved: false });
  if (who && who !== 'gone' && who.player !== owner.player) setOwner({ player: who.player, moved: true });
  useEffect(() => {
    if (!owner.moved) return;
    // Given away while open (pg32-7a): "Wren is now Robin's."; given back to the GM, page 13's words.
    show({ text: owner.player === null ? `${shownName} is yours again.` : `${shownName} is now ${owner.player}’s.` });
    // Only when the owner changes, not when the name reads again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  const gone = who === 'gone';
  useEffect(() => {
    if (!gone) return;
    // Removed while open (pg32-7b): a toast, and back to Players.
    show({ text: `${shownName} left the campaign.` });
    onBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone]);

  return (
    <PlayerViewContext.Provider value={{ player: owner.player, character: shownName }}>
      <BelowTopRowProvider below={<ViewBand player={owner.player} character={shownName} />}>
        {character && character !== 'error' ? (
          <PlayerScreen
            key={characterId}
            db={db}
            user={user}
            campaign={campaign}
            character={character}
            fieldDefs={fieldDefs}
            startTab={startTab}
            wide={wide}
            sheetRefresh={sheetRefresh}
            onHpChange={() => setSheetRefresh((n) => n + 1)}
            onDataChange={() => {
              setVersion((v) => v + 1);
              setSheetRefresh((n) => n + 1);
            }}
            onSheetSaved={() => setVersion((v) => v + 1)}
            onBack={onBack}
          />
        ) : (
          // Loading and couldn't load (M3k): the top row and the band at once, then still bars, or the warning.
          <section className="player">
            <TopRow back="Players" named onBack={onBack} menuLabel="Character options" title={shownName} logTab standard />
            {character === 'error' ? (
              <div className="gm__view-error">
                <p className="form-error" role="alert">
                  Couldn’t load {shownName}’s sheet.
                </p>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setCharacter(null);
                    setVersion((v) => v + 1);
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <SkeletonRows rows={5} label={`Opening ${shownName}`} />
            )}
          </section>
        )}
      </BelowTopRowProvider>
    </PlayerViewContext.Provider>
  );
}

function RestoreButton({
  db,
  user,
  character,
  onDone,
}: {
  db: Db;
  user: CurrentUser;
  character: PlayerCharacter;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, restoreCharacter, { character });
    setBusy(false);
    if (result.ok) onDone(`${character.name} is back in the campaign (not active; their player can make them active).`);
    else setError(result.message);
  }

  return (
    <>
      <button
        type="button"
        className="button-secondary"
        aria-label={`Restore ${character.name}`}
        aria-busy={busy}
        onClick={() => void restore()}
      >
        Restore
      </button>
      <ErrorToast message={error} />
    </>
  );
}

function NewInvite({
  db,
  user,
  campaign,
  onMade,
  onDone,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onMade: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  async function make(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, createInvite, { campaignId: campaign.id, email: note });
    setBusy(false);
    if (result.ok) {
      setCode(result.value.code);
      onMade();
    } else {
      setError(result.message);
    }
  }

  if (code) {
    return (
      <div className="gm__panel">
        <p>
          Send this link to your player. It works once and expires in 14 days. When they join, they make a character and
          you approve it.
        </p>
        <ShareInvite campaign={campaign} code={code} />
        <button type="button" className="button-secondary button-secondary--small" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form className="gm__panel" onSubmit={make} noValidate>
      <div className="field">
        <label className="label" htmlFor="invite-note">
          Who's it for? (optional)
        </label>
        <input
          id="invite-note"
          className="field__input"
          type="text"
          autoComplete="off"
          maxLength={80}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby="invite-note-hint"
        />
        {/* Remove once invites are emailed (docs/09-decisions-log.md, 2026-10-20). */}
        <p id="invite-note-hint" className="auth__meta">
          We don't email invites yet. Copy or share the link.
        </p>
      </div>
      <ErrorToast message={error} />
      <div className="gm__actions">
        <button type="submit" className="button-secondary" aria-busy={busy}>
          {busy ? 'Making…' : 'Make invite link'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ShareInvite({ campaign, code }: { campaign: OpenCampaign; code: string }) {
  const link = inviteLink(window.location.origin, code);
  const [message, setMessage] = useState<string | null>(null);

  async function copy(text: string, what: string) {
    setMessage((await copyText(text)) ? `${what} copied.` : `Couldn't copy. Select the ${what.toLowerCase()} and copy it by hand.`);
  }

  return (
    <div className="gm__share">
      <p className="gm__link">{link}</p>
      <p>
        Code: <strong className="gm__code">{code}</strong>
      </p>
      <div className="gm__actions">
        <button type="button" className="button-secondary" onClick={() => void copy(link, 'Link')}>
          Copy link
        </button>
        <button type="button" className="button-secondary" onClick={() => void copy(code, 'Code')}>
          Copy code
        </button>
        {canShare() && (
          <button type="button" className="button-secondary" onClick={() => void shareLink(`Join ${campaign.name}`, link)}>
            Share…
          </button>
        )}
      </div>
      {message && (
        <p className="gm__meta" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function WaitingInvites({
  db,
  user,
  campaign,
  invites,
  onChange,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  invites: WaitingInvite[];
  onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function revoke(invite: WaitingInvite) {
    setBusyId(invite.id);
    setError(null);
    const result = await runCommand(registry, db, user, revokeInvite, { campaignId: campaign.id, inviteId: invite.id });
    setBusyId(null);
    if (result.ok) onChange();
    else setError(result.message);
  }

  async function copy(invite: WaitingInvite) {
    const ok = await copyText(inviteLink(window.location.origin, invite.code));
    setCopied(ok ? `Link for ${invite.code} copied.` : "Couldn't copy. Open the invite and copy the link by hand.");
  }

  return (
    <div className="gm__block">
      <h3 className="label">Waiting invites</h3>
      <ul className="gm__list">
        {invites.map((invite) => (
          <li key={invite.id} className="gm__row">
            <span className="gm__row-main">
              <span className="gm__row-name">{invite.note || 'No note'}</span>
              <span className="gm__meta">
                <span className="gm__code">{invite.code}</span>, expires {shortDate(invite.expiresAt)}
              </span>
            </span>
            <span className="gm__actions">
              <button
                type="button"
                className="button-secondary"
                aria-label={`Copy link for ${invite.code}`}
                onClick={() => void copy(invite)}
              >
                Copy link
              </button>
              <button
                type="button"
                className="button-secondary"
                aria-label={`Revoke ${invite.code}`}
                aria-busy={busyId === invite.id}
                onClick={() => void revoke(invite)}
              >
                Revoke
              </button>
            </span>
          </li>
        ))}
      </ul>
      {copied && (
        <p className="gm__meta" role="status">
          {copied}
        </p>
      )}
      <ErrorToast message={error} />
    </div>
  );
}

// One character waiting for the GM: what it is and how it was made (guided creation: class, race, scores with
// what was rolled, starting gear, "Over by" when the shopping went over), then approve it at the level the player
// chose, send it back with a note, or ask for a different level (ruled 2026-10-25; HP is then entered again).
// HP isn't asked at approval (ruled 2026-10-24): it's asked at creation when a sheet layout requires it.
/** What Approve says while the rules it checks against are still loading (the Conductor's ruling, 2026-11-13). */
export const STILL_LOADING = 'Still loading the rules. Try again in a moment.';

function ApprovalRow({
  db,
  user,
  player,
  character,
  campaignName,
  fieldDefs,
  fieldsLoaded,
  onReviewed,
}: {
  db: Db;
  user: CurrentUser;
  player: Player;
  character: PlayerCharacter;
  campaignName: string;
  fieldDefs: FieldDefinition[];
  /** The field list has loaded: Approve holds until it has (nit 4 of #665; the Conductor, 2026-11-13). */
  fieldsLoaded: boolean;
  onReviewed: (message: string) => void;
}) {
  const [sendingBack, setSendingBack] = useState(false);
  const blocked = useBlockedSheet();
  const [askingLevel, setAskingLevel] = useState<number | null>(null);
  const [setting, setSetting] = useState<CampaignSetting | null>(null);
  const [gear, setGear] = useState<InventoryLine[]>([]);
  // Read again after Add to homebrew (cf-6): the entry is then a pick, and the row below it goes.
  const [settingVersion, setSettingVersion] = useState(0);
  useEffect(() => {
    let current = true;
    void Promise.all([loadCampaignSetting(db, user.id, character.campaignId), loadInventory(db, character.campaignId)]).then(([found, inventory]) => {
      if (!current) return;
      setSetting(found);
      setGear(inventory?.lines ?? []);
    });
    return () => {
      current = false;
    };
  }, [db, user.id, character.campaignId, settingVersion]);
  const made = reviewDetails(setting, character, gear);
  // Other… typed at creation (cf-6, ruled 2026-11-02): each with Add to homebrew, the GM's one tap; players never write it.
  const typed = typedOnCharacter(setting, character, fieldDefs);
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  async function addToHomebrew(entry: (typeof typed)[number]) {
    if (!setting || adding) return;
    setAdding(entry.name);
    setError(null);
    const done = await addTypedToHomebrew(db, user, setting, { id: character.campaignId, name: campaignName }, entry);
    setAdding(null);
    if (!done.ok) return setError(done.message);
    setAdded((was) => [...was, entry.name]);
    setSettingVersion((v) => v + 1);
  }
  // A6 (ruled 2026-10-25): the same sections as the player's review, read in order; sections ticked last time
  // are still marked when it comes back.
  const sections = reviewSections({
    name: character.name,
    level: character.level,
    hpMax: character.hpMax,
    backstory: character.backstory,
    fields: character.fields,
    fieldDefs,
    editedFields: character.editedFields,
    // A patron switched off by its option is hidden here, kept on the record (pt-9).
    creation: creationShown(setting, character.creation),
    made,
    flagged: character.reviewSections,
    showHidden: true,
    // The exceptions block above has each reason and Allow it / Take it off; the rows only point at them.
    exceptionsAbove: true,
    abilityName: (key) => abilityNames(setting?.rulesSets ?? [], fieldDefs)(key).long,
    traitLists: traitListsOf(setting?.all ?? []),
    coins: coinsOf(setting?.rulesSets ?? []),
  });
  // B18: the sections the GM ticks as needing work when sending it back.
  const [ticked, setTicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The exceptions first (final drafts D, mockup creation/final/07): each with the pack's reason and Allow it / Take it
  // off. Allow it is the approval itself (Design, 2026-11-07): it settles the exception here, and Approve's log line
  // names what it allowed. Take it off uses the GM's edit (a language only, for now).
  const exceptions = exceptionsOf(creationShown(setting, character.creation));
  // A weapon outside the class carries the setting's penalty once allowed (R3-5): the card says the cost (as-8).
  // Worked out only when a weapon skill is among the exceptions, from the class's proficiency alone (so a class the
  // step offers no weapon still shows the cost; #618 review). The React Compiler memoizes it (a manual useMemo is refused).
  const weaponKlass = exceptions.some((e) => e.step === 'weaponSkills') && setting && character.classRef ? setting.all.find((e) => e.kind === 'class' && e.packEntryId === character.classRef) : undefined;
  const weaponProficiency = setting && weaponKlass ? proficiencyFor(setting.rulesSets, weaponKlass.data, campaignChoices(setting)) : null;
  const weaponCost = weaponProficiency ? penaltyWords(weaponProficiency) : '';
  // A weapon skill exception that is a specialisation says so after the weapon's name (Design, 2026-11-10, #618's ⚑ 2).
  const specialised = weaponSkillsOf(character.weaponSkills).filter((pick) => pick.specialised);
  const specialising = (e: (typeof exceptions)[number]) => e.step === 'weaponSkills' && specialised.some((pick) => pick.itemId === e.entryId);
  const [allowed, setAllowed] = useState<string[]>([]);
  const keyOf = (e: (typeof exceptions)[number]) => `${e.step}:${e.entryId}`;
  const unsettled = exceptions.filter((e) => !allowed.includes(keyOf(e)));
  const languagesKey = fieldDefs.find((f) => f.key.toLowerCase() === 'languages')?.key ?? null;
  async function takeOff(e: (typeof exceptions)[number]) {
    if (busy || !languagesKey) return;
    setBusy(true);
    setError(null);
    const fields = (typeof character.fields === 'object' && character.fields !== null ? character.fields : {}) as FieldValues;
    const left = languageList(fields[languagesKey]).filter((n) => n.trim().toLowerCase() !== e.name.trim().toLowerCase());
    const result = await runCommand(registry, db, user, editCharacter, {
      character,
      changes: { fields: { ...fields, [languagesKey]: languageText(left) }, creation: withoutException(character.creation, e) },
    });
    setBusy(false);
    if (result.ok) onReviewed(`Took ${e.name} off ${character.name}.`);
    else setError(result.message);
  }

  async function approve() {
    if (busy) return;
    // Never disabled: with an exception still open, Approve says what's left to settle.
    if (unsettled.length > 0) return setError(`${unsettled.length} ${unsettled.length === 1 ? 'thing' : 'things'} to settle: Allow it or Take it off first.`);
    // Never approved on a check it couldn't make (the Conductor's ruling, 2026-11-13): until the field list and the
    // setting have loaded, the patron check can't tell which patrons are closed, so Approve says so and waits.
    if (!fieldsLoaded || !setting) return setError(STILL_LOADING);
    // A character that somehow arrived without the patron its class needs is not approved (the lead's ruling, 2026-11-11).
    if (patronNeededIn(setting?.all ?? [], character.classRef, character.creation, alignmentNamesOf(fieldDefs, setting?.rulesSets ?? []))) return setError(patronFirstForGm(character.name, setting?.all.find((e) => e.kind === 'class' && e.packEntryId === character.classRef)?.name ?? ''));
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, reviewCharacter, {
      character,
      decision: 'approved' as const,
      ...(allowed.length > 0 ? { allowed: exceptions.filter((e) => allowed.includes(keyOf(e))).map((e) => e.name) } : {}),
    });
    setBusy(false);
    if (result.ok) onReviewed(`${character.name} approved at level ${character.level}.`);
    else setError(result.message);
  }

  async function sendBack(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await runCommand(
      registry,
      db,
      user,
      reviewCharacter,
      askingLevel !== null ? { character, decision: 'level' as const, level: askingLevel, note, sections: ticked } : { character, decision: 'rejected' as const, note, sections: ticked },
    );
    setBusy(false);
    if (result.ok) onReviewed(`Sent back to ${player.name}${note.trim() ? ' with a note' : ''}. They can edit and send it again.`);
    else setError(result.message);
  }

  return (
    <div className="gm__approval">
      <div className="gm__approval-heading">
        <Portrait db={db} campaignId={character.campaignId} assetId={character.portraitAssetId} name={character.name} />
        <p className="gm__row-name">New character waiting: {character.name}</p>
      </div>
      <p className="gm__meta">
        From {player.name}, {made.way}
      </p>
      <CastingStatus db={db} userId={user.id} campaignId={character.campaignId} actorId={character.id} />
      {exceptions.map((e) => (
        <GmException
          key={keyOf(e)}
          exception={e}
          settled={allowed.includes(keyOf(e))}
          onAllow={() => setAllowed((was) => [...was, keyOf(e)])}
          {...(e.step === 'languages' && languagesKey ? { takeOff: { busy, onTap: () => void takeOff(e) } } : {})}
          specialising={specialising(e)}
          cost={e.step === 'weaponSkills' ? weaponCost : ''}
        />
      ))}
      <ReviewScreen heading={`${character.name}, as made`} sections={sections} />
      {(typed.length > 0 || added.length > 0) && (
        <div className="gm__block" role="group" aria-labelledby={`typed-${character.id}`}>
          <p id={`typed-${character.id}`} className="gm__row-name">
            Typed by {player.name}
          </p>
          <p className="gm__meta">Not in the setting rules. Add to homebrew makes it a pick for the next player; it stays on {character.name} either way.</p>
          <ul className="gm__list">
            {typed.map((entry) => (
              <li key={`${entry.kind}:${entry.name}`} className="gm__row">
                <span className="gm__row-main">
                  <span className="gm__row-name">{entry.name}</span>
                  <span className="gm__meta">{entry.kind === 'language' ? 'Language' : entry.kind === 'weapon' ? 'Weapon skill' : `${entry.listName}${entry.note ? `, ${entry.note}` : ''}`}</span>
                </span>
                <button type="button" className="button-secondary" onClick={() => void addToHomebrew(entry)}>
                  {adding === entry.name ? 'Adding…' : 'Add to homebrew'}
                </button>
              </li>
            ))}
            {added.map((name) => (
              <li key={`added:${name}`} className="gm__row">
                <span className="gm__row-main">
                  <span className="gm__row-name">{name}</span>
                  <span className="gm__meta" role="status">
                    In the campaign’s homebrew now
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sendingBack || askingLevel !== null ? (
        <form className="gm__approval-form" onSubmit={sendBack} noValidate>
          <div className="field" role="group" aria-labelledby={`needs-${character.id}`}>
            <span id={`needs-${character.id}`} className="label">
              What needs work (optional)
            </span>
            <div className="gm__ticks">
              {sections.map((s) => (
                <Chip key={s.id} pressed={ticked.includes(s.id)} onClick={() => setTicked((was) => (was.includes(s.id) ? was.filter((t) => t !== s.id) : [...was, s.id]))}>
                  {ticked.includes(s.id) && <span aria-hidden="true">✓ </span>}
                  {s.title}
                </Chip>
              ))}
            </div>
          </div>
          {askingLevel !== null && (
            <div className="field">
              <label className="label" htmlFor={`level-${character.id}`}>
                Ask for level
              </label>
              <select
                id={`level-${character.id}`}
                className="field__input field__input--short"
                value={askingLevel}
                onChange={(event) => setAskingLevel(Number(event.target.value))}
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Level {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor={`note-${character.id}`}>
              Note for {player.name} (optional)
            </label>
            <textarea
              id={`note-${character.id}`}
              className="field__input field__textarea"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="gm__actions">
            <button
              type="submit"
              className="button-secondary"
              aria-busy={busy}
              onClick={(event) => {
                if (askingLevel !== character.level) return;
                event.preventDefault();
                blocked.explain('Same level', `${character.name} is already level ${character.level}. Choose a different level to ask for.`);
              }}
            >
              {busy ? 'Sending…' : askingLevel !== null ? `Ask for level ${askingLevel}` : 'Send back'}
            </button>
            {blocked.sheet}
            <button
              type="button"
              className="button-secondary button-secondary--small"
              aria-busy={busy}
              onClick={() => {
                setSendingBack(false);
                setAskingLevel(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="gm__actions">
          <button type="button" className="button-secondary" aria-busy={busy} onClick={() => void approve()}>
            {busy ? 'Approving…' : 'Approve'}
          </button>
          <button type="button" className="button-secondary" aria-busy={busy} onClick={() => setSendingBack(true)}>
            Send back
          </button>
          <button type="button" className="button-secondary" aria-busy={busy} onClick={() => setAskingLevel(character.level)}>
            Ask for a different level
          </button>
          <RemoveCharacter db={db} user={user} character={character} campaignName={campaignName} onDone={onReviewed} />
        </div>
      )}
      <ErrorToast message={error} />
    </div>
  );
}
