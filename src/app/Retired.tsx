import { useState } from 'react';
import { restoreCampaign, retireCampaign } from '../core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import './Retired.css';
import { useErrorToast } from '../ui/ToastHost.tsx';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { StatusIcon } from '../ui/icons.tsx';
import { StackedButton } from '../ui/parts.tsx';

const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** The banner's words, shared with the folded rail's pop-up (mn-2: "the banner's own words"). */
function RetiredWords({ retiredAt }: { retiredAt: string }) {
  return (
    <>
      <strong>Retired on {longDate(retiredAt)}.</strong> Everyone can still read it, but nothing in it can change.
    </>
  );
}

/** Bring back (ic-1: the sunrise above its word), the one button the banner and the rail's pop-up share. */
function BringBack({
  db,
  user,
  campaign,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onChanged: (retiredAt: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const setProblem = useErrorToast();

  async function bringBack() {
    // Never disabled (06): a second tap while it saves does nothing.
    if (busy) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, restoreCampaign, { campaignId: campaign.id });
    setBusy(false);
    if (result.ok) onChanged(null);
    else setProblem(result.message);
  }

  return <StackedButton icon="sunrise" label="Bring back" onClick={() => void bringBack()} />;
}

// A retired campaign's banner: when it was retired and that nothing can change; the GM can bring it back.
export function RetiredBanner({
  db,
  user,
  campaign,
  onChanged,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onChanged?: (retiredAt: string | null) => void;
}) {
  if (!campaign.retiredAt) return null;

  return (
    <div className="retired" role="note" aria-label="Retired campaign">
      <p className="retired__text">
        <RetiredWords retiredAt={campaign.retiredAt} />
      </p>
      {campaign.role === 'gm' && onChanged && <BringBack db={db} user={user} campaign={campaign} onChanged={onChanged} />}
    </div>
  );
}

/**
 * The folded rail's mark for a retired campaign (mn-2, ap-17; mockup december/16, frame T13): under the sigil, a tile
 * with the lock and the word "Retired" in the warning colour (never colour alone). A tap opens a small pop-up,
 * "Retired campaign", with the banner's words and, for the GM, the banner's Bring back. Only the folded landscape rail
 * shows it (GmCampaign.css).
 */
export function RetiredRailMark({
  db,
  user,
  campaign,
  onChanged,
  className,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onChanged?: (retiredAt: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!campaign.retiredAt) return null;
  const retiredAt = campaign.retiredAt;

  return (
    <>
      <button
        type="button"
        className={['retired-mark', className].filter(Boolean).join(' ')}
        aria-label="Retired campaign: read more"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <StatusIcon name="lock" size={20} />
        <span className="retired-mark__word">Retired</span>
      </button>
      {open && (
        <SheetScope.Provider value>
          <Dialog label="Retired campaign" onClose={() => setOpen(false)}>
            <p>
              <RetiredWords retiredAt={retiredAt} />
            </p>
            {campaign.role === 'gm' && onChanged && (
              <div className="dialog__actions">
                <BringBack
                  db={db}
                  user={user}
                  campaign={campaign}
                  onChanged={(next) => {
                    setOpen(false);
                    onChanged(next);
                  }}
                />
              </div>
            )}
          </Dialog>
        </SheetScope.Provider>
      )}
    </>
  );
}

// GM: "Retire campaign…", with a plain confirm. Retiring keeps everything and can be undone with Bring back.
export function RetireCampaign({
  db,
  user,
  campaign,
  onRetired,
}: {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onRetired: (retiredAt: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const setProblem = useErrorToast();

  async function retire() {
    setBusy(true);
    const result = await runCommand(registry, db, user, retireCampaign, { campaignId: campaign.id });
    setBusy(false);
    if (result.ok) onRetired(new Date().toISOString());
    else setProblem(result.message);
  }

  return (
    <div className="retire">
      {confirming ? (
        <div className="retire__confirm" role="group" aria-label={`Retire ${campaign.name}`}>
          <p>
            Retire <strong>{campaign.name}</strong>? Everyone can still open it and read everything, but nothing in it can
            change and nobody can join. You can bring it back.
          </p>
          <div className="retire__actions">
            {/* Never disabled (06): a second tap while it saves does nothing. */}
            <button type="button" className="button-secondary" onClick={() => !busy && void retire()}>
              {busy ? 'Retiring…' : 'Retire'}
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={() => !busy && setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="button-secondary button-secondary--small" onClick={() => setConfirming(true)}>
          Retire campaign…
        </button>
      )}
    </div>
  );
}
