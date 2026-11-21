import type { LibraryPack } from '../modules/library/library.ts';
import type { comparePacks, EntryKind, ReadPack } from '../modules/library/packFile.ts';
import { KIND_WORDS } from '../modules/library/kindWords.ts';
import { clashLines, type ClashPack } from '../modules/library/clashes.ts';
import './LibraryScreen.css';

export { KIND_WORDS };
const ORDER = Object.keys(KIND_WORDS) as EntryKind[];

/** "22 classes, 10 races, 109 items" in a fixed, readable order. */
export function countsLine(counts: Partial<Record<EntryKind, number>>): string {
  return ORDER.filter((kind) => counts[kind])
    .map((kind) => `${counts[kind]} ${KIND_WORDS[kind][counts[kind] === 1 ? 0 : 1]}`)
    .join(', ');
}

/** The preview's word for the pack: "Overlay" for any pack that needs another (`meta.requires`, ruled 2026-11-03), else its kind. */
export function packKindLabel(meta: ReadPack['meta']): string {
  const requires = meta.extra.requires;
  if (requires !== undefined && requires !== null && requires !== '' && !(Array.isArray(requires) && requires.length === 0)) return 'Overlay';
  return meta.kind === 'adventure' ? 'Adventure' : meta.kind === 'homebrew' ? 'Homebrew' : 'Setting';
}

const said = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** A pack's drop-in places (07 `locations`, G-58) as the preview shows them: kept as text until the app reads them. */
export function placesAsText(pack: ReadPack): { key: string; name: string; text: string | null }[] {
  return pack.entries
    .filter((entry) => entry.kind === 'location')
    .map((entry) => {
      const view = entry.data.playerView && typeof entry.data.playerView === 'object' ? (entry.data.playerView as Record<string, unknown>) : {};
      return { key: entry.packEntryId, name: entry.name, text: said(view.text) ?? said(view.description) ?? said(entry.data.description) };
    });
}

export type Preview =
  | { mode: 'import'; pack: ReadPack }
  | { mode: 'update'; target: LibraryPack; pack: ReadPack; diff: ReturnType<typeof comparePacks> };

// What the file holds (or what updating will change), before anything is saved.
export function PackPreview({
  preview,
  busy,
  onSave,
  onCancel,
  attached = [],
}: {
  preview: Preview;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** The packs this one would sit with (the campaign's attached packs): the same item id in two of them is listed (eq-4). */
  attached?: readonly ClashPack[];
}) {
  const { pack } = preview;
  const places = placesAsText(pack);
  // When updating, the pack's own old copy isn't a clash with itself.
  const clashes = clashLines({ name: pack.meta.name, entries: pack.entries }, attached.filter((p) => preview.mode !== 'update' || p.name !== preview.target.name));
  const names = (list: { name: string }[]) =>
    list.length > 8 ? `${list.slice(0, 8).map((e) => e.name).join(', ')} and ${list.length - 8} more` : list.map((e) => e.name).join(', ');
  return (
    <div className="library__preview" role="region" aria-label="Preview">
      <h2 className="library__preview-title">
        {preview.mode === 'import' ? `Import ${pack.meta.name}?` : `Update ${preview.target.name}?`}
      </h2>
      <p className="auth__meta">
        {[pack.meta.version && `Version ${pack.meta.version}`, packKindLabel(pack.meta), pack.meta.source]
          .filter(Boolean)
          .join(', ')}
      </p>
      {preview.mode === 'import' ? (
        <p>{countsLine(pack.counts)}.</p>
      ) : (
        <ul className="library__changes">
          <li>
            <strong>{preview.diff.added.length} added</strong>
            {preview.diff.added.length > 0 && `: ${names(preview.diff.added)}`}
          </li>
          <li>
            <strong>{preview.diff.changed.length} changed</strong>
            {preview.diff.changed.length > 0 && `: ${names(preview.diff.changed)}`}
          </li>
          <li>
            <strong>{preview.diff.removed.length} removed</strong>
            {preview.diff.removed.length > 0 && `: ${names(preview.diff.removed)}`}
          </li>
          <li>{preview.diff.unchanged} unchanged</li>
        </ul>
      )}
      {places.length > 0 && (
        <div className="library__notes">
          <p className="label">Places, kept as text for now</p>
          <ul>
            {places.map((place) => (
              <li key={place.key}>
                <strong>{place.name}</strong>
                {place.text && `: ${place.text}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {clashes.length > 0 && (
        <div className="library__notes">
          <p className="label">Same item id as an attached pack</p>
          <ul>
            {clashes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="auth__meta">The pack on top wins; the other copy stays one tap away in Rules.</p>
        </div>
      )}
      {pack.warnings.length > 0 && (
        <div className="library__notes">
          <p className="label">Good to know</p>
          <ul>
            {pack.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {pack.problems.length > 0 && (
        <div className="library__notes library__notes--problems">
          <p className="label">Skipped</p>
          <ul>
            {pack.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="library__actions">
        <button type="button" className="button-primary" aria-busy={busy} onClick={onSave}>
          {busy ? 'Saving…' : preview.mode === 'import' ? 'Save to your library' : 'Update'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
