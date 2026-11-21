import { useEffect, useState, type FormEvent } from 'react';
import { clearSigil, setSigil, updateCampaign } from '../core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { forgetFileLinks } from '../core/files.ts';
import { loadCampaignHeading } from '../core/myCampaigns.ts';
import type { Db } from '../core/supabase.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { Portrait, PortraitPicker, type PortraitChoice } from './Portrait.tsx';
import { registry } from './services.ts';
import './CampaignHeading.css';
import { useLogVersion } from './campaignLog.tsx';

// The top of a campaign's screens: its sigil and name. The GM taps either to rename the campaign or change its sigil.
export function CampaignHeading({
  db,
  user,
  campaign,
  editable,
  titleClassName,
  onSaved,
  onOpenMenu,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  editable: boolean;
  titleClassName: string;
  /** After the GM saves a new name or sigil. */
  onSaved?: () => void;
  /**
   * The folded rail's sigil (mn-2, ap-17; mockup december/16, frame T13): with this, the sigil is also drawn as a 44 px
   * button named with the campaign's name that opens the menu. Only the folded landscape rail shows it (GmCampaign.css).
   */
  onOpenMenu?: () => void;
}) {
  const [heading, setHeading] = useState<{ name: string; sigilAssetId: string | null }>({
    name: campaign.name,
    sigilAssetId: null,
  });
  const [version, setVersion] = useState(0);
  const logVersion = useLogVersion();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadCampaignHeading(db, campaign.id).then(
      (found) => current && found && setHeading(found),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, version, logVersion]);

  const sigil = (
    <Portrait db={db} campaignId={campaign.id} assetId={heading.sigilAssetId} name={heading.name} />
  );
  const open = () => {
    setNotice(null);
    setEditing(true);
  };
  // The folded rail keeps the sigil (mn-2): a tap opens the menu, where the name, Rename and Change sigil are.
  const railSigil = onOpenMenu && (
    <button type="button" className="campaign-heading__rail-sigil" aria-label={`${heading.name}: open the menu`} onClick={onOpenMenu}>
      <Portrait db={db} campaignId={campaign.id} assetId={heading.sigilAssetId} name={heading.name} size="small" />
    </button>
  );

  if (editing) {
    return (
      <>
      {railSigil}
      <EditCampaign
        db={db}
        user={user}
        campaignId={campaign.id}
        heading={heading}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          setNotice('Campaign saved.');
          setVersion((v) => v + 1);
          onSaved?.();
        }}
      />
      </>
    );
  }

  return (
    <>
      {railSigil}
      <div className="campaign-heading">
        {editable ? (
          <button type="button" className="campaign-heading__sigil" aria-label="Change the campaign sigil" onClick={open}>
            {sigil}
          </button>
        ) : (
          sigil
        )}
        <h1 className={`campaign-heading__title ${titleClassName}`}>
          {editable ? (
            <button type="button" className="campaign-heading__name" title="Rename the campaign" onClick={open}>
              <span className="campaign-heading__text">{heading.name}</span>
            </button>
          ) : (
            <span className="campaign-heading__text">{heading.name}</span>
          )}
        </h1>
      </div>
      {notice && (
        <p className="campaign-heading__notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}

// "Edit the campaign": the name and the sigil, saved together.
function EditCampaign({
  db,
  user,
  campaignId,
  heading,
  onCancel,
  onSaved,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  heading: { name: string; sigilAssetId: string | null };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(heading.name);
  const [choice, setChoice] = useState<PortraitChoice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the campaign a name.');
    setBusy(true);
    setError(null);
    if (trimmed !== heading.name) {
      const renamed = await runCommand(registry, db, user, updateCampaign, { campaignId, name: trimmed });
      if (!renamed.ok) {
        setBusy(false);
        return setError(renamed.message);
      }
    }
    if (choice !== null) {
      const result =
        choice === 'remove'
          ? await runCommand(registry, db, user, clearSigil, { campaignId })
          : await runCommand(registry, db, user, setSigil, { campaignId, image: choice.blob });
      forgetFileLinks();
      if (!result.ok) {
        setBusy(false);
        return setError(result.message);
      }
    }
    setBusy(false);
    onSaved();
  }

  return (
    <form className="gm__panel" aria-label="Edit the campaign" onSubmit={(event) => void save(event)} noValidate>
      <div className="field">
        <label className="label" htmlFor="campaign-rename">
          Campaign name
        </label>
        <input
          id="campaign-rename"
          className="field__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={error ? 'campaign-rename-error' : undefined}
        />
      </div>
      <PortraitPicker
        db={db}
        campaignId={campaignId}
        name={name}
        currentAssetId={heading.sigilAssetId}
        choice={choice}
        onChoice={setChoice}
        noun="sigil"
      />
      {error && (
        <p id="campaign-rename-error" className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="campaign-heading__actions">
        <button type="submit" className="button-secondary" aria-busy={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
