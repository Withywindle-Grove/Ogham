import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { shownEntryName } from '../core/storedWords.ts';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { loadFieldDefinitions, type FieldDefinition, type LayoutField } from '../modules/characters/fields.ts';
import { detachPack, type CampaignEntry, type CampaignPack } from '../modules/library/campaignPacks.ts';
import { EDITABLE } from '../modules/library/editor.ts';
import { copyHomebrewToLibrary, type LibraryPack } from '../modules/library/library.ts';
import { readOptions } from '../modules/library/options.ts';
import { packFile } from '../modules/library/exportPack.ts';
import type { EntryKind, PackEntry } from '../modules/library/packFile.ts';
import { layoutFields } from '../modules/library/sheetLayout.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { describeField } from './FieldsEditor.tsx';
import { downloadJson } from './download.ts';
import { countsLine, KIND_WORDS } from './PackPreview.tsx';
import { registry } from './services.ts';
import { MoreMenu } from '../ui/MoreMenu.tsx';
import { CloseButton, WarningLine } from '../ui/parts.tsx';

/** Runs a command, then shows its message (true) or its problem (false). */
export type Run = (action: () => Promise<{ ok: boolean; message?: string }>, message: string) => Promise<boolean>;

/** "Use this sheet layout" before it's used; inHomebrew: opened from the homebrew's contents, and shown there. */
export interface LayoutOffer {
  packId: string;
  name: string;
  fields: LayoutField[];
  current: FieldDefinition[];
  inHomebrew?: boolean;
}

/**
 * A pack's required packs not attached to the campaign (rq-1): the ▲ line's words, and an "Attach <Other>" for each
 * needed pack in the GM's library (none when the library hasn't got it: the line says to import it first).
 */
export interface PackNeeds {
  line: string;
  attach: { packId: string; name: string }[];
  onAttach: (pack: { packId: string; name: string }) => void;
}

/** What the sheet-layout offer needs from Setting rules. */
export interface Layouts {
  offer: LayoutOffer | null;
  /** Opens the offer for a pack (if it has a layout). */
  onOffer: (packId: string, name: string, packEntries: PackEntry[], inHomebrew?: boolean) => void;
  onUse: () => void;
  onCancel: () => void;
}

