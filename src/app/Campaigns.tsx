import { useEffect, useState, type FormEvent } from 'react';
import { redeemInvite } from '../core/campaignCommands.ts';
import { runCommand, type BaseRole, type CurrentUser } from '../core/commands.ts';
import { normalizeInviteCode, peekInvite, type InvitePreview } from '../core/invites.ts';
import { loadMyCampaigns, roleLine, type CampaignSummary } from '../core/myCampaigns.ts';
import { keepOnlyCampaigns } from './packCache.ts';
import type { Db } from '../core/supabase.ts';
import { Portrait } from './Portrait.tsx';
import { registry } from './services.ts';
import './Campaigns.css';
import { ErrorToast } from '../ui/ToastHost.tsx';

/** What a campaign page needs to open before its own screens exist. */
export interface OpenCampaign {
  id: string;
  name: string;
  role: BaseRole;
  line: string | null;
  /** When its GM retired it (read only), or null. */
  retiredAt?: string | null;
}

// "Your campaigns": every campaign with your role (retired ones folded away at the end), start a new one, or
// enter an invite code.
export function CampaignPicker({
  db,
  userId,
  onOpen,
  onNew,
  onInviteCode,
}: {
  db: Db;
  userId: string;
  onOpen: (campaign: OpenCampaign) => void;
  onNew: () => void;
  onInviteCode: (code: string) => void;
}) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null | 'error'>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    loadMyCampaigns(db, userId).then(
      (list) => {
        if (!current) return;
        setCampaigns(list ?? 'error');
        // A campaign no longer yours (left, removed, deleted) loses its setting rules stored on this device (perf fix 2b).
        if (list) void keepOnlyCampaigns(userId, list.map((c) => c.id));
      },
      () => current && setCampaigns('error'),
    );
    return () => {
      current = false;
    };
  }, [db, userId, version]);

  // Coming back to the app (visible, focused, online) reloads the list, so "sent back" and new campaigns show
  // without a refresh (A12, M4b gate 2026-10-25).
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === 'visible') setVersion((v) => v + 1);
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    window.addEventListener('online', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
      window.removeEventListener('online', back);
    };
  }, []);

  return (
    <section className="picker">
      <h1 className="picker__title">Your campaigns</h1>
      {campaigns === null && <p role="status">Opening…</p>}
      {campaigns === 'error' && (
        <>
          <p className="form-error" role="alert">
            Couldn't load your campaigns. Check your connection and try again.
          </p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setCampaigns(null);
              setVersion((v) => v + 1);
            }}
          >
            Try again
          </button>
        </>
      )}
      {Array.isArray(campaigns) && campaigns.length === 0 && (
        <>
          <p className="picker__empty">No campaigns yet. Start one as GM, or enter an invite code from your GM.</p>
        </>
      )}
      {Array.isArray(campaigns) && campaigns.some((c) => !c.retiredAt) && (
        <CampaignRows db={db} campaigns={campaigns.filter((c) => !c.retiredAt)} onOpen={onOpen} />
      )}
      {Array.isArray(campaigns) && campaigns.some((c) => c.retiredAt) && (
        <details className="picker__retired">
          <summary className="picker__retired-summary">Retired: {campaigns.filter((c) => c.retiredAt).length}</summary>
          <CampaignRows db={db} campaigns={campaigns.filter((c) => c.retiredAt)} onOpen={onOpen} />
        </details>
      )}
      <button type="button" className="picker__new" onClick={onNew}>
        + Start a new campaign (as GM)
      </button>
      <InviteCodeBox onCode={onInviteCode} />
      <p className="picker__note">You can be the GM in one campaign and a player in another. Each is kept separate.</p>
    </section>
  );
}

