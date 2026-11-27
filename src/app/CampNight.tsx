// Camp's night on the camp card (M5b step 4, part 2; ruled 2026-10-30, D18, D19; docs/05 Camp: Watches, Sleep).
//   Watches, by watch (fl-3, 2026-11-03; replaced the chips per character): one box per watch (its number, and its
//   time of night when the pack gives sunset and the watch's length) with its names as chips (✕ takes one off) and
//   + Add listing who's free (hidden at 3); "Not on watch: …" and the casters line under the boxes; Split evenly
//   fills the watches in marching order (casters kept off the last where it can), then the group adjusts; with no
//   night's length it first asks "How many watches tonight?" (a stepper, only counts the group can fill; bq3-4 C,
//   2026-11-04). Each watch
//   holds 1–3 (the order is the group's, so any player of the group or the GM sets it); a player sees their own watch.
//   Sleep: each character's difficulty from the facts (season, the campfire, bedding, shared bedding) with its reasons,
//   changeable by the GM; a good or bad rest with no roll, or the sleep check (the ability, the difficulty's add and
//   the camp's modifiers, campfire talk say) with Slept well / Slept badly; then the pack's good-rest effects are
//   offered ("Heal 1 HP to: ✓ ✓", never by themselves), and a bad rest's condition to the GM.
import { useState } from 'react';
import { offWatch, ordinal, putOnWatch, sleepRecords, splitEvenly, watchBoxCount, watchCountRange, watchNumberOf, watchTimeWords, WATCH_MAX, type CampEntry, type CampStep } from '../modules/expedition/camp.ts';
import { campSleep as sleepFacts } from '../modules/expedition/sleep.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { Chip, Note, RemoveChip, Stepper, TickConfirm } from '../ui/parts.tsx';
import type { CampInfo } from './campView.ts';
import type { CampMember } from './CampCard.tsx';
import { possessive } from '../core/nameWords.ts';

const hoursWords = (minutes: number) => (minutes % 60 === 0 ? `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`);