// One pack in Campaign → Setting rules: its version and counts, its optional rules, updating it from a newer
// file, its sheet layout, and removing it from the campaign (the campaign's own homebrew too, ruled 2026-10-24).
// A homebrew pack's ⋯ has Export as pack file, and the campaign's own also Copy to Rules library (an independent
// copy, ruled 2026-10-25); the campaign's own also opens to show what's in it, with the campaign's character
// fields (see HomebrewContents).
export function SettingRulesPack({
  db,
  user,
  campaign,
  link,
  entries,
  attached,
  own,
  needs,
  busy,
  run,
  layouts,
  fieldsVersion,
  retired = false,
  onUpdateFile,
  onEdit,
  onChangeOptions,
  onEditFields,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  link: CampaignPack;
  /** Every entry in the campaign's setting rules. */
  entries: CampaignEntry[];
  /** Every pack in the campaign's setting rules (the homebrew offers their sheet layouts). */
  attached: CampaignPack[];
  /** The same pack in the GM's library, if it's theirs (it can then be updated from a file). */
  own: LibraryPack | undefined;
  /** Its required packs not attached here (rq-1); absent when none is missing. */
  needs?: PackNeeds;
  busy: boolean;
  run: Run;
  layouts: Layouts;
  /** Changes when Setting rules adds character fields. */
  fieldsVersion: number;
  /** The campaign is retired: nothing in it can change, so the row offers no Update, Remove… or ⋯ (as the page). */
  retired?: boolean;
  onUpdateFile: (target: LibraryPack, event: ChangeEvent<HTMLInputElement>) => void;
  /** Open one of the homebrew's entries in the editor (tapped in "What's in it"; not in a retired campaign). */
  onEdit?: (entry: CampaignEntry) => void;
  /** Opens the Optional rules in Rules for this campaign. */
  onChangeOptions?: () => void;
  /** Opens Character fields in Rules for this campaign (N20). */
  onEditFields?: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const packEntries = entries.filter((e) => e.packId === link.packId);
  const options = readOptions(packEntries);
  const changed = options.filter((o) => (link.optionChoices[o.id] ?? o.defaultChoice) !== o.defaultChoice).length;
  const counts: Partial<Record<EntryKind, number>> = {};
  for (const entry of packEntries) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  const { offer } = layouts;

  return (
    <div className="setting-rules__pack">
      <div className="setting-rules__head">
        <span className="setting-rules__name">{link.name}</span>
      </div>
      <span className="gm__meta">{[link.version && `Version ${link.version}`, countsLine(counts)].filter(Boolean).join(', ')}</span>
      {needs && (
        // rq-1: never a silent block. The campaign works as before; the line stays until the pack is attached or this one removed.
        <>
          <p>
            <WarningLine>{needs.line}</WarningLine>
          </p>
          {needs.attach.length > 0 && (
            // The page's action row: the token gap between buttons, wrapping on a phone.
            <div className="setting-rules__actions">
              {needs.attach.map((pack) => (
                <button key={pack.packId} type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => needs.onAttach(pack)}>
                  Attach {pack.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {offer?.packId === link.packId && !offer.inHomebrew && (
        <SheetLayoutOffer offer={offer} busy={busy} onUse={layouts.onUse} onCancel={layouts.onCancel} />
      )}
      {showOptions ? (
        // Read-only here: optional rules are chosen only in Rules for this campaign (ruled 2026-10-26).
        <div className="setting-rules__options" role="group" aria-label={`Optional rules for ${link.name}`}>
          <CloseButton className="setting-rules__options-close" onClose={() => setShowOptions(false)} />
          <ul className="setting-rules__option-list">
            {options.map((o) => {
              const chosen = link.optionChoices[o.id] ?? o.defaultChoice;
              return (
                <li key={o.id}>
                  <span className="label">{o.name}</span> {o.choices.find((c) => c.id === chosen)?.name ?? chosen}
                  {chosen !== o.defaultChoice && <span className="auth__meta">, changed from default</span>}
                </li>
              );
            })}
          </ul>
          <div className="setting-rules__actions">
            {onChangeOptions && (
              <button type="button" className="button-secondary" onClick={onChangeOptions}>
                Change rules for this campaign
              </button>
            )}
          </div>
        </div>
      ) : removing ? (
        <div className="setting-rules__confirm" role="group" aria-label={`Remove ${link.name}`}>
          {link.campaignHomebrew ? (
            <p>
              Remove <strong>{link.name}</strong> from this campaign?
              {packEntries.length > 0 ? ` Its ${packEntries.length === 1 ? 'entry stops' : `${packEntries.length} entries stop`} applying here.` : ''} Saving
              homebrew again brings it back, with what was in it.
            </p>
          ) : (
            <p>
              Remove <strong>{link.name}</strong> from this campaign? Its optional rules go with it. It stays in your
              library, and you can add it back.
            </p>
          )}
          <div className="setting-rules__actions">
            <button
              type="button"
              className="button-secondary"
              aria-busy={busy}
              onClick={() =>
                void run(
                  () => runCommand(registry, db, user, detachPack, { campaignId: campaign.id, campaignPackId: link.id }),
                  `${link.name} was removed from this campaign.`,
                )
              }
            >
              Remove
            </button>
            <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => setRemoving(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="setting-rules__actions">
          {link.campaignHomebrew && (
            <button type="button" className="button-secondary button-secondary--small" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
              What's in it
            </button>
          )}
          {options.length > 0 && (
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setShowOptions(true)}>
              Optional rules{changed > 0 ? `, ${changed} changed` : ''}
            </button>
          )}
          {own && !retired && <UpdateButton pack={own} busy={busy} onFile={(event) => onUpdateFile(own, event)} />}
          {offer?.packId !== link.packId && layoutFields(packEntries).length > 0 && (
            <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => layouts.onOffer(link.packId, link.name, packEntries)}>
              Sheet layout…
            </button>
          )}
          {!retired && link.kind === 'homebrew' && packEntries.length > 0 && (
            <MoreMenu label={`${link.name} options`}>
              <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => exportPack(link, packEntries)}>
                Export as pack file
              </button>
              {link.campaignHomebrew && (
                <button
                  type="button"
                  className="button-secondary button-secondary--small"
                  aria-busy={busy}
                  onClick={() =>
                    void run(
                      () => runCommand(registry, db, user, copyHomebrewToLibrary, { campaignId: campaign.id, packId: link.packId, name: link.name }),
                      `Copied to your Rules library as “${link.name} (copy)”.`,
                    )
                  }
                >
                  Copy to Rules library
                </button>
              )}
            </MoreMenu>
          )}
          {!retired && (
            <button type="button" className="button-secondary button-secondary--small" aria-label={`Remove ${link.name} from this campaign`} onClick={() => setRemoving(true)}>
              Remove…
            </button>
          )}
        </div>
      )}
      {link.campaignHomebrew && open && (
        <HomebrewContents
          id={panelId}
          db={db}
          campaign={campaign}
          name={link.name}
          packEntries={packEntries}
          withLayouts={attached.filter((pack) => layoutFields(entries.filter((e) => e.packId === pack.packId)).length > 0)}
          entries={entries}
          busy={busy}
          layouts={layouts}
          fieldsVersion={fieldsVersion}
          onEdit={onEdit}
          onEditFields={onEditFields}
        />
      )}
    </div>
  );
}

/**
 * The homebrew opened (ruled 2026-10-23): its entries, then the campaign's character fields (read only here,
 * with a way to the editor below), and "Use this sheet layout" for any setting rules that have one, so
 * everything about the sheet's shape is in one place.
 */
function HomebrewContents({
  id,
  db,
  campaign,
  name,
  packEntries,
  withLayouts,
  entries,
  busy,
  layouts,
  fieldsVersion,
  onEdit,
  onEditFields,
}: {
  id: string;
  db: Db;
  campaign: OpenCampaign;
  name: string;
  packEntries: CampaignEntry[];
  withLayouts: CampaignPack[];
  entries: CampaignEntry[];
  busy: boolean;
  layouts: Layouts;
  fieldsVersion: number;
  onEdit?: (entry: CampaignEntry) => void;
  onEditFields?: () => void;
}) {
  const [fields, setFields] = useState<FieldDefinition[] | null | 'error'>(null);

  useEffect(() => {
    let current = true;
    loadFieldDefinitions(db, campaign.id).then(
      (found) => current && setFields(found ?? 'error'),
      () => current && setFields('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, fieldsVersion]);

  // The editor is the Character fields group in Rules for this campaign, above (N20): this opens it there.
  const editFields = () => onEditFields?.();

  const { offer } = layouts;
  return (
    <div id={id} className="setting-rules__homebrew" role="region" aria-label={`What's in ${name}`}>
      {packEntries.length === 0 ? (
        <p className="gm__meta">No entries yet.</p>
      ) : (
        <ul className="setting-rules__entries">
          {packEntries.map((entry) => (
            <li key={`${entry.kind}:${entry.packEntryId}`}>
              {/* Tap an entry to edit it (ruled 2026-10-24): opening a thing, so the row with › (fl-1), not underlined. */}
              {onEdit && EDITABLE.includes(entry.kind) ? (
                <button type="button" className="setting-rules__entry" onClick={() => onEdit(entry)}>
                  {shownEntryName(entry)}
                  <span className="gm__meta">, {KIND_WORDS[entry.kind][0]}</span>{' '}
                  <span aria-hidden="true">›</span>
                </button>
              ) : (
                <>
                  {shownEntryName(entry)}
                  <span className="gm__meta">, {KIND_WORDS[entry.kind][0]}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="label">Character fields</h3>
      {fields === null && <p role="status">Opening…</p>}
      {fields === 'error' && (
        <p className="form-error" role="alert">
          Couldn't load the fields. Check your connection and try again.
        </p>
      )}
      {Array.isArray(fields) &&
        (fields.length === 0 ? (
          <p className="gm__meta">No character fields yet.</p>
        ) : (
          <ul className="setting-rules__entries" aria-label="Character fields">
            {fields.map((field) => (
              <li key={field.id}>
                {field.label}
                <span className="gm__meta">, {[describeField(field), field.hidden ? 'hidden' : ''].filter(Boolean).join(', ')}</span>
              </li>
            ))}
          </ul>
        ))}
      {offer?.inHomebrew && <SheetLayoutOffer offer={offer} busy={busy} onUse={layouts.onUse} onCancel={layouts.onCancel} />}
      <div className="setting-rules__actions">
        <button type="button" className="button-secondary" onClick={editFields}>
          Edit character fields
        </button>
        {!offer?.inHomebrew &&
          withLayouts.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className="button-secondary"
              aria-label={withLayouts.length > 1 ? `Use this sheet layout: ${pack.name}` : undefined}
              aria-busy={busy}
              onClick={() => layouts.onOffer(pack.packId, pack.name, entries.filter((e) => e.packId === pack.packId), true)}
            >
              Use this sheet layout
            </button>
          ))}
      </div>
    </div>
  );
}

function UpdateButton({ pack, busy, onFile }: { pack: LibraryPack; busy: boolean; onFile: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const id = useId();
  const blocked = useBlockedSheet();
  return (
    <span className="setting-rules__update">
      {blocked.sheet}
      <label htmlFor={id} className="button-secondary button-secondary--small setting-rules__file-button">
        Update from a new file
      </label>
      <input
        id={id}
        className="setting-rules__file"
        type="file"
        // No "accept" list: on an iPhone, files from Google Drive can show greyed out with one (M4b gate); the import reads and checks the file.
        aria-label={`Update ${pack.name} from a new file`}
        // While the last update saves, a new file waits and says so (never a disabled control, 06; review, #561).
        onChange={(event) => {
          if (!busy) return onFile(event);
          event.target.value = '';
          blocked.explain('Still saving', `The last change to ${pack.name} is still saving. Pick the file again in a moment.`);
        }}
      />
    </span>
  );
}

const FIELD_WORDS: Record<string, string> = { number: 'number', text: 'text', longtext: 'long text', checkbox: 'yes/no', list: 'list' };

/** A pack's sheet layout, field by field, before the GM uses it; fields the campaign already has are kept. */
function SheetLayoutOffer({ offer, busy, onUse, onCancel }: { offer: LayoutOffer; busy: boolean; onUse: () => void; onCancel: () => void }) {
  const have = new Set(offer.current.map((f) => f.label.toLowerCase()));
  return (
    <div className="setting-rules__options" role="group" aria-label={`Sheet layout of ${offer.name}`}>
      <p>
        <strong>{offer.name}</strong> has a sheet layout. Use it for this campaign's characters? Fields you made yourself stay as they are.
      </p>
      <ul className="setting-rules__layout">
        {offer.fields.map((field, index) => {
          const label = (field.label ?? field.key ?? '').trim();
          return (
            <li key={`${label}-${index}`}>
              {label}
              <span className="gm__meta">
                {', '}
                {[FIELD_WORDS[(field.type ?? '').toLowerCase()] ?? 'text', field.group, have.has(label.toLowerCase()) ? 'already here' : '']
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="setting-rules__actions">
        <button type="button" className="button-secondary" aria-busy={busy} onClick={onUse}>
          Use this sheet layout
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onCancel}>
          Not now
        </button>
      </div>
    </div>
  );
}

/**
 * A homebrew pack as a pack file (ruled 2026-10-24): its entries by kind, with a meta.id from its name, and no
 * campaign state. The GM's copy of the entries includes their GM-only parts.
 */
function exportPack(link: CampaignPack, entries: CampaignEntry[]) {
  const { fileName, file } = packFile({ name: link.name, version: link.version, kind: 'homebrew' }, entries);
  downloadJson(fileName, file);
}
