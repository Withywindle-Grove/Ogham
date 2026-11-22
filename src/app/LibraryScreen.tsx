import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { EDITABLE } from '../modules/library/editor.ts';
import { deletePack, editPackEntry, importPack, loadLibrary, loadPackEntries, loadPackUses, updatePack, type LibraryPack } from '../modules/library/library.ts';
import type { PackEntry, ReadPack } from '../modules/library/packFile.ts';
import { EntryEditor } from './EntryEditor.tsx';
import { aboutFile } from '../modules/library/aboutFile.ts';
import { loadPackFile } from '../modules/library/exportPack.ts';
import { FIND_FROM, findPacks, groupByKind, holdsLine, KIND_GROUPS, needsLine, sortPacks, usedBy as usedByLine, type PackSort } from '../modules/library/libraryList.ts';
import type { PackKind } from '../modules/library/packFile.ts';
import { ConvertWithAi } from './ConvertWithAi.tsx';
import { downloadJson } from './download.ts';
import { importedWords, matchPicked, missingWords, readChosenPack, savePackPictures, savePicture, updatePreview, type ChosenBundle, type PackPictures, type SavedPack } from './packImport.ts';
import { countsLine, PackPreview, type Preview } from './PackPreview.tsx';
import { RulesBrowser, type BrowsedEntry } from './RulesBrowser.tsx';
import { registry } from './services.ts';
import { TopRow } from './TopRow.tsx';
import './LibraryScreen.css';
import { ErrorToast, NoticeToast } from '../ui/ToastHost.tsx';
import { MenuItem, MenuItems, MoreMenu } from '../ui/MoreMenu.tsx';
import { KindChips, KindGroup, PackRow } from '../ui/packList.tsx';
import { ActionBar, ListRow, RowList, StackedButton, WarningLine } from '../ui/parts.tsx';
import { Dialog } from '../ui/Dialog.tsx';
import { Icon } from '../ui/icons.tsx';
import { readStatBlockLayout } from '../modules/library/statBlockLayout.ts';

/** A bundle just saved with a picture missing (B14; page 24, IM1b): what the panel shows until it is closed. */
interface Imported extends PackPictures {
  saved: SavedPack;
  name: string;
  /** Saved over a pack already in the library ("Updated" over its name, not "Imported"). */
  updated: boolean;
  /** The bundle's own file name. */
  file: string;
  pack: ReadPack;
}

