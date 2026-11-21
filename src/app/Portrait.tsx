import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { fileLinks } from '../core/files.ts';
import { sigilLetter } from '../core/myCampaigns.ts';
import type { Db } from '../core/supabase.ts';
import { PhotoError, shrinkImage } from './image.ts';
import './Portrait.css';
import { useErrorToast } from '../ui/ToastHost.tsx';

/** `head`: the Player screen's head, 64 px (dec-13 C2, frame P1: "a larger portrait"). */
export type Size = 'small' | 'medium' | 'head' | 'large';

/** A round picture (a character's portrait or a campaign's sigil), or the name's first letter when there's none (or while it loads). */
export function Portrait({
  db,
  campaignId,
  assetId,
  name,
  size = 'medium',
  previewUrl,
  initials,
}: {
  db: Db;
  campaignId: string;
  assetId: string | null;
  name: string;
  size?: Size;
  /** A picture chosen on this device but not uploaded yet. */
  previewUrl?: string | null;
  /** The letters shown with no picture, in place of the name's first letter (the party circle's clashing initials, mc-5). */
  initials?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const path = assetId ? `${campaignId}/${assetId}` : null;

  useEffect(() => {
    if (!path) return;
    let current = true;
    fileLinks(db, [path]).then(
      (links) => current && setUrl(links.get(path) ?? null),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [db, path]);

  const shown = previewUrl ?? (path ? url : null);
  return (
    <span className={`portrait portrait--${size}`} aria-hidden="true">
      {shown ? <img className="portrait__img" src={shown} alt="" /> : (initials ?? sigilLetter(name))}
    </span>
  );
}

/** A picture chosen for upload: the shrunk file and a preview link (or a request to remove the current one). */
export type PortraitChoice = { blob: Blob; previewUrl: string } | 'remove' | null;

// "Add a portrait (optional)": the design's dashed box; once chosen, a preview with Change and Remove.
// Also used for the campaign's sigil.
export function PortraitPicker({
  db,
  campaignId,
  name,
  currentAssetId,
  choice,
  onChoice,
  noun = 'portrait',
}: {
  db: Db;
  campaignId: string;
  name: string;
  currentAssetId: string | null;
  choice: PortraitChoice;
  onChoice: (choice: PortraitChoice) => void;
  noun?: 'portrait' | 'sigil';
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const setError = useErrorToast();
  const blocked = useBlockedSheet();

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await shrinkImage(file);
      onChoice({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch (problem) {
      setError(problem instanceof PhotoError ? problem.message : "Couldn't read that picture. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  const hasPicture = choice !== 'remove' && (choice !== null || currentAssetId !== null);
  const input = (
    <input id={id} className="portrait-picker__file" type="file" accept="image/*" onChange={(e) => (busy ? blocked.explain('Still preparing', 'The last picture is still being prepared. Pick this one again in a moment.') : void choose(e))} />
  );

  return (
    <div className="portrait-picker">
      {blocked.sheet}
      {hasPicture ? (
        <div className="portrait-picker__chosen">
          <Portrait
            db={db}
            campaignId={campaignId}
            assetId={choice === null ? currentAssetId : null}
            name={name || '?'}
            size="large"
            previewUrl={choice ? choice.previewUrl : null}
          />
          {/* Change and Remove side by side: one height and one size of words (p2p-16, 2026-11-18), both the small
              secondary button, as neither is the screen's main action (fl-1). */}
          <span className="portrait-picker__actions">
            <label htmlFor={id} className="button-secondary button-secondary--small portrait-picker__change">
              {busy ? 'Preparing…' : `Change ${noun}`}
            </label>
            {input}
            <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => onChoice('remove')}>
              Remove {noun}
            </button>
          </span>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="portrait-picker__add">
            {busy ? 'Preparing the picture…' : `Add a ${noun} (optional)`}
          </label>
          {input}
        </>
      )}
    </div>
  );
}
