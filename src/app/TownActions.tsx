// A player's town (M5b step 6e; docs/plans/m5b-6-settlements.md "Step 6e"; ruled 2026-10-30, ST5–ST9; dt-11 and
// st-3; 06 "Town on Scene" and Components "Buy request", "Sale offer", "Lodging picker", "Town activities",
// "Overnight summary"). Under the places in town the GM shows (TownLine), for the player's own character:
//   Ask for… (ST5): a shop the GM shows, then an item from the town's list (the setting's items for sale) or
//   Something not listed…; it goes to the GM as a request.
//   Sell… (ST6): an item from the character's pack (how many, for a stack), and the buyer (a shop the GM shows that
//   buys, or someone by name); the GM makes an offer.
//   Where you stay (ST7, dt-11): the lodgings the GM shows, open, with their rates (picked at once, Undo on the
//   toast), or Somewhere else… (waits for the GM's yes).
//   Things to do (ST8): the town mode's activities and the setting's town services, each rule behind ›, and
//   Something else…; each goes to the GM, who narrates.
//   The overnight card (ST9): each morning in town, last night's lodging and its cost, and the statuses that changed
//   overnight, until Got it. Costs are text until purses (M7b).
import { useEffect, useId, useState } from 'react';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import type { TimeUnits } from '../modules/expedition/clock.ts';
import type { Activity } from '../modules/expedition/modes.ts';
import { shownInPlay, townPlacesOf, type TownRules } from '../modules/expedition/town.ts';
import type { SceneTown } from '../modules/expedition/townPlaces.ts';
import { loadInventory, type InventoryLine } from '../modules/inventory/inventory.ts';
import { entriesInPlay } from '../modules/library/optionGate.ts';
import { loadRequests, sendRequest, type Request } from '../modules/requests/requests.ts';
import { chooseStay, currentStay, loadStatusChanges, morningOf, overnightLines, stayFor, type StatusChange } from '../modules/requests/townRequests.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { HowMany, OptionRow } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import { forSale, priceText } from './AddItem.tsx';
import type { CampaignSetting } from './campaignSetting.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { useLogVersion } from './campaignLog.tsx';
import { usePlayerOnly } from './playerOnly.tsx';
import { registry } from './services.ts';
import './TownScreen.css';

export interface TownActionsProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The town as the player's group sees it (the places the GM shows). */
  town: SceneTown;
  rules: TownRules | null;
  setting: CampaignSetting | null;
  /** The player's own character on this screen. */
  character: { id: string; name: string };
  /** The town mode's activities (the mode the party is in, or was last in), and its step's words ("a part of the day"). */
  activities: readonly Activity[];
  stepWords: (steps: number) => string;
  /** The campaign clock now, and its units (the overnight card's morning). */
  now: number;
  units: TimeUnits | null;
}

type Open = 'ask' | 'sell' | 'stay' | 'todo' | null;

/** The services of a kind the GM shows in this town (by their place-in-town key), open or closed. */
function shownServices(town: SceneTown, rules: TownRules | null, kind: 'buy' | 'sell') {
  return town.places.flatMap((p) => {
    if (!p.key.startsWith('service:')) return [];
    const service = rules?.services.find((s) => `service:${s.id}` === p.key);
    return service && service.kind === kind ? [{ ...p, service }] : [];
  });
}