// "Rules library": the packs in your library, grouped by kind with filter chips, sorted by name or last updated, and
// a find field from 8 packs (lr-1, 2026-11-02). Each pack is a Pack row (lr-2) with Browse and Update on it, and a ⋯
// holding Edit pack (homebrew only, ruled 2026-10-25), Export as a pack file, and Delete from your library… (lr-3):
// a plain confirm when no campaign uses it; otherwise a warning naming each campaign and what it loses, then Delete
// for good or Cancel. Import a file shows a preview first; updating shows what will change. "About this file" is
// behind Browse. Attaching packs to a campaign happens on its Campaign screen.
//
// A file may be a bundle, a .zip of the pack and its pictures (B14, p2p-27; mockup december/24, IM1 and IM1b, approved
// 2026-11-18 with fixes): once saved, each map's picture is kept with the pack. Every picture found: no panel, the
// toast "Saltwick Island imported, with 2 maps.". A picture missing: the pack is imported all the same and the panel
// names it, with what it costs and "Add it…" to pick the file.
export function LibraryScreen({ db, user, onBack }: { db: Db; user: CurrentUser; onBack: () => void }) {
  const [bundle, setBundle] = useState<ChosenBundle | null>(null);
  const [imported, setImported] = useState<Imported | null>(null);
  const [packs, setPacks] = useState<LibraryPack[] | null | 'error'>(null);
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ pack: LibraryPack; uses: string[] } | null>(null);
  const [browsing, setBrowsing] = useState<{ pack: LibraryPack; entries: BrowsedEntry[]; uses?: string[]; editing?: PackEntry; shown?: string } | null>(null);
  const [converting, setConverting] = useState(false);
  const [shown, setShown] = useState<PackKind | 'all'>('all');
  const [sort, setSort] = useState<PackSort>('name');
  const [find, setFind] = useState('');
  const importId = useId();
  const findId = useId();

  /** Why a tap on a pack can't go ahead now (never a disabled button), or null when it can. */
  const blocked = (): string | null =>
    preview ? 'Save or cancel the file above first.' : busy ? 'One moment: the last change is still being saved.' : null;
  /** Runs a pack's action, or says why it can't run yet. */
  const guarded = (action: () => void) => () => {
    const why = blocked();
    if (why) return setProblem(why);
    action();
  };

  async function startExport(pack: LibraryPack) {
    setNotice(null);
    setProblem(null);
    setBusy(true);
    const made = await loadPackFile(db, pack.id);
    setBusy(false);
    if (!made || !downloadJson(made.fileName, made.file)) return setProblem(`Couldn't export ${pack.name}. Check your connection and try again.`);
    setNotice(`${pack.name} was saved as ${made.fileName}.`);
  }

  useEffect(() => {
    let current = true;
    loadLibrary(db, user.id).then(
      (found) => current && setPacks(found ?? 'error'),
      () => current && setPacks('error'),
    );
    return () => {
      current = false;
    };
  }, [db, user.id, version]);

  /** Reads the chosen file; a problem with the file itself shows in plain words. */
  async function readFile(event: ChangeEvent<HTMLInputElement>): Promise<ReadPack | null> {
    const read = await readChosenPack(event);
    if (!read) return null;
    setNotice(null);
    setProblem(read.ok ? null : read.message);
    setBundle(read.ok ? (read.bundle ?? null) : null);
    return read.ok ? read.pack : null;
  }

  /** "Add it…" (IM1b): the picked files become the missing maps' pictures; with none left, the panel gives way to the toast. */
  async function addMissing(files: File[]) {
    if (!imported || files.length === 0) return;
    const picked = matchPicked(imported.missing, files);
    if (picked.length === 0) return setProblem(`None of those is a missing picture. Pick ${imported.missing.map((map) => map.file).join(', ')}.`);
    setBusy(true);
    let { found, missing } = imported;
    let failed: string | null = null;
    for (const { map, file } of picked) {
      const why = await savePicture(db, user, imported.saved, map, file);
      if (why) failed = why;
      else {
        found = [...found, map];
        missing = missing.filter((m) => m.id !== map.id);
      }
    }
    setBusy(false);
    setProblem(failed);
    if (missing.length > 0) return setImported({ ...imported, found, missing });
    setImported(null);
    setNotice(importedWords(imported.name, found.length, imported.updated));
  }

  async function startUpdate(target: LibraryPack, event: ChangeEvent<HTMLInputElement>) {
    const pack = await readFile(event);
    if (!pack) return;
    const made = await updatePreview(db, target, pack);
    if (!made.ok) return setProblem(made.message);
    setPreview(made.preview);
  }

  async function startDelete(pack: LibraryPack) {
    setNotice(null);
    setProblem(null);
    setBusy(true);
    const uses = await loadPackUses(db, pack.id);
    setBusy(false);
    if (!uses) return setProblem(`Couldn't check which campaigns use ${pack.name}. Try again.`);
    setDeleting({ pack, uses: uses.map((use) => use.campaignName) });
  }

  async function startBrowse(pack: LibraryPack, edit = false) {
    setNotice(null);
    setProblem(null);
    setBusy(true);
    const [entries, uses] = await Promise.all([loadPackEntries(db, pack.id), edit ? loadPackUses(db, pack.id) : Promise.resolve([])]);
    setBusy(false);
    if (!entries || !uses) return setProblem(`Couldn't open ${pack.name}. Check your connection and try again.`);
    setBrowsing({ pack, entries, uses: edit ? uses.map((use) => use.campaignName) : undefined });
  }

  /** Saves an edit to one of the pack's entries; returns a problem in plain words, or null. */
  async function saveEdit(entry: PackEntry, data: Record<string, unknown>): Promise<string | null> {
    if (!browsing) return null;
    const { pack } = browsing;
    const result = await runCommand(registry, db, user, editPackEntry, { packId: pack.id, ownerUserId: pack.ownerUserId, kind: entry.kind, packEntryId: entry.packEntryId, data });
    if (!result.ok) return result.message;
    const entries = await loadPackEntries(db, pack.id);
    setBrowsing({ ...browsing, entries: entries ?? browsing.entries, editing: undefined, shown: `${entry.kind}/${entry.packEntryId}` });
    setNotice(`Saved. ${usedBy(browsing.uses ?? [], true)}`);
    setVersion((v) => v + 1);
    return null;
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { pack } = deleting;
    setBusy(true);
    const result = await runCommand(registry, db, user, deletePack, { packId: pack.id, ownerUserId: pack.ownerUserId });
    setBusy(false);
    if (!result.ok) return setProblem(result.message);
    setDeleting(null);
    setNotice(`${pack.name} was deleted.`);
    setVersion((v) => v + 1);
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    const result =
      preview.mode === 'import'
        ? await runCommand(registry, db, user, importPack, { pack: preview.pack })
        : await runCommand(registry, db, user, updatePack, {
            packId: preview.target.id,
            ownerUserId: preview.target.ownerUserId,
            pack: preview.pack,
          });
    if (!result.ok) {
      setBusy(false);
      return setProblem(result.message);
    }
    const { name } = preview.pack.meta;
    const updated = preview.mode === 'update';
    let said: string | null = updated ? `${name} was updated.` : `${name} was added to your library.`;
    if (bundle) {
      // The bundle's pictures are kept with the pack: all found, the toast says so; any missing, the panel names it.
      const saved: SavedPack = preview.mode === 'update' ? preview.target : { id: result.value, ownerUserId: user.id };
      const pictures = await savePackPictures(db, user, saved, preview.pack, bundle);
      if (pictures.missing.length > 0) {
        setImported({ saved, name, updated, file: bundle.name, pack: preview.pack, ...pictures });
        said = null;
      } else if (pictures.found.length > 0) said = importedWords(name, pictures.found.length, updated);
    }
    setBusy(false);
    setNotice(said);
    setPreview(null);
    setBundle(null);
    setVersion((v) => v + 1);
  }

  if (converting) return <ConvertWithAi onBack={() => setConverting(false)} />;

  if (browsing?.editing) {
    const { editing } = browsing;
    return (
      <section className="library library--browsing">
        <p className="library__notice" role="status">
          {usedBy(browsing.uses ?? [], false)}
        </p>
        <EntryEditor
          kind={editing.kind}
          entry={editing}
          entries={browsing.entries}
          usedIds={new Set(browsing.entries.filter((e) => e.kind === editing.kind).map((e) => e.packEntryId))}
          onSave={(data) => saveEdit(editing, data)}
          onCancel={() => setBrowsing({ ...browsing, editing: undefined })}
        />
      </section>
    );
  }

  if (browsing) {
    const editable = browsing.uses !== undefined;
    return (
      <section className="library library--browsing">
        <TopRow
          back="Rules library"
          onBack={() => {
            setBrowsing(null);
            setNotice(null);
          }}
        />
        <h1 className="library__title">{browsing.pack.name}</h1>
        <AboutFile pack={browsing.pack} />
        {notice && (
          <p className="library__notice" role="status">
            {notice}
          </p>
        )}
        {editable && !notice && <p className="auth__meta">{usedBy(browsing.uses ?? [], false)} Tap an entry, then Edit.</p>}
        <RulesBrowser
          key={browsing.shown ?? 'list'}
          entries={browsing.entries}
          pack={browsing.pack}
          gm
          ownPack={editable}
          editable={editable ? EDITABLE : []}
          onEdit={editable ? (entry) => setBrowsing({ ...browsing, editing: entry }) : undefined}
          initialSelected={browsing.shown}
          statBlockLayout={readStatBlockLayout(browsing.pack.extraMeta)}
        />
      </section>
    );
  }

  const list = Array.isArray(packs) ? packs : [];
  const present = KIND_GROUPS.map((group) => ({ ...group, count: list.filter((pack) => pack.kind === group.kind).length })).filter((group) => group.count > 0);
  // A kind with nothing left in it (after a delete) shows everything again.
  const showing = shown !== 'all' && present.some((group) => group.kind === shown) ? shown : 'all';
  const names = new Map(list.flatMap((pack) => (typeof pack.extraMeta.id === 'string' ? [[pack.extraMeta.id, pack.name] as const] : [])));
  const found = findPacks(
    list.filter((pack) => showing === 'all' || pack.kind === showing),
    list.length >= FIND_FROM ? find : '',
  );
  const groups = groupByKind(sortPacks(found, sort));

  return (
    <section className="library">
      <TopRow back="Your campaigns" backShort="Campaigns" onBack={onBack} />
      <div className="library__head">
        <h1 className="library__title">Rules library</h1>
        {!preview && (
          // One accent (lr-1): top right on a tablet, the phone's bottom bar on a phone (06).
          <ActionBar>
            <label htmlFor={importId} className="button-primary library__file-button">
              Import a file
            </label>
            <input
              id={importId}
              className="library__file"
              type="file"
              // No "accept" list: on an iPhone, files from Google Drive can show greyed out with one (M4b gate); the import reads and checks the file.
              onChange={async (event) => {
                const pack = await readFile(event);
                if (pack) setPreview({ mode: 'import', pack });
              }}
            />
          </ActionBar>
        )}
      </div>

      {/* The result (added, updated, deleted, saved) as a toast where the eye is (T1, retest 4): the line at the top
          was out of sight after an Update further down the list. */}
      <NoticeToast message={notice} />
      <ErrorToast message={problem} />

      {preview && <PackPreview preview={preview} busy={busy} onSave={() => void save()} onCancel={() => setPreview(null)} />}
      {imported && <ImportedPanel imported={imported} onAdd={(files) => void addMissing(files)} onClose={() => setImported(null)} />}

      {packs === null && <p role="status">Opening…</p>}
      {packs === 'error' && (
        <p className="form-error" role="alert">
          Couldn't load your library. Check your connection and try again.
        </p>
      )}
      {Array.isArray(packs) && packs.length === 0 && !preview && (
        <div className="library__empty">
          <p>Nothing in your library yet.</p>
          <p className="auth__meta">Import a pack file (JSON or Markdown, made with the converter skill or by hand), or convert a book with an AI.</p>
          <button type="button" className="button-secondary button-secondary--small" onClick={() => setConverting(true)}>
            Convert a book with an AI…
          </button>
        </div>
      )}
      {list.length > 0 && (
        <>
          <p className="auth__meta library__own">
            Your own: {list.length === 1 ? '1 pack' : `${list.length} packs`}.{' '}
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setConverting(true)}>
              Convert a book with an AI…
            </button>
          </p>
          <div className="library__tools">
            {list.length >= FIND_FROM && (
              <input
                id={findId}
                className="field__input library__find"
                type="search"
                aria-label="Find a pack"
                placeholder="Find a pack"
                value={find}
                onChange={(event) => setFind(event.target.value)}
              />
            )}
            <KindChips kinds={present} total={list.length} selected={showing} onSelect={setShown} />
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setSort(sort === 'name' ? 'updated' : 'name')}>
              Sort: {sort === 'name' ? 'name' : 'last updated'}
            </button>
          </div>
          {groups.length === 0 && (
            <p className="auth__meta" role="status">
              No pack matches “{find.trim()}”.{' '}
              <button type="button" className="button-secondary button-secondary--small" onClick={() => setFind('')}>
                Clear
              </button>
            </p>
          )}
          {groups.map((group) => (
            <KindGroup key={group.kind} title={group.title} count={group.items.length}>
              {group.items.map((pack) => (
                <LibraryRow
                  key={pack.id}
                  pack={pack}
                  needs={needsLine(pack.requires, names)}
                  confirming={deleting?.pack.id === pack.id}
                  onUpdate={(event) => void startUpdate(pack, event)}
                  onBlockedUpdate={blocked}
                  onBrowse={guarded(() => void startBrowse(pack))}
                  onEdit={pack.kind === 'homebrew' ? guarded(() => void startBrowse(pack, true)) : undefined}
                  onExport={guarded(() => void startExport(pack))}
                  onDelete={guarded(() => void startDelete(pack))}
                  onProblem={setProblem}
                >
                  {deleting?.pack.id === pack.id && (
                    <DeleteConfirm pack={pack} uses={deleting.uses} busy={busy} onDelete={() => void confirmDelete()} onCancel={() => setDeleting(null)} />
                  )}
                </LibraryRow>
              ))}
            </KindGroup>
          ))}
        </>
      )}
    </section>
  );
}