function CampaignRows({ db, campaigns, onOpen }: { db: Db; campaigns: CampaignSummary[]; onOpen: (campaign: OpenCampaign) => void }) {
  return (
    <ul className="picker__list">
      {campaigns.map((campaign) => (
        <li key={campaign.id}>
          <button
            type="button"
            className="campaign-row"
            onClick={() =>
              onOpen({ id: campaign.id, name: campaign.name, role: campaign.role, line: roleLine(campaign), retiredAt: campaign.retiredAt })
            }
          >
            {campaign.role === 'player' && campaign.portraitAssetId ? (
              <Portrait
                db={db}
                campaignId={campaign.id}
                assetId={campaign.portraitAssetId}
                name={campaign.characterName ?? campaign.name}
              />
            ) : (
              <Portrait db={db} campaignId={campaign.id} assetId={campaign.sigilAssetId} name={campaign.name} />
            )}
            <span className="campaign-row__text">
              <span className="campaign-row__name">{campaign.name}</span>
              <span className="campaign-row__role">{roleLine(campaign)}</span>
            </span>
            <span className="campaign-row__arrow" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function InviteCodeBox({ onCode }: { onCode: (code: string) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function lookUp(event: FormEvent) {
    event.preventDefault();
    const code = normalizeInviteCode(text);
    if (!code) {
      setError('Enter the code from your GM.');
      return;
    }
    onCode(code);
  }

  return (
    // A standing form: while its box is empty it doesn't hold a new version of the app back (appUpdates.ts).
    <form className="invite-box" data-standing-form="" onSubmit={lookUp} noValidate>
      <label className="label" htmlFor="invite-code">
        Have an invite code?
      </label>
      <div className="invite-box__row">
        <input
          id="invite-code"
          className="field__input invite-box__input"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          aria-describedby={error ? 'invite-code-error' : undefined}
        />
        <button type="submit" className="button-secondary">
          Look up
        </button>
      </div>
      {error && (
        <p id="invite-code-error" className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

// The page an invite link or code opens: which campaign, who runs it, and Join.
export function JoinCampaign({
  db,
  user,
  code,
  onJoined,
  onOpen,
  onCancel,
}: {
  db: Db;
  user: CurrentUser;
  code: string;
  /** Just joined: go on to make a character. */
  onJoined: (campaign: OpenCampaign) => void;
  /** Already a member: just open the campaign. */
  onOpen: (campaign: OpenCampaign) => void;
  onCancel: () => void;
}) {
  const [preview, setPreview] = useState<InvitePreview | null | 'error' | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    peekInvite(db, code).then(
      (found) => current && setPreview(found),
      () => current && setPreview('error'),
    );
    return () => {
      current = false;
    };
  }, [db, code, version]);

  async function join() {
    if (busy || !preview || preview === 'error') return;
    setBusy(true);
    setError(null);
    const result = await runCommand(registry, db, user, redeemInvite, { code });
    setBusy(false);
    if (result.ok) onJoined({ id: result.value, name: preview.campaignName, role: 'player', line: 'Player, No character yet' });
    else setError(result.message);
  }

  const back = (
    <button type="button" className="button-quiet" aria-busy={busy} onClick={onCancel}>
      Back to your campaigns
    </button>
  );

  if (preview === undefined) return <p role="status">Looking up the invite…</p>;
  if (preview === 'error') {
    return (
      <section className="auth">
        <p className="form-error" role="alert">
          Couldn't check the invite code. Check your connection and try again.
        </p>
        <button type="button" className="button-primary" onClick={() => setVersion((v) => v + 1)}>
          Try again
        </button>
        {back}
      </section>
    );
  }
  if (preview === null) {
    return (
      <section className="auth">
        <h1 className="auth__title">Invite not found</h1>
        <p>
          The code <strong>{code}</strong> isn't valid or has expired. Ask your GM for a new one.
        </p>
        {back}
      </section>
    );
  }
  return (
    <section className="auth auth--invite">
      <p className="auth__meta">You're invited to join</p>
      <h1 className="auth__title">{preview.campaignName}</h1>
      <p className="auth__meta">GM: {preview.gmName}</p>
      {preview.alreadyMember ? (
        <>
          <p>You're already in this campaign.</p>
          <button
            type="button"
            className="button-primary"
            onClick={() =>
              onOpen({
                id: preview.campaignId,
                name: preview.campaignName,
                role: user.roles[preview.campaignId] ?? 'player',
                line: null,
              })
            }
          >
            Open campaign
          </button>
          {back}
        </>
      ) : (
        <>
          <p>First, make your character.</p>
          <ErrorToast message={error} />
          <div className="footer-buttons">
            <button type="button" className="button-secondary" aria-busy={busy} onClick={onCancel}>
              Not now
            </button>
            <button type="button" className="button-primary" aria-busy={busy} onClick={() => void join()}>
              {busy ? 'Joining…' : 'Join'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