export function TownActions(props: TownActionsProps) {
  const { db, user, campaign, town, rules, character } = props;
  const show = useToast();
  const logVersion = useLogVersion();
  const [open, setOpen] = useState<Open>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [version, setVersion] = useState(0);
  // In the GM's view as the player, sending a request and choosing a lodging are the player's: a pop-up says so (pg32-6).
  const playerOnly = usePlayerOnly();

  useEffect(() => {
    let current = true;
    void loadRequests(db, campaign.id, { limit: 200 }).then((found) => current && setRequests((found ?? []).filter((r) => r.actorId === character.id)));
    return () => {
      current = false;
    };
  }, [db, campaign.id, character.id, logVersion, version]);

  const buyers = shownServices(town, rules, 'sell');
  const shops = shownServices(town, rules, 'buy');
  const lodgings = shownInPlay(town.places, rules).filter((p) => p.kind === 'lodging');
  const todo = [...props.activities.map((a) => ({ id: a.id, name: a.name, rule: [a.result, a.note].filter(Boolean).join(', '), cost: a.cost && 'steps' in a.cost && a.cost.steps > 0 ? props.stepWords(a.cost.steps) : '' })), ...(rules?.services ?? []).filter((s) => s.kind === 'other').map((s) => ({ id: `service:${s.id}`, name: s.name, rule: s.note, cost: '' }))];
  const stay = currentStay(requests, character.id, town.name);
  const asking = { id: character.id, campaignId: campaign.id, ownerUserId: user.id };

  async function send(kind: 'buy' | 'sell' | 'lodging' | 'askGm', text: string, prompt: Record<string, unknown>, costText = '') {
    if (playerOnly.blocked('sendRequest')) return false;
    const done = await runCommand(registry, db, user, sendRequest, { character: asking, kind, text, costText, prompt });
    setVersion((v) => v + 1);
    if (!done.ok) {
      show({ text: done.message, error: true });
      return false;
    }
    setOpen(null);
    show({
      text: 'Sent to the GM',
      onUndo: async () => {
        const eventId = await latestChange(db, campaign.id, sendRequest.name, user.id);
        const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
        if (!undone) show({ text: 'Nothing to undo.', error: true });
        else if (!undone.ok) show({ text: undone.message, error: true });
        setVersion((v) => v + 1);
      },
    });
    return true;
  }

  async function stayAt(key: string, name: string, rate: string) {
    if (playerOnly.blocked('stayHere')) return;
    const done = await runCommand(registry, db, user, chooseStay, { character: asking, stay: { listed: true, key, name, rate, at: props.now, town: town.name } });
    setVersion((v) => v + 1);
    if (!done.ok) return show({ text: done.message, error: true });
    setOpen(null);
    show({
      text: `Staying at ${name}${rate ? `, ${rate}` : ''}`,
      onUndo: async () => {
        const eventId = await latestChange(db, campaign.id, chooseStay.name, user.id);
        const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
        if (!undone) show({ text: 'Nothing to undo.', error: true });
        else if (!undone.ok) show({ text: undone.message, error: true });
        setVersion((v) => v + 1);
      },
    });
  }

  return (
    <section className="town-actions" aria-label={`In ${town.name}: ${character.name}`}>
      <Overnight {...props} requests={requests} />
      <p className="place-card__hint">{stay ? `${character.name} stays at ${stay.name}${stay.rate ? `, ${stay.rate}` : ''}` : `${character.name} has nowhere to stay yet`}</p>
      <div className="town-actions__buttons">
        {shops.length > 0 && (
          <button type="button" className="button-secondary" onClick={() => playerOnly.blocked('sendRequest') || setOpen('ask')}>
            Ask for…
          </button>
        )}
        <button type="button" className="button-secondary" onClick={() => playerOnly.blocked('sendRequest') || setOpen('sell')}>
          Sell…
        </button>
        <button type="button" className="button-secondary" onClick={() => setOpen('stay')}>
          Where you stay
        </button>
        <button type="button" className="button-secondary" onClick={() => setOpen('todo')}>
          Things to do
        </button>
      </div>
      {open === 'ask' && <AskFor shops={shops} setting={props.setting} onSend={send} onClose={() => setOpen(null)} />}
      {open === 'sell' && <SellItem db={db} campaignId={campaign.id} characterId={character.id} buyers={buyers} onSend={send} onClose={() => setOpen(null)} />}
      {open === 'stay' && (
        <WhereYouStay
          lodgings={lodgings}
          rules={rules}
          current={stay?.name ?? null}
          onStay={(key, name, rate) => void stayAt(key, name, rate)}
          onElsewhere={(name) => send('lodging', `Staying at ${name}`, { listed: false, key: '', name, rate: '', at: props.now, town: town.name })}
          onClose={() => setOpen(null)}
        />
      )}
      {playerOnly.sheet}
      {open === 'todo' && <ThingsToDo todo={todo} onSend={(t, text) => send('askGm', text, { townActivity: t?.id ?? null, name: t?.name ?? '', rule: t?.rule ?? '' }, t?.cost ?? '')} onClose={() => setOpen(null)} />}
    </section>
  );
}