/**
 * The import's result when a picture is missing (B14; page 24, IM1b): a Side sheet, "Imported" over the pack's name;
 * a ticked row for the bundle and what the pack holds, one for the maps whose pictures were found, then each missing
 * picture by its path in the bundle with what it costs. Its one accent, "Add it…", picks the file; the ✕ closes.
 */
function ImportedPanel({ imported, onAdd, onClose }: { imported: Imported; onAdd: (files: File[]) => void; onClose: () => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const { found, missing } = imported;
  const tick = <Icon name="tick" size={20} />;
  return (
    <Dialog side label={imported.name} over={imported.updated ? 'Updated' : 'Imported'} onClose={onClose}>
      <RowList dotted>
        <ListRow icon={tick} title={imported.file} sub={`The pack: ${countsLine(imported.pack.counts)}.`} />
        {found.length > 0 && <ListRow icon={tick} title={`${found.length === 1 ? '1 map' : `${found.length} maps`}: ${found.map((map) => map.title).join(', ')}.`} />}
        {missing.map((map) => (
          // The icon column is kept, empty: the words line up under the ticked rows'.
          <ListRow key={map.id} icon={<span />} title={`${missing.length === 1 ? '1 picture missing' : 'Picture missing'}: ${map.file}`} sub={<WarningLine>{missingWords(map, imported.pack)}</WarningLine>} />
        ))}
      </RowList>
      <div className="sheet-foot">
        <StackedButton icon="easel" label={missing.length === 1 ? 'Add it…' : 'Add them…'} variant="primary" onClick={() => picker.current?.click()} />
        <input
          ref={picker}
          type="file"
          accept="image/*"
          multiple={missing.length > 1}
          hidden
          aria-label={`Choose the missing ${missing.length === 1 ? 'picture' : 'pictures'}: ${missing.map((map) => map.file).join(', ')}`}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            onAdd(files);
          }}
        />
      </div>
    </Dialog>
  );
}

