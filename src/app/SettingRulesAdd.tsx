import { useId, useState, type ChangeEvent } from 'react';
import type { LibraryPack } from '../modules/library/library.ts';
import type { Choices, OptionalRule } from '../modules/library/options.ts';
import { OptionalRules } from './OptionalRules.tsx';
import { countsLine } from './PackPreview.tsx';
import { ErrorToast } from '../ui/ToastHost.tsx';

/** Setting rules being added that have optional rules: they're picked first. imported: just put in the library. */
export interface Choosing {
  packId: string;
  name: string;
  options: OptionalRule[];
  choices: Choices;
  imported: boolean;
}

// Campaign → Setting rules → "Add more setting rules": from your library (an inline list with Add), or by
// importing a file (previewed first, by Setting rules).
export function SettingRulesAdd({
  notYetAttached,
  busy,
  onAdd,
  onFile,
}: {
  /** The GM's library packs this campaign doesn't use yet. */
  notYetAttached: LibraryPack[];
  busy: boolean;
  onAdd: (pack: LibraryPack) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const importId = useId();
  return (
    <div className="setting-rules__add">
      <p className="label">Add more setting rules</p>
      <p className="gm__meta">From your library, or import a JSON or Markdown file. Newer additions sit on top, under any homebrew.</p>
      {adding ? (
        notYetAttached.length === 0 ? (
          <p className="gm__meta">Everything in your library is already in this campaign.</p>
        ) : (
          <ul className="setting-rules__library">
            {notYetAttached.map((pack) => (
              <li key={pack.id} className="setting-rules__library-row">
                <span className="setting-rules__library-text">
                  <span className="setting-rules__name">{pack.name}</span>
                  <span className="gm__meta">{countsLine(pack.counts)}</span>
                </span>
                <button type="button" className="button-secondary" aria-label={`Add ${pack.name} to this campaign`} aria-busy={busy} onClick={() => onAdd(pack)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      <div className="setting-rules__actions">
        <button type="button" className="button-secondary" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          From your library
        </button>
        <label htmlFor={importId} className="button-secondary setting-rules__file-button">
          Import a file
        </label>
        <input
          id={importId}
          className="setting-rules__file"
          type="file"
          // No "accept" list: on an iPhone, files from Google Drive can show greyed out with one (M4b gate); the import reads and checks the file.
          onChange={onFile}
        />
      </div>
    </div>
  );
}

/** The optional rules of setting rules being added, every one open (even those locked once in the campaign). */
export function ChooseOptions({
  choosing,
  busy,
  problem,
  onChange,
  onAdd,
  onCancel,
}: {
  choosing: Choosing;
  busy: boolean;
  problem: string | null;
  onChange: (choices: Choices) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="setting-rules">
      <h3 className="fields__title">Optional rules for {choosing.name}</h3>
      <p className="gm__meta">Pick them now: some can't change once these rules are in the campaign.</p>
      <OptionalRules options={choosing.options} choices={choosing.choices} attaching onChange={onChange} />
      <ErrorToast message={problem} />
      <div className="setting-rules__actions">
        <button type="button" className="button-secondary" aria-busy={busy} onClick={onAdd}>
          Add to this campaign
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
