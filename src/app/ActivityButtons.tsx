// The players' activity buttons (M5b step 3, build order 2; ruled 2026-10-30, D3, S4-1, S4-8; docs/05 "Activities",
// "The players' wilderness screen"; docs/06 "Wilderness on Scene"): the pack's non-secret activities usable here and
// now, by their own names, in the travel card's button group beside Force march. Tapping one opens its sheet: who's
// acting (the screen's own character first), the cost line, the roll instructions with each modifier and its source,
// a roll per character, what it gives on a success (with how many, from its dice), then It worked / It didn't work
// (or Done with no roll). One tap applies the cost and the yield ("3 Reed bundles → Reed's pack") with Undo; the GM
// sees it live (the log) and can undo it. A yield that counts `units` (G-108) asks for single pieces ("How many Ration
// day (Rations, 1 week)?") and puts that many in the pack; one that counts whole items puts each one's bundle. A secret activity (S4-3; build order 3) is a request button showing its
// cost ("Search the area · 3 travel points"): its sheet asks who's acting and sends one of g4's requests (kind
// secretActivity) to the GM, who gets the secret prompt in Waiting for you; the cost applies when the GM accepts.
// While one waits, the button says so and a second tap explains.
import { useEffect, useState } from 'react';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import {
  activityModifierWords,
  actorCap,
  actorsFor,
  costLine,
  mayName,
  finderOf,
  rollPlan,
  spendOf,
  usableActivities,
  yieldCounted,
  yieldLine,
  yieldPieces,
  type ActorFacts,
  type EnteredRoll,
  type Usable,
} from '../modules/expedition/activities.ts';
import { applyActivity, undoActivity, type ActivityOutcome } from '../modules/expedition/activityPlay.ts';
import { loadRequests, mine, readSecretActivityPrompt, sendRequest } from '../modules/requests/requests.ts';
import { unitFor, type TravelDay } from '../modules/expedition/travel.ts';
import type { ItemCopy } from '../modules/inventory/inventory.ts';
import type { ResolvedEntry } from '../modules/library/stack.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Chip, Stepper } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { bundleOf, copyOf } from './AddItem.tsx';
import type { OpenCampaign } from './Campaigns.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { usePlayerOnly } from './playerOnly.tsx';
import { registry } from './services.ts';
import type { TravelView } from './travelView.ts';
import { terrainOf } from './travelView.ts';

export interface ActivityButtonsProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  group: number;
  view: TravelView;
  /** Today's travel row (null before the day starts: no buttons). */
  row: (TravelDay & { terrainId?: string | null }) | null;
  /** The screen's own character and what's known of them (skills, carried items). */
  actor: ActorFacts;
  /** The pack's items by their id, as copies to put in a pack (null: not in the setting rules). */
  itemOf: (id: string) => YieldItem | null;
  onChanged: () => void;
}

/** A yield's item: the copy for the pack, its bundle (07 `bundle`, 1 for most) and its single piece's name (`unitName`). */
export interface YieldItem {
  item: ItemCopy;
  bundle: number;
  unitName: string | null;
}

/** A setting item as a yield's item (the same copy and bundle as buying it). */
export const yieldItemOf = (entry: ResolvedEntry): YieldItem => ({
  item: copyOf(entry),
  bundle: bundleOf(entry),
  unitName: typeof entry.data.unitName === 'string' && entry.data.unitName.trim() ? entry.data.unitName.trim() : null,
});

/**
 * The pack's activities usable here and now that the screen's character may do, in the pack's order: the open ones
 * as buttons to do, the secret ones as request buttons (S4-3).
 */
export function offeredActivities(view: TravelView, terrainId: string | null | undefined, actor: ActorFacts): Usable[] {
  return usableActivities(view.mode, view.units, { terrain: terrainOf(view.mode, terrainId), season: view.season, choices: view.choices }).filter(
    (u) => actorsFor(u.activity, [actor]).length > 0,
  );
}