/** One pack in the library: the Pack row with Browse, Update and its ⋯ (lr-2, lr-3). */
function LibraryRow({
  pack,
  needs,
  confirming,
  onUpdate,
  onBlockedUpdate,
  onBrowse,
  onEdit,
  onExport,
  onDelete,
  onProblem,
  children,
}: {
  pack: LibraryPack;
  needs: string;
  /** The delete confirm is open: it stands in for the buttons. */
  confirming: boolean;
  onUpdate: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Why Update can't open the file picker now, or null when it can. */
  onBlockedUpdate: () => string | null;
  onBrowse: () => void;
  /** A homebrew pack's Edit pack (ruled 2026-10-25). */
  onEdit?: () => void;
  onExport: () => void;
  onDelete: () => void;
  onProblem: (problem: string) => void;
  /** The delete confirmation, when open. */
  children?: ReactNode;
}) {
  const id = useId();
  const when = new Date(pack.importedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const uses = usedByLine(pack.usedBy);
  const deleteNote = uses ? `${uses.first}${uses.more > 0 ? ` and ${uses.more} more use it` : ' uses it'}` : undefined;
  return (
    <PackRow
      name={pack.name}
      description={pack.description}
      needs={needs}
      holds={holdsLine(pack.counts, pack.words)}
      usedBy={uses}
      version={pack.version}
      updated={when}
      actions={
        confirming ? undefined : (
          <>
            <button type="button" className="button-secondary" aria-label={`Browse ${pack.name}`} onClick={onBrowse}>
              Browse
            </button>
            <label
              htmlFor={id}
              className="button-secondary library__file-button"
              onClick={(event) => {
                const why = onBlockedUpdate();
                if (!why) return;
                event.preventDefault();
                onProblem(why);
              }}
            >
              Update
            </label>
            <input
              id={id}
              className="library__file"
              type="file"
              // No "accept" list: on an iPhone, files from Google Drive can show greyed out with one (M4b gate); the import reads and checks the file.
              aria-label={`Update ${pack.name} from a file`}
              onChange={onUpdate}
            />
            <MoreMenu label={`More for ${pack.name}`}>
              <MenuItems>
                {onEdit && (
                  <MenuItem icon="edit" onClick={onEdit} sub="Homebrew: change its entries">
                    Edit pack
                  </MenuItem>
                )}
                <MenuItem icon="export" onClick={onExport}>
                  Export as a pack file
                </MenuItem>
                <MenuItem icon="delete" onClick={onDelete} sub={deleteNote}>
                  Delete from your library…
                </MenuItem>
              </MenuItems>
            </MoreMenu>
          </>
        )
      }
    >
      {children}
    </PackRow>
  );
}

/** "About this file", behind Browse (lr-2): what the file says about itself, for whoever made the pack. */
function AboutFile({ pack }: { pack: LibraryPack }) {
  const about = aboutFile(pack.extraMeta);
  if (about.length === 0) return null;
  return (
    <details className="library__about">
      <summary>About this file</summary>
      <dl>
        {about.map((line, index) => (
          <div key={`${line.label}-${index}`}>
            <dt>{line.label}</dt>
            <dd>{line.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** "Used by 2 campaigns: …", said before an edit is saved (and after: "changed in each"). */
function usedBy(campaigns: string[], saved: boolean): string {
  if (campaigns.length === 0) return 'No campaign uses this pack yet.';
  const n = campaigns.length === 1 ? '1 campaign' : `${campaigns.length} campaigns`;
  return saved
    ? `The change applies in ${n} (${campaigns.join(', ')}), and each one's log says so.`
    : `Used by ${n}: ${campaigns.join(', ')}. Saving changes it in each, and each one's log says so.`;
}

/** What a campaign loses with the pack, from what's in it (docs/07-content-packs.md, Deleting). */
function losses(counts: LibraryPack['counts']): string[] {
  const has = (...kinds: (keyof LibraryPack['counts'])[]) => kinds.some((kind) => (counts[kind] ?? 0) > 0);
  const content = [
    has('item') && 'items',
    has('statBlock') && 'monsters',
    has('table', 'treasureType') && 'tables',
    has('spell', 'spellList') && 'spells',
  ].filter((word): word is string => Boolean(word));
  return [
    has('option') && 'its optional rules, and the choices made',
    has('class', 'race') && "the rules behind characters' classes and races (characters keep their names)",
    content.length > 0 && `its ${content.length === 1 ? content[0] : `${content.slice(0, -1).join(', ')} and ${content.at(-1)}`}`,
    'everything else in it',
  ].filter((line): line is string => Boolean(line));
}

// Deleting is for good. When campaigns use the pack, it says which and what they lose, and asks for its name.
function DeleteConfirm({
  pack,
  uses,
  busy,
  onDelete,
  onCancel,
}: {
  pack: LibraryPack;
  uses: string[];
  busy: boolean;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="library__confirm" role="group" aria-label={`Delete ${pack.name}`}>
      {uses.length === 0 ? (
        <p>
          Delete <strong>{pack.name}</strong> from your library for good? No campaign uses it.
        </p>
      ) : (
        <>
          <p>
            <strong>{pack.name}</strong> is used by {uses.length === 1 ? 'a campaign' : `${uses.length} campaigns`}: {uses.join(', ')}. Deleting it
            removes it from {uses.length === 1 ? 'that campaign' : 'each of them'} for good, with:
          </p>
          <ul className="library__losses">
            {losses(pack.counts).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>{uses.length === 1 ? "The campaign's log" : "Each campaign's log"} will say it was deleted. This can't be undone.</p>
        </>
      )}
      <div className="library__actions">
        <button type="button" className="button-secondary" aria-busy={busy} onClick={onDelete}>
          {busy ? 'Deleting…' : 'Delete for good'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