type Send = (kind: 'buy' | 'sell' | 'lodging' | 'askGm', text: string, prompt: Record<string, unknown>, costText?: string) => Promise<boolean>;

function SomethingField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="field__input" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p className="form-error" role="alert">
      {text}
    </p>
  ) : null;
}

/** Ask for… (ST5): the shop, then an item from the town's list or Something not listed…. */
function AskFor({ shops, setting, onSend, onClose }: { shops: ReturnType<typeof shownServices>; setting: CampaignSetting | null; onSend: Send; onClose: () => void }) {
  const findId = useId();
  const [shop, setShop] = useState(shops.length === 1 ? shops[0]!.key : null);
  const [find, setFind] = useState('');
  const [item, setItem] = useState<string | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const items = entriesInPlay(setting?.items ?? []).filter(forSale);
  const query = find.trim().toLowerCase();
  const matches = (query ? items.filter((e) => e.name.toLowerCase().includes(query)) : items).slice(0, 30);
  const picked = items.find((e) => e.packEntryId === item);
  const chosen = shops.find((s) => s.key === shop);
  return (
    <Dialog label="Ask for…" onClose={onClose}>
      {shops.length > 1 && (
        <div role="radiogroup" aria-label="Which shop">
          {shops.map((s) => (
            <OptionRow key={s.key} name={s.name} summary={s.open ? s.service.note : `Closed: ${s.service.note}`} selected={shop === s.key} onPick={() => setShop(s.key)} />
          ))}
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor={findId}>
          Find an item
        </label>
        <input id={findId} className="field__input" autoComplete="off" value={find} onChange={(e) => setFind(e.target.value)} />
      </div>
      <div role="radiogroup" aria-label="Items">
        {matches.map((e) => (
          <OptionRow
            key={e.packEntryId}
            name={e.name}
            summary={priceText(e.data.value)}
            selected={item === e.packEntryId && other === null}
            onPick={() => {
              setItem(e.packEntryId);
              setOther(null);
            }}
          />
        ))}
        {matches.length === 0 && <p className="place-card__hint">{query ? 'Nothing on the list by that name.' : 'The setting lists nothing for sale.'}</p>}
        <OptionRow name="Something not listed…" summary="Say what you're after; the GM prices it" selected={other !== null} onPick={() => setOther(other ?? find.trim())} />
      </div>
      {other !== null && <SomethingField label="What you're after" value={other} onChange={setOther} />}
      <Problem text={problem} />
      <div className="pack__actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (!chosen) return setProblem('Pick a shop first.');
            if (!chosen.open) return setProblem(`${chosen.name} is closed just now.`);
            const name = other !== null ? other.trim() : picked?.name;
            if (!name) return setProblem(other !== null ? 'Say what you’re after.' : 'Pick an item, or Something not listed….');
            setProblem(null);
            const price = other === null && picked ? priceText(picked.data.value) : '';
            void onSend('buy', `${name}, ${chosen.name}`, { serviceId: chosen.service.id, shop: chosen.name, itemId: other === null ? (picked?.packEntryId ?? null) : null, item: name, price });
          }}
        >
          Send to the GM
        </button>
      </div>
    </Dialog>
  );
}