export function WatchesStep({ info, members, mine, watches, casters, order, onSet }: {
  info: CampInfo;
  members: readonly CampMember[];
  mine: readonly CampMember[];
  watches: string[][];
  /** Characters who cast (their class has spellcasting). */
  casters: ReadonlySet<string>;
  /** The group's marching order, front to back (Split evenly follows it); anyone missing goes at the back, by name. */
  order?: readonly string[];
  onSet: (next: string[][] | 'full') => void;
}) {
  const [adding, setAdding] = useState<number | null>(null);
  // With no night's length (bq3-4 C): the group says how many watches; it starts at those set, else 3, within the range.
  const range = watchCountRange(members.length);
  const [asked, setAsked] = useState<number | null>(null);
  const [limit, setLimit] = useState<'min' | 'max' | null>(null);
  const { night } = info;
  const ids = members.map((m) => m.id);
  const marching = [...(order ?? []).filter((id) => ids.includes(id)), ...ids.filter((id) => !(order ?? []).includes(id))];
  const boxes = watchBoxCount(night.watches, watches.length, members.length);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Someone';
  const off = offWatch(ids, watches);
  const castersOn = members.filter((m) => watchNumberOf(watches, m.id) !== null && casters.has(m.id));
  const player = mine.length < members.length;
  const askCount = Math.min(range.max, Math.max(range.min, asked ?? (watches.length || WATCH_MAX)));
  const splitCount = night.watches ? Math.min(night.watches, members.length) : askCount;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <>
      <p className="camp__state">
        {night.minutes !== null
          ? `The night: ${hoursWords(night.minutes)}${night.watches && night.watchMinutes ? `, ${night.watches} ${night.watches === 1 ? 'watch' : 'watches'} of ${hoursWords(night.watchMinutes)}` : ''}`
          : night.watchMinutes
            ? `Each watch: ${hoursWords(night.watchMinutes)}, the night's length is the GM's call`
            : "The night's length is the GM's call"}
      </p>
      {player &&
        mine.map((m) => {
          const at = watchNumberOf(watches, m.id);
          return <p key={m.id} className="camp__state">{`${m.name}, ${at ? `your watch: ${ordinal(at)}` : 'not on watch'}`}</p>;
        })}
      {!night.watches && members.length > 0 && (
        <div className="camp__count" role="group" aria-label="How many watches tonight?">
          <p className="camp__name" aria-hidden="true">How many watches tonight?</p>
          <Stepper label="watches tonight" value={askCount} min={range.min} max={range.max} onChange={setAsked} onLimit={setLimit} />
        </div>
      )}
      {members.length > 0 && (
        <div className="camp__buttons camp__split">
          <button type="button" className="button-secondary" onClick={() => onSet(splitEvenly(marching, splitCount, casters))}>
            Split evenly
          </button>
          <p className="camp__note">{`${plural(members.length, 'character', 'characters')} → ${plural(splitCount, 'watch', 'watches')}, in marching order`}</p>
        </div>
      )}
      {limit !== null && (
        <Dialog label="How many watches tonight?" onClose={() => setLimit(null)}>
          <p>
            {limit === 'max'
              ? `At most ${plural(range.max, 'watch', 'watches')}: each watch needs someone on it, and there ${members.length === 1 ? 'is 1 character' : `are ${members.length} characters`}.`
              : `At least ${plural(range.min, 'watch', 'watches')}: up to ${WATCH_MAX} on each, for ${plural(members.length, 'character', 'characters')}.`}
          </p>
        </Dialog>
      )}
      <ol className="camp__watches" aria-label="Watches">
        {Array.from({ length: boxes }, (_, i) => i + 1).map((n) => {
          const on = watches[n - 1] ?? [];
          const time = watchTimeWords(n, night.startsAt ?? null, night.watchMinutes, night.dayMinutes);
          // An empty watch can't sit between two set ones (each watch holds 1–3): only the first empty one takes names.
          const open = n <= watches.length + 1;
          return (
            <li key={n} className="camp__watch-box" aria-label={`${ordinal(n)} watch`}>
              <p className="camp__watch-head">
                <span className="camp__name">{`${ordinal(n)} watch`}</span>
                {time && <span className="camp__note">{time}</span>}
              </p>
              <div className="camp__chips">
                {on.map((id) => (
                  <RemoveChip key={id} label={`Take ${nameOf(id)} off the ${ordinal(n)} watch`} onRemove={() => onSet(putOnWatch(watches, id, null))}>
                    {nameOf(id)}
                  </RemoveChip>
                ))}
                {on.length === 0 && <span className="camp__note camp__nobody">{open ? 'No one yet' : `No one yet, fill the ${ordinal(watches.length + 1)} first`}</span>}
                {open && on.length < WATCH_MAX && (
                  <button type="button" className="button-secondary button-secondary--small" aria-label={`Add to the ${ordinal(n)} watch`} onClick={() => setAdding(n)}>
                    + Add
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="camp__note">{off.length ? `Not on watch: ${off.map(nameOf).join(', ')}` : 'Everyone is on a watch'}</p>
      {castersOn.length > 0 && <Note tone="info">{`Casters on watch: ${castersOn.map((m) => m.name).join(', ')}`}</Note>}
      {adding !== null && (
        <Dialog label={`Add to the ${ordinal(adding)} watch`} onClose={() => setAdding(null)}>
          {off.length ? (
            <div className="camp__buttons">
              {marching
                .filter((id) => off.includes(id))
                .map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setAdding(null);
                      onSet(putOnWatch(watches, id, adding));
                    }}
                  >
                    {nameOf(id)}
                  </button>
                ))}
            </div>
          ) : (
            <p className="camp__note">Everyone is on a watch. To move someone here, take them off their watch first (✕).</p>
          )}
          <p className="camp__note">{`Up to ${WATCH_MAX} on each watch.`}</p>
        </Dialog>
      )}
    </>
  );
}

export function SleepStep({ info, step, gm, members, mine, entries, carried, fire, flags, forcedMarch = false, onSleep, onHeal, onCondition }: {
  info: CampInfo;
  step: CampStep;
  gm: boolean;
  members: readonly CampMember[];
  mine: readonly CampMember[];
  entries: readonly CampEntry[];
  /** What each character carries that this person may see (the bedding). */
  carried: (id: string) => InventoryLine[];
  fire: boolean;
  flags: readonly string[];
  /**
   * The group forced the march today (D4): its rest is due here, through the shared rest flow (the rest prompt asks
   * Rest or Push on; Next day applies it). Ruled 2026-11-03, SC-4-3 A: the march no longer opens the flow at once.
   */
  forcedMarch?: boolean;
  onSleep: (member: CampMember, change: { difficulty?: string; roll?: string; outcome?: 'good' | 'bad' }) => void;
  onHeal: (members: CampMember[], amount: number) => void;
  onCondition: (members: CampMember[], conditionId: string) => void;
}) {
  const [rolls, setRolls] = useState<Record<string, string>>({});
  const [healTicked, setHealTicked] = useState<string[] | null>(null);
  const [badTicked, setBadTicked] = useState<string[] | null>(null);
  const rules = info.camp.sleep ?? null;
  const records = sleepRecords(entries);
  const sleepers = members.map((m) => ({ id: m.id, name: m.name, itemIds: carried(m.id).flatMap((l) => (l.sourceEntryId ? Array<string>(l.qty).fill(l.sourceEntryId) : [])) }));
  const overrides = Object.fromEntries([...records.entries()].flatMap(([id, r]) => (r.difficulty ? [[id, r.difficulty]] : [])));
  const looked = rules ? sleepFacts(rules, sleepers, { season: info.season, fire, flags }, { overrides, ability: step.step?.checkAbility ?? null }) : [];
  const outcomeOf = (id: string): 'good' | 'bad' | null => {
    const recorded = records.get(id)?.outcome ?? null;
    if (recorded) return recorded;
    const r = looked.find((l) => l.characterId === id)?.outcome;
    return r === 'good' || r === 'bad' ? r : null;
  };
  const shown = gm ? members : mine;
  const heal = step.step?.onGoodRest.find((e) => typeof e.heal === 'number');
  const healAmount = heal ? Number(heal.heal) : 0;
  const goodToHeal = mine.filter((m) => outcomeOf(m.id) === 'good' && m.hpMax !== null && m.hpMax !== undefined && (m.hpCurrent ?? 0) < m.hpMax);
  const badCondition = step.step?.onBadRest[0]?.condition ?? null;
  const condition = badCondition ? (info.conditions.find((c) => c.id === badCondition) ?? null) : null;
  const badOnes = gm ? members.filter((m) => outcomeOf(m.id) === 'bad') : [];
  const ability = rules?.checkAbility ?? step.step?.checkAbility ?? null;

  return (
    <>
      {forcedMarch && <Note tone="info">Rest due (forced march)</Note>}
      <ul className="camp__eaters">
        {shown.map((m) => {
          const s = looked.find((l) => l.characterId === m.id) ?? null;
          const recorded = records.get(m.id)?.outcome ?? null;
          const roll = s ? s.outcome === 'check' : true;
          const mods = s?.modifiers.map((x) => `${x.add >= 0 ? '+' : '−'}${Math.abs(x.add)} ${x.label}`).join(', ') ?? '';
          return (
            <li key={m.id} className="camp__sleeper">
              <p className="camp__who">{`${m.name}${s?.difficulty ? `, ${s.difficulty.name}${s.overridden ? ' (changed by the GM)' : ''}` : rules ? ', the GM decides' : ''}`}</p>
              {s && s.reasons.length > 0 && <p className="camp__note">{s.reasons.join(', ')}</p>}
              {gm && rules && (
                <div className="camp__chips" role="group" aria-label={`How hard is ${possessive(m.name)} sleep?`}>
                  {rules.difficulties.map((d) => (
                    <Chip key={d.id} pressed={s?.difficulty?.id === d.id} onClick={() => onSleep(m, { difficulty: d.id })}>
                      {`${s?.difficulty?.id === d.id ? '✓ ' : ''}${d.name}`}
                    </Chip>
                  ))}
                </div>
              )}
              {recorded ? (
                <p className="camp__done">{recorded === 'good' ? '✓ Slept well' : '✓ Slept badly'}</p>
              ) : !roll ? (
                <p className="camp__state">{s?.outcome === 'good' ? 'A good rest, no roll' : 'A bad rest, no roll'}</p>
              ) : (
                <>
                  <p className="camp__note">{`${ability ? `Roll ${ability}` : 'Roll to sleep'}${mods ? `, ${mods}` : ''}`}</p>
                  <div className="camp__buttons">
                    <input className="travel__roll-input" inputMode="numeric" aria-label={`${possessive(m.name)} roll`} value={rolls[m.id] ?? ''} onChange={(e) => setRolls({ ...rolls, [m.id]: e.target.value })} />
                    <button type="button" className="button-secondary" onClick={() => onSleep(m, { roll: rolls[m.id], outcome: 'good' })}>
                      Slept well
                    </button>
                    <button type="button" className="button-secondary" onClick={() => onSleep(m, { roll: rolls[m.id], outcome: 'bad' })}>
                      Slept badly
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {healAmount > 0 && goodToHeal.length > 0 && (
        <TickConfirm
          label={`A good rest: heal ${healAmount} HP to:`}
          options={goodToHeal.map((m) => ({ id: m.id, label: m.name }))}
          ticked={healTicked ?? goodToHeal.map((m) => m.id)}
          onChange={setHealTicked}
          confirm={`Heal ${healAmount}`}
          onConfirm={() => onHeal(goodToHeal.filter((m) => (healTicked ?? goodToHeal.map((x) => x.id)).includes(m.id)), healAmount)}
        />
      )}
      {condition && badOnes.length > 0 && (
        <TickConfirm
          label={`A bad rest: mark ${condition.name} on:`}
          options={badOnes.map((m) => ({ id: m.id, label: m.name }))}
          ticked={badTicked ?? badOnes.map((m) => m.id)}
          onChange={setBadTicked}
          confirm={`Mark ${condition.name}`}
          onConfirm={() => onCondition(badOnes.filter((m) => (badTicked ?? badOnes.map((x) => x.id)).includes(m.id)), condition.id)}
        />
      )}
    </>
  );
}
