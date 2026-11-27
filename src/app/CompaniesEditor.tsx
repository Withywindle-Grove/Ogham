import { MoreMenu } from '../ui/MoreMenu.tsx';
import { useEffect, useState, type FormEvent } from 'react';
import { useBlockedSheet } from '../ui/BlockedSheet.tsx';
import { createCompany, deleteCompany, renameCompany } from '../core/campaignCommands.ts';
import { runCommand, type CommandResult, type CurrentUser } from '../core/commands.ts';
import { loadCompanies, type Company } from '../core/companies.ts';
import { loadPlayers, type Player, type PlayerCharacter } from '../core/gmCampaign.ts';
import type { Db } from '../core/supabase.ts';
import { assignCompany } from '../modules/characters/commands.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { Portrait } from './Portrait.tsx';
import { registry } from './services.ts';
import './CompaniesEditor.css';
import { useLogVersion } from './campaignLog.tsx';
import { ErrorToast, NoticeToast } from '../ui/ToastHost.tsx';
import { possessive } from '../core/nameWords.ts';

type Placed = { player: Player; character: PlayerCharacter };

// GM: Campaign → Companies. Make, rename and delete companies, and choose which company each character is in.
// In M1 the GM places characters directly; joining by vote arrives in M8.
export function CompaniesEditor({ db, user, campaign }: { db: Db; user: CurrentUser; campaign: OpenCampaign }) {
  const [companies, setCompanies] = useState<Company[] | null | 'error'>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [version, setVersion] = useState(0);
  // An undo from the log reloads this in place.
  const logVersion = useLogVersion();
  const [editing, setEditing] = useState<Company | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const blocked = useBlockedSheet();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = (message?: string) => {
    setNotice(message ?? null);
    setError(null);
    setVersion((v) => v + 1);
  };

  useEffect(() => {
    let current = true;
    Promise.all([loadCompanies(db, campaign.id), loadPlayers(db, campaign.id)]).then(
      ([foundCompanies, foundPlayers]) => {
        if (!current) return;
        setCompanies(foundCompanies && foundPlayers ? foundCompanies : 'error');
        setPlayers(foundPlayers ?? []);
      },
      () => current && setCompanies('error'),
    );
    return () => {
      current = false;
    };
  }, [db, campaign.id, version, logVersion]);

  // Archived characters aren't placed here, but they still count as being in their company.
  const everyone: Placed[] = players.flatMap((player) => player.characters.map((character) => ({ player, character })));
  const current = everyone.filter(({ character }) => !character.archived);
  const inCompany = (companyId: string | null) => everyone.filter(({ character }) => character.companyId === companyId);

  async function run(action: () => Promise<CommandResult<unknown>>, message: string) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) reload(message);
    else setError(result.message);
  }

  const move = (character: PlayerCharacter, companyId: string | null) => {
    // The busy guard covers buttons only: a choice made while the last one saves waits, and says so (review, #561).
    if (busy) return blocked.explain('Still saving', `The last change is still saving. Choose ${possessive(character.name)} company again in a moment.`);
    const name = Array.isArray(companies) ? companies.find((c) => c.id === companyId)?.name : undefined;
    void run(
      () => runCommand(registry, db, user, assignCompany, { character, companyId }),
      name ? `${character.name} is now in ${name}.` : `${character.name} is in no company now.`,
    );
  };

  const remove = (company: Company) =>
    void run(
      () => runCommand(registry, db, user, deleteCompany, { campaignId: campaign.id, companyId: company.id }),
      `${company.name} was deleted.`,
    );

  return (
    <div className="companies">
      {blocked.sheet}
      <div className="gm__section-head">
        <h2 className="gm__section-title">Companies</h2>
        {editing === null && (
          // Players found their own companies (ruled 2026-10-24); the GM's New company is fiat, behind ⋯.
          <MoreMenu label="Companies options">
            <button type="button" className="button-secondary button-secondary--small" onClick={() => setEditing('new')}>
              New company (GM)
            </button>
          </MoreMenu>
        )}
      </div>


      {editing === 'new' && (
        <CompanyForm
          db={db}
          user={user}
          campaignId={campaign.id}
          company={null}
          onDone={(message) => {
            setEditing(null);
            if (message) reload(message);
          }}
        />
      )}
      <NoticeToast message={notice} />
      <ErrorToast message={error} />
      {companies === null && <p role="status">Opening…</p>}
      {companies === 'error' && (
        <>
          <p className="form-error" role="alert">
            Couldn't load the companies. Check your connection and try again.
          </p>
          <button type="button" className="button-secondary" onClick={() => reload()}>
            Try again
          </button>
        </>
      )}

      {Array.isArray(companies) && (
        <>
          {companies.length === 0 && editing !== 'new' && <p className="gm__meta">No companies yet.</p>}
          <ul className="gm__list">
            {companies.map((company) =>
              editing !== 'new' && editing?.id === company.id ? (
                <li key={company.id} className="companies__row">
                  <CompanyForm
                    db={db}
                    user={user}
                    campaignId={campaign.id}
                    company={company}
                    onDone={(message) => {
                      setEditing(null);
                      if (message) reload(message);
                    }}
                  />
                </li>
              ) : (
                <li key={company.id} className="companies__row gm__row">
                  <Portrait db={db} campaignId={campaign.id} assetId={null} name={company.name} />
                  <span className="gm__row-main">
                    <span className="gm__row-name">{company.name}</span>
                    <span className="gm__meta">{membersLine(inCompany(company.id))}</span>
                  </span>
                  <span className="gm__actions">
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={`Rename ${company.name}`}
                      aria-busy={busy}
                      onClick={() => setEditing(company)}
                    >
                      Rename
                    </button>
                    {inCompany(company.id).length === 0 && (
                      <button
                        type="button"
                        className="button-secondary button-secondary--small"
                        aria-label={`Delete ${company.name}`}
                        aria-busy={busy}
                        onClick={() => remove(company)}
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </li>
              ),
            )}
            {companies.length > 0 && (
              <li className="companies__row gm__row">
                <span className="gm__row-main">
                  <span className="gm__row-name">No company</span>
                  <span className="gm__meta">{membersLine(inCompany(null).filter(({ character }) => !character.archived))}</span>
                </span>
              </li>
            )}
          </ul>

          {companies.length > 0 && current.length > 0 && (
            <div className="gm__block">
              <h3 className="label">Who's in which company</h3>
              <ul className="gm__list">
                {current.map(({ player, character }) => (
                  <li key={character.id} className="companies__row gm__row">
                    <Portrait
                      db={db}
                      campaignId={character.campaignId}
                      assetId={character.portraitAssetId}
                      name={character.name}
                      size="small"
                    />
                    <span className="gm__row-main">
                      <span className="gm__row-name">{character.name}</span>
                      <span className="gm__meta">
                        {player.name}
                        {character.approval === 'pending' && ', waiting for approval'}
                        {character.approval === 'rejected' && ', sent back'}
                      </span>
                    </span>
                    <select
                      id={`company-${character.id}`}
                      className="field__input companies__select"
                      aria-label={`Company for ${character.name}`}
                      value={character.companyId ?? ''}
                      onChange={(event) => move(character, event.target.value || null)}
                    >
                      <option value="">No company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** "Wren, Ash", with archived characters marked, or "No characters yet". */
function membersLine(placed: Placed[]): string {
  if (placed.length === 0) return 'No characters yet';
  return placed.map(({ character }) => (character.archived ? `${character.name} (archived)` : character.name)).join(', ');
}

// New company, or renaming one.
function CompanyForm({
  db,
  user,
  campaignId,
  company,
  onDone,
}: {
  db: Db;
  user: CurrentUser;
  campaignId: string;
  company: Company | null;
  onDone: (message?: string) => void;
}) {
  const [name, setName] = useState(company?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = company ? `company-name-${company.id}` : 'company-name-new';

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the company a name.');
    setBusy(true);
    setError(null);
    const result = company
      ? await runCommand(registry, db, user, renameCompany, { campaignId, companyId: company.id, name: trimmed })
      : await runCommand(registry, db, user, createCompany, { campaignId, name: trimmed });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onDone(company ? `Renamed to ${trimmed}.` : `${trimmed} was created.`);
  }

  return (
    <form
      className="gm__panel"
      aria-label={company ? `Rename ${company.name}` : 'New company'}
      onSubmit={(event) => void save(event)}
      noValidate
    >
      <div className="field">
        <label className="label" htmlFor={id}>
          Company name
        </label>
        <input
          id={id}
          className="field__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="companies__form-actions">
        <button type="submit" className="button-secondary" aria-busy={busy}>
          {busy ? 'Saving…' : company ? 'Save' : 'Create company'}
        </button>
        <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
