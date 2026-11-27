// "Waiting for you" on the GM console (ruled 2026-10-23): players' one-off items waiting for the GM's approval,
// with Approve (and "Also add to the campaign homebrew") or Decline, both logged. Part of the GM inbox from M8.
// M5 step 12 (ruled 2026-10-31, Q6): the same list holds players' Requests (the escape rolls Leave the dungeon asked
// for; lines sent with Describe… before it was removed, A5), each a Request card with its answer kind's buttons;
// never a second list.
// bq3-8 (ruled 2026-11-04): worn magic armour whose base isn't picked yet waits here too, as "Pick the base for
// <armour> (worn by <name>)" (GmBasePickCard).
// One part on Scene and on Players (dec-7 piece 5b; the lead's ruling 4 on 5b's scope checks; page 11 frame 1b, page 12
// W1 to W3): on the GM's place page it stands in the right column (first on a phone); on Players it stands first.
// The one working panel (S8 of docs/plans/dec-9-the-whole-scene.md; st-1, wy-1; page 16, frames T2, T6b, T8b):
// `WaitingPanel` draws everything waiting, from the model (waitingModel.ts) through the provider (sceneWaiting.tsx), fed
// by sources: the time strip's encounter cards and this list's own players' items (S8a); the reminder card, the rest,
// the hit, the weather and the end of an expedition join in S8b. Its heading's count, "1 of 4", names which one is open
// of how many (wy-1); the open item is drawn whole, as its source draws it; the others are one-line rows (the mark, the
// title, its one button), a tap on a row's title opening it; past four, "N more" in the fourth place. "Nothing waits."
// when it is empty, or, where the page leaves it out while empty (`quiet`), nothing at all.
import { useCallback, useEffect, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { readDungeonExit } from '../modules/expedition/dungeonExit.ts';
import { readTable, type ReadTable } from '../modules/expedition/tables.ts';
import { approveItem, declineItem, loadCarriers, loadInventory, type InventoryLine, type NamedCarrier } from '../modules/inventory/inventory.ts';
import { saveHomebrewEntry } from '../modules/library/homebrew.ts';
import { loadRequestNames, loadHirelingsByPlayer, loadRequests, readSecretActivityPrompt, type Request } from '../modules/requests/requests.ts';
import { loadSecretViews, type SecretView } from './secretActivity.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { homebrewItem } from './PackScreen.tsx';
import { registry } from './services.ts';
import './PackScreen.css';
import './WaitingForYou.css';
import { choicesInPlay, loadCampaignSetting } from './campaignSetting.ts';
import { useLogVersion } from './campaignLog.tsx';
import { GmBasePickCard, GmRequestCard, LostBelowDialog, TableDialog } from './RequestCard.tsx';
import { baseArmourChoices } from '../modules/characters/play.ts';
import { waitingForBase } from './pickBase.ts';
import { tradeViewOf } from './townTrade.ts';
import type { TradeView } from './TownRequestCards.tsx';
import { useErrorToast } from '../ui/ToastHost.tsx';
import { Icon, StepIcon } from '../ui/icons.tsx';
import { ENCOUNTER_MARK } from './encounterMark.ts';
import { isSetIconName } from '../ui/iconSet.ts';
import { StackedButton } from '../ui/parts.tsx';
import type { WaitingKind, WaitingRow } from '../modules/expedition/waitingModel.ts';
import { CardHost, SceneWaitingProvider, useHasWaitingProvider, useWaitingPanel, useWaitingSource, useWaitingState, type WaitingSourceItem } from './sceneWaiting.tsx';
import { possessive } from '../core/nameWords.ts';

/**
 * What waits for the GM in this list, by kind (for the Players tab's name and glow): one-offs to approve, worn
 * armour's bases to pick, and requests to answer.
 */
export async function countWaiting(db: Db, campaignId: string): Promise<{ oneOffs: number; bases: number; requests: number }> {
  const [found, requests] = await Promise.all([loadInventory(db, campaignId), loadRequests(db, campaignId, { waiting: true })]);
  const lines = found?.lines ?? [];
  return {
    oneOffs: lines.filter((l) => l.approval === 'pending').length,
    bases: lines.filter((l) => l.approval !== 'pending' && waitingForBase(l)).length,
    requests: requests?.length ?? 0,
  };
}

export interface WaitingForYouProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  onChanged: () => void;
  /**
   * While nothing waits the panel is there but hidden (the place page at a place that holds spots, frame 1a, and on a
   * phone). While its own list is still loading it hides only if nothing else waits either: no "Opening…" that then
   * goes, and never a waiting encounter card hidden behind a slow read (the #785 reviews).
   */
  quiet?: boolean;
}