/** The request button's words (S4-3): "Search the area · 3 travel points". */
export const secretButtonLabel = (name: string, cost: string) => `${name}, ${cost}`;

export function ActivityButtons({ db, user, campaign, group, view, row, actor, itemOf, onChanged }: ActivityButtonsProps) {
  const show = useToast();
  const logVersion = useLogVersion();
  const [open, setOpen] = useState<Usable | null>(null);
  // The secret activities this player has asked for and the GM hasn't answered, by the activity's id.
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(new Set());
  const hasSecret = row ? offeredActivities(view, row.terrainId, actor).some((u) => u.activity.secret) : false;
  useEffect(() => {
    if (!hasSecret) return;
    let current = true;
    void loadRequests(db, campaign.id, { waiting: true }).then((found) => {
      if (!current || !found) return;
      const ids = mine(found, user.id)
        .filter((r) => r.kind === 'secretActivity' && r.status === 'waiting')
        .flatMap((r) => readSecretActivityPrompt(r.prompt)?.activityId ?? []);
      setWaiting(new Set(ids));
    });
    return () => {
      current = false;
    };
  }, [db, campaign.id, user.id, hasSecret, logVersion]);
  if (!row) return null;
  const offered = offeredActivities(view, row.terrainId, actor);
  const left = Math.max(0, row.total - row.spent);
  const unit = { one: unitFor(1, view.travel.unit), many: view.travel.unit };
  return (
    <>
      {offered.map((u) =>
        u.activity.secret ? (
          <button
            key={u.activity.id}
            type="button"
            className="button-secondary travel__activity"
            onClick={() => (waiting.has(u.activity.id) ? show({ text: `Already asked: the GM hasn't answered ${u.activity.name} yet.` }) : setOpen(u))}
          >
            {waiting.has(u.activity.id) ? `${u.activity.name}, waiting for the GM` : secretButtonLabel(u.activity.name, costLine(u.cost, left, view.travel.name, unit))}
          </button>
        ) : (
          <button key={u.activity.id} type="button" className="button-secondary travel__activity" onClick={() => setOpen(u)}>
            {u.activity.name}
          </button>
        ),
      )}
      {open && (
        <ActivitySheet db={db} user={user} campaign={campaign} group={group} view={view} row={row} actor={actor} usable={open} itemOf={itemOf} onChanged={onChanged} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

const wholeDice = (dice: string) => (/^\s*\d+\s*$/.test(dice) ? Number(dice) : null);

function ActivitySheet({
  db,
  user,
  campaign,
  group,
  view,
  row,
  actor,
  usable,
  itemOf,
  onChanged,
  onClose,
}: Omit<ActivityButtonsProps, 'row'> & { row: TravelDay & { terrainId?: string | null }; usable: Usable; onClose: () => void }) {
  const show = useToast();
  const { activity } = usable;
  const left = Math.max(0, row.total - row.spent);
  // Who may act: the group's characters (the screen's own first); `requires` is checked for the screen's character,
  // whose skills and pack this device knows; the others are offered, the table decides.
  // In an activity one character does, a player is offered only their own characters and hirelings (ac-1); the GM
  // anyone. The others aren't shown at all (nothing disabled).
  const travellers = view.travellers.get(group) ?? [];
  const gm = isGm(user, campaign.id);
  // The screen's own character is the reader's (a player's screen shows only their own; the database checks anyway).
  const ownerOf = (id: string) => travellers.find((t) => t.id === id)?.ownerUserId ?? (id === actor.id ? user.id : null);
  const others: ActorFacts[] = travellers
    .filter((t) => t.id !== actor.id && mayName(activity, gm, user.id, t.ownerUserId))
    .map((t) => ({ id: t.id, name: t.name, skills: new Set(activity.requires.skill ? [activity.requires.skill] : []), items: new Set(activity.requires.item ? [activity.requires.item] : []) }));
  const everyone = [actor, ...others];
  const cap = actorCap(activity, everyone.length);
  const [acting, setActing] = useState<string[]>(activity.who === 'party' ? everyone.map((a) => a.id) : [actor.id]);
  const [rolls, setRolls] = useState<Record<string, string>>({});
  const dice = usable.yields?.dice ?? '';
  const [qty, setQty] = useState<number>(wholeDice(dice) ?? 1);
  const [busy, setBusy] = useState(false);
  // In the GM's view as the player, Ask the GM is the player's: a pop-up says so (pg32-6, M3f2).
  const playerOnly = usePlayerOnly();

  // The group's members and the terrain, for the activity's modifiers keyed to the party (ex-2, ga-3).
  const plan = rollPlan(activity, actor, [], { members: view.party?.get(group), terrain: terrainOf(view.mode, row.terrainId) });
  const cost = costLine(usable.cost, left, view.travel.name, { one: unitFor(1, view.travel.unit), many: view.travel.unit });
  const spend = spendOf(usable.cost, left);
  const short = spend > left;
  const given = usable.yields ? itemOf(usable.yields.item) : null;
  const item = given?.item ?? null;
  const counted = item && usable.yields ? yieldCounted(usable.yields, item.name, given?.unitName) : '';
  const nameOf = (id: string) => everyone.find((a) => a.id === id)?.name ?? 'Someone';

  function toggle(id: string) {
    if (activity.who === 'party') return;
    if (acting.includes(id)) {
      if (acting.length === 1) return show({ text: 'Someone has to act: pick another first.' });
      return setActing(acting.filter((a) => a !== id));
    }
    if (activity.who === 'one') return setActing([id]);
    if (acting.length >= cap) return show({ text: `${cap === 1 ? 'One' : String(cap)} at most can do this.` });
    setActing([...acting, id]);
  }

  /** A secret activity (S4-3): one of g4's requests to the GM, with who's acting and the cost the GM's Yes applies. */
  async function ask() {
    if (busy || playerOnly.blocked('sendRequest')) return;
    setBusy(true);
    const result = await runCommand(registry, db, user, sendRequest, {
      character: { id: actor.id, campaignId: campaign.id, ownerUserId: user.id },
      kind: 'secretActivity',
      text: activity.name,
      costText: cost,
      prompt: { activityId: activity.id, group, actorIds: acting, spend: usable.cost.kind === 'budget' ? usable.cost.amount : 0 },
    });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    onClose();
    show({ text: `Sent to the GM: ${activity.name}` });
  }

  async function apply(outcome: ActivityOutcome) {
    if (busy) return;
    const entered: EnteredRoll[] = acting.filter((id) => rolls[id]?.trim()).map((id) => ({ actorId: id, roll: Number(rolls[id]) }));
    if (entered.some((r) => !Number.isInteger(r.roll))) return show({ text: 'A roll is a whole number.', error: true });
    const finder = finderOf(activity, acting, entered, plan.better);
    // The count entered is of single pieces (`units`) or of whole items, each its bundle (G-108, G-92). A bundle's line
    // is its single pieces, named by its unitName (the database names it so too), so the run's log line and Undo say
    // "3 Ration day", not "3 Rations (1 week)".
    const piece = given && given.bundle > 1 && given.unitName ? given.unitName : null;
    const found = outcome === 'worked' && item && usable.yields && finder ? { item: piece ? { ...item, name: piece } : item, qty: yieldPieces(usable.yields, qty, given?.bundle ?? 1) } : null;
    setBusy(true);
    const result = await runCommand(registry, db, user, applyActivity, {
      target: { campaignId: campaign.id, group, mine: true, who: activity.who, ownersNamed: [...acting, ...(finder ? [finder] : [])].map(ownerOf) },
      activity: { id: activity.id, name: activity.name },
      actorIds: acting,
      finderId: finder,
      rolls: entered,
      outcome,
      spend,
      yield: found,
    });
    setBusy(false);
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    onClose();
    const parts = [activity.name];
    if (outcome === 'failed') parts.push('it didn’t work');
    if (result.value.spent > 0) parts.push(`${result.value.spent} ${unitFor(result.value.spent, view.travel.unit)}`);
    if (found && finder) parts.push(yieldLine(qty, counted, nameOf(finder)));
    const runId = result.value.id;
    show({
      text: parts.join(', '),
      onUndo: () =>
        void runCommand(registry, db, user, undoActivity, { campaignId: campaign.id, runId, authorUserId: user.id }).then((undone) => {
          onChanged();
          if (!undone.ok) show({ text: undone.message, error: true });
        }),
    });
  }

  const best = activity.bestOf && acting.length > 1;
  return (
    <Dialog label={activity.name} onClose={onClose}>
      {playerOnly.sheet}
      <div className="activity">
        {activity.who !== 'party' && everyone.length > 1 ? (
          <div className="activity__who" role="group" aria-label="Who's acting">
            <p className="activity__label">{activity.who === 'one' ? 'Who acts?' : `Who's acting? ${cap < everyone.length ? `Up to ${cap}.` : ''}`}</p>
            <div className="activity__chips">
              {everyone.map((a) => (
                <Chip key={a.id} pressed={acting.includes(a.id)} onClick={() => toggle(a.id)}>
                  {`${acting.includes(a.id) ? '✓ ' : ''}${a.name}`}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <p className="activity__line">{activity.who === 'party' ? 'The whole group acts.' : `${actor.name} acts.`}</p>
        )}
        <p className="activity__line">
          <span className="activity__label">Cost: </span>
          {cost}
          {short && `, only ${left} left today`}
        </p>
        {/* A secret activity: its cost, then Ask the GM, with no line between on what the GM does (tfw-2, 2026-11-19). */}
        {activity.secret && (
          <div className="activity__actions">
            <button type="button" className="button-primary" onClick={() => void ask()}>
              Ask the GM
            </button>
            <button type="button" className="button-secondary button-secondary--small" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
        {!activity.secret && plan.instructions && (
          <div className="activity__roll">
            <p className="activity__line">{`${plan.instructions}${best ? ', each rolls, the best counts' : ''}`}</p>
            {plan.modifiers.length > 0 && (
              <ul className="activity__modifiers" aria-label="Modifiers">
                {plan.modifiers.map((m, i) => (!m.actor || acting.includes(m.actor.id) ? <li key={i}>{activityModifierWords(m)}</li> : null))}
              </ul>
            )}
            {acting.map((id) => (
              <div key={id} className="travel__roll">
                <label className="travel__roll-label" htmlFor={`activity-roll-${activity.id}-${id}`}>
                  {acting.length > 1 ? `${nameOf(id)} rolled` : 'Rolled'}
                </label>
                <input
                  id={`activity-roll-${activity.id}-${id}`}
                  className="travel__roll-input"
                  inputMode="numeric"
                  value={rolls[id] ?? ''}
                  onChange={(e) => setRolls({ ...rolls, [id]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        {!activity.secret && usable.result && <p className="activity__line">{`On a success: ${usable.result}`}</p>}
        {/* No line on what the GM rolls or adds, for a table's result or a yield whose item isn't in the setting (voice rule 16, tfw-2). */}
        {!activity.secret && usable.yields && item && (
          <div className="activity__yield">
            <Stepper label={`How many ${counted}?${wholeDice(dice) === null && dice ? ` Roll ${dice}.` : ''}`} value={qty} min={1} max={999} onChange={setQty} />
          </div>
        )}
        {!activity.secret && (
        <div className="activity__actions">
          {activity.chance ? (
            <>
              <button type="button" className="button-primary" onClick={() => void apply('worked')}>
                It worked
              </button>
              <button type="button" className="button-secondary" onClick={() => void apply('failed')}>
                It didn't work
              </button>
            </>
          ) : (
            <button type="button" className="button-primary" onClick={() => void apply('worked')}>
              Done
            </button>
          )}
          <button type="button" className="button-secondary button-secondary--small" onClick={onClose}>
            Cancel
          </button>
        </div>
        )}
      </div>
    </Dialog>
  );
}
