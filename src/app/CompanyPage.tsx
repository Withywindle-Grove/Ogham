// The Company page for players (rulings 33 and 33b, 2026-10-24; docs/05 "Companies", 06 Navigation). Until M5
// puts the party sigil on Scene, it opens from the Player screen's ⋯. A character in a company sees it, its
// members (founders marked), asks to join (any member answers until M8, when the charter decides) and can invite
// a character without a company. A character without one sees invitations to answer, "Found a company" (with
// co-founders, each invited) and "Ask to join". One company per character; the database checks every step.
import { useCallback, useEffect, useId, useState } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { answerInvitation, askToJoin, cancelInvitation, foundCompany, inviteToCompany } from '../core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { loadCompanyBoard, type CompanyBoard } from '../core/companies.ts';
import type { MyCharacter } from '../core/myCharacters.ts';
import type { Db } from '../core/supabase.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import { useLogVersion } from './campaignLog.tsx';
import './PackScreen.css';
import { useErrorToast } from '../ui/ToastHost.tsx';

export function CompanyPage({ db, user, campaign, character, onDone }: { db: Db; user: CurrentUser; campaign: OpenCampaign; character: MyCharacter; onDone: () => void }) {
  const id = useId();
  const blocked = useBlockedSheet();
  const [board, setBoard] = useState<CompanyBoard | null | 'error'>(null);
  const [busy, setBusy] = useState(false);
  const setProblem = useErrorToast();
  const [name, setName] = useState('');
  const [cofounders, setCofounders] = useState<string[]>([]);
  const logVersion = useLogVersion();

  const load = useCallback(() => loadCompanyBoard(db, campaign.id), [db, campaign.id]);
  useEffect(() => {
    let current = true;
    void load().then((found) => current && setBoard(found ?? 'error'));
    return () => {
      current = false;
    };
  }, [load, logVersion]);

  async function act(write: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setProblem(null);
    const result = await write();
    setBusy(false);
    if (!result.ok) return setProblem(result.message ?? 'Something went wrong.');
    setBoard((await load()) ?? 'error');
  }

  if (board === null) return <p role="status">Opening…</p>;
  if (board === 'error') {
    return (
      <p className="form-error" role="alert">
        Couldn’t open the companies. Check your connection and try again.
      </p>
    );
  }
  const me = board.characters.find((c) => c.id === character.id);
  const mine = me?.companyId ? (board.companies.find((c) => c.id === me.companyId) ?? null) : null;
  const ref = { id: character.id, ownerUserId: character.ownerUserId };
  const free = board.characters.filter((c) => c.companyId === null && c.id !== character.id);
  const nameOf = (actorId: string) => board.characters.find((c) => c.id === actorId)?.name ?? 'a character';
  const companyName = (companyId: string) => board.companies.find((c) => c.id === companyId)?.name ?? 'a company';
  const forMe = board.waiting.filter((w) => w.actorId === character.id && w.kind !== 'ask');
  const myAsks = board.waiting.filter((w) => w.actorId === character.id && w.kind === 'ask');
  const answer = (invitationId: string, accept: boolean) =>
    void act(() => runCommand(registry, db, user, answerInvitation, { campaignId: campaign.id, invitationId, accept, mine: true }));
  const takeBack = (invitationId: string) => void act(() => runCommand(registry, db, user, cancelInvitation, { campaignId: campaign.id, invitationId, sent: true }));

  return (
    <section className="pack company" aria-label="Company">
      <button type="button" className="button-quiet" onClick={onDone}>
        ‹ {character.name}
      </button>
      <h1 className="pack__title">{mine ? mine.name : 'Company'}</h1>

      {mine ? (
        <>
          <section className="pack__group" aria-label="Members">
            <h2 className="pack__group-title">Members</h2>
            <ul className="pack__rows">
              {board.characters
                .filter((c) => c.companyId === mine.id)
                .map((c) => (
                  <li key={c.id} className="pack__item">
                    <p className="pack__name">
                      {c.name}
                      {mine.founderIds.includes(c.id) && <span className="auth__meta">, founder</span>}
                    </p>
                  </li>
                ))}
            </ul>
          </section>
          {board.waiting.some((w) => w.companyId === mine.id && w.kind === 'ask') && (
            <section className="pack__group" aria-label="Asking to join">
              <h2 className="pack__group-title">Asking to join</h2>
              {board.waiting
                .filter((w) => w.companyId === mine.id && w.kind === 'ask')
                .map((w) => (
                  <div key={w.id} className="pack__actions" role="group" aria-label={`${nameOf(w.actorId)} asks to join`}>
                    <span>{nameOf(w.actorId)}</span>
                    <button type="button" className="button-secondary" aria-busy={busy} onClick={() => answer(w.id, true)}>
                      Accept
                    </button>
                    <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => answer(w.id, false)}>
                      Decline
                    </button>
                  </div>
                ))}
            </section>
          )}
          {free.length > 0 && (
            <section className="pack__group" aria-label="Invite">
              <h2 className="pack__group-title">Invite</h2>
              {free.map((c) => {
                const sent = board.waiting.find((w) => w.companyId === mine.id && w.actorId === c.id && w.kind === 'invite');
                return (
                  <div key={c.id} className="pack__actions">
                    <span>{c.name}</span>
                    {sent ? (
                      <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => takeBack(sent.id)}>
                        Take back the invite
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button-secondary"
                        aria-busy={busy}
                        onClick={() => void act(() => runCommand(registry, db, user, inviteToCompany, { campaignId: campaign.id, companyId: mine.id, characterId: c.id, member: true }))}
                      >
                        Invite {c.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </>
      ) : (
        <>
          {forMe.length > 0 && (
            <section className="pack__group" aria-label="Invitations">
              <h2 className="pack__group-title">Invitations</h2>
              {forMe.map((w) => (
                <div key={w.id} className="pack__actions" role="group" aria-label={`Invitation from ${companyName(w.companyId)}`}>
                  <span>
                    {companyName(w.companyId)}
                    {w.kind === 'cofounder' ? ', as a co-founder' : ''}
                  </span>
                  <button type="button" className="button-secondary" aria-busy={busy} onClick={() => answer(w.id, true)}>
                    Accept
                  </button>
                  <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => answer(w.id, false)}>
                    Decline
                  </button>
                </div>
              ))}
            </section>
          )}

          <form
            className="pack__group"
            aria-label="Found a company"
            onSubmit={(event) => {
              event.preventDefault();
              void act(() => runCommand(registry, db, user, foundCompany, { campaignId: campaign.id, character: ref, name, cofounderIds: cofounders }));
            }}
          >
            <h2 className="pack__group-title">Found a company</h2>
            <div className="field">
              <label className="label" htmlFor={`${id}-name`}>
                Name
              </label>
              <input id={`${id}-name`} className="field__input" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            {free.length > 0 && (
              <div className="field" role="group" aria-label="Co-founders">
                <span className="label">Co-founders (optional; each is asked)</span>
                {free.map((c) => (
                  <label key={c.id} className="pack__check">
                    <input
                      type="checkbox"
                      checked={cofounders.includes(c.id)}
                      onChange={(event) => setCofounders(event.target.checked ? [...cofounders, c.id] : cofounders.filter((x) => x !== c.id))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
            <button
              type="submit"
              className="button-primary"
              aria-busy={busy}
              onClick={(event) => {
                if (name.trim()) return;
                event.preventDefault();
                blocked.explain("Can't found it yet", 'The company needs a name. Type one above, then found it.');
              }}
            >
              Found it
            </button>
            {blocked.sheet}
          </form>

          {board.companies.length > 0 && (
            <section className="pack__group" aria-label="Ask to join">
              <h2 className="pack__group-title">Ask to join</h2>
              {board.companies.map((co) => {
                const asked = myAsks.find((w) => w.companyId === co.id);
                return (
                  <div key={co.id} className="pack__actions">
                    <span>{co.name}</span>
                    {asked ? (
                      <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => takeBack(asked.id)}>
                        Take back the request
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button-secondary"
                        aria-busy={busy}
                        onClick={() => void act(() => runCommand(registry, db, user, askToJoin, { campaignId: campaign.id, companyId: co.id, character: ref }))}
                      >
                        Ask to join {co.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </section>
  );
}