/**
 * The panel with its own list. Under the Scene's provider it draws everything waiting there; on its own (the Players
 * tab) it makes a provider of its own. One panel a provider: a split party's second place page draws none.
 */
export function WaitingForYou(props: WaitingForYouProps) {
  return useHasWaitingProvider() ? (
    <HostedWaiting {...props} />
  ) : (
    <SceneWaitingProvider>
      <HostedWaiting {...props} />
    </SceneWaitingProvider>
  );
}

function HostedWaiting(props: WaitingForYouProps) {
  const panel = useWaitingPanel();
  return panel?.hosting ? <PlayersWaiting {...props} /> : null;
}

/** This list's own items (players' items), fed to the panel as a source, and the panel. */
function PlayersWaiting({ db, user, campaign, onChanged, quiet = false }: WaitingForYouProps) {
  const [waiting, setWaiting] = useState<{ line: InventoryLine; carrier: NamedCarrier }[] | null>(null);
  // Worn magic armour waiting for its base (bq3-8), and the setting's item names for the bases.
  const [bases, setBases] = useState<{ list: { line: InventoryLine; carrier: NamedCarrier; choices: string[] }[]; names: Map<string, string> } | null>(null);
  const [also, setAlso] = useState<string[]>([]);
  // The one-off the GM is editing before approving it, with what's typed.
  const [editing, setEditing] = useState<{ id: string; name: string; weight: string; slots: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const setProblem = useErrorToast();
  // Requests (M5 step 12): those waiting, whose they are, and the setting's tables (a failed escape roll's doom table).
  const [requests, setRequests] = useState<{
    list: Request[];
    names: Map<string, string>;
    doomTable: ReadTable | 'missing' | null;
    hirelings: Map<string, string[]>;
    /** The secret activities' prompts, by request id (M5b step 3), and the pack's budget words. */
    secrets: Map<string, SecretView>;
    budget: { name: string; unit: string } | null;
    /** Buy and sell requests' views from the pack (M5b step 6e), by request id. */
    trades: Map<string, TradeView>;
  } | null>(null);
  // A failed escape roll just sent: the pack's table to roll on (held here, since the card leaves the list on Send).
  const [lost, setLost] = useState<{ table: ReadTable; who: string } | null>(null);
  // A secret activity's table the GM opened (S4-8).
  const [tableOpen, setTableOpen] = useState<{ table: ReadTable; who: string } | null>(null);

  const logVersion = useLogVersion();
  // logVersion: an undo from the log reloads the list.
  const load = useCallback(async () => {
    const [inventory, carriers] = await Promise.all([loadInventory(db, campaign.id), loadCarriers(db, campaign.id)]);
    if (!inventory || !carriers) return null;
    return inventory.lines
      .filter((l) => l.approval === 'pending')
      .flatMap((line) => {
        const carrier = carriers.find((c) => (c.actorId ? c.actorId === line.actorId : c.locationId === line.locationId));
        return carrier ? [{ line, carrier }] : [];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, campaign.id, logVersion]);

  const loadBases = useCallback(async () => {
    const [inventory, carriers] = await Promise.all([loadInventory(db, campaign.id), loadCarriers(db, campaign.id)]);
    const list = (inventory?.lines ?? []).filter(waitingForBase).flatMap((line) => {
      const carrier = (carriers ?? []).find((c) => c.actorId === line.actorId);
      const choices = baseArmourChoices(line.details.armour);
      return carrier && choices ? [{ line, carrier, choices }] : [];
    });
    const setting = list.length ? await loadCampaignSetting(db, user.id, campaign.id) : null;
    const names = new Map((setting?.all ?? []).filter((e) => e.kind === 'item').map((e) => [e.packEntryId, e.name] as const));
    return { list, names };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user.id, campaign.id, logVersion]);

  const loadWaitingRequests = useCallback(async () => {
    const list = (await loadRequests(db, campaign.id, { waiting: true })) ?? [];
    const ids = [...new Set(list.flatMap((r) => [r.actorId, ...(r.kind === 'secretActivity' ? (readSecretActivityPrompt(r.prompt)?.actorIds ?? []) : [])]).filter((id): id is string => id !== null))];
    const [names, setting] = await Promise.all([loadRequestNames(db, ids), list.length ? loadCampaignSetting(db, user.id, campaign.id) : Promise.resolve(null)]);
    // The doom table a failed escape roll opens: from the pack's rule, on the GM's side (never in the request).
    const choices = setting ? choicesInPlay(setting) : {};
    const rule = readDungeonExit(setting?.rulesSets ?? [], choices);
    let doomTable: ReadTable | 'missing' | null = null;
    if (rule?.onFailTable) {
      const entry = (setting?.all ?? []).find((e) => e.kind === 'table' && e.packEntryId === rule.onFailTable);
      doomTable = (entry && readTable(entry.packEntryId, entry.name, entry.data)) || 'missing';
    }
    // C6 (M5 gate): a hireling leaves with its employer and shares their result; the hirelings by their player.
    const hirelings = list.some((r) => r.kind === 'escapeRoll' && r.requesterId) ? await loadHirelingsByPlayer(db, campaign.id) : new Map<string, string[]>();
    const secret = await loadSecretViews(db, campaign.id, setting, list);
    // M5b step 6e: what the pack says about a buy or sell request (on the GM's side only).
    const trades = new Map(list.flatMap((r) => {
      const view = setting ? tradeViewOf(r, setting) : null;
      return view ? [[r.id, view] as const] : [];
    }));
    return { list, names, doomTable, hirelings, secrets: secret.views, budget: secret.budget, trades };
  }, [db, user.id, campaign.id]);

  useEffect(() => {
    let current = true;
    void load().then((found) => current && setWaiting(found ?? []));
    void loadWaitingRequests().then((found) => current && setRequests(found));
    void loadBases().then((found) => current && setBases(found));
    return () => {
      current = false;
    };
  }, [load, loadWaitingRequests, loadBases, logVersion]);

  async function decide(line: InventoryLine, carrier: NamedCarrier, approve: boolean) {
    setBusy(true);
    setProblem(null);
    const ref = { id: line.id, carrier, version: line.version };
    if (approve && also.includes(line.id)) {
      const saved = await runCommand(registry, db, user, saveHomebrewEntry, { campaignId: campaign.id, campaignName: campaign.name, kind: 'item', data: homebrewItem(line) });
      if (!saved.ok) {
        setBusy(false);
        return setProblem(saved.message);
      }
    }
    let edits: { name: string; weightCoin: number | null; slots: number | null } | undefined;
    if (approve && editing?.id === line.id) {
      const number = (text: string) => (text.trim() === '' ? null : /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN);
      const weightCoin = number(editing.weight);
      const slots = number(editing.slots);
      if (Number.isNaN(weightCoin) || Number.isNaN(slots)) {
        setBusy(false);
        return setProblem('Weight and slots must be whole numbers.');
      }
      edits = { name: editing.name, weightCoin, slots };
    }
    const result = approve
      ? await runCommand(registry, db, user, approveItem, { line: ref, edits })
      : await runCommand(registry, db, user, declineItem, { line: ref });
    if (result.ok) setEditing(null);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.message);
      // Changed by its player since: show the latest, to decide again.
      if (result.reason === 'stale') setWaiting((await load()) ?? []);
      return;
    }
    setWaiting((await load()) ?? []);
    onChanged();
  }

  async function basesChanged() {
    setBases(await loadBases());
    onChanged();
  }

  async function requestsChanged() {
    setRequests(await loadWaitingRequests());
    onChanged();
  }

  const loading = waiting === null || requests === null || bases === null;
  // Each of its own items, whole, as it always was: a one-off with its words, a base to pick, a request's card.
  const oneOff = (line: InventoryLine, carrier: NamedCarrier) => (
    <ul className="pack__rows">
          <li className="pack__item">
            <p className="auth__meta">Items players made up. They count for nothing until you approve them.</p>
            <p className="pack__name">
              {line.name}
              {line.qty > 1 && <span className="pack__qty"> ×{line.qty}</span>}
              <span className="auth__meta">
                , {carrier.name}
                {line.weightCoin !== null ? `, ${line.weightCoin} coins` : ''}
              </span>
            </p>
            <div className="pack__actions" role="group" aria-label={`${line.name} for ${carrier.name}`}>
              <label className="pack__check">
                <input
                  type="checkbox"
                  checked={also.includes(line.id)}
                  onChange={(event) => setAlso(event.target.checked ? [...also, line.id] : also.filter((id) => id !== line.id))}
                />
                Also add to the campaign homebrew
              </label>
              <button type="button" className="button-secondary" aria-busy={busy} onClick={() => void decide(line, carrier, true)}>
                Approve
              </button>
              {editing?.id !== line.id && (
                <button
                  type="button"
                  className="button-secondary button-secondary--small"
                  aria-busy={busy}
                  onClick={() => setEditing({ id: line.id, name: line.name, weight: line.weightCoin === null ? '' : String(line.weightCoin), slots: line.slots === null ? '' : String(line.slots) })}
                >
                  Edit first
                </button>
              )}
              <button type="button" className="button-secondary button-secondary--small" aria-busy={busy} onClick={() => void decide(line, carrier, false)}>
                Decline
              </button>
            </div>
            {editing?.id === line.id && (
              <div className="pack__sheet" role="group" aria-label={`Edit ${line.name}`}>
                <div className="field">
                  <label className="label" htmlFor={`edit-${line.id}-name`}>
                    Name
                  </label>
                  <input id={`edit-${line.id}-name`} className="field__input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor={`edit-${line.id}-weight`}>
                    Weight in coins
                  </label>
                  <input id={`edit-${line.id}-weight`} className="field__input field__input--short" inputMode="numeric" value={editing.weight} onChange={(e) => setEditing({ ...editing, weight: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label" htmlFor={`edit-${line.id}-slots`}>
                    Slots
                  </label>
                  <input id={`edit-${line.id}-slots`} className="field__input field__input--short" inputMode="numeric" value={editing.slots} onChange={(e) => setEditing({ ...editing, slots: e.target.value })} />
                </div>
                <p className="auth__meta">Approve saves these changes.</p>
              </div>
            )}
          </li>
    </ul>
  );
  const items: WaitingSourceItem[] = loading
    ? []
    : [
        ...waiting.map(({ line, carrier }): WaitingSourceItem => ({
          id: `oneOff:${line.id}`,
          kind: 'playerItem',
          title: `${line.name}${line.qty > 1 ? ` ×${line.qty}` : ''}, ${carrier.name}`,
          actions: [],
          card: oneOff(line, carrier),
        })),
        ...bases.list.map(({ line, carrier, choices }): WaitingSourceItem => ({
          id: `base:${line.id}`,
          kind: 'playerItem',
          title: `Pick the base for ${line.name} (worn by ${carrier.name})`,
          actions: [],
          card: (
            <ul className="pack__rows">
              <GmBasePickCard db={db} user={user} line={line} carrier={carrier} choices={choices} nameOf={(id) => bases.names.get(id) ?? id} onChanged={() => void basesChanged()} />
            </ul>
          ),
        })),
        ...requests.list.map((request): WaitingSourceItem => {
          const who = request.actorId ? (requests.names.get(request.actorId) ?? 'A character') : 'The party';
          return {
            id: `request:${request.id}`,
            kind: 'playerItem',
            title: request.kind === 'escapeRoll' ? `${who}, escape roll` : request.text ? `${who} asks: ${request.text}` : `${who} asks`,
            actions: [],
            card: (
              <ul className="pack__rows">
            <GmRequestCard
              db={db}
              user={user}
              campaign={campaign}
              request={request}
              who={who}
              doomTable={requests.doomTable}
              hirelings={request.kind === 'escapeRoll' && request.requesterId ? (requests.hirelings.get(request.requesterId) ?? []) : []}
              secret={request.kind === 'secretActivity' ? (requests.secrets.get(request.id) ?? null) : undefined}
              acting={request.kind === 'secretActivity' ? (readSecretActivityPrompt(request.prompt)?.actorIds ?? []).map((id) => requests.names.get(id) ?? 'A character') : undefined}
              budget={requests.budget}
              trade={requests.trades.get(request.id) ?? null}
              onChanged={() => void requestsChanged()}
              onLost={(table) => setLost({ table, who })}
              onTable={(table) => setTableOpen({ table, who })}
            />
              </ul>
            ),
          };
        }),
      ];
  const cards = useWaitingSource('players', items);
  return (
    <>
      <WaitingPanel quiet={quiet} loading={loading} />
      {cards}
      {lost && <LostBelowDialog table={lost.table} who={lost.who} onClose={() => setLost(null)} />}
      {tableOpen && <TableDialog table={tableOpen.table} title={tableOpen.table.name} intro={`For ${possessive(tableOpen.who)} secret activity. Roll on the pack's table; tell them what comes of it.`} onClose={() => setTableOpen(null)} />}
    </>
  );
}

/**
 * Each kind's mark at a row's left (the step symbols' line icons, as the facts above use them); an encounter's is the
 * set's crossed swords (sf-3; page 44, EN1 and PS2 B), drawn by `KindMark`.
 */
const MARK: Record<Exclude<WaitingKind, 'encounter'>, string> = {
  expeditionEnd: 'camp',
  rest: 'rest',
  weather: 'weather',
  reminder: 'time',
  decision: 'note',
  playerItem: 'note',
  way: 'travel',
};

/** A kind's mark, open (28) or on its row (24). */
function KindMark({ kind, size }: { kind: WaitingKind; size: number }) {
  return kind === 'encounter' ? <Icon name={ENCOUNTER_MARK} size={size} /> : <StepIcon name={MARK[kind]} size={size} />;
}

/**
 * The panel (S8; page 16, T2, T6b, T8b): the heading and its count ("1 of 4", wy-1), the open item whole, the others
 * as one-line rows, "N more" past four, "Nothing waits." when empty. `loading`: its own list is still being read (it
 * says "Opening…" under what else waits, and, when `quiet`, stays out while nothing else waits).
 */
export function WaitingPanel({ quiet = false, loading = false }: { quiet?: boolean; loading?: boolean }) {
  const panel = useWaitingState();
  if (!panel) return null;
  const { view, items, openRow: open, act } = panel;
  // "N more" opens the first it holds after the open one (wrapping round), so taps on it go through them all.
  const at = (id: string) => items.findIndex((i) => i.id === id);
  const nextHeld = (ids: string[]) => ids.find((id) => at(id) > (view.openId ? at(view.openId) : -1)) ?? ids[0]!;
  const hidden = quiet && view.empty;
  return (
    <section className="waiting-card" aria-label="Waiting for you" hidden={hidden}>
      <div className="waiting-card__head">
        <h2 className="waiting-card__title">Waiting for you</h2>
        {view.count && <span className="waiting-card__count">{`${view.count.open} of ${view.count.total}`}</span>}
      </div>
      {view.empty && !loading && <p className="waiting-card__none">Nothing waits.</p>}
      {view.entries.map((entry) =>
        'card' in entry ? (
          <div key={entry.card.id} className="waiting-open" data-kind={entry.card.kind} data-title={entry.card.title}>
            <span className="waiting-open__mark" aria-hidden="true">
              <KindMark kind={entry.card.kind} size={28} />
            </span>
            <CardHost id={entry.card.id} />
          </div>
        ) : 'row' in entry ? (
          <WaitingRowLine key={entry.row.id} row={entry.row} onOpen={() => open(entry.row.id)} onAct={(actionId) => act(entry.row.id, actionId)} />
        ) : (
          <div key="more" className="waiting-row waiting-row--more">
            <span className="waiting-row__mark" aria-hidden="true" />
            <button type="button" className="waiting-row__open" onClick={() => open(nextHeld(entry.more.ids))}>
              <span className="waiting-row__title">{`${entry.more.count} more`}</span>
              <Icon name="chevron" size={20} />
            </button>
          </div>
        ),
      )}
      {loading && (
        <p role="status" className="auth__meta">
          Opening…
        </p>
      )}
    </section>
  );
}

/** A one-line row: the mark, the title (a tap opens the item whole), its one button (never the accent). */
function WaitingRowLine({ row, onOpen, onAct }: { row: WaitingRow; onOpen: () => void; onAct: (actionId: string) => void }) {
  const button = row.button;
  return (
    <div className="waiting-row" data-kind={row.kind}>
      <span className="waiting-row__mark" aria-hidden="true">
        <KindMark kind={row.kind} size={24} />
      </span>
      <button type="button" className="waiting-row__open" aria-label={`Open: ${row.title}`} onClick={onOpen}>
        <span className="waiting-row__title">{row.title}</span>
      </button>
      {button &&
        (button.icon && isSetIconName(button.icon) ? (
          <StackedButton icon={button.icon} label={button.label} aria-label={`${button.label}, ${row.title}`} onClick={() => onAct(button.id)} />
        ) : (
          <button type="button" className="button-secondary" aria-label={`${button.label}, ${row.title}`} onClick={() => onAct(button.id)}>
            {button.label}
          </button>
        ))}
    </div>
  );
}
