import { useState } from 'react';
import { copyFileName, loadCharacterCopy } from '../core/characterCopy.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { archiveCharacter, deleteCharacter, type CharacterRef } from '../modules/characters/commands.ts';
import { downloadJson } from './download.ts';
import { registry } from './services.ts';
import './RemoveCharacter.css';
import { ErrorToast } from '../ui/ToastHost.tsx';

type Kind = 'delete' | 'archive' | 'permanent';

const COPY_ERROR = "Couldn't make the copy. Check your connection and try again.";

async function downloadCharacterCopy(db: Db, character: { id: string; name: string }, campaignName: string) {
  const copy = await loadCharacterCopy(db, character.id, campaignName).catch(() => null);
  return copy !== null && downloadJson(copyFileName(character.name), copy);
}

/** "Download a copy" on its own, for characters that are already archived. */
export function DownloadCopyButton({
  db,
  character,
  campaignName,
}: {
  db: Db;
  character: { id: string; name: string };
  campaignName: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function download() {
    const ok = await downloadCharacterCopy(db, character, campaignName);
    setFailed(!ok);
    setMessage(ok ? `Copy of ${character.name} downloaded.` : null);
  }

  return (
    <>
      <button
        type="button"
        className="button-secondary"
        aria-label={`Download a copy of ${character.name}`}
        onClick={() => void download()}
      >
        Download a copy
      </button>
      {message && (
        <p className="auth__meta" role="status">
          {message}
        </p>
      )}
      {failed && (
        <p className="form-error" role="alert">
          {COPY_ERROR}
        </p>
      )}
    </>
  );
}

/** Never approved → delete for good; approved → archive (kept); archived (GM only) → delete permanently. */
function kindOf(character: CharacterRef): Kind {
  if (character.archived) return 'permanent';
  return character.approval === 'approved' ? 'archive' : 'delete';
}

const OPEN_LABEL: Record<Kind, string> = { delete: 'Delete…', archive: 'Remove…', permanent: 'Delete permanently…' };
const CONFIRM_LABEL: Record<Kind, string> = { delete: 'Delete', archive: 'Remove', permanent: 'Delete permanently' };

// The "Remove…" / "Delete…" button and its confirm panel, with "Download a copy" first.
export function RemoveCharacter({
  db,
  user,
  character,
  campaignName,
  onDone,
  open: opened,
  onClose,
}: {
  db: Db;
  user: CurrentUser;
  character: CharacterRef & { name: string };
  campaignName: string;
  onDone: (message: string) => void;
  /** Opened from elsewhere (a row's ⋯, pg32-1): no button of its own; the panel shows while true. */
  open?: boolean;
  /** Cancel (opened from elsewhere). */
  onClose?: () => void;
}) {
  const kind = kindOf(character);
  const [own, setOwn] = useState(false);
  const open = opened ?? own;
  const setOpen = (value: boolean) => {
    setOwn(value);
    if (!value) onClose?.();
  };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    if (await downloadCharacterCopy(db, character, campaignName)) setMessage(`Copy of ${character.name} downloaded.`);
    else setError(COPY_ERROR);
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const command = kind === 'archive' ? archiveCharacter : deleteCharacter;
    const result = await runCommand(registry, db, user, command, { character });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone(
      kind === 'archive'
        ? `${character.name} was removed from ${campaignName} and kept in the archive.`
        : `${character.name} was deleted.`,
    );
  }

  if (!open) {
    if (opened !== undefined) return null;
    return (
      <button type="button" className="button-secondary button-secondary--small" aria-label={`${OPEN_LABEL[kind]} ${character.name}`} onClick={() => setOpen(true)}>
        {OPEN_LABEL[kind]}
      </button>
    );
  }

  return (
    <div className="remove-panel" role="group" aria-label={`${CONFIRM_LABEL[kind]} ${character.name}`}>
      <p className="remove-panel__title">
        {kind === 'archive' && `Remove ${character.name} from ${campaignName}?`}
        {kind === 'delete' && `Delete ${character.name}?`}
        {kind === 'permanent' && `Delete ${character.name} permanently?`}
      </p>
      <p>
        {kind === 'archive' && "They're kept in the archive and won't be active. The GM can bring them back."}
        {kind === 'delete' && 'They were never approved, so they are deleted for good.'}
        {kind === 'permanent' && "This can't be undone. Download a copy first if you might want them again."}
      </p>
      <div className="remove-panel__actions">
        <button type="button" className="button-secondary" aria-busy={busy} onClick={() => void download()}>
          Download a copy
        </button>
        <button
          type="button"
          className="button-secondary button-secondary--warning"
          aria-busy={busy}
          onClick={() => void confirm()}
        >
          {busy ? 'Working…' : CONFIRM_LABEL[kind]}
        </button>
        <button
          type="button"
          className="button-secondary button-secondary--small"
          aria-busy={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
      {message && (
        <p className="auth__meta" role="status">
          {message}
        </p>
      )}
      <ErrorToast message={error} />
    </div>
  );
}
