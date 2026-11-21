import { useEffect, useState } from 'react';
import type { CurrentUser } from '../core/commands.ts';
import { loadParty, type PartyMember } from '../core/party.ts';
import type { Db } from '../core/supabase.ts';
import { Portrait } from './Portrait.tsx';
import './PartyList.css';
import { useLogVersion } from './campaignLog.tsx';

// "The party": every approved character in the campaign, read-only, with its player, level and company.
// The full party view (marching order, light, HP for the table) comes with Scene in M5.
export function PartyList({ db, user, campaignId }: { db: Db; user: CurrentUser; campaignId: string }) {
  const [party, setParty] = useState<PartyMember[] | null | 'error'>(null);
  const logVersion = useLogVersion();

  useEffect(() => {
    let current = true;
    loadParty(db, campaignId).then(
      (found) => current && setParty(found ?? 'error'),
      () => current && setParty('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaignId, logVersion]);

  return (
    <div className="party">
      <h2 className="label">The party</h2>
      {party === 'error' && <p className="auth__meta">Couldn't load the party. Reopen the campaign to try again.</p>}
      {Array.isArray(party) && party.length === 0 && <p className="auth__meta">No approved characters yet.</p>}
      {Array.isArray(party) && party.length > 0 && (
        <ul className="party__list">
          {party.map((member) => (
            <li key={member.id} className="party__row">
              <Portrait db={db} campaignId={member.campaignId} assetId={member.portraitAssetId} name={member.name} size="small" />
              <span className="party__text">
                <span className="party__name">{member.name}</span>
                <span className="auth__meta">
                  {[
                    member.ownerUserId === user.id ? `${member.playerName} (you)` : member.playerName,
                    `Level ${member.level}`,
                    member.companyName,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