/** Sell… (ST6): the item (how many), then the buyer: a shop that buys, or someone by name. */
function SellItem({ db, campaignId, characterId, buyers, onSend, onClose }: { db: Db; campaignId: string; characterId: string; buyers: ReturnType<typeof shownServices>; onSend: Send; onClose: () => void }) {
  const [lines, setLines] = useState<InventoryLine[] | null | 'error'>(null);
  const [line, setLine] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [buyer, setBuyer] = useState<string | null>(buyers.length === 1 ? buyers[0]!.key : null);
  const [person, setPerson] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void loadInventory(db, campaignId).then((found) => current && setLines(found ? found.lines.filter((l) => l.actorId === characterId && l.approval === 'approved') : 'error'));
    return () => {
      current = false;
    };
  }, [db, campaignId, characterId]);
  const picked = lines && lines !== 'error' ? lines.find((l) => l.id === line) : undefined;
  return (
    <Dialog label="Sell…" onClose={onClose}>
      <h3 className="label">What you sell</h3>
      {lines === null && <p className="place-card__hint">Loading your pack…</p>}
      {lines === 'error' && <p className="form-error">Couldn't load your pack. Check your connection and try again.</p>}
      {lines !== null && lines !== 'error' && lines.length === 0 && <p className="place-card__hint">Your pack is empty.</p>}
      {lines !== null && lines !== 'error' && (
        <div role="radiogroup" aria-label="What you sell">
          {lines.map((l) => (
            <OptionRow
              key={l.id}
              name={l.qty > 1 ? `${l.name} ×${l.qty}` : l.name}
              summary={l.equipped ? 'In use' : ''}
              selected={line === l.id}
              onPick={() => {
                setLine(l.id);
                setQty(l.qty);
              }}
            />
          ))}
        </div>
      )}
      {picked && picked.qty > 1 && <HowMany of={picked.qty} value={Math.min(qty, picked.qty)} onChange={setQty} />}
      <h3 className="label">Who buys it</h3>
      <div role="radiogroup" aria-label="Who buys it">
        {buyers.map((b) => (
          <OptionRow key={b.key} name={b.name} summary={b.open ? b.service.note : `Closed: ${b.service.note}`} selected={buyer === b.key} onPick={() => setBuyer(b.key)} />
        ))}
        <OptionRow name="Someone else…" summary="A person you name" selected={buyer === 'person'} onPick={() => setBuyer('person')} />
      </div>
      {buyer === 'person' && <SomethingField label="Who" value={person} onChange={setPerson} />}
      <Problem text={problem} />
      <div className="pack__actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (!picked) return setProblem('Pick what you sell.');
            const shop = buyers.find((b) => b.key === buyer);
            if (!shop && buyer !== 'person') return setProblem('Pick who buys it.');
            if (shop && !shop.open) return setProblem(`${shop.name} is closed just now.`);
            const who = shop ? shop.name : person.trim();
            if (!who) return setProblem('Say who buys it.');
            setProblem(null);
            const count = Math.min(qty, picked.qty);
            void onSend('sell', `${picked.name}${count > 1 ? ` ×${count}` : ''} to ${who}`, { lineId: picked.id, item: picked.name, itemId: picked.sourceEntryId, qty: count, of: picked.qty, serviceId: shop?.service.id ?? null, buyer: who });
          }}
        >
          Send to the GM
        </button>
      </div>
    </Dialog>
  );
}

/** Where you stay (ST7, dt-11): the lodgings the GM shows, with their rates; Somewhere else… waits for the GM. */
function WhereYouStay({
  lodgings,
  rules,
  current,
  onStay,
  onElsewhere,
  onClose,
}: {
  lodgings: SceneTown['places'];
  rules: TownRules | null;
  current: string | null;
  onStay: (key: string, name: string, rate: string) => void;
  onElsewhere: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const known = townPlacesOf(rules);
  const rateOf = (key: string) => rules?.lodgings.find((l) => `lodging:${l.name.toLowerCase()}` === key)?.rate ?? '';
  const [pick, setPick] = useState<string | null>(lodgings.find((l) => l.name === current)?.key ?? null);
  const [elsewhere, setElsewhere] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <Dialog label="Where you stay" onClose={onClose}>
      <div role="radiogroup" aria-label="Where you stay">
        {lodgings.map((l) => (
          <OptionRow key={l.key} name={l.name} summary={[rateOf(l.key) || known.find((k) => k.key === l.key)?.words || '', l.open ? '' : 'Closed'].filter(Boolean).join(', ')} selected={pick === l.key} onPick={() => setPick(l.key)} />
        ))}
        <OptionRow name="Somewhere else…" summary="A friend, a temple cot, your own hall: the GM says yes" selected={pick === 'elsewhere'} onPick={() => setPick('elsewhere')} />
      </div>
      {pick === 'elsewhere' && <SomethingField label="Where" value={elsewhere} onChange={setElsewhere} />}
      <p className="place-card__hint">The cost is noted in words for now; purses come later. Change any time.</p>
      <Problem text={problem} />
      <div className="pack__actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (pick === 'elsewhere') {
              if (!elsewhere.trim()) return setProblem('Say where you stay.');
              setProblem(null);
              return void onElsewhere(elsewhere.trim());
            }
            const l = lodgings.find((x) => x.key === pick);
            if (!l) return setProblem('Pick where you stay.');
            if (!l.open) return setProblem(`${l.name} is closed just now.`);
            setProblem(null);
            onStay(l.key, l.name, rateOf(l.key));
          }}
        >
          Stay here
        </button>
      </div>
    </Dialog>
  );
}

