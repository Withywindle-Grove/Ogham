// The camp card for one group (M5b step 4, build orders 1–4; ruled 2026-10-30, D5, D13–D17, S4-5; docs/05 Camp;
// docs/06 "Wilderness on Scene": during camp the middle of the players' screen swaps to the camp steps). The camp's
// steps in the pack's order (camp.ts): set up and note lines; the **campfire** (lit or out, time left, "Add firewood
// from packs"); **cooking** (the cook's ingredients into portions in the pot); **campfire talk** (It worked / It
// didn't); **eating** (each character eats once: a portion from the pot first, then fresh, then preserved food from
// their own pack; the GM sees who hasn't eaten; Give food to a character with none, from your own pack); and the
// watches, night check and sleep as lines until their step is built (part 2). The GM sees and does all of it; a
// player does it for their own characters. Every change is at once, with Undo on the toast.
import { useEffect, useState } from 'react';
import { isGm, runCommand, type CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { latestChange, undoChange } from '../core/undo.ts';
import { campFire, campFlags, mealsOf, mealWords, ordinal, potOf, talkOf, watchesOf, WATCH_MAX, type CampEntry, type CampStep } from '../modules/expedition/camp.ts';
import { setHp } from '../modules/characters/hp.ts';
import { addStatus } from '../modules/expedition/statusPlay.ts';
import { loadMarchingOrders } from '../modules/expedition/marchingPlay.ts';
import { SleepStep, WatchesStep } from './CampNight.tsx';
import { addCampFuel, loadCasters, campSleep, campTalk, cookAtCamp, eatAtCamp, setCampWatches, type CampActor, type CampRow } from '../modules/expedition/campPlay.ts';
import { cookPortions, foodChoices, type FoodLine } from '../modules/expedition/eating.ts';
import { leftWords } from '../modules/expedition/lightPlay.ts';
import { foodKindOf } from '../modules/expedition/wildPack.ts';
import { loadInventory, moveItem, type CarrierRef, type InventoryLine } from '../modules/inventory/inventory.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Chip, Note, SkeletonRows, Stepper } from '../ui/parts.tsx';
import { useToast } from '../ui/ToastHost.tsx';
import type { CampInfo } from './campView.ts';
import type { OpenCampaign } from './Campaigns.tsx';
import { registry } from './services.ts';
import './CampCard.css';

export interface CampMember {
  id: string;
  name: string;
  ownerUserId: string | null;
  /** For a good rest's Heal (part 2). */
  hpCurrent?: number | null;
  hpMax?: number | null;
}

export interface CampCardProps {
  db: Db;
  user: CurrentUser;
  campaign: OpenCampaign;
  /** The group's name when the party is split ("Group 2"), else null. */
  groupLabel: string | null;
  info: CampInfo;
  camp: CampRow;
  entries: readonly CampEntry[];
  /** The group's characters and hirelings in play. */
  members: readonly CampMember[];
  /** The campaign clock now (seconds). */
  now: number;
  /** One hour in seconds (the campfire's time left), when the campaign's units have hours. */
  hour: number | null;
  /** The group forced the march today: the Sleep step says "Rest due (forced march)" (ruled 2026-11-03, SC-4-3 A). */
  forcedMarch?: boolean;
  onChanged: () => void;
}

type Sheet = { kind: 'fuel' } | { kind: 'cook' } | { kind: 'eat'; member: CampMember } | null;

/** "Heal 1": the pack's bonus effects in words (the onGoodRest shape). */
export function effectWords(effects: readonly Record<string, unknown>[]): string {
  return effects
    .map((e) =>
      Object.entries(e)
        .map(([key, value]) => `${key.charAt(0).toUpperCase()}${key.slice(1)} ${String(value)}`)
        .join(', '),
    )
    .join(', ');
}

const kindWord = (kind: string | null) => (kind ? ` (${kind})` : '');

export function CampCard({ db, user, campaign, groupLabel, info, camp, entries, members, now, hour, forcedMarch = false, onChanged }: CampCardProps) {
  const show = useToast();
  const gm = isGm(user, campaign.id);
  const [lines, setLines] = useState<InventoryLine[] | null | 'error'>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const linesKey = entries.map((e) => e.id).join(',');

  useEffect(() => {
    let current = true;
    void loadInventory(db, campaign.id).then((found) => current && setLines(found ? found.lines : 'error'));
    return () => {
      current = false;
    };
  }, [db, campaign.id, linesKey]);

  const mine = members.filter((m) => gm || m.ownerUserId === user.id);
  const actorOf = (m: CampMember): CampActor => ({ campaignId: campaign.id, id: m.id, ownerUserId: m.ownerUserId });
  const carried = (actorId: string) => (lines === null || lines === 'error' ? [] : lines.filter((l) => l.actorId === actorId && l.approval === 'approved' && l.qty > 0));
  const fire = campFire(entries, now);
  const pot = potOf(entries);
  const meals = mealsOf(entries);
  const talk = talkOf(entries);
  const cooking = info.camp.cooking ?? null;
  // Who casts (D18's warning): their class in the setting has spellcasting.
  const [casters, setCasters] = useState<Set<string>>(new Set());
  const memberKey = members.map((m) => m.id).join(',');
  useEffect(() => {
    let current = true;
    if (members.length === 0 || info.casterClasses.size === 0) return;
    void loadCasters(db, members.map((m) => m.id), info.casterClasses).then((found) => current && setCasters(found));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, memberKey, info.casterClasses]);

  // The group's marching order, front to back: Split evenly follows it (fl-3). Unread, the members' order stands in.
  const [order, setOrder] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void loadMarchingOrders(db, campaign.id).then((found) => current && found !== 'error' && setOrder(found.find((o) => o.group === camp.group)?.rows.flat()));
    return () => {
      current = false;
    };
  }, [db, campaign.id, camp.group]);

  const undoLatest = async (type: string) => {
    const eventId = await latestChange(db, campaign.id, type, user.id);
    const undone = eventId ? await runCommand(registry, db, user, undoChange, { campaignId: campaign.id, eventId, authorUserId: user.id }) : null;
    onChanged();
    if (!undone) show({ text: 'Nothing to undo.', error: true });
    else if (!undone.ok) show({ text: undone.message, error: true });
  };

  async function write<I>(command: { name: string }, input: I, done: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    const result = await runCommand(registry, db, user, command as never, input as never);
    setBusy(false);
    onChanged();
    if (!result.ok) {
      show({ text: result.message, error: true });
      return false;
    }
    setSheet(null);
    show({ text: done, onUndo: () => void undoLatest(command.name) });
    return true;
  }

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Someone';

  function fireLine(): string {
    if (!fire.lit) return 'Not lit yet';
    if (!fire.burning) return `Out, ${fire.bundles} ${fire.bundles === 1 ? 'bundle' : 'bundles'} used`;
    const left = fire.now?.left ?? null;
    return `Burning, ${leftWords(left, hour ? { name: 'hour', seconds: hour } : null)}`;
  }

  function stepBody(step: CampStep) {
    switch (step.part) {
      case 'fire':
        return (
          <>
            <p className="camp__state">{`${info.fire?.name ?? 'Campfire'}, ${fireLine()}`}</p>
            <button type="button" className="button-secondary" onClick={() => setSheet({ kind: 'fuel' })}>
              Add firewood from packs
            </button>
          </>
        );
      case 'cooking':
        return (
          <>
            <p className="camp__state">{pot.made === 0 ? 'Nothing cooked yet' : `The pot: ${pot.left} of ${pot.made} ${pot.made === 1 ? 'portion' : 'portions'} left`}</p>
            {cooking?.bonus.length ? <p className="camp__note">{`A portion also gives: ${effectWords(cooking.bonus)}`}</p> : null}
            <button type="button" className="button-secondary" onClick={() => (cooking ? setSheet({ kind: 'cook' }) : show({ text: 'The setting has no cooking rule: cook at the table, and eat from your packs.' }))}>
              Cook
            </button>
          </>
        );
      case 'talk':
        return talk ? (
          <p className="camp__state">{`${nameOf(talk.actorId)} led it, ${talk.outcome === 'worked' ? 'it worked' : 'it didn’t work'}`}</p>
        ) : (
          <div className="camp__buttons">
            <button type="button" className="button-secondary" onClick={() => void talkNow('worked')}>
              It worked
            </button>
            <button type="button" className="button-secondary" onClick={() => void talkNow('failed')}>
              It didn’t work
            </button>
          </div>
        );
      case 'eat': {
        const notEaten = members.filter((m) => !meals.has(m.id));
        return (
          <>
            <ul className="camp__eaters">
              {mine.map((m) => {
                const meal = meals.get(m.id);
                return (
                  <li key={m.id} className="camp__eater">
                    <span className="camp__who">{m.name}</span>
                    {meal ? (
                      <span className="camp__done">{`✓ ${mealWords(meal)}`}</span>
                    ) : (
                      <button type="button" className="button-secondary" onClick={() => setSheet({ kind: 'eat', member: m })}>
                        Eat
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {gm && <p className="camp__state">{notEaten.length === 0 ? 'Everyone has eaten' : `Not eaten yet: ${notEaten.map((m) => m.name).join(', ')}`}</p>}
            {info.hunger && <p className="camp__note">{info.hunger}</p>}
          </>
        );
      }
      case 'watches':
        return (
          <WatchesStep
            info={info}
            members={members}
            mine={mine}
            watches={watchesOf(entries)}
            casters={casters}
            order={order}
            onSet={(next) => {
              if (next === 'full') return show({ text: `That watch has ${WATCH_MAX} already: pick another.` });
              const setter = mine[0];
              if (!setter) return show({ text: 'Only someone in the camp can set the watches.' });
              void write(setCampWatches, { campId: camp.id, actor: actorOf(setter), watches: next }, next.length ? `Watches: ${next.map((w, i) => `${ordinal(i + 1)} ${w.map(nameOf).join(', ')}`).join(', ')}` : 'Nobody on watch');
            }}
          />
        );
      case 'night':
        return <p className="camp__note">{gm ? 'Next day asks it first, while the camp is up; a hit asks Which watch? on its waiting card.' : 'The GM rolls it in the night.'}</p>;
      case 'sleep':
        return (
          <SleepStep
            info={info}
            step={step}
            gm={gm}
            members={members}
            mine={mine}
            entries={entries}
            carried={carried}
            fire={fire.burning}
            flags={campFlags(entries)}
            forcedMarch={forcedMarch}
            onSleep={(m, change) =>
              void write(campSleep, { campId: camp.id, actor: actorOf(m), ...change }, change.difficulty ? `${m.name}'s sleep: ${info.camp.sleep?.difficulties.find((d) => d.id === change.difficulty)?.name ?? change.difficulty}` : `${m.name} slept ${change.outcome === 'good' ? 'well' : 'badly'}`)
            }
            onHeal={(healed, amount) => void healAll(healed, amount)}
            onCondition={(marked, conditionId) => void markAll(marked, conditionId)}
          />
        );
      default:
        return null;
    }
  }

  /** A good rest's heal (D19: offered, one confirm): each ticked character's HP up by the amount, to their most. */
  async function healAll(healed: CampMember[], amount: number) {
    for (const m of healed) {
      const to = Math.min(m.hpMax ?? 0, (m.hpCurrent ?? 0) + amount);
      const character = { id: m.id, campaignId: campaign.id, ownerType: 'user' as const, ownerUserId: m.ownerUserId, approval: 'approved' as const, archived: false };
      const result = await runCommand(registry, db, user, setHp, { character, hpCurrent: to });
      if (!result.ok) return show({ text: result.message, error: true });
    }
    onChanged();
    show({ text: `Healed ${amount} HP: ${healed.map((m) => m.name).join(', ')}` });
  }

  /** A bad rest's condition (the GM's; offered, one confirm). */
  async function markAll(marked: CampMember[], conditionId: string) {
    const condition = info.conditions.find((c) => c.id === conditionId);
    if (!condition || marked.length === 0) return;
    const result = await runCommand(registry, db, user, addStatus, {
      target: { campaignId: campaign.id, characters: marked.map((m) => ({ id: m.id, campaignId: campaign.id, ownerUserId: m.ownerUserId })), secret: false },
      status: { name: condition.name, condition, timer: null, secret: false },
    });
    onChanged();
    if (!result.ok) return show({ text: result.message, error: true });
    show({ text: `${condition.name}: ${marked.map((m) => m.name).join(', ')}`, onUndo: () => void undoLatest('status.add') });
  }

  async function talkNow(outcome: 'worked' | 'failed') {
    const leader = mine[0];
    if (!leader) return show({ text: 'Only someone in the camp can lead it.' });
    await write(campTalk, { campId: camp.id, actor: actorOf(leader), outcome }, `Campfire talk, ${outcome === 'worked' ? 'it worked' : 'it didn’t work'}`);
  }

  const title = `Camp${groupLabel ? `: ${groupLabel}` : ''}`;
  return (
    <section className="camp" aria-label={title}>
      <h3 className="camp__title">{title}</h3>
      {camp.quick ? (
        <p className="camp__note">Quick camp: one tap, as the optional rule says. The night passes on Next day.</p>
      ) : (
        <ol className="camp__steps">
          {info.steps.map((step) => (
            <li key={step.id} className="camp__step">
              <p className="camp__name">{step.name}</p>
              {step.note && <p className="camp__note">{step.note}</p>}
              {stepBody(step)}
            </li>
          ))}
        </ol>
      )}
      {lines === 'error' && <Note tone="warning">Couldn't load what's in the packs. Check your connection and try again.</Note>}
      {sheet?.kind === 'fuel' && (
        <FuelSheet
          info={info}
          loading={lines === null}
          mine={mine}
          carried={carried}
          onClose={() => setSheet(null)}
          onPut={(m, line, qty) =>
            void write(addCampFuel, { campId: camp.id, actor: actorOf(m), lineId: line.id, qty, secondsEach: info.fire?.secondsEach ?? 0 }, `${qty} ${qty === 1 ? 'bundle' : 'bundles'} on the fire, from ${m.name}'s pack`)
          }
        />
      )}
      {sheet?.kind === 'cook' && cooking && (
        <CookSheet
          loading={lines === null}
          mine={mine}
          carried={(id) => carried(id).filter((l) => isFood(l) && (cooking.ingredients.length === 0 || (l.sourceEntryId !== null && cooking.ingredients.includes(l.sourceEntryId))))}
          cooking={cooking}
          onClose={() => setSheet(null)}
          onCook={(m, used, portions) =>
            void write(cookAtCamp, { campId: camp.id, actor: actorOf(m), ingredients: used, portions }, `${m.name} cooked, ${portions} ${portions === 1 ? 'portion' : 'portions'} in the pot`)
          }
        />
      )}
      {sheet?.kind === 'eat' && (
        <EatSheet
          loading={lines === null}
          member={sheet.member}
          pot={pot.left}
          bonus={cooking?.bonus ?? []}
          food={carried(sheet.member.id).filter(isFood)}
          givers={members.filter((g) => g.id !== sheet.member.id && (gm || g.ownerUserId === user.id)).map((g) => ({ member: g, food: carried(g.id).filter(isFood) }))}
          onClose={() => setSheet(null)}
          onEat={(choice) =>
            void write(
              eatAtCamp,
              { campId: camp.id, actor: actorOf(sheet.member), fromPot: choice === 'pot', lineId: choice === 'pot' ? null : choice.id },
              choice === 'pot' ? `${sheet.member.name} ate a portion` : `${sheet.member.name} ate ${choice.name}`,
            )
          }
          onGive={(giver, line) => {
            const from: CarrierRef = { campaignId: campaign.id, actorId: giver.id, locationId: null, ownerUserId: giver.ownerUserId, archived: false };
            const to: CarrierRef = { campaignId: campaign.id, actorId: sheet.member.id, locationId: null, ownerUserId: sheet.member.ownerUserId, archived: false };
            void write(moveItem, { line: { id: line.id, carrier: from, version: line.version }, to, qty: 1, of: line.qty }, `${giver.name} gave ${line.name} to ${sheet.member.name}`).then((done) => {
              if (done) setSheet({ kind: 'eat', member: sheet.member });
            });
          }}
        />
      )}
    </section>
  );
}

const isFood = (line: InventoryLine) => foodKindOf(line.details) !== null;

function FuelSheet({ info, mine, carried, loading, onClose, onPut }: { info: CampInfo; loading: boolean; mine: readonly CampMember[]; carried: (id: string) => InventoryLine[]; onClose: () => void; onPut: (m: CampMember, line: InventoryLine, qty: number) => void }) {
  const fuel = info.fire?.fuelItem ?? null;
  const rows = mine.flatMap((m) => carried(m.id).filter((l) => fuel !== null && l.sourceEntryId === fuel).map((line) => ({ m, line })));
  const [qty, setQty] = useState<Record<string, number>>({});
  return (
    <Dialog label="Add firewood from packs" onClose={onClose}>
      <div className="camp__sheet">
        {loading ? (
          <SkeletonRows rows={2} label="Loading the packs" />
        ) : fuel === null ? (
          <p className="camp__note">The setting names no firewood for this fire.</p>
        ) : rows.length === 0 ? (
          <p className="camp__note">No firewood in your packs. Someone with some can add it, or gather more.</p>
        ) : (
          rows.map(({ m, line }) => (
            <div key={line.id} className="camp__row">
              <p className="camp__who">{`${line.name} ×${line.qty}, ${m.name}`}</p>
              <Stepper label={`bundles of ${line.name}`} value={qty[line.id] ?? 1} min={1} max={line.qty} onChange={(v) => setQty({ ...qty, [line.id]: v })} />
              <button type="button" className="button-secondary" onClick={() => onPut(m, line, qty[line.id] ?? 1)}>
                Put on the fire
              </button>
            </div>
          ))
        )}
        {info.fire?.secondsEach === null && fuel !== null && <Note tone="info">The setting's burning time can't be read: the fire shows as out.</Note>}
      </div>
    </Dialog>
  );
}

function CookSheet({ mine, carried, cooking, loading, onClose, onCook }: {
  loading: boolean;
  mine: readonly CampMember[];
  carried: (id: string) => InventoryLine[];
  cooking: NonNullable<CampInfo['camp']['cooking']>;
  onClose: () => void;
  onCook: (m: CampMember, used: { lineId: string; qty: number }[], portions: number) => void;
}) {
  const show = useToast();
  const [cook, setCook] = useState<CampMember | null>(mine[0] ?? null);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [rolled, setRolled] = useState('');
  const food = cook ? carried(cook.id) : [];
  const count = food.reduce((sum, l) => sum + (used[l.id] ?? 0), 0);
  const made = cookPortions(cooking, count);
  return (
    <Dialog label="Cook" onClose={onClose}>
      <div className="camp__sheet">
        {mine.length > 1 && (
          <div className="camp__chips" role="group" aria-label="Who cooks?">
            {mine.map((m) => (
              <Chip key={m.id} pressed={cook?.id === m.id} onClick={() => {
                  setCook(m);
                  setUsed({});
                }}>
                {`${cook?.id === m.id ? '✓ ' : ''}${m.name}`}
              </Chip>
            ))}
          </div>
        )}
        {cooking.note && <p className="camp__note">{cooking.note}</p>}
        {loading ? (
          <SkeletonRows rows={2} label="Loading the packs" />
        ) : food.length === 0 ? (
          <p className="camp__note">{`Nothing to cook in ${cook?.name ?? 'your'}'s pack.`}</p>
        ) : (
          food.map((l) => (
            <div key={l.id} className="camp__row">
              <p className="camp__who">{`${l.name} ×${l.qty}`}</p>
              <Stepper label={`${l.name} to cook`} value={used[l.id] ?? 0} min={0} max={l.qty} onChange={(v) => setUsed({ ...used, [l.id]: v })} />
            </div>
          ))
        )}
        {made.roll ? (
          <label className="camp__field">
            {`Roll ${made.roll} for the portions`}
            <input className="travel__roll-input" inputMode="numeric" value={rolled} onChange={(e) => setRolled(e.target.value)} />
          </label>
        ) : (
          <p className="camp__state">{`${made.portions ?? 0} ${made.portions === 1 ? 'portion' : 'portions'}`}</p>
        )}
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            if (!cook) return show({ text: 'Only someone in the camp can cook.' });
            if (count === 0) return show({ text: 'Pick what to cook first.' });
            const portions = made.roll ? Number(rolled) : (made.portions ?? 0);
            if (!Number.isInteger(portions) || portions < 0 || (made.roll && !rolled.trim())) return show({ text: 'Enter the roll as a whole number.' });
            onCook(cook, food.filter((l) => (used[l.id] ?? 0) > 0).map((l) => ({ lineId: l.id, qty: used[l.id]! })), portions);
          }}
        >
          Cook
        </button>
      </div>
    </Dialog>
  );
}

function EatSheet({ member, pot, bonus, food, givers, loading, onClose, onEat, onGive }: {
  loading: boolean;
  member: CampMember;
  pot: number;
  bonus: readonly Record<string, unknown>[];
  food: InventoryLine[];
  givers: { member: CampMember; food: InventoryLine[] }[];
  onClose: () => void;
  onEat: (choice: 'pot' | InventoryLine) => void;
  onGive: (giver: CampMember, line: InventoryLine) => void;
}) {
  const lines: FoodLine[] = food.map((l) => ({ lineId: l.id, itemId: l.sourceEntryId ?? l.id, name: l.name, qty: l.qty, kind: foodKindOf(l.details)! }));
  if (pot > 0) lines.unshift({ lineId: 'pot', itemId: 'pot', name: 'A portion from the pot', qty: pot, kind: 'cooked' });
  const choices = foodChoices({ id: member.id, name: member.name, food: lines, eaten: false });
  const giving = givers.flatMap((g) => g.food.map((line) => ({ giver: g.member, line })));
  return (
    <Dialog label={`What does ${member.name} eat?`} onClose={onClose}>
      <div className="camp__sheet">
        {loading ? (
          <SkeletonRows rows={2} label="Loading the packs" />
        ) : choices.length === 0 ? (
          <>
            <Note tone="warning">{`${member.name} has nothing to eat.`}</Note>
            {giving.length > 0 ? (
              <>
                <p className="camp__name">Give food</p>
                {giving.map(({ giver, line }) => (
                  <div key={line.id} className="camp__row">
                    <p className="camp__who">{`${line.name}${kindWord(foodKindOf(line.details))}, ${giver.name}`}</p>
                    <button type="button" className="button-secondary" onClick={() => onGive(giver, line)}>
                      {`Give 1 to ${member.name}`}
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <p className="camp__note">Someone with food can give them some from their own pack.</p>
            )}
          </>
        ) : (
          choices.map((c) => (
            <button key={c.lineId} type="button" className="button-secondary camp__food" onClick={() => onEat(c.lineId === 'pot' ? 'pot' : food.find((l) => l.id === c.lineId)!)}>
              <span>{`${c.name}${c.lineId === 'pot' ? '' : ` ×${c.qty}`}${kindWord(c.kind)}`}</span>
              {c.suggested && <span className="camp__suggested">Suggested</span>}
              {c.lineId === 'pot' && bonus.length > 0 && <span className="camp__note">{`Also: ${effectWords(bonus)}`}</span>}
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
}
