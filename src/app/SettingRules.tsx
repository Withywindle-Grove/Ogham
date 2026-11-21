import { moved, SortableList } from '../ui/SortableList.tsx';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { asOfWords, forgetCampaignSetting, loadCampaignPacksAndEntries } from './campaignSetting.ts';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { loadCampaignSettings, updateCampaign } from '../core/campaignCommands.ts';
import { ruleGroupPicksOf, withRuleGroupPick } from '../core/campaignSettings.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Json } from '../core/database.types.ts';
import type { Db } from '../core/supabase.ts';
import { loadFieldDefinitions, applySheetLayout } from '../modules/characters/fields.ts';
import {
  attachPack,
  loadCampaignEntries,
  loadCampaignPacks,
  moveSettingRules,
  preferEntry,
  type CampaignEntry,
  type CampaignPack,
  type NewChoice,
} from '../modules/library/campaignPacks.ts';
import { EDITABLE } from '../modules/library/editor.ts';
import { layoutFields } from '../modules/library/sheetLayout.ts';
import { deleteHomebrewEntry, saveHomebrewEntry } from '../modules/library/homebrew.ts';
import { importPack, loadLibrary, loadPackEntries, updatePack, type LibraryPack } from '../modules/library/library.ts';
import { defaultChoices, readOptions } from '../modules/library/options.ts';
import type { EntryKind, PackEntry, ReadPack } from '../modules/library/packFile.ts';
import { missingFromCampaign, notAttachedWords, ruleClashes, withExtends, type RuleSource } from '../modules/library/ruleGroups.ts';
import { metaIdOf } from './CampaignSetupSteps.tsx';
import { entryKey, stackOrder } from '../modules/library/stack.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { RuleClashCallout } from '../ui/ruleRows.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { EntryEditor } from './EntryEditor.tsx';
import { readChosenPack, updatePreview } from './packImport.ts';
import { KIND_WORDS, PackPreview, type Preview } from './PackPreview.tsx';
import { RulesBrowser, type OnPrefer } from './RulesBrowser.tsx';
import { registry } from './services.ts';
import { ChooseOptions, SettingRulesAdd, type Choosing } from './SettingRulesAdd.tsx';
import { SettingRulesPack, type LayoutOffer, type Layouts, type PackNeeds } from './SettingRulesPack.tsx';
import './SettingRules.css';
import { useLogVersion } from './campaignLog.tsx';
import { ErrorToast, NoticeToast } from '../ui/ToastHost.tsx';