interface TodoItem {
  id: string;
  name: string;
  rule: string;
  cost: string;
}

/** Things to do (ST8): each with its rule one tap away, and Something else…; the GM narrates what comes of it. */
function ThingsToDo({ todo, onSend, onClose }: { todo: readonly TodoItem[]; onSend: (t: TodoItem | null, text: string) => Promise<boolean>; onClose: () => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = todo.find((t) => t.id === pick);
  return (
    <Dialog label="Things to do" onClose={onClose}>
      <div role="radiogroup" aria-label="Things to do">
        {todo.map((t) => (
          <OptionRow key={t.id} name={t.name} summary={t.cost} selected={pick === t.id} onPick={() => setPick(t.id)} />
        ))}
        <OptionRow name="Something else…" summary="Say what you do; the GM tells you what comes of it" selected={pick === 'other'} onPick={() => setPick('other')} />
      </div>
      {chosen?.rule && <p className="request__note">{chosen.rule}</p>}
      {pick === 'other' && <SomethingField label="What you do" value={other} onChange={setOther} />}
      <Problem text={problem} />
      <div className="pack__actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (pick === 'other') {
              if (!other.trim()) return setProblem('Say what you do.');
              setProblem(null);
              return void onSend(null, other.trim());
            }
            if (!chosen) return setProblem('Pick something to do.');
            setProblem(null);
            void onSend(chosen, chosen.name);
          }}
        >
          Send to the GM
        </button>
      </div>
    </Dialog>
  );
}

// The mornings this device has read (Got it), newest last: kept on the device (like Not now on the arrival card), so
// the card comes once per morning even after the app is opened again.
const SEEN_KEY = 'grimoire.overnightSeen';
function readSeen(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as unknown;
    return Array.isArray(saved) ? saved.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}
function useSeen(): [string[], (key: string) => void] {
  const [seen, setSeen] = useState<string[]>(readSeen);
  const add = (key: string) => {
    const next = [...readSeen().filter((k) => k !== key), key].slice(-50);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // Not kept: the card comes back next time the app opens.
    }
    setSeen(next);
  };
  return [seen, add];
}

/** The overnight card (ST9): the morning's short card, until Got it (kept on this device, one per morning). */
function Overnight({ db, user, campaign, town, character, now, units, requests }: TownActionsProps & { requests: Request[] }) {
  const logVersion = useLogVersion();
  const morning = units ? morningOf(now, units) : null;
  const [seen, markSeen] = useSeen();
  const [changes, setChanges] = useState<StatusChange[] | null>(null);
  const key = morning ? `${user.id}:${campaign.id}:${character.id}:${morning.index}` : '';
  useEffect(() => {
    let current = true;
    if (!morning || seen.includes(key)) return;
    void loadStatusChanges(db, campaign.id, character.id, morning.nightStart, morning.start).then((found) => current && setChanges(found ?? []));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, campaign.id, character.id, key, logVersion]);
  if (!morning || !morning.showing || seen.includes(key) || changes === null) return null;
  const lines = overnightLines(stayFor(requests, character.id, town.name, morning.start), changes);
  if (lines.length === 0) return null;
  return (
    <article className="request request--answered" aria-label="Overnight">
      <p className="request__title">{`Morning in ${town.name}`}</p>
      {lines.map((line) => (
        <p key={line} className="request__text">
          {line}
        </p>
      ))}
      <button type="button" className="button-secondary button-secondary--small" onClick={() => markSeen(key)}>
        Got it
      </button>
    </article>
  );
}