// GM: Campaign → Setting rules. The packs this campaign uses (newest on top, one SettingRulesPack each: its
// optional rules, updating from a newer file, removing it from the campaign); adding more from your library or by
// importing a file (SettingRulesAdd); browsing them and making homebrew. Updating shows what will change first;
// the pack stays in your library when removed from a campaign. Adding rules that have optional rules opens them
// first, every one open (even those locked once in the campaign).
export function SettingRules({
  db,
  user,
  campaign,
  onFieldsChanged,
  onChangeOptions,
  onEditFields,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** Character fields were added (from a sheet layout). */
  onFieldsChanged?: () => void;
  /** "Change rules for this campaign": optional rules are chosen only there (ruled 2026-10-26). */
  onChangeOptions?: () => void;
  /** The homebrew's "Edit character fields": opens Character fields in Rules for this campaign (N20). */
  onEditFields?: () => void;
}) {
  const [attached, setAttached] = useState<CampaignPack[] | null | 'error'>(null);
  // When the device's stored copy served offline (perf fix 2b): when it was saved; null online.
  const [asOf, setAsOf] = useState<string | null>(null);
  const [entries, setEntries] = useState<CampaignEntry[]>([]);
  // The campaign's settings (the ruleKey group picks live there) and, after adding a pack that brings a rival rule,
  // the topics with a "New choice for <topic>" to offer (07): the choice in use stays until the GM confirms.
  const [settings, setSettings] = useState<Record<string, Json | undefined>>({});
  const [newChoices, setNewChoices] = useState<NewChoice[]>([]);
  const [library, setLibrary] = useState<LibraryPack[]>([]);
  const [version, setVersion] = useState(0);
  const logVersion = useLogVersion();
  const [busy, setBusy] = useState(false);
  // A move being saved: the list shows the new order at once, and no reload part-way through shows an older one.
  const movingNow = useRef(false);
  const blocked = useBlockedSheet();
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Counts the GM's finished changes: a pack's open optional rules or remove confirm, and the library list, close.
  const [settled, setSettled] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  // The in-app editor: which kind is being made (picking: choosing the kind first), and where to go back to.
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<{ kind: EntryKind; entry?: PackEntry; fromBrowser: boolean } | null>(null);
  // After editing from the browser, the entry it shows again.
  const [reselect, setReselect] = useState<string | undefined>(undefined);
  // "Use this sheet layout": offered right after adding setting rules that have one, from the pack's row, and
  // from the homebrew's contents (which show the character fields; fieldsVersion reloads them once it's used).
  const [layoutFor, setLayoutFor] = useState<LayoutOffer | null>(null);
  const [fieldsVersion, setFieldsVersion] = useState(0);
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  // After "Edit as homebrew": the GM's edit must take effect (ruled 2026-10-24). When a higher homebrew pack has the
  // same entry, or an exception picks another pack for it, ask once.
  const [afterEdit, setAfterEdit] = useState<{ key: string; name: string; higher: CampaignPack | null; exception: CampaignPack | null } | null>(null);

  // Whatever the GM changes here, the Pack screen reads the setting rules afresh afterwards.
  useEffect(() => () => forgetCampaignSetting(campaign.id), [campaign.id]);

  useEffect(() => {
    let current = true;
    // Opening, the kept copy of the setting rules serves (perf fix 2a); after a change made here (`version` moves) it's
    // forgotten first, so the change shows. Changes from the log (another device, an undo) are forgotten by the log.
    if (version > 0) forgetCampaignSetting(campaign.id);
    const packsAndEntries: Promise<[CampaignPack[] | null, CampaignEntry[] | null]> = loadCampaignPacksAndEntries(db, user.id, campaign.id).then(
      // Should either half fail, each is read on its own, as before, so the screen shows what it can.
      (rows) => {
        if (current) setAsOf(rows?.asOf ?? null);
        return rows ? [rows.packs, rows.entries] : Promise.all([loadCampaignPacks(db, campaign.id), loadCampaignEntries(db, campaign.id)]);
      },
    );
    Promise.all([packsAndEntries, loadLibrary(db, user.id), loadCampaignSettings(db, campaign.id)]).then(
      ([[foundPacks, foundEntries], foundLibrary, foundSettings]) => {
        if (!current || movingNow.current) return;
        setAttached(foundPacks ?? 'error');
        setEntries(foundEntries ?? []);
        setLibrary(foundLibrary ?? []);
        setSettings(foundSettings ?? {});
      },
      () => current && setAttached('error'),
    );
    return () => {
      current = false;
    };
  }, [db, user.id, campaign.id, version, logVersion]);

  const done = (message: string) => {
    setNotice(message);
    setProblem(null);
    setPreview(null);
    setSettled((n) => n + 1);
    setChoosing(null);
    setVersion((v) => v + 1);
  };
  const run = async (action: () => Promise<{ ok: boolean; message?: string }>, message: string): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if (result.ok) done(message);
    else setProblem(result.message ?? 'Something went wrong.');
    return result.ok;
  };

  /** Attaches a pack; a rival rule it brings is offered afterwards as "New choice for <topic>" (07). */
  const attach = (packId: string, optionChoices?: Record<string, string>) => async () => {
    const result = await runCommand(registry, db, user, attachPack, { campaignId: campaign.id, packId, optionChoices });
    if (result.ok) setNewChoices(result.value.newChoices);
    return result;
  };

  /** The GM's answer to "New choice for <topic>": that pack's rule now counts for the group (logged as a settings change). */
  async function pickGroup(ruleKey: string, topic: string, packId: string, packName: string, already: boolean) {
    // The choice that already counts: nothing to write, the offer is answered.
    if (already) {
      setNewChoices((all) => all.filter((c) => c.ruleKey !== ruleKey));
      setNotice(`${packName} keeps deciding ${topic} for this campaign.`);
      return;
    }
    const saved = await run(
      () => runCommand(registry, db, user, updateCampaign, { campaignId: campaign.id, settings: withRuleGroupPick(settings, ruleKey, packId) as Json }),
      `${packName} now decides ${topic} for this campaign.`,
    );
    if (saved) setNewChoices((all) => all.filter((c) => c.ruleKey !== ruleKey));
  }

  /** Opens the sheet-layout offer for a pack, if it has a layout. */
  async function offerLayout(packId: string, name: string, packEntries: PackEntry[], inHomebrew = false) {
    const fields = layoutFields(packEntries);
    if (fields.length === 0) return;
    const current = await loadFieldDefinitions(db, campaign.id);
    if (current) setLayoutFor({ packId, name, fields, current, inHomebrew });
  }

  async function applyLayout() {
    if (!layoutFor) return;
    setBusy(true);
    setNotice(null);
    const result = await runCommand(registry, db, user, applySheetLayout, { campaignId: campaign.id, fields: layoutFor.fields });
    setBusy(false);
    if (!result.ok) return setProblem(result.message);
    setLayoutFor(null);
    setProblem(null);
    setNotice(
      result.value === 0
        ? `Nothing to add: the campaign already has every field in ${layoutFor.name}'s sheet layout.`
        : `${result.value === 1 ? 'One field was' : `${result.value} fields were`} added from ${layoutFor.name}'s sheet layout.`,
    );
    setFieldsVersion((v) => v + 1);
    onFieldsChanged?.();
  }

  const attachedIds = new Set(Array.isArray(attached) ? attached.map((p) => p.packId) : []);
  const notYetAttached = library.filter((pack) => !attachedIds.has(pack.id));
  // rq-1: each attached pack whose required packs aren't attached, read from the GM's library (as the attach step does).
  const missing = missingFromCampaign([...attachedIds], library, metaIdOf);

  /** Adds a pack to the campaign, or first opens its optional rules if it has any. */
  async function add(packId: string, name: string, imported: boolean, known?: ReadPack['entries']) {
    setBusy(true);
    setNotice(null);
    const found = known ?? (await loadPackEntries(db, packId));
    setBusy(false);
    if (!found) return setProblem(`Couldn't open ${name}. Check your connection and try again.`);
    // An option extending another (of-1) has no choice of its own: it shows on its base's row in Rules for this campaign.
    const options = readOptions(found).filter((o) => !o.extends);
    if (options.length > 0) {
      setProblem(null);
      setPreview(null);
      return setChoosing({ packId, name, options, choices: defaultChoices(options), imported });
    }
    const added = await run(attach(packId), imported ? `${name} was added to your library and this campaign.` : `${name} was added to this campaign.`);
    if (added) await offerLayout(packId, name, found);
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>): Promise<ReadPack | null> {
    const read = await readChosenPack(event);
    if (!read) return null;
    setNotice(null);
    setProblem(read.ok ? null : read.message);
    return read.ok ? read.pack : null;
  }

  async function startUpdate(target: LibraryPack, event: ChangeEvent<HTMLInputElement>) {
    const pack = await readFile(event);
    if (!pack) return;
    const made = await updatePreview(db, target, pack);
    if (!made.ok) return setProblem(made.message);
    setPreview(made.preview);
  }

  async function saveImport() {
    if (!preview) return;
    setBusy(true);
    if (preview.mode === 'import') {
      const made = await runCommand(registry, db, user, importPack, { pack: preview.pack });
      setBusy(false);
      if (!made.ok) return setProblem(made.message);
      return add(made.value, preview.pack.meta.name, true, preview.pack.entries);
    }
    const updated = await runCommand(registry, db, user, updatePack, {
      packId: preview.target.id,
      ownerUserId: preview.target.ownerUserId,
      pack: preview.pack,
    });
    setBusy(false);
    if (!updated.ok) return setProblem(updated.message);
    done(`${preview.pack.meta.name} was updated.`);
  }

  if (choosing) {
    return (
      <ChooseOptions
        choosing={choosing}
        busy={busy}
        problem={problem}
        onChange={(choices) => setChoosing({ ...choosing, choices })}
        onAdd={async () => {
          const { packId, name } = choosing;
          const added = await run(
            attach(packId, choosing.choices),
            choosing.imported ? `${name} was added to your library and this campaign.` : `${name} was added to this campaign.`,
          );
          const found = added ? await loadPackEntries(db, packId) : null;
          if (found) await offerLayout(packId, name, found);
        }}
        onCancel={() => (choosing.imported ? done(`${choosing.name} was added to your library, not to this campaign.`) : setChoosing(null))}
      />
    );
  }

  // The GM's exception for one entry, from the browser; it stays open and reloads.
  const prefer: OnPrefer = async (entry, campaignPackId) => {
    const result = await runCommand(registry, db, user, preferEntry, { campaignId: campaign.id, key: entry.key, name: entry.name, campaignPackId });
    if (!result.ok) return result.message;
    setVersion((v) => v + 1);
    return null;
  };
  const movable = Array.isArray(attached) && attached.length > 1 && !campaign.retiredAt;
  // "New choice for <topic>" (07): each pack's choice side by side; tapping one makes it the campaign's. Only the
  // topics just added, and only while they still clash.
  const sources: RuleSource[] = Array.isArray(attached)
    ? withExtends(stackOrder(attached).map((link) => ({
        packId: link.packId,
        name: link.name,
        shortName: link.shortName,
        kind: link.kind,
        rules: readOptions(entries.filter((e) => e.kind === 'option' && e.packId === link.packId)),
        choices: link.optionChoices,
      })))
    : [];
  const offered = newChoices.length > 0 ? ruleClashes(sources, ruleGroupPicksOf(settings)).filter((clash) => newChoices.some((c) => c.ruleKey === clash.ruleKey)) : [];
  /**
   * Dragging a pack several places is that many one-step moves (each logged), then one reload. The pack shows in its
   * new place at once; should a save fail, the reload shows the order as saved (the steps before it stay) and the
   * error says why. Whatever happens, the move ends: nothing is left saving, and the list reloads.
   */
  async function moveTo(link: CampaignPack, from: number, to: number) {
    setBusy(true);
    setNotice(null);
    movingNow.current = true;
    setAttached((now) => (Array.isArray(now) ? moved(now, from, to) : now));
    let failure: string | null = null;
    try {
      for (let step = 0; step < Math.abs(to - from); step += 1) {
        const result = await runCommand(registry, db, user, moveSettingRules, { campaignId: campaign.id, campaignPackId: link.id, direction: to < from ? 'up' : 'down' });
        if (!result.ok) {
          failure = result.message;
          break;
        }
      }
    } finally {
      movingNow.current = false;
      setBusy(false);
      setVersion((v) => v + 1);
    }
    setProblem(failure);
  }

  async function saveEntry(kind: EntryKind, data: Record<string, unknown>, fromBrowser: boolean): Promise<string | null> {
    const result = await runCommand(registry, db, user, saveHomebrewEntry, { campaignId: campaign.id, campaignName: campaign.name, kind, data });
    if (!result.ok) return result.message;
    setEditing(null);
    // Does the edit take effect? A higher homebrew pack with the same entry, or an exception for it, would hide it.
    if (Array.isArray(attached)) {
      const key = entryKey({ kind, packEntryId: result.value });
      const order = stackOrder(attached);
      const home = order.findIndex((pack) => pack.campaignHomebrew);
      const higher = order.slice(0, home === -1 ? 0 : home).find((pack) => entries.some((e) => e.packId === pack.packId && entryKey(e) === key)) ?? null;
      const exception = attached.find((pack) => !pack.campaignHomebrew && key in pack.overrides) ?? null;
      if (higher || exception) setAfterEdit({ key, name: String(data.name ?? result.value), higher, exception });
    }
    if (fromBrowser) {
      setReselect(entryKey({ kind, packEntryId: result.value }));
      setVersion((v) => v + 1);
    } else done(`${String(data.name)} was saved in this campaign’s homebrew.`);
    toTop();
    return null;
  }
  async function deleteEntry(entry: PackEntry): Promise<string | null> {
    const result = await runCommand(registry, db, user, deleteHomebrewEntry, { campaignId: campaign.id, kind: entry.kind, packEntryId: entry.packEntryId });
    if (!result.ok) return result.message;
    setVersion((v) => v + 1);
    toTop();
    return null;
  }

  const followUp = afterEdit && Array.isArray(attached) && (
    <Dialog label="Make your edit count?" onClose={() => setAfterEdit(null)}>
      {afterEdit.higher ? (
        <>
          <p>
            {afterEdit.higher.name} also has <strong>{afterEdit.name}</strong> and sits higher, so its version is the one used. Put yours on top?
          </p>
          <div className="setting-rules__actions">
            <button
              type="button"
              className="button-secondary"
              aria-busy={busy}
              onClick={() => {
                const home = attached.find((pack) => pack.campaignHomebrew);
                const order = stackOrder(attached);
                if (home) void moveTo(home, order.indexOf(home), order.indexOf(afterEdit.higher!));
                setAfterEdit(afterEdit.exception ? { ...afterEdit, higher: null } : null);
              }}
            >
              Put yours on top
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setAfterEdit(afterEdit.exception ? { ...afterEdit, higher: null } : null)}>
              Keep the order
            </button>
          </div>
        </>
      ) : afterEdit.exception ? (
        <>
          <p>
            An exception uses {afterEdit.exception.name}’s version of <strong>{afterEdit.name}</strong>. Use your edit instead?
          </p>
          <div className="setting-rules__actions">
            <button
              type="button"
              className="button-secondary"
              aria-busy={busy}
              onClick={() => {
                const home = attached.find((pack) => pack.campaignHomebrew);
                void prefer({ key: afterEdit.key, name: afterEdit.name }, home?.id ?? null);
                setAfterEdit(null);
              }}
            >
              Use your edit
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setAfterEdit(null)}>
              Keep the exception
            </button>
          </div>
        </>
      ) : null}
    </Dialog>
  );

  if (editing) {
    return (
      <div className="setting-rules">
        <EntryEditor
          kind={editing.kind}
          entry={editing.entry}
          entries={entries}
          usedIds={new Set(entries.filter((e) => e.kind === editing.kind).map((e) => e.packEntryId))}
          onSave={(data) => saveEntry(editing.kind, data, editing.fromBrowser)}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  if (browsing && Array.isArray(attached)) {
    const writable = !campaign.retiredAt;
    return (
      <div className="setting-rules">
        <button type="button" className="button-quiet setting-rules__back" onClick={() => setBrowsing(false)}>
          ‹ Setting rules
        </button>
        <RulesBrowser
          entries={entries}
          stack={attached}
          gm
          onPrefer={writable ? prefer : undefined}
          editable={writable ? EDITABLE : []}
          onEdit={(entry) => {
            setReselect(entryKey(entry));
            setEditing({ kind: entry.kind, entry, fromBrowser: true });
          }}
          onDeleteHomebrew={deleteEntry}
          initialSelected={reselect}
          headingLevel={3}
        />
        {followUp}
      </div>
    );
  }

  if (preview) {
    return (
      <div className="setting-rules">
        <PackPreview
          preview={preview}
          busy={busy}
          onSave={() => void saveImport()}
          onCancel={() => setPreview(null)}
          attached={(Array.isArray(attached) ? attached : []).map((p) => ({ name: p.name, entries: entries.filter((e) => e.packId === p.packId) }))}
        />
        <ErrorToast message={problem} />
      </div>
    );
  }

  /** The ▲ line for a pack that needs one not attached (rq-1), and an Attach for each needed pack the library has. */
  const needsOf = (packId: string): PackNeeds | undefined => {
    const found = missing.find((m) => m.packId === packId);
    if (!found) return undefined;
    // Attaching goes the way of From your library (the same command, logged; its optional rules first when it has any).
    // A retired campaign keeps the line and has no Attach, as the page has no add of any kind there (rq-1 departure,
    // agreed in review: nothing in a retired campaign can change).
    const attachable = campaign.retiredAt ? [] : found.needs.flatMap((n) => (n.packId ? [{ packId: n.packId, name: n.name }] : []));
    return { line: notAttachedWords(found), attach: attachable, onAttach: (pack) => void add(pack.packId, pack.name, false) };
  };

  const layouts: Layouts = {
    offer: layoutFor,
    onOffer: (packId, name, packEntries, inHomebrew) => void offerLayout(packId, name, packEntries, inHomebrew),
    onUse: () => void applyLayout(),
    onCancel: () => setLayoutFor(null),
  };
  // Keyed by settled too: once a change is saved, the pack's open optional rules or remove confirm close.
  const renderPack = (link: CampaignPack, all: CampaignPack[]) => (
    <SettingRulesPack
      key={`${link.id}-${settled}`}
      db={db}
      user={user}
      campaign={campaign}
      link={link}
      entries={entries}
      attached={all}
      own={library.find((p) => p.id === link.packId)}
      needs={needsOf(link.packId)}
      busy={busy}
      run={run}
      layouts={layouts}
      fieldsVersion={fieldsVersion}
      retired={Boolean(campaign.retiredAt)}
      onUpdateFile={(target, event) => void startUpdate(target, event)}
      onChangeOptions={onChangeOptions}
      onEditFields={onEditFields}
      onEdit={campaign.retiredAt ? undefined : (entry) => setEditing({ kind: entry.kind, entry, fromBrowser: false })}
    />
  );

  return (
    <div className="setting-rules">
      {followUp}
      {blocked.sheet}
      {/* The result as a toast where the eye is (T1, retest 4), not a line at the top of a long list. */}
      <NoticeToast message={notice} />
      <ErrorToast message={problem} />
      {attached === null && <p role="status">Opening…</p>}
      {attached === 'error' && (
        <p className="form-error" role="alert">
          Couldn't load this campaign's setting rules. Check your connection and try again.
        </p>
      )}
      {Array.isArray(attached) && asOf && (
        // Offline on the device's stored copy (ruled 2026-11-07, ⚑ 4 B): one quiet line, gone when online.
        <p className="gm__meta" role="status">
          {asOfWords(asOf)}
        </p>
      )}
      {Array.isArray(attached) && attached.length === 0 && (
        // The words guide's empty line (06); the character fields are no longer "below" (N20).
        <p className="gm__meta">No setting rules yet. Add your setting to fill them in.</p>
      )}
      {offered.map((clash) => (
        <RuleClashCallout
          key={clash.ruleKey}
          title={`New choice for ${clash.topic}`}
          topic={clash.topic}
          now={{ pack: clash.winner.source.shortName, choice: clash.winner.choiceName }}
          nowNote={clash.picked ? 'kept' : 'on top'}
          offers={clash.offers.map((offer) => ({
            label: `${offer.source.shortName}, ${offer.choiceName}`,
            onOpen: () => void pickGroup(clash.ruleKey, clash.topic, offer.source.packId, offer.source.name, offer === clash.winner && clash.picked),
          }))}
        />
      ))}
      {movable && <p className="gm__meta">When two have the same entry, the higher one wins.</p>}
      {/* The gesture isn't discoverable otherwise (N21, ruled 2026-10-28). */}
      {movable && <p className="gm__meta">Press and hold a row to move it.</p>}

      {Array.isArray(attached) &&
        (movable ? (
          // The stack's order: drag a pack's handle up or down (the higher one wins).
          <SortableList
            items={attached.map((link) => ({ key: link.id, label: link.name, link }))}
            label="Setting rules, top first"
            tallRows
            blocked={busy}
            // While a move saves, a hold says so (never a silent no, 06).
            onBlocked={() => blocked.explain('Still saving', 'The last change is still saving. Move it again in a moment.')}
            onMove={(from, to) => {
              // The campaign's homebrew is its own layer, above every setting pack (ruled 2026-10-24): a move across it
              // is refused out loud (fix-pack-order-drag), never dropped without a word.
              const homebrew = (pack: CampaignPack) => pack.kind === 'homebrew';
              const across = attached.slice(Math.min(from, to), Math.max(from, to) + 1).some((pack) => homebrew(pack) !== homebrew(attached[from]!));
              if (across) return blocked.explain('Can’t move it there', 'Your campaign’s homebrew always sits above the setting rules.');
              void moveTo(attached[from]!, from, to);
            }}
            render={({ link }) => renderPack(link, attached)}
          />
        ) : (
          attached.map((link) => renderPack(link, attached))
        ))}

      <div className="setting-rules__actions">
        {entries.some((entry) => entry.kind !== 'option') && (
          <button
            type="button"
            className="button-secondary button-secondary--small"
            onClick={() => {
              setReselect(undefined);
              setBrowsing(true);
            }}
          >
            Browse these rules
          </button>
        )}
        {!campaign.retiredAt && !picking && (
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setPicking(true)}>
            + New homebrew entry
          </button>
        )}
      </div>
      {picking && (
        <div className="setting-rules__confirm" role="group" aria-label="New homebrew entry">
          <p>What would you like to make? It’s saved in this campaign’s homebrew.</p>
          <div className="setting-rules__actions">
            {EDITABLE.map((kind) => (
              <button
                key={kind}
                type="button"
                className="button-secondary"
                onClick={() => {
                  setPicking(false);
                  setEditing({ kind, fromBrowser: false });
                }}
              >
                {KIND_WORDS[kind][0].charAt(0).toUpperCase() + KIND_WORDS[kind][0].slice(1)}
              </button>
            ))}
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setPicking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!campaign.retiredAt && (
        // Keyed by settled: the library list closes once something is added.
        <SettingRulesAdd
          key={settled}
          notYetAttached={notYetAttached}
          busy={busy}
          onAdd={(pack) => void add(pack.id, pack.name, false)}
          onFile={async (event) => {
            const pack = await readFile(event);
            if (pack) setPreview({ mode: 'import', pack });
          }}
        />
      )}
    </div>
  );

}

/** After saving or deleting an entry, back to the top: the message and the entry are there, not wherever the form was. */
function toTop() {
  // The pretend browser in screen tests can't scroll.
  if (!navigator.userAgent.includes('jsdom')) window.scrollTo({ top: 0 });
}
